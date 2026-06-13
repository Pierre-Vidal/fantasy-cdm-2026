// admin.js
document.getElementById('nav-placeholder').innerHTML = buildNav('admin');

let adminDb = null;

// ── Auth ──────────────────────────────────────────────────
async function connecterAdmin() {
  const key = document.getElementById('service-key').value.trim();
  if (!key || key.length < 20) { showToast('Clé invalide', 'error'); return; }

  sessionStorage.setItem('admin_service_key', key);
  adminDb = getAdminDb();

  // Test la clé en faisant un count
  try {
    const { count, error } = await adminDb.from('equipes').select('*', { count: 'exact', head: true });
    if (error) throw error;
    document.getElementById('key-status').innerHTML = '<span class="key-ok">✓ Connecté</span>';
    document.getElementById('admin-panel').style.display = 'block';
    chargerStats();
    chargerEquipes();
    showToast('Connecté en admin ✓', 'success');
  } catch(e) {
    sessionStorage.removeItem('admin_service_key');
    adminDb = null;
    document.getElementById('key-status').innerHTML = '<span class="key-fail">✗ Invalide</span>';
    showToast('Clé invalide : ' + e.message, 'error');
  }
}

function deconnecter() {
  sessionStorage.removeItem('admin_service_key');
  adminDb = null;
  document.getElementById('key-status').innerHTML = '';
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('service-key').value = '';
  showToast('Déconnecté', 'info');
}

// Re-connecte si clé en session
(function() {
  const key = sessionStorage.getItem('admin_service_key');
  if (key) {
    document.getElementById('service-key').value = key;
    connecterAdmin();
  }
})();

// ── Stats rapides ─────────────────────────────────────────
async function chargerStats() {
  try {
    const [eq, j, f, s, p] = await Promise.all([
      adminDb.from('equipes').select('*', { count: 'exact', head: true }),
      adminDb.from('joueurs').select('*', { count: 'exact', head: true }),
      adminDb.from('fixtures').select('*', { count: 'exact', head: true }),
      adminDb.from('stats').select('*', { count: 'exact', head: true }),
      adminDb.from('points').select('*', { count: 'exact', head: true }),
    ]);
    document.getElementById('stats-rapides').innerHTML = [
      ['👥', eq.count, 'Équipes'],
      ['🏃', j.count, 'Joueurs'],
      ['⚽', f.count, 'Fixtures'],
      ['📊', s.count, 'Stats'],
      ['⭐', p.count, 'Points calculés'],
    ].map(([icon, val, label]) => `
      <div class="card" style="flex:1;min-width:80px;text-align:center;padding:14px 10px">
        <div style="font-size:1.4rem">${icon}</div>
        <div style="font-size:1.3rem;font-weight:800;margin:2px 0">${val || 0}</div>
        <div style="font-size:0.7rem;color:var(--muted)">${label}</div>
      </div>`).join('');
  } catch(e) {}
}

// ── Liste équipes ─────────────────────────────────────────
async function chargerEquipes() {
  const el = document.getElementById('liste-equipes');
  try {
    const { data } = await adminDb.from('equipes').select('id, nom, created_at').order('created_at');
    if (!data || data.length === 0) { el.innerHTML = '<em>Aucune équipe</em>'; return; }
    el.innerHTML = data.map(e => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)22">
        <div>
          <div style="font-weight:600">${esc(e.nom)}</div>
          <div style="font-size:0.72rem;color:var(--muted)">${new Date(e.created_at).toLocaleDateString('fr-FR')}</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="supprimerEquipe('${e.id}','${esc(e.nom)}')">🗑️</button>
      </div>`).join('');
  } catch(e) { el.innerHTML = `<div class="error-state">${e.message}</div>`; }
}

// ── Import joueurs ────────────────────────────────────────
async function importerJoueurs() {
  const raw = document.getElementById('json-joueurs').value.trim();
  let data;
  try { data = JSON.parse(raw); } catch { showToast('JSON invalide', 'error'); return; }
  if (!Array.isArray(data) || data.length === 0) { showToast('Tableau vide', 'error'); return; }

  // Normalise les champs
  const rows = data.map(j => ({
    id: Number(j.id),
    nom: String(j.nom),
    poste: String(j.poste),
    nation: String(j.nation),
    valeur: Number(j.valeur) || 5,
    photo: j.photo || null,
    actif: j.actif !== false,
  }));

  try {
    const { error } = await adminDb.from('joueurs').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
    showToast(`${rows.length} joueurs importés ✓`, 'success');
    chargerStats();
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

// ── Import fixtures ───────────────────────────────────────
async function importerFixtures() {
  const raw = document.getElementById('json-fixtures').value.trim();
  let data;
  try { data = JSON.parse(raw); } catch { showToast('JSON invalide', 'error'); return; }
  if (!Array.isArray(data)) { showToast('Tableau attendu', 'error'); return; }

  const rows = data.map(f => ({
    id: Number(f.id),
    round: f.round || null,
    date_heure: f.date_heure || f.date || null,
    home_name: f.home_name || null,
    away_name: f.away_name || null,
    home_goals: f.home_goals !== undefined ? Number(f.home_goals) : null,
    away_goals: f.away_goals !== undefined ? Number(f.away_goals) : null,
    status: f.status || 'NS',
    home_logo: f.home_logo || null,
    away_logo: f.away_logo || null,
    home_winner: f.home_winner !== undefined ? Boolean(f.home_winner) : null,
    away_winner: f.away_winner !== undefined ? Boolean(f.away_winner) : null,
  }));

  try {
    const { error } = await adminDb.from('fixtures').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
    showToast(`${rows.length} fixtures importées ✓`, 'success');
    chargerStats();
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

// ── Import équipes ────────────────────────────────────────
async function importerEquipes() {
  const raw = document.getElementById('json-equipes').value.trim();
  let data;
  try { data = JSON.parse(raw); } catch { showToast('JSON invalide', 'error'); return; }
  if (!Array.isArray(data)) { showToast('Tableau attendu', 'error'); return; }

  let ok = 0, erreurs = 0;
  for (const eq of data) {
    try {
      // Upsert équipe
      const { data: equipe, error: e1 } = await adminDb.from('equipes')
        .upsert({ nom: String(eq.nom) }, { onConflict: 'nom' })
        .select().single();
      if (e1) throw e1;

      // Supprime les anciens joueurs et réinsère
      await adminDb.from('equipe_joueurs').delete().eq('equipe_id', equipe.id);

      if (eq.joueurs && eq.joueurs.length > 0) {
        const liens = eq.joueurs.map(j => ({ equipe_id: equipe.id, joueur_id: Number(j.id) }));
        const { error: e2 } = await adminDb.from('equipe_joueurs').insert(liens);
        if (e2) throw e2;
      }
      ok++;
    } catch(e) { erreurs++; console.error(eq.nom, e); }
  }

  showToast(`${ok} équipes importées${erreurs > 0 ? ` (${erreurs} erreur(s))` : ''} ✓`, erreurs > 0 ? 'error' : 'success');
  chargerStats(); chargerEquipes();
}

// ── Import stats ──────────────────────────────────────────
async function importerStats() {
  const raw = document.getElementById('json-stats').value.trim();
  let data;
  try { data = JSON.parse(raw); } catch { showToast('JSON invalide', 'error'); return; }
  if (!Array.isArray(data)) { showToast('Tableau attendu', 'error'); return; }

  const rows = data.map(s => ({
    fixture_id:     Number(s.fixture_id),
    joueur_id:      Number(s.joueur_id),
    minutes:        Number(s.minutes || 0),
    buts:           Number(s.buts || 0),
    passes:         Number(s.passes || s.passes_decisives || 0),
    clean_sheet:    Boolean(s.clean_sheet),
    arrets:         Number(s.arrets || 0),
    jaune:          Boolean(s.jaune),
    rouge:          Boolean(s.rouge),
    csc:            Number(s.csc || 0),
    buts_encaisses: Number(s.buts_encaisses || 0),
    pen_arrete:     Boolean(s.pen_arrete || s.penalty_arrete),
    pen_manque:     Boolean(s.pen_manque || s.penalty_manque),
  }));

  try {
    const { error } = await adminDb.from('stats').upsert(rows, { onConflict: 'fixture_id,joueur_id' });
    if (error) throw error;
    showToast(`${rows.length} stats importées ✓`, 'success');
    chargerStats();
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

// ── Calcul des points ─────────────────────────────────────
async function calculerTousLesPoints() {
  const log = document.getElementById('points-log');
  log.textContent = 'Chargement des données…\n';

  try {
    // Récupère toutes les stats
    const { data: statsRows, error: e1 } = await adminDb.from('stats')
      .select('*, joueurs(poste)');
    if (e1) throw e1;

    // Récupère toutes les équipes et leurs joueurs
    const { data: equipes, error: e2 } = await adminDb.from('equipes')
      .select('id, equipe_joueurs(joueur_id)');
    if (e2) throw e2;

    log.textContent += `${statsRows.length} stats · ${equipes.length} équipes\n`;

    // Map joueur_id → stats par fixture
    const statsByJoueurFixture = {};
    statsRows.forEach(s => {
      const key = `${s.joueur_id}|${s.fixture_id}`;
      statsByJoueurFixture[key] = s;
    });

    // Calcule les points
    const pointsRows = [];
    equipes.forEach(eq => {
      const joueurIds = (eq.equipe_joueurs || []).map(ej => ej.joueur_id);
      const fixtures  = new Set(statsRows.map(s => s.fixture_id));

      fixtures.forEach(fid => {
        joueurIds.forEach(jid => {
          const s = statsByJoueurFixture[`${jid}|${fid}`];
          if (!s) return;
          const poste = s.joueurs?.poste;
          if (!poste) return;

          const { points, detail } = calculerPoints(poste, s);
          if (points !== 0) {
            pointsRows.push({
              equipe_id: eq.id,
              fixture_id: fid,
              joueur_id: jid,
              points,
              detail: JSON.stringify(detail),
            });
          }
        });
      });
    });

    log.textContent += `${pointsRows.length} lignes de points à écrire…\n`;

    // Upsert par batch de 500
    for (let i = 0; i < pointsRows.length; i += 500) {
      const batch = pointsRows.slice(i, i + 500);
      const { error } = await adminDb.from('points')
        .upsert(batch, { onConflict: 'equipe_id,fixture_id,joueur_id' });
      if (error) throw error;
      log.textContent += `Batch ${Math.ceil((i + 1) / 500)} / ${Math.ceil(pointsRows.length / 500)} OK\n`;
    }

    log.textContent += '✅ Calcul terminé !';
    showToast('Points calculés ✓', 'success');
    chargerStats();
  } catch(e) {
    log.textContent += `❌ Erreur : ${e.message}`;
    showToast('Erreur : ' + e.message, 'error');
  }
}

// ── Suppression ───────────────────────────────────────────
async function supprimerEquipe(id, nom) {
  if (!confirm(`Supprimer l'équipe "${nom}" ? Action irréversible.`)) return;
  try {
    const { error } = await adminDb.from('equipes').delete().eq('id', id);
    if (error) throw error;
    showToast('Équipe supprimée', 'success');
    chargerEquipes(); chargerStats();
  } catch(e) { showToast(e.message, 'error'); }
}

async function supprimerTousLesPoints() {
  if (!confirm('Supprimer TOUS les points calculés ? Les stats restent.')) return;
  try {
    const { error } = await adminDb.from('points').delete().neq('id', 0);
    if (error) throw error;
    showToast('Points supprimés', 'success'); chargerStats();
  } catch(e) { showToast(e.message, 'error'); }
}

async function supprimerToutesLesEquipes() {
  if (!confirm('⚠️ Supprimer TOUTES les équipes ET leurs points ? Action irréversible !')) return;
  if (!confirm('Confirme une deuxième fois : vraiment supprimer tout ?')) return;
  try {
    await adminDb.from('points').delete().neq('id', 0);
    await adminDb.from('equipe_joueurs').delete().neq('equipe_id', '00000000-0000-0000-0000-000000000000');
    const { error } = await adminDb.from('equipes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    showToast('Toutes les équipes supprimées', 'success'); chargerEquipes(); chargerStats();
  } catch(e) { showToast(e.message, 'error'); }
}

// ── Accès rapide (mot de passe simple) ───────────────────────
async function adminAction(action, params) {
  const password = document.getElementById('admin-pwd').value;
  const res = await fetch('/.netlify/functions/admin-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password, params }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

async function connecterRapide() {
  try {
    const { equipes } = await adminAction('list_equipes', {});
    document.getElementById('rapide-panel').style.display = 'block';
    afficherEquipesRapide(equipes);
  } catch(e) {
    showToast(e.message, 'error');
    document.getElementById('rapide-panel').style.display = 'none';
  }
}

function afficherEquipesRapide(equipes) {
  const el = document.getElementById('rapide-equipes');
  if (!equipes || equipes.length === 0) { el.innerHTML = '<em style="color:var(--muted)">Aucune équipe</em>'; return; }
  el.innerHTML = equipes.map(e => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)33">
      <div>
        <span style="font-weight:600">${esc(e.nom)}</span>
        <span style="font-size:0.72rem;color:var(--muted);margin-left:8px">${new Date(e.created_at).toLocaleDateString('fr-FR')}</span>
      </div>
      <button class="btn btn-danger btn-sm" onclick="supprimerEquipeRapide('${e.id}','${esc(e.nom)}')">🗑️ Supprimer</button>
    </div>`).join('');
}

async function supprimerEquipeRapide(id, nom) {
  if (!confirm(`Supprimer l'équipe "${nom}" ? Ses points seront aussi supprimés.`)) return;
  try {
    await adminAction('delete_equipe', { equipe_id: id });
    showToast(`"${nom}" supprimée ✓`, 'success');
    connecterRapide(); // rafraîchit la liste
  } catch(e) {
    showToast(e.message, 'error');
  }
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
