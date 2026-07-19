// netlify/functions/admin-action.js
// Actions admin protégées par mot de passe simple (ADMIN_PASSWORD env var)

const API_BASE = 'https://v3.football.api-sports.io';
const MAP_POSTE = {
  Goalkeeper: 'GAR', G: 'GAR',
  Defender:   'DEF', D: 'DEF',
  Midfielder: 'MIL', M: 'MIL',
  Attacker:   'ATT', F: 'ATT',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'JSON invalide' }) }; }

  const { action, password, params } = body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Mot de passe incorrect' }) };
  }

  const supa = process.env.SUPABASE_URL.replace(/\/$/, '');
  const key  = process.env.SUPABASE_SERVICE_KEY;
  const h    = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
  const hRet = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

  async function sbGet(table, select, filter) {
    let url = `${supa}/rest/v1/${table}?select=${select}`;
    if (filter) url += '&' + filter;
    const all = []; const size = 1000; let page = 0;
    while (true) {
      const from = page * size, to = from + size - 1;
      const res = await fetch(url, { headers: { ...h, 'Range': `${from}-${to}` } });
      if (!res.ok && res.status !== 206) throw new Error(`sbGet ${table}: ${res.status} ${(await res.text()).substring(0,200)}`);
      const rows = await res.json();
      all.push(...rows);
      if (rows.length < size) break;
      page++;
    }
    return all;
  }

  async function sbUpsert(table, rows, onConflict) {
    if (!rows.length) return;
    const url = `${supa}/rest/v1/${table}${onConflict ? '?on_conflict=' + onConflict : ''}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...h, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`sbUpsert ${table}: ${res.status} ${(await res.text()).substring(0,200)}`);
  }

  async function sbPatch(table, filter, patch) {
    const res = await fetch(`${supa}/rest/v1/${table}?${filter}`, {
      method: 'PATCH', headers: h, body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`sbPatch ${table}: ${res.status} ${(await res.text()).substring(0,200)}`);
  }

  async function sbDelete(table, filter) {
    const res = await fetch(`${supa}/rest/v1/${table}?${filter}`, { method: 'DELETE', headers: h });
    if (!res.ok) throw new Error(`sbDelete ${table}: ${res.status} ${(await res.text()).substring(0,200)}`);
  }

  async function sbInsert(table, rows) {
    if (!rows.length) return;
    const res = await fetch(`${supa}/rest/v1/${table}`, {
      method: 'POST', headers: h, body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`sbInsert ${table}: ${res.status} ${(await res.text()).substring(0,200)}`);
  }

  async function apiGet(endpoint, params) {
    const qs  = new URLSearchParams(params).toString();
    const url = `${API_BASE}${endpoint}${qs ? '?' + qs : ''}`;
    const res = await fetch(url, { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY } });
    if (!res.ok) throw new Error(`API ${endpoint} → ${res.status}`);
    const json = await res.json();
    if (json.errors && Object.keys(json.errors).length > 0) throw new Error('API error: ' + JSON.stringify(json.errors));
    return json.response || [];
  }

  function getBareme(raw) {
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  }

  function calculerPoints(poste, stats, bareme) {
    const b = bareme[poste] || bareme['MIL'];
    let total = 0; const detail = {};
    const add = (k, v) => { if (v !== 0) { detail[k] = v; total += v; } };
    if (stats.minutes >= 60)        add('Temps (>=60)', b.min60);
    else if (stats.minutes > 0)     add('Temps (<60)',  b.moins60);
    if (stats.buts > 0)             add(`Buts ×${stats.buts}`,     b.but * stats.buts);
    if (stats.passes > 0)           add(`Passes ×${stats.passes}`, b.passe * stats.passes);
    if (stats.clean_sheet)          add('Clean sheet',   b.cleanSheet);
    if (poste === 'GAR' && stats.arrets >= 3) {
      const t = Math.floor(stats.arrets / 3);
      add(`Arrêts ×${t}`, b.arrets3 * t);
    }
    if (stats.pen_arrete)           add('Penalty arrêté', b.penArrete);
    if (stats.pen_manque)           add('Penalty manqué', b.penManque);
    if (stats.buts_encaisses >= 2) {
      const t = Math.floor(stats.buts_encaisses / 2);
      add(`Buts enc. ×${t}`, b.butEnc2 * t);
    }
    if (stats.jaune)                add('Carton jaune', b.jaune);
    if (stats.rouge)                add('Carton rouge', b.rouge);
    if (stats.csc > 0)              add(`CSC ×${stats.csc}`, b.csc * stats.csc);
    return { points: total, detail };
  }

  try {

    // ── Liste toutes les équipes ──────────────────────────────
    if (action === 'list_equipes') {
      const equipes = await sbGet('equipes', 'id,nom,officiel,created_at', 'order=created_at');
      return ok({ equipes });
    }

    // ── Supprime une équipe (CASCADE → equipe_joueurs + points) ──
    if (action === 'delete_equipe') {
      const { equipe_id } = params || {};
      if (!equipe_id) return err('equipe_id manquant');
      await sbDelete('equipes', `id=eq.${equipe_id}`);
      return ok({ deleted: equipe_id });
    }

    // ── Toggle officiel ───────────────────────────────────────
    if (action === 'toggle_officiel') {
      const { equipe_id, officiel } = params || {};
      if (!equipe_id) return err('equipe_id manquant');
      await sbPatch('equipes', `id=eq.${equipe_id}`, { officiel: !!officiel });
      return ok({ equipe_id, officiel: !!officiel });
    }

    // ── Renommer une équipe ───────────────────────────────────
    if (action === 'rename_equipe') {
      const { equipe_id, nom } = params || {};
      if (!equipe_id || !nom) return err('equipe_id ou nom manquant');
      await sbPatch('equipes', `id=eq.${equipe_id}`, { nom });
      return ok({ equipe_id, nom });
    }

    // ── Sauvegarder le barème ─────────────────────────────────
    if (action === 'save_bareme') {
      const { bareme } = params || {};
      if (!bareme) return err('bareme manquant');
      await sbPatch('config', 'key=eq.bareme', { value: JSON.stringify(bareme) });
      return ok({ saved: true });
    }

    // ── Récupérer les multiplicateurs ─────────────────────────
    if (action === 'get_multiplicateurs') {
      const rows = await sbGet('config', 'value', 'key=eq.multiplicateurs');
      const raw  = rows[0]?.value;
      let multiplicateurs = { active: false, rounds: { final: 3, semi: 2.5, quarter: 2, r16: 1.5 } };
      if (raw) try { multiplicateurs = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch {}
      return ok({ multiplicateurs });
    }

    // ── Sauvegarder les multiplicateurs ──────────────────────
    if (action === 'save_multiplicateurs') {
      const { multiplicateurs } = params || {};
      if (!multiplicateurs) return err('multiplicateurs manquant');
      await sbPatch('config', 'key=eq.multiplicateurs', { value: JSON.stringify(multiplicateurs) });
      return ok({ saved: true });
    }

    // ── Recalculer les points d'un match ──────────────────────
    if (action === 'recalc_points_fixture') {
      const { fixture_id } = params || {};
      if (!fixture_id) return err('fixture_id manquant');

      const [baremeRows, multRows, stats, equipeJoueurs] = await Promise.all([
        sbGet('config', 'value', 'key=eq.bareme'),
        sbGet('config', 'value', 'key=eq.multiplicateurs'),
        sbGet('stats', 'joueur_id,minutes,buts,passes,clean_sheet,arrets,pen_arrete,pen_manque,buts_encaisses,jaune,rouge,csc,joueurs(poste)', `fixture_id=eq.${fixture_id}`),
        sbGet('equipe_joueurs', 'equipe_id,joueur_id'),
      ]);

      const bareme = getBareme(baremeRows[0]?.value) || {
        GAR: { moins60:1, min60:2, but:6, passe:3, cleanSheet:4, arrets3:1, penArrete:5, penManque:-2, butEnc2:-1, jaune:-1, rouge:-3, csc:-2 },
        DEF: { moins60:1, min60:2, but:6, passe:3, cleanSheet:4, arrets3:0, penArrete:0, penManque:-2, butEnc2:-1, jaune:-1, rouge:-3, csc:-2 },
        MIL: { moins60:1, min60:2, but:5, passe:3, cleanSheet:1, arrets3:0, penArrete:0, penManque:-2, butEnc2:0,  jaune:-1, rouge:-3, csc:-2 },
        ATT: { moins60:1, min60:2, but:4, passe:3, cleanSheet:0, arrets3:0, penArrete:0, penManque:-2, butEnc2:0,  jaune:-1, rouge:-3, csc:-2 },
      };

      let mult = null;
      try {
        const m = typeof multRows[0]?.value === 'string' ? JSON.parse(multRows[0].value) : multRows[0]?.value;
        if (m?.active) mult = m;
      } catch {}

      let multiplier = 1;
      if (mult) {
        const fixtures = await sbGet('fixtures', 'round', `id=eq.${fixture_id}`);
        const round = fixtures[0]?.round || '';
        const r = round.toLowerCase();
        if (r.includes('3rd') || r.includes('third')) multiplier = 1;
        else if (r.includes('semi'))    multiplier = mult.rounds?.semi    || 1;
        else if (r.includes('quarter')) multiplier = mult.rounds?.quarter || 1;
        else if (r.includes('final'))   multiplier = mult.rounds?.final   || 1;
        else if (r.includes('round of 16') || r.includes('r16')) multiplier = mult.rounds?.r16 || 1;
        else if (r.includes('round of 32') || r.includes('r32')) multiplier = mult.rounds?.r32 || 1;
      }

      const ejByJoueur = {};
      equipeJoueurs.forEach(ej => {
        if (!ejByJoueur[ej.joueur_id]) ejByJoueur[ej.joueur_id] = [];
        ejByJoueur[ej.joueur_id].push(ej.equipe_id);
      });

      const pointsRows = [];
      stats.forEach(stat => {
        const poste  = stat.joueurs?.poste || 'MIL';
        const equipes = ejByJoueur[stat.joueur_id] || [];
        if (!equipes.length) return;
        let { points, detail } = calculerPoints(poste, stat, bareme);
        if (multiplier !== 1) {
          points = Math.round(points * multiplier * 10) / 10;
          detail['×' + multiplier] = 0;
        }
        equipes.forEach(equipe_id => {
          pointsRows.push({ equipe_id, fixture_id: Number(fixture_id), joueur_id: stat.joueur_id, points, detail: JSON.stringify(detail) });
        });
      });

      for (let i = 0; i < pointsRows.length; i += 500) {
        await sbUpsert('points', pointsRows.slice(i, i + 500), 'equipe_id,fixture_id,joueur_id');
      }
      return ok({ recalculated: pointsRows.length });
    }

    // ── Reset les points d'un match ───────────────────────────
    if (action === 'reset_points_fixture') {
      const { fixture_id } = params || {};
      if (!fixture_id) return err('fixture_id manquant');
      await sbDelete('points', `fixture_id=eq.${fixture_id}`);
      return ok({ deleted: fixture_id });
    }

    // ── Re-syncer les stats d'un match depuis l'API ───────────
    if (action === 'resync_fixture') {
      const { fixture_id } = params || {};
      if (!fixture_id) return err('fixture_id manquant');
      if (!process.env.API_FOOTBALL_KEY) return err('API_FOOTBALL_KEY manquant');

      const joueurRows = await sbGet('joueurs', 'id,poste');
      const posteById  = new Map(joueurRows.map(j => [j.id, j.poste]));

      const fixtures = await sbGet('fixtures', 'id,home_name,away_name,home_goals,away_goals', `id=eq.${fixture_id}`);
      const fixture  = fixtures[0];
      if (!fixture) return err('Fixture introuvable en DB');

      const playerData = await apiGet('/fixtures/players', { fixture: fixture_id });

      const statsRows = [];
      playerData.forEach(teamEntry => {
        const isHomeTeam       = teamEntry.team.name === fixture.home_name;
        const teamGoalsConceded = isHomeTeam
          ? (fixture.away_goals ?? null)
          : (fixture.home_goals ?? null);

        (teamEntry.players || []).forEach(entry => {
          const p = entry.player;
          const s = entry.statistics?.[0];
          if (!s || !p?.id) return;
          if (!posteById.has(p.id)) return;

          const minutes       = s.games?.minutes    || 0;
          const poste         = posteById.get(p.id) || MAP_POSTE[s.games?.position] || 'MIL';
          const buts          = s.goals?.total      || 0;
          const passes        = s.goals?.assists    || 0;
          const arrets        = s.goalkeeper?.saves || 0;
          const penArrete     = s.penalty?.saved    || 0;
          const penManque     = s.penalty?.missed   || 0;
          // Un joueur qui n'a pas joué (0 minute) n'a rien encaissé ni gardé propre.
          const butsEncaisses = minutes > 0 ? (teamGoalsConceded ?? 0) : 0;
          const jaune         = s.cards?.yellow     || 0;
          const rouge         = s.cards?.red        || 0;
          const csc           = s.goals?.owngoals   || 0;
          const cleanSheet    = teamGoalsConceded === 0 && minutes >= 60 && (poste === 'GAR' || poste === 'DEF' || poste === 'MIL');

          statsRows.push({
            fixture_id:     Number(fixture_id),
            joueur_id:      p.id,
            minutes,        buts,           passes,
            clean_sheet:    cleanSheet,     arrets,
            pen_arrete:     penArrete > 0,  pen_manque: penManque > 0,
            buts_encaisses: butsEncaisses,  jaune: jaune > 0,
            rouge:          rouge > 0,      csc,
          });
        });
      });

      await sbDelete('stats', `fixture_id=eq.${fixture_id}`);
      if (statsRows.length) await sbInsert('stats', statsRows);
      return ok({ resynced: statsRows.length });
    }

    // ── Diagnostic API : joueurs d'un match ───────────────────
    if (action === 'api_fixture_players') {
      const { fixture_id } = params || {};
      if (!fixture_id) return err('fixture_id manquant');
      if (!process.env.API_FOOTBALL_KEY) return err('API_FOOTBALL_KEY manquant');

      const joueurRows = await sbGet('joueurs', 'id');
      const inDb = new Set(joueurRows.map(j => j.id));

      const playerData = await apiGet('/fixtures/players', { fixture: fixture_id });
      const teams = playerData.map(teamEntry => ({
        team: teamEntry.team.name,
        players: (teamEntry.players || []).map(entry => ({
          id:     entry.player.id,
          nom:    entry.player.name,
          minutes: entry.statistics?.[0]?.games?.minutes || 0,
          buts:    entry.statistics?.[0]?.goals?.total   || 0,
          in_db:  inDb.has(entry.player.id),
        })),
      }));
      return ok({ teams });
    }

    // ── Créer une équipe libre (sans budget) ──────────────────
    if (action === 'create_team_libre') {
      const { nom, joueur_ids } = params || {};
      if (!nom || !Array.isArray(joueur_ids) || joueur_ids.length === 0) return err('nom et joueur_ids requis');

      const res = await fetch(`${supa}/rest/v1/equipes`, {
        method: 'POST',
        headers: { ...hRet, 'Prefer': 'return=representation' },
        body: JSON.stringify({ nom, officiel: false }),
      });
      if (!res.ok) throw new Error(`Création équipe: ${res.status} ${(await res.text()).substring(0,200)}`);
      const created = await res.json();
      const equipe_id = Array.isArray(created) ? created[0].id : created.id;

      const ejRows = joueur_ids.map(joueur_id => ({ equipe_id, joueur_id }));
      await sbInsert('equipe_joueurs', ejRows);
      return ok({ nom, joueurs: joueur_ids.length, equipe_id });
    }

    // ── Liste les fixtures terminées (pour reset dropdown) ────
    if (action === 'list_fixtures_done') {
      const fixtures = await sbGet('fixtures', 'id,round,home_name,away_name,date_heure', 'status=in.(FT,AET,PEN)&order=date_heure');
      return ok({ fixtures });
    }

    // ── Verrou du site (suspense avant la finale) ─────────────
    if (action === 'get_site_lock') {
      const rows = await sbGet('config', 'value', 'key=eq.site_locked');
      const raw  = rows[0]?.value;
      let locked = false;
      try { locked = !!(typeof raw === 'string' ? JSON.parse(raw) : raw)?.locked; } catch {}
      return ok({ locked });
    }

    if (action === 'set_site_lock') {
      const { locked } = params || {};
      await sbUpsert('config', [{ key: 'site_locked', value: { locked: !!locked } }], 'key');
      return ok({ locked: !!locked });
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Action inconnue : ' + action }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message.substring(0, 300) }) };
  }
};

const ok  = (data) => ({ statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const err = (msg)  => ({ statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: String(msg) }) });
