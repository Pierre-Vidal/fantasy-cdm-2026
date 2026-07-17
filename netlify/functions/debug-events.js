// netlify/functions/debug-events.js
// Debug temporaire : renvoie la réponse brute /fixtures/events pour un fixture donné.
// À supprimer une fois le diagnostic terminé.
exports.handler = async (event) => {
  const fixture = event.queryStringParameters?.fixture;
  if (!fixture) return { statusCode: 400, body: 'fixture param manquant' };

  const res = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixture}`, {
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY },
  });
  const json = await res.json();
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) };
};
