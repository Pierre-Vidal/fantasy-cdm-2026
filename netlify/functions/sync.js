// netlify/functions/sync.js
// Scheduled function: syncs API-Football data to Supabase every hour.
// Env vars required: API_FOOTBALL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

const LEAGUE_ID = 1;
const SAISON    = 2026;
const API_BASE  = 'https://v3.football.api-sports.io';
const MAX_NEW_FIXTURES_PER_RUN = 5;

const BAREME = {
  GAR: { moins60: 1, min60: 2, but: 6, passe: 3, cleanSheet: 4, arrets3: 1, penArrete:  5, penManque: -2, butEnc2: -1, jaune: -1, rouge: -3, csc: -2 },
  DEF: { moins60: 1, min60: 2, but: 6, passe: 3, cleanSheet: 4, arrets3: 0, penArrete:  0, penManque: -2, butEnc2: -1, jaune: -1, rouge: -3, csc: -2 },
  MIL: { moins60: 1, min60: 2, but: 5, passe: 3, cleanSheet: 1, arrets3: 0, penArrete:  0, penManque: -2, butEnc2:  0, jaune: -1, rouge: -3, csc: -2 },
  ATT: { moins60: 1, min60: 2, but: 4, passe: 3, cleanSheet: 0, arrets3: 0, penArrete:  0, penManque: -2, butEnc2:  0, jaune: -1, rouge: -3, csc: -2 },
};

// L'API renvoie tantôt le nom complet, tantôt l'abréviation à une lettre
// selon les matchs — on couvre les deux formats.
const MAP_POSTE = {
  Goalkeeper: 'GAR', G: 'GAR',
  Defender:   'DEF', D: 'DEF',
  Midfielder: 'MIL', M: 'MIL',
  Attacker:   'ATT', F: 'ATT',
};

// ── API-Football ──────────────────────────────────────────────
async function apiGet(endpoint, params) {
  const qs  = new URLSearchParams(params).toString();
  const url = `${API_BASE}${endpoint}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY },
  });
  if (!res.ok) throw new Error(`API ${endpoint} → ${res.status}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error('API error: ' + JSON.stringify(json.errors));
  }
  return json.response || [];
}

// ── Supabase helpers ──────────────────────────────────────────
function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  return {
    'apikey':        key,
    'Authorization': 'Bearer ' + key,
    'Content-Type':  'application/json',
  };
}

function sbUrl(path) {
  return process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path;
}

async function sbUpsert(table, rows, onConflict) {
  if (!rows.length) return;
  const url = sbUrl(table + (onConflict ? '?on_conflict=' + onConflict : ''));
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...sbHeaders(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`sbUpsert ${table}: ${res.status} ${txt.substring(0, 300)}`);
  }
}

// PostgREST plafonne chaque requête à 1000 lignes côté serveur, quel que soit
// le `limit` demandé — on pagine donc avec Range jusqu'à épuisement des lignes.
async function sbSelect(table, select, filter) {
  let url = sbUrl(`${table}?select=${select}`);
  if (filter) url += '&' + filter;

  const all  = [];
  const size = 1000;
  let page   = 0;
  while (true) {
    const from = page * size, to = from + size - 1;
    const res  = await fetch(url, { headers: { ...sbHeaders(), 'Range': `${from}-${to}` } });
    if (!res.ok && res.status !== 206) throw new Error(`sbSelect ${table}: ${res.status}`);
    const rows = await res.json();
    all.push(...rows);
    if (rows.length < size) break;
    page++;
  }
  return all;
}

async function sbUpdate(table, filter, patch) {
  const url = sbUrl(`${table}?${filter}`);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`sbUpdate ${table}: ${res.status} ${txt.substring(0, 300)}`);
  }
}

// ── Nations éliminées (mêmes règles que le front, côté serveur) ─
function computeEliminatedNations(fixtures) {
  const eliminated = new Set();

  // 1. Perdants des matchs à élimination directe déjà joués
  fixtures.forEach(f => {
    if (!f.round || f.round.toLowerCase().includes('group')) return;
    const played = ['FT', 'AET', 'PEN'].includes(f.status);
    if (!played) return;
    let loser = null;
    if (f.home_winner === true)       loser = f.away_name;
    else if (f.away_winner === true)  loser = f.home_name;
    else if (f.home_goals != null && f.away_goals != null) {
      if (f.home_goals > f.away_goals)      loser = f.away_name;
      else if (f.away_goals > f.home_goals) loser = f.home_name;
    }
    if (loser) eliminated.add(loser);
  });

  // 2. 4e de poule dans les groupes terminés
  const groupMap = {};
  fixtures.filter(f => f.round?.toLowerCase().includes('group')).forEach(f => {
    const played = ['FT', 'AET', 'PEN'].includes(f.status);
    if (!played || !f.home_name || !f.away_name || f.home_goals == null || f.away_goals == null) return;
    const g = f.round;
    if (!groupMap[g]) groupMap[g] = {};
    if (!groupMap[g][f.home_name]) groupMap[g][f.home_name] = { j: 0, pts: 0, bp: 0, bc: 0 };
    if (!groupMap[g][f.away_name]) groupMap[g][f.away_name] = { j: 0, pts: 0, bp: 0, bc: 0 };
    const h = groupMap[g][f.home_name], a = groupMap[g][f.away_name];
    h.j++; a.j++;
    h.bp += f.home_goals; h.bc += f.away_goals;
    a.bp += f.away_goals; a.bc += f.home_goals;
    if (f.home_goals > f.away_goals)      { h.pts += 3; }
    else if (f.away_goals > f.home_goals) { a.pts += 3; }
    else                                   { h.pts += 1; a.pts += 1; }
  });
  Object.values(groupMap).forEach(teams => {
    const list = Object.entries(teams);
    if (list.length < 4 || list.some(([, t]) => t.j < 3)) return; // groupe incomplet
    list.sort(([, a], [, b]) =>
      b.pts - a.pts || (b.bp - b.bc) - (a.bp - a.bc) || b.bp - a.bp
    );
    if (list[3]) eliminated.add(list[3][0]);
  });

  return eliminated;
}

// ── Calcul des points ─────────────────────────────────────────
function calculerPoints(poste, stats) {
  const b      = BAREME[poste] || BAREME.MIL;
  let total    = 0;
  const detail = {};
  const add    = (k, v) => { if (v !== 0) { detail[k] = v; total += v; } };

  if (stats.minutes >= 60)        add('Temps (>=60)',      b.min60);
  else if (stats.minutes > 0)     add('Temps (<60)',       b.moins60);

  if (stats.buts > 0)             add(`Buts ×${stats.buts}`,     b.but * stats.buts);
  if (stats.passes > 0)           add(`Passes ×${stats.passes}`, b.passe * stats.passes);
  if (stats.clean_sheet)          add('Clean sheet',       b.cleanSheet);

  if (poste === 'GAR' && stats.arrets >= 3) {
    const t = Math.floor(stats.arrets / 3);
    add(`Arrêts ×${t}`, b.arrets3 * t);
  }

  if (stats.pen_arrete)           add('Penalty arrêté',   b.penArrete);
  if (stats.pen_manque)           add('Penalty manqué',   b.penManque);

  if (stats.buts_encaisses >= 2) {
    const t = Math.floor(stats.buts_encaisses / 2);
    add(`Buts enc. ×${t}`, b.butEnc2 * t);
  }

  if (stats.jaune)                add('Carton jaune',     b.jaune);
  if (stats.rouge)                add('Carton rouge',     b.rouge);
  if (stats.csc > 0)              add(`CSC ×${stats.csc}`,  b.csc * stats.csc);

  return { points: total, detail };
}

// ── Handler principal ─────────────────────────────────────────
exports.handler = async function () {
  if (!process.env.API_FOOTBALL_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('Missing env vars');
    return { statusCode: 500, body: 'Missing env vars' };
  }

  const log = [];

  try {
    // ── Étape 1 : Fixtures ────────────────────────────────────
    console.log('Step 1: fixtures...');
    const fixtures = await apiGet('/fixtures', { league: LEAGUE_ID, season: SAISON });

    const fixtureRows = fixtures.map(f => ({
      id:          f.fixture.id,
      round:       f.league.round || '',
      date_heure:  f.fixture.date  || null,
      home_name:   f.teams.home.name  || '',
      away_name:   f.teams.away.name  || '',
      home_goals:  f.goals?.home  ?? null,
      away_goals:  f.goals?.away  ?? null,
      status:      f.fixture.status?.short || 'NS',
      home_logo:   f.teams.home.logo  || '',
      away_logo:   f.teams.away.logo  || '',
      home_winner: f.teams.home.winner ?? null,
      away_winner: f.teams.away.winner ?? null,
    }));

    await sbUpsert('fixtures', fixtureRows);
    log.push(`Fixtures : ${fixtureRows.length} ✓`);

    // ── Étape 2 : Nouvelles stats depuis l'API ────────────────
    // On ne fait des appels API que pour les matchs pas encore en DB
    const ftFixtures    = fixtures.filter(f => f.fixture.status?.short === 'FT');
    const existingStats = await sbSelect('stats', 'fixture_id');
    const doneIds       = new Set(existingStats.map(s => s.fixture_id));
    const toProcess     = ftFixtures
      .filter(f => !doneIds.has(f.fixture.id))
      .slice(0, MAX_NEW_FIXTURES_PER_RUN);

    log.push(`Nouveaux matchs FT : ${toProcess.length}`);

    if (toProcess.length > 0) {
      const joueurRows = await sbSelect('joueurs', 'id,poste');
      const posteById   = new Map(joueurRows.map(j => [j.id, j.poste]));

      for (const fixture of toProcess) {
        const fid = fixture.fixture.id;
        console.log(`Processing fixture ${fid}...`);
        try {
          const playerData = await apiGet('/fixtures/players', { fixture: fid });
          const statsRows  = [];

          playerData.forEach(teamEntry => {
            (teamEntry.players || []).forEach(entry => {
              const p = entry.player;
              const s = entry.statistics?.[0];
              if (!s || !p?.id) return;
              if (!posteById.has(p.id)) return; // FK guard

              const minutes       = s.games?.minutes       || 0;
              // Le poste stocké en base (importé une fois, fiable) prime sur celui de
              // l'API — qui alterne entre nom complet et abréviation selon les matchs.
              const poste         = posteById.get(p.id) || MAP_POSTE[s.games?.position] || 'MIL';
              const buts          = s.goals?.total          || 0;
              const passes        = s.goals?.assists        || 0;
              const arrets        = s.goalkeeper?.saves     || 0;
              const penArrete     = s.penalty?.saved        || 0;
              const penManque     = s.penalty?.missed       || 0;
              const butsEncaisses = s.goals?.conceded       || 0;
              const jaune         = s.cards?.yellow         || 0;
              const rouge         = s.cards?.red            || 0;
              const csc           = s.goals?.owngoals       || 0;
              const cleanSheet    = butsEncaisses === 0 && minutes >= 60 && (poste === 'GAR' || poste === 'DEF');

              statsRows.push({
                fixture_id:     fid,
                joueur_id:      p.id,
                minutes,        buts,           passes,
                clean_sheet:    cleanSheet,     arrets,
                pen_arrete:     penArrete > 0,  pen_manque: penManque > 0,
                buts_encaisses: butsEncaisses,  jaune: jaune > 0,
                rouge:          rouge > 0,      csc,
              });
            });
          });

          await sbUpsert('stats', statsRows, 'fixture_id,joueur_id');
          log.push(`Stats match ${fid} : ${statsRows.length} ✓`);
        } catch (e) {
          console.error(`Fixture ${fid} error:`, e.message);
          log.push(`Stats match ${fid} : ERREUR ${e.message}`);
        }
      }
    }

    // ── Étape 3 : Recalcul de TOUS les points ────────────────
    // Toujours recalculé → les équipes créées après des matchs joués
    // récupèrent automatiquement les points des matchs passés.
    console.log('Step 3: recalculating all points...');

    // Stats avec le poste du joueur (join joueurs)
    const allStats      = await sbSelect('stats', 'fixture_id,joueur_id,minutes,buts,passes,clean_sheet,arrets,pen_arrete,pen_manque,buts_encaisses,jaune,rouge,csc,joueurs(poste)');
    const equipeJoueurs = await sbSelect('equipe_joueurs', 'equipe_id,joueur_id');

    if (equipeJoueurs.length === 0 || allStats.length === 0) {
      log.push('Points : rien à calculer (pas d\'équipes ou de stats)');
    } else {
      // Index equipe_joueurs par joueur_id pour perf
      const ejByJoueur = {};
      equipeJoueurs.forEach(ej => {
        if (!ejByJoueur[ej.joueur_id]) ejByJoueur[ej.joueur_id] = [];
        ejByJoueur[ej.joueur_id].push(ej.equipe_id);
      });

      const pointsRows = [];
      allStats.forEach(stat => {
        const poste   = stat.joueurs?.poste || 'MIL';
        const equipes = ejByJoueur[stat.joueur_id] || [];
        if (equipes.length === 0) return;

        const { points, detail } = calculerPoints(poste, stat);
        equipes.forEach(equipeId => {
          pointsRows.push({
            equipe_id:  equipeId,
            fixture_id: stat.fixture_id,
            joueur_id:  stat.joueur_id,
            points,
            detail:     JSON.stringify(detail),
          });
        });
      });

      // Upsert par chunks de 500
      for (let i = 0; i < pointsRows.length; i += 500) {
        await sbUpsert('points', pointsRows.slice(i, i + 500), 'equipe_id,fixture_id,joueur_id');
      }
      log.push(`Points : ${pointsRows.length} recalculés ✓`);
    }

    // ── Étape 4 : Marquer les joueurs des nations éliminées ──
    console.log('Step 4: updating eliminated players...');
    const eliminatedNations = computeEliminatedNations(fixtureRows);
    log.push(`Nations éliminées : ${eliminatedNations.size ? [...eliminatedNations].join(', ') : 'aucune'}`);

    const allJoueurs = await sbSelect('joueurs', 'id,nation,actif');
    const toDeactivate = allJoueurs.filter(j => eliminatedNations.has(j.nation) && j.actif !== false).map(j => j.id);
    const toReactivate = allJoueurs.filter(j => !eliminatedNations.has(j.nation) && j.actif === false).map(j => j.id);

    if (toDeactivate.length > 0) {
      await sbUpdate('joueurs', `id=in.(${toDeactivate.join(',')})`, { actif: false });
    }
    if (toReactivate.length > 0) {
      await sbUpdate('joueurs', `id=in.(${toReactivate.join(',')})`, { actif: true });
    }
    log.push(`Joueurs désactivés : ${toDeactivate.length}, réactivés : ${toReactivate.length}`);

    console.log('Sync done:', log.join(' | '));
    return { statusCode: 200, body: log.join('\n') };

  } catch (e) {
    console.error('Sync failed:', e);
    return { statusCode: 500, body: e.message };
  }
};
