(() => {
  'use strict';
  let activeKey = '', loaded = null, loading = false, loadError = '', fallback;
  let panelClosed = false;
  const saved = new Map();
  const send = msg => chrome.runtime.sendMessage(msg);
  function buttonFor(number) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'grs-save';
    button.dataset.grsRound = String(number);
    button.textContent = saved.get(number) || '+ Save to JSON';
    button.setAttribute('aria-label', `Save round ${number} to map JSON`);
    const info = loaded?.find(r => r.number === number);
    button.disabled = !info?.location;
    button.title = info?.error || 'Save the actual location and starting camera angle';
    button.addEventListener('click', async event => {
      event.preventDefault(); event.stopPropagation();
      const key = activeKey;
      button.disabled = true; button.textContent = 'Saving…';
      try {
        const result = await send({type: 'SAVE_ROUND', number});
        if (!result?.ok) throw new Error(result?.error || 'Reload this page after updating the extension.');
        if (key !== activeKey) return;
        const label = result.duplicate ? '✓ Already in JSON' : '✓ Saved';
        saved.set(number, label);
        document.querySelectorAll(`[data-grs-round="${number}"]`).forEach(b => { b.textContent = label; b.disabled = false; });
        status(`Round ${number}: ${result.duplicate ? 'already in' : 'saved to'} ${result.name} · ${result.count} locations`);
      } catch (e) { if (key === activeKey) {button.textContent = 'Retry save'; button.title = e.message; status(e.message, true);} }
      finally { button.disabled = false; }
    });
    return button;
  }
  function status(text, error = false) {
    const el = document.getElementById('grs-status');
    if (el) { el.textContent = text; el.classList.toggle('grs-error', error); }
  }
  function toolbar() {
    if (document.getElementById('grs-panel')) return;
    const panel = document.createElement('section'); panel.id = 'grs-panel';
    panel.hidden = panelClosed;
    const reopen = document.createElement('button'); reopen.id = 'grs-reopen'; reopen.type = 'button';
    reopen.textContent = 'Round Saver'; reopen.hidden = !panelClosed;
    reopen.setAttribute('aria-label', 'Open Round Saver panel');
    reopen.setAttribute('aria-controls', 'grs-panel');
    const close = document.createElement('button'); close.id = 'grs-close'; close.type = 'button';
    close.textContent = '×'; close.title = 'Close Round Saver panel';
    close.setAttribute('aria-label', 'Close Round Saver panel');
    close.onclick = () => {
      panelClosed = true; panel.hidden = true; reopen.hidden = false; reopen.focus();
    };
    reopen.onclick = () => {
      panelClosed = false; panel.hidden = false; reopen.hidden = true; close.focus();
    };
    const title = document.createElement('strong'); title.textContent = 'Round Saver';
    const settings = document.createElement('button'); settings.textContent = 'Map file'; settings.type = 'button';
    settings.onclick = () => send({type: 'OPEN_SETTINGS'}).catch(e => status(e.message, true));
    const retry = document.createElement('button'); retry.textContent = 'Reload rounds'; retry.type = 'button';
    retry.onclick = () => { loaded = null; loadError = ''; tick(); };
    const line = document.createElement('div'); line.id = 'grs-status'; line.setAttribute('role', 'status'); line.setAttribute('aria-live', 'polite');
    line.textContent = 'Loading round locations…';
    panel.append(title, close, settings, retry, line);
    document.body.append(panel, reopen);
  }
  function mount() {
    if (!loaded) return;
    // CSS-module prefixes survive the hashed suffix changing between site builds.
    const cards = [...document.querySelectorAll('[class*="duel-breakdown_roundItem__"]')];
    for (const card of cards) {
      const label = card.querySelector('[class*="roundNumber__"]');
      const number = Number(label?.textContent.match(/\d+/)?.[0]);
      if (!number || !loaded.some(r => r.number === number) || card.querySelector('.grs-save')) continue;
      card.classList.add('grs-round');
      card.append(buttonFor(number)); // A sibling, never nested inside the site's round button.
    }
    // Classic layouts vary. A separate labeled list also covers future Duels layout changes.
    if (!cards.length && !document.getElementById('grs-round-list')) {
      fallback = document.createElement('div'); fallback.id = 'grs-round-list';
      for (const r of loaded) {
        const row = document.createElement('div'); row.className = 'grs-fallback-row';
        const label = document.createElement('span'); label.textContent = `Round ${r.number}`;
        row.append(label, buttonFor(r.number)); fallback.append(row);
      }
      document.getElementById('grs-panel').append(fallback);
    } else if (cards.length) { fallback?.remove(); fallback = null; }
  }
  async function tick() {
    const route = RoundSaver.summaryRoute(location.href);
    const key = route ? route.type + '/' + route.id : '';
    if (key !== activeKey) {
      activeKey = key; loaded = null; loading = false; loadError = ''; panelClosed = false; saved.clear();
      document.querySelectorAll('.grs-save, #grs-panel, #grs-reopen').forEach(el => el.remove());
      document.querySelectorAll('.grs-round').forEach(el => el.classList.remove('grs-round'));
    }
    if (!key) return;
    toolbar();
    if (!loaded && !loading && !loadError) {
      loading = true;
      try {
        const result = await send({type: 'LOAD_ROUNDS'});
        if (key !== activeKey) return;
        if (!result?.ok) throw new Error(result?.error || 'Reload the page to connect the extension.');
        loaded = result.rounds;
        status('Choose “Map file” once, then save any round.');
      } catch (e) { if (key === activeKey) { loadError = e.message; status(loadError, true); } }
      finally { if (key === activeKey) loading = false; }
    }
    mount();
  }
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return; scheduled = true;
    setTimeout(() => { scheduled = false; tick(); }, 200);
  }).observe(document.documentElement, {childList: true, subtree: true});
  setInterval(tick, 1500); // Handles client-side route changes without patching GeoGuessr.
  tick();
})();
