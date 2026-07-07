'use strict';
document.getElementById('nav-placeholder').innerHTML = buildNav('nations');

const FLAG_MAP_N = {
  'France':'🇫🇷','Spain':'🇪🇸','Germany':'🇩🇪','Portugal':'🇵🇹','Netherlands':'🇳🇱',
  'Belgium':'🇧🇪','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Italy':'🇮🇹','Croatia':'🇭🇷','Switzerland':'🇨🇭',
  'Brazil':'🇧🇷','Argentina':'🇦🇷','Colombia':'🇨🇴','Uruguay':'🇺🇾','Ecuador':'🇪🇨',
  'Mexico':'🇲🇽','USA':'🇺🇸','United States':'🇺🇸','Canada':'🇨🇦','Morocco':'🇲🇦',
  'Japan':'🇯🇵','South Korea':'🇰🇷','Australia':'🇦🇺','Iran':'🇮🇷','Saudi Arabia':'🇸🇦',
  'Qatar':'🇶🇦','Senegal':'🇸🇳','Nigeria':'🇳🇬','Egypt':'🇪🇬','South Africa':'🇿🇦',
  'Ghana':'🇬🇭','Tunisia':'🇹🇳','Algeria':'🇩🇿','Ivory Coast':'🇨🇮','Cameroon':'🇨🇲',
  'Congo DR':'🇨🇩','Cape Verde Islands':'🇨🇻','Norway':'🇳🇴','Sweden':'🇸🇪','Denmark':'🇩🇰',
  'Austria':'🇦🇹','Poland':'🇵🇱','Serbia':'🇷🇸','Czechia':'🇨🇿','Slovakia':'🇸🇰',
  'Hungary':'🇭🇺','Romania':'🇷🇴','Türkiye':'🇹🇷','Turkey':'🇹🇷','Greece':'🇬🇷',
  'Bosnia & Herzegovina':'🇧🇦','Albania':'🇦🇱','Georgia':'🇬🇪','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Wales':'🏴󠁧󠁢󠁷󠁬󠁳󠁿','Ireland':'🇮🇪','Panama':'🇵🇦','Costa Rica':'🇨🇷','Jamaica':'🇯🇲',
  'Haiti':'🇭🇹','Honduras':'🇭🇳','El Salvador':'🇸🇻','Curaçao':'🇨🇼',
  'Trinidad & Tobago':'🇹🇹','Paraguay':'🇵🇾','Bolivia':'🇧🇴','Peru':'🇵🇪','Chile':'🇨🇱',
  'Iraq':'🇮🇶','Jordan':'🇯🇴','Uzbekistan':'🇺🇿','New Zealand':'🇳🇿','Indonesia':'🇮🇩',
  'Mali':'🇲🇱','Guinea':'🇬🇳','Angola':'🇦🇴','Benin':'🇧🇯','Venezuela':'🇻🇪',
};

const flg = n => FLAG_MAP_N[n] || '🌍';
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const rnd1 = n => Math.round(n * 10) / 10;

const MEDAL_COLS = ['#e4a93c','#b2bec9','#c97b3a'];
const CARD_CLS   = ['rank-1-card','rank-2-card','rank-3-card'];

let allNations = [];
let activePos  = 'all';
let searchQ    = '';

// Même logique que palmares.js : calcul depuis stats × barème
function computePtsFromStats(stats, joueurs, bareme) {
  if (!bareme) return {};
  const posteMap = {};
  joueurs.forEach(j => { posteMap[j.id] = j.poste; });
  const out = {};
  stats.forEach(s => {
    const poste = posteMap[s.joueur_id];
    if (!poste) return;
    const b = bareme[poste] || bareme['MIL'];
    if (!b) return;
    let pts = 0;
    if (s.minutes >= 60)     pts += b.min60   || 0;
    else if (s.minutes > 0)  pts += b.moins60 || 0;
    pts += (s.buts   || 0) * (b.but   || 0);
    pts += (s.passes || 0) * (b.passe || 0);
    if (s.clean_sheet)       pts += b.cleanSheet || 0;
    if (poste === 'GAR' && (s.arrets || 0) >= 3)
      pts += Math.floor((s.arrets || 0) / 3) * (b.arrets3 || 0);
    if (s.pen_arrete)        pts += b.penArrete || 0;
    if (s.pen_manque)        pts += b.penManque || 0;
    const bEnc = s.buts_encaisses || 0;
    if (bEnc >= 2)           pts += Math.floor(bEnc / 2) * (b.butEnc2 || 0);
    if (s.jaune)             pts += b.jaune || 0;
    if (s.rouge)             pts += b.rouge || 0;
    pts += (s.csc || 0) * (b.csc || 0);
    out[s.joueur_id] = (out[s.joueur_id] || 0) + pts;
  });
  Object.keys(out).forEach(k => { out[k] = rnd1(out[k]); });
  return out;
}

async function init() {
  try {
    const [joueurs, stats, configRows] = await Promise.all([
      fetchAllDb(db.from('joueurs').select('id,nom,poste,nation,valeur')),
      fetchAllDb(db.from('stats').select('joueur_id,fixture_id,buts,passes,clean_sheet,minutes,arrets,buts_encaisses,pen_arrete,pen_manque,jaune,rouge,csc')),
      fetchAllDb(db.from('config').select('key,value').eq('key','bareme')),
    ]);

    let bareme = null;
    try { bareme = JSON.parse(configRows[0]?.value || 'null'); } catch {}

    const ptsJ = computePtsFromStats(stats, joueurs, bareme);

    // Agrège par nation (TOUS les joueurs, même non sélectionnés)
    const map = {};
    joueurs.forEach(j => {
      const n = j.nation || 'Inconnu';
      if (!map[n]) map[n] = { nation: n, players: [], byPos: { GAR:[], DEF:[], MIL:[], ATT:[] }, total: 0 };
      const pts = rnd1(ptsJ[j.id] || 0);
      map[n].players.push({ ...j, pts });
      if (map[n].byPos[j.poste]) map[n].byPos[j.poste].push({ ...j, pts });
      map[n].total += pts;
    });

    allNations = Object.values(map)
      .map(n => ({ ...n, total: rnd1(n.total) }))
      .filter(n => n.total > 0)
      .sort((a, b) => b.total - a.total);

    render();
  } catch (e) {
    document.getElementById('content').innerHTML =
      `<div class="error-state">Erreur : ${esc(e.message)}</div>`;
  }
}

function getFiltered() {
  return allNations.filter(n => {
    if (searchQ && !n.nation.toLowerCase().includes(searchQ)) return false;
    if (activePos !== 'all' && !n.byPos[activePos]?.some(p => p.pts > 0)) return false;
    return true;
  });
}

function render() {
  const filtered = getFiltered();
  const maxPts   = filtered[0]?.total || 1;
  const top3     = filtered.slice(0, 3);
  let html = '';

  // ── Podium top 3 ─────────────────────────────────────────────
  if (top3.length) {
    html += `<div class="podium-top">`;
    top3.forEach((n, i) => {
      const topP = [...n.players].sort((a,b) => b.pts - a.pts)[0];
      html += `
        <div class="podium-card ${CARD_CLS[i]}">
          <div class="podium-medal">${['🥇','🥈','🥉'][i]}</div>
          <div class="podium-flag">${flg(n.nation)}</div>
          <div class="podium-nation-name">${esc(n.nation)}</div>
          <div class="podium-pts" style="color:${MEDAL_COLS[i]}">${n.total} <span style="font-size:.55em;color:var(--muted)">pts</span></div>
          <div class="podium-sub">${n.players.length} joueurs${topP?` · Meilleur : ${esc(topP.nom)} (${topP.pts} pts)`:''}</div>
        </div>`;
    });
    html += `</div>`;
  }

  // ── Filtres ──────────────────────────────────────────────────
  html += `
    <div class="filter-bar">
      <input class="filter-input" type="search" placeholder="🔍 Rechercher une nation…"
        value="${esc(searchQ)}" oninput="onSearch(this.value)">
      <div class="pos-filter">
        ${['all','GAR','DEF','MIL','ATT'].map(p =>`
          <button class="pos-btn${activePos===p?' active':''}" onclick="setPos('${p}')">
            ${p==='all'?'Tous':p}
          </button>`).join('')}
      </div>
    </div>`;

  // ── Table ────────────────────────────────────────────────────
  html += `
    <div style="overflow-x:auto">
    <table class="nations-table">
      <thead>
        <tr>
          <th class="rank-cell">#</th>
          <th style="text-align:left;min-width:160px">Nation</th>
          <th style="text-align:right">Points</th>
          <th></th>
          <th style="text-align:right">Joueurs</th>
          <th style="text-align:left;min-width:120px">Top joueur</th>
          <th style="text-align:left">Postes</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map((n, i) => {
          const rCls   = i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'';
          const barPct = Math.round((n.total / maxPts) * 100);
          const topP   = [...n.players].sort((a,b) => b.pts - a.pts)[0];
          const chips  = Object.entries(n.byPos)
            .filter(([,arr]) => arr.some(p => p.pts > 0))
            .map(([pos]) => `<span class="badge badge-${pos}" style="font-size:.65rem">${pos}</span>`)
            .join('');
          return `
            <tr>
              <td class="rank-cell ${rCls}">${i+1}</td>
              <td><div class="nation-cell">
                <span class="nation-flag">${flg(n.nation)}</span>
                <span class="nation-name">${esc(n.nation)}</span>
              </div></td>
              <td class="pts-cell" style="color:${i<3?MEDAL_COLS[i]:'var(--text)'}">${n.total}</td>
              <td><div class="pts-bar-wrap">
                <div class="pts-bar" style="width:${barPct}%;background:${i===0?'#e4a93c':i===1?'#b2bec9':i===2?'#c97b3a':'var(--accent)'}"></div>
              </div></td>
              <td class="nb-cell">${n.players.length}</td>
              <td style="font-size:.8rem;color:var(--muted)">
                ${topP?`${esc(topP.nom)} <strong style="color:var(--text)">${topP.pts}pts</strong>`:'—'}
              </td>
              <td><div class="pos-chips">${chips}</div></td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
    </div>`;

  document.getElementById('content').innerHTML = html;
}

function onSearch(v) { searchQ = v.toLowerCase().trim(); render(); }
function setPos(p)   { activePos = p; render(); }

init();
