const SUPABASE_URL = "https://stzfvmjuyqpgastowkwr.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0emZ2bWp1eXFwZ2FzdG93a3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5OTcxMjIsImV4cCI6MjEwNjU3MzEyMn0.2b9O-iDYL3en8sEN2k_mwju7tn8xcf3yBw4anyo8VOQ";

let supabaseClient = null;
let isVotingOpen = false;

window.addEventListener('DOMContentLoaded', () => {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    initVotingStatusListener();
  }
});

function getDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('device_id', id);
  }
  return id;
}

const categories = [
  { id: "actor", title: "Mejor Actor 2026", desc: "Elige al mejor actor del año", options: ["Jonathan", "Cesar", "Elias", "Emanuel"] },
  { id: "actriz", title: "Mejor Actriz 2026", desc: "Elige a la mejor actriz del año", options: ["Yulisa", "Isabel", "Arlys", "Carla", "Yimirli"] },
  { id: "revelacion", title: "Revelación del Año", desc: "El talento nuevo que nos sorprendió a todos este año", options: ["Yulisa", "Elias", "Carla", "Emanuel", "Isabel"] },
  { id: "traje", title: "Mejor Traje", desc: "El vestuario más creativo, detallado y que mejor representó su personaje", options: ["Jonathan", "Arlys", "Yimirli", "Cesar", "Elias"] },
  { id: "siervo", title: "Corazón de Siervo", desc: "Quién está siempre dispuesto a ayudar con amor, sin que se lo pidan", options: ["Isabel", "Elias", "Yimirli", "Emanuel", "Yulisa", "Arlys"] },
  { id: "evangelista", title: "Llama Evangelista", desc: "Quién lleva el mensaje de Dios con pasión", options: ["Jonathan", "Yulisa", "Emanuel", "Cesar"] },
  { id: "fiel", title: "El Más Fiel", desc: "Quién nunca falla, siempre está presente en ensayos, reuniones y presentaciones", options: ["Arlys", "Yulisa", "Isabel", "Jonathan"] },
  { id: "companero", title: "Mejor Compañero", desc: "El que apoya, anima y une a todo el grupo", options: ["Yimirli", "Jonathan", "Emanuel", "Elias"] },
  { id: "siervofiel", title: "Siervo Fiel", desc: "El que es constante en lo poco y en lo mucho siempre cumple con amor y humildad", options: ["Jonathan", "Arlys", "Isabel", "Yulisa"] },
  { id: "antorcha", title: "Antorcha Viva", desc: "Contagia pasión, fuego y amor por ganar almas", options: ["Cesar", "Jonathan", "Emanuel"] },
  { id: "pastor", title: "Corazón de Pastor", desc: "Quién cuida, abraza y aconseja", options: ["Cesar", "Elias", "Yulisa", "Isabel"] },
  { id: "publico", title: "Premio del Público", desc: "Tu favorito del público", options: ["Carla", "Yimirli", "Isabel", "Yulisa", "Arlys", "Elias"] }
];

let currentStep = 0;
let voterName = "";
let userVotes = {};

async function initVotingStatusListener() {
  if (!supabaseClient) return;

  // Cargar estado inicial
  const { data } = await supabaseClient.from('configuracion_evento').select('*').eq('id', 'global').single();
  if (data) {
    updateVotingUIState(data.votaciones_abiertas);
  }

  // Escuchar cambios en Realtime
  supabaseClient
    .channel('config_realtime')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'configuracion_evento' }, payload => {
      if (payload.new && payload.new.id === 'global') {
        updateVotingUIState(payload.new.votaciones_abiertas);
      }
    })
    .subscribe();
}

function updateVotingUIState(isOpen) {
  isVotingOpen = isOpen;
  
  if (window.location.hash === '#admin') return;

  const stepName = document.getElementById('step-name');
  const stepVoting = document.getElementById('step-voting');
  const stepConfirm = document.getElementById('step-confirm');
  const closedBanner = document.getElementById('closed-banner');

  if (!isOpen) {
    // Si la votación se cierra mientras el usuario está en el proceso, se le bloquea
    if (!stepVoting.classList.contains('hidden') || !stepName.classList.contains('hidden') || !stepConfirm.classList.contains('hidden')) {
      stepName.classList.add('hidden');
      stepVoting.classList.add('hidden');
      stepConfirm.classList.add('hidden');
      document.getElementById('progress-container').classList.add('hidden');
      closedBanner.classList.remove('hidden');
    }
  } else {
    closedBanner.classList.add('hidden');
    // Si no ha votado ni enviado, volver al formulario
    if (document.getElementById('step-thanks').classList.contains('hidden') && document.getElementById('step-live-gala').classList.contains('hidden')) {
      stepName.classList.remove('hidden');
    }
  }
}

function startVoting() {
  if (!isVotingOpen) {
    alert("Las votaciones están cerradas en este momento.");
    return;
  }

  const nameInput = document.getElementById('voter-name');
  if (!nameInput) return;
  
  const val = nameInput.value.trim();
  if (!val) {
    alert("Por favor ingresa tu nombre para continuar.");
    return;
  }

  voterName = val;
  document.getElementById('step-name').classList.add('hidden');
  document.getElementById('step-voting').classList.remove('hidden');
  document.getElementById('progress-container').classList.remove('hidden');
  renderCategory();
}

function renderCategory() {
  const cat = categories[currentStep];
  
  document.getElementById('cat-step').innerText = `Categoría ${currentStep + 1} de ${categories.length}`;
  document.getElementById('cat-title').innerText = cat.title;
  document.getElementById('cat-desc').innerText = cat.desc;

  const fillPercent = ((currentStep + 1) / categories.length) * 100;
  document.getElementById('progress-fill').style.width = fillPercent + '%';

  const container = document.getElementById('options-container');
  container.innerHTML = "";

  cat.options.forEach(name => {
    const isSelected = userVotes[cat.id] === name;
    const card = document.createElement('div');
    card.className = `candidate-card ${isSelected ? 'selected' : ''}`;
    
    const fileName = name.toLowerCase() + '.jpeg';
    
    card.innerHTML = `
      <img class="candidate-avatar" src="./images/${fileName}" alt="${name}" onerror="this.onerror=null; this.src='https://via.placeholder.com/70/19090b/fbbf24?text=${name}';">
      <div class="candidate-name">${name}</div>
    `;

    card.onclick = () => {
      userVotes[cat.id] = name;
      renderCategory();
    };

    container.appendChild(card);
  });

  document.getElementById('btn-prev').disabled = currentStep === 0;
  document.getElementById('btn-next').disabled = !userVotes[cat.id];
}

function nextCategory() {
  if (currentStep < categories.length - 1) {
    currentStep++;
    renderCategory();
  } else {
    showConfirmation();
  }
}

function prevCategory() {
  if (currentStep > 0) {
    currentStep--;
    renderCategory();
  }
}

function showConfirmation() {
  document.getElementById('step-voting').classList.add('hidden');
  document.getElementById('step-confirm').classList.remove('hidden');

  const container = document.getElementById('summary-container');
  container.innerHTML = "";

  categories.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'summary-item';
    item.innerHTML = `
      <span class="cat">${cat.title}:</span>
      <span class="val">${userVotes[cat.id] || 'Sin voto'}</span>
    `;
    container.appendChild(item);
  });
}

async function submitVotes() {
  if (!isVotingOpen) {
    alert("Lo sentimos, las votaciones acaban de cerrarse.");
    return;
  }

  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.innerText = "Guardando...";

  const payload = {
    nombre_votante: voterName,
    device_id: getDeviceId(),
    votos_json: userVotes
  };

  if (supabaseClient) {
    const { error } = await supabaseClient.from('votos').insert([payload]);
    if (error) {
      console.error("Error al guardar en Supabase:", error);
      alert("Ocurrió un error al guardar tu voto. Revisa la conexión.");
      btn.disabled = false;
      btn.innerText = "Enviar Mis Votos";
      return;
    }
  }

  document.getElementById('step-confirm').classList.add('hidden');
  document.getElementById('progress-container').classList.add('hidden');
  document.getElementById('step-thanks').classList.remove('hidden');
}

function resetForNewVote() {
  if (!isVotingOpen) {
    alert("Las votaciones están cerradas actualmente.");
    return;
  }
  userVotes = {};
  currentStep = 0;
  voterName = "";
  document.getElementById('voter-name').value = "";
  
  document.getElementById('step-thanks').classList.add('hidden');
  document.getElementById('step-name').classList.remove('hidden');
}

async function enterLiveGala() {
  document.getElementById('step-thanks').classList.add('hidden');
  document.getElementById('step-live-gala').classList.remove('hidden');

  await fetchInitialRevelations();

  if (supabaseClient) {
    supabaseClient
      .channel('revelaciones_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'revelaciones' }, payload => {
        addRevelationCard(payload.new);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'revelaciones' }, payload => {
        addRevelationCard(payload.new);
      })
      .subscribe();
  }
}

async function fetchInitialRevelations() {
  if (!supabaseClient) return;

  const { data } = await supabaseClient.from('revelaciones').select('*').order('revelado_at', { ascending: true });
  if (data && data.length > 0) {
    const container = document.getElementById('live-revelations-container');
    container.innerHTML = "";
    data.forEach(rev => addRevelationCard(rev));
  }
}

function addRevelationCard(rev) {
  const container = document.getElementById('live-revelations-container');
  
  const waitingBox = container.querySelector('.waiting-box');
  if (waitingBox) waitingBox.remove();

  let card = document.getElementById(`rev-card-${rev.categoria_id}`);
  if (!card) {
    card = document.createElement('div');
    card.id = `rev-card-${rev.categoria_id}`;
    card.className = 'reveal-card';
    container.prepend(card);
  }

  const catObj = categories.find(c => c.id === rev.categoria_id) || { title: rev.categoria_id };
  const fileName = rev.ganador_nombre.toLowerCase() + '.jpeg';

  card.innerHTML = `
    <div class="reveal-header">🏆 ${catObj.title}</div>
    <div class="reveal-winner-row">
      <img class="reveal-avatar" src="./images/${fileName}" alt="${rev.ganador_nombre}" onerror="this.src='https://via.placeholder.com/50?text=${rev.ganador_nombre}';">
      <div>
        <div class="reveal-winner-name">🥇 ${rev.ganador_nombre}</div>
        <div class="reveal-stats">${rev.votos_ganador} votos (${rev.porcentaje_ganador}%)</div>
      </div>
    </div>
    <div class="podium-list">
      ${rev.segundo_nombre ? `<div class="podium-item"><span>🥈 2do Lugar: <strong>${rev.segundo_nombre}</strong></span> <span>${rev.votos_segundo} votos</span></div>` : ''}
      ${rev.tercero_nombre ? `<div class="podium-item"><span>🥉 3er Lugar: <strong>${rev.tercero_nombre}</strong></span> <span>${rev.votos_tercero} votos</span></div>` : ''}
    </div>
  `;
}
function enterLiveGalaFromBanner() {
  document.getElementById('closed-banner').classList.add('hidden');
  enterLiveGala();
}