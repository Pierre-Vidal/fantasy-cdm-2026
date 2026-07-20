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
    chargerBareme();
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
    const { data } = await adminDb.from('equipes').select('id, nom, created_at, officiel').order('created_at');
    if (!data || data.length === 0) { el.innerHTML = '<em>Aucune équipe</em>'; return; }
    el.innerHTML = data.map(e => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)22">
        <div>
          <div style="font-weight:600">${esc(e.nom)} ${e.officiel ? '<span style="font-size:0.7rem">👑</span>' : '<span style="font-size:0.7rem;color:var(--muted)">⭐</span>'}</div>
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
    // Récupère toutes les stats, équipes et fixtures en parallèle
    const [statsRows, r2, r3] = await Promise.all([
      fetchAllDb(adminDb.from('stats').select('*, joueurs(poste, nation)')),
      adminDb.from('equipes').select('id, equipe_joueurs(joueur_id)'),
      adminDb.from('fixtures').select('id, home_name, away_name, home_goals, away_goals').eq('status', 'FT'),
    ]);
    if (r2.error) throw r2.error;

    const equipes = r2.data;
    const fixtureMap = {};
    (r3.data || []).forEach(f => { fixtureMap[f.id] = f; });

    log.textContent += `${statsRows.length} stats · ${equipes.length} équipes\n`;

    // Map joueur_id|fixture_id → stat
    const statsByJoueurFixture = {};
    statsRows.forEach(s => {
      statsByJoueurFixture[`${s.joueur_id}|${s.fixture_id}`] = s;
    });

    // Calcule les points
    const pointsRows = [];
    equipes.forEach(eq => {
      const joueurIds = (eq.equipe_joueurs || []).map(ej => ej.joueur_id);
      const fixtureIds = new Set(statsRows.map(s => s.fixture_id));

      fixtureIds.forEach(fid => {
        joueurIds.forEach(jid => {
          const s = statsByJoueurFixture[`${jid}|${fid}`];
          if (!s) return;
          const poste  = s.joueurs?.poste;
          const nation = s.joueurs?.nation;
          if (!poste) return;

          // Recalcule la clean sheet depuis le score du match (plus fiable que la stat joueur)
          let cleanSheet = s.clean_sheet;
          const fx = fixtureMap[fid];
          if (fx && nation) {
            let conceded = null;
            if (fx.home_name === nation)      conceded = fx.away_goals;
            else if (fx.away_name === nation) conceded = fx.home_goals;
            if (conceded !== null) {
              cleanSheet = conceded === 0 && s.minutes >= 60 && (poste === 'GAR' || poste === 'DEF' || poste === 'MIL');
            }
          }

          const { points, detail } = calculerPoints(poste, { ...s, clean_sheet: cleanSheet });
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

// ── Barème des points ─────────────────────────────────────
const ADMIN_STATS_DEF = [
  { key: 'min60',      label: '≥ 60 min' },
  { key: 'moins60',    label: '< 60 min' },
  { key: 'but',        label: 'But (par but)' },
  { key: 'passe',      label: 'Passe déc. (par passe)' },
  { key: 'cleanSheet', label: 'Clean sheet' },
  { key: 'arrets3',    label: 'Arrêts ×3 (GAR)' },
  { key: 'penArrete',  label: 'Pen. arrêté (GAR)' },
  { key: 'penManque',  label: 'Pen. manqué' },
  { key: 'butEnc2',    label: 'Buts enc. ×2 (GAR/DEF)' },
  { key: 'jaune',      label: 'Carton jaune' },
  { key: 'rouge',      label: 'Carton rouge' },
  { key: 'csc',        label: 'Contre son camp' },
];
const ADMIN_POS = ['GAR', 'DEF', 'MIL', 'ATT'];

// ── Verrou du site ─────────────────────────────────────────
async function chargerLockStatus() {
  const statusEl = document.getElementById('lock-status');
  const btnEl    = document.getElementById('btn-toggle-lock');
  if (!statusEl || !btnEl) return;
  try {
    const { locked } = await adminAction('get_site_lock', {});
    renderLockStatus(!!locked);
  } catch (e) {
    statusEl.textContent = 'Erreur : ' + e.message;
  }
}

function renderLockStatus(locked) {
  const statusEl = document.getElementById('lock-status');
  const btnEl    = document.getElementById('btn-toggle-lock');
  if (locked) {
    statusEl.innerHTML = '<span class="key-fail">🔒 Site verrouillé</span>';
    btnEl.textContent = '🔓 Déverrouiller le site';
    btnEl.className = 'btn btn-secondary btn-sm';
  } else {
    statusEl.innerHTML = '<span class="key-ok">🔓 Site accessible</span>';
    btnEl.textContent = '🔒 Verrouiller le site';
    btnEl.className = 'btn btn-primary btn-sm';
  }
}

async function toggleSiteLock() {
  const btnEl = document.getElementById('btn-toggle-lock');
  setLoading(btnEl, true);
  try {
    const { locked: current } = await adminAction('get_site_lock', {});
    const { locked } = await adminAction('set_site_lock', { locked: !current });
    renderLockStatus(locked);
    showToast(locked ? 'Site verrouillé ✓' : 'Site déverrouillé ✓', 'success');
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  } finally {
    setLoading(btnEl, false);
  }
}

// ── Feedback (device + remarques du palmarès) ─────────────
// ── Vérification finale des scores (compare DB vs API, lecture seule) ─
const FIELD_LABELS = {
  minutes:'Minutes', buts:'Buts', passes:'Passes', clean_sheet:'Clean sheet',
  arrets:'Arrêts', pen_arrete:'Pen. arrêté', pen_manque:'Pen. manqué',
  buts_encaisses:'Buts enc.', jaune:'Jaune', rouge:'Rouge', csc:'CSC',
};

async function verifierTousLesMatchs() {
  const btn = document.getElementById('btn-verif-all');
  const progressEl = document.getElementById('verif-progress');
  const resultEl = document.getElementById('verif-result');
  btn.disabled = true; btn.style.opacity = '.6';
  resultEl.innerHTML = '';

  try {
    const { fixtures } = await adminAction('list_fixtures_done', {});
    const allEcarts = [];
    for (let i = 0; i < fixtures.length; i++) {
      const f = fixtures[i];
      progressEl.textContent = `Vérification ${i + 1}/${fixtures.length} : ${f.home_name} vs ${f.away_name}…`;
      try {
        const { ecarts } = await adminAction('verify_fixture_stats', { fixture_id: f.id });
        if (ecarts.length) allEcarts.push({ fixture: f, ecarts });
      } catch (e) {
        allEcarts.push({ fixture: f, ecarts: [{ type: 'erreur', nom: e.message }] });
      }
      await new Promise(r => setTimeout(r, 300)); // respecte le débit de l'API
    }

    progressEl.textContent = `Terminé — ${fixtures.length} matchs vérifiés.`;

    if (!allEcarts.length) {
      resultEl.innerHTML = `<div style="color:var(--green);font-weight:700">✓ Aucun écart trouvé, toutes les stats correspondent à l'API.</div>`;
      return;
    }

    resultEl.innerHTML = `<div style="color:var(--red);font-weight:700;margin-bottom:8px">⚠️ ${allEcarts.length} match(s) avec des écarts :</div>` +
      allEcarts.map(({ fixture, ecarts }) => `
        <div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px">
          <div style="font-weight:700;margin-bottom:6px">[${esc(fixture.round)}] ${esc(fixture.home_name)} vs ${esc(fixture.away_name)} <span style="color:var(--muted);font-weight:400">(fixture ${fixture.id})</span></div>
          ${ecarts.map(e => {
            if (e.type === 'erreur') return `<div style="color:var(--red)">Erreur : ${esc(e.nom)}</div>`;
            if (e.type === 'absent_api') return `<div>🔸 ${esc(e.nom || e.joueur_id)} — en DB mais absent de l'API désormais</div>`;
            if (e.type === 'absent_db')  return `<div>🔸 ${esc(e.nom || e.joueur_id)} — dans l'API mais absent de la DB</div>`;
            const diffTxt = Object.entries(e.diffs).map(([k, v]) => `${FIELD_LABELS[k] || k} : ${v.db} → ${v.api}`).join(', ');
            return `<div>🔸 ${esc(e.nom || e.joueur_id)} — ${esc(diffTxt)}</div>`;
          }).join('')}
        </div>
      `).join('');
  } catch (e) {
    resultEl.innerHTML = `<span style="color:var(--red)">Erreur : ${esc(e.message)}</span>`;
  } finally {
    btn.disabled = false; btn.style.opacity = '1';
  }
}

async function chargerFeedback() {
  const statsEl = document.getElementById('feedback-stats');
  const msgEl   = document.getElementById('feedback-messages');
  if (!statsEl || !msgEl) return;
  try {
    const { total, mobile, desktop, messages } = await adminAction('get_feedback', {});
    if (total === 0) {
      statsEl.innerHTML = `<span style="color:var(--muted)">Aucune visite enregistrée pour l'instant.</span>`;
      msgEl.innerHTML = '';
      return;
    }
    const pctMobile  = Math.round((mobile  / total) * 100);
    const pctDesktop = Math.round((desktop / total) * 100);
    statsEl.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:8px 10px;text-align:center">
          <div style="font-size:1.1rem;font-weight:800">${total}</div>
          <div style="font-size:0.65rem;color:var(--muted);text-transform:uppercase">Visites</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:8px 10px;text-align:center">
          <div style="font-size:1.1rem;font-weight:800">📱 ${pctMobile}%</div>
          <div style="font-size:0.65rem;color:var(--muted)">Mobile (${mobile})</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:8px 10px;text-align:center">
          <div style="font-size:1.1rem;font-weight:800">🖥️ ${pctDesktop}%</div>
          <div style="font-size:0.65rem;color:var(--muted)">Ordinateur (${desktop})</div>
        </div>
      </div>
      <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;display:flex">
        <div style="width:${pctMobile}%;background:var(--accent)"></div>
        <div style="width:${pctDesktop}%;background:var(--green)"></div>
      </div>`;

    msgEl.innerHTML = messages.length
      ? messages.map(m => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border)33">
            <div>${esc(m.message)}</div>
            <div style="font-size:0.68rem;color:var(--muted);margin-top:3px">
              ${m.device === 'mobile' ? '📱' : '🖥️'} ${new Date(m.created_at).toLocaleDateString('fr-FR')}
            </div>
          </div>`).join('')
      : `<span style="color:var(--muted)">Aucune remarque pour l'instant.</span>`;
  } catch (e) {
    statsEl.innerHTML = `<span style="color:var(--red)">Erreur : ${esc(e.message)}</span>`;
  }
}

async function chargerBareme() {
  await loadBareme();
  const bareme  = CONFIG.BAREME;
  const container = document.getElementById('bareme-editor-body');
  if (!container) return;

  container.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:0.875rem">
    <thead><tr>
      <th style="text-align:left;padding:6px 8px;font-size:0.75rem;color:var(--muted);border-bottom:2px solid var(--border)">Action</th>
      ${ADMIN_POS.map(p => `<th style="text-align:center;padding:6px;border-bottom:2px solid var(--border)"><span class="badge badge-${p}">${p}</span></th>`).join('')}
    </tr></thead>
    <tbody>
      ${ADMIN_STATS_DEF.map(stat => `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
          <td style="padding:6px 8px;font-size:0.82rem">${stat.label}</td>
          ${ADMIN_POS.map(p => `
            <td style="text-align:center;padding:4px 6px">
              <input type="number" class="bareme-input" step="1"
                data-pos="${p}" data-key="${stat.key}"
                value="${bareme[p]?.[stat.key] ?? 0}">
            </td>`).join('')}
        </tr>`).join('')}
    </tbody>
  </table>`;
}

async function sauvegarderBareme() {
  if (!adminDb) { showToast('Connecte-toi avec la clé service d\'abord', 'error'); return; }
  const btn = document.getElementById('save-bareme-btn');
  setLoading(btn, true, 'Sauvegarde...');

  const bareme = { GAR: {}, DEF: {}, MIL: {}, ATT: {} };
  document.querySelectorAll('.bareme-input').forEach(input => {
    bareme[input.dataset.pos][input.dataset.key] = Number(input.value);
  });

  try {
    const { error } = await adminDb.from('config').upsert({ key: 'bareme', value: bareme }, { onConflict: 'key' });
    if (error) throw error;
    CONFIG.BAREME = bareme;
    showToast('Barème sauvegardé ✓ — relance la synchro pour recalculer', 'success');
  } catch(e) {
    showToast('Erreur : ' + e.message, 'error');
  } finally {
    setLoading(btn, false);
  }
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
    chargerBaremeRapide();
    initMultiplicateurs();
    initEquipeLibre();
    chargerFixturesDone();
    chargerLockStatus();
    chargerFeedback();
  } catch(e) {
    showToast(e.message, 'error');
    document.getElementById('rapide-panel').style.display = 'none';
  }
}

async function chargerFixturesDone() {
  const sel = document.getElementById('reset-fixture-select');
  if (!sel) return;
  try {
    const { fixtures } = await adminAction('list_fixtures_done', {});
    sel.innerHTML = '<option value="">— Choisir un match —</option>' +
      fixtures.map(f => {
        const date = f.date_heure ? new Date(f.date_heure).toLocaleDateString('fr-FR') : '';
        return `<option value="${f.id}">[${f.round}] ${esc(f.home_name)} vs ${esc(f.away_name)}${date ? ' (' + date + ')' : ''}</option>`;
      }).join('');
  } catch {}
}

async function resetPointsMatch() {
  const sel = document.getElementById('reset-fixture-select');
  const fixtureId = sel?.value;
  const resultEl  = document.getElementById('reset-fixture-result');
  if (!fixtureId) { showToast('Choisis un match', 'error'); return; }
  const label = sel.options[sel.selectedIndex].text;
  if (!confirm(`Supprimer tous les points pour :\n${label} ?`)) return;
  resultEl.innerHTML = '<span style="color:var(--muted)">Suppression…</span>';
  try {
    await adminAction('reset_points_fixture', { fixture_id: Number(fixtureId) });
    resultEl.innerHTML = `<span style="color:var(--green)">✓ Points supprimés pour le match ${esc(label)}</span>`;
    showToast('Points supprimés ✓', 'success');
  } catch(e) {
    resultEl.innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`;
    showToast(e.message, 'error');
  }
}


async function chargerBaremeRapide() {
  await loadBareme();
  const bareme = CONFIG.BAREME;
  const el = document.getElementById('rapide-bareme');
  if (!el) return;

  const STATS = [
    { key: 'min60',      label: '≥ 60 min' },
    { key: 'moins60',    label: '< 60 min' },
    { key: 'but',        label: 'But' },
    { key: 'passe',      label: 'Passe déc.' },
    { key: 'cleanSheet', label: 'Clean sheet' },
    { key: 'arrets3',    label: 'Arrêts ×3 (GAR)' },
    { key: 'penArrete',  label: 'Pen. arrêté' },
    { key: 'penManque',  label: 'Pen. manqué' },
    { key: 'butEnc2',    label: 'Buts enc. ×2' },
    { key: 'jaune',      label: 'Carton jaune' },
    { key: 'rouge',      label: 'Carton rouge' },
    { key: 'csc',        label: 'CSC' },
  ];
  const POS = ['GAR', 'DEF', 'MIL', 'ATT'];

  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:0.85rem;margin-bottom:12px">
      <thead><tr>
        <th style="text-align:left;padding:5px 8px;font-size:0.72rem;color:var(--muted);border-bottom:2px solid var(--border)">Action</th>
        ${POS.map(p => `<th style="text-align:center;padding:5px;border-bottom:2px solid var(--border)"><span class="badge badge-${p}">${p}</span></th>`).join('')}
      </tr></thead>
      <tbody>
        ${STATS.map(s => `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
            <td style="padding:5px 8px;font-size:0.8rem">${s.label}</td>
            ${POS.map(p => `
              <td style="text-align:center;padding:3px 5px">
                <input type="number" class="bareme-input bareme-input-rapide" step="1"
                  data-pos="${p}" data-key="${s.key}" value="${bareme[p]?.[s.key] ?? 0}">
              </td>`).join('')}
          </tr>`).join('')}
      </tbody>
    </table>
    <button class="btn btn-primary" onclick="sauvegarderBaremeRapide()">💾 Sauvegarder le barème</button>`;
}

// ── Multiplicateurs phase finale ──────────────────────────
let currentMultiplicateurs = null;

async function initMultiplicateurs() {
  const el = document.getElementById('mult-ui');
  if (!el) return;
  try {
    const res = await adminAction('get_multiplicateurs', {});
    currentMultiplicateurs = res.multiplicateurs || {
      active: false, rounds: { final: 3, semi: 2.5, quarter: 2, r16: 1.5 }
    };
  } catch {
    currentMultiplicateurs = { active: false, rounds: { final: 3, semi: 2.5, quarter: 2, r16: 1.5 } };
  }
  renderMultUI();
}

function renderMultUI() {
  const el = document.getElementById('mult-ui');
  if (!el || !currentMultiplicateurs) return;
  const m = currentMultiplicateurs;
  const rounds = [
    { key:'r16',    label:'Huitièmes de finale', icon:'⚡×1.5' },
    { key:'quarter',label:'Quarts de finale',   icon:'⚡×2' },
    { key:'semi',   label:'Demi-finales',       icon:'⚡×2.5' },
    { key:'final',  label:'Finale',             icon:'⚡×3' },
  ];
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
      <button class="btn ${m.active ? 'btn-primary' : 'btn-secondary'}" style="font-size:0.78rem;padding:5px 14px" onclick="toggleMultiplicateurs()">
        ${m.active ? '⚡ Actif' : '○ Inactif'}
      </button>
      <span style="font-size:0.75rem;color:var(--muted)">${m.active ? 'Multiplicateurs appliqués aux matchs K.O.' : 'Sans effet sur les points actuellement'}</span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:0.82rem;margin-bottom:10px">
      ${rounds.map(r => `
        <tr style="border-bottom:1px solid var(--border)22">
          <td style="padding:4px 0;color:var(--muted);font-size:0.76rem">${r.label}</td>
          <td style="text-align:right;padding:4px 0">
            <input type="number" class="mult-input" data-key="${r.key}"
              value="${m.rounds?.[r.key] ?? 1}" step="0.25" min="1" max="10"
              style="width:60px;text-align:center;font-size:0.8rem;padding:3px 6px">
          </td>
        </tr>`).join('')}
    </table>
    <button class="btn btn-primary btn-sm" onclick="sauvegarderMultiplicateurs()">💾 Sauvegarder</button>
    <div style="font-size:0.67rem;color:var(--muted);margin-top:8px;font-style:italic;line-height:1.4">
      Note patch v2 : si les multiplicateurs rendent la fin du tournoi trop disproportionnée, ils peuvent être désactivés en un clic.
    </div>
  `;
}

async function toggleMultiplicateurs() {
  if (!currentMultiplicateurs) return;
  currentMultiplicateurs.active = !currentMultiplicateurs.active;
  try {
    await adminAction('save_multiplicateurs', { multiplicateurs: currentMultiplicateurs });
    renderMultUI();
    showToast(`Multiplicateurs ${currentMultiplicateurs.active ? 'activés ⚡' : 'désactivés'}`, 'success');
  } catch(e) {
    currentMultiplicateurs.active = !currentMultiplicateurs.active;
    renderMultUI();
    showToast(e.message, 'error');
  }
}

async function sauvegarderMultiplicateurs() {
  const rounds = {};
  document.querySelectorAll('.mult-input').forEach(inp => {
    rounds[inp.dataset.key] = parseFloat(inp.value) || 1;
  });
  currentMultiplicateurs.rounds = rounds;
  try {
    await adminAction('save_multiplicateurs', { multiplicateurs: currentMultiplicateurs });
    showToast('Multiplicateurs sauvegardés ✓', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

async function sauvegarderBaremeRapide() {
  const bareme = { GAR: {}, DEF: {}, MIL: {}, ATT: {} };
  document.querySelectorAll('.bareme-input-rapide').forEach(input => {
    bareme[input.dataset.pos][input.dataset.key] = Number(input.value);
  });
  try {
    await adminAction('save_bareme', { bareme });
    CONFIG.BAREME = bareme;
    showToast('Barème sauvegardé ✓', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

function afficherEquipesRapide(equipes) {
  const el = document.getElementById('rapide-equipes');
  if (!equipes || equipes.length === 0) { el.innerHTML = '<em style="color:var(--muted)">Aucune équipe</em>'; return; }
  el.innerHTML = equipes.map(e => `
    <div style="padding:7px 0;border-bottom:1px solid var(--border)33">
      <div id="view-${e.id}" style="display:flex;align-items:center;justify-content:space-between;gap:6px">
        <div style="flex:1;min-width:0">
          <span style="font-weight:600">${esc(e.nom)}</span>
          <span style="font-size:0.72rem;color:var(--muted);margin-left:8px">${new Date(e.created_at).toLocaleDateString('fr-FR')}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          <button id="off-btn-${e.id}" class="btn btn-sm ${e.officiel ? 'btn-primary' : 'btn-secondary'}"
            style="font-size:0.7rem;padding:2px 8px"
            onclick="toggleOfficiel('${e.id}', ${e.officiel})"
            title="${e.officiel ? 'Retirer du tournoi officiel' : 'Ajouter au tournoi officiel'}">
            ${e.officiel ? '👑' : '⭐'}
          </button>
          <button class="btn btn-secondary btn-sm" onclick="afficherRenommer('${e.id}','${esc(e.nom)}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="supprimerEquipeRapide('${e.id}','${esc(e.nom)}')">🗑️</button>
        </div>
      </div>
      <div id="rename-${e.id}" style="display:none;gap:6px;align-items:center;margin-top:6px">
        <input type="text" id="rename-input-${e.id}" value="${esc(e.nom)}" style="flex:1"
          onkeydown="if(event.key==='Enter')confirmerRenommer('${e.id}');if(event.key==='Escape')annulerRenommer('${e.id}')">
        <button class="btn btn-primary btn-sm" onclick="confirmerRenommer('${e.id}')">OK</button>
        <button class="btn btn-secondary btn-sm" onclick="annulerRenommer('${e.id}')">✕</button>
      </div>
    </div>`).join('');
}

async function toggleOfficiel(id, currentValue) {
  const newVal = !currentValue;
  try {
    await adminAction('toggle_officiel', { equipe_id: id, officiel: newVal });
    const btn = document.getElementById(`off-btn-${id}`);
    if (btn) {
      btn.textContent = newVal ? '👑' : '⭐';
      btn.className = `btn btn-sm ${newVal ? 'btn-primary' : 'btn-secondary'}`;
      btn.title = newVal ? 'Retirer du tournoi officiel' : 'Ajouter au tournoi officiel';
      btn.setAttribute('onclick', `toggleOfficiel('${id}', ${newVal})`);
    }
    showToast(newVal ? 'Équipe marquée officielle 👑' : 'Équipe non-officielle ⭐', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}

function afficherRenommer(id, nom) {
  document.getElementById(`view-${id}`).style.display = 'none';
  const el = document.getElementById(`rename-${id}`);
  el.style.display = 'flex';
  const input = document.getElementById(`rename-input-${id}`);
  input.focus(); input.select();
}

function annulerRenommer(id) {
  document.getElementById(`view-${id}`).style.display = 'flex';
  document.getElementById(`rename-${id}`).style.display = 'none';
}

async function confirmerRenommer(id) {
  const input = document.getElementById(`rename-input-${id}`);
  const nom = input.value.trim();
  if (!nom) { showToast('Nom vide', 'error'); return; }
  try {
    await adminAction('rename_equipe', { equipe_id: id, nom });
    showToast('Équipe renommée ✓', 'success');
    connecterRapide();
  } catch(e) { showToast(e.message, 'error'); }
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

// ── Diagnostic fixture ────────────────────────────────────
async function recalcFixture(fixtureId) {
  const el = document.getElementById('diag-result');
  try {
    const { recalculated } = await adminAction('recalc_points_fixture', { fixture_id: fixtureId });
    showToast(`${recalculated} lignes de points recalculées ✓`, 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function resyncFixture(fixtureId) {
  if (!confirm(`Re-syncer le match ${fixtureId} ? Les stats existantes seront supprimées et refetchées depuis l'API.`)) return;
  const el = document.getElementById('diag-result');
  el.innerHTML = '<span style="color:var(--muted)">Re-sync en cours…</span>';
  try {
    const { resynced } = await adminAction('resync_fixture', { fixture_id: fixtureId });
    showToast(`${resynced} stats re-synced ✓ — relance "Calculer les points"`, 'success');
    diagFixture(); // rafraîchit l'affichage
  } catch(e) {
    showToast('Erreur : ' + e.message, 'error');
    el.innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`;
  }
}

async function diagFixture() {
  const fixtureId = document.getElementById('diag-fixture-id').value.trim();
  const el = document.getElementById('diag-result');
  if (!fixtureId) { showToast('Entre un fixture ID', 'error'); return; }

  el.innerHTML = '<span style="color:var(--muted)">Appel API en cours…</span>';

  try {
    const { teams } = await adminAction('api_fixture_players', { fixture_id: Number(fixtureId) });

    if (!teams || teams.length === 0) {
      el.innerHTML = '<span style="color:var(--muted)">Aucun joueur retourné par l\'API.</span>';
      return;
    }

    el.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="resyncFixture(${fixtureId})">🔄 Re-syncer depuis l'API</button>
        <button class="btn btn-secondary btn-sm" onclick="recalcFixture(${fixtureId})">⭐ Recalculer les points</button>
      </div>` + teams.map(team => `
      <div style="margin-bottom:16px">
        <div style="font-weight:700;font-size:0.9rem;margin-bottom:6px;color:var(--accent)">${esc(team.team)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
          <thead><tr>
            <th style="text-align:left;padding:4px 8px;color:var(--muted);border-bottom:1px solid var(--border)">Joueur</th>
            <th style="padding:4px 8px;color:var(--muted);border-bottom:1px solid var(--border)">ID API</th>
            <th style="padding:4px 8px;color:var(--muted);border-bottom:1px solid var(--border)">Min</th>
            <th style="padding:4px 8px;color:var(--muted);border-bottom:1px solid var(--border)">Buts</th>
            <th style="padding:4px 8px;color:var(--muted);border-bottom:1px solid var(--border)">En DB</th>
          </tr></thead>
          <tbody>
            ${team.players.map(p => `
              <tr style="border-bottom:1px solid var(--border)22;${!p.in_db ? 'color:var(--red)' : ''}">
                <td style="padding:4px 8px">${esc(p.nom)}</td>
                <td style="padding:4px 8px;font-family:monospace">${p.id}</td>
                <td style="padding:4px 8px;text-align:center">${p.minutes}'</td>
                <td style="padding:4px 8px;text-align:center">${p.buts > 0 ? `<strong>${p.buts}</strong>` : '—'}</td>
                <td style="padding:4px 8px;text-align:center">${p.in_db ? '✓' : '✗ manquant'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');

  } catch(e) {
    el.innerHTML = `<span style="color:var(--red)">Erreur : ${esc(e.message)}</span>`;
  }
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Pack de joueurs ───────────────────────────────────────
let packCartes = [];

const PACK_RARITIES = [
  { key:'rare',      name:'RARE',       color:'#58a6ff', borderColor:'#58a6ff' },
  { key:'epic',      name:'ÉPIQUE',     color:'#d2a8ff', borderColor:'#d2a8ff' },
  { key:'legendary', name:'LÉGENDAIRE', color:'#f0883e', borderColor:'#f0883e' },
];

const NATION_FLAG = {
  'France':'fr','Germany':'de','Spain':'es','Portugal':'pt','Netherlands':'nl','Belgium':'be',
  'England':'gb-eng','Scotland':'gb-sct','Wales':'gb-wls','Ireland':'ie','Switzerland':'ch',
  'Austria':'at','Denmark':'dk','Sweden':'se','Norway':'no','Croatia':'hr','Serbia':'rs',
  'Ukraine':'ua','Poland':'pl','Czech Republic':'cz','Slovakia':'sk','Hungary':'hu',
  'Romania':'ro','Turkey':'tr','Greece':'gr','Slovenia':'si','Albania':'al','Georgia':'ge',
  'Brazil':'br','Argentina':'ar','Colombia':'co','Uruguay':'uy','Ecuador':'ec','Chile':'cl',
  'Peru':'pe','Bolivia':'bo','Paraguay':'py','Venezuela':'ve',
  'Mexico':'mx','USA':'us','United States':'us','Canada':'ca','Costa Rica':'cr','Panama':'pa',
  'Honduras':'hn','El Salvador':'sv','Jamaica':'jm','Haiti':'ht','Cuba':'cu','Guatemala':'gt',
  "Trinidad & Tobago":'tt',"Curaçao":'cw',
  'Morocco':'ma','Nigeria':'ng','Senegal':'sn','Cameroon':'cm','Ghana':'gh','Egypt':'eg',
  'South Africa':'za','Ivory Coast':'ci',"Côte d'Ivoire":'ci','Tunisia':'tn','Algeria':'dz',
  'Mali':'ml','Guinea':'gn','Angola':'ao','Cape Verde':'cv','Benin':'bj',
  'Japan':'jp','South Korea':'kr','Australia':'au','Iran':'ir','Saudi Arabia':'sa',
  'Qatar':'qa','UAE':'ae','Iraq':'iq','China':'cn','Indonesia':'id','New Zealand':'nz',
  'Thailand':'th','Vietnam':'vn','Uzbekistan':'uz',
};

function genererContenuPack() {
  // Distribution garantie : 2 RARE + 2 ÉPIQUE + 1 LÉGENDAIRE, triées par rareté ascending
  const rar = k => PACK_RARITIES.find(r => r.key === k);
  const dist = [rar('rare'), rar('rare'), rar('epic'), rar('epic'), rar('legendary')];
  const pool = libreJoueurs.length > 0
    ? [...libreJoueurs].sort(() => Math.random() - 0.5)
    : Array(5).fill(null).map(() => ({ id:0, nom:'Joueur', poste:'MIL', nation:'', valeur:5 }));
  return dist.map((rarity, i) => ({
    joueur: pool[i] || pool[0] || { id:0, nom:'Joueur', poste:'MIL', nation:'', valeur:5 },
    rarity,
    revealed: false,
    removed:  false,
    el:       null,
  }));
}

function injectPackStyles() {
  if (document.getElementById('pack-styles')) return;
  const s = document.createElement('style');
  s.id = 'pack-styles';
  s.textContent = `
    #pack-modal {
      position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.92);
      display:flex;align-items:center;justify-content:center;flex-direction:column;gap:24px;
      backdrop-filter:blur(5px);
    }
    /* ── Pack box ── */
    .pack-box {
      width:195px;height:278px;
      background:linear-gradient(150deg,#0d1117,#1c2333,#0d1117);
      border:2px solid #58a6ff;border-radius:18px;
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
      box-shadow:0 0 40px #58a6ff44,0 0 80px #58a6ff1a,inset 0 0 40px #58a6ff08;
      animation:pack-pulse 2s ease-in-out infinite;
      cursor:pointer;user-select:none;transition:transform .2s;
    }
    .pack-box:hover{transform:scale(1.04)}.pack-box:active{transform:scale(.97)}
    @keyframes pack-pulse {
      0%,100%{box-shadow:0 0 40px #58a6ff44,0 0 80px #58a6ff1a}
      50%     {box-shadow:0 0 65px #58a6ff77,0 0 130px #58a6ff33}
    }
    /* ── Card row (état final) ── */
    .pack-cards-row{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;padding:0 12px}
    /* ── Stack container ── */
    .pack-stack-container{position:relative;width:246px;height:348px;margin:0 auto}
    .pack-stack-container .pack-card{position:absolute;top:0;left:0}
    @keyframes card-fly-off{
      0%  {opacity:1}
      100%{transform:translate(var(--fly-x,0px),-460px) rotate(var(--fly-r,-10deg)) scale(.8);opacity:0}
    }
    .pack-card.fly-off{animation:card-fly-off .5s ease-in forwards;pointer-events:none!important}
    @keyframes card-levitate{
      0%,100%{transform:rotateY(180deg) translateY(0)}
      50%    {transform:rotateY(180deg) translateY(-10px)}
    }
    /* ── Card flip structure ── */
    .pack-card{
      width:210px;height:300px;
      perspective:900px;cursor:pointer;flex-shrink:0;
      --pointer-x:50%;--pointer-y:50%;--background-x:50%;--background-y:50%;
      --card-opacity:0;
    }
    .pack-card-inner{
      position:relative;width:100%;height:100%;
      transform-style:preserve-3d;
      transition:transform .7s cubic-bezier(.4,.2,.2,1);
    }
    .pack-card.flipped .pack-card-inner{transform:rotateY(180deg)}
    .pack-card-back,.pack-card-front{
      position:absolute;width:100%;height:100%;
      backface-visibility:hidden;border-radius:15px;overflow:hidden;
    }
    /* ── Card back ── */
    .pack-card-back{
      background:linear-gradient(150deg,#0d1117,#161b26,#0d1117);
      border:2px solid #30363d;
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
    }
    .pack-card-back::before{
      content:'';position:absolute;inset:0;
      background:repeating-linear-gradient(45deg,transparent,transparent 10px,#ffffff04 10px,#ffffff04 12px);
    }
    /* ── Card front base ── */
    .pack-card-front{transform:rotateY(180deg);position:relative}
    .rarity-common   {display:none}
    .rarity-rare     {border:2px solid #58a6ff;background:linear-gradient(160deg,#06182a,#102848);box-shadow:0 0 14px #58a6ff33,inset 0 0 12px #58a6ff06}
    .rarity-epic     {border:2px solid #d2a8ff;background:linear-gradient(160deg,#100a22,#241448);box-shadow:0 0 18px #d2a8ff44,inset 0 0 16px #d2a8ff06}
    .rarity-legendary{border:2px solid #f0883e;background:linear-gradient(160deg,#1c0c00,#3c1e00,#1c0c00);box-shadow:0 0 24px #f0883e55,0 0 50px #f0883e18,inset 0 0 24px #f0883e08;animation:leg-glow 2s ease-in-out infinite}
    @keyframes leg-glow{
      0%,100%{box-shadow:0 0 24px #f0883e55,0 0 50px #f0883e18}
      50%     {box-shadow:0 0 36px #f0883e77,0 0 70px #f0883e28}
    }
    /* ── Card content layout ── */
    .pcard-wrap{
      position:relative;z-index:2;width:100%;height:100%;
      display:flex;flex-direction:column;align-items:center;
      padding:10px 10px 8px;box-sizing:border-box;gap:6px;
    }
    .pcard-header{
      display:flex;justify-content:space-between;align-items:center;
      padding:4px 8px;border-radius:8px 8px 0 0;
      margin:-10px -10px 0;width:calc(100% + 20px);
    }
    .pcard-rarity-name{font-size:.65rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
    .pcard-stars{font-size:.75rem;letter-spacing:.04em}
    .rarity-common  .pcard-header{display:none}
    .rarity-rare    .pcard-header{background:rgba(88,166,255,.14);color:#58a6ff}
    .rarity-epic    .pcard-header{background:rgba(210,168,255,.14);color:#d2a8ff}
    .rarity-legendary .pcard-header{background:rgba(240,136,62,.16);color:#f0883e}
    /* ── Photo area ── */
    .pcard-photo-wrap{
      width:100px;height:100px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;margin:6px 0;position:relative;
    }
    .pcard-photo-wrap::before{
      content:'';position:absolute;inset:-2px;border-radius:50%;
      background:conic-gradient(from 0deg,var(--rar-color,#8b949e),transparent 40%,var(--rar-color,#8b949e) 60%,transparent 80%,var(--rar-color,#8b949e));
      animation:ring-spin 4s linear infinite;
      filter:blur(1px);
    }
    .rarity-common  .pcard-photo-wrap{--rar-color:#b0bec5}
    .rarity-rare    .pcard-photo-wrap{--rar-color:#58a6ff}
    .rarity-epic    .pcard-photo-wrap{--rar-color:#d2a8ff}
    .rarity-legendary .pcard-photo-wrap{--rar-color:#f0883e}
    @keyframes ring-spin{to{transform:rotate(360deg)}}
    .pcard-photo-inner{
      width:92px;height:92px;border-radius:50%;
      background:rgba(0,0,0,.5);
      display:flex;align-items:center;justify-content:center;
      overflow:hidden;position:relative;z-index:1;
    }
    .pcard-photo-inner img{width:100%;height:100%;object-fit:cover}
    .pcard-initials{font-size:1.6rem;font-weight:900}
    /* ── Text ── */
    .pcard-name{font-size:.93rem;font-weight:800;color:#e6edf3;text-align:center;line-height:1.2;max-width:178px}
    .pcard-meta{display:flex;align-items:center;gap:5px;margin-top:1px}
    .pcard-flag{width:20px;height:14px;border-radius:2px;object-fit:cover;flex-shrink:0}
    .pcard-nation{font-size:.72rem;color:#8b949e;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .pcard-pos{
      padding:3px 12px;border-radius:6px;font-size:.7rem;font-weight:700;margin-top:2px;
    }
    .rarity-common   .pcard-pos{display:none}
    .rarity-rare     .pcard-pos{background:rgba(88,166,255,.15);color:#58a6ff;border:1px solid rgba(88,166,255,.3)}
    .rarity-epic     .pcard-pos{background:rgba(210,168,255,.15);color:#d2a8ff;border:1px solid rgba(210,168,255,.3)}
    .rarity-legendary .pcard-pos{background:rgba(240,136,62,.15);color:#f0883e;border:1px solid rgba(240,136,62,.3)}
    .pcard-value{font-size:.68rem;color:#8b949e44;margin-top:auto}
    /* ── HOLO SHINE — subtle color-dodge layer ── */
    .pack-card-shine{
      position:absolute;inset:0;border-radius:13px;
      pointer-events:none;z-index:5;
      opacity:calc(var(--card-opacity,0) * .28);
      transition:opacity .3s;
      mix-blend-mode:color-dodge;
      filter:brightness(1.04) contrast(1.06) saturate(1.1);
    }
    .rarity-common .pack-card-shine,.rarity-common .pack-card-glare{display:none}
    .rarity-rare .pack-card-shine{
      background:radial-gradient(
        ellipse 160% 160% at var(--pointer-x,50%) var(--pointer-y,50%),
        rgba(120,200,255,.95) 0%,
        rgba(0,100,220,.55) 40%,
        transparent 68%
      );
    }
    .rarity-epic .pack-card-shine{
      background:radial-gradient(
        ellipse 160% 160% at var(--pointer-x,50%) var(--pointer-y,50%),
        rgba(230,140,255,.95) 0%,
        rgba(140,0,230,.55) 40%,
        transparent 68%
      );
    }
    .rarity-legendary .pack-card-shine{
      background:
        radial-gradient(ellipse 110% 110% at var(--pointer-x,50%) var(--pointer-y,50%),
          rgba(255,248,160,1) 0%,
          rgba(255,190,30,.75) 22%,
          rgba(240,120,0,.35) 48%,
          transparent 68%
        ),
        radial-gradient(ellipse 200% 200% at var(--pointer-x,50%) var(--pointer-y,50%),
          rgba(255,200,50,.2) 0%,
          transparent 55%
        );
    }
    /* ── Legendary pre-flip animation ── */
    .pack-card.legendary-pre .pack-card-back{
      animation:leg-back-glow 2.4s ease-in-out;
    }
    .pack-card.legendary-pre .pack-card-back::after{
      content:'';position:absolute;top:-50%;left:-60%;
      width:55%;height:200%;
      background:linear-gradient(90deg,transparent,rgba(255,210,60,.5),rgba(255,248,150,.85),rgba(255,210,60,.5),transparent);
      transform:rotate(-15deg);
      animation:leg-sweep 2.4s ease-in-out;
      pointer-events:none;
    }
    @keyframes leg-back-glow{
      0%  {box-shadow:0 0 0 rgba(240,136,62,0)}
      20% {box-shadow:0 0 30px rgba(240,136,62,.6),0 0 60px rgba(240,136,62,.3)}
      50% {box-shadow:0 0 70px rgba(255,210,50,1),0 0 140px rgba(240,136,62,.7),0 0 200px rgba(240,136,62,.3)}
      75% {box-shadow:0 0 50px rgba(240,136,62,.8),0 0 100px rgba(240,136,62,.4)}
      100%{box-shadow:0 0 0 rgba(240,136,62,0)}
    }
    @keyframes leg-sweep{
      0%  {transform:translateX(-200%) rotate(-15deg);opacity:0}
      10% {opacity:1}
      90% {opacity:1}
      100%{transform:translateX(700%) rotate(-15deg);opacity:0}
    }
    /* ── HOLO GLARE — soft spotlight ── */
    .pack-card-glare{
      position:absolute;inset:0;border-radius:13px;
      pointer-events:none;z-index:6;
      opacity:calc(var(--card-opacity,0) * .18);
      transition:opacity .3s;
      mix-blend-mode:overlay;
      filter:brightness(.9) contrast(1.2);
      background-image:radial-gradient(
        farthest-corner circle at var(--pointer-x,50%) var(--pointer-y,50%),
        hsla(200,80%,90%,.9) 5%,
        hsla(0,0%,40%,.2) 55%,
        hsla(0,0%,0%,.3) 110%
      );
    }
    .rarity-common .pack-card-glare{display:none}
    /* ── Animations ── */
    @keyframes card-enter{from{opacity:0;transform:translateY(55px) scale(.84)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes screen-flash{0%{opacity:0}30%{opacity:.85}100%{opacity:0}}
    @keyframes particle-fly{to{transform:translate(var(--tx),var(--ty)) scale(0);opacity:0}}
    @keyframes legendary-flash{0%{filter:brightness(1)}18%{filter:brightness(3.5)}100%{filter:brightness(1)}}
    #pack-close-btn{
      position:fixed;top:16px;right:20px;
      background:transparent;border:1px solid #30363d;color:#8b949e;
      padding:6px 16px;border-radius:8px;cursor:pointer;font-size:.85rem;z-index:10000;
      transition:border-color .2s,color .2s;
    }
    #pack-close-btn:hover{border-color:#8b949e;color:#c9d1d9}
  `;
  document.head.appendChild(s);
}

function ouvrirPackModal() {
  injectPackStyles();
  const existing = document.getElementById('pack-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'pack-modal';
  modal.innerHTML = `
    <div id="pack-phase-1" style="text-align:center">
      <div style="font-size:.78rem;color:#8b949e;letter-spacing:.14em;text-transform:uppercase;margin-bottom:16px">CDM Fantasy 2026</div>
      ${buildPackBox()}
    </div>
    <div id="pack-phase-2" style="display:none;text-align:center;width:100%">
      <div style="font-size:.76rem;color:#8b949e;letter-spacing:.12em;text-transform:uppercase;margin-bottom:14px">CDM Fantasy 2026</div>
      <div id="pack-cards-row"></div>
      <div id="pack-progress" style="font-size:.78rem;color:#8b949e;margin:14px 0 10px;min-height:1.2em"></div>
      <div id="pack-action-btns" style="display:flex;gap:10px;justify-content:center">
        <button class="btn btn-primary" id="pack-reveal-btn" onclick="revelerToutLesCartes()">✨ Révéler tout</button>
        <button class="btn btn-secondary" onclick="ouvrirNouveauPack()">🔄 Nouveau pack</button>
      </div>
    </div>
    <button id="pack-close-btn" onclick="fermerPackModal()">✕ Fermer</button>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

function buildPackBox() {
  return `<div class="pack-box" onclick="animerOuverturePack()">
    <div style="font-size:1.5rem;color:#58a6ff;font-weight:900;letter-spacing:.15em;text-shadow:0 0 20px #58a6ff99">CDM</div>
    <div style="font-size:2.6rem;color:#58a6ff55;font-weight:900;letter-spacing:.05em;line-height:1">2026</div>
    <div style="font-size:.82rem;font-weight:900;color:#58a6ff;letter-spacing:.1em;margin-top:4px">PACK JOUEURS</div>
    <div style="font-size:.67rem;color:#58a6ff77;letter-spacing:.08em">2 Rares · 2 Épiques · 1 Légendaire</div>
    <div style="margin-top:10px;font-size:.7rem;color:#58a6ff99;animation:pack-pulse 1.5s ease-in-out infinite">▶ Cliquer pour ouvrir</div>
  </div>`;
}

function animerOuverturePack() {
  const box = document.querySelector('.pack-box');
  if (!box || box.dataset.opening) return;
  box.dataset.opening = '1';

  packCartes = genererContenuPack();

  // Shake the pack
  box.style.transition = 'transform .1s';
  [5,-5,4,-4,3,0].forEach((v, i) => {
    setTimeout(() => { box.style.transform = `scale(1.06) translateX(${v}px) rotate(${v*.5}deg)`; }, i * 65);
  });

  setTimeout(() => {
    box.style.transition = 'transform .22s ease-in, opacity .22s ease-in';
    box.style.transform = 'scale(1.45)';
    box.style.opacity = '0';

    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:white;pointer-events:none;z-index:10000;animation:screen-flash .35s forwards';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 360);

    spawnCenterParticles();

    setTimeout(() => {
      document.getElementById('pack-phase-1').style.display = 'none';
      document.getElementById('pack-phase-2').style.display = 'block';
      renderPackCards();
    }, 240);
  }, 6 * 65 + 60);
}

function renderPackCards() {
  const container = document.getElementById('pack-cards-row');
  container.innerHTML = '';
  container.className = 'pack-stack-container';

  packCartes.forEach((carte, i) => {
    const n      = packCartes.length;
    const offset = i * 9; // index 0 = top (no offset), index 4 = bottom (most offset)
    const zIdx   = n - i; // index 0 = z-index 5, index 4 = z-index 1

    const card = document.createElement('div');
    card.className = 'pack-card';
    card.style.cssText = `
      position:absolute;top:0;left:0;
      transform:translate(${offset}px,${offset}px);
      z-index:${zIdx};
      pointer-events:${i === 0 ? 'auto' : 'none'};
      opacity:0;animation:card-enter .4s ease forwards;animation-delay:${i*70}ms
    `;
    card.onclick = () => revelerCarteCourante();
    card.innerHTML = `
      <div class="pack-card-inner">
        <div class="pack-card-back">
          <div style="font-size:2rem;color:#58a6ff;opacity:.18;font-weight:900;line-height:1">✦</div>
          <div style="font-size:.8rem;color:#58a6ff;font-weight:900;letter-spacing:.2em;text-shadow:0 0 12px #58a6ff88">CDM</div>
          <div style="font-size:1.3rem;color:#58a6ff88;font-weight:900;letter-spacing:.1em;line-height:1">2026</div>
          <div style="font-size:.55rem;color:#30363d;letter-spacing:.18em;text-transform:uppercase;margin-top:2px">Fantasy</div>
        </div>
        <div class="pack-card-front rarity-${carte.rarity.key}">
          ${buildCardFront(carte.joueur, carte.rarity)}
          <div class="pack-card-shine"></div>
          <div class="pack-card-glare"></div>
        </div>
      </div>`;
    container.appendChild(card);
    carte.el = card;
  });

  updateStackPositions();
  updateProgressLabel();
}

function updateStackPositions() {
  const remaining = packCartes.filter(c => !c.removed);
  remaining.forEach((carte, depth) => {
    if (!carte.el) return;
    const offset = depth * 9;
    carte.el.style.transform  = `translate(${offset}px,${offset}px)`;
    carte.el.style.zIndex     = remaining.length - depth;
    carte.el.style.pointerEvents = depth === 0 ? 'auto' : 'none';
    if (!carte.revealed) {
      carte.el.style.transition = 'transform 0.35s ease';
    }
  });
}

function updateProgressLabel() {
  const prog = document.getElementById('pack-progress');
  if (!prog) return;
  const total     = packCartes.length;
  const remaining = packCartes.filter(c => !c.revealed).length;
  if (remaining > 0) {
    prog.textContent = `${total - remaining + 1} / ${total} — Cliquer pour révéler`;
  } else {
    prog.textContent = '';
  }
}

function revelerCarteCourante() {
  const idx = packCartes.findIndex(c => !c.revealed);
  if (idx === -1) return;
  revelerCarte(idx);
}

function buildCardFront(j, rar) {
  if (!j) return '';
  const initials  = (j.nom||'?').split(' ').filter(Boolean).map(w=>w[0]).join('').substring(0,2).toUpperCase();
  const posColor  = {GAR:'#79c0ff',DEF:'#3fb950',MIL:'#f0883e',ATT:'#f85149'}[j.poste]||'#8b949e';
  const starCount = {common:1,rare:2,epic:3,legendary:4}[rar.key]||1;
  const stars     = '★'.repeat(starCount)+'☆'.repeat(4-starCount);
  const flagCode  = NATION_FLAG[j.nation||''];
  const flagHtml  = flagCode
    ? `<img src="https://flagcdn.com/w20/${flagCode}.png" class="pcard-flag" alt="" onerror="this.style.display='none'">`
    : '';
  const photoHtml = j.photo
    ? `<img src="${esc(j.photo)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="pcard-initials" style="display:none;color:${posColor}">${initials}</div>`
    : `<div class="pcard-initials" style="color:${posColor}">${initials}</div>`;

  return `<div class="pcard-wrap">
    <div class="pcard-header">
      <span class="pcard-rarity-name">${rar.name}</span>
      <span class="pcard-stars" style="color:${rar.color}">${stars}</span>
    </div>
    <div class="pcard-photo-wrap">
      <div class="pcard-photo-inner">${photoHtml}</div>
    </div>
    <div class="pcard-name">${esc(j.nom||'?')}</div>
    <div class="pcard-meta">${flagHtml}<span class="pcard-nation">${esc(j.nation||'')}</span></div>
    <div class="pcard-pos">${j.poste||'?'}</div>
    <div class="pcard-value">${j.valeur||'?'} M$</div>
  </div>`;
}

function revelerCarte(idx) {
  const carte = packCartes[idx];
  if (!carte || carte.revealed || !carte.el) return;
  carte.revealed = true;
  carte.el.style.pointerEvents = 'none';

  const revealed = packCartes.filter(c => c.revealed).length;
  const prog = document.getElementById('pack-progress');
  if (prog) prog.textContent = `${revealed} / ${packCartes.length} — ${revealed < packCartes.length ? 'Cliquer pour révéler' : ''}`;

  if (packCartes.every(c => c.revealed)) {
    const btn = document.getElementById('pack-reveal-btn');
    if (btn) btn.style.display = 'none';
  }

  const flyOff = (isLegendary) => {
    const delay = isLegendary ? 2400 : 1200;
    setTimeout(() => {
      const dir = Math.random() > 0.5 ? 90 : -90;
      carte.el.style.setProperty('--fly-x', `${dir}px`);
      carte.el.style.setProperty('--fly-r', `${dir > 0 ? 12 : -12}deg`);
      carte.el.classList.add('fly-off');
      setTimeout(() => {
        carte.removed = true;
        if (carte.el) carte.el.style.display = 'none';
        updateStackPositions();
        if (packCartes.every(c => c.removed)) showFinalState();
      }, 520);
    }, delay);
  };

  if (carte.rarity.key === 'legendary') {
    carte.el.classList.add('legendary-pre');
    setTimeout(() => {
      carte.el.classList.remove('legendary-pre');
      carte.el.classList.add('flipped');
      setTimeout(() => effectLegendaire(carte.el, carte.rarity.color), 380);
      activerTiltCarte(carte.el);
      flyOff(true);
    }, 2500);
  } else {
    carte.el.classList.add('flipped');
    setTimeout(() => {
      const rar = carte.rarity.key;
      if (rar === 'epic')      effectEpique(carte.el, carte.rarity.color);
      else if (rar === 'rare') effectRare(carte.el, carte.rarity.color);
    }, 380);
    activerTiltCarte(carte.el);
    flyOff(false);
  }
}

function showFinalState() {
  const container = document.getElementById('pack-cards-row');
  if (!container) return;

  container.className = 'pack-cards-row';
  container.innerHTML = '';
  container.style.cssText = '';

  const prog = document.getElementById('pack-progress');
  if (prog) prog.textContent = '✨ Toutes les cartes révélées !';

  const btns = document.getElementById('pack-action-btns');
  if (btns) {
    btns.innerHTML = '<button class="btn btn-secondary" onclick="ouvrirNouveauPack()">🔄 Nouveau pack</button>';
  }

  packCartes.forEach((carte, i) => {
    const card = document.createElement('div');
    card.className = 'pack-card flipped';
    card.style.cssText = `opacity:0;animation:card-enter .45s ease forwards;animation-delay:${i*110}ms`;
    card.innerHTML = `
      <div class="pack-card-inner" style="transform:rotateY(180deg)">
        <div class="pack-card-back"></div>
        <div class="pack-card-front rarity-${carte.rarity.key}">
          ${buildCardFront(carte.joueur, carte.rarity)}
          <div class="pack-card-shine"></div>
          <div class="pack-card-glare"></div>
        </div>
      </div>`;
    container.appendChild(card);
    carte.el = card;
    carte.removed = false;
    setTimeout(() => activerTiltCarte(card), 200 + i * 110);
  });
}

function activerTiltCarte(cardEl) {
  const inner = cardEl.querySelector('.pack-card-inner');
  if (!inner) return;
  inner.style.transition = 'transform .12s ease-out';

  cardEl.addEventListener('mousemove', (e) => {
    const rect = cardEl.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    const rx = ((y - 50) / 50) * 14;
    const ry = ((50 - x) / 50) * 14;
    inner.style.transform = `rotateY(${180 + ry}deg) rotateX(${rx}deg)`;
    cardEl.style.setProperty('--pointer-x',    `${x}%`);
    cardEl.style.setProperty('--pointer-y',    `${y}%`);
    cardEl.style.setProperty('--background-x', `${x}%`);
    cardEl.style.setProperty('--background-y', `${y}%`);
    cardEl.style.setProperty('--card-opacity', '1');
  });

  cardEl.addEventListener('mouseleave', () => {
    inner.style.transition = 'transform .5s ease-out';
    inner.style.transform  = 'rotateY(180deg)';
    cardEl.style.setProperty('--card-opacity', '0');
  });
}

function revelerToutLesCartes() {
  const btn = document.getElementById('pack-reveal-btn');
  if (btn) btn.style.display = 'none';

  // Déclencher chaque carte séquentiellement en tenant compte du délai de fly-off
  let delay = 0;
  packCartes.forEach((carte, i) => {
    setTimeout(() => revelerCarteCourante(), delay);
    // Délai avant la prochaine : flip + fly-off duration (hors legendary)
    delay += carte.rarity.key === 'legendary' ? 5800 : 1900;
  });
}

function ouvrirNouveauPack() {
  packCartes = [];
  const ph1 = document.getElementById('pack-phase-1');
  const ph2 = document.getElementById('pack-phase-2');
  if (!ph1 || !ph2) return;
  ph2.style.display = 'none';
  ph1.innerHTML = `
    <div style="font-size:.78rem;color:#8b949e;letter-spacing:.14em;text-transform:uppercase;margin-bottom:16px">CDM Fantasy 2026</div>
    ${buildPackBox()}`;
  ph1.style.display = 'block';
}

function effectRare(el, color) { spawnParticles(el, color, 20, false); }

function effectEpique(el, color) {
  spawnParticles(el, color, 38, false);
  const inner = el.querySelector('.pack-card-inner');
  if (inner) inner.style.animation = 'card-levitate 2s ease-in-out infinite';
}

function effectLegendaire(el, color) {
  const flash = document.createElement('div');
  flash.style.cssText = `position:fixed;inset:0;background:${color};pointer-events:none;z-index:10000;animation:screen-flash .45s forwards;mix-blend-mode:lighten`;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 460);

  const inner = el.querySelector('.pack-card-inner');
  if (inner) inner.style.animation = 'legendary-flash .4s ease, card-levitate 2.5s .5s ease-in-out infinite';

  spawnParticles(el, color, 60, true);
  spawnParticles(el, '#ffe066', 32, true);
  spawnParticles(el, '#ffffff', 18, false);
}

function spawnParticles(el, color, count, large) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < count; i++) {
    const p   = document.createElement('div');
    const sz  = large ? Math.random()*11+5 : Math.random()*6+2;
    const tx  = (Math.random()-.5) * (large ? 560 : 300);
    const ty  = (Math.random()-.5) * (large ? 560 : 300);
    const dur = Math.random()*.8+.5;
    const br  = Math.random()>.55 ? '3px' : '50%';
    p.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:${sz}px;height:${sz}px;background:${color};border-radius:${br};pointer-events:none;z-index:10001;--tx:${tx}px;--ty:${ty}px;animation:particle-fly ${dur}s ease-out forwards`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), dur*1000+100);
  }
}

function spawnCenterParticles() {
  const colors = ['#58a6ff','#d2a8ff','#f0883e','#3fb950','#ffe066','#ff7b72'];
  for (let i = 0; i < 55; i++) {
    const p   = document.createElement('div');
    const col = colors[Math.floor(Math.random()*colors.length)];
    const sz  = Math.random()*9+3;
    const tx  = (Math.random()-.5)*720;
    const ty  = (Math.random()-.5)*520;
    const dur = Math.random()*.7+.35;
    p.style.cssText = `position:fixed;left:50%;top:50%;width:${sz}px;height:${sz}px;background:${col};border-radius:50%;pointer-events:none;z-index:10001;--tx:${tx}px;--ty:${ty}px;animation:particle-fly ${dur}s ease-out forwards`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), dur*1000+100);
  }
}

function fermerPackModal() {
  const m = document.getElementById('pack-modal');
  if (m) m.remove();
  document.body.style.overflow = '';
  packCartes = [];
}

// ── Équipe libre (sans budget) ────────────────────────────
let libreJoueurs = [];
const libreSelected = new Map(); // id → joueur
let librePos = 'ALL';

async function initEquipeLibre() {
  libreJoueurs = await fetchAllDb(
    db.from('joueurs').select('id,nom,poste,nation,valeur,photo').eq('actif', true).order('poste').order('valeur', { ascending: false })
  );
  const nations = [...new Set(libreJoueurs.map(j => j.nation).filter(Boolean))].sort();
  const sel = document.getElementById('libre-nation');
  if (sel) { sel.innerHTML = '<option value="">🌍 Toutes</option>'; nations.forEach(n => sel.add(new Option(n, n))); }
  renderLibreList();
}

function setLibrePos(pos) {
  librePos = pos;
  document.querySelectorAll('[data-libre-pos]').forEach(b => b.classList.toggle('active', b.dataset.librePos === pos));
  renderLibreList();
}

function renderLibreList() {
  const q      = (document.getElementById('libre-search')?.value || '').toLowerCase();
  const nation = document.getElementById('libre-nation')?.value || '';
  const el     = document.getElementById('libre-player-list');
  if (!el || !libreJoueurs.length) return;

  const filtered = libreJoueurs.filter(j => {
    if (librePos !== 'ALL' && j.poste !== librePos) return false;
    if (nation && j.nation !== nation) return false;
    if (q && !j.nom.toLowerCase().includes(q) && !(j.nation || '').toLowerCase().includes(q)) return false;
    return true;
  });

  el.innerHTML = filtered.map(j => {
    const sel = libreSelected.has(j.id);
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--border)22;${sel ? 'background:var(--accent)0d' : ''}">
      <div style="min-width:0;flex:1">
        <span class="badge badge-${j.poste}" style="font-size:0.6rem;margin-right:5px">${j.poste}</span>
        <span style="font-size:0.82rem;font-weight:${sel ? '700' : '500'};color:${sel ? 'var(--accent)' : 'var(--text)'}">${esc(j.nom)}</span>
        <span style="font-size:0.7rem;color:var(--muted);margin-left:4px">${esc(j.nation || '')}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <span style="font-size:0.72rem;color:var(--muted)">${j.valeur}M</span>
        <button class="btn btn-sm ${sel ? 'btn-danger' : 'btn-primary'}" style="padding:2px 10px;font-size:0.72rem;min-width:28px"
          onclick="${sel ? 'removeJoueurLibre' : 'addJoueurLibre'}(${j.id})">${sel ? '−' : '+'}</button>
      </div>
    </div>`;
  }).join('') || '<div style="color:var(--muted);padding:14px;text-align:center;font-size:0.8rem">Aucun joueur</div>';
}

function addJoueurLibre(id) {
  const j = libreJoueurs.find(j => j.id === id);
  if (j) { libreSelected.set(id, j); renderLibreList(); renderLibreSelected(); }
}

function removeJoueurLibre(id) {
  libreSelected.delete(id);
  renderLibreList();
  renderLibreSelected();
}

function viderLibreSelection() {
  libreSelected.clear();
  renderLibreList();
  renderLibreSelected();
}

function renderLibreSelected() {
  const el    = document.getElementById('libre-selected');
  const count = document.getElementById('libre-count');
  if (count) count.textContent = libreSelected.size;
  if (!el) return;

  if (libreSelected.size === 0) {
    el.innerHTML = '<span style="color:var(--muted);font-size:0.8rem">Aucun joueur sélectionné</span>';
    return;
  }

  const byPos = { GAR: [], DEF: [], MIL: [], ATT: [] };
  libreSelected.forEach(j => { if (byPos[j.poste]) byPos[j.poste].push(j); });

  el.innerHTML = ['GAR','DEF','MIL','ATT'].map(pos => {
    if (!byPos[pos].length) return '';
    return `<div style="margin-bottom:5px">
      <span class="badge badge-${pos}" style="font-size:0.6rem;margin-right:3px">${pos} ×${byPos[pos].length}</span>
      ${byPos[pos].map(j => `
        <span style="display:inline-flex;align-items:center;gap:3px;background:var(--accent)22;color:var(--accent);border-radius:999px;padding:1px 8px;font-size:0.73rem;margin:2px">
          ${esc(j.nom)}<span style="cursor:pointer;font-weight:700;opacity:.6;margin-left:2px" onclick="removeJoueurLibre(${j.id})">×</span>
        </span>`).join('')}
    </div>`;
  }).join('');
}

async function creerEquipeLibre() {
  const nom = (document.getElementById('libre-nom').value || '').trim();
  if (!nom) { showToast('Entre un nom d\'équipe', 'error'); return; }
  if (libreSelected.size === 0) { showToast('Sélectionne au moins un joueur', 'error'); return; }

  try {
    const { nom: equipeNom, joueurs: nb } = await adminAction('create_team_libre', {
      nom,
      joueur_ids: Array.from(libreSelected.keys()),
    });
    showToast(`"${equipeNom}" créée avec ${nb} joueurs ✓`, 'success');
    libreSelected.clear();
    document.getElementById('libre-nom').value = '';
    renderLibreList();
    renderLibreSelected();
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

// ── Meilleure équipe théorique ────────────────────────────
async function calculerMeilleureEquipe() {
  const el = document.getElementById('best-team-result');
  el.innerHTML = '<div style="color:var(--muted);font-size:0.85rem">Calcul en cours…</div>';

  try {
    const [pointsAll, joueurs] = await Promise.all([
      fetchAllDb(db.from('points').select('joueur_id,fixture_id,points')),
      fetchAllDb(db.from('joueurs').select('id,nom,poste,nation,valeur,photo').eq('actif', true)),
    ]);

    // Points par joueur (dédupliqués par joueur+fixture)
    const seen = new Set();
    const ptsByJoueur = {};
    pointsAll.forEach(p => {
      const key = `${p.joueur_id}_${p.fixture_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        ptsByJoueur[p.joueur_id] = Math.round(((ptsByJoueur[p.joueur_id] || 0) + p.points) * 10) / 10;
      }
    });

    const players = joueurs.map(j => ({ ...j, totalPts: ptsByJoueur[j.id] || 0 }));

    // Grouper par poste, trier par points décroissants
    const byPos = { GAR: [], DEF: [], MIL: [], ATT: [] };
    players.forEach(j => { if (byPos[j.poste]) byPos[j.poste].push(j); });
    Object.values(byPos).forEach(arr => arr.sort((a, b) => b.totalPts - a.totalPts));

    const BUDGET = 110;
    const STRUCTURE = { GAR: 2, DEF: 5, MIL: 5, ATT: 3 };
    const posEntries = Object.entries(STRUCTURE);

    const selected = [];
    const selectedIds = new Set();
    let left = BUDGET;

    // Coût minimum pour remplir n slots d'un poste (joueurs les moins chers non encore sélectionnés)
    function minFill(pos, n) {
      return byPos[pos]
        .filter(j => !selectedIds.has(j.id))
        .sort((a, b) => a.valeur - b.valeur)
        .slice(0, n)
        .reduce((s, j) => s + j.valeur, 0);
    }

    for (let pi = 0; pi < posEntries.length; pi++) {
      const [pos, n] = posEntries[pi];
      let got = 0;
      for (const j of byPos[pos]) {
        if (got >= n) break;
        if (selectedIds.has(j.id)) continue;
        // Vérifie qu'après avoir choisi j, on peut encore remplir tous les postes restants
        selectedIds.add(j.id);
        const needThisPos = minFill(pos, n - got - 1);
        const needFuture  = posEntries.slice(pi + 1).reduce((s, [fp, fn]) => s + minFill(fp, fn), 0);
        selectedIds.delete(j.id);
        if (j.valeur + needThisPos + needFuture <= left) {
          selected.push(j); selectedIds.add(j.id); left -= j.valeur; got++;
        }
      }
    }

    if (selected.length < 15) { el.innerHTML = '<div class="error-state">Impossible de former une équipe de 15 joueurs dans le budget.</div>'; return; }

    const pts = Math.round(selected.reduce((s, j) => s + j.totalPts, 0) * 10) / 10;
    const budgetUsed = Math.round((BUDGET - left) * 10) / 10;

    const byPosSelected = { GAR: [], DEF: [], MIL: [], ATT: [] };
    selected.forEach(j => byPosSelected[j.poste].push(j));

    const playerRow = (j) => `
      <div style="display:flex;align-items:center;gap:10px;padding:6px 4px;border-bottom:1px solid var(--border)22">
        ${j.photo
          ? `<img src="${j.photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0">`
          : `<div style="width:28px;height:28px;border-radius:50%;background:${CONFIG.COLORS[j.poste]}22;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;color:${CONFIG.COLORS[j.poste]};flex-shrink:0">${j.nom.split(' ').map(w=>w[0]).join('').substring(0,2)}</div>`}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(j.nom)}</div>
          <div style="font-size:0.7rem;color:var(--muted)">${esc(j.nation)} · ${j.valeur} M$</div>
        </div>
        <div style="font-weight:800;color:var(--accent);font-size:0.9rem;white-space:nowrap">${j.totalPts} pts</div>
      </div>`;

    el.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:18px">
        <div class="card" style="flex:1;min-width:80px;text-align:center;padding:12px 10px;background:var(--accent)11">
          <div style="font-size:1.6rem;font-weight:900;color:var(--accent)">${pts}</div>
          <div style="font-size:0.7rem;color:var(--muted)">Points totaux</div>
        </div>
        <div class="card" style="flex:1;min-width:80px;text-align:center;padding:12px 10px">
          <div style="font-size:1.4rem;font-weight:800">2-5-5-3</div>
          <div style="font-size:0.7rem;color:var(--muted)">Structure</div>
        </div>
        <div class="card" style="flex:1;min-width:80px;text-align:center;padding:12px 10px">
          <div style="font-size:1.4rem;font-weight:800">${budgetUsed} M$</div>
          <div style="font-size:0.7rem;color:var(--muted)">Budget utilisé</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
        <div>${renderPitch(selected)}</div>
        <div>
          ${['GAR','DEF','MIL','ATT'].map(pos => byPosSelected[pos].length ? `
            <div style="margin-bottom:14px">
              <div style="font-size:0.72rem;font-weight:700;color:${CONFIG.COLORS[pos]};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${pos}</div>
              ${byPosSelected[pos].map(playerRow).join('')}
            </div>` : '').join('')}
        </div>
      </div>`;
  } catch(e) {
    el.innerHTML = `<div class="error-state">Erreur : ${e.message}</div>`;
  }
}
