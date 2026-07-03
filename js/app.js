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
        <a href="tournoi.html" class="${activePage === 'tournoi' ? 'active' : ''}">🌍 Tournoi</a>
        <a href="graphiques.html" class="${activePage === 'graphiques' ? 'active' : ''}">📊 Stats</a>
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

// ── Vue terrain (pitch) ───────────────────────────────────
function renderPitch(joueurs) {
  const byPos = { GAR: [], DEF: [], MIL: [], ATT: [] };
  joueurs.forEach(j => { if (byPos[j.poste]) byPos[j.poste].push(j); });

  const row = (pos, list) => `
    <div class="pitch-row">
      ${list.map(j => `
        <div class="pitch-player${j.actif === false ? ' eliminated' : ''}" title="${j.actif === false ? 'Éliminé de la compétition' : ''}">
          <div class="pitch-avatar" style="border-color:${CONFIG.COLORS[pos]}">
            ${j.photo
              ? `<img src="${j.photo}" alt="${j.nom}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
              : ''}
            <div class="pitch-initials" style="${j.photo ? 'display:none' : ''};background:${CONFIG.COLORS[pos]}22;color:${CONFIG.COLORS[pos]}">
              ${j.nom.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
            </div>
          </div>
          <div class="pitch-name">${j.nom.split(' ').slice(-1)[0]}</div>
          ${j.actif === false ? `<div class="pitch-elim-tag">❌ Éliminé</div>` : `<div class="pitch-badge" style="background:${CONFIG.COLORS[pos]}">${pos}</div>`}
        </div>
      `).join('')}
    </div>`;

  return `
    <div class="pitch">
      <div class="pitch-field">
        ${row('ATT', byPos.ATT)}
        ${row('MIL', byPos.MIL)}
        ${row('DEF', byPos.DEF)}
        ${row('GAR', byPos.GAR)}
      </div>
    </div>`;
}

// ── Requêtes DB courantes ─────────────────────────────────
async function fetchJoueurs() {
  const { data, error } = await db.from('joueurs').select('*').eq('actif', true).order('poste').order('valeur', { ascending: false });
  if (error) throw error;
  return data;
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
