// Fit the Part: the screens. Draws each part with its dimensions, takes the missing numbers from an
// on-screen keypad, checks them, and ends each puzzle with a small part to model in SolidWorks.
(function () {
  "use strict";
  const G = self.FTP, app = document.getElementById("app");
  const f = G.fmt;
  const f1 = (n) => (Math.round(n * 10) / 10).toString();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- saved on this device ----------
  const KEY = "ftp-v1";
  const save = { done: {} };   // done[puzzle id] = { stars, n: times solved, set: numbers last solved with }
  try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* private mode: play without saving */ }
  if (!save.done || typeof save.done !== "object") save.done = {};
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };
  const doneOf = (id) => { const d = save.done[id]; return d && isFinite(d.stars) ? d : null; };

  // ---------- drawing a part ----------
  const starsHtml = (n) => `<span class="st">${"★".repeat(n)}<i>${"★".repeat(3 - n)}</i></span>`;
  function shapes(m, k) {
    let s = "";
    if (m.outline.circle) { const r = m.outline.circle / 2 * k; s += `<circle class="part" cx="${f1(r)}" cy="${f1(r)}" r="${f1(r)}"/>`; }
    else s += `<path class="part" d="${m.outline.map((p, i) => (i ? "L" : "M") + f1(p[0] * k) + " " + f1(p[1] * k)).join("")}Z"/>`;
    for (const c of m.cuts || []) s += `<rect class="hole" x="${f1((c.x - c.w / 2) * k)}" y="${f1((c.y - c.h / 2) * k)}" width="${f1(c.w * k)}" height="${f1(c.h * k)}" rx="${f1(c.r * k)}"/>`;
    for (const h of m.holes || []) s += `<circle class="hole" cx="${f1(h.x * k)}" cy="${f1(h.y * k)}" r="${f1(h.d / 2 * k)}"/>`;
    return s;
  }
  function size(m) {
    if (m.outline.circle) return { w: m.outline.circle, h: m.outline.circle };
    return { w: Math.max(...m.outline.map((p) => p[0])), h: Math.max(...m.outline.map((p) => p[1])) };
  }
  function thumb(p, px) {
    const m = p.draw(G.values(p, 0)), b = size(m), k = (px - 8) / Math.max(b.w, b.h);
    return `<svg class="thumb" viewBox="${f1(-(px - b.w * k) / 2)} ${f1(-(px - b.h * k) / 2)} ${px} ${px}" width="${px}" height="${px}" aria-hidden="true">${shapes(m, k)}</svg>`;
  }
  // The full drawing. `shown(name)` says how a dimension reads: { text } for a number, or { ask: letter } for a missing one.
  function drawing(p, v, shown) {
    const m = p.draw(v), b = size(m), k = Math.min(232 / b.w, 172 / b.h), PW = b.w * k, PH = b.h * k;
    let x0 = 0, y0 = 0, x1 = PW, y1 = PH;
    const grow = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    const arrow = (x, y, dx, dy) => `<path class="ah" d="M${f1(x)} ${f1(y)}L${f1(x - dx * 7 - dy * 2.6)} ${f1(y - dy * 7 + dx * 2.6)}L${f1(x - dx * 7 + dy * 2.6)} ${f1(y - dy * 7 - dx * 2.6)}Z"/>`;
    const labelW = (s) => (s.ask ? 24 : s.text.length * 7.3 + 6);
    function label(s, name, x, y) {
      const w = labelW(s);
      grow(x - w / 2, y - 11); grow(x + w / 2, y + 11);
      if (s.ask) return `<g class="unk${s.sel ? " sel" : ""}" data-u="${name}"><rect x="${f1(x - 12)}" y="${f1(y - 11)}" width="24" height="22" rx="6"/><text x="${f1(x)}" y="${f1(y + 5)}">${s.ask}</text></g>`;
      return `<text class="dt${s.found ? " found" : ""}" x="${f1(x)}" y="${f1(y + 4.5)}">${esc(s.text)}</text>`;
    }
    let lines = "", labels = "";
    for (const d of m.dims) {
      const s = Object.assign({}, shown(d.n));
      if (d.dia && s.text) s.text = "⌀" + s.text;
      const w = labelW(s);
      if (d.t === "h") {
        const top = d.side === "t", yD = top ? -(22 + 26 * (d.row - 1)) : PH + 22 + 26 * (d.row - 1), dir = top ? -1 : 1;
        const xa = d.a * k, xb = d.b * k, edge = top ? 0 : b.h;
        for (const [x, e] of [[xa, d.ea], [xb, d.eb]]) lines += `<path class="ext" d="M${f1(x)} ${f1((e == null ? edge : e) * k + dir * 3)}V${f1(yD + dir * 5)}"/>`;
        const tight = xb - xa < w + 20;
        if (tight) lines += `<path class="dl" d="M${f1(xa - 11)} ${f1(yD)}H${f1(xb + 11)}"/>` + arrow(xa, yD, 1, 0) + arrow(xb, yD, -1, 0);
        else lines += `<path class="dl" d="M${f1(xa)} ${f1(yD)}H${f1(xb)}"/>` + arrow(xa, yD, -1, 0) + arrow(xb, yD, 1, 0);
        labels += label(s, d.n, (xa + xb) / 2, tight ? yD + dir * 15 : yD);
        grow(xa - 12, yD - 6); grow(xb + 12, yD + 6);
      } else if (d.t === "v") {
        const left = d.side === "l", xD = left ? -(28 + 42 * (d.row - 1)) : PW + 28 + 42 * (d.row - 1), dir = left ? -1 : 1;
        const ya = d.a * k, yb = d.b * k, edge = left ? 0 : b.w;
        for (const [y, e] of [[ya, d.ea], [yb, d.eb]]) lines += `<path class="ext" d="M${f1((e == null ? edge : e) * k + dir * 3)} ${f1(y)}H${f1(xD + dir * 5)}"/>`;
        const tight = yb - ya < 44;
        if (tight) lines += `<path class="dl" d="M${f1(xD)} ${f1(ya - 11)}V${f1(yb + 11)}"/>` + arrow(xD, ya, 0, 1) + arrow(xD, yb, 0, -1);
        else lines += `<path class="dl" d="M${f1(xD)} ${f1(ya)}V${f1(yb)}"/>` + arrow(xD, ya, 0, -1) + arrow(xD, yb, 0, 1);
        labels += label(s, d.n, tight ? xD + dir * (w / 2 + 5) : xD, (ya + yb) / 2);
        grow(xD - 6, ya - 12); grow(xD + 6, yb + 12);
      } else {
        const a = d.ang * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), r = d.d / 2 * k, len = d.len ? d.len * k : 20;
        const ex = d.x * k + ux * r, ey = d.y * k + uy * r, bx = ex + ux * len, by = ey + uy * len, side = ux < 0 ? -1 : 1;
        if (s.text) s.text = "⌀" + s.text;
        const tw = s.ask ? 38 : labelW(s);
        lines += `<path class="dl" d="M${f1(ex)} ${f1(ey)}L${f1(bx)} ${f1(by)}h${side * 7}"/>` + arrow(ex, ey, -ux, -uy);
        if (s.ask) labels += `<text class="dt" x="${f1(bx + (side > 0 ? 15 : -39))}" y="${f1(by + 4.5)}">⌀</text>` + label(s, d.n, bx + (side > 0 ? 34 : -20), by);
        else labels += label(s, d.n, bx + side * (9 + tw / 2), by);
      }
    }
    let center = "";
    if (m.center) { center = `<path class="cl" d="M${f1(m.center[0][0] * k)} ${f1(m.center[0][1] * k)}L${f1(m.center[1][0] * k)} ${f1(m.center[1][1] * k)}"/>`; grow(m.center[0][0] * k, 0); grow(m.center[1][0] * k, 0); }
    const pad = 8, W = Math.max(330, x1 - x0 + 2 * pad), H = y1 - y0 + 2 * pad;
    const vx = (x0 + x1) / 2 - W / 2, vy = y0 - pad;
    return `<svg class="draw" viewBox="${f1(vx)} ${f1(vy)} ${f1(W)} ${f1(H)}" style="aspect-ratio:${f1(W)}/${f1(H)}" role="img" aria-label="Drawing of the ${esc(p.name.toLowerCase())} with its dimensions">${shapes(m, k)}${center}${lines}${labels}</svg>`;
  }

  // ---------- screens ----------
  let view = { name: "home" };
  const solvedCount = () => G.PUZZLES.filter((p) => doneOf(p.id)).length;
  const starCount = () => G.PUZZLES.reduce((n, p) => n + (doneOf(p.id) ? doneOf(p.id).stars : 0), 0);

  function home() {
    const n = solvedCount(), next = G.byId(G.nextId(save.done, view.last || ""));
    let h = `<header class="top"><img class="logo" src="icon.svg" alt=""><div><h1>Fit the Part</h1><p>Work out the missing dimensions from the clues.</p></div></header>`;
    h += `<button class="big" data-go="${next.id}">${n === 0 ? "Start with the first puzzle" : n === G.PUZZLES.length ? "Play again with new numbers" : "Next puzzle: " + esc(next.name)}</button>`;
    h += `<p class="tally">${n} of ${G.PUZZLES.length} solved · ${starCount()} of ${G.PUZZLES.length * 3} stars</p>`;
    G.LEVELS.forEach((lv, i) => {
      h += `<h2>${lv.name}</h2><p class="blurb">${lv.blurb}</p><ul class="list">`;
      for (const p of G.PUZZLES.filter((q) => q.level === i)) {
        const d = doneOf(p.id);
        h += `<li><button data-go="${p.id}">${thumb(p, 46)}<span class="nm"><b>${esc(p.name)}</b><small>${p.ask.length} missing number${p.ask.length === 1 ? "" : "s"}</small></span><span class="sc">${d ? starsHtml(d.stars) : "<small>not yet</small>"}</span></button></li>`;
      }
      h += "</ul>";
    });
    h += `<div class="foot"><button data-view="ideas">Project ideas (${n})</button><button data-view="help">How to play</button></div>`;
    app.innerHTML = h;
  }

  function start(id) {
    const p = G.byId(id), d = doneOf(id), set = d ? (d.n || 0) % p.sets.length : 0;
    view = { name: "play", p, set, v: G.values(p, set), typed: {}, ok: {}, bad: {}, sel: p.ask[0].n, hints: 0, misses: 0, done: false, msg: "" };
    render(); window.scrollTo(0, 0);
  }

  function play() {
    const s = view, p = s.p, v = s.v;
    const shown = (name) => {
      const L = G.letter(p, name);
      if (!L) return { text: f(v[name]) };
      if (s.ok[name]) return { text: f(v[name]), found: true };
      return { ask: L, sel: s.sel === name };
    };
    let h = `<div class="bar"><button data-view="home">‹ Puzzles</button><span>${esc(p.name)}</span><em>${G.LEVELS[p.level].name}</em></div>`;
    h += `<div class="pic">${drawing(p, v, shown)}<p>Decimal inches. Drawn to scale.</p></div>`;
    h += `<ol class="clues">${p.clues.map((c) => `<li>${esc(G.clueText(c, v))}</li>`).join("")}</ol>`;
    if (!s.done) {
      const how = p.how(v, f);
      if (s.hints) h += `<div class="hints"><b>Hint${s.hints > 1 ? "s" : ""}</b>${how.slice(0, s.hints).map((t) => `<p>${esc(t)}</p>`).join("")}</div>`;
      h += `<div class="answers">${p.ask.map((q) => {
        const cls = s.ok[q.n] ? "ok" : s.bad[q.n] ? "bad" : s.sel === q.n ? "sel" : "";
        const val = s.ok[q.n] ? f(v[q.n]) : s.typed[q.n] || "";
        return `<button class="ans ${cls}" data-u="${q.n}"${s.ok[q.n] ? " disabled" : ""}><span class="lt">${G.letter(p, q.n)}</span><span class="wh">${esc(q.what)}</span><span class="val">${esc(val) || "&nbsp;"}${s.ok[q.n] ? " ✓" : ""}</span></button>`;
      }).join("")}</div>`;
      h += `<p class="msg" aria-live="polite">${esc(s.msg) || "&nbsp;"}</p>`;
      h += `<div class="pad">${"1234567890.".split("").map((c) => `<button data-k="${c}">${c}</button>`).join("")}<button data-k="del" aria-label="Delete">⌫</button></div>`;
      h += `<div class="acts"><button data-act="hint"${s.hints >= how.length ? " disabled" : ""}>Hint</button><button class="go" data-act="check">Check</button></div>`;
    } else {
      const st = G.stars(s.misses), idea = p.idea(v, f), nx = G.byId(G.nextId(save.done, p.id));
      h += `<div class="res"><div class="said">${starsHtml(st)}<p>${st === 3 ? "Fits first time." : st === 2 ? "It fits." : "It fits, with a bit of filing."}</p></div></div>`;
      h += `<h3>How it works out</h3><ol class="how">${p.how(v, f).map((t) => `<li>${esc(t)}</li>`).join("")}</ol>`;
      h += `<div class="idea"><small>Rainy-day project in SolidWorks</small><h3>${esc(idea.name)}</h3><p>${esc(idea.what)}</p><ol>${idea.steps.map((t) => `<li>${esc(t)}</li>`).join("")}</ol></div>`;
      h += `<h3>The clues, the SolidWorks way</h3><ul class="sw">${p.clues.map((c) => `<li><b>${esc(G.clueText(c, v))}</b> ${esc(c.sw)}</li>`).join("")}</ul>`;
      h += `<button class="big" data-go="${nx.id}">${doneOf(nx.id) ? "Play again: " : "Next puzzle: "}${esc(nx.name)}</button><button class="plain" data-view="home">All puzzles</button>`;
    }
    app.innerHTML = h;
  }

  function pick(name) { const s = view; if (s.done || s.ok[name]) return; s.sel = name; if (s.bad[name]) { delete s.bad[name]; s.typed[name] = ""; } s.msg = ""; render(); }
  function key(k) {
    const s = view;
    if (s.name !== "play" || s.done || !s.sel) return;
    let t = s.typed[s.sel] || "";
    if (s.bad[s.sel]) { t = ""; delete s.bad[s.sel]; }
    if (k === "del") t = t.slice(0, -1);
    else if (k === ".") { if (!t.includes(".")) t = (t || "0") + "."; }
    else if (t.length < 6) t = t === "0" ? k : t + k;
    s.typed[s.sel] = t; s.msg = ""; render();
  }
  function check() {
    const s = view, p = s.p;
    const open = p.ask.filter((q) => !s.ok[q.n]), filled = open.filter((q) => (s.typed[q.n] || "") !== "");
    if (!filled.length) { s.msg = `Type a number for ${G.letter(p, open[0].n)} first.`; s.sel = open[0].n; return render(); }
    let wrong = 0;
    for (const q of filled) {
      if (G.isRight(s.v[q.n], G.parse(s.typed[q.n]))) { s.ok[q.n] = true; delete s.bad[q.n]; }
      else { s.bad[q.n] = true; wrong++; s.misses++; }
    }
    const left = p.ask.filter((q) => !s.ok[q.n]);
    if (!left.length) {
      const st = G.stars(s.misses), d = doneOf(p.id);
      save.done[p.id] = { stars: Math.max(st, d ? d.stars : 0), n: (d ? d.n || 0 : 0) + 1, set: s.set };
      keep(); s.done = true; view.last = p.id; render();
      const r = app.querySelector(".res"); if (r && r.scrollIntoView) r.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    s.sel = (left.find((q) => !s.bad[q.n]) || left[0]).n;
    s.msg = wrong ? (wrong === 1 ? "One doesn't fit yet. Tap it and try again, or ask for a hint." : "Those don't fit yet. Try again, or ask for a hint.") : "Good. Now the next one.";
    render();
  }
  function hint() { const s = view; if (s.hints < s.p.how(s.v, f).length) { s.hints++; s.misses++; s.msg = ""; render(); } }

  function ideas() {
    const got = G.PUZZLES.filter((p) => doneOf(p.id));
    let h = `<div class="bar"><button data-view="home">‹ Puzzles</button><span>Project ideas</span><em>${got.length} of ${G.PUZZLES.length}</em></div>`;
    if (!got.length) h += `<p class="empty">Every solved puzzle adds a small part here that you could model in SolidWorks. Nothing yet: solve a puzzle to collect the first one.</p>`;
    for (const p of got) {
      const d = doneOf(p.id), v = G.values(p, d.set || 0), idea = p.idea(v, f);
      h += `<details class="idea"><summary>${thumb(p, 46)}<span class="nm"><b>${esc(idea.name)}</b><small>from “${esc(p.name)}”</small></span></summary><p>${esc(idea.what)}</p><ol>${idea.steps.map((t) => `<li>${esc(t)}</li>`).join("")}</ol></details>`;
    }
    if (got.length) h += `<p class="note">The sizes are from the last time you solved each puzzle. They are only a starting point: measure the real thing and change them.</p>`;
    app.innerHTML = h;
  }

  function help() {
    app.innerHTML = `<div class="bar"><button data-view="home">‹ Puzzles</button><span>How to play</span><em></em></div>
<ol class="steps">
<li>Each puzzle is a flat part with its dimensions. A few are missing and show a letter (A, B, C) instead of a number.</li>
<li>Read the clues under the drawing, such as “the hole is centered” or “the slot is twice as wide as a tab”, and work out each missing number.</li>
<li>Tap a letter, type the number on the keypad and tap Check. Sizes are in decimal inches, the way SolidWorks shows them: one and a half is 1.5, three eighths is 0.375.</li>
<li>Stuck? Hint shows the next line of the working. Three stars for no misses and no hints, two for one or two, one after that.</li>
<li>When the part fits you get the working, a small part to model in SolidWorks, and how each clue would be set up there as a relation or an equation.</li>
</ol>
<p class="note">Play a puzzle again and the numbers change. Solved puzzles collect under Project ideas for a rainy day.</p>
<p class="note">Everything is saved on this device only, and the app works with no signal.</p>
<button class="plain" data-act="reset">Erase my stars and start over</button>`;
  }

  function render() {
    if (view.name === "play") play(); else if (view.name === "ideas") ideas(); else if (view.name === "help") help(); else home();
  }

  app.addEventListener("click", (e) => {
    const t = e.target.closest("[data-go],[data-view],[data-u],[data-k],[data-act]");
    if (!t) return;
    if (t.dataset.go) return start(t.dataset.go);
    if (t.dataset.view) { view = { name: t.dataset.view, last: view.last || (view.p && view.p.id) }; render(); window.scrollTo(0, 0); return; }
    if (t.dataset.u) return pick(t.dataset.u);
    if (t.dataset.k) return key(t.dataset.k);
    if (t.dataset.act === "check") return check();
    if (t.dataset.act === "hint") return hint();
    if (t.dataset.act === "reset" && confirm("Erase all stars and project ideas on this device?")) { save.done = {}; keep(); view = { name: "home" }; render(); }
  });
  // A real keyboard works too (handy on the PC).
  document.addEventListener("keydown", (e) => {
    if (view.name !== "play" || view.done || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[0-9.]$/.test(e.key)) key(e.key);
    else if (e.key === "Backspace") key("del");
    else if (e.key === "Enter") check();
    else if (e.key === "Tab") {
      const open = view.p.ask.filter((q) => !view.ok[q.n]);
      if (open.length) pick(open[(open.findIndex((q) => q.n === view.sel) + 1) % open.length].n);
    } else return;
    e.preventDefault();
  });

  render();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => { /* offline copy is a bonus */ });
})();
