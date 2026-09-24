const $ = id => document.getElementById(id);
let selected;
function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
async function refresh() {
  selected = await MapDB.get('handle');
  if (!selected) { $('file').textContent = 'No file selected yet.'; return; }
  const permission = await selected.queryPermission({mode: 'readwrite'});
  $('file').textContent = selected.name + (permission === 'granted' ? ' — ready to save' : ' — reconnect to allow editing');
  $('reconnect').hidden = permission === 'granted';
}
async function connect(handle) {
  if (await handle.requestPermission({mode: 'readwrite'}) !== 'granted') throw new Error('Editing permission was not granted. Click Choose existing file to try again.');
  const {coordinates} = RoundSaver.parseMap(await (await handle.getFile()).text());
  await navigator.locks.request('map-file-write', () => MapDB.set('handle', handle));
  await refresh(); status(`Connected to ${handle.name}: ${coordinates.length} locations. You can close this tab.`);
}
function handler(id, fn) {
  $(id).onclick = async () => {
    $(id).disabled = true;
    try { await fn(); } catch (e) { status(e.name === 'AbortError' ? 'Cancelled. Your selection is unchanged.' : e.message, e.name !== 'AbortError'); }
    finally { $(id).disabled = false; }
  };
}
handler('choose', async () => {
  const [handle] = await showOpenFilePicker({id: 'map-json', startIn: 'downloads', multiple: false});
  await connect(handle);
});
handler('create', async () => {
  const handle = await showSaveFilePicker({suggestedName: 'My GeoGuessr locations.json', types: [{description: 'Map JSON', accept: {'application/json': ['.json']}}]});
  await navigator.locks.request('map-file-write', async () => {
    if ((await handle.getFile()).size) throw new Error('That file already contains data. Use Choose existing file to preserve it.');
    const stream = await handle.createWritable();
    try { await stream.write(JSON.stringify({name: handle.name.replace(/\.json$/i, ''), customCoordinates: []}, null, 2) + '\n'); await stream.close(); }
    catch (e) { try { await stream.abort(); } catch {} throw e; }
  });
  await connect(handle);
});
handler('reconnect', async () => { if (selected) await connect(selected); });
handler('backup', async () => {
  const copy = await MapDB.get('backup');
  if (!copy) throw new Error('No backup yet. A backup is created when the first new location is saved.');
  const blob = new Blob([copy.text], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = copy.name + '.before-last-save.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  status(`Downloaded the backup from ${copy.savedAt}.`);
});
refresh().catch(e => status(e.message, true));
