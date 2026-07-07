'use strict';

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────
const GOLD = '#e4a93c', SILVER = '#b2bec9', BRONZE = '#c97b3a';

const FLAG_MAP = {
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
  'Mali':'🇲🇱','Guinea':'🇬🇳','Angola':'🇦🇴','Benin':'🇧🇯',
};

// Positions sur le terrain (% gauche, % haut) — lecture du bas vers le haut
const PITCH_POS = {
  GAR: [{x:30,y:88},{x:70,y:88}],
  DEF: [{x:9,y:70},{x:26,y:65},{x:50,y:63},{x:74,y:65},{x:91,y:70}],
  MIL: [{x:11,y:43},{x:28,y:38},{x:50,y:36},{x:72,y:38},{x:89,y:43}],
  ATT: [{x:28,y:17},{x:50,y:13},{x:72,y:17}],
};

// ─────────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────────
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const flag = n => FLAG_MAP[n] || '🌍';
const rnd = n => Math.round(n*10)/10;

function animCount(el, target, ms=1400, deci=0) {
  if(!el) return;
  const t0 = performance.now(), v = Number(target);
  function step(t) {
    const p = Math.min((t-t0)/ms, 1);
    const e = 1-Math.pow(1-p,3);
    el.textContent = deci ? (e*v).toFixed(deci) : Math.round(e*v).toLocaleString('fr-FR');
    if(p<1) requestAnimationFrame(step);
    else el.textContent = deci ? v.toFixed(deci) : v.toLocaleString('fr-FR');
  }
  requestAnimationFrame(step);
}

function reveal(el, baseMs=120) {
  el.querySelectorAll('.rv').forEach((r,i) => {
    const extra = (parseFloat(r.dataset.d||0)) * 1000;
    setTimeout(() => r.classList.add('in'), baseMs + extra);
  });
  el.querySelectorAll('.rv-scale').forEach((r,i) => {
    const extra = (parseFloat(r.dataset.d||0)) * 1000;
    setTimeout(() => r.classList.add('in'), baseMs + extra);
  });
}

// ─────────────────────────────────────────────────────────────
// Canvas : champ d'étoiles
// ─────────────────────────────────────────────────────────────
function initStarfield() {
  const c = document.getElementById('bg-canvas');
  const ctx = c.getContext('2d');
  let stars = [];
  function resize() {
    c.width = window.innerWidth; c.height = window.innerHeight;
    stars = Array.from({length:200}, () => ({
      x: Math.random()*c.width, y: Math.random()*c.height,
      r: Math.random()*1.3+.25, a: Math.random()*.7+.1,
      da: (Math.random()-.5)*.007,
    }));
  }
  function draw() {
    ctx.clearRect(0,0,c.width,c.height);
    const g = ctx.createRadialGradient(c.width*.3,c.height*.2,0,c.width*.5,c.height*.55,c.width*.85);
    g.addColorStop(0,'#0b1526'); g.addColorStop(.55,'#060811'); g.addColorStop(1,'#020308');
    ctx.fillStyle=g; ctx.fillRect(0,0,c.width,c.height);
    stars.forEach(s=>{
      s.a+=s.da; if(s.a>.9||s.a<.08) s.da=-s.da;
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(215,228,255,${s.a})`; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  resize(); window.addEventListener('resize',resize); draw();
}

// ─────────────────────────────────────────────────────────────
// Canvas : confettis
// ─────────────────────────────────────────────────────────────
let confettiParts = [], confettiRunning = false, confettiTimer = null;
function initConfetti() {
  const c = document.getElementById('fx-canvas');
  const ctx = c.getContext('2d');
  const COLS = ['#f5c842','#e4a93c','#ff6b6b','#58c4dc','#a0e6a0','#d8a2e8','#ff9e4a','#ffffff'];
  function resize() { c.width=window.innerWidth; c.height=window.innerHeight; }
  resize(); window.addEventListener('resize',resize);
  function shoot() {
    for(let i=0;i<12;i++) confettiParts.push({
      x:Math.random()*c.width, y:-10,
      vx:(Math.random()-.5)*7, vy:Math.random()*4+2,
      w:Math.random()*10+5, h:Math.random()*5+3,
      col:COLS[Math.floor(Math.random()*COLS.length)],
      r:Math.random()*Math.PI*2, vr:(Math.random()-.5)*.18, g:.09,
    });
  }
  function loop() {
    ctx.clearRect(0,0,c.width,c.height);
    confettiParts = confettiParts.filter(p=>p.y<c.height+20);
    confettiParts.forEach(p=>{
      p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.r+=p.vr;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r);
      ctx.fillStyle=p.col; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.restore();
    });
    requestAnimationFrame(loop);
  }
  loop();
  window._startConfetti = () => { confettiRunning=true; shoot(); confettiTimer=setInterval(shoot,180); };
  window._stopConfetti  = () => { confettiRunning=false; clearInterval(confettiTimer); confettiTimer=null; };
}

// ─────────────────────────────────────────────────────────────
// Chargement des données
// ─────────────────────────────────────────────────────────────
async function loadData() {
  const [equipes, fixtures, points, stats, joueurs, equipeJoueurs] = await Promise.all([
    fetchAllDb(db.from('equipes').select('id,nom,officiel')),
    fetchAllDb(db.from('fixtures').select('id,round,date_heure,home_name,away_name,home_goals,away_goals,status')),
    fetchAllDb(db.from('points').select('equipe_id,fixture_id,joueur_id,points')),
    fetchAllDb(db.from('stats').select('joueur_id,fixture_id,buts,passes,clean_sheet,minutes,arrets')),
    fetchAllDb(db.from('joueurs').select('id,nom,poste,nation,photo,valeur')),
    fetchAllDb(db.from('equipe_joueurs').select('equipe_id,joueur_id')),
  ]);
  return {equipes, fixtures, points, stats, joueurs, equipeJoueurs};
}

// ─────────────────────────────────────────────────────────────
// Traitement des données
// ─────────────────────────────────────────────────────────────
function process({equipes, fixtures, points, stats, joueurs, equipeJoueurs}) {
  const done = fixtures.filter(f=>['FT','AET','PEN'].includes(f.status));
  const totalGoals  = done.reduce((s,f)=>s+(f.home_goals||0)+(f.away_goals||0),0);
  const totalPts    = rnd(points.reduce((s,p)=>s+p.points,0));
  const totalPasses = stats.reduce((s,x)=>s+(x.passes||0),0);
  const totalArrets = stats.reduce((s,x)=>s+(x.arrets||0),0);
  // Nombre de matchs où au moins un joueur a eu un clean sheet
  const csFixtures = new Set();
  stats.forEach(s=>{ if(s.clean_sheet) csFixtures.add(s.fixture_id); });
  const totalCS = csFixtures.size;

  // Points par equipe
  const ptsEq = {};
  points.forEach(p=>{ ptsEq[p.equipe_id]=(ptsEq[p.equipe_id]||0)+p.points; });
  const ranking = equipes
    .filter(e=>e.officiel)
    .map(e=>({...e, total:rnd(ptsEq[e.id]||0)}))
    .sort((a,b)=>b.total-a.total);

  // Points par joueur (dédupliqué par fixture)
  const seen=new Set(), ptsJ={};
  points.forEach(p=>{
    const k=`${p.joueur_id}_${p.fixture_id}`;
    if(!seen.has(k)){ seen.add(k); ptsJ[p.joueur_id]=(ptsJ[p.joueur_id]||0)+p.points; }
  });

  // Top performer
  const topPerf = [...joueurs].map(j=>({...j,pts:rnd(ptsJ[j.id]||0)}))
    .filter(j=>j.pts>0).sort((a,b)=>b.pts-a.pts)[0]||null;

  // Top scorer
  const bJ={};
  stats.forEach(s=>{ bJ[s.joueur_id]=(bJ[s.joueur_id]||0)+(s.buts||0); });
  const topScore = [...joueurs].map(j=>({...j,buts:bJ[j.id]||0}))
    .filter(j=>j.buts>0).sort((a,b)=>b.buts-a.buts)[0]||null;

  // Top clean sheets
  const csJ={};
  stats.forEach(s=>{ if(s.clean_sheet) csJ[s.joueur_id]=(csJ[s.joueur_id]||0)+1; });
  const topCS2 = [...joueurs].map(j=>({...j,cs:csJ[j.id]||0}))
    .filter(j=>j.cs>0).sort((a,b)=>b.cs-a.cs)[0]||null;

  // Match le plus lucratif (points cumulés)
  const ptsF={};
  points.forEach(p=>{ ptsF[p.fixture_id]=(ptsF[p.fixture_id]||0)+p.points; });
  const bestFId = Object.entries(ptsF).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const bestF   = bestFId ? done.find(f=>f.id==bestFId) : null;
  const bestFPts= bestFId ? rnd(ptsF[bestFId]) : 0;

  // Meilleure équipe théorique
  const bestTeam = computeBestTeam(joueurs, ptsJ);

  // Joueurs de l'équipe championne
  const winner = ranking[0] || null;
  let winnerPlayers = [];
  if(winner) {
    const wIds = new Set((equipeJoueurs||[]).filter(ej=>ej.equipe_id===winner.id).map(ej=>ej.joueur_id));
    winnerPlayers = joueurs.filter(j=>wIds.has(j.id)).map(j=>({...j,totalPts:rnd(ptsJ[j.id]||0)}));
  }

  // Points par fixture × equipe (pour le race chart)
  const ptsGrid = {};
  points.forEach(p => {
    if(!ptsGrid[p.fixture_id]) ptsGrid[p.fixture_id] = {};
    ptsGrid[p.fixture_id][p.equipe_id] = (ptsGrid[p.fixture_id][p.equipe_id]||0)+p.points;
  });

  const matchCount = done.length;
  const avgPtsMatch = matchCount > 0 ? rnd(totalPts / matchCount) : 0;

  return {equipes, joueurs, fixtures:done, ranking, ptsJ, ptsGrid,
    totalGoals, totalPts, totalPasses, totalArrets, totalCS,
    matchCount, avgPtsMatch,
    topPerf, topScore, topCS2, bestF, bestFPts, bestTeam,
    winner, winnerPlayers};
}

function computeBestTeam(joueurs, ptsJ) {
  const BUDGET=110, STRUCT=[['GAR',2],['DEF',5],['MIL',5],['ATT',3]];
  const byPos={GAR:[],DEF:[],MIL:[],ATT:[]};
  joueurs.forEach(j=>{ if(byPos[j.poste]) byPos[j.poste].push({...j,totalPts:rnd(ptsJ[j.id]||0)}); });
  Object.values(byPos).forEach(a=>a.sort((x,y)=>y.totalPts-x.totalPts));
  const sel=[], ids=new Set(); let left=BUDGET;
  for(const [pos,n] of STRUCT){
    let got=0;
    for(const j of byPos[pos]){
      if(got>=n) break;
      if(ids.has(j.id)) continue;
      const cost=j.valeur||0;
      if(cost>0&&left-cost<0) continue;
      ids.add(j.id); sel.push({...j,pos}); left-=cost; got++;
    }
  }
  return {players:sel,spent:rnd(BUDGET-left)};
}

// ─────────────────────────────────────────────────────────────
// Définitions des slides (html + onEnter + onLeave)
// ─────────────────────────────────────────────────────────────

function sIntro(d) {
  return {
    html:`
      <div style="display:flex;flex-direction:column;align-items:center;gap:clamp(14px,3vw,32px)">
        <span class="chicken-bob rv" data-d="0" style="font-size:clamp(5rem,18vw,12rem);display:block">🐔</span>
        <div class="t-xl rv" data-d=".35" style="letter-spacing:.06em;color:rgba(238,242,255,.92)">C'est quoi ce poulet ?</div>
        <div class="t-serif rv" data-d=".65" style="font-size:clamp(1rem,2.8vw,1.8rem);color:rgba(238,242,255,.42)">Coupe du Monde 2026</div>
        <div class="rv" data-d=".9"><div class="divider"></div></div>
        <div class="t-serif rv" data-d="1.1" style="font-size:clamp(.8rem,2vw,1.2rem);color:rgba(238,242,255,.3)">Palmarès du tournoi</div>
      </div>`,
    onEnter(el){ reveal(el,80); }
  };
}

function sMerci(d) {
  const nb = d.equipes.length;
  const round1 = d.fixtures.filter(f=>f.round==='Round of 32').length;
  return {
    html:`
      <div style="display:flex;flex-direction:column;align-items:center;gap:clamp(10px,2.2vw,22px);max-width:680px">
        <div class="t-eyebrow rv" data-d="0" style="letter-spacing:.22em">Merci à tous</div>
        <div class="t-score g-gold rv" data-d=".3" id="cnt-eq">${nb}</div>
        <div class="t-lg rv" data-d=".55" style="color:rgba(238,242,255,.82)">équipe${nb>1?'s':''} inscrite${nb>1?'s':''}</div>
        <div class="divider rv" data-d=".8"></div>
        <div class="t-serif rv" data-d=".95" style="font-size:clamp(.9rem,2.5vw,1.5rem);color:rgba(238,242,255,.42)">
          Merci d'avoir vécu cette aventure ensemble
        </div>
      </div>`,
    onEnter(el){
      reveal(el,100);
      setTimeout(()=>animCount(el.querySelector('#cnt-eq'),nb,1100),450);
    }
  };
}

function sChiffres(d) {
  const cards=[
    {icon:'⚽', id:'cnt-g', val:d.totalGoals,   label:'Buts au total',       col:'#58c4dc'},
    {icon:'🎯', id:'cnt-a', val:d.totalPasses,   label:'Passes décisives',    col:'#a0e6a0'},
    {icon:'🧤', id:'cnt-r', val:d.totalArrets,   label:'Arrêts (gardiens)',   col:'#d8a2e8'},
    {icon:'🔒', id:'cnt-c', val:d.totalCS,       label:'Matchs clean sheet',  col:'#82c9f5'},
    {icon:'⭐', id:'cnt-p', val:d.totalPts,      label:'Points générés',      col:GOLD, deci:1},
    {icon:'📊', id:'cnt-m', val:d.avgPtsMatch,   label:'Moy. pts / match',    col:'#ff9e4a', deci:1},
  ];
  return {
    html:`
      <div style="display:flex;flex-direction:column;align-items:center;gap:clamp(12px,2.5vw,24px);width:100%">
        <div class="t-eyebrow rv" data-d="0">La compétition en chiffres</div>
        <div class="rv" data-d=".2" style="display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(8px,2vw,20px);max-width:860px;width:100%">
          ${cards.map(c=>`
            <div class="stat-card">
              <div style="font-size:clamp(1.2rem,3vw,1.9rem)">${c.icon}</div>
              <div class="sv" style="color:${c.col};font-size:clamp(2rem,5.5vw,4rem)"><span id="${c.id}">0</span></div>
              <div class="sl">${c.label}</div>
            </div>`).join('')}
        </div>
      </div>`,
    onEnter(el){
      reveal(el,100);
      setTimeout(()=>{
        cards.forEach(c=>animCount(el.querySelector('#'+c.id),c.val,1500,c.deci||0));
      },500);
    }
  };
}

function sTopScorer(d) {
  const j=d.topScore; if(!j) return null;
  return {
    html:`
      <div style="display:flex;flex-direction:column;align-items:center;gap:clamp(10px,2.2vw,22px)">
        <div class="t-eyebrow rv" data-d="0">🎯 Le roi des buts</div>
        <div class="player-photo rv-scale" data-d=".25" style="border-color:${GOLD};box-shadow:0 0 50px rgba(228,169,60,.25)">
          ${j.photo?`<img src="${esc(j.photo)}" alt="${esc(j.nom)}" onerror="this.style.display='none'">`:
            `<span>${flag(j.nation)}</span>`}
        </div>
        <div style="display:flex;align-items:center;gap:10px" class="rv" data-d=".5">
          <span style="font-size:clamp(1.2rem,3vw,2rem)">${flag(j.nation)}</span>
          <div class="t-xl g-gold" style="text-transform:none;letter-spacing:.01em">${esc(j.nom)}</div>
        </div>
        <div style="display:flex;align-items:baseline;gap:10px" class="rv" data-d=".7">
          <span class="t-score c-gold" id="cnt-buts">0</span>
          <span class="t-lg c-muted">but${j.buts>1?'s':''}</span>
        </div>
        <div class="rv" data-d=".95" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <span class="pill"><span class="badge badge-${esc(j.poste)}">${esc(j.poste)}</span></span>
          <span class="pill">${esc(j.nation)}</span>
          <span class="pill">⭐ <strong style="color:#eef2ff;margin-left:4px">${rnd(d.ptsJ[j.id]||0)} pts</strong> au tournoi</span>
        </div>
      </div>`,
    onEnter(el){
      reveal(el,100);
      setTimeout(()=>animCount(el.querySelector('#cnt-buts'),j.buts,1200),750);
    }
  };
}

function sTopPerf(d) {
  const j=d.topPerf; if(!j) return null;
  if(d.topScore&&j.id===d.topScore.id) return null; // Skip si même joueur que top scorer
  return {
    html:`
      <div style="display:flex;flex-direction:column;align-items:center;gap:clamp(10px,2.2vw,22px)">
        <div class="t-eyebrow rv" data-d="0">💫 Le plus décisif du tournoi</div>
        <div class="player-photo rv-scale" data-d=".25" style="border-color:#58c4dc;box-shadow:0 0 50px rgba(88,196,220,.2)">
          ${j.photo?`<img src="${esc(j.photo)}" alt="${esc(j.nom)}" onerror="this.style.display='none'">`:
            `<span>${flag(j.nation)}</span>`}
        </div>
        <div style="display:flex;align-items:center;gap:10px" class="rv" data-d=".5">
          <span style="font-size:clamp(1.2rem,3vw,2rem)">${flag(j.nation)}</span>
          <div class="t-xl" style="text-transform:none;letter-spacing:.01em;background:linear-gradient(135deg,#7ed8f6,#0288d1);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">${esc(j.nom)}</div>
        </div>
        <div style="display:flex;align-items:baseline;gap:10px" class="rv" data-d=".7">
          <span class="t-score" style="color:#58c4dc" id="cnt-pts2">0</span>
          <span class="t-lg c-muted">pts</span>
        </div>
        <div class="t-serif rv" data-d=".9" style="font-size:clamp(.75rem,1.8vw,1rem);color:rgba(238,242,255,.35)">points marqués au total sur tout le tournoi</div>
        <div class="rv" data-d="1.1" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <span class="pill"><span class="badge badge-${esc(j.poste)}">${esc(j.poste)}</span></span>
          <span class="pill">${esc(j.nation)}</span>
        </div>
      </div>`,
    onEnter(el){
      reveal(el,100);
      setTimeout(()=>animCount(el.querySelector('#cnt-pts2'),j.pts,1400,1),750);
    }
  };
}

function sBestMatch(d) {
  const f=d.bestF; if(!f) return null;
  const date=f.date_heure?new Date(f.date_heure).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}):'';
  return {
    html:`
      <div style="display:flex;flex-direction:column;align-items:center;gap:clamp(12px,2.8vw,30px)">
        <div class="t-eyebrow rv" data-d="0">🔥 Le match du tournoi</div>
        <div class="match-card rv" data-d=".3">
          <div style="font-size:clamp(.6rem,1.3vw,.78rem);letter-spacing:.12em;text-transform:uppercase;color:rgba(238,242,255,.3);margin-bottom:10px">
            ${esc(f.round)}${date?' · '+date:''}
          </div>
          <div style="display:flex;align-items:center;gap:clamp(14px,4vw,44px)">
            <div style="text-align:right;min-width:clamp(70px,12vw,130px)">
              <div style="font-size:clamp(.75rem,2vw,1.1rem);font-weight:600">${esc(f.home_name)}</div>
              <div style="font-size:clamp(1rem,2.5vw,1.6rem);margin-top:2px">${flag(f.home_name)}</div>
            </div>
            <div class="match-score-big g-gold">${f.home_goals}–${f.away_goals}</div>
            <div style="text-align:left;min-width:clamp(70px,12vw,130px)">
              <div style="font-size:clamp(.75rem,2vw,1.1rem);font-weight:600">${esc(f.away_name)}</div>
              <div style="font-size:clamp(1rem,2.5vw,1.6rem);margin-top:2px">${flag(f.away_name)}</div>
            </div>
          </div>
        </div>
        <div class="rv" data-d=".65" style="text-align:center">
          <div class="t-eyebrow" style="margin-bottom:6px">Ce match a généré</div>
          <div class="t-lg c-gold"><span id="cnt-bfpts">0</span> <span class="c-muted" style="font-size:.6em">pts</span></div>
          <div style="font-size:clamp(.55rem,1.2vw,.7rem);letter-spacing:.1em;text-transform:uppercase;color:rgba(238,242,255,.25);margin-top:4px">cumulés toutes équipes confondues</div>
        </div>
      </div>`,
    onEnter(el){
      reveal(el,100);
      setTimeout(()=>animCount(el.querySelector('#cnt-bfpts'),d.bestFPts,1200,1),700);
    }
  };
}

function makePins(players) {
  const byPos={GAR:[],DEF:[],MIL:[],ATT:[]};
  players.forEach(p=>{ if(byPos[p.poste]) byPos[p.poste].push(p); });
  let html='';
  for(const [pos,slots] of Object.entries(PITCH_POS)){
    const pp=byPos[pos]||[];
    slots.forEach((slot,i)=>{
      const p=pp[i]; if(!p) return;
      const ini=p.nom.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
      // Inline transitions — avoid .rv which conflicts with absolute positioning transform
      html+=`
        <div class="ppin" style="left:${slot.x}%;top:${slot.y}%;opacity:0;transition:opacity .5s ease ${.3+i*.05}s,transform .5s ease ${.3+i*.05}s;transform:translate(-50%,-50%) scale(.6)">
          ${p.photo
            ?`<img class="ppin-photo" src="${esc(p.photo)}" alt="${esc(ini)}" onerror="this.outerHTML='<div class=ppin-photo>${ini}</div>'">`
            :`<div class="ppin-photo">${ini}</div>`}
          <div class="ppin-name">${esc(p.nom.split(' ').pop())}</div>
          <div class="ppin-pts">${p.totalPts}pts</div>
        </div>`;
    });
  }
  return html;
}

function revealPins(el) {
  el.querySelectorAll('.ppin').forEach(p=>{
    p.style.opacity='1';
    p.style.transform='translate(-50%,-50%)';
  });
}

function pitchInner(pins) {
  return `<div class="p-mid"></div><div class="p-circ"></div><div class="p-dot"></div>
    <div class="p-box-t"></div><div class="p-box-b"></div>${pins}`;
}

function sCompare(d) {
  if(!d.winner) return null;
  const {players,spent}=d.bestTeam;
  if(!players.length) return null;

  const wPins = makePins(d.winnerPlayers);
  const bPins = makePins(players);

  // Pitch partagé inline: height-constrained, width auto via aspect-ratio
  const pitchStyle='height:100%;width:auto;max-width:100%;aspect-ratio:70/108;background:repeating-linear-gradient(180deg,#1d4d1d 0,#1d4d1d 26px,#214e21 26px,#214e21 52px);border:2px solid rgba(255,255,255,.45);border-radius:4px;position:relative';
  const wrapStyle='flex:1;min-height:0;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden';

  return {
    html:`
      <div style="display:flex;flex-direction:column;align-items:center;gap:clamp(6px,1.2vw,12px);width:100%;height:100%">
        <div class="t-eyebrow rv" data-d="0">🏆 Équipe championne vs Meilleure équipe théorique</div>
        <div style="display:flex;gap:clamp(10px,2vw,24px);width:100%;flex:1;min-height:0">

          <div class="rv" data-d=".15" style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:5px;height:100%">
            <div class="t-lg g-gold" style="font-size:clamp(.9rem,2.2vw,1.8rem);text-transform:none;letter-spacing:.01em;text-align:center">${esc(d.winner.nom)}</div>
            <div style="font-size:clamp(.5rem,1vw,.62rem);letter-spacing:.13em;text-transform:uppercase;color:rgba(238,242,255,.22)">Équipe du tournoi · ${d.winner.total} pts</div>
            <div style="${wrapStyle}" id="w-wrap">
              <div style="${pitchStyle}" id="w-pitch">${pitchInner(wPins)}</div>
            </div>
          </div>

          <div class="rv" data-d=".05" style="align-self:center;color:rgba(238,242,255,.15);font-weight:900;font-size:clamp(.8rem,2vw,1.6rem);flex-shrink:0">VS</div>

          <div class="rv" data-d=".25" style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:5px;height:100%">
            <div class="t-lg c-gold" style="font-size:clamp(.9rem,2.2vw,1.8rem);text-transform:none;letter-spacing:.01em;text-align:center">Meilleure équipe</div>
            <div style="font-size:clamp(.5rem,1vw,.62rem);letter-spacing:.13em;text-transform:uppercase;color:rgba(238,242,255,.22)">Budget 110M · ${spent}M utilisés</div>
            <div style="${wrapStyle}" id="b-wrap">
              <div style="${pitchStyle}" id="b-pitch">${pitchInner(bPins)}</div>
            </div>
          </div>

        </div>
      </div>`,
    onEnter(el){
      reveal(el, 80);
      setTimeout(()=>revealPins(el), 500);
    }
  };
}

function sPodium(rank, d) {
  const cfg={
    3:{col:BRONZE,grad:'g-bronze',medal:'🥉',label:'3ème place'},
    2:{col:SILVER,grad:'g-silver',medal:'🥈',label:'2ème place'},
    1:{col:GOLD,  grad:'g-gold',  medal:'🥇',label:'Champion'},
  }[rank];
  const e=d.ranking[rank-1]; if(!e) return null;
  const isChamp=rank===1;

  // Sous-texte pour le champion : montrer les 2e et 3e
  let sub='';
  if(isChamp&&d.ranking.length>1){
    sub=`<div class="rv" data-d="1.1" style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-top:8px">
      ${d.ranking.slice(1,3).map((eq,i)=>`
        <span class="pill" style="font-size:clamp(.6rem,1.2vw,.72rem)">
          ${i===0?'🥈':'🥉'} ${esc(eq.nom)} · ${eq.total} pts
        </span>`).join('')}
    </div>`;
  }

  return {
    html:`
      <div style="display:flex;flex-direction:column;align-items:center;gap:clamp(10px,2.2vw,22px)">
        <div class="t-eyebrow rv" data-d="0">${cfg.label}</div>
        <span class="podium-medal rv-scale" data-d=".12" id="podium-medal-${rank}">${cfg.medal}</span>
        <div class="podium-name ${cfg.grad} rv${isChamp?' champion-glow':''}" data-d=".45" style="text-transform:none">
          ${esc(e.nom)}
        </div>
        <div class="podium-pts rv" data-d=".75" style="color:${cfg.col}">
          <span id="cnt-pod">0</span>
          <span style="font-size:.55em;color:rgba(238,242,255,.35);margin-left:8px">pts</span>
        </div>
        ${sub}
      </div>`,
    onEnter(el){
      reveal(el,80);
      setTimeout(()=>animCount(el.querySelector('#cnt-pod'),e.total,1400,1),800);
      setTimeout(()=>{
        const m=el.querySelector('#podium-medal-'+rank);
        if(m){m.style.animation='none';void m.offsetHeight;m.style.animation='medalDrop .85s cubic-bezier(.34,1.56,.64,1) forwards';}
      },300);
      if(isChamp) setTimeout(window._startConfetti||function(){},1000);
    },
    onLeave(){ if(isChamp) window._stopConfetti?.(); }
  };
}

function sRaceChart(d) {
  if(!d.ranking || d.ranking.length < 2) return null;
  return {
    html:`
      <div style="display:flex;flex-direction:column;align-items:center;gap:clamp(6px,1.4vw,14px);width:100%;height:100%">
        <div class="t-eyebrow rv" data-d="0">📈 Évolution du classement</div>
        <canvas id="race-cvs" style="width:100%;flex:1;min-height:0;display:block"></canvas>
      </div>`,
    onEnter(el) {
      reveal(el, 80);
      setTimeout(() => drawRaceChart(el.querySelector('#race-cvs'), d), 250);
    }
  };
}

function drawRaceChart(canvas, d) {
  if(!canvas || !d.ranking.length) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if(!rect.width || !rect.height) return;

  canvas.width  = Math.round(rect.width  * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;

  // Fixtures triés chronologiquement
  const sortedFix = [...d.fixtures].sort((a,b) => new Date(a.date_heure)-new Date(b.date_heure));
  if(!sortedFix.length) return;
  const N = sortedFix.length;
  const equipes = d.ranking;

  // Séries cumulatives : pts[0]=0, pts[i]=cumul après match i
  const series = equipes.map(eq => {
    let cum = 0;
    const pts = [0, ...sortedFix.map(f => { cum += (d.ptsGrid[f.id]?.[eq.id]||0); return cum; })];
    return { eq, pts };
  });
  const maxPts = Math.max(...series.map(s => Math.max(...s.pts)), 1);

  const PAD = { top:18, right:Math.min(155, Math.round(W*0.21)), bottom:40, left:40 };
  const CW = W - PAD.left - PAD.right;
  const CH = H - PAD.top  - PAD.bottom;
  const xOf = i => (i / N) * CW;
  const yOf = v => CH - (v / maxPts) * CH;

  // Regrouper les rounds consécutifs de même nom abrégé
  function shortRound(r) {
    if(!r) return '';
    if(r.startsWith('Group Stage')) return 'Groupes';
    if(r === 'Round of 32')    return 'R32';
    if(r === 'Round of 16')    return '1/8';
    if(r === 'Quarter-finals') return 'QF';
    if(r === 'Semi-finals')    return 'SF';
    if(r === '3rd Place Final')return 'P3';
    if(r === 'Final')          return 'F';
    return r.slice(0,8);
  }
  const roundGroups = [];
  let prevShort = null;
  sortedFix.forEach((f, i) => {
    const s = shortRound(f.round);
    if(s !== prevShort) { roundGroups.push({short:s, start:i, end:i}); prevShort=s; }
    else roundGroups[roundGroups.length-1].end = i;
  });

  const PALETTE = [
    '#f5c842','#58c4dc','#a0e6a0','#ff9e4a','#d8a2e8',
    '#ff7878','#82c9f5','#d4e88c','#f0b5d0','#98d8b8',
    '#ffd3a0','#b0c4f0','#f0d880','#c0e0c0','#e8b8d8',
  ];

  const DURATION = 3200;
  let startTime = null, rafId = null;

  function draw(now) {
    if(!startTime) startTime = now;
    const p = Math.min((now - startTime) / DURATION, 1);
    const ease = 1 - Math.pow(1 - p, 2.8);
    const clipX = ease * CW;

    ctx.clearRect(0, 0, W, H);

    // Grille horizontale
    for(let g = 0; g <= 4; g++) {
      const vy = g / 4;
      const py = PAD.top + CH * vy;
      ctx.strokeStyle = 'rgba(238,242,255,0.055)';
      ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(PAD.left, py); ctx.lineTo(PAD.left + CW, py); ctx.stroke();
      ctx.fillStyle = 'rgba(238,242,255,0.2)';
      ctx.font = `${Math.round(Math.max(9, Math.min(11, W/90)))}px system-ui`;
      ctx.textAlign = 'right';
      ctx.fillText(Math.round((1-vy)*maxPts), PAD.left-6, py+4);
    }

    // Séparateurs + labels de rounds
    const drawnShorts = new Set();
    roundGroups.forEach(({short, start, end}) => {
      const midI  = (start + end) / 2 + 0.5; // +0.5 pour être dans la plage [start+1..end+1]
      const midX  = xOf(midI);
      const divX  = xOf(end + 1);
      const label = short;

      if(!drawnShorts.has(label) && midX <= clipX) {
        drawnShorts.add(label);
        ctx.fillStyle = 'rgba(238,242,255,0.2)';
        ctx.font = `${Math.round(Math.max(8, Math.min(10, W/100)))}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(label, PAD.left + midX, PAD.top + CH + 24);
      }
      if(end < N-1 && divX <= clipX) {
        ctx.strokeStyle = 'rgba(238,242,255,0.08)';
        ctx.lineWidth = 1; ctx.setLineDash([3,3]);
        ctx.beginPath();
        ctx.moveTo(PAD.left + divX, PAD.top);
        ctx.lineTo(PAD.left + divX, PAD.top + CH);
        ctx.stroke(); ctx.setLineDash([]);
      }
    });

    // Lignes (clippées)
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD.left - 1, PAD.top - 6, clipX + 2, CH + 12);
    ctx.clip();
    series.forEach((s, si) => {
      const col = PALETTE[si % PALETTE.length];
      ctx.strokeStyle = col;
      ctx.lineWidth = si === 0 ? 3 : 1.8;
      ctx.globalAlpha = si === 0 ? 1 : 0.65;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      s.pts.forEach((v, i) => {
        const px = PAD.left + xOf(i), py = PAD.top + yOf(v);
        i === 0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
      });
      ctx.stroke(); ctx.globalAlpha = 1;
    });
    ctx.restore();

    // Points live en bout de ligne
    series.forEach((s, si) => {
      const col = PALETTE[si % PALETTE.length];
      let dotY = PAD.top + yOf(s.pts[0]);
      for(let i = 1; i <= N; i++) {
        const x0 = xOf(i-1), x1 = xOf(i);
        if(clipX <= x1 || i === N) {
          const t = x1 > x0 ? Math.min((clipX - x0) / (x1 - x0), 1) : 1;
          const v = s.pts[i-1] + t * (s.pts[i] - s.pts[i-1]);
          dotY = PAD.top + yOf(Math.max(0, v));
          break;
        }
      }
      ctx.fillStyle = col;
      ctx.globalAlpha = si === 0 ? 1 : 0.75;
      ctx.beginPath(); ctx.arc(PAD.left + Math.min(clipX, CW), dotY, si===0?5:3.5, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Labels finaux une fois l'animation terminée
    if(p >= 1) {
      const labelH = Math.max(12, Math.min(15, H/26));
      const sortedForLabel = [...series].map((s,i) => ({
        s, i, final: s.pts[N], col: PALETTE[i % PALETTE.length]
      })).sort((a,b) => b.final - a.final);

      const usedY = [];
      sortedForLabel.forEach(({s, i, final, col}) => {
        const rawY = PAD.top + yOf(final);
        let ly = rawY;
        for(const uy of usedY) {
          if(Math.abs(ly - uy) < labelH + 3) ly = uy + labelH + 3;
        }
        usedY.push(ly);
        const lx = PAD.left + CW + 9;

        // Dot final
        ctx.fillStyle = col;
        ctx.globalAlpha = i===0?1:0.75;
        ctx.beginPath(); ctx.arc(PAD.left+CW, rawY, i===0?5:3.5, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;

        // Connecteur
        if(Math.abs(ly - rawY) > 7) {
          ctx.strokeStyle = col; ctx.globalAlpha = 0.3; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(PAD.left+CW+5, rawY); ctx.lineTo(lx+1, ly+2); ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Nom
        const fs = Math.round(Math.max(9, Math.min(12, W/84)));
        ctx.font = `bold ${fs}px system-ui`; ctx.textAlign = 'left';
        ctx.fillStyle = col;
        const name = s.eq.nom.length > 13 ? s.eq.nom.slice(0,11)+'…' : s.eq.nom;
        ctx.fillText(name, lx, ly + 3);

        // Points
        ctx.font = `${Math.round(Math.max(8, Math.min(10, W/100)))}px system-ui`;
        ctx.fillStyle = 'rgba(238,242,255,0.32)';
        ctx.fillText(Math.round(final*10)/10+'pts', lx, ly + 3 + fs + 1);
      });
    }

    if(p < 1) rafId = requestAnimationFrame(draw);
  }

  rafId = requestAnimationFrame(draw);
}

// ─────────────────────────────────────────────────────────────
// Moteur de slides
// ─────────────────────────────────────────────────────────────
let slides=[], curr=0, busy=false;

function buildSlides(d) {
  const defs=[
    sIntro(d),
    sMerci(d),
    sChiffres(d),
    sRaceChart(d),
    d.topScore ? sTopScorer(d) : null,
    sTopPerf(d),
    d.bestF ? sBestMatch(d) : null,
    d.ranking[2] ? sPodium(3,d) : null,
    d.ranking[1] ? sPodium(2,d) : null,
    d.ranking[0] ? sPodium(1,d) : null,
    sCompare(d),
  ].filter(Boolean);

  const wrap=document.getElementById('slides-wrap');
  const dotsEl=document.getElementById('dots');

  defs.forEach((def,i)=>{
    const el=document.createElement('div');
    el.className='pslide';
    el.innerHTML=def.html;
    wrap.appendChild(el);
    slides.push({def,el});

    const dot=document.createElement('div');
    dot.className='dot'; dot.onclick=()=>goTo(i);
    dotsEl.appendChild(dot);
  });

  // Activer le premier slide
  slides[0].el.style.transform='translateX(0)';
  slides[0].el.style.opacity='1';
  slides[0].def.onEnter(slides[0].el);
  updateUI();
}

function goTo(idx) {
  if(busy||idx===curr||idx<0||idx>=slides.length) return;
  busy=true;
  const fwd=idx>curr;
  const from=slides[curr], to=slides[idx];

  from.def.onLeave?.(from.el);

  // Positionner le slide entrant sans animation
  to.el.style.transition='none';
  to.el.style.transform=`translateX(${fwd?'100%':'-100%'})`;
  to.el.style.opacity='0';
  to.el.offsetHeight; // reflow

  to.el.style.transition='';
  from.el.style.transform=`translateX(${fwd?'-100%':'100%'})`;
  from.el.style.opacity='0';
  to.el.style.transform='translateX(0)';
  to.el.style.opacity='1';

  curr=idx; updateUI();

  setTimeout(()=>{
    from.el.style.transition='none';
    from.el.style.transform='translateX(100%)';
    busy=false;
    slides[curr].def.onEnter(slides[curr].el);
  }, 720);
}

function nextSlide(){ goTo(curr+1); }
function prevSlide(){ goTo(curr-1); }

function updateUI() {
  document.getElementById('slide-counter').textContent=`${curr+1} / ${slides.length}`;
  document.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('active',i===curr));
  document.querySelector('#nav-wrap button:first-child').style.opacity=curr===0?.3:1;
  document.querySelector('#nav-wrap button:last-child').style.opacity=curr===slides.length-1?.3:1;
}

// ─────────────────────────────────────────────────────────────
// Navigation clavier + swipe
// ─────────────────────────────────────────────────────────────
function initNav() {
  document.addEventListener('keydown',e=>{
    if(['ArrowRight','ArrowDown',' '].includes(e.key)){ e.preventDefault(); nextSlide(); }
    if(['ArrowLeft','ArrowUp'].includes(e.key)){ e.preventDefault(); prevSlide(); }
  });
  let tx=0;
  document.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;},{passive:true});
  document.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-tx;
    if(Math.abs(dx)>48){ dx<0?nextSlide():prevSlide(); }
  },{passive:true});
}

// ─────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────
async function init() {
  initStarfield();
  initConfetti();
  initNav();
  try {
    const raw=await loadData();
    const d=process(raw);
    buildSlides(d);
    const loader=document.getElementById('loading');
    loader.style.opacity='0';
    setTimeout(()=>loader.style.display='none',600);
  } catch(e) {
    const loader=document.getElementById('loading');
    loader.innerHTML=`
      <div style="font-size:1.5rem">⚠️</div>
      <div style="color:#e4a93c;font-weight:600">Erreur de chargement</div>
      <div style="color:rgba(238,242,255,.4);font-size:.8rem;max-width:320px;line-height:1.5">${esc(e.message)}</div>`;
  }
}

init();
