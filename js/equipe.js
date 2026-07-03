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
    const [equipe, classement, butsMap, pointsData] = await Promise.all([
      fetchEquipeComplete(id),
      fetchClassement(),
      fetchButsEquipe(),
      db.from('points')
        .select('fixture_id, joueur_id, points, detail, fixtures(home_name, away_name, home_goals, away_goals, date_heure)')
        .eq('equipe_id', id)
        .then(r => r.data || []),
    ]);

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
          <div class="page-subtitle">Créée le ${new Date(equipe.created_at).toLocaleDateString('fr-FR')}</div>
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
    const [equipe, equipesAll, pointsAll, fixturesData] = await Promise.all([
      fetchEquipeComplete(id),
      db.from('equipes').select('id, nom, created_at').then(r => r.data || []),
      fetchAllDb(db.from('points').select('equipe_id, fixture_id, points, joueurs(poste)')),
      db.from('fixtures').select('id, date_heure, status').order('date_heure').then(r => r.data || []),
    ]);

    const joueurs = (equipe.equipe_joueurs || []).map(ej => ej.joueurs).filter(Boolean);

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

    // ── Rang de l'équipe jour par jour ──
    const cumulByEq = {};
    equipesAll.forEach(e => { cumulByEq[e.id] = 0; });
    let meilleurRang = Infinity;
    let joursPremier = 0;

    dates.forEach(date => {
      (fixByDate[date] || []).forEach(fid => {
        equipesAll.forEach(e => { cumulByEq[e.id] += ptsByEqFix[e.id + '|' + fid] || 0; });
      });
      const classementJour = equipesAll
        .map(e => ({ id: e.id, pts: cumulByEq[e.id] }))
        .sort((a, b) => b.pts - a.pts);
      const rang = classementJour.findIndex(e => e.id === id) + 1;
      if (rang > 0) {
        if (rang < meilleurRang) meilleurRang = rang;
        if (rang === 1) joursPremier++;
      }
    });
    if (meilleurRang === Infinity) meilleurRang = null;

    // ── Badges meilleure attaque / milieu / défense ──
    const makeTop = (postes) => equipesAll
      .map(e => ({ id: e.id, val: postes.reduce((s, pos) => s + (ptsByEqPoste[e.id]?.[pos] || 0), 0) }))
      .sort((a, b) => b.val - a.val)[0]?.id;

    const badges = [];
    if (makeTop(['ATT']) === id)          badges.push({ label: 'Meilleure attaque', icon: '⚡' });
    if (makeTop(['MIL']) === id)          badges.push({ label: 'Meilleur milieu',   icon: '⚙️' });
    if (makeTop(['DEF', 'GAR']) === id)   badges.push({ label: 'Meilleure défense', icon: '🛡️' });

    // ── Points totaux ──
    const ptsTotal = Math.round((cumulByEq[id] || 0) * 10) / 10;

    await drawRecapCanvas({
      nom: equipe.nom,
      joueurs,
      pts: ptsTotal,
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

function drawRecapCanvas({ nom, joueurs, pts, meilleurRang, joursPremier, badges }) {
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Fond
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0d1117');
  grad.addColorStop(1, '#161b22');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // En-tête
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8b949e';
  ctx.font = '600 28px -apple-system, Segoe UI, sans-serif';
  ctx.fillText('🐔 C\'EST QUOI CE POULET ?', W / 2, 70);

  ctx.fillStyle = '#e6edf3';
  ctx.font = '800 56px -apple-system, Segoe UI, sans-serif';
  wrapText(ctx, nom, W / 2, 145, W - 100, 60);

  // Badges (attaque/milieu/défense)
  let by = 210;
  if (badges.length > 0) {
    const badgeFont = '700 22px -apple-system, Segoe UI, sans-serif';
    ctx.font = badgeFont;
    const paddings = badges.map(b => ctx.measureText(`${b.icon} ${b.label}`).width + 40);
    const totalW = paddings.reduce((s, w) => s + w, 0) + (badges.length - 1) * 14;
    let bx = W / 2 - totalW / 2;
    badges.forEach((b, i) => {
      const text = `${b.icon} ${b.label}`;
      const bw = paddings[i];
      roundRect(ctx, bx, by, bw, 44, 22);
      ctx.fillStyle = 'rgba(255,215,0,0.15)';
      ctx.fill();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#FFD700';
      ctx.textAlign = 'center';
      ctx.fillText(text, bx + bw / 2, by + 29);
      bx += bw + 14;
    });
    by += 70;
  } else {
    by += 20;
  }

  // Stat cards : points / meilleure position / jours premier
  const stats = [
    { val: pts,                                    label: 'Points' },
    { val: meilleurRang ? `#${meilleurRang}` : '—', label: 'Meilleure position' },
    { val: joursPremier,                            label: 'Jours n°1' },
  ];
  const cardW = (W - 120) / 3 - 20, cardH = 130;
  stats.forEach((s, i) => {
    const cx = 60 + i * (cardW + 20);
    roundRect(ctx, cx, by, cardW, cardH, 14);
    ctx.fillStyle = '#161b22';
    ctx.fill();
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#58a6ff';
    ctx.font = '800 42px -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(s.val), cx + cardW / 2, by + 65);

    ctx.fillStyle = '#8b949e';
    ctx.font = '600 18px -apple-system, Segoe UI, sans-serif';
    ctx.fillText(s.label, cx + cardW / 2, by + 100);
  });

  by += cardH + 50;

  // Composition par poste
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8b949e';
  ctx.font = '700 20px -apple-system, Segoe UI, sans-serif';
  ctx.fillText('COMPOSITION', 60, by);
  by += 30;

  const byPos = { GAR: [], DEF: [], MIL: [], ATT: [] };
  joueurs.forEach(j => { if (byPos[j.poste]) byPos[j.poste].push(j); });

  CONFIG.POS_ORDER.forEach(pos => {
    if (byPos[pos].length === 0) return;
    ctx.fillStyle = CONFIG.COLORS[pos];
    ctx.font = '800 20px -apple-system, Segoe UI, sans-serif';
    ctx.fillText(pos, 60, by + 20);

    const rowsCount = Math.ceil(byPos[pos].length / 2);
    byPos[pos].forEach((j, i) => {
      const rowY = by + 20;
      const col = i < rowsCount ? 0 : 1;
      const row = i < rowsCount ? i : i - rowsCount;
      const x = 130 + col * 460;
      const y = rowY + row * 34;
      const elim = j.actif === false;

      ctx.fillStyle = elim ? '#f8514966' : CONFIG.COLORS[pos];
      ctx.beginPath();
      ctx.arc(x, y - 6, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = elim ? '#8b949e' : '#e6edf3';
      ctx.font = '600 20px -apple-system, Segoe UI, sans-serif';
      ctx.fillText(j.nom + (elim ? ' (éliminé)' : ''), x + 14, y);
    });

    const rows = Math.ceil(byPos[pos].length / 2);
    by += 20 + rows * 34 + 16;
  });

  by += 20;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8b949e';
  ctx.font = '500 16px -apple-system, Segoe UI, sans-serif';
  ctx.fillText(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, W / 2, H - 30);

  // Téléchargement
  const link = document.createElement('a');
  link.download = `${nom.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-recap.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '', lines = [];
  words.forEach(w => {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  });
  lines.push(line);
  const startY = y - (lines.length - 1) * lineHeight / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

init();
