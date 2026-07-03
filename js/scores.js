// scores.js
document.getElementById('nav-placeholder').innerHTML = buildNav('scores');

const ROUND_ORDER = {
  'Group Stage - 1': 1, 'Group Stage - 2': 2, 'Group Stage - 3': 3,
  'Round of 32': 4, 'Round of 16': 5, 'Quarter-finals': 6,
  'Semi-finals': 7, '3rd Place Final': 8, 'Final': 9,
};

const tipStore = {};
let equipes = [];
const hiddenEquipes = new Set();

// ── Sélecteur d'équipes ───────────────────────────────────
function toggleEquipe(id) {
  if (hiddenEquipes.has(id)) hiddenEquipes.delete(id);
  else hiddenEquipes.add(id);
  applyVisibility();
}

function toggleAll(show) {
  if (show) hiddenEquipes.clear();
  else equipes.forEach(e => hiddenEquipes.add(e.id));
  applyVisibility();
}

function applyVisibility() {
  equipes.forEach(e => {
    const hidden = hiddenEquipes.has(e.id);
    // Cellules du tableau
    document.querySelectorAll(`[data-equipe="${e.id}"]`).forEach(el => {
      if (!el.classList.contains('team-toggle')) el.style.display = hidden ? 'none' : '';
    });
    // Bouton toggle
    const btn = document.querySelector(`.team-toggle[data-equipe="${e.id}"]`);
    if (btn) btn.classList.toggle('active', !hidden);
  });
}

function setMode(mode) {
  setModeTournoi(mode);
  init();
}

// ── Init ─────────────────────────────────────────────────
async function init() {
  const content = document.getElementById('content');
  try {
    const [eqs, fixtures, allPoints] = await Promise.all([
      db.from('equipes').select('id,nom,officiel').order('nom').then(r => { if (r.error) throw r.error; return r.data; }),
      db.from('fixtures').select('id,round,date_heure,status,home_name,away_name,home_goals,away_goals').order('date_heure').then(r => { if (r.error) throw r.error; return r.data; }),
      fetchAllDb(db.from('points').select('equipe_id,fixture_id,joueur_id,points,detail,joueurs(nom,poste)')),
    ]);

    const mode = getModeTournoi();
    equipes = mode === 'officiel' ? eqs.filter(e => e.officiel) : eqs;

    if (equipes.length === 0) {
      content.innerHTML = buildModeToggle() + '<div class="empty-state">Aucune équipe à afficher.</div>';
      return;
    }

    // ── Grille fixture × equipe ───────────────────────────
    const grid = {};
    allPoints.forEach(p => {
      if (!grid[p.fixture_id]) grid[p.fixture_id] = {};
      if (!grid[p.fixture_id][p.equipe_id]) grid[p.fixture_id][p.equipe_id] = { total: 0, joueurs: [] };
      const cell = grid[p.fixture_id][p.equipe_id];
      cell.total += p.points;
      let detail = {};
      try { detail = JSON.parse(p.detail || '{}'); } catch {}
      cell.joueurs.push({ nom: p.joueurs?.nom || '?', poste: p.joueurs?.poste || '?', points: p.points, detail });
    });

    Object.values(grid).forEach(byEq =>
      Object.values(byEq).forEach(c => {
        c.joueurs.sort((a, b) => b.points - a.points);
        c.total = Math.round(c.total * 10) / 10;
      })
    );

    const doneFixtures = fixtures.filter(f => f.status === 'FT' || f.status === 'AET' || f.status === 'PEN');
    if (doneFixtures.length === 0) {
      content.innerHTML = '<div class="empty-state">Aucun match terminé pour le moment.</div>';
      return;
    }

    // Trier les équipes par total de points décroissant
    equipes = equipes.slice().sort((a, b) => {
      const ta = doneFixtures.reduce((s, f) => s + (grid[f.id]?.[a.id]?.total ?? 0), 0);
      const tb = doneFixtures.reduce((s, f) => s + (grid[f.id]?.[b.id]?.total ?? 0), 0);
      return tb - ta;
    });

    // ── Groupes par round ─────────────────────────────────
    const byRound = {};
    doneFixtures.forEach(f => {
      const r = f.round || 'Autre';
      if (!byRound[r]) byRound[r] = [];
      byRound[r].push(f);
    });
    const rounds = Object.keys(byRound).sort((a, b) => (ROUND_ORDER[a] || 99) - (ROUND_ORDER[b] || 99));

    // ── Sélecteur équipes ─────────────────────────────────
    const selector = `
      ${buildModeToggle()}
      <div class="team-selector">
        <span style="font-size:0.78rem;color:var(--muted);font-weight:700;white-space:nowrap">Équipes :</span>
        ${equipes.map(e => `<button class="team-toggle active" data-equipe="${e.id}" onclick="toggleEquipe('${e.id}')">${esc(e.nom)}${mode === 'tous' && !e.officiel ? ' <span style="font-size:0.6rem;opacity:.6">★</span>' : ''}</button>`).join('')}
        <button class="btn btn-secondary" style="font-size:0.72rem;padding:3px 10px" onclick="toggleAll(true)">Toutes</button>
        <button class="btn btn-secondary" style="font-size:0.72rem;padding:3px 10px" onclick="toggleAll(false)">Aucune</button>
      </div>`;

    // ── Tableau ───────────────────────────────────────────
    let html = `<div class="scores-wrap"><table class="scores-table"><thead><tr>
      <th class="col-match">Match</th>
      ${equipes.map(e => `<th data-equipe="${e.id}" style="text-align:center;min-width:110px">${esc(e.nom)}</th>`).join('')}
    </tr></thead><tbody>`;

    rounds.forEach(round => {
      html += `<tr class="round-header"><td colspan="${equipes.length + 1}">${round}</td></tr>`;

      byRound[round].forEach(fixture => {
        const fid   = fixture.id;
        const fGrid = grid[fid] || {};
        const scores = equipes.map(e => fGrid[e.id]?.total ?? null).filter(s => s !== null);
        const maxPts = scores.length ? Math.max(...scores) : null;

        html += `<tr>
          <td class="col-match">
            <div style="font-weight:600">
              ${esc(fixture.home_name)} <span style="color:var(--accent)">${fixture.home_goals ?? '?'}–${fixture.away_goals ?? '?'}</span> ${esc(fixture.away_name)}
            </div>
            <div style="font-size:0.72rem;color:var(--muted)">${formatDateShort(fixture.date_heure)}</div>
          </td>
          ${equipes.map(e => {
            const cell = fGrid[e.id];
            if (!cell) return `<td data-equipe="${e.id}" style="text-align:center;color:var(--border)">—</td>`;

            const isTop = maxPts !== null && cell.total === maxPts;
            const key   = `${fid}_${e.id}`;
            tipStore[key] = buildTipHtml(cell);

            return `<td data-equipe="${e.id}" class="score-cell"
                        style="${isTop ? 'background:var(--green)12' : ''}"
                        onmouseenter="showTip(event,'${key}')"
                        onmouseleave="hideTip()"
                        onclick="clickTip(event,'${key}')">
              <span class="score-val" style="color:${isTop ? 'var(--green)' : 'var(--text)'}">${cell.total}</span>
              <span style="font-size:0.7rem;color:var(--muted)"> pts</span>
            </td>`;
          }).join('')}
        </tr>`;
      });
    });

    // Ligne totaux
    const totals = equipes.map(e => {
      const t = doneFixtures.reduce((s, f) => s + (grid[f.id]?.[e.id]?.total ?? 0), 0);
      return Math.round(t * 10) / 10;
    });
    const maxTotal = Math.max(...totals);

    html += `<tr class="total-row">
      <td class="col-match" style="font-size:0.8rem;text-transform:uppercase;letter-spacing:.05em">Total</td>
      ${equipes.map((e, i) => {
        const isTop = totals[i] === maxTotal;
        return `<td data-equipe="${e.id}" style="text-align:center;font-size:1.1rem;color:${isTop ? 'var(--green)' : 'var(--text)'}">${totals[i]}</td>`;
      }).join('')}
    </tr>`;

    html += `</tbody></table></div>`;
    content.innerHTML = selector + html;

  } catch(e) {
    content.innerHTML = `<div class="error-state">Erreur : ${e.message}</div>`;
  }
}

// ── Tooltip ───────────────────────────────────────────────
function buildTipHtml(cell) {
  const rows = cell.joueurs
    .filter(j => j.points !== 0 || Object.keys(j.detail).length > 0)
    .map(j => {
      const detailLines = Object.entries(j.detail)
        .map(([k, v]) => `<span style="color:${v > 0 ? 'var(--green)' : 'var(--red)'}">${v > 0 ? '+' : ''}${v}</span>&nbsp;${k}`)
        .join(' · ');
      return `
        <div class="tip-player">
          <span class="tip-nom">${esc(j.nom)}</span>
          <span class="badge badge-${j.poste}" style="font-size:0.65rem">${j.poste}</span>
          <span class="tip-pts" style="color:${j.points >= 0 ? 'var(--green)' : 'var(--red)'}">${j.points > 0 ? '+' : ''}${j.points} pts</span>
        </div>
        <div class="tip-detail">${detailLines || '—'}</div>`;
    }).join('');

  return `<div style="font-weight:700;margin-bottom:10px;font-size:0.85rem;border-bottom:1px solid var(--border);padding-bottom:6px">
    Total : <span style="color:var(--accent)">${cell.total} pts</span>
  </div>${rows || '<div style="color:var(--muted)">Aucun point sur ce match</div>'}`;
}

const tip    = document.getElementById('score-tip');
let tipTimer = null;
let pinned   = false;

function positionTip(event) {
  const margin = 12;
  const w = tip.offsetWidth  || 280;
  const h = tip.offsetHeight || 200;
  let x = event.clientX + margin;
  let y = event.clientY + margin;
  if (x + w > window.innerWidth  - 8) x = event.clientX - w - margin;
  if (y + h > window.innerHeight - 8) y = event.clientY - h - margin;
  tip.style.left = Math.max(8, x) + 'px';
  tip.style.top  = Math.max(8, y) + 'px';
}

function showTip(event, key) {
  if (pinned) return;
  clearTimeout(tipTimer);
  tip.innerHTML = tipStore[key] || '';
  tip.style.display = 'block';
  positionTip(event);
}

function hideTip() {
  if (pinned) return;
  tipTimer = setTimeout(() => { tip.style.display = 'none'; }, 150);
}

function clickTip(event, key) {
  event.stopPropagation();
  if (pinned && tip.dataset.key === key) {
    pinned = false; tip.style.display = 'none'; return;
  }
  tip.innerHTML = tipStore[key] || '';
  tip.style.display = 'block';
  tip.dataset.key = key;
  tip.style.pointerEvents = 'auto';
  positionTip(event);
  pinned = true;
}

document.addEventListener('click', () => {
  if (pinned) { pinned = false; tip.style.display = 'none'; tip.style.pointerEvents = 'none'; }
});

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
