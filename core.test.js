const {test} = require('node:test');
const assert = require('node:assert/strict');
const {sameLocation, appendLocation} = require('./core.js');

test('duplicate detection requires coordinates even when panorama IDs match', () => {
  const location = {lat: 10, lng: 20, panoId: 'reused-id'};
  assert.equal(sameLocation(location, {...location, lat: 11}), false);
  assert.equal(sameLocation(location, {...location, lng: 21}), false);
  assert.equal(sameLocation(location, {...location}), true);
  assert.equal(sameLocation(location, {...location, lat: 10.0000005}), false);
  assert.equal(sameLocation(location, {...location, lat: 10.000000000001}), false);
  assert.equal(sameLocation(location, {...location, lng: 20.000000000001}), false);
  assert.equal(sameLocation(location, {...location, panoId: null, lat: 10.000000000001}), false);
  assert.equal(sameLocation(location, {...location, panoId: 'different-id'}), false);
  assert.equal(sameLocation(location, {...location, panoId: null}), true);
  assert.equal(sameLocation({...location, panoId: ''}, {...location, panoId: null, lat: 11}), false);
});

test('hex and decoded IDs still identify the same panorama at matching coordinates', () => {
  const panoId = 'abcdefghijklmnopqrstuv';
  const location = {lat: 10, lng: 20, panoId};
  assert.equal(sameLocation(location, {...location, panoId: Buffer.from(panoId).toString('hex')}), true);
});

test('saving a reused panorama ID appends the absent location and skips a repeat', async () => {
  const original = JSON.stringify({name: 'Map', customCoordinates: [
    {lat: 10, lng: 20, panoId: 'reused-id', extra: {tags: ['keep']}}
  ]});
  let contents = original;
  let writes = 0;
  const backups = [];
  const handle = {
    name: 'map.json',
    queryPermission: async () => 'granted',
    getFile: async () => ({text: async () => contents}),
    createWritable: async () => {
      let pending;
      return {
        write: async text => { pending = text; },
        close: async () => { contents = pending; writes++; },
        abort: async () => {}
      };
    }
  };
  const location = {lat: 11, lng: 21, panoId: 'reused-id'};
  const backup = async copy => backups.push(copy);
  assert.deepEqual(await appendLocation(handle, location, backup),
    {duplicate: false, count: 2, name: 'map.json'});
  const doc = JSON.parse(contents);
  assert.equal(doc.name, 'Map');
  assert.deepEqual(doc.customCoordinates[0], JSON.parse(original).customCoordinates[0]);
  assert.equal(doc.customCoordinates[1].lat, 11);
  assert.equal(backups[0].text, original);
  assert.deepEqual(await appendLocation(handle, location, backup),
    {duplicate: true, count: 2, name: 'map.json'});
  assert.equal(writes, 1);
  assert.equal(backups.length, 1);
});
