// Bend It Right: the screens. Shows the picture and the bench, takes taps and drags on the wire,
// then lays the picture over the bent wire to score it. Best tries are kept as patterns.
(function () {
  "use strict";
  const G = self.BIR, app = document.getElementById("app");
  const U = 100;                 // bench drawing units per inch
  const DEG = G.DEG;
  const f1 = (n) => (Math.round(n * 10) / 10).toString();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = G.fmtIn;

  // ---------- saved on this device ----------
  const KEY = "bir-v1";
  const save = { best: {} };   // best[shape id] = { score, bends }
  try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* private mode: play without saving */ }
  if (!save.best || typeof save.best !== "object") save.best = {};
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };
  const bestOf = (id) => {
    const b = save.best[id];
    return b && Array.isArray(b.bends) && isFinite(b.score) ? b : null;
  };
  const inBook = (id) => { const b = bestOf(id); return !!b && b.score >= G.STARS[0]; };

  // ---------- drawing helpers ----------
  const pathD = (pts, k) => pts.map((p, i) => (i ? "L" : "M") + f1(p.x * k) + " " + f1(p.y * k)).join("");
  const starsHtml = (n) => `<span class="st">${"★".repeat(n)}<i>${"★".repeat(3 - n)}</i></span>`;
  // Scale points to sit centred in a W x H box with `pad` clear all round.
  function fitted(pts, W, H, pad) {
    const b = G.bbox(pts), k = Math.min((W - 2 * pad) / Math.max(b.w, 0.01), (H - 2 * pad) / Math.max(b.h, 0.01));
    const ox = (W - b.w * k) / 2 - b.x0 * k, oy = (H - b.h * k) / 2 - b.y0 * k;
    return { k, pts: pts.map((p) => ({ x: p.x * k + ox, y: p.y * k + oy })) };
  }
  const copper = (d) => `<path class="w0" d="${d}"/><path class="w1" d="${d}"/><path class="w2" d="${d}"/>`;
  function thumb(pts, size) {
    const f = fitted(pts, size, size, 5);
    return `<svg class="thumb" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${copper(pathD(f.pts, 1))}</svg>`;
  }
  const unit = (a, b) => { const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; };
  // A drawing of a wire with end letters; opts.legs prints each leg's length, opts.nums numbers the bends.
  function drawing(wire, start, W, H, opts) {
    const raw = G.wirePoints(wire, start), f = fitted(raw, W, H, opts.pad || 30), p = f.pts, n = p.length;
    let cx = 0, cy = 0;
    for (const q of p) { cx += q.x; cy += q.y; }
    cx /= n; cy /= n;
    let out = opts.copper ? copper(pathD(p, 1)) : `<path class="ink" d="${pathD(p, 1)}"/>`, lab = "";
    if (opts.legs) {
      const L = G.legLengths(wire);
      // Each length goes beside the middle of its leg, on whichever side is clearer of the rest of the drawing.
      const placed = [];
      for (let i = 0; i < n - 1; i++) {
        const u = unit(p[i], p[i + 1]), mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2;
        let best = null;
        for (const sgn of [1, -1]) {
          const x = mx - u.y * sgn * 17, y = my + u.x * sgn * 12;
          let clear = G.nearest(p, x, y, (leg) => leg === i).d;
          for (const q of placed) clear = Math.min(clear, Math.hypot((q.x - x) * 0.6, q.y - y));
          clear += ((x - cx) * -u.y * sgn + (y - cy) * u.x * sgn > 0 ? 3 : 0);   // a slight lean toward the outside
          if (!best || clear > best.clear) best = { x, y, clear };
        }
        placed.push(best);
        lab += `<text class="dim" x="${f1(best.x)}" y="${f1(best.y + 4)}">${fmt(L[i], false)}</text>`;
      }
    }
    if (opts.nums) {
      for (let i = 1; i < n - 1; i++) {
        const a = unit(p[i - 1], p[i]), b = unit(p[i], p[i + 1]);
        let ox = a.x - b.x, oy = a.y - b.y;
        const l = Math.hypot(ox, oy);
        if (l < 0.05) { ox = -a.y; oy = a.x; } else { ox /= l; oy /= l; }
        lab += `<g transform="translate(${f1(p[i].x + ox * 15)} ${f1(p[i].y + oy * 15)})"><circle class="numdot" r="9"/><text class="num" y="4">${i}</text></g>`;
      }
    }
    const a = unit(p[1], p[0]), z = unit(p[n - 2], p[n - 1]);
    const apart = Math.hypot(p[0].x - p[n - 1].x, p[0].y - p[n - 1].y) < 26;
    lab += `<circle class="enddot" cx="${f1(p[0].x)}" cy="${f1(p[0].y)}" r="4.5"/><text class="endlab" x="${f1(p[0].x + a.x * 15)}" y="${f1(p[0].y + a.y * 15 + 5)}">A</text>`;
    if (!apart || opts.nums) lab += `<text class="endlab" x="${f1(p[n - 1].x + z.x * 15)}" y="${f1(p[n - 1].y + z.y * 15 + 5)}">B</text>`;
    return `<svg class="${opts.cls || "draw"}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || "")}">${out}${lab}</svg>`;
  }
  const specText = (wire) => { const n = wire.bends.length; return `${fmt(wire.len)} of wire · ${n} bend${n === 1 ? "" : "s"}`; };

  // ---------- home ----------
  function home() {
    let got = 0, book = 0;
    for (const s of G.SHAPES) { const b = bestOf(s.id); if (b) got += G.stars(b.score); if (inBook(s.id)) book++; }
    let html = `<header class="top"><img class="logo" src="icon.svg" alt=""><div><h1>Bend It Right</h1><p>Bend the wire to match the picture.</p></div></header>` +
      `<p class="tally">${got} of ${G.SHAPES.length * 3} stars</p>` +
      `<button class="plain" data-go="book">Pattern book${book ? ` (${book})` : ""}</button>`;
    for (const t of G.TIERS) {
      html += `<h2>${esc(t.name)}</h2><p class="blurb">${esc(t.blurb)}</p><ul class="shapes">`;
      for (const s of G.SHAPES.filter((x) => x.tier === t.id)) {
        const b = bestOf(s.id);
        html += `<li><button data-play="${s.id}">${thumb(G.shapePoints(s), 46)}<span class="nm"><b>${esc(s.name)}</b><small>${specText(s.wire)}</small></span>` +
          `<span class="sc">${starsHtml(b ? G.stars(b.score) : 0)}${b ? `<small>best ${b.score}</small>` : ""}</span></button></li>`;
      }
      html += `</ul>`;
    }
    html += `<div class="foot"><button data-go="help">How to play</button></div>`;
    app.innerHTML = html;
    scrollTo(0, 0);
  }

  // ---------- playing a shape ----------
  let st = null;   // the shape on the bench
  function play(id) {
    const shape = G.shapeById(id);
    if (!shape) return home();
    st = { shape, bends: [], sel: -1, hist: [], result: null, fresh: false, drag: null };
    const b = bestOf(id), pic = shape.tier > 1;
    app.innerHTML =
      `<div class="bar"><button data-go="home">‹ Shapes</button><span>${esc(shape.name)}</span><em id="best">${b ? "Best " + b.score : ""}</em></div>` +
      (pic
        ? `<div class="pic">${drawing(shape.wire, shape.start, 340, shape.tier === 2 ? 156 : 130, { legs: shape.tier === 2, pad: shape.tier === 2 ? 30 : 20, cls: "draw t" + shape.tier, label: "Picture of the " + shape.name })}<p>${specText(shape.wire)}${shape.tier === 2 ? " · lengths in inches" : ""}</p></div>`
        : `<p class="spec">${specText(shape.wire)}. Bend it to cover the pale line.</p>`) +
      `<div class="bench${pic ? "" : " tall"}"><svg id="bench" role="img" aria-label="The bench with your wire"></svg></div>` +
      `<div id="panel" class="panel"></div>` +
      `<div class="acts" id="acts"><button data-act="undo">Undo</button><button data-act="reset">Straighten</button><button class="go" data-act="check">Check it</button></div>`;
    scrollTo(0, 0);
    setView();
    paint();
  }
  const myWire = () => ({ len: st.shape.wire.len, heading: st.shape.wire.heading, bends: st.bends });

  // The part of the bench that shows: the picture's size plus a margin, grown to fill the bench's own outline.
  function setView() {
    const svg = document.getElementById("bench");
    if (!svg || !st) return;
    let show = G.shapePoints(st.shape);
    if (st.result) {   // after a check: fit in the whole wire and the picture laid over it
      const q = st.result.place, c = Math.cos(q.rot), s = Math.sin(q.rot);
      show = show.map((p) => ({ x: c * p.x - s * p.y + q.tx, y: s * p.x + c * p.y + q.ty })).concat(G.wirePoints(myWire(), st.shape.start));
    }
    const b = G.bbox(show), pad = st.result ? 0.6 : 0.9;
    let x = b.x0 - pad, y = b.y0 - pad, w = b.w + 2 * pad, h = b.h + 2 * pad;
    const r = (svg.clientWidth || 340) / (svg.clientHeight || 300);
    if (w / h < r) { x -= (h * r - w) / 2; w = h * r; } else { y -= (w / r - h) / 2; h = w / r; }
    st.view = { x, y, w, h };
    svg.setAttribute("viewBox", `${f1(x * U)} ${f1(y * U)} ${f1(w * U)} ${f1(h * U)}`);
    let fine = "", bold = "";
    for (let i = Math.ceil(x * 2); i <= (x + w) * 2; i++) { const s = `M${i * U / 2} ${f1(y * U)}v${f1(h * U)}`; if (i % 2) fine += s; else bold += s; }
    for (let i = Math.ceil(y * 2); i <= (y + h) * 2; i++) { const s = `M${f1(x * U)} ${i * U / 2}h${f1(w * U)}`; if (i % 2) fine += s; else bold += s; }
    svg.innerHTML = `<path class="grid" d="${fine}"/><path class="grid inch" d="${bold}"/>` +
      `<text class="scale" x="${f1((x + w) * U - 10)}" y="${f1((y + h) * U - 10)}">bold squares are 1 inch</text>` +
      (st.shape.tier === 1 ? `<path class="guide" d="${pathD(G.shapePoints(st.shape), U)}"/>` : "") + `<g id="wire"></g>`;
  }

  function paint() {
    const g = document.getElementById("wire");
    if (!g || !st) return;
    const sh = st.shape, pts = G.wirePoints(myWire(), sh.start), d = pathD(pts, U), n = pts.length;
    let out = "";
    if (st.result) {
      const p = st.result.place, c = Math.cos(p.rot), s = Math.sin(p.rot);
      out += `<path class="ghost" d="${pathD(G.shapePoints(sh), U)}" transform="matrix(${c} ${s} ${-s} ${c} ${f1(p.tx * U)} ${f1(p.ty * U)})"/>`;
    }
    const ghost = out;
    out = copper(d) + ghost;
    for (let i = 1; i < n - 1; i++) {
      const x = f1(pts[i].x * U), y = f1(pts[i].y * U);
      if (i - 1 === st.sel && !st.result) out += `<circle class="ring" cx="${x}" cy="${y}" r="26"/>`;
      out += `<circle class="mark${st.bends[i - 1].a === 0 ? " flat" : ""}" cx="${x}" cy="${y}" r="7.5"/>`;
    }
    const z = unit(pts[n - 2], pts[n - 1]);
    out += `<circle class="vise" cx="${f1(pts[0].x * U)}" cy="${f1(pts[0].y * U)}" r="17"/><text class="vt" x="${f1(pts[0].x * U)}" y="${f1(pts[0].y * U + 7)}">A</text>` +
      `<text class="bt" x="${f1((pts[n - 1].x + z.x * 0.24) * U)}" y="${f1((pts[n - 1].y + z.y * 0.24) * U + 8)}">B</text>`;
    g.innerHTML = out;
    panel();
  }

  function panel() {
    const el = document.getElementById("panel"), acts = document.getElementById("acts");
    if (!el || !st) return;
    const legs = G.legLengths(myWire()), n = st.bends.length, want = st.shape.wire.bends.length;
    acts.hidden = !!st.result;
    if (st.result) {
      const r = st.result, more = G.SHAPES[G.SHAPES.indexOf(st.shape) + 1];
      const word = r.score === 100 ? "Dead on. Go bend it for real!" : r.score >= G.STARS[2] ? "Shop quality." : r.score >= G.STARS[1] ? "Close. A little tweaking would do it." : r.score >= G.STARS[0] ? "You can tell what it is." : "Back to the vise.";
      el.innerHTML = `<div class="res"><div class="score"><b>${r.score}</b><small>out of 100</small></div><div class="said">${starsHtml(r.stars)}<p>${word}</p></div></div>` +
        `<p class="key"><i class="k-g"></i> the picture, laid over your wire</p>` +
        (r.notes.length ? `<ul class="notes">${r.notes.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "") +
        (st.fresh ? `<p class="saved">${inBook(st.shape.id) ? "New best. Saved to your pattern book." : "New best."}</p>` : "") +
        `<div class="acts"><button data-act="adjust">Adjust it</button>${inBook(st.shape.id) ? `<button data-act="pattern">Pattern</button>` : ""}` +
        `<button class="go" data-act="next">${more ? "Next shape" : "All shapes"}</button></div>`;
      return;
    }
    if (st.sel >= 0 && st.sel < n) {
      const b = st.bends[st.sel], rm = G.room(myWire(), st.sel);
      el.innerHTML = `<p class="info"><b>Bend ${st.sel + 1} of ${n}</b>: ${G.turnText(b.a)}<br>` +
        `<small>Leg before it ${fmt(legs[st.sel])} · leg after it ${fmt(legs[st.sel + 1])}</small></p>` +
        `<div class="nudge"><button data-act="s-" ${b.s - G.STEP < rm.lo - 1e-9 ? "disabled" : ""} aria-label="Slide the bend one eighth inch toward A">◀ ⅛″</button>` +
        `<button data-act="s+" ${b.s + G.STEP > rm.hi + 1e-9 ? "disabled" : ""} aria-label="Slide the bend one eighth inch toward B">⅛″ ▶</button>` +
        `<button data-act="a-" aria-label="Turn one degree more to the left">↺ 1°</button><button data-act="a+" aria-label="Turn one degree more to the right">↻ 1°</button>` +
        `<button data-act="del" class="del" aria-label="Remove this bend">✕</button></div>`;
      return;
    }
    el.innerHTML = `<p class="info">${n === 0
      ? "<b>Tap the wire</b> where the first bend goes. Then <b>drag the wire</b> past the mark to bend it."
      : `<b>${n} of ${want} bend${want === 1 ? "" : "s"} made</b>${n > want ? " (that's more than the picture has)" : ""}. Tap the wire to mark another, or tap a mark to change it.`}` +
      `<br><small>Last leg, out to end B: ${fmt(legs[n])}</small></p>`;
  }

  // ---------- touching the wire ----------
  function toBench(e) {
    const svg = document.getElementById("bench"), m = svg.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x / U, y: p.y / U, reach: 26 / (m.a * U) };   // reach: a fingertip's width, in inches
  }
  const remember = () => { st.hist.push(JSON.stringify(st.bends)); if (st.hist.length > 60) st.hist.shift(); };

  function down(e) {
    if (!st || st.result || e.target.closest("#bench") === null) return;
    const p = toBench(e);
    if (!p) return;
    e.preventDefault();
    const pts = G.wirePoints(myWire(), st.shape.start);
    const d = { x0: e.clientX, y0: e.clientY, moved: false, before: JSON.stringify(st.bends), mode: "none", id: e.pointerId };
    let hit = -1, hd = p.reach * 0.62;   // a mark is a smaller target than the wire, so a leg can be grabbed close to it
    for (let i = 1; i < pts.length - 1; i++) { const q = Math.hypot(pts[i].x - p.x, pts[i].y - p.y); if (q < hd) { hd = q; hit = i - 1; } }
    const near = G.nearest(pts, p.x, p.y);
    if (hit >= 0) {
      // Where another part of the wire crosses over a mark, a second tap on the mark marks the wire on top.
      const over = G.nearest(pts, p.x, p.y, (leg) => leg === hit || leg === hit + 1);
      if (st.sel === hit && over.d <= p.reach * 0.5) d.over = over.s;
      d.mode = "slide"; d.i = hit; st.sel = hit;
    }
    else if (near.d <= p.reach) { d.mode = "leg"; d.leg = near.leg; d.s = near.s; d.i = near.leg - 1; }
    else { d.mode = "air"; d.i = st.sel; }
    if (d.i >= 0 && d.mode !== "slide") {
      d.a0 = st.bends[d.i].a; d.acc = 0;
      d.last = Math.atan2(p.y - pts[d.i + 1].y, p.x - pts[d.i + 1].x) * DEG;
    }
    st.drag = d;
    try { document.getElementById("bench").setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    paint();
  }
  function move(e) {
    const d = st && st.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return;
    const p = toBench(e);
    if (!p) return;
    const w = myWire(), pts = G.wirePoints(w, st.shape.start);
    if (!d.moved) { d.moved = true; if (d.i >= 0) st.sel = d.i; }
    if (d.mode === "slide") {
      const u = unit(pts[d.i], pts[d.i + 1]), s0 = d.i > 0 ? st.bends[d.i - 1].s : 0;
      st.bends = G.moveBend(w, d.i, s0 + (p.x - pts[d.i].x) * u.x + (p.y - pts[d.i].y) * u.y);
    } else if (d.i >= 0) {
      const now = Math.atan2(p.y - pts[d.i + 1].y, p.x - pts[d.i + 1].x) * DEG;
      d.acc += G.norm180(now - d.last); d.last = now;
      d.acc = Math.max(-G.MAX_TURN - d.a0, Math.min(G.MAX_TURN - d.a0, d.acc));
      st.bends = G.turnBend(w, d.i, Math.round((d.a0 + d.acc) / 5) * 5);
    }
    paint();
  }
  function up(e) {
    const d = st && st.drag;
    if (!d || e.pointerId !== d.id) return;
    st.drag = null;
    if (!d.moved) {
      if (d.mode === "leg" || d.over !== undefined) {
        const made = G.addBend(myWire(), d.mode === "leg" ? d.s : d.over);
        if (made) { st.bends = made.bends; st.sel = made.index; }
      } else if (d.mode === "air") st.sel = -1;
    }
    if (JSON.stringify(st.bends) !== d.before) { st.hist.push(d.before); if (st.hist.length > 60) st.hist.shift(); }
    paint();
  }

  function act(a) {
    if (!st) return;
    const w = myWire(), i = st.sel;
    if (a === "undo") { if (st.hist.length) { st.bends = JSON.parse(st.hist.pop()); st.sel = -1; } }
    else if (a === "reset") { if (st.bends.length) { remember(); st.bends = []; st.sel = -1; } }
    else if (a === "s-" || a === "s+") { remember(); st.bends = G.moveBend(w, i, st.bends[i].s + (a === "s+" ? G.STEP : -G.STEP)); }
    else if (a === "a-" || a === "a+") { remember(); st.bends = G.turnBend(w, i, st.bends[i].a + (a === "a+" ? 1 : -1)); }
    else if (a === "del") { remember(); st.bends = G.removeBend(w, i); st.sel = -1; }
    else if (a === "check") {
      st.result = G.score(st.shape, st.bends); st.sel = -1;
      const old = bestOf(st.shape.id);
      st.fresh = st.result.score > (old ? old.score : 0);
      if (st.fresh) {
        save.best[st.shape.id] = { score: st.result.score, bends: st.bends.map((b) => ({ s: b.s, a: b.a })) };
        keep();
        document.getElementById("best").textContent = "Best " + st.result.score;
      }
    }
    else if (a === "adjust") { st.result = null; }
    if (a === "check" || a === "adjust") setView();
    else if (a === "pattern") return pattern(st.shape.id);
    else if (a === "next") { const more = G.SHAPES[G.SHAPES.indexOf(st.shape) + 1]; return more ? play(more.id) : home(); }
    paint();
    if (a === "check") document.getElementById("panel").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // ---------- pattern book ----------
  function book() {
    st = null;
    const mine = G.SHAPES.filter((s) => inBook(s.id));
    let html = `<div class="bar"><button data-go="home">‹ Shapes</button><span>Pattern book</span><em></em></div>`;
    if (!mine.length) html += `<p class="empty">Nothing here yet. Earn a star on any shape and your best try is kept here as a pattern, with a bend list for making it in real wire.</p>`;
    else {
      html += `<p class="blurb">Your best try at each shape, ready to make in real wire.</p><ul class="shapes">`;
      for (const s of mine) {
        const b = bestOf(s.id);
        html += `<li><button data-pattern="${s.id}">${thumb(G.wirePoints({ len: s.wire.len, heading: s.wire.heading, bends: b.bends }, s.start), 46)}` +
          `<span class="nm"><b>${esc(s.name)}</b><small>${specText({ len: s.wire.len, bends: b.bends })}</small></span><span class="sc">${starsHtml(G.stars(b.score))}<small>${b.score}</small></span></button></li>`;
      }
      html += `</ul>`;
    }
    app.innerHTML = html;
    scrollTo(0, 0);
  }

  const SIZES = [[1, "Same size"], [1.5, "1½ ×"], [2, "2 ×"]];
  let pat = null;   // the pattern being shown: { id, true: use the picture's own bends, size }
  function pattern(id, opts) {
    const shape = G.shapeById(id), b = bestOf(id);
    if (!shape || !b) return book();
    st = null;
    pat = Object.assign({ id, exact: false, size: 1 }, opts);
    const wire = pat.exact ? shape.wire : { len: shape.wire.len, heading: shape.wire.heading, bends: b.bends };
    const list = G.bendList(wire, pat.size), sheet = printable(wire, pat.size);
    let rows = "";
    for (const r of list.rows) rows += `<tr><td>${r.n}</td><td>${fmt(r.mark)}</td><td>${r.angle ? r.angle + "° " + r.dir : "no bend"}</td><td>${fmt(r.leg)}</td></tr>`;
    app.innerHTML =
      `<div class="bar"><button data-go="book">‹ Patterns</button><span>${esc(shape.name)}</span><em></em></div>` +
      `<div class="seg" role="group" aria-label="Which bends"><button data-pat="mine" class="${pat.exact ? "" : "on"}">My bends (${b.score})</button><button data-pat="exact" class="${pat.exact ? "on" : ""}">The picture's</button></div>` +
      `<div class="pic paper">${drawing(wire, shape.start, 340, 250, { copper: true, nums: true, pad: 36, label: "Pattern for the " + shape.name })}</div>` +
      `<div class="seg" role="group" aria-label="Size">${SIZES.map((z) => `<button data-size="${z[0]}" class="${pat.size === z[0] ? "on" : ""}">${z[1]}</button>`).join("")}</div>` +
      `<p class="cut">Cut <b>${fmt(list.cut)}</b> of wire.</p>` +
      (rows ? `<table class="list"><thead><tr><th>Bend</th><th>Mark, from end A</th><th>Turn</th><th>Leg before</th></tr></thead><tbody>${rows}</tbody></table>` : "") +
      `<p class="note">Last leg, out to end B: ${fmt(list.lastLeg)}.</p>` +
      `<ol class="steps"><li>Cut the wire and straighten it.</li><li>Measure from end A and mark every bend with a pen before bending any.</li>` +
      `<li>Bend at each mark in order, starting nearest A. Left and right are as you travel along the wire from A, looking down on it flat on the bench.</li></ol>` +
      (sheet ? `<button class="big" data-act="print">Print full size</button>` : `<p class="note">Too big to print on one letter sheet at this size.</p>`) +
      `<button class="plain" data-play="${shape.id}">Bend this shape again</button>` +
      `<p class="note">The game bends sharp corners. Real wire bends in a small curve, so a real piece comes out a touch smaller at each corner; cut a little long and trim. ` +
      `For rounded bends and big templates across several sheets, draw it in <a href="../wire-bender/">Wire Bender</a>.</p>`;
    scrollTo(0, 0);
  }

  // A full-size sheet for the printer (letter paper). Returns null when the shape won't fit on one sheet.
  function printable(wire, size) {
    const big = { len: wire.len * size, heading: wire.heading, bends: wire.bends.map((b) => ({ s: b.s * size, a: b.a })) };
    let b = G.bbox(G.wirePoints(big));
    if (b.w > 7 && b.h <= 7) { big.heading += 90; b = G.bbox(G.wirePoints(big)); }   // turn it to run down the page
    if (b.w > 7 || b.h > 8.4) return null;
    const m = 0.3, W = b.w + 2 * m, H = b.h + 2 * m, k = 96;
    const svg = drawing(big, { x: 0, y: 0 }, W * k, H * k, { nums: true, pad: m * k, cls: "full" })
      .replace("<svg ", `<svg width="${f1(W * 100) / 100}in" height="${f1(H * 100) / 100}in" `);
    return svg;
  }
  function print() {
    const shape = G.shapeById(pat.id), b = bestOf(pat.id);
    const wire = pat.exact ? shape.wire : { len: shape.wire.len, heading: shape.wire.heading, bends: b.bends };
    const list = G.bendList(wire, pat.size), svg = printable(wire, pat.size);
    if (!svg) return;
    let el = document.getElementById("sheet");
    if (!el) { el = document.createElement("div"); el.id = "sheet"; document.body.appendChild(el); }
    el.innerHTML = `<h1>${esc(shape.name)}</h1><p>Bend It Right pattern, full size. Cut ${fmt(list.cut)} of wire. Print at 100% (not "fit to page").</p>` +
      svg + `<div class="check"><i></i><span>This line should measure 2 inches. If it doesn't, the printer has resized the page.</span></div>` +
      `<table><thead><tr><th>Bend</th><th>Mark, from end A</th><th>Turn</th><th>Leg before</th></tr></thead><tbody>` +
      list.rows.map((r) => `<tr><td>${r.n}</td><td>${fmt(r.mark)}</td><td>${r.angle ? r.angle + "° " + r.dir : "no bend"}</td><td>${fmt(r.leg)}</td></tr>`).join("") +
      `</tbody></table><p>Last leg, out to end B: ${fmt(list.lastLeg)}. Left and right are as you travel along the wire from A.</p>`;
    window.print();
  }

  // ---------- how to play ----------
  function help() {
    st = null;
    app.innerHTML = `<div class="bar"><button data-go="home">‹ Shapes</button><span>How to play</span><em></em></div>` +
      `<ol class="steps">` +
      `<li>You get a picture and a straight piece of copper wire, held at <b>end A</b>. The wire is exactly as long as the shape needs.</li>` +
      `<li><b>Tap the wire</b> to mark where a bend goes.</li>` +
      `<li><b>Drag the wire</b> past a mark to bend it there. It turns 5° at a time.</li>` +
      `<li><b>Drag a mark</b> to slide the bend along the wire, ⅛″ at a time.</li>` +
      `<li>Tap a mark for fine buttons: slide it ⅛″, turn it 1°, or remove it.</li>` +
      `<li>If the wire crosses over a mark and you want a bend right there, tap that spot twice.</li>` +
      `<li>Tap <b>Check it</b>. The picture is laid over your wire and you get a score out of 100.</li></ol>` +
      `<p class="note">Only the shape counts, not which way it is tilted. ${G.STARS[0]} earns one star, ${G.STARS[1]} two and ${G.STARS[2]} three.</p>` +
      `<h2>Three kinds of shapes</h2><ul class="steps">${G.TIERS.map((t) => `<li><b>${esc(t.name)}.</b> ${esc(t.blurb)}</li>`).join("")}</ul>` +
      `<h2>Pattern book</h2><p class="note">Earn a star and your best try is kept as a pattern: a bend list (where to mark, how far to turn) you can follow with real wire, at the same size or bigger, and a full-size printout. Everything stays on this device.</p>`;
    scrollTo(0, 0);
  }

  // ---------- wiring ----------
  app.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.go) return { home, book, help }[d.go]();
    if (d.play) return play(d.play);
    if (d.pattern) return pattern(d.pattern);
    if (d.pat) return pattern(pat.id, { exact: d.pat === "exact", size: pat.size });
    if (d.size) return pattern(pat.id, { exact: pat.exact, size: +d.size });
    if (d.act === "print") return print();
    if (d.act) return act(d.act);
  });
  app.addEventListener("pointerdown", down);
  app.addEventListener("pointermove", move);
  app.addEventListener("pointerup", up);
  app.addEventListener("pointercancel", (e) => {
    const d = st && st.drag;
    if (d && e.pointerId === d.id) { st.bends = JSON.parse(d.before); st.drag = null; paint(); }
  });
  addEventListener("resize", () => { if (st) { setView(); paint(); } });

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => { /* offline copy is a bonus */ });
  home();
})();
