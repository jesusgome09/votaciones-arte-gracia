window.addEventListener('hashchange', checkRoute);
window.addEventListener('load', checkRoute);

function checkRoute() {
  if (window.location.hash === '#admin') {
    document.querySelectorAll('.app-container > div:not(header)').forEach(el => el.classList.add('hidden'));
    document.getElementById('admin-panel').classList.remove('hidden');
  }
}

function loginAdmin() {
  const u = document.getElementById('admin-user').value;
  const p = document.getElementById('admin-pass').value;

  if (u === 'admin' && p === 'arteygracia2026') {
    document.getElementById('admin-login').classList.add('hidden');
    document.getElementById('admin-content').classList.remove('hidden');
    loadAdminData();
  } else {
    alert("Credenciales incorrectas.");
  }
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

  if (tabName === 'live-control') {
    document.querySelector("button[onclick=\"switchAdminTab('live-control')\"]").classList.add('active');
    document.getElementById('tab-live-control').classList.remove('hidden');
  } else if (tabName === 'fair-winners') {
    document.querySelector("button[onclick=\"switchAdminTab('fair-winners')\"]").classList.add('active');
    document.getElementById('tab-fair-winners').classList.remove('hidden');
  } else if (tabName === 'details') {
    document.querySelector("button[onclick=\"switchAdminTab('details')\"]").classList.add('active');
    document.getElementById('tab-details').classList.remove('hidden');
  } else if (tabName === 'audit') {
    document.querySelector("button[onclick=\"switchAdminTab('audit')\"]").classList.add('active');
    document.getElementById('tab-audit').classList.remove('hidden');
  }
}

let globalVotesData = [];
let revealedCategories = {};
let currentVotingStatus = false;
let fairResultsMap = {}; // Guardará los ganadores regulados (Max 2, Min 1, Sin empates)

async function loadAdminData() {
  if (!supabaseClient) {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      alert("No se pudo conectar a la base de datos.");
      return;
    }
  }

  // 1. ESTADO DE VOTACIONES
  const { data: configData } = await supabaseClient.from('configuracion_evento').select('*').eq('id', 'global').single();
  if (configData) {
    currentVotingStatus = configData.votaciones_abiertas;
    renderVotingToggleButton();
  }

  // 2. VOTOS
  const { data, error } = await supabaseClient.from('votos').select('*');
  if (error) {
    alert("Error cargando votos.");
    return;
  }
  globalVotesData = data;

  // 3. REVELACIONES
  const { data: revData } = await supabaseClient.from('revelaciones').select('*');
  if (revData) {
    revealedCategories = {};
    revData.forEach(r => revealedCategories[r.categoria_id] = true);
  }

  // MÉTRICAS GENERALES
  document.getElementById('stat-total-votes').innerText = data.length;

  const deviceMap = {};
  data.forEach(v => {
    if (!deviceMap[v.device_id]) deviceMap[v.device_id] = [];
    deviceMap[v.device_id].push(v.nombre_votante);
  });

  document.getElementById('stat-unique-devs').innerText = Object.keys(deviceMap).length;
  const suspiciousDevs = Object.keys(deviceMap).filter(devId => deviceMap[devId].length > 1);
  document.getElementById('stat-suspicious-devs').innerText = suspiciousDevs.length;

  // CALCULAR RESULTADOS CON EL ALGORITMO JUSTO
  fairResultsMap = calculateFairWinners(data);

  // RENDERIZAR VISTAS
  renderLiveControl(data);
  renderFairWinners();
  renderDetails(data);
  renderAudit(deviceMap, suspiciousDevs);
}

function renderVotingToggleButton() {
  const btn = document.getElementById('btn-toggle-voting');
  if (currentVotingStatus) {
    btn.innerText = "🔴 CERRAR VOTACIONES";
    btn.className = "btn btn-small btn-status-open";
  } else {
    btn.innerText = "🟢 ABRIR VOTACIONES";
    btn.className = "btn btn-small btn-status-closed";
  }
}

async function toggleVotingState() {
  const nextStatus = !currentVotingStatus;
  const { error } = await supabaseClient.from('configuracion_evento').upsert([{ id: 'global', votaciones_abiertas: nextStatus, updated_at: new Date().toISOString() }]);
  if (error) {
    alert("Error cambiando estado de votación.");
    return;
  }
  currentVotingStatus = nextStatus;
  renderVotingToggleButton();
  alert(`Las votaciones han sido ${nextStatus ? 'ABIERTAS' : 'CERRADAS'}.`);
}

// ALGORITMO JUSTO: 12 PREMIOS, 9 CANDIDATOS, MAX 2, MIN 1, SIN EMPATES
function calculateFairWinners(data) {
  const allCandidates = ["Jonathan", "Cesar", "Elias", "Emanuel", "Yulisa", "Isabel", "Arlys", "Carla", "Yimirli"];
  const winsCount = {};
  allCandidates.forEach(c => winsCount[c] = 0);

  // 1. Calcular matriz de votos por categoría
  const categoryVotes = {};
  categories.forEach(cat => {
    categoryVotes[cat.id] = {};
    cat.options.forEach(opt => categoryVotes[cat.id][opt] = 0);

    data.forEach(v => {
      const selected = v.votos_json[cat.id];
      if (selected && categoryVotes[cat.id][selected] !== undefined) {
        categoryVotes[cat.id][selected]++;
      }
    });
  });

  const finalWinners = {};

  // Ordenar categorías según el margen de victoria (las más claras primero)
  const categoryPriority = categories.map(cat => {
    const sorted = Object.entries(categoryVotes[cat.id]).sort((a, b) => b[1] - a[1]);
    const topDiff = (sorted[0] ? sorted[0][1] : 0) - (sorted[1] ? sorted[1][1] : 0);
    return { catId: cat.id, topDiff, sorted };
  }).sort((a, b) => b.topDiff - a.topDiff);

  // Pasada 1: Asignación por voto popular respetando Max 2
  categoryPriority.forEach(item => {
    const catId = item.catId;
    let chosen = null;

    for (let entry of item.sorted) {
      const candidate = entry[0];
      if (winsCount[candidate] < 2) {
        chosen = candidate;
        break;
      }
    }

    if (!chosen) chosen = item.sorted[0][0]; // Fallback
    finalWinners[catId] = chosen;
    winsCount[chosen]++;
  });

  // Pasada 2: Garantizar Min 1 para cada uno de los 9 candidatos
  const zeroWinners = allCandidates.filter(c => winsCount[c] === 0);

  zeroWinners.forEach(unluckyCandidate => {
    // Buscar la categoría donde este candidato tuvo mejor desempeño
    let bestCat = null;
    let bestVotes = -1;

    categories.forEach(cat => {
      if (cat.options.includes(unluckyCandidate)) {
        const v = categoryVotes[cat.id][unluckyCandidate] || 0;
        const currentWinner = finalWinners[cat.id];
        // Solo ajustar si el ganador actual tiene 2 premios
        if (winsCount[currentWinner] > 1 && v >= bestVotes) {
          bestVotes = v;
          bestCat = cat.id;
        }
      }
    });

    if (bestCat) {
      const previousWinner = finalWinners[bestCat];
      winsCount[previousWinner]--;
      finalWinners[bestCat] = unluckyCandidate;
      winsCount[unluckyCandidate]++;
    }
  });

  return { finalWinners, categoryVotes, winsCount };
}

function renderFairWinners() {
  const container = document.getElementById('fair-winners-grid');
  container.innerHTML = "";

  const { finalWinners, categoryVotes, winsCount } = fairResultsMap;

  categories.forEach(cat => {
    const winnerName = finalWinners[cat.id];
    const votes = categoryVotes[cat.id][winnerName] || 0;
    const totalVotes = globalVotesData.length;
    const pct = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;
    const fileName = winnerName.toLowerCase() + '.jpeg';

    const card = document.createElement('div');
    card.className = 'winner-card';
    card.innerHTML = `
      <div class="winner-info">
        <img class="winner-avatar" src="./images/${fileName}" alt="${winnerName}" onerror="this.src='https://via.placeholder.com/50?text=${winnerName}';">
        <div>
          <div class="winner-cat-title">${cat.title}</div>
          <div class="winner-name">${winnerName}</div>
          <span class="fair-tag">Premios asignados a este nominado: ${winsCount[winnerName]}</span>
        </div>
      </div>
      <div class="winner-badge">
        👑 ${votes} votos<br>
        <small style="color: var(--text-muted);">${pct}%</small>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderLiveControl(data) {
  const container = document.getElementById('live-control-list');
  container.innerHTML = "";

  const { finalWinners, categoryVotes } = fairResultsMap;

  categories.forEach(cat => {
    const isAnnounced = revealedCategories[cat.id];
    const winnerName = finalWinners[cat.id] || "Por definir";
    
    const card = document.createElement('div');
    card.className = `control-card ${isAnnounced ? 'announced' : ''}`;
    
    card.innerHTML = `
      <div>
        <strong style="font-size: 0.85rem; color: #fff;">${cat.title}</strong>
        <div style="font-size: 0.75rem; color: var(--gold);">Ganador Regulado: <strong>${winnerName}</strong></div>
      </div>
      <button class="btn ${isAnnounced ? 'btn-secondary' : 'btn-gold'}" style="width: auto; padding: 8px 12px; font-size: 0.8rem;" onclick="announceCategory('${cat.id}')">
        ${isAnnounced ? 'Volver a Anunciar' : '📣 Anunciar Ganador'}
      </button>
    `;

    container.appendChild(card);
  });
}

async function announceCategory(catId) {
  const cat = categories.find(c => c.id === catId);
  if (!cat) return;

  const { finalWinners, categoryVotes } = fairResultsMap;
  const winnerName = finalWinners[catId];

  // Calcular ranking completo para esta categoría
  const sorted = cat.options.map(opt => ({
    name: opt,
    votes: categoryVotes[catId][opt] || 0
  })).sort((a, b) => {
    if (a.name === winnerName) return -1;
    if (b.name === winnerName) return 1;
    return b.votes - a.votes;
  });

  const winner = sorted[0];
  const second = sorted[1] || { name: null, votes: 0 };
  const third = sorted[2] || { name: null, votes: 0 };

  const totalVotes = globalVotesData.length;
  const pct = totalVotes > 0 ? ((winner.votes / totalVotes) * 100).toFixed(1) : 0;

  const payload = {
    categoria_id: catId,
    ganador_nombre: winner.name,
    votos_ganador: winner.votes,
    porcentaje_ganador: parseFloat(pct),
    segundo_nombre: second.name,
    votos_segundo: second.votes,
    tercero_nombre: third.name,
    votos_tercero: third.votes,
    revelado_at: new Date().toISOString()
  };

  const { error } = await supabaseClient.from('revelaciones').upsert([payload]);
  if (error) {
    console.error(error);
    alert("Error al anunciar en vivo.");
    return;
  }

  revealedCategories[catId] = true;
  renderLiveControl(globalVotesData);
  alert(`📢 ¡Ganador de ${cat.title} (${winner.name}) anunciado a la sala!`);
}

function renderDetails(data) {
  const container = document.getElementById('admin-results');
  container.innerHTML = "";

  categories.forEach(cat => {
    const votesInCat = {};
    cat.options.forEach(o => votesInCat[o] = 0);

    data.forEach(v => {
      const selected = v.votos_json[cat.id];
      if (selected && votesInCat[selected] !== undefined) {
        votesInCat[selected]++;
      }
    });

    const catBlock = document.createElement('div');
    catBlock.style.marginBottom = "16px";
    catBlock.innerHTML = `<strong style="font-size: 0.85rem; color: #fff;">${cat.title}</strong>`;

    cat.options.forEach(opt => {
      const count = votesInCat[opt];
      const pct = data.length > 0 ? ((count / data.length) * 100).toFixed(1) : 0;

      const row = document.createElement('div');
      row.style.fontSize = "0.75rem";
      row.style.margin = "4px 0";
      row.innerHTML = `
        <div style="display: flex; justify-content: space-between;">
          <span>${opt}</span>
          <span>${count} votos (${pct}%)</span>
        </div>
        <div class="bar-outer">
          <div class="bar-inner" style="width: ${pct}%;"></div>
        </div>
      `;
      catBlock.appendChild(row);
    });

    container.appendChild(catBlock);
  });
}

function renderAudit(deviceMap, suspiciousDevs) {
  const container = document.getElementById('audit-list');
  container.innerHTML = "";

  if (suspiciousDevs.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 20px;">✅ No hay dispositivos duplicados. Todos los votos parecen legítimos.</div>`;
    return;
  }

  suspiciousDevs.forEach(devId => {
    const users = deviceMap[devId];
    const card = document.createElement('div');
    card.className = 'audit-item';
    card.innerHTML = `
      <div class="audit-dev-id">📱 ID: ${devId} (${users.length} votos)</div>
      <div class="audit-users"><strong>Nombres registrados:</strong> ${users.join(', ')}</div>
    `;
    container.appendChild(card);
  });
}

function exportVotesCSV() {
  if (!globalVotesData || globalVotesData.length === 0) {
    alert("No hay votos para exportar.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,ID,Fecha,Nombre,DeviceID\n";
  globalVotesData.forEach(r => {
    csvContent += `"${r.id}","${r.created_at}","${r.nombre_votante}","${r.device_id}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `votacion_premios_2026.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}