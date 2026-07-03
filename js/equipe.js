// equipe.js
document.getElementById('nav-placeholder').innerHTML = buildNav('equipe');

// Module-level so modal/tooltip functions can access them
let _joueurStats = {};
let _joueurMap   = {};

async function init() {
  const params  = new URLSearchParams(window.location.search);
  const id      = params.get('id');
  const content = document.getElementById('content');

  if (!id) {
    content.innerHTML = `<div class="error-state">Aucune équipe spécifiée. <a href="index.html">Retour au classement</a></div>`;
    return;
  }

  try {
    const [equipe, classementAll, equipesMeta, butsMap, pointsData] = await Promise.all([
      fetchEquipeComplete(id),
      fetchClassement(),
      db.from('equipes').select('id, officiel').then(r => r.data || []),
      fetchButsEquipe(),
      db.from('points')
        .select('fixture_id, joueur_id, points, detail, fixtures(home_name, away_name, home_goals, away_goals, date_heure)')
        .eq('equipe_id', id)
        .then(r => r.data || []),
    ]);

    const officielIds = new Set(equipesMeta.filter(e => e.officiel).map(e => e.id));
    const estOfficiel  = officielIds.has(id);
    const classement   = (estOfficiel ? classementAll.filter(e => officielIds.has(e.id)) : classementAll)
      .map((e, i) => ({ ...e, rang: i + 1 }));

    const joueurs    = (equipe.equipe_joueurs || []).map(ej => ej.joueurs).filter(Boolean);
    const budgetUsed = Math.round(joueurs.reduce((s, j) => s + j.valeur, 0) * 10) / 10;
    const actifs     = joueurs.filter(j => j.actif).length;
    const rang       = classement.find(e => e.id === id);
    const pts        = rang ? rang.pts_total : 0;
    const buts       = butsMap[id] || 0;
    const moi        = getMonEquipe();
    const isMe       = moi && moi.id === id;

    document.title = `🐔 ${equipe.nom} — Fantasy CDM`;

    // ── Stats par joueur depuis la table points ───────────────
    _joueurMap   = {};
    _joueurStats = {};
    joueurs.forEach(j => { _joueurMap[j.id] = j; });

    pointsData.forEach(p => {
      if (!_joueurStats[p.joueur_id]) _joueurStats[p.joueur_id] = { total: 0, buts: 0, passes: 0, matchs: [] };
      const js = _joueurStats[p.joueur_id];
      js.total = Math.round((js.total + p.points) * 10) / 10;

      let detail = {};
      try { detail = JSON.parse(p.detail || '{}'); } catch {}

      let bm = 0, pm = 0;
      Object.keys(detail).forEach(k => {
        const mb = k.match(/^Buts ×(\d+)/);   if (mb) bm += parseInt(mb[1]);
        const mp = k.match(/^Passes ×(\d+)/); if (mp) pm += parseInt(mp[1]);
      });
      js.buts   += bm;
      js.passes += pm;
      js.matchs.push({ fixture: p.fixtures, points: p.points, detail });
    });

    // ── Header stats ──────────────────────────────────────────
    const statsHtml = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px">
        ${statCard('🏆', rang ? `#${rang.rang}` : '—', 'Classement')}
        ${statCard('⭐', pts, 'Points')}
        ${statCard('⚽', buts, 'Buts')}
        ${statCard('✅', actifs, 'Actifs')}
        ${statCard('💰', budgetUsed + ' M$', 'Budget')}
      </div>`;

    // ── Pitch ─────────────────────────────────────────────────
    const pitchHtml = renderPitch(joueurs);

    // ── Liste joueurs par poste ───────────────────────────────
    const byPos = { GAR: [], DEF: [], MIL: [], ATT: [] };
    joueurs.forEach(j => { if (byPos[j.poste]) byPos[j.poste].push(j); });

    const listeHtml = CONFIG.POS_ORDER.map(pos => `
      <div style="margin-bottom:16px">
        <div class="card-title" style="color:${CONFIG.COLORS[pos]}">${pos}</div>
        ${byPos[pos].map(j => {
          const js   = _joueurStats[j.id] || { total: 0, buts: 0, passes: 0 };
          const elim = j.actif === false;
          return `
          <div onclick="openJoueurModal(${j.id})"
            style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid var(--border)22;cursor:pointer;border-radius:6px;transition:background .12s;${elim ? 'opacity:.45;' : ''}"
            onmouseenter="this.style.background='rgba(255,255,255,0.04)'"
            onmouseleave="this.style.background=''">
            <div style="position:relative;flex-shrink:0">
              ${j.photo
                ? `<img src="${j.photo}" alt="${j.nom}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;${elim ? 'filter:grayscale(1)' : ''}">`
                : `<div style="width:32px;height:32px;border-radius:50%;background:${CONFIG.COLORS[pos]}22;display:flex;align-items:center;justify-content:center;color:${CONFIG.COLORS[pos]};font-size:0.75rem;font-weight:700">${j.nom.split(' ').map(w=>w[0]).join('').substring(0,2)}</div>`}
              ${elim ? `<div style="position:absolute;bottom:-2px;right:-2px;width:14px;height:14px;background:var(--red);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.55rem;font-weight:900;color:#fff;border:1px solid var(--bg)">✕</div>` : ''}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:0.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(j.nom)}</div>
              <div style="font-size:0.72rem;color:var(--muted);display:flex;align-items:center;gap:5px">
                ${esc(j.nation)}
                ${elim ? `<span style="font-size:.6rem;font-weight:700;color:var(--red);background:rgba(248,81,73,.15);padding:1px 5px;border-radius:4px;letter-spacing:.03em">Éliminé</span>` : ''}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:0.9rem;font-weight:800;color:var(--accent)">${js.total} pts</div>
              ${js.buts > 0 ? `<div style="font-size:0.7rem;color:var(--green)">⚽ ${js.buts}</div>` : '<div style="font-size:0.7rem;color:transparent">·</div>'}
            </div>
          </div>`;
        }).join('')}
      </div>`).join('');

    content.innerHTML = `
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="margin-bottom:4px">
            <a href="index.html" style="color:var(--muted);font-size:0.875rem">← Classement</a>
          </div>
          <div class="page-title">${esc(equipe.nom)} ${isMe ? '<span style="font-size:1rem;font-weight:400;color:var(--accent)">(mon équipe)</span>' : ''}</div>
          <div class="page-subtitle" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            Créée le ${new Date(equipe.created_at).toLocaleDateString('fr-FR')}
            <span style="font-size:0.68rem;font-weight:700;letter-spacing:.05em;padding:2px 9px;border-radius:999px;${estOfficiel
              ? 'color:var(--green);background:rgba(63,185,80,.15);border:1px solid var(--green)'
              : 'color:var(--muted);background:rgba(139,148,158,.15);border:1px solid var(--border)'}">
              ${estOfficiel ? '✓ OFFICIELLE' : 'NON OFFICIELLE'}
            </span>
          </div>
        </div>
      </div>

      ${statsHtml}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
        <div class="card">
          <div class="card-title">Formation — survole ou clique un joueur</div>
          ${pitchHtml}
        </div>
        <div class="card">
          <div class="card-title">Effectif</div>
          ${listeHtml}
        </div>
      </div>

      <div style="margin-top:20px;text-align:right">
        <button id="btn-export" class="btn btn-secondary" onclick="exportRecapImage('${id}')">📸 Exporter en image</button>
      </div>`;

    // ── Event listeners sur les slots du terrain ──────────────
    document.querySelectorAll('.coach-slot.filled[data-id]').forEach(slot => {
      const jid = Number(slot.dataset.id);
      const j   = _joueurMap[jid];
      const js  = _joueurStats[jid] || { total: 0, buts: 0, passes: 0, matchs: [] };
      if (!j) return;

      if (j.actif === false) {
        slot.style.opacity = '0.45';
        slot.style.filter  = 'grayscale(0.8)';
        slot.style.position = 'relative';
        const badge = document.createElement('div');
        badge.style.cssText = 'position:absolute;top:0;left:50%;transform:translateX(-50%);background:var(--red);color:#fff;font-size:0.48rem;font-weight:800;padding:1px 6px;border-radius:999px;white-space:nowrap;letter-spacing:.03em;z-index:5;pointer-events:none';
        badge.textContent = 'Éliminé';
        slot.appendChild(badge);
      }

      slot.style.cursor = 'pointer';
      slot.addEventListener('mouseenter', (e) => showPitchTip(e, j, js));
      slot.addEventListener('mousemove',  positionPitchTip);
      slot.addEventListener('mouseleave', hidePitchTip);
      slot.addEventListener('click',      () => openJoueurModal(jid));
    });

  } catch(e) {
    content.innerHTML = `<div class="error-state">Erreur : ${e.message}</div>`;
  }
}

// ── Tooltip survol ────────────────────────────────────────────
function showPitchTip(event, j, js) {
  let el = document.getElementById('pitch-tip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pitch-tip';
    document.body.appendChild(el);
  }
  el.className = 'pitch-tip';
  el.innerHTML = `
    <div style="font-weight:700;margin-bottom:3px">${esc(j.nom)}</div>
    <div style="font-size:1.05rem;font-weight:800;color:var(--accent)">${js.total} pts</div>
    ${js.buts   > 0 ? `<div style="font-size:0.76rem;color:var(--green);margin-top:1px">⚽ ${js.buts} but${js.buts > 1 ? 's' : ''}</div>` : ''}
    ${js.passes > 0 ? `<div style="font-size:0.76rem;color:var(--orange);margin-top:1px">🎯 ${js.passes} passe${js.passes > 1 ? 's' : ''}</div>` : ''}
    <div style="font-size:0.68rem;color:var(--muted);margin-top:6px;padding-top:4px;border-top:1px solid var(--border)">Cliquer pour le détail</div>`;
  el.style.display = 'block';
  positionPitchTip(event);
}

function positionPitchTip(event) {
  const el = document.getElementById('pitch-tip');
  if (!el || el.style.display === 'none') return;
  const m = 14, w = el.offsetWidth || 170, h = el.offsetHeight || 110;
  let x = event.clientX + m, y = event.clientY + m;
  if (x + w > window.innerWidth  - 8) x = event.clientX - w - m;
  if (y + h > window.innerHeight - 8) y = event.clientY - h - m;
  el.style.left = Math.max(8, x) + 'px';
  el.style.top  = Math.max(8, y) + 'px';
}

function hidePitchTip() {
  const el = document.getElementById('pitch-tip');
  if (el) el.style.display = 'none';
}

// ── Modal détail joueur ───────────────────────────────────────
function openJoueurModal(jid) {
  hidePitchTip();
  const j  = _joueurMap[jid];
  const js = _joueurStats[jid] || { total: 0, buts: 0, passes: 0, matchs: [] };
  if (!j) return;

  const sorted = [...js.matchs].sort((a, b) =>
    new Date(a.fixture?.date_heure || 0) - new Date(b.fixture?.date_heure || 0));

  const matchRows = sorted.map(m => {
    const fx = m.fixture;
    const label = fx
      ? `${fx.home_name} <span style="color:var(--accent);font-weight:700">${fx.home_goals ?? '?'}-${fx.away_goals ?? '?'}</span> ${fx.away_name}`
      : 'Match inconnu';
    const detailStr = Object.entries(m.detail)
      .map(([k, v]) => `<span style="color:${v > 0 ? 'var(--green)' : 'var(--red)'}">${v > 0 ? '+' : ''}${v}</span>&thinsp;${k}`)
      .join(' · ');
    return `
      <div style="padding:8px 0;border-bottom:1px solid var(--border)22">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="font-size:0.8rem;flex:1;line-height:1.4">${label}</div>
          <div style="font-weight:800;font-size:1rem;white-space:nowrap;color:${m.points > 0 ? 'var(--accent)' : m.points < 0 ? 'var(--red)' : 'var(--muted)'}">${m.points > 0 ? '+' : ''}${m.points} pts</div>
        </div>
        <div style="font-size:0.72rem;color:var(--muted);margin-top:3px">${detailStr || '—'}</div>
      </div>`;
  }).join('');

  document.getElementById('joueur-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'joueur-modal';
  modal.className = 'joueur-modal-overlay';
  modal.innerHTML = `
    <div class="joueur-modal-card">
      <button onclick="document.getElementById('joueur-modal').remove()" class="joueur-modal-close">×</button>

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        ${j.photo
          ? `<img src="${j.photo}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid ${CONFIG.COLORS[j.poste]}">`
          : `<div style="width:52px;height:52px;border-radius:50%;background:${CONFIG.COLORS[j.poste]}33;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.1rem;color:${CONFIG.COLORS[j.poste]};flex-shrink:0">${j.nom.split(' ').map(w=>w[0]).join('').substring(0,2)}</div>`}
        <div>
          <div style="font-weight:800;font-size:1.05rem">${esc(j.nom)}</div>
          <div style="font-size:0.8rem;color:var(--muted);margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${esc(j.nation)} · <span class="badge badge-${j.poste}">${j.poste}</span> · ${j.valeur} M$
            ${j.actif === false ? `<span style="font-size:0.65rem;font-weight:700;color:var(--red);background:rgba(248,81,73,.15);padding:1px 7px;border-radius:999px;letter-spacing:.03em">Éliminé</span>` : ''}
          </div>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:18px">
        <div class="modal-stat-box"><div style="font-size:1.4rem;font-weight:800;color:var(--accent)">${js.total}</div><div style="font-size:0.68rem;color:var(--muted)">Points</div></div>
        <div class="modal-stat-box"><div style="font-size:1.4rem;font-weight:800;color:var(--green)">${js.buts}</div><div style="font-size:0.68rem;color:var(--muted)">Buts</div></div>
        <div class="modal-stat-box"><div style="font-size:1.4rem;font-weight:800;color:var(--orange)">${js.passes}</div><div style="font-size:0.68rem;color:var(--muted)">Passes</div></div>
        <div class="modal-stat-box"><div style="font-size:1.4rem;font-weight:800">${js.matchs.length}</div><div style="font-size:0.68rem;color:var(--muted)">Matchs</div></div>
      </div>

      <div style="font-size:0.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Par match</div>
      ${matchRows || '<div style="color:var(--muted);font-size:0.85rem;padding:8px 0">Aucun match joué</div>'}
    </div>`;

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.addEventListener('keydown', function closeOnEsc(e) {
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', closeOnEsc); }
  });
  document.body.appendChild(modal);
}

function statCard(icon, val, label) {
  return `<div class="card" style="flex:1;min-width:80px;text-align:center;padding:14px 10px">
    <div style="font-size:1.4rem">${icon}</div>
    <div style="font-size:1.3rem;font-weight:800;margin:2px 0">${val}</div>
    <div style="font-size:0.7rem;color:var(--muted)">${label}</div>
  </div>`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Export image récap ────────────────────────────────────────
async function exportRecapImage(id) {
  const btn = document.getElementById('btn-export');
  setLoading(btn, true, 'Génération…');

  try {
    const [equipe, equipesMeta, pointsAll, fixturesData] = await Promise.all([
      fetchEquipeComplete(id),
      db.from('equipes').select('id, nom, officiel').then(r => r.data || []),
      fetchAllDb(db.from('points').select('equipe_id, fixture_id, points, joueurs(poste)')),
      db.from('fixtures').select('id, date_heure, status').order('date_heure').then(r => r.data || []),
    ]);

    const joueurs   = (equipe.equipe_joueurs || []).map(ej => ej.joueurs).filter(Boolean);
    const monEquipe = equipesMeta.find(e => e.id === id);
    const estOfficiel = !!monEquipe?.officiel;

    // Le classement/badges se basent sur les équipes officielles si l'équipe
    // exportée est officielle, sinon sur toutes les équipes (mode "tous").
    const equipesScope = estOfficiel ? equipesMeta.filter(e => e.officiel) : equipesMeta;

    // ── Points par équipe par fixture (pour reconstituer le classement jour par jour) ──
    const fixtureById = {};
    fixturesData.forEach(f => { fixtureById[f.id] = f; });

    const dateSet = new Set();
    pointsAll.forEach(p => {
      const f = fixtureById[p.fixture_id];
      if (f && f.date_heure) dateSet.add(f.date_heure.substring(0, 10));
    });
    const dates = Array.from(dateSet).sort();

    const fixByDate = {};
    fixturesData.forEach(f => {
      if (!f.date_heure) return;
      const d = f.date_heure.substring(0, 10);
      if (!fixByDate[d]) fixByDate[d] = [];
      fixByDate[d].push(f.id);
    });

    const ptsByEqFix = {};
    const ptsByEqPoste = {};
    pointsAll.forEach(p => {
      const key = p.equipe_id + '|' + p.fixture_id;
      ptsByEqFix[key] = (ptsByEqFix[key] || 0) + Number(p.points || 0);
      const poste = p.joueurs?.poste;
      if (poste) {
        if (!ptsByEqPoste[p.equipe_id]) ptsByEqPoste[p.equipe_id] = { ATT: 0, MIL: 0, DEF: 0, GAR: 0 };
        ptsByEqPoste[p.equipe_id][poste] += Number(p.points || 0);
      }
    });

    // ── Rang de l'équipe jour par jour (dans le scope officiel/tous) ──
    const cumulByEq = {};
    equipesScope.forEach(e => { cumulByEq[e.id] = 0; });
    let meilleurRang = Infinity;
    let joursPremier = 0;
    let rangFinal = null;

    dates.forEach(date => {
      (fixByDate[date] || []).forEach(fid => {
        equipesScope.forEach(e => { cumulByEq[e.id] += ptsByEqFix[e.id + '|' + fid] || 0; });
      });
      const classementJour = equipesScope
        .map(e => ({ id: e.id, pts: cumulByEq[e.id] }))
        .sort((a, b) => b.pts - a.pts);
      const rang = classementJour.findIndex(e => e.id === id) + 1;
      if (rang > 0) {
        if (rang < meilleurRang) meilleurRang = rang;
        if (rang === 1) joursPremier++;
        rangFinal = rang;
      }
    });
    if (meilleurRang === Infinity) meilleurRang = null;

    // Rang final basé sur le classement actuel (pas seulement les jours avec matchs)
    const classementActuel = equipesScope
      .map(e => ({ id: e.id, pts: cumulByEq[e.id] }))
      .sort((a, b) => b.pts - a.pts);
    rangFinal = classementActuel.findIndex(e => e.id === id) + 1 || rangFinal;

    // ── Badges meilleure attaque / milieu / défense (dans le même scope) ──
    const makeTop = (postes) => equipesScope
      .map(e => ({ id: e.id, val: postes.reduce((s, pos) => s + (ptsByEqPoste[e.id]?.[pos] || 0), 0) }))
      .sort((a, b) => b.val - a.val)[0]?.id;

    const badges = [];
    if (makeTop(['ATT']) === id)          badges.push({ label: 'Meilleure attaque', icon: '⚡' });
    if (makeTop(['MIL']) === id)          badges.push({ label: 'Meilleur milieu',   icon: '⚙️' });
    if (makeTop(['DEF', 'GAR']) === id)   badges.push({ label: 'Meilleure défense', icon: '🛡️' });

    // ── Points totaux ──
    const ptsTotal = Math.round((cumulByEq[id] || 0) * 10) / 10;

    await genererImageRecap({
      nom: equipe.nom,
      estOfficiel,
      joueurs,
      pts: ptsTotal,
      rangFinal,
      meilleurRang,
      joursPremier,
      badges,
    });

    showToast('Image générée ✓', 'success');
  } catch (e) {
    showToast('Erreur export : ' + e.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

const MEDAILLES = { 1: { emoji: '🥇', color: 'var(--gold)' }, 2: { emoji: '🥈', color: 'var(--silver)' }, 3: { emoji: '🥉', color: 'var(--bronze)' } };

function attendreImages(container) {
  const imgs = Array.from(container.querySelectorAll('img'));
  return Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }));
}

async function genererImageRecap({ nom, estOfficiel, joueurs, pts, rangFinal, meilleurRang, joursPremier, badges }) {
  const byPos = { GAR: [], DEF: [], MIL: [], ATT: [] };
  joueurs.forEach(j => { if (byPos[j.poste]) byPos[j.poste].push(j); });

  const medaille = rangFinal ? MEDAILLES[rangFinal] : null;
  const pitchHtml = renderPitch(joueurs);

  const card = document.createElement('div');
  card.style.cssText = 'position:fixed;left:-9999px;top:0;width:640px;background:linear-gradient(180deg,#0d1117 0%,#161b22 100%);padding:36px 32px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--text)';
  card.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:0.8rem;font-weight:700;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">🐔 C'est quoi ce poulet ?</div>
      <div style="font-size:1.9rem;font-weight:800;line-height:1.2">${esc(nom)}</div>
      <div style="margin-top:8px">
        <span style="font-size:0.7rem;font-weight:700;letter-spacing:.05em;padding:3px 10px;border-radius:999px;${estOfficiel
          ? 'color:var(--green);background:rgba(63,185,80,.15);border:1px solid var(--green)'
          : 'color:var(--muted);background:rgba(139,148,158,.15);border:1px solid var(--border)'}">
          ${estOfficiel ? '✓ ÉQUIPE OFFICIELLE' : 'ÉQUIPE NON OFFICIELLE'}
        </span>
      </div>
    </div>

    ${badges.length > 0 ? `
    <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:20px">
      ${badges.map(b => `
        <span style="font-size:0.78rem;font-weight:700;color:var(--gold);background:rgba(255,215,0,.12);border:1px solid var(--gold);padding:5px 12px;border-radius:999px">
          ${b.icon} ${b.label}
        </span>`).join('')}
    </div>` : ''}

    <div style="display:flex;gap:12px;margin-bottom:24px">
      ${statCardRecap(pts, 'Points')}
      ${statCardRecap(
        `${medaille ? medaille.emoji + ' ' : ''}#${rangFinal ?? '—'}`,
        'Position finale',
        medaille ? medaille.color : null
      )}
      ${statCardRecap(meilleurRang ? `#${meilleurRang}` : '—', 'Meilleure position')}
      ${statCardRecap(joursPremier, 'Jours n°1')}
    </div>

    <div class="card" style="padding:20px 8px 8px">
      ${pitchHtml}
    </div>

    <div style="text-align:center;margin-top:20px;font-size:0.72rem;color:var(--muted)">
      Généré le ${new Date().toLocaleDateString('fr-FR')}
    </div>
  `;
  document.body.appendChild(card);

  await attendreImages(card);

  try {
    const canvas = await html2canvas(card, { backgroundColor: '#0d1117', scale: 2, useCORS: true });
    const link = document.createElement('a');
    link.download = `${nom.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-recap.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    card.remove();
  }
}

function statCardRecap(val, label, color) {
  return `<div style="flex:1;text-align:center;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 8px">
    <div style="font-size:1.35rem;font-weight:800;color:${color || 'var(--accent)'}">${val}</div>
    <div style="font-size:0.68rem;color:var(--muted);margin-top:2px">${label}</div>
  </div>`;
}

init();
