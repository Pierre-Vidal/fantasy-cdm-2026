// graphiques.js
document.getElementById('nav-placeholder').innerHTML = buildNav('graphiques');

const PALETTE = [
  '#58a6ff','#3fb950','#f85149','#f0883e','#d2a8ff','#79c0ff','#56d364','#ff7b72',
  '#e3b341','#7ee787','#ffa657','#cae8ff','#a5d6ff','#ddf4ff',
];

async function init() {
  const content  = document.getElementById('content');
  const subtitle = document.getElementById('stats-subtitle');

  try {
    // Charge tout en parallèle
    const [classement, equipes, pointsData, statsData, fixturesData] = await Promise.all([
      fetchClassement(),
      db.from('equipes').select('id, nom').then(r => r.data || []),
      db.from('points').select('equipe_id, fixture_id, joueur_id, points').then(r => r.data || []),
      db.from('stats').select('joueur_id, buts, joueurs(nom, poste)').then(r => r.data || []),
      db.from('fixtures').select('id, date_heure, status').order('date_heure').then(r => r.data || []),
    ]);

    if (classement.length === 0) {
      content.innerHTML = `<div class="empty-state"><div class="icon">📊</div><h3>Aucune donnée</h3><p>Les stats apparaîtront une fois les matchs commencés</p></div>`;
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
    const progressionDatasets = classement.slice(0, 12).map((eq, i) => {
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

    // ── Top joueurs (buts) ──
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

    // ── Rendu HTML ──
    content.innerHTML = `
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

  } catch(e) {
    content.innerHTML = `<div class="error-state">Erreur : ${e.message}</div>`;
  }
}

init();
