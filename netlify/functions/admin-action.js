// netlify/functions/admin-action.js
// Actions admin protégées par mot de passe simple (ADMIN_PASSWORD env var)
// Gardez ADMIN_PASSWORD dans les env vars Netlify (jamais dans le code)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'JSON invalide' }) }; }

  const { action, password, params } = body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Mot de passe incorrect' }),
    };
  }

  const supa = process.env.SUPABASE_URL.replace(/\/$/, '');
  const key  = process.env.SUPABASE_SERVICE_KEY;
  const h    = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };

  try {
    // ── Supprime une équipe (CASCADE → equipe_joueurs + points) ──
    if (action === 'delete_equipe') {
      const { equipe_id } = params || {};
      if (!equipe_id) return err('equipe_id manquant');

      const res = await fetch(`${supa}/rest/v1/equipes?id=eq.${equipe_id}`, {
        method: 'DELETE', headers: h,
      });
      if (!res.ok) return err(await res.text());
      return ok({ deleted: equipe_id });
    }

    // ── Liste toutes les équipes ──────────────────────────────
    if (action === 'list_equipes') {
      const res = await fetch(`${supa}/rest/v1/equipes?select=id,nom,created_at&order=created_at`, {
        headers: h,
      });
      if (!res.ok) return err(await res.text());
      return ok({ equipes: await res.json() });
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Action inconnue : ' + action }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

const ok  = (data) => ({ statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const err = (msg)  => ({ statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: String(msg).substring(0, 300) }) });
