// Where HGVC Binder keeps things.
// In the iPhone app: everything goes through the app (files in the app's own folder, numbers in the iPhone Keychain behind Face ID).
// In a web browser: the binder lives in this browser only (localStorage + IndexedDB). Nothing is sent anywhere.
(function () {
  'use strict';
  const native = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.hgvc);
  const KEY = 'hgvc-binder-state-v1';

  // ---- talking to the iPhone app ----
  let nextId = 1; const waiting = {};
  window.__hbReply = (id, ok, value) => { const w = waiting[id]; if (!w) return; delete waiting[id]; ok ? w.resolve(value) : w.reject(new Error(value)); };
  window.__hbEvent = (name, value) => { (listeners[name] || []).forEach(fn => { try { fn(value); } catch (e) { console.error(e); } }); };
  const listeners = {};
  function on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); }
  function call(cmd, args) {
    if (!native) return Promise.reject(new Error('Only in the iPhone app'));
    return new Promise((resolve, reject) => {
      const id = nextId++; waiting[id] = { resolve, reject };
      window.webkit.messageHandlers.hgvc.postMessage(Object.assign({ cmd, id }, args || {}));
    });
  }

  // ---- documents in the browser (IndexedDB) ----
  let dbp = null;
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open('hgvc-binder-docs', 2);
      r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs'); if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); };
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    return dbp;
  }
  function idbDo(mode, fn, store) {
    return idb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(store || 'docs', mode); const st = tx.objectStore(store || 'docs'); const req = fn(st);
      tx.oncomplete = () => resolve(req && req.result); tx.onerror = () => reject(tx.error);
    }));
  }
  function b64(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); }); }
  function fromB64(s, type) { const bin = atob(s); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: type || 'application/octet-stream' }); }

  const kvGet = k => idbDo('readonly', st => st.get(k), 'kv').catch(() => null);
  const kvSet = (k, v) => idbDo('readwrite', st => st.put(v, k), 'kv');
  const parse = raw => { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };

  // ---- a data folder the browser remembers (Chrome / Edge / the Claude app's browser; not iPhone Safari) ----
  const webFolder = !native && typeof window.showDirectoryPicker === 'function';
  const DATA_NAME = 'HGVC Binder Data';
  const stamp = n => n.split(DATA_NAME).pop();

  const Store = {
    native,
    webFolder,
    folderCapable: native || webFolder,
    on,
    // The binder is kept in two places in the browser, so clearing one doesn't lose it.
    async load() {
      if (native) { try { return parse(await call('readDB')); } catch (e) { console.error(e); return null; } }
      const a = parse(localStorage.getItem(KEY));
      const b = parse(await kvGet('state'));
      const t = x => (x && x.meta && x.meta.savedAt) || '';
      if (a && b) return t(b) > t(a) ? b : a;
      return a || b;
    },
    async save(state) {
      state.meta = Object.assign({}, state.meta, { savedAt: new Date().toISOString() });
      const json = JSON.stringify(state);
      if (native) return call('writeDB', { json });
      let ok = false;
      try { localStorage.setItem(KEY, json); ok = true; } catch (e) { /* fall through to IndexedDB */ }
      try { await kvSet('state', json); ok = true; } catch (e) { /* ignore */ }
      if (!ok) throw new Error('This browser is out of room for the binder. Remove a large document or export a backup.');
    },
    // Ask the browser not to clear the binder when it tidies up storage.
    async keep() { try { if (!native && navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) { /* not supported */ } },
    async putDoc(id, blob) {
      if (native) return call('putDoc', { docId: id, base64: await b64(blob) });
      return idbDo('readwrite', st => st.put(blob, id));
    },
    async getDoc(id, type) {
      if (native) return fromB64(await call('getDoc', { docId: id }), type);
      return idbDo('readonly', st => st.get(id));
    },
    async deleteDoc(id) {
      if (native) return call('deleteDoc', { docId: id });
      return idbDo('readwrite', st => st.delete(id));
    },
    async openDoc(doc) {
      if (native) return call('openDoc', { docId: doc.id, name: doc.name, mime: doc.mime || '' });
      const blob = await Store.getDoc(doc.id, doc.mime);
      if (!blob) throw new Error('That document isn\'t in this browser.');
      const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    // Face ID / passcode. Web: not available, so full numbers are never kept there.
    unlock(reason) { return native ? call('unlock', { reason }) : Promise.reject(new Error('Face ID is only in the iPhone app.')); },
    secretGet(key) { return call('secretGet', { key }); },
    secretSet(key, value) { return call('secretSet', { key, value }); },
    schedule(list) { return native ? call('schedule', { list }) : Promise.resolve(false); },
    async pickFolder() {
      if (native) return call('pickFolder');
      if (!webFolder) throw new Error('This browser can\'t remember a folder. Use Open a data file instead.');
      const h = await window.showDirectoryPicker({ id: 'hgvc-binder', mode: 'read' });
      await kvSet('folder', h);
      try { localStorage.setItem(KEY + '-folder', h.name); sessionStorage.removeItem(KEY + '-folder-trying'); } catch (e) { /* ignore */ }
      return true;
    },
    async folderStatus() {
      if (native) return call('folderStatus');
      if (!webFolder) return null;
      let name = null; try { name = localStorage.getItem(KEY + '-folder'); } catch (e) { /* ignore */ }
      if (!name) return { chosen: false };
      // Safety catch: if reading the remembered folder ever failed hard last time, don't try again on its own.
      try { if (sessionStorage.getItem(KEY + '-folder-trying')) return { chosen: false, broken: true }; sessionStorage.setItem(KEY + '-folder-trying', '1'); } catch (e) { /* ignore */ }
      const h = await kvGet('folder');
      try { sessionStorage.removeItem(KEY + '-folder-trying'); } catch (e) { /* ignore */ }
      if (!h) return { chosen: false };
      let permission = 'prompt'; try { permission = await h.queryPermission({ mode: 'read' }); } catch (e) { /* ignore */ }
      return { chosen: true, name: h.name, permission };
    },
    // askPermission: only from a tap (browsers need a click before they'll re-open a folder).
    async loadFolderData(askPermission) {
      if (native) return call('loadFolderData');
      const h = await kvGet('folder'); if (!h) return null;
      let perm = await h.queryPermission({ mode: 'read' });
      if (perm !== 'granted' && askPermission) perm = await h.requestPermission({ mode: 'read' });
      if (perm !== 'granted') { const e = new Error('needs-permission'); e.needsTap = true; throw e; }
      let best = null;
      for await (const [name, entry] of h.entries()) {
        if (entry.kind !== 'file' || !name.includes(DATA_NAME) || !/\.json$/i.test(name)) continue;
        if (!best || stamp(name) > stamp(best.name)) best = { name, entry };
      }
      if (!best) return null;
      return { name: best.name, json: await (await best.entry.getFile()).text() };
    },
    async pdfText(blob) {
      if (native) return call('pdfText', { base64: await b64(blob) });
      const pdfjs = await import(new URL('vendor/pdf.min.mjs', document.baseURI).href);
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.mjs', document.baseURI).href;
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      let text = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i); const c = await page.getTextContent();
        // Rebuild lines from the positions of the words on the page.
        const rows = {};
        for (const it of c.items) { if (!it.str.trim()) continue; const y = Math.round(it.transform[5] / 3) * 3; (rows[y] = rows[y] || []).push(it); }
        for (const y of Object.keys(rows).map(Number).sort((a, b) => b - a)) text += rows[y].sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str).join(' ') + '\n';
      }
      return text;
    },
    async share(name, blob) {
      if (native) return call('share', { name, base64: await b64(blob) });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
    },
    openURL(url) { if (native) return call('openURL', { url }); window.location.href = url; }
  };
  window.Store = Store;
})();
