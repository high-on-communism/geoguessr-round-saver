/* Shared, dependency-free parsing and file writing. */
(function (root) {
  'use strict';
  function summaryRoute(value) {
    const url = new URL(value);
    if (url.origin !== 'https://www.geoguessr.com') return null;
    let m = url.pathname.match(/^\/(duels|team-duels)\/([a-zA-Z0-9-]+)\/summary\/?$/);
    if (m) return {type: 'duels', id: m[2]};
    m = url.pathname.match(/^\/results\/([a-zA-Z0-9-]+)\/?$/);
    return m ? {type: 'classic', id: m[1]} : null;
  }
  function decodePano(value) {
    if (typeof value !== 'string' || !value) return null;
    // GeoGuessr often hex-encodes Google's ASCII panorama IDs.
    if (value.length >= 32 && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value)) {
      const decoded = value.match(/../g).map(x => String.fromCharCode(parseInt(x, 16))).join('');
      if (/^[A-Za-z0-9_-]+$/.test(decoded)) return decoded;
    }
    return value;
  }
  function locationOf(p) {
    if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number' ||
        !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) {
      throw new Error('This round has no valid actual location. Nothing was written.');
    }
    return {
      lat: p.lat, lng: p.lng,
      heading: Number.isFinite(p.heading) ? p.heading : 0,
      pitch: Number.isFinite(p.pitch) ? p.pitch : 0,
      zoom: Number.isFinite(p.zoom) ? p.zoom : 0,
      panoId: decodePano(p.panoId),
      countryCode: p.countryCode ?? null, stateCode: p.stateCode ?? null,
      extra: {tags: [], ...(typeof (p.panoDate ?? p.extra?.panoDate) === 'string' ? {panoDate: p.panoDate ?? p.extra.panoDate} : {})}
    };
  }
  function extractRounds(data, type) {
    const game = data.game ?? data;
    if (!Array.isArray(game.rounds) || !game.rounds.length) throw new Error('GeoGuessr returned no rounds.');
    const result = game.rounds.map((r, i) => {
      try {
        return {number: Number.isInteger(r.roundNumber) ? r.roundNumber : i + 1,
          location: locationOf(type === 'duels' ? (r.panorama ?? r) : r)};
      } catch (e) { return {number: i + 1, error: e.message}; }
    });
    if (new Set(result.map(r => r.number)).size !== result.length) throw new Error('Ambiguous round numbers.');
    return result;
  }
  function parseMap(text) {
    let doc;
    try { doc = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch { throw new Error('The selected file is not valid JSON. Nothing was written.'); }
    const coordinates = Array.isArray(doc) ? doc : doc?.customCoordinates;
    if (!Array.isArray(coordinates)) throw new Error('Choose a map export with a customCoordinates array (or a location array).');
    if (coordinates.some(p => !p || typeof p.lat !== 'number' || typeof p.lng !== 'number' || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180)) {
      throw new Error('The existing map contains invalid coordinates. Nothing was written.');
    }
    return {doc, coordinates};
  }
  function sameLocation(a, b) {
    const pa = decodePano(a.panoId), pb = decodePano(b.panoId);
    if (pa && pb) return pa === pb;
    return Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lng - b.lng) < 0.000001;
  }
  async function appendLocation(handle, location, backup) {
    const clean = locationOf(location);
    if (await handle.queryPermission({mode: 'readwrite'}) !== 'granted') {
      throw new Error('File access needs approval. Click “Map file” and then “Reconnect”, then retry this round.');
    }
    const original = await (await handle.getFile()).text();
    const {doc, coordinates} = parseMap(original);
    if (coordinates.some(p => sameLocation(p, clean))) return {duplicate: true, count: coordinates.length, name: handle.name};
    coordinates.push(clean);
    await backup({text: original, name: handle.name, savedAt: new Date().toISOString()});
    // Detect edits made while preparing the update. Browser commits on close.
    if (await (await handle.getFile()).text() !== original) throw new Error('The map changed during saving. Please retry.');
    const stream = await handle.createWritable();
    try {
      await stream.write(JSON.stringify(doc, null, 2) + '\n');
      await stream.close();
    } catch (e) {
      try { await stream.abort(); } catch {}
      throw e;
    }
    return {duplicate: false, count: coordinates.length, name: handle.name};
  }
  const api = {summaryRoute, decodePano, locationOf, extractRounds, parseMap, sameLocation, appendLocation};
  root.RoundSaver = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
