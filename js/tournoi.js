// tournoi.js
document.getElementById('nav-placeholder').innerHTML = buildNav('tournoi');

let allFixtures = [];
let tabLoaded   = { groupes: false, finale: false };

function switchTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  if (!tabLoaded[tab]) renderTab(tab);
}

async function init() {
  try {
    const { data, error } = await db.from('fixtures').select('*').order('date_heure');
    if (error) throw error;
    allFixtures = data || [];
    tabLoaded.groupes = false;
    renderTab('groupes');
  } catch(e) {
    document.getElementById('groupes-content').innerHTML = `<div class="error-state">Erreur : ${e.message}</div>`;
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

// ── Phase finale ──────────────────────────────────────────
function renderFinale() {
  const el = document.getElementById('finale-content');

  const knockoutRounds = [
    { key: 'Round of 32',   label: 'Huitièmes de finale' },
    { key: 'Round of 16',   label: 'Quarts de finale' },
    { key: 'Quarter-finals',label: 'Quarts de finale' },
    { key: 'Semi-finals',   label: 'Demi-finales' },
    { key: '3rd Place',     label: '3ème place' },
    { key: 'Final',         label: 'Finale' },
  ];

  const byRound = {};
  allFixtures.forEach(f => {
    if (!f.round) return;
    const r = f.round;
    if (!byRound[r]) byRound[r] = [];
    byRound[r].push(f);
  });

  let html = '';
  knockoutRounds.forEach(({ key, label }) => {
    const matches = Object.entries(byRound).find(([r]) => r.toLowerCase().includes(key.toLowerCase()));
    if (!matches) return;
    html += `
      <div class="bracket-round">
        <div class="bracket-round-title">${label}</div>
        <div class="bracket-matches">
          ${matches[1].map(f => matchCard(f)).join('')}
        </div>
      </div>`;
  });

  if (!html) {
    html = `<div class="empty-state"><div class="icon">🏆</div><h3>Phase finale à venir</h3><p>Les matchs à élimination directe s'afficheront ici</p></div>`;
  }

  el.innerHTML = html;
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
