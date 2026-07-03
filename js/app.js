// ============================================================
// app.js — Client Supabase partagé + utilitaires communs
// ============================================================

// var (pas const/let) pour éviter le TDZ si le CDN est lent
var db = null;
(function () {
  if (typeof supabase === 'undefined') {
    console.error('Supabase CDN non chargé — vérifie ta connexion internet');
    return;
  }
  if (!CONFIG || CONFIG.SUPABASE_URL === 'REMPLACE_PAR_TON_URL') {
    console.warn('config.js non configuré — remplis SUPABASE_URL et SUPABASE_ANON_KEY');
    return;
  }
  try {
    db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  } catch (e) {
    console.error('Erreur init Supabase :', e);
  }
})();

// ── Admin : client avec service key (entré manuellement) ────
function getAdminDb() {
  const key = sessionStorage.getItem('admin_service_key');
  if (!key) return null;
  return supabase.createClient(CONFIG.SUPABASE_URL, key);
}

// ── Mon équipe (localStorage) ─────────────────────────────
function getMonEquipe() {
  try { return JSON.parse(localStorage.getItem('mon_equipe') || 'null'); } catch { return null; }
}
function setMonEquipe(data) {
  localStorage.setItem('mon_equipe', JSON.stringify(data));
}

// ── Navigation ────────────────────────────────────────────
function buildNav(activePage) {
  const moi = getMonEquipe();
  const monEquipeLink = moi
    ? `<a href="equipe.html?id=${moi.id}" class="${activePage === 'equipe' ? 'active' : ''}">⚽ Mon équipe</a>`
    : `<a href="creer.html" class="${activePage === 'creer' ? 'active' : ''}">➕ Créer mon équipe</a>`;

  return `
    <nav class="main-nav">
      <a href="index.html" class="nav-logo">🐔 Fantasy CDM</a>
      <div class="nav-links">
        <a href="index.html" class="${activePage === 'classement' ? 'active' : ''}">🏆 Classement</a>
        ${monEquipeLink}
        <a href="scores.html" class="${activePage === 'scores' ? 'active' : ''}">📋 Scores</a>
        <a href="bareme.html" class="${activePage === 'bareme' ? 'active' : ''}">⭐ Barème</a>
        <a href="tournoi.html" class="${activePage === 'tournoi' ? 'active' : ''}">🌍 Tournoi</a>
        <a href="graphiques.html" class="${activePage === 'graphiques' ? 'active' : ''}">📊 Stats</a>
        <a href="patchnotes.html" class="${activePage === 'patchnotes' ? 'active' : ''}">📝</a>
        <a href="admin.html" class="${activePage === 'admin' ? 'active' : ''}">⚙️</a>
      </div>
    </nav>`;
}

// ── Toast notifications ───────────────────────────────────
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
}

// ── Loading state ─────────────────────────────────────────
function setLoading(el, loading, text = '') {
  if (!el) return;
  if (loading) {
    el.dataset.originalText = el.innerHTML;
    el.innerHTML = '<span class="spinner"></span>' + (text ? ' ' + text : '');
    el.disabled = true;
  } else {
    el.innerHTML = el.dataset.originalText || el.innerHTML;
    el.disabled = false;
  }
}

// ── Format date ───────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

// ── Calcul de points (identique à Points.gs) ─────────────
function calculerPoints(poste, stats) {
  const b = CONFIG.BAREME[poste];
  if (!b) return { points: 0, detail: {} };
  const detail = {};
  let total = 0;

  const add = (label, val) => { if (val !== 0) { detail[label] = val; total += val; } };

  if (stats.minutes >= 60)      add('Temps (≥60 min)',   b.min60);
  else if (stats.minutes > 0)   add('Temps (<60 min)',   b.moins60);

  if (stats.buts > 0)           add(`Buts ×${stats.buts}`,  b.but * stats.buts);
  if (stats.passes > 0)         add(`Passes ×${stats.passes}`, b.passe * stats.passes);
  if (stats.clean_sheet)        add('Clean sheet',       b.cleanSheet);

  if (poste === 'GAR' && stats.arrets >= 3) {
    const t = Math.floor(stats.arrets / 3);
    add(`Arrêts ×${t}`,  b.arrets3 * t);
  }

  if (stats.pen_arrete)         add('Penalty arrêté',   b.penArrete);
  if (stats.pen_manque)         add('Penalty manqué',   b.penManque);

  if (stats.buts_encaisses >= 2) {
    const t = Math.floor(stats.buts_encaisses / 2);
    add(`Buts enc. ×${t}`,  b.butEnc2 * t);
  }

  if (stats.jaune)              add('Carton jaune',      b.jaune);
  if (stats.rouge)              add('Carton rouge',      b.rouge);
  if (stats.csc > 0)            add(`CSC ×${stats.csc}`, b.csc * stats.csc);

  return { points: total, detail };
}

// ── Vue terrain (pitch) — même rendu que la création ─────
const PITCH_SVG_LINES = `<svg class="pitch-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
  <rect x="2" y="2" width="96" height="96" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="0.7"/>
  <line x1="2" y1="50" x2="98" y2="50" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>
  <circle cx="50" cy="50" r="13" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="0.5"/>
  <circle cx="50" cy="50" r="1.5" fill="rgba(255,255,255,0.32)"/>
  <rect x="22" y="2" width="56" height="24" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="0.5"/>
  <rect x="34" y="2" width="32" height="9" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="0.5"/>
  <circle cx="50" cy="17" r="1" fill="rgba(255,255,255,0.24)"/>
  <rect x="22" y="74" width="56" height="24" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="0.5"/>
  <rect x="34" y="89" width="32" height="9" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="0.5"/>
  <circle cx="50" cy="83" r="1" fill="rgba(255,255,255,0.24)"/>
  <path d="M 2 7 A 5 5 0 0 0 7 2" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="0.5"/>
  <path d="M 93 2 A 5 5 0 0 0 98 7" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="0.5"/>
  <path d="M 2 93 A 5 5 0 0 1 7 98" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="0.5"/>
  <path d="M 93 98 A 5 5 0 0 1 98 93" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="0.5"/>
</svg>`;

function renderPitch(joueurs) {
  const byPos = { GAR: [], DEF: [], MIL: [], ATT: [] };
  joueurs.forEach(j => { if (byPos[j.poste]) byPos[j.poste].push(j); });

  const rows = ['ATT', 'MIL', 'DEF', 'GAR'].map(pos => {
    const color = CONFIG.COLORS[pos];
    const slots = byPos[pos].map(j => {
      const initials = j.nom.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      return `
        <div class="coach-slot filled" style="--slot-color:${color}" data-id="${j.id}">
          <div class="coach-avatar">
            ${j.photo
              ? `<img src="${j.photo}" alt="${j.nom}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
              : ''}
            <div class="coach-initials" style="${j.photo ? 'display:none' : ''}">${initials}</div>
          </div>
          <div class="coach-name">${j.nom.split(' ').slice(-1)[0]}</div>
          <div class="coach-val">${j.valeur}M</div>
        </div>`;
    }).join('');
    return `<div class="coach-row">${slots}</div>`;
  }).join('');

  return `<div class="pitch-coach pitch-coach--readonly">${PITCH_SVG_LINES}${rows}</div>`;
}

// ── Barème dynamique (Supabase config table) ──────────────
async function loadBareme() {
  if (!db) return;
  try {
    const { data } = await db.from('config').select('value').eq('key', 'bareme').single();
    if (data?.value) CONFIG.BAREME = data.value;
  } catch(e) {} // table pas encore créée → on garde le défaut de config.js
}

// ── Mode tournoi (officiel / tous) ───────────────────────
function getModeTournoi() {
  return localStorage.getItem('cdm_mode') || 'officiel';
}
function setModeTournoi(mode) {
  localStorage.setItem('cdm_mode', mode);
}
function buildModeToggle() {
  const mode = getModeTournoi();
  return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:20px">
    <span style="font-size:0.75rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-right:4px">Vue :</span>
    <button onclick="setMode('officiel')" class="btn btn-sm ${mode === 'officiel' ? 'btn-primary' : 'btn-secondary'}" style="font-size:0.78rem;padding:4px 12px">👑 Officiel</button>
    <button onclick="setMode('tous')" class="btn btn-sm ${mode === 'tous' ? 'btn-primary' : 'btn-secondary'}" style="font-size:0.78rem;padding:4px 12px">🌍 Tous</button>
  </div>`;
}

// ── Pagination Supabase (contourne la limite serveur de 1000 lignes) ──
async function fetchAllDb(query) {
  const all = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await query.range(page * size, (page + 1) * size - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < size) break;
    page++;
  }
  return all;
}

// ── Requêtes DB courantes ─────────────────────────────────
async function fetchJoueurs() {
  return fetchAllDb(db.from('joueurs').select('*').eq('actif', true).order('poste').order('valeur', { ascending: false }));
}

async function fetchClassement() {
  const { data, error } = await db.from('classement_view').select('*').order('rang');
  if (error) throw error;
  return data;
}

async function fetchEquipeComplete(id) {
  const { data, error } = await db.from('equipes')
    .select('*, equipe_joueurs(joueur_id, joueurs(*))')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function fetchButsEquipe() {
  const { data, error } = await db.from('buts_equipe_view').select('*');
  if (error) throw error;
  return Object.fromEntries((data || []).map(r => [r.equipe_id, r.buts_total]));
}
