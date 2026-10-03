// ESCUCHAR CAMBIOS DE RUTA CON #admin
window.addEventListener('hashchange', checkRoute);
window.addEventListener('load', checkRoute);

function checkRoute() {
  if (window.location.hash === '#admin') {
    document.querySelectorAll('.app-container > div:not(header)').forEach(el => el.classList.add('hidden'));
    document.getElementById('admin-panel').classList.remove('hidden');
  }
}

// INICIAR SESIÓN EN EL PANEL ADMIN
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

// CARGAR MÉTRICAS Y RESULTADOS REALTIME
async function loadAdminData() {
  if (!supabaseClient) {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      alert("No se pudo conectar a la base de datos.");
      return;
    }
  }

  const { data, error } = await supabaseClient.from('votos').select('*');
  if (error) {
    alert("Error cargando datos de la base de datos.");
    return;
  }

  document.getElementById('stat-total-votes').innerText = data.length;

  // DETECTAR CLONACIÓN / DISPOSITIVOS DUPLICADOS
  const deviceCounts = {};
  data.forEach(v => {
    deviceCounts[v.device_id] = (deviceCounts[v.device_id] || 0) + 1;
  });

  const hasDuplicates = Object.values(deviceCounts).some(count => count > 1);
  if (hasDuplicates) {
    document.getElementById('duplicate-alert').classList.remove('hidden');
  } else {
    document.getElementById('duplicate-alert').classList.add('hidden');
  }

  // DESGLOSE DE RESULTADOS POR CATEGORÍA
  const resultsContainer = document.getElementById('admin-results');
  resultsContainer.innerHTML = "";

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

    resultsContainer.appendChild(catBlock);
  });
}