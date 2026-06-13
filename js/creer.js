// creer.js
document.getElementById('nav-placeholder').innerHTML = buildNav('creer');

let allJoueurs = [];
let equipeSelectionnee = [];
let filtrePos = 'ALL';

const COMPO = CONFIG.COMPO_REQUISE; // { GAR:2, DEF:5, MIL:5, ATT:3 }
const NB    = CONFIG.NB_JOUEURS;    // 15
const BUDGET = CONFIG.BUDGET_MAX;   // 110

// ── Init ─────────────────────────────────────────────────
async function init() {
  document.getElementById('nav-placeholder').innerHTML = buildNav('creer');

  // Déjà inscrit ?
  const moi = getMonEquipe();
  if (moi) {
    document.getElementById('already-registered').style.display = 'block';
    document.getElementById('mon-equipe-link').href = `equipe.html?id=${moi.id}`;
    document.getElementById('form-area').style.display = 'none';
    return;
  }

  try {
    allJoueurs = await fetchJoueurs();
    renderPlayers();
    renderSlots();
  } catch(e) {
    document.getElementById('player-list').innerHTML = `<div class="error-state">Erreur : ${e.message}</div>`;
  }

  // Events
  document.getElementById('search').addEventListener('input', renderPlayers);
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filtrePos = btn.dataset.pos;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPlayers();
    });
  });
}

// ── Affiche la liste des joueurs ──────────────────────────
function renderPlayers() {
  const q   = document.getElementById('search').value.toLowerCase().trim();
  const sel = new Set(equipeSelectionnee.map(j => j.id));

  let liste = allJoueurs;
  if (filtrePos !== 'ALL') liste = liste.filter(j => j.poste === filtrePos);
  if (q) liste = liste.filter(j => j.nom.toLowerCase().includes(q) || j.nation.toLowerCase().includes(q));

  if (liste.length === 0) {
    document.getElementById('player-list').innerHTML = `<div class="empty-state" style="padding:24px"><p>Aucun joueur trouvé</p></div>`;
    return;
  }

  const budgetRestant = BUDGET - getBudgetUsed();
  document.getElementById('player-list').innerHTML = liste.map(j => {
    const selected  = sel.has(j.id);
    const canAdd    = !selected && j.valeur <= budgetRestant + 0.05 && peutAjouter(j.poste);
    const disabled  = !selected && !canAdd;
    const pts       = '';
    return `
      <div class="player-item ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}"
           onclick="${selected ? `retirerJoueur(${j.id})` : (disabled ? '' : `ajouterJoueur(${j.id})`)}">
        <div class="badge badge-${j.poste}">${j.poste}</div>
        <div class="player-info">
          <div class="player-nom">${esc(j.nom)}</div>
          <div class="player-nation">${esc(j.nation)}</div>
        </div>
        <div style="text-align:right">
          <div class="player-value">${j.valeur} M$</div>
          ${selected ? '<div style="color:var(--green);font-size:0.7rem">✓ sélectionné</div>' : ''}
        </div>
      </div>`;
  }).join('');
}

// ── Gestion sélection ─────────────────────────────────────
function peutAjouter(poste) {
  const count = equipeSelectionnee.filter(j => j.poste === poste).length;
  return count < COMPO[poste];
}

function ajouterJoueur(id) {
  if (equipeSelectionnee.length >= NB) { showToast('15 joueurs maximum', 'error'); return; }
  const j = allJoueurs.find(p => p.id === id);
  if (!j) return;
  if (!peutAjouter(j.poste)) { showToast(`Poste ${j.poste} complet`, 'error'); return; }
  if (getBudgetUsed() + j.valeur > BUDGET + 0.05) { showToast('Budget insuffisant', 'error'); return; }
  equipeSelectionnee.push(j);
  update();
}

function retirerJoueur(id) {
  equipeSelectionnee = equipeSelectionnee.filter(j => j.id !== id);
  update();
}

function getBudgetUsed() {
  return Math.round(equipeSelectionnee.reduce((s, j) => s + j.valeur, 0) * 10) / 10;
}

// ── Update UI ─────────────────────────────────────────────
function update() {
  renderPlayers();
  renderSlots();
  updateBudget();
  validate();
}

function renderSlots() {
  const byPos = {};
  CONFIG.POS_ORDER.forEach(p => { byPos[p] = []; });
  equipeSelectionnee.forEach(j => { if (byPos[j.poste]) byPos[j.poste].push(j); });

  let html = '';
  CONFIG.POS_ORDER.forEach(pos => {
    html += `<div class="compo-pos" style="color:${CONFIG.COLORS[pos]}">${pos} (${byPos[pos].length}/${COMPO[pos]})</div>`;
    for (let i = 0; i < COMPO[pos]; i++) {
      const j = byPos[pos][i];
      if (j) {
        html += `<div class="slot-item filled">
          <div class="badge badge-${pos}">${pos}</div>
          <span style="font-size:0.82rem;font-weight:600">${esc(j.nom)}</span>
          <span style="font-size:0.75rem;color:var(--muted);margin-left:4px">${j.valeur}M</span>
          <button class="slot-remove" onclick="retirerJoueur(${j.id})">×</button>
        </div>`;
      } else {
        html += `<div class="slot-item"><span class="slot-empty">— vide —</span></div>`;
      }
    }
  });
  document.getElementById('compo-slots').innerHTML = html;
}

function updateBudget() {
  const used = getBudgetUsed();
  const pct  = Math.min(100, (used / BUDGET) * 100);
  const fill = document.getElementById('budget-fill');
  fill.style.width = pct + '%';
  fill.className   = 'budget-fill ' + (pct > 100 ? 'budget-over' : pct > 90 ? 'budget-warn' : 'budget-ok');
  document.getElementById('budget-used').textContent = used + ' M$';
}

function validate() {
  const msg = document.getElementById('validation-msg');
  const btn = document.getElementById('save-btn');

  const countByPos = {};
  CONFIG.POS_ORDER.forEach(p => { countByPos[p] = 0; });
  equipeSelectionnee.forEach(j => { if (countByPos[j.poste] !== undefined) countByPos[j.poste]++; });

  if (equipeSelectionnee.length < NB) {
    msg.textContent = `${NB - equipeSelectionnee.length} joueur(s) manquant(s)`;
    btn.disabled = true; return;
  }

  for (const [pos, req] of Object.entries(COMPO)) {
    if (countByPos[pos] !== req) {
      msg.textContent = `${pos} : ${countByPos[pos]}/${req}`;
      btn.disabled = true; return;
    }
  }

  if (getBudgetUsed() > BUDGET + 0.05) {
    msg.textContent = 'Budget dépassé !';
    btn.disabled = true; return;
  }

  msg.textContent = '✅ Composition valide !';
  msg.style.color = 'var(--green)';
  btn.disabled = false;
}

// ── Sauvegarde ────────────────────────────────────────────
async function sauvegarder() {
  const pseudo = document.getElementById('pseudo').value.trim();
  if (!pseudo) { showToast('Donne un nom à ton équipe !', 'error'); return; }

  const btn = document.getElementById('save-btn');
  setLoading(btn, true, 'Enregistrement…');

  try {
    // Crée l'équipe
    const { data: equipe, error: e1 } = await db.from('equipes').insert({ nom: pseudo }).select().single();
    if (e1) {
      if (e1.code === '23505') throw new Error('Ce nom est déjà pris ! Choisis un autre pseudo.');
      throw e1;
    }

    // Ajoute les joueurs
    const liens = equipeSelectionnee.map(j => ({ equipe_id: equipe.id, joueur_id: j.id }));
    const { error: e2 } = await db.from('equipe_joueurs').insert(liens);
    if (e2) throw e2;

    // Stocke en localStorage
    setMonEquipe({ id: equipe.id, nom: equipe.nom });
    showToast('Équipe enregistrée ! 🎉', 'success');
    setTimeout(() => { window.location.href = `equipe.html?id=${equipe.id}`; }, 1200);

  } catch(e) {
    showToast(e.message, 'error');
    setLoading(btn, false);
  }
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
