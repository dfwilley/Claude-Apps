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

  const NativeStore = {
    kind: 'native',
    async loadDB() { const s = await native('readDB'); return s ? JSON.parse(s) : null; },
    async saveDB(db) { await native('writeDB', { json: JSON.stringify(db) }); },
    async putPhoto(id, blob) { await native('putPhoto', { photoId: id, base64: await blobToBase64(blob) }); },
    photoURL(id) { return `_files/photos/${encodeURIComponent(id)}.jpg`; },
    async getPhoto(id) { const r = await fetch(this.photoURL(id)); if (!r.ok) throw new Error('Photo missing'); return new Uint8Array(await r.arrayBuffer()); },
    async deletePhoto(id) { await native('deletePhoto', { photoId: id }); },
    async share(name, bytes, mime) { await native('share', { name, mime, base64: bytesToBase64(bytes) }); },
    async scan() { return native('scan'); }, // → [photoId, ...] already cropped by the iPhone's document camera
    async ocr(id) { return native('ocr', { photoId: id }); },
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
  const WebStore = {
    kind: 'web',
    async loadDB() { return (await tx('kv', 'readonly', s => s.get('db'))) || null; },
    async saveDB(db) { await tx('kv', 'readwrite', s => s.put(JSON.parse(JSON.stringify(db)), 'db')); },
    async putPhoto(id, blob) { await tx('photos', 'readwrite', s => s.put(blob, id)); if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; } },
    async photoBlob(id) { return tx('photos', 'readonly', s => s.get(id)); },
    photoURL(id) { return urls[id] || null; },
    async photoURLAsync(id) { if (!urls[id]) { const b = await this.photoBlob(id); if (!b) throw new Error('Photo missing'); urls[id] = URL.createObjectURL(b); } return urls[id]; },
    async getPhoto(id) { const b = await this.photoBlob(id); if (!b) throw new Error('Photo missing'); return new Uint8Array(await b.arrayBuffer()); },
    async deletePhoto(id) { await tx('photos', 'readwrite', s => s.delete(id)); },
    async share(name, bytes, mime) {
      const file = new File([bytes], name, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    },
    async persist() { try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { return false; } },
    async usage() { try { return navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch (e) { return null; } },
  };
  if (!NativeStore.photoURLAsync) NativeStore.photoURLAsync = async function (id) { return this.photoURL(id); };
  NativeStore.usage = async () => null;

  root.BBStore = nativeHandler ? NativeStore : WebStore;
  root.BBStore.isNative = !!nativeHandler;
})(typeof window !== 'undefined' ? window : globalThis);
