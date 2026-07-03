// equipe.js
document.getElementById('nav-placeholder').innerHTML = buildNav('equipe');

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');
  const nom    = params.get('nom');
  const content = document.getElementById('content');

  if (!id) {
    content.innerHTML = `<div class="error-state">Aucune équipe spécifiée. <a href="index.html">Retour au classement</a></div>`;
    return;
  }

  try {
    const [equipe, classement, butsMap] = await Promise.all([
      fetchEquipeComplete(id),
      fetchClassement(),
      fetchButsEquipe(),
    ]);

    const joueurs = (equipe.equipe_joueurs || []).map(ej => ej.joueurs).filter(Boolean);
    const budgetUsed = Math.round(joueurs.reduce((s, j) => s + j.valeur, 0) * 10) / 10;
    const actifs     = joueurs.filter(j => j.actif).length;
    const rang       = classement.find(e => e.id === id);
    const pts        = rang ? rang.pts_total : 0;
    const buts       = butsMap[id] || 0;
    const moi        = getMonEquipe();
    const isMe       = moi && moi.id === id;

    document.title   = `🐔 ${equipe.nom} — Fantasy CDM`;

    // Stats header
    const statsHtml = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px">
        ${statCard('🏆', rang ? `#${rang.rang}` : '—', 'Classement')}
        ${statCard('⭐', pts, 'Points')}
        ${statCard('⚽', buts, 'Buts')}
        ${statCard('✅', actifs, 'Joueurs actifs')}
        ${statCard('💰', budgetUsed + ' M$', 'Budget utilisé')}
      </div>`;

    // Pitch
    const pitchHtml = renderPitch(joueurs);

    // Liste joueurs par poste
    const byPos = { GAR: [], DEF: [], MIL: [], ATT: [] };
    joueurs.forEach(j => { if (byPos[j.poste]) byPos[j.poste].push(j); });

    const listeHtml = CONFIG.POS_ORDER.map(pos => `
      <div style="margin-bottom:16px">
        <div class="card-title" style="color:${CONFIG.COLORS[pos]}">${pos}</div>
        ${byPos[pos].map(j => `
          <div class="player-row${j.actif === false ? ' eliminated' : ''}" style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)22" title="${j.actif === false ? 'Éliminé de la compétition' : ''}">
            ${j.photo ? `<img class="player-row-avatar" src="${j.photo}" alt="${j.nom}" style="width:32px;height:32px;border-radius:50%;object-fit:cover">` : `<div class="player-row-avatar" style="width:32px;height:32px;border-radius:50%;background:${CONFIG.COLORS[pos]}22;display:flex;align-items:center;justify-content:center;color:${CONFIG.COLORS[pos]};font-size:0.75rem;font-weight:700">${j.nom.split(' ').map(w=>w[0]).join('').substring(0,2)}</div>`}
            <div style="flex:1">
              <div style="font-weight:600;font-size:0.875rem">${esc(j.nom)}</div>
              <div style="font-size:0.75rem;color:var(--muted)">${esc(j.nation)}</div>
            </div>
            ${j.actif === false ? `<div class="elim-tag">❌ Éliminé</div>` : ''}
            <div style="font-size:0.875rem;font-weight:700;color:var(--green)">${j.valeur} M$</div>
          </div>`).join('')}
      </div>`).join('');

    content.innerHTML = `
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <a href="index.html" style="color:var(--muted);font-size:0.875rem">← Classement</a>
          </div>
          <div class="page-title">${esc(equipe.nom)} ${isMe ? '<span style="font-size:1rem;font-weight:400;color:var(--accent)">(mon équipe)</span>' : ''}</div>
          <div class="page-subtitle">Créée le ${new Date(equipe.created_at).toLocaleDateString('fr-FR')}</div>
        </div>
      </div>

      ${statsHtml}

      <div style="display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start">
        <div class="card">
          <div class="card-title">Formation</div>
          ${pitchHtml}
        </div>
        <div class="card">
          <div class="card-title">Effectif</div>
          ${listeHtml}
        </div>
      </div>`;

  } catch(e) {
    content.innerHTML = `<div class="error-state">Erreur : ${e.message}</div>`;
  }
}

function statCard(icon, val, label) {
  return `<div class="card" style="flex:1;min-width:80px;text-align:center;padding:14px 10px">
    <div style="font-size:1.4rem">${icon}</div>
    <div style="font-size:1.3rem;font-weight:800;margin:2px 0">${val}</div>
    <div style="font-size:0.7rem;color:var(--muted)">${label}</div>
  </div>`;
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
