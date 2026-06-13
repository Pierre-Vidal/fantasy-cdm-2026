// creer.js
document.getElementById('nav-placeholder').innerHTML = buildNav('creer');

let allJoueurs = [];
let equipeSelectionnee = [];
let filtrePos = 'ALL';

const COMPO  = CONFIG.COMPO_REQUISE; // { GAR:2, DEF:5, MIL:5, ATT:3 }
const NB     = CONFIG.NB_JOUEURS;    // 15
const BUDGET = CONFIG.BUDGET_MAX;    // 110

// Ordre d'affichage sur le terrain : ATT en haut, GAR en bas
const PITCH_ROWS = ['ATT', 'MIL', 'DEF', 'GAR'];

// ── Init ─────────────────────────────────────────────────
async function init() {
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
    renderPitchCoach();
  } catch(e) {
    document.getElementById('player-list').innerHTML = `<div class="error-state">Erreur : ${e.message}</div>`;
  }

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

// ── Liste des joueurs (gauche) ────────────────────────────
function renderPlayers() {
  const q   = document.getElementById('search').value.toLowerCase().trim();
  const sel = new Set(equipeSelectionnee.map(j => j.id));
  const budgetRestant = BUDGET - getBudgetUsed();

  let liste = allJoueurs;
  if (filtrePos !== 'ALL') liste = liste.filter(j => j.poste === filtrePos);
  if (q) liste = liste.filter(j => j.nom.toLowerCase().includes(q) || j.nation.toLowerCase().includes(q));

  if (liste.length === 0) {
    document.getElementById('player-list').innerHTML = `<div class="empty-state" style="padding:24px"><p>Aucun joueur trouvé</p></div>`;
    return;
  }

  document.getElementById('player-list').innerHTML = liste.map(j => {
    const selected = sel.has(j.id);
    const canAdd   = !selected && j.valeur <= budgetRestant + 0.05 && peutAjouter(j.poste);
    const disabled = !selected && !canAdd;
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
          ${selected ? '<div style="color:var(--green);font-size:0.7rem">✓</div>' : ''}
        </div>
      </div>`;
  }).join('');
}

// ── Terrain de coach (droite) ─────────────────────────────
function renderPitchCoach() {
  const byPos = { GAR: [], DEF: [], MIL: [], ATT: [] };
  equipeSelectionnee.forEach(j => { if (byPos[j.poste]) byPos[j.poste].push(j); });

  const html = PITCH_ROWS.map(pos => {
    const color   = CONFIG.COLORS[pos];
    const total   = COMPO[pos];
    const joueurs = byPos[pos];

    const slots = Array.from({ length: total }, (_, i) => {
      const j = joueurs[i];
      if (j) {
        const initials = j.nom.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        return `
          <div class="coach-slot filled" style="--slot-color:${color}" onclick="retirerJoueur(${j.id})" title="Cliquer pour retirer ${esc(j.nom)}">
            <div class="coach-avatar">
              ${j.photo
                ? `<img src="${j.photo}" alt="${esc(j.nom)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : ''}
              <div class="coach-initials" style="${j.photo ? 'display:none' : ''}">${initials}</div>
            </div>
            <div class="coach-name">${esc(j.nom.split(' ').slice(-1)[0])}</div>
            <div class="coach-val">${j.valeur}M</div>
          </div>`;
      } else {
        return `
          <div class="coach-slot empty" onclick="ouvrirFiltre('${pos}')" title="Ajouter un ${pos}">
            <div class="coach-avatar">
              <div class="coach-pos-icon" style="color:${color}66;font-size:1.3rem">+</div>
            </div>
            <div class="coach-pos-label" style="background:${color}33;color:${color}">${pos}</div>
          </div>`;
      }
    }).join('');

    return `<div class="coach-row">${slots}</div>`;
  }).join('');

  document.getElementById('pitch-coach').innerHTML = html;
  document.getElementById('joueurs-count').textContent = `${equipeSelectionnee.length} / ${NB}`;
}

// Clic sur slot vide → filtre automatique sur ce poste
function ouvrirFiltre(pos) {
  filtrePos = pos;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.pos === pos);
  });
  renderPlayers();
  document.getElementById('search').focus();
}

// ── Gestion sélection ─────────────────────────────────────
function peutAjouter(poste) {
  return equipeSelectionnee.filter(j => j.poste === poste).length < COMPO[poste];
}

function ajouterJoueur(id) {
  if (equipeSelectionnee.length >= NB) { showToast('15 joueurs maximum', 'error'); return; }
  const j = allJoueurs.find(p => p.id === id);
  if (!j) return;
  if (!peutAjouter(j.poste)) { showToast(`Poste ${j.poste} complet (${COMPO[j.poste]}/${COMPO[j.poste]})`, 'error'); return; }
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

// ── Update global ─────────────────────────────────────────
function update() {
  renderPlayers();
  renderPitchCoach();
  updateBudget();
  validate();
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
  msg.style.color = 'var(--red)';

  const countByPos = {};
  CONFIG.POS_ORDER.forEach(p => { countByPos[p] = 0; });
  equipeSelectionnee.forEach(j => { if (countByPos[j.poste] !== undefined) countByPos[j.poste]++; });

  const manquants = NB - equipeSelectionnee.length;
  if (manquants > 0) {
    msg.textContent = `${manquants} joueur${manquants > 1 ? 's' : ''} manquant${manquants > 1 ? 's' : ''}`;
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

  msg.style.color = 'var(--green)';
  msg.textContent = '✅ Composition valide !';
  btn.disabled = false;
}

// ── Sauvegarde ────────────────────────────────────────────
async function sauvegarder() {
  const pseudo = document.getElementById('pseudo').value.trim();
  if (!pseudo) { showToast('Donne un nom à ton équipe !', 'error'); return; }

  const btn = document.getElementById('save-btn');
  setLoading(btn, true, 'Enregistrement…');

  try {
    const { data: equipe, error: e1 } = await db.from('equipes').insert({ nom: pseudo }).select().single();
    if (e1) {
      if (e1.code === '23505') throw new Error('Ce nom est déjà pris ! Choisis un autre pseudo.');
      throw e1;
    }

    const liens = equipeSelectionnee.map(j => ({ equipe_id: equipe.id, joueur_id: j.id }));
    const { error: e2 } = await db.from('equipe_joueurs').insert(liens);
    if (e2) throw e2;

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
