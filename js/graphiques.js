// graphiques.js
document.getElementById('nav-placeholder').innerHTML = buildNav('graphiques');

const PALETTE = [
  '#58a6ff','#3fb950','#f85149','#f0883e','#d2a8ff','#79c0ff','#56d364','#ff7b72',
  '#e3b341','#7ee787','#ffa657','#cae8ff','#a5d6ff','#ddf4ff',
];

function setMode(mode) {
  setModeTournoi(mode);
  init();
}

async function init() {
  if (await siteLockGuard()) return;
  const content  = document.getElementById('content');
  const subtitle = document.getElementById('stats-subtitle');

  try {
    // Charge tout en parallèle
    const [classementAll, equipesAll, pointsData, statsData, fixturesData, ejData] = await Promise.all([
      fetchClassement(),
      db.from('equipes').select('id, nom, officiel').then(r => r.data || []),
      fetchAllDb(db.from('points').select('equipe_id, fixture_id, joueur_id, points, joueurs(poste)')),
      fetchAllDb(db.from('stats').select('joueur_id, buts, passes, joueurs(nom, poste)')),
      db.from('fixtures').select('id, date_heure, status').order('date_heure').then(r => r.data || []),
      fetchAllDb(db.from('equipe_joueurs').select('equipe_id, joueur_id, joueurs(nom, poste)')),
    ]);

    const mode = getModeTournoi();
    const officielIds = new Set(equipesAll.filter(e => e.officiel).map(e => e.id));
    const classement = mode === 'officiel' ? classementAll.filter(e => officielIds.has(e.id)) : classementAll;
    const equipes    = mode === 'officiel' ? equipesAll.filter(e => e.officiel) : equipesAll;

    if (classement.length === 0) {
      content.innerHTML = buildModeToggle() + `<div class="empty-state"><div class="icon">📊</div><h3>Aucune donnée</h3><p>${mode === 'officiel' ? 'Aucune équipe officielle.' : 'Les stats apparaîtront une fois les matchs commencés.'}</p></div>`;
      subtitle.textContent = '';
      return;
    }

    const joues = fixturesData.filter(f => f.status === 'FT' || f.status === 'AET' || f.status === 'PEN');
    subtitle.textContent = `${classement.length} équipes · ${joues.length} match${joues.length > 1 ? 's' : ''} joué${joues.length > 1 ? 's' : ''}`;

    // ── Progression des points dans le temps ──
    const fixtureById = {};
    fixturesData.forEach(f => { fixtureById[f.id] = f; });

    // Dates uniques triées
    const dateSet = new Set();
    pointsData.forEach(p => {
      const f = fixtureById[p.fixture_id];
      if (f && f.date_heure) dateSet.add(f.date_heure.substring(0, 10));
    });
    const dates = Array.from(dateSet).sort();

    // Fixtures par date
    const fixByDate = {};
    fixturesData.forEach(f => {
      if (!f.date_heure) return;
      const d = f.date_heure.substring(0, 10);
      if (!fixByDate[d]) fixByDate[d] = [];
      fixByDate[d].push(f.id);
    });

    // Points par équipe par fixture
    const ptsByEqFix = {};
    pointsData.forEach(p => {
      const key = p.equipe_id + '|' + p.fixture_id;
      ptsByEqFix[key] = (ptsByEqFix[key] || 0) + Number(p.points || 0);
    });

    // Données progression
    const progressionDatasets = classement.map((eq, i) => {
      let cumul = 0;
      const vals = [0];
      dates.forEach(date => {
        (fixByDate[date] || []).forEach(fid => {
          cumul += ptsByEqFix[eq.id + '|' + fid] || 0;
        });
        vals.push(Math.round(cumul * 10) / 10);
      });
      return {
        label: eq.nom,
        data: vals,
        borderColor: PALETTE[i % PALETTE.length],
        backgroundColor: PALETTE[i % PALETTE.length] + '22',
        borderWidth: 2, pointRadius: 3, tension: 0.3, fill: false,
      };
    });

    const labels = ['Départ', ...dates.map(d => {
      const p = d.split('-'); return p[2] + '/' + p[1];
    })];

    // ── Buts par équipe ──
    const butsParEq = {};
    const joueursPoste = {};
    statsData.forEach(s => {
      if (s.joueurs) joueursPoste[s.joueur_id] = s.joueurs;
    });

    // On relie les stats aux équipes via equipe_joueurs
    // Simplifié : on utilise buts_equipe_view
    const butsMap = await fetchButsEquipe();
    const butsDatasets = classement.map(eq => butsMap[eq.id] || 0);

    // ── Top buteurs ──
    const butsJoueur = {};
    const nomJoueur  = {};
    statsData.forEach(s => {
      const buts = Number(s.buts || 0);
      if (buts > 0) {
        butsJoueur[s.joueur_id] = (butsJoueur[s.joueur_id] || 0) + buts;
        if (s.joueurs) nomJoueur[s.joueur_id] = s.joueurs.nom;
      }
    });
    const topJoueurs = Object.entries(butsJoueur)
      .map(([id, b]) => ({ nom: nomJoueur[id] || id, buts: b }))
      .sort((a, b) => b.buts - a.buts).slice(0, 10);

    // ── Top passeurs ──
    const passesJoueur = {};
    statsData.forEach(s => {
      const passes = Number(s.passes || 0);
      if (passes > 0) {
        passesJoueur[s.joueur_id] = (passesJoueur[s.joueur_id] || 0) + passes;
        if (s.joueurs) nomJoueur[s.joueur_id] = s.joueurs.nom;
      }
    });
    const topPasseurs = Object.entries(passesJoueur)
      .map(([id, p]) => ({ nom: nomJoueur[id] || id, passes: p }))
      .sort((a, b) => b.passes - a.passes).slice(0, 10);

    // ── Joueurs les plus sélectionnés ──
    const nbEquipesTotal = equipesAll.length || 1;
    const ownerCount = {};
    const ownerInfo  = {};
    ejData.forEach(ej => {
      ownerCount[ej.joueur_id] = (ownerCount[ej.joueur_id] || 0) + 1;
      if (ej.joueurs && !ownerInfo[ej.joueur_id]) ownerInfo[ej.joueur_id] = ej.joueurs;
    });
    const topOwned = Object.entries(ownerCount)
      .map(([id, count]) => ({
        nom:   ownerInfo[id]?.nom   || id,
        poste: ownerInfo[id]?.poste || '?',
        count,
        pct: Math.round(count / nbEquipesTotal * 100),
      }))
      .sort((a, b) => b.count - a.count).slice(0, 10);

    // ── Points par poste par équipe fantasy ──
    const ptsByEqPoste = {};
    pointsData.forEach(p => {
      const poste = p.joueurs?.poste;
      if (!poste) return;
      if (!ptsByEqPoste[p.equipe_id]) ptsByEqPoste[p.equipe_id] = { ATT: 0, MIL: 0, DEF: 0, GAR: 0 };
      ptsByEqPoste[p.equipe_id][poste] = (ptsByEqPoste[p.equipe_id][poste] || 0) + Number(p.points || 0);
    });
    const makeTopPos = (postes) => equipes
      .map(e => ({ nom: e.nom, val: Math.round(postes.reduce((s, pos) => s + (ptsByEqPoste[e.id]?.[pos] || 0), 0) * 10) / 10 }))
      .sort((a, b) => b.val - a.val);
    const topFantAtt = makeTopPos(['ATT']);
    const topFantMil = makeTopPos(['MIL']);
    const topFantDef = makeTopPos(['DEF', 'GAR']);

    // ── Ratio points / but ──
    const totalPtsByEq = {};
    classement.forEach(eq => {
      totalPtsByEq[eq.id] = pointsData
        .filter(p => p.equipe_id === eq.id)
        .reduce((s, p) => s + Number(p.points || 0), 0);
    });
    const ratioDatasets = classement
      .map(eq => ({ nom: eq.nom, buts: butsMap[eq.id] || 0, pts: totalPtsByEq[eq.id] || 0 }))
      .filter(r => r.buts > 0)
      .map(r => ({ ...r, ratio: Math.round((r.pts / r.buts) * 10) / 10 }))
      .sort((a, b) => b.ratio - a.ratio);

    // ── Rendu HTML ──
    content.innerHTML = `
      ${buildModeToggle()}
      <div style="margin-bottom:24px">
        <div class="card">
          <div class="card-title">Progression des points</div>
          ${dates.length === 0 ? '<div class="empty-state" style="padding:40px"><p>Pas encore de matchs joués</p></div>'
            : '<div class="chart-wrap"><canvas id="chart-progression"></canvas></div>'}
        </div>
      </div>
      <div class="charts-grid">
        <div class="card">
          <div class="card-title">Total buts par équipe</div>
          <div class="chart-wrap"><canvas id="chart-buts"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Top 10 buteurs</div>
          ${topJoueurs.length === 0
            ? '<div class="empty-state" style="padding:40px"><p>Pas encore de buts</p></div>'
            : '<div class="chart-wrap"><canvas id="chart-joueurs"></canvas></div>'}
        </div>
        <div class="card">
          <div class="card-title">Top 10 passeurs décisifs</div>
          ${topPasseurs.length === 0
            ? '<div class="empty-state" style="padding:40px"><p>Pas encore de passes</p></div>'
            : '<div class="chart-wrap"><canvas id="chart-passeurs"></canvas></div>'}
        </div>
        <div class="card">
          <div class="card-title">Points par but ⚡</div>
          ${ratioDatasets.length === 0
            ? '<div class="empty-state" style="padding:40px"><p>Pas encore de buts</p></div>'
            : '<div class="chart-wrap"><canvas id="chart-ratio"></canvas></div>'}
        </div>
        <div class="card" style="grid-column:1/-1">
          <div class="card-title">👥 Joueurs les plus sélectionnés</div>
          ${topOwned.length === 0
            ? '<div class="empty-state" style="padding:40px"><p>Aucune équipe</p></div>'
            : '<div class="chart-wrap" style="height:280px"><canvas id="chart-owned"></canvas></div>'}
        </div>
      </div>
      <div class="charts-grid" style="margin-top:24px">
        <div class="card">
          <div class="card-title">⚡ Meilleure attaque</div>
          <div class="chart-wrap"><canvas id="chart-fant-att"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">⚙️ Meilleur milieu</div>
          <div class="chart-wrap"><canvas id="chart-fant-mil"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">🛡️ Meilleure défense</div>
          <div class="chart-wrap"><canvas id="chart-fant-def"></canvas></div>
        </div>
      </div>`;

    // ── Charts.js ──
    Chart.defaults.color = '#8b949e';
    Chart.defaults.borderColor = '#30363d';

    if (dates.length > 0) {
      new Chart(document.getElementById('chart-progression'), {
        type: 'line',
        data: { labels, datasets: progressionDatasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } } },
          scales: {
            x: { grid: { color: '#30363d44' } },
            y: { grid: { color: '#30363d44' }, beginAtZero: true },
          },
        },
      });
    }

    new Chart(document.getElementById('chart-buts'), {
      type: 'bar',
      data: {
        labels: classement.map(e => e.nom),
        datasets: [{ label: 'Buts', data: butsDatasets, backgroundColor: PALETTE }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#30363d44' }, ticks: { maxRotation: 45 } },
          y: { grid: { color: '#30363d44' }, beginAtZero: true },
        },
      },
    });

    if (topJoueurs.length > 0) {
      new Chart(document.getElementById('chart-joueurs'), {
        type: 'bar',
        data: {
          labels: topJoueurs.map(j => j.nom),
          datasets: [{ label: 'Buts', data: topJoueurs.map(j => j.buts), backgroundColor: '#3fb950' }],
        },
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: '#30363d44' }, beginAtZero: true },
            y: { grid: { color: '#30363d44' } },
          },
        },
      });
    }

    if (topPasseurs.length > 0) {
      new Chart(document.getElementById('chart-passeurs'), {
        type: 'bar',
        data: {
          labels: topPasseurs.map(j => j.nom),
          datasets: [{ label: 'Passes déc.', data: topPasseurs.map(j => j.passes), backgroundColor: '#d2a8ff' }],
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: '#30363d44' }, beginAtZero: true, ticks: { stepSize: 1 } },
            y: { grid: { color: '#30363d44' } },
          },
        },
      });
    }

    if (topOwned.length > 0) {
      new Chart(document.getElementById('chart-owned'), {
        type: 'bar',
        data: {
          labels: topOwned.map(j => j.nom),
          datasets: [{
            label: 'Équipes',
            data: topOwned.map(j => j.count),
            backgroundColor: topOwned.map(j => ({GAR:'#79c0ff',DEF:'#3fb950',MIL:'#f0883e',ATT:'#f85149'}[j.poste] || '#58a6ff')),
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => {
              const j = topOwned[ctx.dataIndex];
              return `${j.count} équipe${j.count > 1 ? 's' : ''} (${j.pct}%) · ${j.poste}`;
            }}},
          },
          scales: {
            x: { grid: { color: '#30363d44' }, ticks: { maxRotation: 30 } },
            y: { grid: { color: '#30363d44' }, beginAtZero: true, ticks: { stepSize: 1 } },
          },
        },
      });
    }

    const hBarOpts = (label) => ({
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.formattedValue} pts (${label})` } } },
      scales: {
        x: { grid: { color: '#30363d44' }, beginAtZero: true },
        y: { grid: { color: '#30363d44' } },
      },
    });
    new Chart(document.getElementById('chart-fant-att'), {
      type: 'bar',
      data: { labels: topFantAtt.map(r => r.nom), datasets: [{ data: topFantAtt.map(r => r.val), backgroundColor: '#f85149' }] },
      options: hBarOpts('ATT'),
    });
    new Chart(document.getElementById('chart-fant-mil'), {
      type: 'bar',
      data: { labels: topFantMil.map(r => r.nom), datasets: [{ data: topFantMil.map(r => r.val), backgroundColor: '#58a6ff' }] },
      options: hBarOpts('MIL'),
    });
    new Chart(document.getElementById('chart-fant-def'), {
      type: 'bar',
      data: { labels: topFantDef.map(r => r.nom), datasets: [{ data: topFantDef.map(r => r.val), backgroundColor: '#3fb950' }] },
      options: hBarOpts('DEF+GAR'),
    });

    if (ratioDatasets.length > 0) {
      new Chart(document.getElementById('chart-ratio'), {
        type: 'bar',
        data: {
          labels: ratioDatasets.map(r => r.nom),
          datasets: [{ label: 'Pts/but', data: ratioDatasets.map(r => r.ratio), backgroundColor: PALETTE }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const r = ratioDatasets[ctx.dataIndex];
                  return `${ctx.formattedValue} pts/but (${r.pts} pts · ${r.buts} buts)`;
                },
              },
            },
          },
          scales: {
            x: { grid: { color: '#30363d44' }, ticks: { maxRotation: 45 } },
            y: { grid: { color: '#30363d44' }, beginAtZero: true },
          },
        },
      });
    }

  } catch(e) {
    content.innerHTML = `<div class="error-state">Erreur : ${e.message}</div>`;
  }
}

init();
