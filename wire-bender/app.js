(function () {
  'use strict';
  const G = window.WireGeom, RN = window.WireRender;
  const $ = id => document.getElementById(id);

  // Solid copper diameters (inches)
  const WIRES = [
    { k: '18', label: '18 AWG solid (0.040")', d: 0.0403 },
    { k: '16', label: '16 AWG solid (0.051")', d: 0.0508 },
    { k: '14', label: '14 AWG solid (0.064")', d: 0.0641 },
    { k: '12', label: '12 AWG solid (0.081")', d: 0.0808 },
    { k: '10', label: '10 AWG solid (0.102")', d: 0.1019 },
    { k: '8', label: '8 AWG solid (0.128")', d: 0.1285 },
    { k: '6', label: '6 AWG solid (0.162")', d: 0.1620 },
    { k: '4', label: '4 AWG solid (0.204")', d: 0.2043 },
    { k: '2', label: '2 AWG solid (0.258")', d: 0.2576 },
    { k: 'r18', label: '1/8" rod', d: 0.125 },
    { k: 'r316', label: '3/16" rod or tube', d: 0.1875 },
    { k: 'r14', label: '1/4" rod or tube', d: 0.25 },
    { k: 'custom', label: 'Other size…', d: null }
  ];
  const SAMPLES = [
    { name: 'Z jumper', pts: [[1, 2], [3, 2], [4, 1], [6, 1]] },
    { name: 'U strap', pts: [[1, 1], [1, 3], [3.5, 3], [3.5, 1]] },
    { name: 'J hook', pts: [[1.5, 1], [1.5, 4], [2.25, 4.75], [3, 4], [3, 3.25]] },
    { name: 'Square hook', pts: [[1, 1], [5, 1], [5, 3], [3, 3], [3, 2]] },
    { name: 'Zig-zag', pts: [[1, 2], [2, 1], [3, 2], [4, 1], [5, 2], [6, 1]] }
  ];
  const KEY_CUR = 'wirebender.current', KEY_SAVED = 'wirebender.saved';

  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const samplePts = s => s.pts.map(([x, y]) => ({ x, y }));

  function blankState(name, pts) {
    return { id: newId(), name: name || '', points: pts || [], wire: '10', customDia: '', radius: '1/8', tail: '0', snap: 0.25, angleSnap: true };
  }

  let state = store.get(KEY_CUR, null);
  if (!state || !Array.isArray(state.points)) state = blankState('Z jumper (sample)', samplePts(SAMPLES[0]));
  let undoStack = [];
  let selected = -1;
  let ppi = 0;           // pixels per inch on screen (0 = fit on first draw)
  let res = null;
  let board = { W: 12, H: 8 };
  let drag = null, tap = null, rafPending = false;

  // ---------- inputs ----------
  function wireDia() {
    const w = WIRES.find(w => w.k === state.wire) || WIRES[4];
    if (w.d != null) return w.d;
    const d = G.parseLen(state.customDia);
    return isFinite(d) && d > 0 ? d : NaN;
  }
  function num(str) { const v = G.parseLen(str); return v; }

  function compute() {
    const d = wireDia(), ri = num(state.radius), tail = num(state.tail);
    flag($('custom-dia'), state.wire === 'custom' && !isFinite(d));
    flag($('radius'), !isFinite(ri));
    flag($('tail'), !isFinite(tail));
    res = G.analyze(state.points, { wireDia: isFinite(d) ? d : 0, insideRadius: isFinite(ri) ? ri : 0, tail: isFinite(tail) ? tail : 0 });
    res.inputsOk = isFinite(d) && isFinite(ri) && isFinite(tail);
    return res;
  }
  function flag(el, bad) { el.style.borderColor = bad ? '#b0322a' : ''; el.setAttribute('aria-invalid', bad ? 'true' : 'false'); }

  function persist() { store.set(KEY_CUR, state); }
  function pushUndo() { undoStack.push(JSON.stringify(state.points)); if (undoStack.length > 150) undoStack.shift(); }

  // ---------- snapping ----------
  function snapStep() { return state.snap > 0 ? state.snap : 0; }
  function roundTo(v, s) { return s ? Math.round(v / s) * s : v; }
  function snapFor(i, p, isNew) {
    const pts = state.points;
    let ref = null;
    if (isNew) ref = pts.length ? pts[pts.length - 1] : null;
    else if (i > 0) ref = pts[i - 1];
    else if (pts.length > 1) ref = pts[1];
    if (state.angleSnap && ref) {
      const dx = p.x - ref.x, dy = p.y - ref.y;
      const step = 15 * Math.PI / 180;
      const a = Math.round(Math.atan2(dy, dx) / step) * step;
      const s = snapStep() || 1 / 16;
      const L = Math.max(s, roundTo(Math.hypot(dx, dy), s));
      return { x: clean(ref.x + L * Math.cos(a)), y: clean(ref.y + L * Math.sin(a)) };
    }
    const s = snapStep();
    return { x: roundTo(p.x, s), y: roundTo(p.y, s) };
  }
  const clean = v => Math.round(v * 1e6) / 1e6;

  // keep the drawing at least an inch from the top-left edge of the grid
  function normalize() {
    const pts = state.points; if (!pts.length) return;
    const minX = Math.min(...pts.map(p => p.x)), minY = Math.min(...pts.map(p => p.y));
    const dx = minX < 1 ? Math.ceil(1 - minX) : 0, dy = minY < 1 ? Math.ceil(1 - minY) : 0;
    if (dx || dy) pts.forEach(p => { p.x = clean(p.x + dx); p.y = clean(p.y + dy); });
  }

  // ---------- drawing board ----------
  const svg = $('board'), wrap = $('board-wrap');
  function boardSize(keep) {
    const pts = state.points;
    const maxX = pts.length ? Math.max(...pts.map(p => p.x)) : 0, maxY = pts.length ? Math.max(...pts.map(p => p.y)) : 0;
    const narrow = wrap.clientWidth < 560;
    let W = Math.max(narrow ? 7 : 12, Math.ceil(maxX + 2)), H = Math.max(narrow ? 6 : 8, Math.ceil(maxY + 2));
    if (keep) { W = Math.max(W, board.W); H = Math.max(H, board.H); }
    board = { W, H };
  }
  function fitZoom() {
    const w = Math.max(200, wrap.clientWidth - 2);
    ppi = Math.min(160, Math.max(14, w / board.W));
  }
  const f4 = v => Math.round(v * 10000) / 10000;
  function renderBoard(keepSize) {
    boardSize(keepSize);
    if (!ppi) fitZoom();
    const { W, H } = board, px = 1 / ppi;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', Math.round(W * ppi));
    svg.setAttribute('height', Math.round(H * ppi));
    let s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff"/>';
    // grid
    let minor = snapStep() || 0.25;
    while (minor * ppi < 7) minor *= 2;
    if (minor < 1) {
      let g = '';
      for (let x = minor; x < W; x += minor) if (Math.abs(x - Math.round(x)) > 1e-6) g += 'M' + f4(x) + ' 0V' + H;
      for (let y = minor; y < H; y += minor) if (Math.abs(y - Math.round(y)) > 1e-6) g += 'M0 ' + f4(y) + 'H' + W;
      s += '<path d="' + g + '" stroke="#edf0f3" stroke-width="' + f4(px) + '"/>';
    }
    let gi = '';
    for (let x = 1; x < W; x++) gi += 'M' + x + ' 0V' + H;
    for (let y = 1; y < H; y++) gi += 'M0 ' + y + 'H' + W;
    s += '<path d="' + gi + '" stroke="#c7d0da" stroke-width="' + f4(px) + '"/>';
    const every = ppi < 26 ? 2 : 1, fs = f4(10 * px);
    for (let x = every; x < W; x += every) s += '<text x="' + f4(x + 2 * px) + '" y="' + f4(11 * px) + '" font-size="' + fs + '" fill="#8a96a3">' + x + '</text>';
    for (let y = every; y < H; y += every) s += '<text x="' + f4(2 * px) + '" y="' + f4(y - 2 * px) + '" font-size="' + fs + '" fill="#8a96a3">' + y + '</text>';

    const pts = state.points;
    if (res && res.points.length >= 2) {
      const d = G.pathD(res);
      // dotted corner-to-corner lines (what you drew) under the real bent wire
      let poly = 'M' + pts.map(p => f4(p.x) + ' ' + f4(p.y)).join('L');
      s += '<path d="' + poly + '" fill="none" stroke="#9aa6b4" stroke-width="' + f4(px) + '" stroke-dasharray="' + f4(4 * px) + ' ' + f4(3 * px) + '"/>';
      s += '<path d="' + d + '" fill="none" stroke="#d98a4e" stroke-opacity=".9" stroke-width="' + f4(Math.max(res.wireDia, 3 * px)) + '" stroke-linecap="round" stroke-linejoin="round"/>';
      s += '<path d="' + d + '" fill="none" stroke="#1d232b" stroke-width="' + f4(1.2 * px) + '"/>';
      // leg lengths
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const L = Math.hypot(b.x - a.x, b.y - a.y); if (L * ppi < 34) continue;
        const nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
        const off = 13 * px + res.wireDia / 2;
        s += '<text x="' + f4((a.x + b.x) / 2 - nx * off) + '" y="' + f4((a.y + b.y) / 2 - ny * off + 4 * px) + '" font-size="' + f4(11 * px) + '" text-anchor="middle" fill="#2a4470" stroke="#fff" stroke-width="' + f4(3 * px) + '" paint-order="stroke">' + G.fmtIn(L) + '</text>';
      }
      // bend numbers
      for (const bnd of res.bends) {
        const o = bnd.outward, r = res.wireDia / 2 + 13 * px;
        const cx = bnd.mid.x + o.x * r, cy = bnd.mid.y + o.y * r;
        s += '<circle cx="' + f4(cx) + '" cy="' + f4(cy) + '" r="' + f4(8 * px) + '" fill="#fff" stroke="#b0322a" stroke-width="' + f4(1.4 * px) + '"/>';
        s += '<text x="' + f4(cx) + '" y="' + f4(cy + 3.6 * px) + '" font-size="' + f4(10 * px) + '" font-weight="700" text-anchor="middle" fill="#b0322a">' + bnd.number + '</text>';
      }
    }
    s += '<line id="ghost" x1="0" y1="0" x2="0" y2="0" stroke="#c46f37" stroke-width="' + f4(1.5 * px) + '" stroke-dasharray="' + f4(5 * px) + ' ' + f4(4 * px) + '" visibility="hidden"/>';
    // handles
    pts.forEach((p, i) => {
      const end = i === 0 || i === pts.length - 1;
      const sel = i === selected;
      s += '<g class="handle" data-i="' + i + '">';
      s += '<circle class="hit" cx="' + f4(p.x) + '" cy="' + f4(p.y) + '" r="' + f4(18 * px) + '"/>';
      s += '<circle cx="' + f4(p.x) + '" cy="' + f4(p.y) + '" r="' + f4((end ? 7 : 5.5) * px) + '" fill="' + (i === 0 ? '#1c2f4f' : '#fff') + '" stroke="' + (sel ? '#c46f37' : '#1c2f4f') + '" stroke-width="' + f4((sel ? 3 : 1.6) * px) + '"/>';
      if (i === 0 || (end && pts.length > 1)) {
        s += '<text x="' + f4(p.x + 10 * px) + '" y="' + f4(p.y - 9 * px) + '" font-size="' + f4(13 * px) + '" font-weight="700" fill="#1c2f4f" stroke="#fff" stroke-width="' + f4(3 * px) + '" paint-order="stroke">' + (i === 0 ? 'A' : 'B') + '</text>';
      }
      s += '</g>';
    });
    svg.innerHTML = s;
    $('del').disabled = selected < 0;
  }

  function toIn(e) {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
    const q = pt.matrixTransform(m.inverse());
    return { x: q.x, y: q.y };
  }

  function legInfo(a, b, before) {
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    let t = 'Leg ' + G.fmtIn(L);
    if (before) {
      const u1 = { x: a.x - before.x, y: a.y - before.y }, u2 = { x: b.x - a.x, y: b.y - a.y };
      const ang = Math.atan2(u1.x * u2.y - u1.y * u2.x, u1.x * u2.x + u1.y * u2.y) * 180 / Math.PI;
      if (Math.abs(ang) >= 0.25) t += ', turn ' + fmtAng(Math.abs(ang)) + ' ' + (ang > 0 ? 'right' : 'left');
      else t += ', straight on';
    }
    return t;
  }
  function setReadout(t) { $('readout').textContent = t || ' '; }
  function idleReadout() {
    const n = state.points.length;
    if (!n) setReadout('Tap the grid to place end A.');
    else if (selected >= 0) setReadout('Dot ' + (selected + 1) + ' selected. Drag it to move, or press Delete dot.');
    else setReadout(n + (n === 1 ? ' dot. Tap where the first bend goes.' : ' dots. Tap to add another corner, or drag a dot to move it.'));
  }

  svg.addEventListener('pointerdown', e => {
    if (e.button && e.button !== 0) return;
    const h = e.target.closest && e.target.closest('[data-i]');
    if (h) {
      e.preventDefault();
      const i = +h.getAttribute('data-i');
      selected = i;
      drag = { i, id: e.pointerId, moved: false, x: e.clientX, y: e.clientY, before: JSON.stringify(state.points) };
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      renderBoard(true);
      idleReadout();
    } else {
      tap = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
  });
  svg.addEventListener('pointermove', e => {
    if (drag && e.pointerId === drag.id) {
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
      drag.moved = true;
      const p = snapFor(drag.i, toIn(e), false);
      state.points[drag.i] = p;
      const pts = state.points, i = drag.i;
      setReadout(i > 0 ? legInfo(pts[i - 1], p, pts[i - 2]) : (pts[1] ? 'End A: ' + legInfo(p, pts[1]) : 'End A'));
      schedule();
      return;
    }
    if (tap && e.pointerId === tap.id && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10) tap = null;
    if (e.pointerType === 'mouse' && !drag) {
      const g = svg.querySelector('#ghost'); const pts = state.points;
      if (!g || !pts.length) return;
      const p = snapFor(pts.length, toIn(e), true), a = pts[pts.length - 1];
      g.setAttribute('x1', a.x); g.setAttribute('y1', a.y); g.setAttribute('x2', p.x); g.setAttribute('y2', p.y);
      g.setAttribute('visibility', 'visible');
      setReadout('Next: ' + legInfo(a, p, pts[pts.length - 2]));
    }
  });
  svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { const g = svg.querySelector('#ghost'); if (g) g.setAttribute('visibility', 'hidden'); idleReadout(); } });
  function endDrag(cancel) {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moved && !cancel) { undoStack.push(d.before); normalize(); }
    else if (d.moved && cancel) { state.points = JSON.parse(d.before); }
    refresh(true);
    idleReadout();
  }
  svg.addEventListener('pointerup', e => {
    if (drag && e.pointerId === drag.id) { endDrag(false); return; }
    if (tap && e.pointerId === tap.id) {
      tap = null;
      if (selected >= 0) { selected = -1; renderBoard(true); }
      const p = snapFor(state.points.length, toIn(e), true);
      const last = state.points[state.points.length - 1];
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1e-6) return;
      pushUndo();
      state.points.push(p);
      normalize();
      refresh(true);
      const pts = state.points;
      setReadout(pts.length > 1 ? 'Added: ' + legInfo(pts[pts.length - 2], pts[pts.length - 1], pts[pts.length - 3]) : 'End A placed. Tap where the first bend goes.');
    }
  });
  svg.addEventListener('pointercancel', e => { tap = null; if (drag && e.pointerId === drag.id) endDrag(true); });

  function schedule() {
    if (rafPending) return; rafPending = true;
    requestAnimationFrame(() => { rafPending = false; compute(); renderBoard(true); renderResults(); });
  }

  // ---------- typed legs ----------
  const legsBody = document.querySelector('#legs tbody');
  function renderLegs() {
    const act = document.activeElement;
    const focusKey = act && act.dataset && act.dataset.f ? act.dataset.f + ':' + act.dataset.row : null;
    const legs = G.legsFromPoints(state.points);
    let h = '';
    legs.forEach((leg, i) => {
      const turn = Math.abs(leg.turn) < 0.05 ? 0 : leg.turn;
      h += '<tr><td>' + (i + 1) + '</td>' +
        '<td><input type="text" inputmode="decimal" data-f="len" data-row="' + i + '" value="' + G.fmtIn(leg.length, 16, false) + (Math.abs(roundTo(leg.length, 1 / 16) - leg.length) > 0.0005 ? '' : '') + '" aria-label="Leg ' + (i + 1) + ' length"></td>' +
        '<td>' + (i === 0 ? '<span class="hint">start (end A)</span>' :
          '<div class="turn"><input type="text" inputmode="decimal" data-f="ang" data-row="' + i + '" value="' + fmtAngNum(Math.abs(turn)) + '" aria-label="Turn before leg ' + (i + 1) + ', degrees">&deg;' +
          '<select data-f="dir" data-row="' + i + '" aria-label="Turn direction"><option value="1"' + (turn >= 0 ? ' selected' : '') + '>right</option><option value="-1"' + (turn < 0 ? ' selected' : '') + '>left</option></select></div>') + '</td>' +
        '<td><button class="x" data-del="' + i + '" aria-label="Remove leg ' + (i + 1) + '">&times;</button></td></tr>';
    });
    if (!legs.length) h = '<tr><td colspan="4" class="hint">No legs yet. Draw on the grid, or press &ldquo;Add a leg&rdquo;.</td></tr>';
    legsBody.innerHTML = h;
    // exact leg lengths that are not on a 1/16 show 3 decimals instead
    legs.forEach((leg, i) => {
      const inp = legsBody.querySelector('input[data-f="len"][data-row="' + i + '"]');
      if (inp && Math.abs(roundTo(leg.length, 1 / 16) - leg.length) > 0.0005) inp.value = leg.length.toFixed(3);
    });
    if (focusKey) { const [f, r] = focusKey.split(':'); const el = legsBody.querySelector('[data-f="' + f + '"][data-row="' + r + '"]'); if (el) el.focus(); }
  }
  function applyLegs() {
    const legs = G.legsFromPoints(state.points);
    if (!legs.length) return;
    let bad = false;
    const rows = legs.map((leg, i) => {
      const li = legsBody.querySelector('input[data-f="len"][data-row="' + i + '"]');
      const L = G.parseLen(li.value);
      flag(li, !(L > 0)); if (!(L > 0)) bad = true;
      let turn = 0;
      if (i > 0) {
        const ai = legsBody.querySelector('input[data-f="ang"][data-row="' + i + '"]');
        const a = parseFloat(String(ai.value).replace(/[^\d.\-]/g, ''));
        const ok = isFinite(a) && a >= 0 && a <= 179;
        flag(ai, !ok); if (!ok) bad = true;
        const dir = +legsBody.querySelector('select[data-f="dir"][data-row="' + i + '"]').value;
        turn = (ok ? a : 0) * dir;
      }
      return { length: L, turn };
    });
    if (bad) { setReadout('Check the highlighted box. Lengths like 2 1/2 or 2.5; turns from 0 to 179 degrees.'); return; }
    const h0 = Math.atan2(state.points[1].y - state.points[0].y, state.points[1].x - state.points[0].x) * 180 / Math.PI;
    pushUndo();
    state.points = G.pointsFromLegs(state.points[0], h0, rows).map(p => ({ x: clean(p.x), y: clean(p.y) }));
    normalize();
    refresh(true);
  }
  legsBody.addEventListener('change', e => { if (e.target.dataset.f) applyLegs(); });
  legsBody.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.f) { e.preventDefault(); applyLegs(); } });
  legsBody.addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    const i = +b.dataset.del;
    pushUndo();
    if (state.points.length <= 2) state.points = state.points.slice(0, 1);
    else state.points.splice(i + 1, 1);
    selected = -1;
    refresh(true);
  });
  $('add-leg').addEventListener('click', () => {
    pushUndo();
    const pts = state.points;
    if (!pts.length) pts.push({ x: 1, y: 1 }, { x: 3, y: 1 });
    else if (pts.length === 1) pts.push({ x: pts[0].x + 2, y: pts[0].y });
    else {
      const a = pts[pts.length - 2], b = pts[pts.length - 1];
      const h = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
      pts.push({ x: clean(b.x + 2 * Math.cos(h)), y: clean(b.y + 2 * Math.sin(h)) });
    }
    normalize();
    refresh(true);
  });

  // ---------- results ----------
  function fmtAngNum(a) { return String(Math.round(a * 10) / 10); }
  function fmtAng(a) { return (Math.round(a * 2) / 2) + '°'; }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function tips() {
    const t = [];
    if (!res || res.points.length < 2) return t;
    if (res.wireDia > 0 && res.insideRadius < res.wireDia * 0.99) t.push('The inside radius is smaller than the wire. Soft (annealed) copper usually takes it; hard-drawn wire may kink or crack. 1× to 2× the wire size is a safe start.');
    return t;
  }

  function renderResults() {
    const ok = res && res.points.length >= 2 && res.inputsOk;
    $('cut-len').textContent = ok ? G.fmtIn(res.cutLength) : '—';
    $('cut-dec').textContent = ok ? '(' + G.fmtDec(res.cutLength) + ' in)' : '';
    $('bend-count').textContent = ok ? res.bends.length : '0';
    let w = '';
    if (res && !res.inputsOk) w += '<div class="warn">Check the wire size, bend radius and extra boxes. Use numbers like 0.102, 1/8 or 3 mm.</div>';
    if (res) for (const x of res.warnings) w += '<div class="warn">' + esc(x.text) + '</div>';
    for (const x of tips()) w += '<div class="tip">' + esc(x) + '</div>';
    $('warnings').innerHTML = w;

    const steps = [], body = [];
    if (!ok) {
      steps.push('Draw at least two dots (end A and end B) to get a bend list.');
    } else {
      const tail = res.tail;
      steps.push('Cut a piece <b>' + G.fmtIn(res.cutLength) + '</b> long' + (tail > 0 ? ' (includes ' + G.fmtIn(tail) + ' extra on each end)' : '') + '. Straighten it and mark one end <b>A</b>.');
      if (res.bends.length) {
        steps.push('Measuring from end A, mark the center of each bend: ' + res.bends.map(b => '<b>' + b.number + '</b> at ' + G.fmtIn(b.center)).join(', ') + '.');
        steps.push('Make the bends in order, 1 first. Center your jaw or mandrel on each mark and bend the angle shown, toward the side shown.');
        steps.push('Lay the wire on the printed template after each bend and adjust.');
      } else steps.push('No bends: it is a straight piece.');
      if (tail > 0) steps.push('Trim the extra ' + G.fmtIn(tail) + ' off each end.');
      body.push('<tr><td class="n">A</td><td>' + (tail > 0 ? G.fmtIn(tail) + '<span class="small-dec">true end</span>' : '0"<span class="small-dec">start</span>') + '</td><td colspan="2" class="hint">start at end A</td><td>' + G.fmtIn(res.segments[0].straight) + '</td></tr>');
      for (const b of res.bends) {
        body.push('<tr><td class="n">' + b.number + '</td><td>' + G.fmtIn(b.center) + '<span class="small-dec">' + G.fmtDec(b.center) + ' in</span></td><td>' + fmtAng(b.angle) + '</td><td class="dir">' + (b.dir === 'R' ? 'RIGHT' : 'LEFT') + '</td><td>' + G.fmtIn(b.straightAfter) + '</td></tr>');
      }
      body.push('<tr><td class="n">B</td><td>' + G.fmtIn(res.cutLength - tail) + '<span class="small-dec">end B</span></td><td colspan="3"></td></tr>');
    }
    $('steps').innerHTML = steps.map(s => '<li>' + s + '</li>').join('');
    document.querySelector('#bends tbody').innerHTML = body.join('');
    ['print', 'dl-svg', 'dl-dxf'].forEach(id => { $(id).disabled = !ok; });
    if (ok) {
      const lay = RN.layout(res);
      const n = lay.tiles.length;
      $('print-note').textContent = 'The template prints on ' + n + ' letter sheet' + (n > 1 ? 's (' + lay.rows + ' × ' + lay.cols + ', overlapped and taped)' : '') + ', after a page with this bend list.';
    } else $('print-note').textContent = '';
  }

  function refresh(legsToo) {
    compute();
    renderBoard(false);
    if (legsToo) renderLegs();
    renderResults();
    persist();
  }

  // ---------- settings inputs ----------
  function loadInputs() {
    $('name').value = state.name || '';
    $('wire').value = state.wire;
    $('custom-dia').hidden = state.wire !== 'custom';
    $('custom-dia').value = state.customDia || '';
    $('radius').value = state.radius;
    $('tail').value = state.tail;
    $('snap').value = String(state.snap);
    $('angle-snap').checked = !!state.angleSnap;
  }
  $('wire').innerHTML = WIRES.map(w => '<option value="' + w.k + '">' + esc(w.label) + '</option>').join('');
  $('sample').innerHTML += SAMPLES.map((s, i) => '<option value="' + i + '">' + esc(s.name) + '</option>').join('');
  $('name').addEventListener('input', e => { state.name = e.target.value; persist(); });
  $('wire').addEventListener('change', e => { state.wire = e.target.value; $('custom-dia').hidden = state.wire !== 'custom'; refresh(false); });
  $('custom-dia').addEventListener('input', e => { state.customDia = e.target.value; refresh(false); });
  $('radius').addEventListener('input', e => { state.radius = e.target.value; refresh(false); });
  $('tail').addEventListener('input', e => { state.tail = e.target.value; refresh(false); });
  document.querySelectorAll('.chips button').forEach(b => b.addEventListener('click', () => {
    const d = wireDia(); if (!isFinite(d)) return;
    state.radius = String(Math.round(d * (+b.dataset.r) * 1000) / 1000);
    $('radius').value = state.radius; refresh(false);
  }));
  $('snap').addEventListener('change', e => { state.snap = +e.target.value; refresh(false); });
  $('angle-snap').addEventListener('change', e => { state.angleSnap = e.target.checked; persist(); });
  $('sample').addEventListener('change', e => {
    const s = SAMPLES[+e.target.value]; e.target.value = '';
    if (!s) return;
    pushUndo();
    state.points = samplePts(s);
    if (!state.name || /\(sample\)$/.test(state.name)) { state.name = s.name + ' (sample)'; $('name').value = state.name; }
    selected = -1; ppi = 0;
    refresh(true);
  });

  // ---------- tools ----------
  $('undo').addEventListener('click', undo);
  function undo() {
    if (!undoStack.length) { setReadout('Nothing to undo.'); return; }
    state.points = JSON.parse(undoStack.pop()); selected = -1; refresh(true); idleReadout();
  }
  $('del').addEventListener('click', delSelected);
  function delSelected() {
    if (selected < 0) return;
    pushUndo(); state.points.splice(selected, 1); selected = -1; refresh(true); idleReadout();
  }
  $('reverse').addEventListener('click', () => { if (state.points.length < 2) return; pushUndo(); state.points.reverse(); selected = -1; refresh(true); setReadout('Ends swapped: end A is now the other end.'); });
  $('clear').addEventListener('click', () => {
    if (state.points.length > 2 && !confirm('Clear the whole drawing? (Undo can bring it back.)')) return;
    pushUndo(); state.points = []; selected = -1; refresh(true); idleReadout();
  });
  $('zoom-in').addEventListener('click', () => zoom(1.25));
  $('zoom-out').addEventListener('click', () => zoom(0.8));
  $('zoom-fit').addEventListener('click', () => { boardSize(false); fitZoom(); renderBoard(false); });
  function zoom(k) { ppi = Math.min(240, Math.max(10, (ppi || 40) * k)); renderBoard(false); }
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selected >= 0) { e.preventDefault(); delSelected(); }
    else if (e.key === 'Escape') { selected = -1; renderBoard(true); idleReadout(); }
  });

  // ---------- saving ----------
  const savedAll = () => store.get(KEY_SAVED, {});
  const snapshot = s => JSON.stringify({ ...s, savedAt: undefined });
  function isDirty() { const s = savedAll()[state.id]; return state.points.length > 0 && (!s || snapshot(s) !== snapshot(state)); }
  $('btn-save').addEventListener('click', () => {
    if (!state.name.trim()) { state.name = prompt('Name this project:', 'Wire project') || 'Wire project'; $('name').value = state.name; }
    const all = savedAll(); all[state.id] = { ...state, savedAt: Date.now() }; store.set(KEY_SAVED, all); persist();
    setReadout('Saved “' + state.name + '” on this device.');
  });
  $('btn-new').addEventListener('click', () => {
    if (isDirty() && !confirm('Start a new project? Changes to “' + (state.name || 'this one') + '” that you have not saved will be lost.')) return;
    const keep = { wire: state.wire, customDia: state.customDia, radius: state.radius, tail: state.tail, snap: state.snap, angleSnap: state.angleSnap };
    state = { ...blankState(''), ...keep }; undoStack = []; selected = -1; ppi = 0;
    loadInputs(); refresh(true); idleReadout();
  });
  $('btn-open').addEventListener('click', () => { listSaved(); $('open-dlg').showModal(); });
  function listSaved() {
    const all = Object.values(savedAll()).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    $('saved-list').innerHTML = all.length ? all.map(p => '<li><button class="open" data-id="' + p.id + '">' + esc(p.name || 'Untitled') +
      '<small>' + (p.points.length ? Math.max(0, p.points.length - 2) + ' corners · ' : '') + new Date(p.savedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '</small></button><button class="del" data-del="' + p.id + '">Delete</button></li>').join('')
      : '<li class="empty">No saved projects yet. Press Save to keep one.</li>';
  }
  $('saved-list').addEventListener('click', e => {
    const o = e.target.closest('[data-id]'), d = e.target.closest('[data-del]');
    const all = savedAll();
    if (o) {
      if (isDirty() && state.id !== o.dataset.id && !confirm('Open it? Changes to the current project that you have not saved will be lost.')) return;
      const p = all[o.dataset.id]; if (!p) return;
      state = { ...blankState(), ...p }; delete state.savedAt; undoStack = []; selected = -1; ppi = 0;
      loadInputs(); refresh(true); idleReadout(); $('open-dlg').close();
    } else if (d) {
      const p = all[d.dataset.del];
      if (!confirm('Delete “' + (p && p.name || 'Untitled') + '” from this device? This can’t be undone.')) return;
      delete all[d.dataset.del]; store.set(KEY_SAVED, all); listSaved();
    }
  });

  // ---------- outputs ----------
  function slug() { return (state.name || 'wire-project').toLowerCase().replace(/\(sample\)/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'wire-project'; }
  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function title() { return state.name || 'Wire project'; }
  $('dl-svg').addEventListener('click', () => download(slug() + '-template.svg', RN.fullSVG(res, title()), 'image/svg+xml'));
  $('dl-dxf').addEventListener('click', () => download(slug() + '-centerline.dxf', G.toDXF(res), 'application/dxf'));

  function wireLabel() {
    const w = WIRES.find(w => w.k === state.wire);
    return w && w.d != null ? w.label : 'Wire ' + G.fmtDec(res.wireDia) + '" diameter';
  }
  function buildPrint() {
    const lay = RN.layout(res);
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const n = lay.tiles.length;
    let rows = '<tr><td>A</td><td>' + (res.tail > 0 ? G.fmtIn(res.tail) + ' (true end)' : '0" (start)') + '</td><td colspan="2">start at end A</td><td>' + G.fmtIn(res.segments[0].straight) + '</td></tr>';
    for (const b of res.bends) rows += '<tr><td><b>' + b.number + '</b></td><td><b>' + G.fmtIn(b.center) + '</b> (' + G.fmtDec(b.center) + ')</td><td>' + fmtAng(b.angle) + '</td><td><b>' + (b.dir === 'R' ? 'RIGHT' : 'LEFT') + '</b></td><td>' + G.fmtIn(b.straightAfter) + '</td></tr>';
    rows += '<tr><td>B</td><td>' + G.fmtIn(res.cutLength - res.tail) + '</td><td colspan="3">end B</td></tr>';
    let ruler = '<svg width="3in" height="0.5in" viewBox="0 0 3 0.5"><path d="M0 0.02H3" stroke="#000" stroke-width="0.012"/>';
    for (let i = 0; i <= 48; i++) { const x = i / 16, h = i % 16 === 0 ? 0.3 : i % 8 === 0 ? 0.2 : i % 4 === 0 ? 0.14 : 0.08; ruler += '<path d="M' + x + ' 0.02V' + (0.02 + h) + '" stroke="#000" stroke-width="0.008"/>'; if (i % 16 === 0) ruler += '<text x="' + (x + (i ? -0.03 : 0.02)) + '" y="0.46" font-size="0.13" text-anchor="' + (i ? 'end' : 'start') + '" font-family="Helvetica">' + (i / 16) + '</text>'; }
    ruler += '</svg>';
    const warn = res.warnings.length ? '<p class="warnp">' + res.warnings.map(w => esc(w.text)).join('<br>') + '</p>' : '';
    let h = '<section class="sheet summary"><h1>' + esc(title()) + '</h1>' +
      '<p class="meta">' + esc(wireLabel()) + ' &middot; inside bend radius ' + G.fmtIn(res.insideRadius) + ' (' + G.fmtDec(res.insideRadius) + ') &middot; ' + date + '</p>' + warn +
      '<p>Cut length: <span class="big">' + G.fmtIn(res.cutLength) + '</span> (' + G.fmtDec(res.cutLength) + ' in)' + (res.tail > 0 ? ', including ' + G.fmtIn(res.tail) + ' extra on each end' : '') + '. ' + res.bends.length + ' bend' + (res.bends.length === 1 ? '' : 's') + '.</p>' +
      '<table><thead><tr><th>#</th><th>Mark at (from end A)</th><th>Bend</th><th>Toward</th><th>Then straight</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<ol><li>Cut the wire to length, straighten it, and mark one end A.</li><li>Measure from end A and mark the center of each bend.</li><li>Bend in order. Center the jaw or mandrel on each mark. RIGHT and LEFT are the way the wire turns as you follow it from A toward B, lying on the template printed side up.</li><li>Copper springs back a little: bend slightly past the angle and check it on the template.</li>' + (res.tail > 0 ? '<li>Trim the extra off each end.</li>' : '') + '</ol>' +
      '<p>Template: ' + n + ' sheet' + (n > 1 ? 's, ' + lay.rows + ' row' + (lay.rows > 1 ? 's' : '') + ' by ' + lay.cols + ' column' + (lay.cols > 1 ? 's' : '') + '. Overlap the sheets so the 1-inch grid and the dashed lines line up, then tape them.' : '.') + ' Red ticks are bend centers; thin gray ticks show where each bend starts and ends.</p>' +
      '<div class="calib"><div><svg width="1in" height="1in" viewBox="0 0 1 1"><rect x="0.005" y="0.005" width="0.99" height="0.99" fill="none" stroke="#000" stroke-width="0.01"/></svg><div>Must measure exactly 1 inch</div></div><div>' + ruler + '<div>Check with a ruler</div></div></div>' +
      '<p style="margin-top:10pt;color:#444">Print at <b>Actual size</b> or <b>100%</b>, not &ldquo;Fit to page.&rdquo; Made with Wire Bender.</p></section>';
    lay.tiles.forEach((t, k) => {
      h += '<section class="sheet"><div class="label"><span><b>' + esc(title()) + '</b> &middot; cut ' + G.fmtIn(res.cutLength) + '</span><span>Sheet ' + (k + 1) + ' of ' + n + (n > 1 ? ' (row ' + (t.row + 1) + ', column ' + (t.col + 1) + ')' : '') + '</span></div>' +
        RN.tileSVG(res, lay, t).replace('<svg ', '<svg class="tile" ') +
        '<div class="foot">Full size. Grid squares are 1 inch: check one with a ruler.' + (n > 1 ? ' Dashed lines mark the overlap with the next sheet.' : '') + '</div></section>';
    });
    $('print-area').innerHTML = h;
  }
  $('print').addEventListener('click', () => { buildPrint(); setTimeout(() => window.print(), 50); });
  window.addEventListener('beforeprint', () => { if (res && res.points.length >= 2) buildPrint(); });

  window.addEventListener('resize', () => { /* keep zoom; nothing to do */ });

  // ---------- start ----------
  loadInputs();
  refresh(true);
  idleReadout();
  // test hook
  window.__wb = { get state() { return state; }, get res() { return res; }, buildPrint };
})();
