importScripts('core.js', 'db.js');
const cache = new Map();
async function openSettings() {
  await chrome.runtime.openOptionsPage();
}
chrome.action.onClicked.addListener(openSettings);
async function roundsFor(route) {
  const key = route.type + '/' + route.id;
  if (cache.has(key)) return cache.get(key);
  const endpoint = route.type === 'duels'
    ? 'https://www.geoguessr.com/api/v4/game-results/duels/' + route.id
    : 'https://www.geoguessr.com/api/v3/games/' + route.id;
  const options = () => ({credentials: 'include', headers: {'Accept': 'application/json', 'X-Client': 'web'}, signal: AbortSignal.timeout(15000)});
  let response = await fetch(endpoint, options());
  if (route.type === 'duels' && response.status === 404) {
    response = await fetch('https://game-server.geoguessr.com/api/duels/' + route.id, options());
  }
  if (!response.ok) throw new Error(`Could not load this game (HTTP ${response.status}). Sign in to GeoGuessr and reload the summary.`);
  const data = await response.json();
  const game = data.game ?? data;
  if (route.type === 'classic' && game.state && game.state.toLowerCase() !== 'finished') throw new Error('This game has not finished.');
  if (route.type === 'duels' && typeof game.status === 'string' && !['finished', 'completed', 'ended'].includes(game.status.toLowerCase())) throw new Error('This duel has not finished.');
  const rounds = RoundSaver.extractRounds(data, route.type);
  if (cache.size >= 20) cache.delete(cache.keys().next().value);
  cache.set(key, rounds);
  return rounds;
}
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const route = sender.tab && RoundSaver.summaryRoute(sender.url || sender.tab.url);
  if (sender.id !== chrome.runtime.id || !route) return;
  (async () => {
    if (msg.type === 'OPEN_SETTINGS') { await openSettings(); return {}; }
    if (msg.type === 'LOAD_ROUNDS') return {rounds: await roundsFor(route)};
    if (msg.type !== 'SAVE_ROUND' || !Number.isInteger(msg.number)) throw new Error('Invalid request.');
    const round = (await roundsFor(route)).find(r => r.number === msg.number);
    if (!round?.location) throw new Error(round?.error || 'This round is unavailable.');
    return navigator.locks.request('map-file-write', async () => {
      const handle = await MapDB.get('handle');
      if (!handle) throw new Error('Choose your JSON first: click “Map file”, select a file, then retry this round.');
      return RoundSaver.appendLocation(handle, round.location, backup => MapDB.set('backup', backup));
    });
  })().then(result => reply({ok: true, ...result})).catch(error => reply({ok: false, error: error.message || String(error)}));
  return true;
});
