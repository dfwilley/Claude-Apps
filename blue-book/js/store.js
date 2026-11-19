// Blue Book — where your logbook lives: on this phone only.
// Web version: the browser's private storage (IndexedDB). iPhone app: files in the app's own Documents folder.
(function (root) {
  'use strict';

  // ---------- Talking to the iPhone app (when running inside it) ----------
  const nativeHandler = root.webkit && root.webkit.messageHandlers && root.webkit.messageHandlers.bluebook;
  const pending = {}; let seq = 0;
  root.__bbReply = (id, ok, value) => { const p = pending[id]; if (!p) return; delete pending[id]; ok ? p.resolve(value) : p.reject(new Error(value || 'iPhone app error')); };
  function native(cmd, args) {
    return new Promise((resolve, reject) => { const id = ++seq; pending[id] = { resolve, reject }; nativeHandler.postMessage(Object.assign({ id, cmd }, args || {})); });
  }
  function blobToBase64(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
  }
  function bytesToBase64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }

  const photoVer = {}; // bumped when a photo is replaced, so the screens don't show the old picture
  const NativeStore = {
    kind: 'native',
    async loadDB() { const s = await native('readDB'); return s ? JSON.parse(s) : null; },
    async saveDB(db) { await native('writeDB', { json: JSON.stringify(db) }); },
    async putPhoto(id, blob) { await native('putPhoto', { photoId: id, base64: await blobToBase64(blob) }); photoVer[id] = (photoVer[id] || 0) + 1; },
    photoURL(id) { return `_files/photos/${encodeURIComponent(id)}.jpg${photoVer[id] ? '?v=' + photoVer[id] : ''}`; },
    async getPhoto(id) { const r = await fetch(this.photoURL(id)); if (!r.ok) throw new Error('Photo missing'); return new Uint8Array(await r.arrayBuffer()); },
    async deletePhoto(id) { await native('deletePhoto', { photoId: id }); },
    async share(name, bytes, mime) { await native('share', { name, mime, base64: bytesToBase64(bytes) }); },
    async scan() { return native('scan'); }, // → [photoId, ...] already cropped by the iPhone's document camera
    async ocr(id) { return native('ocr', { photoId: id }); },
    async ocrImage(base64) { return native('ocrImage', { base64 }); }, // a whole page as a JPEG → words with positions
    async ocrCells(images) { return native('ocrCells', { images }); }, // base64 JPEGs of single boxes → [[{text, conf}, …], …]
    async corners(id) { return native('corners', { photoId: id }); },
    async persist() { return true; },
  };

  // ---------- Web version ----------
  function idb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('blue-book', 1);
      req.onupgradeneeded = () => { const d = req.result; d.createObjectStore('kv'); d.createObjectStore('photos'); };
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  let dbp = null; const urls = {};
  function tx(store, mode, fn) {
    dbp = dbp || idb();
    return dbp.then(d => new Promise((resolve, reject) => {
      const t = d.transaction(store, mode); const s = t.objectStore(store); const r = fn(s);
      t.oncomplete = () => resolve(r && r.result); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error('Storage full?'));
    }));
  }
  // ---------- A folder you choose (computers, in Chrome or Edge) ----------
  // The logbook can live in a folder on the computer instead of inside the browser: bluebook.json plus a photos folder,
  // the same layout as a backup. Put that folder inside Dropbox, OneDrive or on a shared drive and two computers work
  // from the one copy. Blue Book itself still sends nothing anywhere; it only reads and writes files in that folder.
  let dir = null;          // the chosen folder (a FileSystemDirectoryHandle), or null = this browser's own storage
  let stamp = null;        // when bluebook.json was last changed, as of our last read or write of it
  let lastSaveId = null;   // the mark our last write left in the file, to tell our own write from someone else's
  const DATA = 'bluebook.json';
  const canFolder = typeof root.showDirectoryPicker === 'function';
  async function fileIn(d, name, create) { try { return await d.getFileHandle(name, { create: !!create }); } catch (e) { if (e && e.name === 'NotFoundError') return null; throw e; } }
  async function photosDir(create) { try { return await dir.getDirectoryHandle('photos', { create: !!create }); } catch (e) { if (e && e.name === 'NotFoundError') return null; throw e; } }
  async function writeFile(handle, data) { const w = await handle.createWritable(); await w.write(data); await w.close(); }
  async function readFolderDB(d) {
    const h = await fileIn(d, DATA); if (!h) return { db: null, modified: null };
    const f = await h.getFile(); const text = await f.text();
    if (!text.trim()) return { db: null, modified: f.lastModified };
    let db; try { db = JSON.parse(text); } catch (e) { throw new Error("The logbook file in that folder can't be read (it may still be copying from your other computer). Wait a minute and try again."); }
    return { db, modified: f.lastModified };
  }
  const folder = {
    supported: canFolder,
    get name() { return dir ? dir.name : ''; },
    get active() { return !!dir; },
    // At start-up: is a folder remembered, and may we use it yet? → 'none' | 'ready' | 'ask' (the browser wants a click first)
    async open() {
      const h = await tx('kv', 'readonly', s => s.get('folder')); if (!h) return { state: 'none' };
      let p = 'granted'; try { if (h.queryPermission) p = await h.queryPermission({ mode: 'readwrite' }); } catch (e) { p = 'prompt'; }
      if (p === 'granted') { dir = h; return { state: 'ready', name: h.name }; }
      return { state: 'ask', name: h.name, handle: h };
    },
    // After the click: ask the browser for the folder again.
    async grant(h) { const p = h.requestPermission ? await h.requestPermission({ mode: 'readwrite' }) : 'granted'; if (p !== 'granted') throw new Error('The browser was not allowed to use that folder.'); dir = h; return true; },
    async pick() { return root.showDirectoryPicker({ mode: 'readwrite', id: 'bluebook' }); },
    // What a folder holds, before deciding to use it.
    async peek(h) { const r = await readFolderDB(h); return r.db ? { pages: (r.db.pages || []).length, flights: (r.db.flights || []).length } : null; },
    // Start keeping the logbook in this folder. If the folder is empty, `current` (the logbook now on screen) and its
    // photos are copied into it first.
    async use(h, current, onProgress) {
      const had = await readFolderDB(h); const from = dir;
      if (!had.db && current) {
        const pd = await h.getDirectoryHandle('photos', { create: true }); let i = 0;
        for (const p of current.pages || []) {
          let blob = null; try { blob = from ? await (await (await (await from.getDirectoryHandle('photos')).getFileHandle(p.photoId + '.jpg')).getFile()) : await tx('photos', 'readonly', s => s.get(p.photoId)); } catch (e) { blob = null; }
          if (blob) await writeFile(await pd.getFileHandle(p.photoId + '.jpg', { create: true }), blob);
          if (onProgress) onProgress(++i / current.pages.length);
        }
      }
      dir = h; stamp = had.modified; lastSaveId = null; for (const k of Object.keys(urls)) { URL.revokeObjectURL(urls[k]); delete urls[k]; }
      await tx('kv', 'readwrite', s => s.put(h, 'folder'));
      if (!had.db && current) await WebStore.saveDB(current, { force: true });
      return had.db ? 'loaded' : 'copied';
    },
    // Go back to this browser's own storage (the folder and its files are left as they are).
    async stop() { dir = null; stamp = null; lastSaveId = null; for (const k of Object.keys(urls)) { URL.revokeObjectURL(urls[k]); delete urls[k]; } await tx('kv', 'readwrite', s => s.delete('folder')); },
    // Has the logbook file been changed by someone else (the other computer) since we last read or wrote it?
    async changedElsewhere() {
      if (!dir) return false; const h = await fileIn(dir, DATA); if (!h) return stamp != null;
      const f = await h.getFile(); if (f.lastModified === stamp) return false;
      try { const j = JSON.parse(await f.text()); if (lastSaveId && j && j.saveId === lastSaveId) { stamp = f.lastModified; return false; } } catch (e) { return false; } // half-copied: look again later
      return true;
    },
  };

  const WebStore = {
    kind: 'web', folder,
    async loadDB() {
      if (dir) { const r = await readFolderDB(dir); stamp = r.modified; lastSaveId = r.db && r.db.saveId || null; return r.db; }
      return (await tx('kv', 'readonly', s => s.get('db'))) || null;
    },
    async saveDB(db, opts) {
      if (!dir) { await tx('kv', 'readwrite', s => s.put(JSON.parse(JSON.stringify(db)), 'db')); return; }
      if (!(opts && opts.force) && await folder.changedElsewhere()) { const e = new Error('The logbook in the folder was changed on another computer.'); e.code = 'changed'; throw e; }
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const h = await fileIn(dir, DATA, true); await writeFile(h, JSON.stringify(Object.assign({}, db, { saveId: id })));
      lastSaveId = id; stamp = (await h.getFile()).lastModified;
    },
    async putPhoto(id, blob) {
      if (dir) await writeFile(await (await photosDir(true)).getFileHandle(id + '.jpg', { create: true }), blob);
      else await tx('photos', 'readwrite', s => s.put(blob, id));
      if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; }
    },
    async photoBlob(id) {
      if (!dir) return tx('photos', 'readonly', s => s.get(id));
      const pd = await photosDir(false); const h = pd && await fileIn(pd, id + '.jpg'); return h ? h.getFile() : null;
    },
    photoURL(id) { return urls[id] || null; },
    async photoURLAsync(id) { if (!urls[id]) { const b = await this.photoBlob(id); if (!b) throw new Error('Photo missing'); urls[id] = URL.createObjectURL(b); } return urls[id]; },
    async getPhoto(id) { const b = await this.photoBlob(id); if (!b) throw new Error('Photo missing'); return new Uint8Array(await b.arrayBuffer()); },
    async deletePhoto(id) {
      if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; }
      if (!dir) { await tx('photos', 'readwrite', s => s.delete(id)); return; }
      const pd = await photosDir(false); if (pd) { try { await pd.removeEntry(id + '.jpg'); } catch (e) { /* already gone */ } }
    },
    async share(name, bytes, mime) {
      const file = new File([bytes], name, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    },
    async persist() { try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { return false; } },
    async usage() { if (dir) return null; try { return navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch (e) { return null; } },
  };
  if (!NativeStore.photoURLAsync) NativeStore.photoURLAsync = async function (id) { return this.photoURL(id); };
  NativeStore.usage = async () => null;

  root.BBStore = nativeHandler ? NativeStore : WebStore;
  root.BBStore.isNative = !!nativeHandler;
})(typeof window !== 'undefined' ? window : globalThis);
