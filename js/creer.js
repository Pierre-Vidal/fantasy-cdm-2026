// creer.js
document.getElementById('nav-placeholder').innerHTML = buildNav('creer');

let allJoueurs = [];
let equipeSelectionnee = [];
let filtrePos    = 'ALL';
let filtreNation = '';
let sortOrder    = 'desc'; // 'desc' = plus cher en premier

// ── Drapeaux (images via flagcdn.com) ─────────────────────
const COUNTRY_CODES = {
  'France':'fr','Spain':'es','Portugal':'pt','Germany':'de','Netherlands':'nl',
  'Belgium':'be','Italy':'it','Croatia':'hr','Denmark':'dk','Switzerland':'ch',
  'Serbia':'rs','Austria':'at','Poland':'pl','Czech Republic':'cz','Czechia':'cz',
  'Hungary':'hu','Slovakia':'sk','Slovenia':'si','Turkey':'tr','Greece':'gr',
  'Romania':'ro','Ukraine':'ua','Norway':'no','Sweden':'se','Finland':'fi',
  'Iceland':'is','Republic of Ireland':'ie','Ireland':'ie','Albania':'al',
  'Georgia':'ge','Bosnia and Herzegovina':'ba','North Macedonia':'mk','Kosovo':'xk',
  'Montenegro':'me','Bulgaria':'bg','Luxembourg':'lu','Belarus':'by',
  'Latvia':'lv','Lithuania':'lt','Estonia':'ee','Cyprus':'cy','Malta':'mt',
  'England':'gb-eng','Scotland':'gb-sct','Wales':'gb-wls','Northern Ireland':'gb-nir',
  'Morocco':'ma','Senegal':'sn','Nigeria':'ng','Cameroon':'cm','Ghana':'gh',
  "Ivory Coast":'ci',"Côte d'Ivoire":'ci','South Africa':'za','Tunisia':'tn',
  'Algeria':'dz','Egypt':'eg','Mali':'ml','Guinea':'gn','DR Congo':'cd',
  'Congo':'cg','Zambia':'zm','Kenya':'ke','Sudan':'sd','Ethiopia':'et',
  'Tanzania':'tz','Uganda':'ug','Mozambique':'mz','Zimbabwe':'zw',
  'Argentina':'ar','Brazil':'br','Colombia':'co','Uruguay':'uy','Ecuador':'ec',
  'Chile':'cl','Venezuela':'ve','Peru':'pe','Bolivia':'bo','Paraguay':'py',
  'USA':'us','United States':'us','Mexico':'mx','Canada':'ca',
  'Costa Rica':'cr','Panama':'pa','Honduras':'hn','Jamaica':'jm',
  'Trinidad and Tobago':'tt','Guatemala':'gt','Haiti':'ht','Cuba':'cu',
  'Japan':'jp','South Korea':'kr','Australia':'au','Saudi Arabia':'sa',
  'Iran':'ir','Qatar':'qa','Iraq':'iq','Jordan':'jo',
  'United Arab Emirates':'ae','UAE':'ae','Kuwait':'kw','Bahrain':'bh',
  'Uzbekistan':'uz','China':'cn','India':'in','New Zealand':'nz',
  'Indonesia':'id','Philippines':'ph','Vietnam':'vn','Thailand':'th','Malaysia':'my',
};
function getFlag(nation) {
  const code = COUNTRY_CODES[nation];
  if (!code) return '';
  return `<img src="https://flagcdn.com/16x12/${code}.png" width="16" height="12" style="vertical-align:middle;border-radius:1px;margin-right:2px" alt="">`;
}
function toggleSort() {
  sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
  document.getElementById('sort-btn').textContent = sortOrder === 'desc' ? 'Prix ↓' : 'Prix ↑';
  renderPlayers();
}

const COMPO  = CONFIG.COMPO_REQUISE; // { GAR:2, DEF:5, MIL:5, ATT:3 }
const NB     = CONFIG.NB_JOUEURS;    // 15
const BUDGET = CONFIG.BUDGET_MAX;    // 110

const PITCH_ROWS = ['ATT', 'MIL', 'DEF', 'GAR'];

// ── SVG terrain ───────────────────────────────────────────
const PITCH_SVG = `<svg class="pitch-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
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

// ── Fuzzy search ──────────────────────────────────────────
function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const row = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]++;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = a[i-1] === b[j-1] ? prev : 1 + Math.min(prev, row[j], row[j-1]);
      prev = tmp;
    }
  }
  return row[b.length];
}

function fuzzyMatchWord(text, q) {
  if (text.includes(q)) return true;
  // Subsequence (handles skipped letters like "sliba" → "saliba")
  let qi = 0;
  for (const c of text) { if (c === q[qi]) qi++; }
  if (qi === q.length) return true;
  // Levenshtein on each word (handles transpositions/substitutions)
  if (q.length >= 3) {
    const maxDist = q.length >= 6 ? 2 : 1;
    return text.split(/\s+/).some(w => levenshtein(w, q) <= maxDist);
  }
  return false;
}

function fuzzyMatch(nom, nation, query) {
  const q = normalize(query);
  if (!q) return true;
  const qWords = q.split(/\s+/).filter(Boolean);
  const haystack = normalize(nom) + ' ' + normalize(nation);
  return qWords.every(qw => fuzzyMatchWord(haystack, qw));
}

// ── Init ─────────────────────────────────────────────────
async function init() {
  if (await siteLockGuard()) return;
  const moi = getMonEquipe();
  if (moi) {
    document.getElementById('already-registered').style.display = 'block';
    document.getElementById('mon-equipe-link').href = `equipe.html?id=${moi.id}`;
    document.getElementById('form-area').style.display = 'none';
    return;
  }

  try {
    allJoueurs = await fetchJoueurs();

    // Peuple le filtre nations
    const nations = [...new Set(allJoueurs.map(j => j.nation).filter(Boolean))].sort();
    const sel = document.getElementById('filtre-nation');
    nations.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = n;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => { filtreNation = sel.value; renderPlayers(); });

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

// ── Réinitialiser tous les filtres ────────────────────────
function resetFiltres() {
  filtrePos    = 'ALL';
  filtreNation = '';
  document.getElementById('search').value = '';
  document.getElementById('filtre-nation').value = '';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.pos === 'ALL'));
  renderPlayers();
}

// ── Liste des joueurs (gauche) ────────────────────────────
function renderPlayers() {
  const q   = document.getElementById('search').value.trim();
  const sel = new Set(equipeSelectionnee.map(j => j.id));
  const budgetRestant = BUDGET - getBudgetUsed();

  let liste = allJoueurs;
  if (filtrePos !== 'ALL')  liste = liste.filter(j => j.poste === filtrePos);
  if (filtreNation)         liste = liste.filter(j => j.nation === filtreNation);
  if (q)                    liste = liste.filter(j => fuzzyMatch(j.nom, j.nation || '', q));
  liste = [...liste].sort((a, b) => sortOrder === 'desc' ? b.valeur - a.valeur : a.valeur - b.valeur);

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
          <div class="player-nation">${getFlag(j.nation)} ${esc(j.nation)}</div>
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

  const rows = PITCH_ROWS.map(pos => {
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

  document.getElementById('pitch-coach').innerHTML = PITCH_SVG + rows;
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
  // Reset la recherche après sélection
  document.getElementById('search').value = '';
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

