// classement.js
document.getElementById('nav-placeholder').innerHTML = buildNav('classement');

async function init() {
  const content = document.getElementById('content');
  try {
    const [classement, butsMap] = await Promise.all([fetchClassement(), fetchButsEquipe()]);

    if (!classement || classement.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="icon">🐔</div>
          <h3>Aucune équipe inscrite</h3>
          <p style="margin-bottom:16px">Sois le premier à créer ton équipe !</p>
          <a href="creer.html" class="btn btn-primary btn-lg">➕ Créer mon équipe</a>
        </div>`;
      document.getElementById('last-update').textContent = '';
      return;
    }

    const now = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    document.getElementById('last-update').textContent = `${classement.length} participant${classement.length > 1 ? 's' : ''} · Mis à jour le ${now}`;

    const top3 = classement.slice(0, 3);
    const rest = classement.slice(3);
    const moi  = getMonEquipe();

    // ── Podium ──
    const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
    const podiumClass = top3.length === 3 ? [2, 1, 3]                  : [1, 2, 3];
    const medals      = ['🥇', '🥈', '🥉'];

    let podiumHtml = '';
    podiumOrder.forEach((eq, i) => {
      const cls   = `podium-${podiumClass[i]}`;
      const medal = medals[eq.rang - 1] || '';
      const buts  = butsMap[eq.id] || 0;
      const isMe  = moi && moi.id === eq.id;
      podiumHtml += `
        <div class="podium-slot ${cls}">
          <div class="podium-card" onclick="goEquipe('${eq.id}','${esc(eq.nom)}')">
            <div class="podium-medal">${medal}</div>
            <div class="podium-nom" title="${esc(eq.nom)}" ${isMe ? 'style="color:var(--accent)"' : ''}>${esc(eq.nom)}</div>
            <div class="podium-pts">${eq.pts_total} <span style="font-size:0.8rem;font-weight:400">pts</span></div>
            <div class="podium-buts">⚽ ${buts} buts</div>
          </div>
          <div class="podium-base"></div>
        </div>`;
    });

    // ── Table 4th+ ──
    let tableHtml = '';
    if (rest.length > 0) {
      tableHtml = `
        <div class="card" style="margin-top:24px">
          <table class="classement-table">
            <thead>
              <tr>
                <th>#</th><th>Équipe</th><th>Pts</th><th>Buts</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${rest.map(eq => {
                const buts = butsMap[eq.id] || 0;
                const isMe = moi && moi.id === eq.id;
                return `<tr>
                  <td><span class="rang-badge">${eq.rang}</span></td>
                  <td><span class="nom-equipe-link" onclick="goEquipe('${eq.id}','${esc(eq.nom)}')"
                    ${isMe ? 'style="color:var(--accent)"' : ''}>${esc(eq.nom)}</span></td>
                  <td><strong>${eq.pts_total}</strong></td>
                  <td>⚽ ${buts}</td>
                  <td><button class="btn btn-secondary btn-sm" onclick="goEquipe('${eq.id}','${esc(eq.nom)}')">👁 Voir</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    }

    content.innerHTML = `
      <div class="podium">${podiumHtml}</div>
      ${tableHtml}
      ${!moi ? `<div style="text-align:center;margin-top:32px">
        <a href="creer.html" class="btn btn-primary btn-lg">➕ Créer mon équipe</a>
      </div>` : ''}`;

  } catch (e) {
    content.innerHTML = `<div class="error-state">Erreur de chargement : ${e.message}<br><small>Vérifie ta config Supabase dans js/config.js</small></div>`;
  }
}

function goEquipe(id, nom) {
  window.location.href = `equipe.html?id=${encodeURIComponent(id)}&nom=${encodeURIComponent(nom)}`;
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

init();
