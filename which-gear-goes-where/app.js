// Which Gear Goes Where: the screens. Draws each machine, takes the tap, then sets the machine running to show the answer.
(function () {
  "use strict";
  const G = self.WGGW, app = document.getElementById("app");
  const { TAU, ADD, U } = G;
  const DEG = 180 / Math.PI;
  const f1 = (n) => (Math.round(n * 10) / 10).toString();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- saved progress (stays on this device) ----------
  const KEY = "wggw-v1";
  const save = { stars: {} };
  try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* private mode: play without saving */ }
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };

  let run = null;   // the round being played
  let raf = 0;      // animation timer
  const stopAnim = () => { cancelAnimationFrame(raf); raf = 0; };

  // ---------- drawing helpers ----------
  function gearPath(T, r) {
    const ro = r + ADD, ri = r - ADD * 1.15, p = TAU / T, pt = (rad, a) => `${f1(rad * Math.cos(a))} ${f1(rad * Math.sin(a))}`;
    let d = "";
    for (let k = 0; k < T; k++) {
      const c = k * p;
      d += `${k ? "L" : "M"}${pt(ri, c - 0.3 * p)}L${pt(ro, c - 0.16 * p)}L${pt(ro, c + 0.16 * p)}L${pt(ri, c + 0.3 * p)}`;
    }
    return d + "Z";
  }
  // a curved arrow round (cx, cy): dir 1 = clockwise
  function arcArrow(cx, cy, R, mid, dir, cls, half) {
    half = half || 0.62;
    const a0 = mid - dir * half, a1 = mid + dir * half;
    const p = (a, rad) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
    const s = p(a0, R), e = p(a1 - dir * 2 / R, R), tip = p(a1 + dir * 7 / R, R), b1 = p(a1 - dir * 2.5 / R, R - 5.5), b2 = p(a1 - dir * 2.5 / R, R + 5.5);
    return `<g class="${cls}"><path d="M${f1(s[0])} ${f1(s[1])}A${R} ${R} 0 ${2 * half - 0.1 > Math.PI ? 1 : 0} ${dir > 0 ? 1 : 0} ${f1(e[0])} ${f1(e[1])}"/>` +
      `<polygon points="${f1(tip[0])},${f1(tip[1])} ${f1(b1[0])},${f1(b1[1])} ${f1(b2[0])},${f1(b2[1])}"/></g>`;
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  function beltPath(A, ra, B, rb, crossed) {
    const d = Math.hypot(B.x - A.x, B.y - A.y), phi = Math.atan2(B.y - A.y, B.x - A.x);
    const beta = Math.acos(Math.max(-1, Math.min(1, (crossed ? ra + rb : ra - rb) / d)));
    const P = (c, r, a) => `${f1(c.x + r * Math.cos(a))} ${f1(c.y + r * Math.sin(a))}`;
    const big = (span) => (span > Math.PI ? 1 : 0);
    if (crossed) {
      return `M${P(A, ra, phi + beta)}L${P(B, rb, phi + beta + Math.PI)}A${rb} ${rb} 0 ${big(TAU - 2 * beta)} 1 ${P(B, rb, phi - beta + Math.PI)}` +
        `L${P(A, ra, phi - beta)}A${ra} ${ra} 0 ${big(TAU - 2 * beta)} 0 ${P(A, ra, phi + beta)}Z`;
    }
    return `M${P(A, ra, phi + beta)}L${P(B, rb, phi + beta)}A${rb} ${rb} 0 ${big(2 * beta)} 0 ${P(B, rb, phi - beta)}` +
      `L${P(A, ra, phi - beta)}A${ra} ${ra} 0 ${big(TAU - 2 * beta)} 0 ${P(A, ra, phi + beta)}Z`;
  }

  // ---------- a gear machine ----------
  // Returns { html, frame(t) }. frame moves everything to where it is t seconds after the start.
  function drawGears(p) {
    const m = p.machine, W = m.wheels, S = m.shafts;
    const belts = m.links.filter((L) => L.type === "belt");
    const role = (sid) => (sid === m.driver ? "d" : sid === m.target ? "t" : "n");
    const front = (w) => S[w.shaft].wheels.map((id) => W[id]).find((o) => o.layer > w.layer);
    const drum = m.crate ? 7 : 0;

    // how much clear space there is at a point, for placing labels and arrows
    function room(x, y, sid, aboveLayer) {
      let best = 1e9;
      for (const w of W) {
        if (w.shaft === sid || (aboveLayer !== undefined && w.layer <= aboveLayer)) continue;
        best = Math.min(best, Math.hypot(S[w.shaft].x - x, S[w.shaft].y - y) - w.r - ADD);
      }
      for (const L of belts) {
        const a = W[L.a], b = W[L.b];
        best = Math.min(best, segDist(x, y, S[a.shaft].x, S[a.shaft].y, S[b.shaft].x, S[b.shaft].y) - Math.max(a.r, b.r));
      }
      if (m.crate) { const c = S[m.crate.shaft]; best = Math.min(best, segDist(x, y, c.x + m.crate.side * drum, c.y, c.x + m.crate.side * drum, c.y + 500) - 4); }
      return best;
    }
    function freeAngle(sid, R, aboveLayer) {
      let best = 0, score = -1e9;
      for (let k = 0; k < 24; k++) {
        const a = -Math.PI / 2 + k * TAU / 24, sc = room(S[sid].x + R * Math.cos(a), S[sid].y + R * Math.sin(a), sid, aboveLayer);
        if (sc > score + 0.01) { score = sc; best = a; }
      }
      return best;
    }

    const items = W.map((w) => ({ z: w.layer, w })).concat(belts.map((L, i) => ({ z: W[L.a].layer + 0.5, L, i })));
    items.sort((a, b) => a.z - b.z);
    let body = "", labels = "";
    for (const it of items) {
      if (it.L) {
        const a = W[it.L.a], b = W[it.L.b], d = beltPath(S[a.shaft], a.r, S[b.shaft], b.r, it.L.crossed);
        body += `<path class="belt" d="${d}"/><path class="beltdash" id="b${it.i}" d="${d}"/>`;
        continue;
      }
      const w = it.w, s = S[w.shaft], fr = front(w), inner = fr ? fr.r + (fr.kind === "gear" ? ADD : 2) : Math.max(6, drum);
      let g = "";
      if (w.kind === "gear") {
        const ri = w.r - ADD * 1.15, band = ri - inner;
        g += `<path d="${gearPath(w.teeth, w.r)}"/>`;
        if (band >= 15 && w.r >= 24) {
          const hr = Math.min(band / 2 - 3.5, w.r * 0.17), n = w.r >= 40 ? 6 : 5;
          for (let k = 0; k < n; k++) g += `<circle class="hole" cx="${f1((inner + band / 2) * Math.cos(k * TAU / n + 0.5))}" cy="${f1((inner + band / 2) * Math.sin(k * TAU / n + 0.5))}" r="${f1(hr)}"/>`;
        }
        g += `<circle class="mark" cx="${f1(ri - 3)}" cy="0" r="1.8"/>`;
      } else {
        g += `<circle class="flange" r="${w.r + 2}"/><circle class="face" r="${w.r - 2}"/>`;
        for (let k = 0; k < 3; k++) g += `<line class="spoke" x1="${f1(5 * Math.cos(k * TAU / 3))}" y1="${f1(5 * Math.sin(k * TAU / 3))}" x2="${f1((w.r - 3) * Math.cos(k * TAU / 3))}" y2="${f1((w.r - 3) * Math.sin(k * TAU / 3))}"/>`;
        g += `<circle class="mark" cx="${f1(w.r - 5)}" cy="0" r="1.6" transform="rotate(60)"/>`;
      }
      body += `<g transform="translate(${f1(s.x)} ${f1(s.y)})"><g id="w${w.id}" class="w ${w.kind} r-${role(w.shaft)}${S[w.shaft].wheels.some((id) => W[id].layer < w.layer) ? " front" : ""}">${g}</g></g>`;
      // the number: tooth count, or pulley size
      const txt = w.kind === "gear" ? w.teeth : `${w.size}″`;
      const hasDrum = m.crate && m.crate.shaft === w.shaft;
      if (!fr && !hasDrum) labels += `<text x="${f1(s.x)}" y="${f1(s.y + 3.8)}">${txt}</text>`;
      else {
        const edge = w.r - (w.kind === "gear" ? ADD : 0), lo = fr ? inner : drum;
        if (edge - lo >= 8) {
          const R = (edge + lo) / 2, a = freeAngle(w.shaft, R, w.layer);
          labels += `<text class="sm" x="${f1(s.x + R * Math.cos(a))}" y="${f1(s.y + R * Math.sin(a) + 3.2)}">${txt}</text>`;
        }
      }
    }

    // green arrow on the driver; the gold shaft gets its arrow once the answer is shown
    const big = (sid) => Math.max(...S[sid].wheels.map((id) => W[id].r + (W[id].kind === "gear" ? ADD : 2)));
    const arrowAt = (sid, dir, cls) => { const R = big(sid) + 9; return arcArrow(S[sid].x, S[sid].y, R, freeAngle(sid, R + 4), dir, cls, Math.min(0.62, 30 / R)); };
    let over = arrowAt(m.driver, p.drive, "arrow a-d");
    const tv = p.speeds[m.target];
    over += `<g id="ans" visibility="hidden">${p.jam ? "" : arrowAt(m.target, Math.sign(tv), "arrow a-t")}</g>`;

    // bounds
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const w of W) { const s = S[w.shaft], r = w.r + ADD; x0 = Math.min(x0, s.x - r); x1 = Math.max(x1, s.x + r); y0 = Math.min(y0, s.y - r); y1 = Math.max(y1, s.y + r); }
    let crate = "", cx = 0, cy = 0, cTop = 0;
    if (m.crate) {
      const c = S[m.crate.shaft];
      cx = c.x + m.crate.side * drum; cy = c.y; cTop = Math.max(y1 + 8, c.y + 40) + 30;
      crate = `<circle class="drum" cx="${f1(c.x)}" cy="${f1(c.y)}" r="${drum}"/><line id="rope" class="rope" x1="${f1(cx)}" y1="${f1(cy)}" x2="${f1(cx)}" y2="${f1(cTop)}"/>` +
        `<g id="crate"><rect class="crate" x="${f1(cx - 15)}" y="${f1(cTop)}" width="30" height="24" rx="2"/><path class="slat" d="M${f1(cx - 15)} ${f1(cTop)}l30 24m0 -24l-30 24"/></g>`;
      y1 = Math.max(y1, cTop + 24 + 30);
      x0 = Math.min(x0, cx - 15); x1 = Math.max(x1, cx + 15);
    }
    const pad = 26;
    let vx = x0 - pad, vy = y0 - pad, vw = x1 - x0 + 2 * pad, vh = y1 - y0 + 2 * pad;
    if (vw < 250) { vx -= (250 - vw) / 2; vw = 250; }
    if (vh < 220) { vy -= (220 - vh) / 2; vh = 220; }
    const jamTag = p.jam ? `<g id="jamtag" visibility="hidden" transform="translate(${f1(vx + vw / 2)} ${f1(vy + vh - 19)})"><rect x="-52" y="-14" width="104" height="28" rx="6"/><text y="6">JAMMED</text></g>` : "";
    const html = `<svg class="machine" viewBox="${f1(vx)} ${f1(vy)} ${f1(vw)} ${f1(vh)}" role="img" aria-label="A machine of gears and belts">${body}${crate}<g class="labels">${labels}</g>${over}${jamTag}</svg>`;

    // motion: the driver turns at about 110° a second, slowed if something else would be a blur
    const maxAbs = Math.max(...p.speeds.map(Math.abs), 1);
    const base = p.jam ? 0 : Math.min(400 / maxAbs, Math.max(110, 25 / Math.abs(tv)));
    const vCrate = m.crate ? m.crate.side * tv * base / DEG * drum : 0; // px a second, + = down
    const tStop = vCrate ? Math.min(30 / Math.abs(vCrate), 4.5) : 0;
    const el = (id) => document.getElementById(id);
    function frame(t) {
      let tt = t;
      if (m.crate && !p.jam) tt = Math.min(t % (tStop + 0.9), tStop); // run until the crate reaches the end, pause, start again
      for (const w of W) {
        let a = p.theta[w.id] * DEG + p.speeds[w.shaft] * base * tt;
        if (p.jam && t > 0) a += (w.shaft === m.driver ? 2.2 : 0.5 * (w.id % 2 ? 1 : -1)) * Math.sin(t * 34) * (t % 1.7 < 0.45 ? 1 : 0);
        el("w" + w.id).setAttribute("transform", `rotate(${a.toFixed(2)})`);
      }
      belts.forEach((L, i) => { const a = W[L.a]; el("b" + i).setAttribute("stroke-dashoffset", (p.speeds[a.shaft] * base / DEG * a.r * tt).toFixed(1)); });
      if (m.crate) {
        const dy = vCrate * tt;
        el("crate").setAttribute("transform", `translate(0 ${dy.toFixed(1)})`);
        el("rope").setAttribute("y2", (cTop + dy).toFixed(1));
      }
    }
    return { html, frame, reveal() { el("ans").setAttribute("visibility", "visible"); if (p.jam) el("jamtag").setAttribute("visibility", "visible"); } };
  }

  // ---------- a lever machine ----------
  function drawLevers(p) {
    const Ls = p.levers, n = Ls.length;
    const px = (l, h) => l.x0 + h * U;
    let body = "", stands = "";
    Ls.forEach((l, i) => {
      let g = `<rect class="bar" x="${l.x0 - 9}" y="${l.y - 6.5}" width="${l.len * U + 18}" height="13" rx="6.5"/>`;
      for (let h = 0; h <= l.len; h++) g += `<circle class="${h === l.inn || h === l.out ? "pin" : "hole"}" cx="${px(l, h)}" cy="${l.y}" r="${h === l.inn || h === l.out ? 3.6 : 2.4}"/>`;
      body += `<g id="lv${i}">${g}</g>`;
      const x = px(l, l.pivot);
      stands += `<path class="stand" d="M${x} ${l.y}l-11 28h22z"/><path class="ground" d="M${x - 17} ${l.y + 28.5}h34"/><circle class="pivot" cx="${x}" cy="${l.y}" r="4.6"/>`;
      if (i < n - 1) body += `<line id="rod${i}" class="rod" x1="0" y1="0" x2="0" y2="0"/>`;
    });
    const first = Ls[0], last = Ls[n - 1], hx = px(first, first.inn), bx = px(last, last.out), s = p.push;
    const hand = `<g id="hand"><path class="hand" d="M${hx} ${first.y - s * 10}l-8 ${-s * 11}h5v${-s * 21}h6v${s * 21}h5z"/><text class="push" x="${hx}" y="${first.y - s * 49 + 3.5}">PUSH</text></g>`;
    const box = `<g id="box"><rect class="crate" x="${bx - 14}" y="${last.y - 32}" width="28" height="25" rx="2"/><text class="qm" x="${bx}" y="${last.y - 14.5}">?</text></g>`;
    const xs = Ls.flatMap((l) => [l.x0 - 9, l.x0 + l.len * U + 9]), ys = Ls.map((l) => l.y);
    const pad = 16, x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - 68, y1 = Math.max(...ys) + 68;
    let vx = x0, vw = x1 - x0;
    if (vw < 250) { vx -= (250 - vw) / 2; vw = 250; }
    const html = `<svg class="machine" viewBox="${vx} ${y0} ${vw} ${y1 - y0}" role="img" aria-label="A machine of levers">${stands.replace(/<circle class="pivot"[^>]*>/g, "")}${body}${stands.match(/<circle class="pivot"[^>]*>/g).join("")}${hand}${box}</svg>`;

    // how far each lever tips when the hand moves 1 unit, then scale so nothing swings wildly
    const unitA = [], unitD = [1];
    Ls.forEach((l, i) => { unitA.push(unitD[i] / ((l.inn - l.pivot) * U)); unitD.push(unitA[i] * (l.out - l.pivot) * U); });
    const amp = Math.min(0.2 / Math.max(...unitA.map(Math.abs)), 20 / Math.max(...unitD.map(Math.abs)));
    const el = (id) => document.getElementById(id);
    const ease = (u) => u * u * (3 - 2 * u);
    function frame(t) {
      const c = t % 3.3, k = c < 1 ? ease(c) : c < 2.2 ? 1 : c < 2.7 ? 1 - ease((c - 2.2) / 0.5) : 0;
      const d = p.push * amp * k;
      const pos = (i, h) => { const l = Ls[i], a = d * unitA[i], arm = (h - l.pivot) * U; return [px(l, l.pivot) + arm * Math.cos(a), l.y + arm * Math.sin(a)]; };
      Ls.forEach((l, i) => {
        el("lv" + i).setAttribute("transform", `rotate(${(d * unitA[i] * DEG).toFixed(2)} ${px(l, l.pivot)} ${l.y})`);
        if (i < n - 1) {
          const a = pos(i, l.out), b = pos(i + 1, Ls[i + 1].inn), r = el("rod" + i);
          r.setAttribute("x1", a[0].toFixed(1)); r.setAttribute("y1", a[1].toFixed(1)); r.setAttribute("x2", b[0].toFixed(1)); r.setAttribute("y2", b[1].toFixed(1));
        }
      });
      const h = pos(0, first.inn), b = pos(n - 1, last.out);
      el("hand").setAttribute("transform", `translate(${(h[0] - hx).toFixed(1)} ${(h[1] - first.y).toFixed(1)})`);
      el("box").setAttribute("transform", `translate(${(b[0] - bx).toFixed(1)} ${(b[1] - last.y).toFixed(1)})`);
    }
    return { html, frame, reveal() {} };
  }

  // ---------- screens ----------
  const starStr = (n) => "★".repeat(n) + "☆".repeat(3 - n);
  function nextLevel() {
    const n = G.LEVELS.length;
    for (let l = 1; l <= n; l++) if (save.stars[l] === undefined) return l;
    for (let l = 1; l <= n; l++) if (save.stars[l] < 3) return l;
    return n;
  }
  const ICON = {
    cw: `<svg viewBox="-16 -16 32 32" aria-hidden="true">${arcArrow(0, 0, 10, -Math.PI / 2, 1, "arrow", 1.9)}</svg>`,
    ccw: `<svg viewBox="-16 -16 32 32" aria-hidden="true">${arcArrow(0, 0, 10, -Math.PI / 2, -1, "arrow", 1.9)}</svg>`,
    up: "<b>↑</b>", down: "<b>↓</b>",
  };

  function home() {
    stopAnim(); run = null;
    const nl = nextLevel(), total = Object.values(save.stars).reduce((a, b) => a + b, 0);
    app.innerHTML = `
      <header class="top"><img src="icon.svg" alt="" class="logo"><div><h1>Which Gear Goes Where</h1><p>Look, think, tap. Then watch it run.</p></div></header>
      <button class="big" id="go" type="button">▶ Play level ${nl}: ${esc(G.LEVELS[nl - 1].name)}</button>
      <p class="tally">${total} of ${G.LEVELS.length * 3} stars</p>
      <ol class="levels">${G.LEVELS.map((L, i) => `<li><button type="button" data-l="${i + 1}"><span class="num">${i + 1}</span><span class="nm"><b>${esc(L.name)}</b><small>${esc(L.blurb)}</small></span><span class="st${save.stars[i + 1] ? "" : " none"}">${starStr(save.stars[i + 1] || 0)}</span></button></li>`).join("")}</ol>
      <div class="foot"><button type="button" id="rules">How things turn</button><button type="button" id="reset">Start over</button></div>`;
    document.getElementById("go").onclick = () => start(nl);
    app.querySelectorAll("[data-l]").forEach((b) => { b.onclick = () => start(Number(b.dataset.l)); });
    document.getElementById("rules").onclick = rules;
    document.getElementById("reset").onclick = () => {
      if (confirm("Erase all your stars and start over?")) { save.stars = {}; keep(); home(); }
    };
    scrollTo(0, 0);
  }

  function rules() {
    app.innerHTML = `
      <div class="bar"><button type="button" id="back">‹ Levels</button><span>How things turn</span><span></span></div>
      <ul class="rules">
        <li><b>Gears that mesh</b> turn opposite ways. Count the meshes from green to gold: an odd number means opposite, an even number means the same way.</li>
        <li><b>The number on a gear</b> is how many teeth it has. A small gear driven by a big one spins faster. In a plain row of gears, only the first and last set the speed.</li>
        <li><b>Two wheels on one shaft</b> are locked together and turn as one. That is how a machine really changes speed: multiply each step.</li>
        <li><b>An open belt</b> keeps the same direction. <b>A crossed belt</b> flips it. The number on a pulley is its size in inches; a small pulley spins faster.</li>
        <li><b>A ring of three gears</b> (or any odd number) is locked solid, and so is everything joined to it. A ring of four can turn.</li>
        <li><b>A lever</b> with the pivot between the two points sends them opposite ways. With the pivot at the end, both points go the same way. The point farther from the pivot moves farther.</li>
        <li><b>The winch</b>: a rope hangs from one side of the drum. If that side is moving up, the crate goes up.</li>
      </ul>
      <p class="note">Each level is five machines. Five right earns three stars, four earns two, three earns one. Your stars are kept on this device only.</p>`;
    document.getElementById("back").onclick = home;
    scrollTo(0, 0);
  }

  function start(level) { run = { level, i: 0, marks: [] }; puzzle(); }

  function puzzle() {
    stopAnim();
    const p = run.p = G.makePuzzle(run.level, run.i);
    const d = run.d = p.kind === "levers" ? drawLevers(p) : drawGears(p);
    const pips = Array.from({ length: G.ROUND }, (_, k) => `<i class="${k < run.marks.length ? (run.marks[k] ? "ok" : "no") : k === run.i ? "now" : ""}"></i>`).join("");
    const hint = p.kind === "gears" && (p.q === "speed" || p.q === "rpm") ? "<p class=\"hint\">Numbers are teeth. ″ is a pulley's size.</p>" : p.kind === "levers" && p.q === "travel" ? "<p class=\"hint\">Count the holes from each pivot.</p>" : "";
    app.innerHTML = `
      <div class="bar"><button type="button" id="back">‹ Levels</button><span>Level ${run.level} · ${esc(G.LEVELS[run.level - 1].name)}</span><span class="pips">${pips}</span></div>
      <div class="stage">${d.html}${hint}</div>
      <p class="q">${esc(p.text)}</p>
      <div class="answers n${p.choices.length}">${p.choices.map((c) => `<button type="button" data-a="${esc(c.id)}">${ICON[c.id] || ""}<span>${esc(c.label)}</span></button>`).join("")}</div>
      <div id="after"></div>`;
    d.frame(0);
    document.getElementById("back").onclick = home;
    app.querySelectorAll("[data-a]").forEach((b) => { b.onclick = () => pick(b.dataset.a); });
    scrollTo(0, 0);
  }

  function pick(id) {
    const p = run.p, ok = id === p.answer;
    run.marks.push(ok);
    app.querySelectorAll("[data-a]").forEach((b) => {
      b.disabled = true;
      if (b.dataset.a === p.answer) b.classList.add("right"); else if (b.dataset.a === id) b.classList.add("wrong");
    });
    const pip = app.querySelectorAll(".pips i")[run.i];
    pip.className = ok ? "ok" : "no";
    const lastOne = run.i === G.ROUND - 1;
    document.getElementById("after").innerHTML = `<p class="verdict ${ok ? "ok" : "no"}">${ok ? "✓ Right" : "✗ Not this time"}</p><p class="how">${esc(p.how)}</p><button class="big" id="next" type="button">${lastOne ? "See your stars" : "Next machine ›"}</button>`;
    document.getElementById("next").onclick = () => { run.i++; if (run.i >= G.ROUND) done(); else puzzle(); };
    // set it running
    run.d.reveal();
    let t0 = 0;
    const d = run.d;
    const step = (ts) => { if (!t0) t0 = ts; d.frame((ts - t0) / 1000); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    document.getElementById("next").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function done() {
    stopAnim();
    const right = run.marks.filter(Boolean).length, st = G.stars(right), level = run.level, n = G.LEVELS.length;
    const best = Math.max(save.stars[level] || 0, st);
    save.stars[level] = best; keep();
    const msg = st === 3 ? "A clean sweep." : st === 2 ? "One slipped by." : st === 1 ? "Getting the feel of it." : "These take a second look. Try again?";
    app.innerHTML = `
      <div class="bar"><button type="button" id="back">‹ Levels</button><span>Level ${level} · ${esc(G.LEVELS[level - 1].name)}</span><span></span></div>
      <div class="done"><p class="bigstars">${starStr(st)}</p><h2>${right} of ${G.ROUND} right</h2><p>${msg}</p>
      ${level < n && st >= 1 ? `<button class="big" id="up" type="button">Level ${level + 1}: ${esc(G.LEVELS[level].name)} ›</button>` : ""}
      <button class="${level < n && st >= 1 ? "plain" : "big"}" id="again" type="button">Play level ${level} again</button></div>`;
    document.getElementById("back").onclick = home;
    document.getElementById("again").onclick = () => start(level);
    const up = document.getElementById("up");
    if (up) up.onclick = () => start(level + 1);
    scrollTo(0, 0);
  }

  home();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
