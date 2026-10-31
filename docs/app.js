/* Bin Finder (web). Everything stays on this phone: bins in IndexedDB, photos as JPEGs in IndexedDB,
   printed words read from photos by Tesseract running inside the browser. */
(() => {
"use strict";
const S = window.BinSearch;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const APP_URL = location.origin + location.pathname;
const app = $("app");

/* ---------- Storage ---------- */
let db;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("bin-finder", 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore("bins", { keyPath: "id" });
      d.createObjectStore("photos");
      d.createObjectStore("thumbs");
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
function tx(store, mode, fn) {
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode); const st = t.objectStore(store); let out;
    const r = fn(st); if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("Storage is full or blocked."));
  });
}
let BINS = [];
const binById = (id) => BINS.find((b) => b.id === id);
async function loadBins() { BINS = (await tx("bins", "readonly", (s) => s.getAll())) || []; }
async function putBin(b) {
  b.updated = S.isoNow();
  b.items = (b.items || []).map((x) => x.trim()).filter(Boolean);
  if (!String(b.code || "").trim()) b.code = S.nextCode(b.location, BINS.filter((x) => x.id !== b.id));
  await tx("bins", "readwrite", (s) => s.put(b));
  const i = BINS.findIndex((x) => x.id === b.id); if (i >= 0) BINS[i] = b; else BINS.push(b);
  return b;
}
async function deleteBin(id) {
  const b = binById(id); if (!b) return;
  for (const p of b.photos) await deletePhotoFiles(p);
  await tx("bins", "readwrite", (s) => s.delete(id));
  BINS = BINS.filter((x) => x.id !== id);
}
const getPhoto = (name) => tx("photos", "readonly", (s) => s.get(name));
const getThumb = (name) => tx("thumbs", "readonly", (s) => s.get(name));
async function savePhotoFiles(name, full, thumb) {
  await tx("photos", "readwrite", (s) => s.put(full, name));
  await tx("thumbs", "readwrite", (s) => s.put(thumb, name));
}
async function deletePhotoFiles(name) {
  await tx("photos", "readwrite", (s) => s.delete(name));
  await tx("thumbs", "readwrite", (s) => s.delete(name));
  if (urlCache[name]) { URL.revokeObjectURL(urlCache[name]); delete urlCache[name]; }
  markRead(name, false);
}
const urlCache = {};
async function thumbURL(name) {
  if (urlCache[name]) return urlCache[name];
  const b = await getThumb(name); if (!b) return null;
  return (urlCache[name] = URL.createObjectURL(b));
}
const newID = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); })).toUpperCase();
const newBin = () => ({ id: newID(), name: "", location: "", code: "", items: [], notes: "", photos: [], autoWords: [], created: S.isoNow(), updated: S.isoNow() });
const locations = () => [...new Set(BINS.map((b) => (b.location || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
const byCode = (a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true });

/* ---------- Photos: shrink, save, read words ---------- */
function loadImage(blob) {
  return new Promise((res, rej) => { const u = URL.createObjectURL(blob); const i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error("That file isn't a photo this browser can open.")); }; i.src = u; });
}
const toBlob = (c, q) => new Promise((res) => c.toBlob(res, "image/jpeg", q));
async function processImage(blob) {
  const img = await loadImage(blob); // browsers apply the camera's rotation automatically
  const w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, 1600 / Math.max(w, h));
  const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  const full = await toBlob(c, 0.75);
  const t = document.createElement("canvas"); t.width = t.height = 180; const side = Math.min(w, h);
  t.getContext("2d").drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 180, 180);
  return { full, thumb: await toBlob(t, 0.7) };
}
async function addPhotos(binId, files) {
  let added = 0;
  for (const f of files) {
    try {
      const { full, thumb } = await processImage(f);
      const name = newID() + ".jpg";
      await savePhotoFiles(name, full, thumb);
      const b = binById(binId); b.photos.push(name); await putBin(b);
      queueRead(name, binId); added++;
    } catch (e) { toast(e.message); }
  }
  return added;
}

const READ_KEY = "bf-photos-read";
const readSet = new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]"));
function markRead(name, yes = true) { if (yes) readSet.add(name); else readSet.delete(name); try { localStorage.setItem(READ_KEY, JSON.stringify([...readSet])); } catch {} }
const queue = []; let reading = false, ocr = null;
function queueRead(name, binId) { if (!queue.some((q) => q.name === name)) queue.push({ name, binId }); runQueue(); }
async function getOCR() {
  if (ocr) return ocr;
  if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "vendor/tesseract/tesseract.min.js"; s.onload = res; s.onerror = () => rej(new Error("Couldn't load the photo reader.")); document.head.appendChild(s); });
  const base = new URL("vendor/tesseract/", location.href).href;
  ocr = await Tesseract.createWorker("eng", 1, { workerPath: base + "worker.min.js", corePath: base, langPath: base + "lang", gzip: true });
  // Bin photos are cluttered: use local (Sauvola) contrast and look for scattered text instead of a page of paragraphs.
  await ocr.setParameters({ thresholding_method: "2", tessedit_pageseg_mode: "11" });
  return ocr;
}
async function runQueue() {
  if (reading) return; reading = true;
  while (queue.length) {
    $("reading").hidden = false;
    $("reading").textContent = `Reading photos… ${queue.length} left`;
    const { name, binId } = queue.shift();
    try {
      const blob = await getPhoto(name); const b = binById(binId);
      if (blob && b) {
        const worker = await getOCR();
        const { data } = await worker.recognize(blob);
        const words = S.photoWords(data.text);
        const fresh = binById(binId);
        if (fresh) {
          const have = new Set((fresh.autoWords || []).map(S.normalize));
          fresh.autoWords = [...(fresh.autoWords || []), ...words.filter((w) => !have.has(S.normalize(w)))].slice(0, 80);
          await tx("bins", "readwrite", (s) => s.put(fresh));
        }
      }
      markRead(name);
    } catch (e) { console.warn("photo reader:", e); }
    // Show newly read words without disturbing anything being typed.
    if (route().name === "home") drawList();
    else if (route().name === "bin" && route().id === binId && !(document.activeElement && document.activeElement.id === "newItem")) render();
  }
  $("reading").hidden = true; reading = false;
}

/* ---------- Pickers, share sheet, toast ---------- */
let pickTarget = null;
function pick(kind, onFiles) { pickTarget = onFiles; const el = $(kind === "camera" ? "pickCamera" : "pickLibrary"); el.value = ""; el.click(); }
["pickCamera", "pickLibrary"].forEach((id) => $(id).addEventListener("change", (e) => { const f = [...e.target.files]; if (f.length && pickTarget) pickTarget(f); }));

let toastT;
function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2800); }

let offered, offeredURL;
function offerFile(file, title, text) {
  offered = file; if (offeredURL) URL.revokeObjectURL(offeredURL); offeredURL = URL.createObjectURL(file);
  $("dlgTitle").textContent = title; $("dlgText").textContent = text;
  $("dlgShare").hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
  const a = $("dlgDownload"); a.href = offeredURL; a.download = file.name;
  $("dlg").showModal();
}
$("dlgShare").onclick = async (e) => { e.preventDefault(); try { await navigator.share({ files: [offered], title: offered.name }); $("dlg").close(); } catch (err) { if (err.name !== "AbortError") toast("Sharing didn't work — try Download."); } };
$("dlgDownload").addEventListener("click", () => setTimeout(() => $("dlg").close(), 300));

/* ---------- QR ---------- */
const binLink = (b) => `${APP_URL}#/bin/${b.id}?c=${encodeURIComponent(b.code)}`;
function qrSVG(text) { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }

/* ---------- Routing ---------- */
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = h.split("?");
  const parts = path.split("/").filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(query));
  return { name: parts[0] || "home", id: parts[1], params };
}
const go = (h) => { location.hash = h; };
window.addEventListener("hashchange", render);
let query = "";

function render() {
  const r = route();
  window.scrollTo(0, 0);
  if (r.name === "bin") return renderBin(r.id, r.params);
  if (r.name === "new") return renderEdit(null);
  if (r.name === "edit") return renderEdit(r.id);
  if (r.name === "label") return renderLabel(r.id);
  if (r.name === "print") return renderPrint(r.params);
  if (r.name === "more") return renderMore();
  return renderHome();
}

/* ---------- Home: browse and search ---------- */
const searchIcon = `<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
function renderHome() {
  if (!BINS.length) {
    app.innerHTML = `<div class="page"><div class="empty"><div class="big" aria-hidden="true">📦</div>
      <h2>Photograph each bin once.</h2>
      <p>Take a picture of what's inside each bin, shelf or RV compartment and list a few things. Later, just type what you're looking for.</p>
      <p><button class="btn primary" id="first">＋ Add your first bin</button></p>
      <p><button class="btn plain" id="restore0">Restore from a backup</button></p></div></div>`;
    $("first").onclick = () => go("#/new");
    $("restore0").onclick = () => $("pickBackup").click();
    return;
  }
  app.innerHTML = `<div class="page">
    <div class="bar"><button class="icon" id="more" aria-label="More: labels and backup">⋯</button><button class="icon" id="add" aria-label="New bin">⊕</button></div>
    <h1 class="large">Bin Finder</h1>
    <label class="search">${searchIcon}<input id="q" type="text" inputmode="search" placeholder="Find something, like spare fuses" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Search bins"><button class="clear" id="clr" aria-label="Clear search" hidden>✕</button></label>
    <div id="list"></div></div>`;
  $("more").onclick = () => go("#/more");
  $("add").onclick = () => go("#/new");
  const q = $("q"); q.value = query;
  q.addEventListener("input", () => { query = q.value; $("clr").hidden = !query; drawList(); });
  q.addEventListener("keydown", (e) => { if (e.key === "Enter") q.blur(); });
  $("clr").hidden = !query; $("clr").onclick = (e) => { e.preventDefault(); query = ""; q.value = ""; $("clr").hidden = true; drawList(); q.focus(); };
  drawList();
}
function rowHTML(b, reasons) {
  const sub = [b.code, (b.location || "").trim()].filter(Boolean).join(" · ");
  const line = reasons && reasons.length ? `<div class="why">${esc(reasons.join(" · "))}</div>` : (b.items.length ? `<div class="list">${esc(b.items.join(", "))}</div>` : "");
  return `<a class="row thumbrow" href="#/bin/${b.id}"><span class="thumb" data-thumb="${esc(b.photos[0] || "")}">📦</span>
    <span class="grow"><div class="title">${esc(S.displayName(b))}</div><div class="sub2">${esc(sub)}</div>${line}</span><span class="chev" aria-hidden="true">›</span></a>`;
}
function drawList() {
  const box = $("list"); if (!box) return;
  if (query.trim()) {
    const hits = S.search(query, BINS);
    box.innerHTML = hits.length
      ? `<div class="sechead">${hits.length === 1 ? "1 bin" : hits.length + " bins"}</div><div class="group">${hits.map((h) => rowHTML(h.bin, h.reasons)).join("")}</div>`
      : `<div class="group"><div class="row"><span class="grow"><div class="title">Nothing found for “${esc(query.trim())}”</div><div class="sub2">Try a simpler word, like “fuse” or “drill”. Search looks at bin names, items, labels, locations, notes and words read in your photos.</div></span></div></div>`;
  } else {
    const groups = {};
    BINS.forEach((b) => (groups[(b.location || "").trim() || "No location"] ||= []).push(b));
    const keys = Object.keys(groups).sort((a, b) => a === "No location" ? 1 : b === "No location" ? -1 : a.localeCompare(b, undefined, { sensitivity: "base" }));
    box.innerHTML = keys.map((k) => `<div class="sechead">${esc(k)} · ${groups[k].length}</div><div class="group">${groups[k].sort(byCode).map((b) => rowHTML(b)).join("")}</div>`).join("");
  }
  fillThumbs(box);
}
async function fillThumbs(root) {
  for (const el of root.querySelectorAll("[data-thumb]")) {
    const n = el.dataset.thumb; if (!n) continue;
    const u = await thumbURL(n); if (!u) continue;
    const img = document.createElement("img"); img.className = "thumb"; img.alt = ""; img.src = u; el.replaceWith(img);
  }
}

/* ---------- Bin detail ---------- */
async function renderBin(id, params) {
  const b = binById(id);
  if (!b) {
    app.innerHTML = `<div class="page"><div class="bar"><a class="link" href="#/">‹ Bin Finder</a><span></span></div>
      <div class="empty"><div class="big" aria-hidden="true">🔎</div><h2>${params.c ? "Bin " + esc(params.c) + " isn't" : "That bin isn't"} in this copy of Bin Finder.</h2>
      <p>On iPhone, Bin Finder on your Home Screen and Bin Finder in Safari keep separate copies of your bins. If you added your bins from the Home Screen app, open it there and search for <b>${esc(params.c || "the label code")}</b>.</p></div></div>`;
    return;
  }
  const have = new Set(b.items.map(S.normalize));
  const suggestions = (b.autoWords || []).filter((w) => ![...have].some((i) => i.includes(S.normalize(w)))).slice(0, 24);
  app.innerHTML = `<div class="page">
    <div class="bar"><a class="link" href="#/">‹ Bin Finder</a><span class="center">${esc(S.displayName(b))}</span><span style="width:60px"></span></div>
    <div class="group" style="margin-top:8px">
      ${b.photos.length ? `<div class="photos" id="photos">${b.photos.map((p) => `<img data-photo="${esc(p)}" alt="Photo of what's inside. Tap to view full screen." tabindex="0">`).join("")}</div>` : `<div class="nophoto">📷<br>No photos yet. Take one of what's inside.</div>`}
      <div class="btnrow"><button class="btn" id="cam">📷 Take photo</button><button class="btn" id="lib">🖼 Add from Photos</button></div>
    </div>
    ${b.photos.length > 1 ? `<div class="photohint">Swipe for more photos · tap one to view or delete it</div>` : ""}
    <div class="group" style="margin-top:22px">
      <div class="row"><span class="grow">Label</span><span class="val">${esc(b.code)}</span></div>
      <div class="row"><span class="grow">Location</span><span class="val">${esc((b.location || "").trim() || "None")}</span></div>
    </div>
    <div class="sechead">What's inside · ${b.items.length}</div>
    <div class="group">
      ${b.items.map((it, i) => `<div class="row"><span class="grow">${esc(it)}</span><button class="x" data-del="${i}" aria-label="Remove ${esc(it)}">⊖</button></div>`).join("")}
      <form class="row" id="addItem"><input id="newItem" placeholder="Add an item" enterkeyhint="done" autocomplete="off" aria-label="Add an item"><button class="icon" aria-label="Add item">⊕</button></form>
    </div>
    ${suggestions.length ? `<div class="sechead">Seen in the photos</div><div class="group"><div class="chips">${suggestions.map((w) => `<button class="chip" data-word="${esc(w)}" aria-label="Add ${esc(w)} to items">${esc(w)}</button>`).join("")}</div></div>
      <div class="secfoot">Read from your photos. Search finds these anyway; tap one to add it to the list.</div>` : ""}
    ${(b.notes || "").trim() ? `<div class="sechead">Notes</div><div class="group"><div class="row" style="white-space:pre-wrap">${esc(b.notes)}</div></div>` : ""}
    <div class="group" style="margin-top:22px">
      <a class="row act" href="#/label/${b.id}">▦&nbsp; Show QR label</a>
      <a class="row act" href="#/edit/${b.id}">✎&nbsp; Edit name, location or notes</a>
      <button class="row danger" id="del">🗑&nbsp; Delete this bin</button>
    </div></div>`;
  for (const img of app.querySelectorAll("[data-photo]")) {
    const blob = await getPhoto(img.dataset.photo); if (blob) img.src = URL.createObjectURL(blob);
    img.onclick = img.onkeydown = (e) => { if (e.type === "keydown" && e.key !== "Enter") return; viewPhoto(b.id, img.dataset.photo, img.src); };
  }
  $("cam").onclick = () => pick("camera", async (f) => { await addPhotos(b.id, f); render(); });
  $("lib").onclick = () => pick("library", async (f) => { const n = await addPhotos(b.id, f); render(); if (n) toast(n === 1 ? "Photo added." : `${n} photos added.`); });
  app.querySelectorAll("[data-del]").forEach((x) => x.onclick = async () => { b.items.splice(+x.dataset.del, 1); await putBin(b); render(); });
  app.querySelectorAll("[data-word]").forEach((x) => x.onclick = async () => { b.items.push(x.dataset.word); await putBin(b); render(); });
  $("addItem").onsubmit = async (e) => {
    e.preventDefault(); const t = $("newItem").value.trim(); if (!t) return;
    if (!b.items.some((i) => S.normalize(i) === S.normalize(t))) { b.items.push(t); await putBin(b); }
    render(); setTimeout(() => $("newItem")?.focus(), 50);
  };
  $("del").onclick = async () => {
    if (!confirm(`Delete “${S.displayName(b)}” and its photos?\n\nThis can't be undone unless it's in a backup.`)) return;
    await deleteBin(b.id); toast("Deleted."); go("#/");
  };
}
function viewPhoto(binId, name, src) {
  const v = document.createElement("div"); v.className = "viewer";
  v.innerHTML = `<div class="vbar"><button class="link" id="vdel" style="color:#ff6961">Delete photo</button><button class="link strong" id="vdone" style="color:#fff">Done</button></div><div class="vimg"><img alt="Bin photo" src="${src}"></div>`;
  document.body.appendChild(v);
  v.querySelector("#vdone").onclick = () => v.remove();
  v.querySelector("#vdel").onclick = async () => {
    if (!confirm("Delete this photo?")) return;
    const b = binById(binId); b.photos = b.photos.filter((p) => p !== name); await deletePhotoFiles(name); await putBin(b);
    v.remove(); render();
  };
}

/* ---------- New / edit ---------- */
function renderEdit(id) {
  const isNew = !id; const orig = id ? binById(id) : newBin();
  if (!orig) return go("#/");
  const b = JSON.parse(JSON.stringify(orig));
  if (isNew && !b.code) b.code = S.nextCode("", BINS);
  let codeTouched = !isNew; const pending = [];
  app.innerHTML = `<div class="page">
    <div class="bar"><button class="link" id="cancel">Cancel</button><span class="center">${isNew ? "New bin" : "Edit bin"}</span><button class="link strong" id="save">Save</button></div>
    ${isNew ? `<div class="sechead">Photos of what's inside</div><div class="group"><div class="pending" id="pend"></div>
      <div class="btnrow"><button class="btn" id="cam">📷 Take photo</button><button class="btn" id="lib">🖼 Add from Photos</button></div></div>
      <div class="secfoot">Bin Finder reads printed words in the photos (labels, packaging), so search can find them even if you don't list them.</div>` : ""}
    <div class="sechead">Bin</div><div class="group">
      <label class="row"><input id="name" placeholder="Name, like Electrical spares" value="${esc(b.name)}" autocapitalize="sentences"></label>
      <label class="row"><input id="loc" placeholder="Location, like Garage or RV front bay" value="${esc(b.location)}" list="locs" autocapitalize="words"></label>
      <label class="row"><span class="grow">Label</span><input id="code" class="code" value="${esc(b.code)}" autocapitalize="characters" autocorrect="off" aria-label="Label code"></label>
    </div>
    <datalist id="locs">${locations().map((l) => `<option value="${esc(l)}">`).join("")}</datalist>
    <div class="sechead">What's inside</div><div class="group"><label class="row"><textarea id="items" placeholder="One thing per line" aria-label="What's inside, one thing per line">${esc(b.items.join("\n"))}</textarea></label></div>
    <div class="secfoot">For example: spare fuses, zip ties, electrical tape. Commas or new lines both work. Tap the microphone on the keyboard to dictate.</div>
    <div class="sechead">Notes</div><div class="group"><label class="row"><textarea id="notes" placeholder="Anything else" style="min-height:60px" aria-label="Notes">${esc(b.notes)}</textarea></label></div>
  </div>`;
  const drawPending = () => {
    const box = $("pend"); if (!box) return;
    box.innerHTML = pending.map((p, i) => `<figure><img src="${p.url}" alt=""><button data-rm="${i}" aria-label="Remove photo">✕</button></figure>`).join("");
    box.querySelectorAll("[data-rm]").forEach((x) => x.onclick = () => { URL.revokeObjectURL(pending[+x.dataset.rm].url); pending.splice(+x.dataset.rm, 1); drawPending(); });
  };
  const addPending = (files) => { files.forEach((f) => pending.push({ file: f, url: URL.createObjectURL(f) })); drawPending(); };
  if (isNew) { $("cam").onclick = () => pick("camera", addPending); $("lib").onclick = () => pick("library", addPending); }
  $("code").addEventListener("input", () => { codeTouched = true; });
  $("loc").addEventListener("input", () => { if (!codeTouched) $("code").value = S.nextCode($("loc").value, BINS); });
  $("cancel").onclick = () => history.length > 1 ? history.back() : go("#/");
  $("save").onclick = async () => {
    $("save").disabled = true;
    const target = isNew ? b : (binById(id) || b); // start from the stored copy so words read in the background aren't lost
    target.name = $("name").value.trim();
    target.location = $("loc").value.trim();
    target.code = $("code").value.trim().toUpperCase() || S.nextCode(target.location, BINS);
    target.notes = $("notes").value;
    target.items = $("items").value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    try {
      await putBin(target);
      if (pending.length) { await addPhotos(target.id, pending.map((p) => p.file)); pending.forEach((p) => URL.revokeObjectURL(p.url)); }
      requestPersist();
      location.replace("#/bin/" + target.id);
    } catch (e) { $("save").disabled = false; toast("Couldn't save: " + e.message); }
  };
  if (isNew) setTimeout(() => $("name").focus(), 100);
}

/* ---------- Labels ---------- */
function renderLabel(id) {
  const b = binById(id); if (!b) return go("#/");
  let start = 0;
  app.innerHTML = `<div class="page">
    <div class="bar"><a class="link" href="#/bin/${b.id}">‹ Back</a><span class="center">QR label</span><span style="width:60px"></span></div>
    <div class="labelcard" style="margin-top:8px">${qrSVG(binLink(b))}<div class="lc">${esc(b.code)}</div><div class="ln">${esc(S.displayName(b))}</div>${(b.location || "").trim() ? `<div class="ll">${esc(b.location)}</div>` : ""}</div>
    <p class="sub" style="text-align:center">Stick this on the bin. Point the iPhone Camera at it and tap the link to open this bin.</p>
    <div class="sechead">Print on Avery 5163 (4 × 2 in, 10 per sheet)</div>
    <div class="group"><div class="row"><span class="grow" id="startTxt">Start at label 1 of 10</span><span class="stepper"><button id="minus" aria-label="Earlier label">−</button><button id="plus" aria-label="Later label">+</button></span></div>
      <div class="btnrow"><button class="btn primary" id="print">🖨 Print label</button></div></div>
    <div class="secfoot">Skip labels already used on a partly used sheet. Label 1 is top left, 2 is top right.</div></div>`;
  const upd = () => { $("startTxt").textContent = `Start at label ${start + 1} of 10`; };
  $("minus").onclick = () => { start = Math.max(0, start - 1); upd(); };
  $("plus").onclick = () => { start = Math.min(9, start + 1); upd(); };
  $("print").onclick = () => go(`#/print?ids=${b.id}&start=${start}`);
}
const LBL = { left: 0.15625, top: 0.5, w: 4, h: 2, gap: 0.1875 };
function renderPrint(p) {
  let bins = p.all ? [...BINS] : p.loc ? BINS.filter((b) => (b.location || "").trim() === p.loc) : (p.ids || "").split(",").map(binById).filter(Boolean);
  bins.sort(byCode);
  const start = Math.max(0, Math.min(9, parseInt(p.start || "0", 10) || 0));
  const sheets = []; let slot = start;
  for (const b of bins) {
    const page = Math.floor(slot / 10), s = slot % 10, col = s % 2, row = Math.floor(s / 2);
    (sheets[page] ||= []).push(`<div class="lbl" style="left:${LBL.left + col * (LBL.w + LBL.gap)}in;top:${LBL.top + row * LBL.h}in">${qrSVG(binLink(b))}
      <div class="t"><div class="c">${esc(b.code)}</div><div class="n">${esc(S.displayName(b))}</div>${(b.location || "").trim() ? `<div class="l">${esc(b.location)}</div>` : ""}<div class="h">Scan with iPhone Camera to see what's inside</div></div></div>`);
    slot++;
  }
  const back = p.ids && !p.ids.includes(",") ? `#/label/${p.ids}` : "#/more";
  app.innerHTML = `<div class="page">
    <div class="bar noprint"><a class="link" href="${back}">‹ Back</a><span class="center">Print labels</span><button class="link strong" id="go">Print</button></div>
    <p class="sub noprint">${bins.length} ${bins.length === 1 ? "label" : "labels"} on ${sheets.length} ${sheets.length === 1 ? "sheet" : "sheets"} of Avery 5163 (or 8163). The dashed lines only show where labels fall; they don't print. Try a plain-paper test first and hold it up to a label sheet to check the lining up.</p>
    <div class="previewwrap" id="pw"><div class="sheets preview" id="sheets">${sheets.map((s) => `<div class="sheet">${(s || []).join("")}</div>`).join("")}</div></div>
    <div class="sheets" id="printSheets">${sheets.map((s) => `<div class="sheet">${(s || []).join("")}</div>`).join("")}</div>
  </div>`;
  // Shrink the on-screen preview to fit the phone.
  const fit = () => { const w = $("pw").clientWidth, k = w / (8.5 * 96); const el = $("sheets"); el.style.transform = `scale(${k})`; el.style.width = 8.5 * 96 + "px"; $("pw").style.height = sheets.length * (11 * 96 + 12) * k + "px"; };
  fit(); window.addEventListener("resize", fit, { once: true });
  $("go").onclick = () => window.print();
}

/* ---------- More: labels and backup ---------- */
function renderMore() {
  const locs = locations();
  app.innerHTML = `<div class="page">
    <div class="bar"><a class="link" href="#/">‹ Bin Finder</a><span class="center">Labels and backup</span><span style="width:60px"></span></div>
    <div class="sechead">Print QR labels (Avery 5163, 4 × 2 in)</div>
    <div class="group"><a class="row act" href="#/print?all=1">All bins · ${BINS.length}</a>
      ${locs.map((l) => `<a class="row act" href="#/print?loc=${encodeURIComponent(l)}">${esc(l)} · ${BINS.filter((b) => (b.location || "").trim() === l).length}</a>`).join("")}</div>
    <div class="sechead">Backup</div>
    <div class="group"><button class="row act" id="backup">⇪&nbsp; Back up everything</button><button class="row act" id="restore">⇩&nbsp; Restore from a backup</button></div>
    <div class="secfoot">One file with every bin and photo. Save it to iCloud Drive or Dropbox. Backups work in both directions with the native Bin Finder app.</div>
    <div class="sechead">Good to know</div>
    <div class="group"><div class="row"><span class="grow sub">Your bins and photos are stored only in this browser on this phone; nothing is uploaded. Add Bin Finder to your Home Screen (Share › Add to Home Screen) so iOS keeps its storage. Note that the Home Screen copy and Safari keep separate bins — pick one and stick with it. QR labels open in Safari.</span></div>
      <div class="row"><span class="grow sub" id="store"></span></div></div>
  </div>`;
  $("backup").onclick = backup;
  $("restore").onclick = () => $("pickBackup").click();
  (async () => { try { const e = await navigator.storage?.estimate?.(); const p = await navigator.storage?.persisted?.(); $("store").textContent = `${BINS.length} bins, ${BINS.reduce((t, b) => t + b.photos.length, 0)} photos${e ? `, about ${(e.usage / 1048576).toFixed(1)} MB` : ""}.${p ? " Storage is protected from automatic clean-up." : ""}`; } catch {} })();
}
async function requestPersist() { try { await navigator.storage?.persist?.(); } catch {} }

const blobToB64 = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
async function backup() {
  toast("Packing up your bins…");
  const photos = {};
  for (const b of BINS) for (const p of b.photos) { const blob = await getPhoto(p); if (blob) photos[p] = await blobToB64(blob); }
  const data = { app: "bin-finder", version: 1, exported: S.isoNow(), bins: BINS, photos };
  const day = new Date().toLocaleDateString("en-CA");
  const file = new File([JSON.stringify(data)], `Bin Finder Backup ${day}.json`, { type: "application/json" });
  offerFile(file, "Backup ready", `${BINS.length} bins and ${Object.keys(photos).length} photos, ${(file.size / 1048576).toFixed(1)} MB. Save it to iCloud Drive or Dropbox.`);
}
$("pickBackup").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.app !== "bin-finder" || !Array.isArray(data.bins)) throw new Error("That file isn't a Bin Finder backup.");
    toast("Restoring…"); let n = 0;
    for (const raw of data.bins) {
      const b = Object.assign(newBin(), raw); b.id = String(b.id).toUpperCase();
      const cur = binById(b.id); if (cur && cur.updated >= b.updated) continue;
      for (const p of b.photos) {
        const b64 = data.photos?.[p]; if (!b64) continue;
        const blob = await (await fetch("data:image/jpeg;base64," + b64)).blob();
        const { thumb } = await processImage(blob);
        await savePhotoFiles(p, blob, thumb); markRead(p);
      }
      await tx("bins", "readwrite", (s) => s.put(b));
      const i = BINS.findIndex((x) => x.id === b.id); if (i >= 0) BINS[i] = b; else BINS.push(b);
      n++;
    }
    requestPersist();
    toast(n ? `Restored ${n} ${n === 1 ? "bin" : "bins"}.` : "Nothing new in that backup.");
    go("#/"); render();
  } catch (err) { toast("Couldn't restore: " + err.message); }
});

/* ---------- Start ---------- */
(async () => {
  try { db = await openDB(); await loadBins(); }
  catch (e) { app.innerHTML = `<div class="page"><div class="empty"><h2>Bin Finder can't store anything here.</h2><p>${esc(e.message)} Private Browsing blocks storage; open it in a normal Safari tab.</p></div></div>`; return; }
  render();
  // Read any photos that weren't finished last time.
  for (const b of BINS) for (const p of b.photos) if (!readSet.has(p)) queueRead(p, b.id);
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();

window.__bf = { bins: () => BINS, queue: () => queue.length + (reading ? 1 : 0) };
})();
