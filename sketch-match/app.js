// Sketch Match: the screens. The drawings and rules are in core.js; the Claude key lives in the worker, never here.
(function () {
  "use strict";
  const S = window.SketchMatch, CFG = window.SKETCH_MATCH_CONFIG || {};
  const app = document.getElementById("app"), camera = document.getElementById("camera"), library = document.getElementById("library");
  const KEY = "sm-v1";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- what is kept on this device ----------
  let store = { tries: [], grid: false, code: "", workerUrl: "" };
  try { const saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved && typeof saved === "object") store = Object.assign(store, saved); } catch (e) { /* start fresh */ }
  if (!Array.isArray(store.tries)) store.tries = [];
  function save() {
    // If the device runs out of room, let go of the oldest sketchbook pages until it fits.
    for (;;) { try { localStorage.setItem(KEY, JSON.stringify(store)); return; } catch (e) { if (!store.tries.length) return; store.tries.pop(); } }
  }
  const workerUrl = () => S.cleanWorkerUrl(CFG.workerUrl) || S.cleanWorkerUrl(store.workerUrl);
  const ready = () => !!(workerUrl() && store.code);

  let view = { name: "home", level: "all" };
  let photo = null; // the photo waiting to be sent: { send: base64 JPEG, thumb: data URL }

  // ---------- small pieces ----------
  function starRow(n, big) {
    let s = ""; for (let i = 1; i <= 5; i++) s += `<span class="${i <= n ? "on" : "off"}">★</span>`;
    return `<span class="stars${big ? " big" : ""}" role="img" aria-label="${n} out of 5 stars">${s}</span>`;
  }
  const top = (title, back) => `<header class="top">${back ? `<button class="link" data-act="${back}">‹ Back</button>` : `<span></span>`}<h1>${esc(title)}</h1><span></span></header>`;

  // ---------- screens ----------
  function home() {
    const today = S.ofTheDay(new Date());
    const shown = S.DRAWINGS.filter((d) => view.level === "all" || d.level === view.level);
    const chips = [["all", "All"]].concat(Object.entries(S.LEVELS)).map(([k, v]) => `<button class="chip${view.level === k ? " sel" : ""}" data-act="level" data-id="${k}">${v}</button>`).join("");
    return `<header class="top home"><h1>Sketch Match</h1><span class="grow"></span>
        <button class="link" data-act="book">Sketchbook${store.tries.length ? ` (${store.tries.length})` : ""}</button><button class="link" data-act="setup" aria-label="Setup">⚙</button></header>
      ${ready() ? "" : `<button class="note warn" data-act="setup">Not set up yet. A grown-up needs to open Setup before drawings can be checked.</button>`}
      <button class="today" data-act="open" data-id="${today.id}"><span class="pic">${S.svg(today)}</span>
        <span class="txt"><small>Today's sketch</small><b>${esc(today.name)}</b><span>${S.LEVELS[today.level]}</span><em>Start drawing ›</em></span></button>
      <p class="how">Pick a picture, draw it on paper, then take a photo of your drawing to see how it matches.</p>
      <div class="chips">${chips}</div>
      <div class="grid">${shown.map((d) => { const b = S.bestStars(store.tries, d.id);
        return `<button class="card" data-act="open" data-id="${d.id}"><span class="pic">${S.svg(d)}</span><b>${esc(d.name)}</b><span class="meta">${b ? starRow(b) : S.LEVELS[d.level]}</span></button>`; }).join("")}</div>`;
  }

  function draw() {
    const d = S.byId(view.id);
    const photoPart = photo
      ? `<section class="panel"><h2>Your photo</h2><img class="shot" src="${photo.thumb}" alt="Your drawing">
          ${view.error ? `<p class="note warn">${esc(view.error)}</p>` : ""}
          <div class="row"><button class="btn primary" data-act="send">Check my drawing</button><button class="btn" data-act="camera">Retake</button></div>
          <p class="fine">Your photo is sent to Claude, an AI, to look at your drawing. Make sure only your drawing is in the photo.</p></section>`
      : `<section class="panel"><h2>Finished drawing?</h2>
          <ul class="tips"><li>Lay your paper flat in good light.</li><li>Fill the photo with your drawing, and nothing else.</li><li>Hold the phone straight above it.</li></ul>
          ${view.error ? `<p class="note warn">${esc(view.error)}</p>` : ""}
          <div class="row"><button class="btn primary" data-act="camera">Take a photo</button><button class="btn" data-act="library">Choose a photo</button></div></section>`;
    return `${top(d.name, "home")}
      <div class="ref">${S.svg(d, { grid: store.grid })}</div>
      <div class="row center"><button class="chip${store.grid ? " sel" : ""}" data-act="grid" aria-pressed="${store.grid}">Grid ${store.grid ? "on" : "off"}</button><span class="fine">${S.LEVELS[d.level]}${store.grid ? " · fold your paper in half twice each way to make the same squares" : ""}</span></div>
      <section class="panel"><h2>How to start</h2><ol class="steps">${d.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>
      ${photoPart}`;
  }

  function busy() {
    const d = S.byId(view.id);
    return `${top(d.name)}<div class="busy"><div class="pair"><span class="pic">${S.svg(d)}</span><img src="${photo.thumb}" alt="Your drawing"></div>
      <div class="spinner" aria-hidden="true"></div><p role="status">Looking closely at your drawing…</p><p class="fine">This can take up to a minute.</p></div>`;
  }

  function feedbackParts(d, t) {
    const f = t.feedback;
    const items = (title, arr, cls) => arr.length ? `<section class="panel ${cls}"><h2>${title}</h2><ul>${arr.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></section>` : "";
    return `<div class="pair"><figure><span class="pic">${S.svg(d)}</span><figcaption>The picture</figcaption></figure><figure><img src="${t.thumb}" alt="Your drawing"><figcaption>Your drawing</figcaption></figure></div>
      <div class="score">${starRow(f.overall, true)}<b>${S.STAR_WORDS[f.overall]}</b><p>${esc(f.headline)}</p></div>
      ${items("What went well", f.wentWell, "good")}${items("Try this next time", f.tryNext, "next")}
      ${f.areas.length ? `<section class="panel"><h2>A closer look</h2>${f.areas.map((a) => `<div class="area"><div><b>${S.AREAS[a.area]}</b>${starRow(a.stars)}</div><p>${esc(a.note)}</p></div>`).join("")}</section>` : ""}
      ${f.challenge ? `<section class="panel challenge"><h2>Your challenge</h2><p>${esc(f.challenge)}</p></section>` : ""}`;
  }
  function result() {
    const t = view.attempt, d = S.byId(t.drawingId);
    if (!t.feedback.isDrawing) return `${top(d.name, "home")}<div class="busy"><img class="shot" src="${t.thumb}" alt="Your photo"><p class="note warn">${esc(t.feedback.headline)}</p>
      <div class="row"><button class="btn primary" data-act="open" data-id="${d.id}">Try another photo</button></div></div>`;
    return `${top(d.name, view.from || "home")}${feedbackParts(d, t)}
      <div class="row"><button class="btn primary" data-act="open" data-id="${d.id}">Draw it again</button><button class="btn" data-act="home">Pick another</button></div>
      <p class="fine center">The coach is an AI and can get things wrong. You decide what to take from it.</p>`;
  }

  function book() {
    if (!store.tries.length) return `${top("Sketchbook", "home")}<p class="empty">Your checked drawings will show up here.</p>`;
    return `${top("Sketchbook", "home")}<div class="grid">${store.tries.map((t, i) => { const d = S.byId(t.drawingId); if (!d) return "";
      return `<button class="card" data-act="try" data-id="${i}"><img src="${t.thumb}" alt=""><b>${esc(d.name)}</b><span class="meta">${starRow(t.feedback.overall)}</span><span class="fine">${esc(new Date(t.when).toLocaleDateString(undefined, { month: "short", day: "numeric" }))}</span></button>`; }).join("")}</div>
      <p class="fine center">Kept on this device only (the newest ${S.MAX_TRIES}).</p>`;
  }

  function setup() {
    const fixed = S.cleanWorkerUrl(CFG.workerUrl);
    return `${top("Setup", "home")}<section class="panel"><h2>For a grown-up</h2>
      <p>Sketch Match checks drawings with Claude, an AI made by Anthropic. It reaches Claude through your own small worker script, so the Claude key is never on this device. The steps are in the app's <b>worker/SETUP.md</b> file.</p>
      ${fixed ? `<p class="fine">Worker address: ${esc(fixed)}</p>` : `<label>Worker address<input id="url" type="url" inputmode="url" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="https://sketch-match.your-name.workers.dev" value="${esc(store.workerUrl)}"></label>`}
      <label>Family code<input id="code" type="password" autocapitalize="off" autocomplete="off" spellcheck="false" value="${esc(store.code)}"></label>
      ${view.msg ? `<p class="note ${view.ok ? "ok" : "warn"}" role="status">${esc(view.msg)}</p>` : ""}
      <div class="row"><button class="btn primary" data-act="saveSetup">Save and test</button></div></section>
      <section class="panel"><h2>What leaves this device</h2><p>Only when "Check my drawing" is tapped: the picture to copy and the photo of the drawing go to your worker, and from there to Anthropic's Claude API. Nothing else is sent, and the sketchbook stays on this device.</p>
      ${store.tries.length ? `<div class="row"><button class="btn danger" data-act="clear">Empty the sketchbook</button></div>` : ""}</section>`;
  }

  const SCREENS = { home, draw, busy, result, book, setup };
  function render() { app.innerHTML = SCREENS[view.name](); }
  function go(v) { view = v; render(); window.scrollTo(0, 0); }

  // ---------- pictures ----------
  const loadImage = (src) => new Promise((ok, fail) => { const img = new Image(); img.onload = () => ok(img); img.onerror = () => fail(new Error("image")); img.src = src; });
  function toCanvas(img, w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h); return c; }
  const afterComma = (dataUrl) => dataUrl.slice(dataUrl.indexOf(",") + 1);
  async function readPhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url), w = img.naturalWidth, h = img.naturalHeight;
      const big = S.fitSize(w, h, 1568), small = S.fitSize(w, h, 480);
      return { send: afterComma(toCanvas(img, big.w, big.h).toDataURL("image/jpeg", 0.85)), thumb: toCanvas(img, small.w, small.h).toDataURL("image/jpeg", 0.7) };
    } finally { URL.revokeObjectURL(url); }
  }
  async function referencePng(d) {
    const url = URL.createObjectURL(new Blob([S.svg(d, { size: 768 })], { type: "image/svg+xml" }));
    try { return afterComma(toCanvas(await loadImage(url), 768, 768).toDataURL("image/png")); } finally { URL.revokeObjectURL(url); }
  }
  async function picked(input) {
    const file = input.files && input.files[0]; input.value = "";
    if (!file || view.name !== "draw") return;
    try { photo = await readPhoto(file); view.error = ""; } catch (e) { photo = null; view.error = "That photo couldn't be opened. Try taking it again."; }
    render();
  }
  camera.addEventListener("change", () => picked(camera));
  library.addEventListener("change", () => picked(library));

  // ---------- the worker ----------
  async function ask(body) {
    const stop = new AbortController(), timer = setTimeout(() => stop.abort(), 120000);
    try {
      const res = await fetch(workerUrl(), { method: "POST", headers: { "content-type": "application/json", "x-family-code": store.code }, body: JSON.stringify(body), signal: stop.signal });
      let data = null; try { data = await res.json(); } catch (e) { data = null; }
      if (!res.ok || !data || !data.ok) return { ok: false, code: (data && data.code) || "service" };
      return data;
    } catch (e) { return { ok: false, code: "offline" }; } finally { clearTimeout(timer); }
  }
  async function send() {
    const d = S.byId(view.id);
    if (!ready()) { view.error = S.explain("not_set_up"); return render(); }
    go({ name: "busy", id: d.id });
    let answer;
    try { answer = await ask(S.requestBody(d, await referencePng(d), photo.send)); } catch (e) { answer = { ok: false, code: "bad_request" }; }
    const feedback = answer.ok ? S.tidyFeedback(answer.feedback) : null;
    if (!feedback) return go({ name: "draw", id: d.id, error: S.explain(answer.ok ? "service" : answer.code) });
    const attempt = { drawingId: d.id, when: Date.now(), thumb: photo.thumb, feedback };
    if (feedback.isDrawing) { store.tries = S.addTry(store.tries, attempt); save(); }
    photo = null;
    go({ name: "result", attempt });
  }
  async function saveSetup() {
    const urlBox = document.getElementById("url"), code = document.getElementById("code").value.trim();
    if (urlBox) { const u = S.cleanWorkerUrl(urlBox.value); if (!u) { view.msg = "The worker address should look like https://sketch-match.your-name.workers.dev"; view.ok = false; return render(); } store.workerUrl = u; }
    store.code = code; save();
    if (!ready()) { view.msg = "Enter the family code."; view.ok = false; return render(); }
    view.msg = "Testing…"; view.ok = true; render();
    const r = await ask({ ping: true });
    if (view.name !== "setup") return;
    view.ok = !!r.ok; view.msg = r.ok ? "It works. Sketch Match is ready." : S.explain(r.code); render();
  }

  // ---------- taps ----------
  app.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    if (act === "home") { photo = null; go({ name: "home", level: view.level || "all" }); }
    else if (act === "level") { view.level = id; render(); }
    else if (act === "open") { photo = null; go({ name: "draw", id }); }
    else if (act === "grid") { store.grid = !store.grid; save(); render(); }
    else if (act === "camera") camera.click();
    else if (act === "library") library.click();
    else if (act === "send") send();
    else if (act === "book") go({ name: "book" });
    else if (act === "try") go({ name: "result", attempt: store.tries[+id], from: "book" });
    else if (act === "setup") go({ name: "setup" });
    else if (act === "saveSetup") saveSetup();
    else if (act === "clear") { if (confirm("Empty the sketchbook? This removes every saved drawing and its feedback from this device.")) { store.tries = []; save(); render(); } }
  });

  render();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
