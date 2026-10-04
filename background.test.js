const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('./core.js');

test('saving after SPA navigation uses the current game, not the original document URL', async () => {
  let listener;
  const endpoints = [];
  const writes = [];
  const sandbox = {
    importScripts() {},
    chrome: {
      runtime: {id: 'extension', onMessage: {addListener(fn) { listener = fn; }}},
      action: {onClicked: {addListener() {}}}
    },
    RoundSaver: {...core, appendLocation: async (handle, location) => {
      writes.push(location);
      return {duplicate: false};
    }},
    MapDB: {get: async () => ({}), set: async () => {}},
    navigator: {locks: {request: async (name, fn) => fn()}},
    AbortSignal,
    fetch: async endpoint => {
      endpoints.push(endpoint);
      return {ok: true, json: async () => ({status: 'finished', rounds: [
        {roundNumber: 2, lat: 12, lng: 34, panoId: 'current-game-pano'}
      ]})};
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('./background.js'), 'utf8'), sandbox);
  const original = 'https://www.geoguessr.com/duels/old-game/summary';
  const current = 'https://www.geoguessr.com/duels/current-game/summary?round=2';
  const sender = {id: 'extension', url: original, tab: {url: current}};
  const request = msg => new Promise(resolve => {
    assert.equal(listener(msg, sender, resolve), true);
  });
  assert.equal((await request({type: 'SAVE_ROUND', number: 2, pageUrl: current})).ok, true);
  // Older content scripts without pageUrl must also prefer the current tab URL.
  assert.equal((await request({type: 'SAVE_ROUND', number: 2})).ok, true);
  assert.deepEqual(endpoints, ['https://www.geoguessr.com/api/v4/game-results/duels/current-game']);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].panoId, 'current-game-pano');
  assert.equal(writes[1].panoId, 'current-game-pano');
});
