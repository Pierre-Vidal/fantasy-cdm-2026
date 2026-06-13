// netlify/functions/sync.js
// Scheduled function: syncs API-Football data to Supabase every hour.
// Env vars required: API_FOOTBALL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

const LEAGUE_ID = 1;
const SAISON    = 2026;
const API_BASE  = 'https://v3.football.api-sports.io';
const MAX_NEW_FIXTURES_PER_RUN = 5; // max 5 new matches per run to stay within quota

const BAREME = {
  GAR: { moins60: 1, min60: 2, but: 6, passe: 3, cleanSheet: 4, arrets3: 1, penArrete:  5, penManque: -2, butEnc2: -1, jaune: -1, rouge: -3, csc: -2 },
  DEF: { moins60: 1, min60: 2, but: 6, passe: 3, cleanSheet: 4, arrets3: 0, penArrete:  0, penManque: -2, butEnc2: -1, jaune: -1, rouge: -3, csc: -2 },
  MIL: { moins60: 1, min60: 2, but: 5, passe: 3, cleanSheet: 1, arrets3: 0, penArrete:  0, penManque: -2, butEnc2:  0, jaune: -1, rouge: -3, csc: -2 },
  ATT: { moins60: 1, min60: 2, but: 4, passe: 3, cleanSheet: 0, arrets3: 0, penArrete:  0, penManque: -2, butEnc2:  0, jaune: -1, rouge: -3, csc: -2 },
};

const MAP_POSTE = {
  Goalkeeper: 'GAR',
  Defender:   'DEF',
  Midfielder: 'MIL',
  Attacker:   'ATT',
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

async function sbInsert(table, rows) {
  if (!rows.length) return;
  const res = await fetch(sbUrl(table), {
    method: 'POST',
    headers: { ...sbHeaders(), 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`sbInsert ${table}: ${res.status} ${txt.substring(0, 300)}`);
  }
}

async function sbSelect(table, select, filter, limit = 5000) {
  let url = sbUrl(`${table}?select=${select}&limit=${limit}`);
  if (filter) url += '&' + filter;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`sbSelect ${table}: ${res.status}`);
  return res.json();
}

// ── Calcul des points ─────────────────────────────────────────
function calculerPoints(poste, stats) {
  const b     = BAREME[poste] || BAREME.MIL;
  let total   = 0;
  const detail = {};
  const add = (k, v) => { if (v !== 0) { detail[k] = v; total += v; } };

  if (stats.minutes >= 60)        add('Temps (>=60)',    b.min60);
  else if (stats.minutes > 0)     add('Temps (<60)',     b.moins60);

  if (stats.buts > 0)             add(`Buts ×${stats.buts}`,   b.but * stats.buts);
  if (stats.passes > 0)           add(`Passes ×${stats.passes}`, b.passe * stats.passes);
  if (stats.clean_sheet)          add('Clean sheet',     b.cleanSheet);

  if (poste === 'GAR' && stats.arrets >= 3) {
    const t = Math.floor(stats.arrets / 3);
    add(`Arrêts ×${t}`, b.arrets3 * t);
  }

  if (stats.pen_arrete)           add('Penalty arrêté',  b.penArrete);
  if (stats.pen_manque)           add('Penalty manqué',  b.penManque);

  if (stats.buts_encaisses >= 2) {
    const t = Math.floor(stats.buts_encaisses / 2);
    add(`Buts enc. ×${t}`, b.butEnc2 * t);
  }

  if (stats.jaune)                add('Carton jaune',    b.jaune);
  if (stats.rouge)                add('Carton rouge',    b.rouge);
  if (stats.csc > 0)              add(`CSC ×${stats.csc}`, b.csc * stats.csc);

  return { points: total, detail };
}

// ── Handler principal ─────────────────────────────────────────
exports.handler = async function () {
  if (!process.env.API_FOOTBALL_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('Missing env vars');
    return { statusCode: 500, body: 'Missing env vars: API_FOOTBALL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY' };
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

    // ── Étape 2 : Trouver les nouveaux matchs terminés ────────
    const ftFixtures    = fixtures.filter(f => f.fixture.status?.short === 'FT');
    const existingStats = await sbSelect('stats', 'fixture_id');
    const doneIds       = new Set(existingStats.map(s => s.fixture_id));
    const toProcess     = ftFixtures
      .filter(f => !doneIds.has(f.fixture.id))
      .slice(0, MAX_NEW_FIXTURES_PER_RUN);

    log.push(`Nouveaux matchs FT : ${toProcess.length}`);

    if (toProcess.length === 0) {
      console.log('Nothing to process.');
      return { statusCode: 200, body: log.join('\n') };
    }

    // ── Étape 3 : Stats + points par match ───────────────────
    // Charge les IDs valides : seuls les joueurs du fantasy pool ont une FK dans stats
    const joueurRows    = await sbSelect('joueurs', 'id', null, 2000);
    const joueurIds     = new Set(joueurRows.map(j => j.id));
    const equipeJoueurs = await sbSelect('equipe_joueurs', 'equipe_id,joueur_id');

    for (const fixture of toProcess) {
      const fid = fixture.fixture.id;
      console.log(`Processing fixture ${fid}...`);

      try {
        const playerData = await apiGet('/fixtures/players', { fixture: fid });

        const statsRows = [];
        const posteMap  = {}; // joueur_id → poste (pour le calcul des points)

        playerData.forEach(teamEntry => {
          (teamEntry.players || []).forEach(entry => {
            const p = entry.player;
            const s = entry.statistics?.[0];
            if (!s || !p?.id) return;

            const minutes       = s.games?.minutes       || 0;
            const poste         = MAP_POSTE[s.games?.position] || 'MIL';
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

            posteMap[p.id] = poste;
            statsRows.push({
              fixture_id:     fid,
              joueur_id:      p.id,
              minutes,
              buts,
              passes,
              clean_sheet:    cleanSheet,
              arrets,
              pen_arrete:     penArrete > 0,
              pen_manque:     penManque > 0,
              buts_encaisses: butsEncaisses,
              jaune:          jaune > 0,
              rouge:          rouge > 0,
              csc,
            });
          });
        });

        // Filtre les joueurs absents de la table joueurs (FK constraint)
        const filteredStats = statsRows.filter(s => joueurIds.has(s.joueur_id));
        await sbInsert('stats', filteredStats);

        // Points : croise stats filtrées × equipe_joueurs
        const pointsRows = [];
        filteredStats.forEach(stat => {
          const poste = posteMap[stat.joueur_id] || 'MIL';
          const { points, detail } = calculerPoints(poste, stat);

          equipeJoueurs
            .filter(ej => ej.joueur_id === stat.joueur_id)
            .forEach(ej => {
              pointsRows.push({
                equipe_id:  ej.equipe_id,
                fixture_id: fid,
                joueur_id:  stat.joueur_id,
                points,
                detail:     JSON.stringify(detail),
              });
            });
        });

        await sbUpsert('points', pointsRows, 'equipe_id,fixture_id,joueur_id');
        log.push(`Match ${fid} : ${statsRows.length} stats, ${pointsRows.length} points ✓`);

      } catch (e) {
        console.error(`Fixture ${fid} error:`, e.message);
        log.push(`Match ${fid} : ERREUR ${e.message}`);
      }
    }

    console.log('Sync done:', log.join(' | '));
    return { statusCode: 200, body: log.join('\n') };

  } catch (e) {
    console.error('Sync failed:', e);
    return { statusCode: 500, body: e.message };
  }
};
