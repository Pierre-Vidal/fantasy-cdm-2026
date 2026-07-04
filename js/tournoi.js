// tournoi.js
document.getElementById('nav-placeholder').innerHTML = buildNav('tournoi');

let allFixtures = [];
let tabLoaded   = { groupes: false, finale: false };
let multConfig  = null; // chargé depuis config DB

function switchTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  if (!tabLoaded[tab]) renderTab(tab);
}

async function init() {
  try {
    const [fixtRes, multRes] = await Promise.all([
      db.from('fixtures').select('*').order('date_heure'),
      db.from('config').select('value').eq('key', 'multiplicateurs').maybeSingle(),
    ]);
    if (fixtRes.error) throw fixtRes.error;
    allFixtures = fixtRes.data || [];
    multConfig  = multRes.data?.value || null;
    tabLoaded.finale = false;
    renderTab('finale');
  } catch(e) {
    document.getElementById('finale-content').innerHTML = `<div class="error-state">Erreur : ${e.message}</div>`;
  }
}

function renderTab(tab) {
  tabLoaded[tab] = true;
  if (tab === 'groupes') renderGroupes();
  else renderFinale();
}

// ── Phase de groupes ──────────────────────────────────────
function renderGroupes() {
  const el = document.getElementById('groupes-content');

  if (allFixtures.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="icon">🌍</div><h3>Pas encore de données</h3><p>L'admin doit importer les fixtures depuis l'onglet Admin</p></div>`;
    return;
  }

  // Matches de groupe : rounds qui contiennent "Group"
  const groupMatches = allFixtures.filter(f => f.round && f.round.toLowerCase().includes('group'));

  // Organise par groupe (round = "Group Stage - X")
  const groupMap = {};
  groupMatches.forEach(f => {
    // Détecte le groupe depuis home/away (approximatif) ou depuis le round
    const roundLabel = f.round || 'Groupe ?';
    if (!groupMap[roundLabel]) groupMap[roundLabel] = { teams: {}, matches: [] };
    groupMap[roundLabel].matches.push(f);

    // Accumule les stats d'équipe nationales
    const gm = groupMap[roundLabel];
    [
      { name: f.home_name, logo: f.home_logo, goals_for: f.home_goals, goals_against: f.away_goals, winner: f.home_winner },
      { name: f.away_name, logo: f.away_logo, goals_for: f.away_goals, goals_against: f.home_goals, winner: f.away_winner },
    ].forEach(({ name, logo, goals_for, goals_against, winner }) => {
      if (!name) return;
      if (!gm.teams[name]) gm.teams[name] = { name, logo, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0, pts: 0 };
      const t = gm.teams[name];
      const played = f.status === 'FT' || f.status === 'AET' || f.status === 'PEN' || f.status === 'SUSP';
      if (played && goals_for !== null) {
        t.j++;
        t.bp += goals_for || 0;
        t.bc += goals_against || 0;
        if (winner) { t.g++; t.pts += 3; }
        else if (winner === false) { t.p++; }
        else { t.n++; t.pts += 1; }
      }
    });
  });

  if (Object.keys(groupMap).length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="icon">🌍</div><h3>Données en cours de chargement</h3><p>Le tournoi commence le 11 juin 2026</p></div>`;
    return;
  }

  const sorted = Object.entries(groupMap).sort(([a], [b]) => a.localeCompare(b));

  const html = `<div class="groups-grid">
    ${sorted.map(([round, g]) => {
      const teams = Object.values(g.teams).sort((a, b) => b.pts - a.pts || (b.bp - b.bc) - (a.bp - a.bc) || b.bp - a.bp);
      return `
        <div class="group-card">
          <div class="group-header">📍 ${esc(round)}</div>
          ${teams.length > 0 ? `
          <table class="group-table">
            <thead><tr><th>Équipe</th><th>J</th><th>G</th><th>N</th><th>P</th><th>+/-</th><th>Pts</th></tr></thead>
            <tbody>
              ${teams.map((t, i) => `
                <tr class="${i < 2 ? 'qualified' : ''}">
                  <td>
                    <div style="display:flex;align-items:center;gap:6px">
                      ${t.logo ? `<img src="${t.logo}" style="width:20px;height:20px;object-fit:contain">` : ''}
                      ${esc(t.name)}
                    </div>
                  </td>
                  <td>${t.j}</td><td>${t.g}</td><td>${t.n}</td><td>${t.p}</td>
                  <td>${t.bp - t.bc >= 0 ? '+' : ''}${t.bp - t.bc}</td>
                  <td><strong>${t.pts}</strong></td>
                </tr>`).join('')}
            </tbody>
          </table>` : '<div style="padding:12px;color:var(--muted);font-size:0.8rem">Pas encore joué</div>'}
          <!-- Matches -->
          <div style="border-top:1px solid var(--border);padding:8px">
            ${g.matches.map(f => matchRow(f)).join('')}
          </div>
        </div>`;
    }).join('')}
  </div>`;

  el.innerHTML = html;
}

// ── Bracket styles ────────────────────────────────────────
const BM_HEIGHT = 76;   // hauteur d'une carte match (2 lignes d'équipe + séparateur)
const BM_GAP0   = 22;   // espacement vertical entre 2 matchs au 1er tour affiché

function injectBracketStyles() {
  if (document.getElementById('bracket-styles')) return;
  const s = document.createElement('style');
  s.id = 'bracket-styles';
  s.textContent = `
    .bracket-outer { overflow-x:auto; padding:8px 0 24px; -webkit-overflow-scrolling:touch; }
    .bracket-scroll { display:flex; gap:0; min-width:max-content; align-items:flex-start; padding:0 8px; }
    .b-col { flex-shrink:0; width:222px; display:flex; flex-direction:column; }
    .b-col-header { text-align:center; padding:10px 8px 14px; display:flex; flex-direction:column; align-items:center; gap:4px; }
    .b-col-label { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em; }
    .b-col-mult { font-size:.64rem; font-weight:700; padding:2px 8px; border-radius:20px; background:rgba(255,255,255,.07); letter-spacing:.05em; }
    .b-col-games { position:relative; flex:1; }
    .b-col-connectors { position:relative; width:24px; flex-shrink:0; }
    .bm-wrap { position:absolute; left:0; right:0; }
    .bm { background:var(--surface); border:1px solid var(--border); border-radius:10px; overflow:hidden; transition:border-color .2s; }
    .bm:hover { border-color:rgba(88,166,255,.3); }
    .bm-team { display:flex; align-items:center; gap:7px; padding:7px 10px; font-size:.78rem; height:19px; }
    .bm-team.bm-winner { background:rgba(63,185,80,.08); font-weight:800; color:var(--green); }
    .bm-team.bm-loser  { opacity:.45; }
    .bm-team.bm-tbd    { color:var(--muted); font-style:italic; }
    .bm-logo { width:20px; height:20px; object-fit:contain; flex-shrink:0; }
    .bm-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .bm-score { font-weight:800; font-size:.88rem; margin-left:auto; flex-shrink:0; min-width:14px; text-align:right; }
    .bm-sep { height:1px; background:var(--border); opacity:.35; }
    .bm-date { text-align:center; padding:4px 8px; font-size:.62rem; color:var(--muted); background:rgba(0,0,0,.12); }
    .bm-badge { font-size:.57rem; padding:1px 5px; border-radius:4px; font-weight:700; margin-left:4px; flex-shrink:0; }
    .bm-live { background:rgba(248,81,73,.25); color:var(--red); }
    .bm-pen  { background:rgba(240,136,62,.2); color:var(--orange); }
    .b-conn-line { position:absolute; border-color:rgba(255,255,255,.16); }
    .b-conn-h { border-top:1.5px solid; height:0; }
    .b-conn-v { border-right:1.5px solid; width:0; }
    .b-3rd-block { margin-top:28px; padding-top:16px; border-top:1px dashed var(--border); }
  `;
  document.head.appendChild(s);
}

// ── Phase finale ──────────────────────────────────────────
function renderFinale() {
  injectBracketStyles();
  const el = document.getElementById('finale-content');

  function detectRound(r) {
    if (!r) return null;
    const s = r.toLowerCase();
    if (s.includes('group')) return null;
    // Vérifier '3rd' et 'place' avant 'final' (3rd Place Final contient "final")
    if (s.includes('3rd') || s.includes('third') || s.includes('place')) return '3rd';
    // Vérifier 'semi' avant 'final' (Semi-finals contient "final")
    if (s.includes('semi')) return 'semi';
    // Vérifier 'quarter' avant 'final' (Quarter-finals contient "finals" !)
    if (s.includes('quarter')) return 'quarter';
    // Seulement maintenant chercher 'final' (ne correspond qu'à "Final" pur)
    if (s.includes('final')) return 'final';
    if (s.includes('16')) return 'r16';
    if (s.includes('32')) return 'r32';
    return null;
  }

  // Lit les valeurs réelles depuis la config DB (ou fallback si inactive/absente)
  const active = multConfig?.active === true;
  const mRounds = multConfig?.rounds || {};
  const multLabel = (key) => {
    if (!active) return '';
    const v = mRounds[key];
    return (v && v !== 1) ? `×${v}` : '';
  };

  const ROUND_META = {
    r32:     { label:'Seizièmes de finale', color:'#58a6ff', mult: multLabel('r32')     },
    r16:     { label:'Huitièmes de finale', color:'#3fb950', mult: multLabel('r16')     },
    quarter: { label:'Quarts de finale',   color:'#d2a8ff', mult: multLabel('quarter') },
    semi:    { label:'Demi-finales',       color:'#f0883e', mult: multLabel('semi')    },
    '3rd':   { label:'3ème place',         color:'#8b949e', mult: ''                   },
    final:   { label:'Finale',            color:'#FFD700', mult: multLabel('final')   },
  };

  const ORDER = ['r32', 'r16', 'quarter', 'semi', '3rd', 'final'];
  const buckets = {};
  allFixtures.forEach(f => {
    const key = detectRound(f.round);
    if (!key) return;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(f);
  });
  const present = ORDER.filter(k => buckets[k] && buckets[k].length > 0);

  if (present.length === 0) {
    el.innerHTML = `<div class="empty-state">
      <div class="icon">🏆</div>
      <h3>Phase finale à venir</h3>
      <p>Les matchs K.O. s'afficheront ici dès qu'ils seront programmés</p>
    </div>`;
    return;
  }

  present.forEach(k => buckets[k].sort((a,b) => (a.date_heure||'').localeCompare(b.date_heure||'')));

  // Le match pour la 3e place ne fait pas partie de l'arbre principal (il se
  // joue en parallèle des demies/finale) — on l'affiche à part, sous le bracket.
  const mainOrder = present.filter(k => k !== '3rd');
  const has3rd    = present.includes('3rd');

  // ── Calcul des hauteurs/positions : chaque colonne double l'espacement
  // vertical de la précédente, et chaque match est centré sur sa paire amont.
  const unit = BM_HEIGHT + BM_GAP0; // hauteur d'un "slot" au 1er tour affiché
  const colPositions = mainOrder.map((k, ci) => {
    const games     = buckets[k];
    const slotH     = unit * Math.pow(2, ci);
    const firstTop  = slotH / 2 - BM_HEIGHT / 2;
    return games.map((f, i) => ({ f, top: firstTop + i * slotH }));
  });
  const maxHeight = Math.max(...colPositions.map(col =>
    col.length ? col[col.length - 1].top + BM_HEIGHT : BM_HEIGHT));

  let html = '<div class="bracket-outer"><div class="bracket-scroll">';
  mainOrder.forEach((k, ci) => {
    const meta = ROUND_META[k];
    const col  = colPositions[ci];

    html += `
      <div class="b-col">
        <div class="b-col-header">
          <span class="b-col-label" style="color:${meta.color}">${meta.label}</span>
          ${meta.mult ? `<span class="b-col-mult" style="color:${meta.color};border:1px solid ${meta.color}44">⚡ ${meta.mult}</span>` : ''}
        </div>
        <div class="b-col-games" style="height:${maxHeight}px">
          ${col.map(({ f, top }) => `<div class="bm-wrap" style="top:${top}px">${bracketMatchCard(f)}</div>`).join('')}
        </div>
      </div>`;

    if (ci < mainOrder.length - 1) {
      const nextCol = colPositions[ci + 1];
      let connHtml = '';
      for (let i = 0; i < nextCol.length; i++) {
        const a = col[i * 2], b = col[i * 2 + 1];
        if (!a) continue;
        const yA = a.top + BM_HEIGHT / 2;
        const yB = b ? b.top + BM_HEIGHT / 2 : yA;
        const yMid = (yA + yB) / 2;
        const top = Math.min(yA, yB), bottom = Math.max(yA, yB);
        connHtml += `
          <div class="b-conn-line b-conn-h" style="top:${yA}px;left:0;width:12px"></div>
          ${b ? `
          <div class="b-conn-line b-conn-h" style="top:${yB}px;left:0;width:12px"></div>
          <div class="b-conn-line b-conn-v" style="top:${top}px;left:12px;height:${bottom - top}px"></div>` : ''}
          <div class="b-conn-line b-conn-h" style="top:${yMid}px;left:12px;width:12px"></div>`;
      }
      html += `<div class="b-col-connectors" style="height:${maxHeight}px">${connHtml}</div>`;
    }
  });
  html += '</div></div>';

  if (has3rd) {
    const meta = ROUND_META['3rd'];
    html += `
      <div class="b-3rd-block">
        <div class="b-col-header" style="text-align:left;padding-left:4px">
          <span class="b-col-label" style="color:${meta.color}">${meta.label}</span>
        </div>
        <div style="max-width:222px">
          ${buckets['3rd'].map(f => bracketMatchCard(f)).join('')}
        </div>
      </div>`;
  }

  el.innerHTML = html;
}

function bracketMatchCard(f) {
  const played = f.status === 'FT' || f.status === 'AET' || f.status === 'PEN';
  const live   = f.status === '1H' || f.status === '2H' || f.status === 'HT' || f.status === 'ET';
  const pen    = f.status === 'PEN';
  const tbd    = !f.home_name;

  const badge = live ? '<span class="bm-badge bm-live">LIVE</span>'
    : pen          ? '<span class="bm-badge bm-pen">PEN</span>'
    : f.status === 'AET' ? '<span class="bm-badge bm-pen">AET</span>' : '';

  const teamRow = (name, logo, winner, goals, showBadge) => {
    const resolved = played || live;
    const cls = tbd ? 'bm-tbd' : (resolved ? (winner ? 'bm-winner' : 'bm-loser') : '');
    return `<div class="bm-team ${cls}">
      ${logo ? `<img src="${esc(logo)}" class="bm-logo" alt="" onerror="this.style.display='none'">` : `<div style="width:20px;height:20px;flex-shrink:0"></div>`}
      <span class="bm-name">${esc(name || 'À déterminer')}</span>
      ${showBadge ? badge : ''}
      ${resolved ? `<span class="bm-score">${goals ?? '?'}</span>` : ''}
    </div>`;
  };

  const dateStr = f.date_heure ? formatDate(f.date_heure) : '';
  return `<div class="bm">
    ${teamRow(f.home_name, f.home_logo, f.home_winner, f.home_goals, true)}
    <div class="bm-sep"></div>
    ${teamRow(f.away_name, f.away_logo, f.away_winner, f.away_goals, false)}
    ${!played && !live && dateStr ? `<div class="bm-date">${dateStr}</div>` : ''}
  </div>`;
}

// ── Helpers d'affichage ───────────────────────────────────
function matchRow(f) {
  const played  = f.status === 'FT' || f.status === 'AET' || f.status === 'PEN';
  const date    = f.date_heure ? formatDateShort(f.date_heure) : '';
  const score   = played ? `${f.home_goals ?? '?'} - ${f.away_goals ?? '?'}` : date;
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:0.78rem">
    <span style="${f.home_winner ? 'font-weight:700' : 'color:var(--muted)'}">${esc(f.home_name || '?')}</span>
    <span style="font-weight:600;color:var(--muted);font-size:0.75rem">${score}</span>
    <span style="${f.away_winner ? 'font-weight:700' : 'color:var(--muted)'}">${esc(f.away_name || '?')}</span>
  </div>`;
}

function matchCard(f) {
  const played  = f.status === 'FT' || f.status === 'AET' || f.status === 'PEN';
  return `
    <div class="match-card ${played ? '' : 'match-upcoming'}">
      <div class="match-team ${f.home_winner ? 'match-winner' : (played ? 'match-loser' : '')}">
        ${f.home_logo ? `<img src="${f.home_logo}" class="match-logo" alt="">` : ''}
        <span class="match-team-name">${esc(f.home_name || 'TBD')}</span>
      </div>
      <div class="match-score">
        <span class="score-box">${played ? (f.home_goals ?? '?') : ''}</span>
        <span class="score-sep">${played ? '-' : formatDate(f.date_heure)}</span>
        <span class="score-box">${played ? (f.away_goals ?? '?') : ''}</span>
      </div>
      <div class="match-team right ${f.away_winner ? 'match-winner' : (played ? 'match-loser' : '')}">
        ${f.away_logo ? `<img src="${f.away_logo}" class="match-logo" alt="">` : ''}
        <span class="match-team-name">${esc(f.away_name || 'TBD')}</span>
      </div>
    </div>`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
