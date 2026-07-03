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

init();
