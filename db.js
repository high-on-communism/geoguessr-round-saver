/* File handles are structured-cloned in extension-origin IndexedDB. */
globalThis.MapDB = {
  async open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('round-saver', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('settings');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async get(key) {
    const db = await this.open();
    try { return await new Promise((resolve, reject) => {
      const req = db.transaction('settings').objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }); } finally { db.close(); }
  },
  async set(key, value) {
    const db = await this.open();
    try { await new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted.'));
    }); } finally { db.close(); }
  }
};
