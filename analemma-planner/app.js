// Pico Analemma Planner: the form, the black-and-white preview and the downloads. The sun math and layout live in core.js (window.APL).
(function () {
  "use strict";
  const A = window.APL;
  const $ = (sel) => document.querySelector(sel);
  const form = $("#controls");
  const screen = $("#screen");
  const KEY = "apl.settings";

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const keep = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: fine */ } };
  let S = A.clean(Object.assign(load(), { year: load().year || new Date().getFullYear() }));

  function toast(msg, ms = 2600) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), ms);
  }

  // ---------- form <-> settings ----------
  for (const id of ["hour", "fromHour", "toHour"]) {
    const sel = $("#" + id);
    for (let h = 0; h < 24; h++) sel.add(new Option(A.hourWord(h * 60), String(h)));
  }
  const pad2 = (n) => String(n).padStart(2, "0");
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

  function fill() {
    const f = form.elements;
    const radio = (name, v) => { for (const r of form.querySelectorAll(`input[name=${name}]`)) r.checked = r.value === String(v); };
    radio("style", S.style); radio("timeKind", S.timeKind); radio("layout", S.layout); radio("ink", S.invert ? "white" : "black"); radio("rotate", S.rotate);
    f.hour.value = S.hour; f.minute.value = S.minute; f.fromHour.value = S.fromHour; f.toHour.value = S.toHour;
    f.manyHours.checked = S.hours === "many";
    f.months.value = S.months; f.widen.value = S.widen; f.line.value = S.line; f.unit.value = S.unit;
    for (const k of ["seasons", "markDate", "grid", "gridLabels", "title", "panel", "flipBits"]) f[k].checked = !!S[k];
    for (const k of ["titleText", "place", "lat", "lon", "utcOffset", "zoneName", "year", "gnomon"]) f[k].value = S[k];
    f.markWhen.value = S.markM ? `${S.year}-${pad2(S.markM)}-${pad2(S.markD)}` : todayISO();
  }

  function read() {
    const f = form.elements, v = (name) => (form.querySelector(`input[name=${name}]:checked`) || {}).value;
    const n = (x) => (x === "" ? NaN : Number(x));
    const s = {
      style: v("style"), timeKind: v("timeKind"), layout: v("layout"), invert: v("ink") === "white", rotate: v("rotate"),
      hour: +f.hour.value, minute: +f.minute.value, fromHour: +f.fromHour.value, toHour: +f.toHour.value,
      hours: f.manyHours.checked ? "many" : "one", months: f.months.value, widen: +f.widen.value, line: f.line.value, unit: f.unit.value,
      titleText: f.titleText.value, place: f.place.value, zoneName: f.zoneName.value.trim(),
      lat: n(f.lat.value), lon: n(f.lon.value), utcOffset: n(f.utcOffset.value), year: n(f.year.value), gnomon: n(f.gnomon.value),
      markM: S.markM, markD: S.markD,
    };
    for (const k of ["seasons", "markDate", "grid", "gridLabels", "title", "panel", "flipBits"]) s[k] = f[k].checked;
    S = A.clean(s);
    keep(S);
  }

  const STYLE_HELP = {
    sky: "Where the sun is in the sky at the same clock time every day, as a photo taken looking south would show it.",
    wall: "The spot of shadow from the tip of a short rod (a nodus) sticking straight out of a south-facing wall, seen from in front. Distances are in your units.",
    floor: "The shadow of the tip of an upright pole, or the spot of sunlight from a small hole that high up, seen from above with north at the top.",
    classic: "The textbook figure: how far north or south the sun is (up and down) against how fast or slow a sundial runs (left and right).",
  };

  // ---------- painting the shapes, then making them pure black and white ----------
  const work = document.createElement("canvas");
  function paint(sc) {
    work.width = sc.W; work.height = sc.H;
    const g = work.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, sc.W, sc.H);
    g.lineCap = "round"; g.lineJoin = "round";
    const font = (o) => `${o.bold ? 700 : 600} ${o.size}px system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
    for (const o of sc.shapes) {
      const col = o.ink === false ? "#fff" : "#000";
      if (o.t === "line") {
        g.strokeStyle = col; g.lineWidth = o.w || 1; g.setLineDash(o.dash || []);
        g.beginPath(); o.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]);
      } else if (o.t === "dot") {
        g.fillStyle = col; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill();
      } else if (o.t === "ring") {
        g.fillStyle = "#fff"; g.strokeStyle = "#000"; g.lineWidth = o.w || 2;
        g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill(); g.stroke();
      } else if (o.t === "poly") {
        g.fillStyle = col; g.beginPath(); o.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
      } else if (o.t === "rect") {
        g.strokeStyle = "#000"; g.lineWidth = o.w2 || 1; g.strokeRect(o.x, o.y, o.w, o.h);
      } else if (o.t === "text") {
        g.font = font(o); g.textAlign = o.align || "left"; g.textBaseline = o.base === "bottom" ? "bottom" : o.base === "top" ? "top" : "alphabetic";
        if (o.halo) { g.strokeStyle = "#fff"; g.lineWidth = 5; g.strokeText(o.s, o.x, o.y, o.maxW); }
        g.fillStyle = col; g.fillText(o.s, o.x, o.y, o.maxW);
      }
    }
    const px = g.getImageData(0, 0, sc.W, sc.H).data;
    const bits = new Uint8Array(sc.W * sc.H);
    for (let i = 0; i < bits.length; i++) {
      const lum = px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11;
      bits[i] = (lum < 200) !== !!sc.settings.invert ? 1 : 0; // 1 = black on the panel
    }
    return bits;
  }

  function show(bits, w, h, canvas) {
    canvas.width = w; canvas.height = h;
    const g = canvas.getContext("2d"), img = g.createImageData(w, h);
    for (let i = 0; i < bits.length; i++) { const c = bits[i] ? 18 : 250; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = c; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
  }

  let cur = null;
  function draw() {
    const sc = A.scene(S);
    const bits = paint(sc);
    show(bits, sc.W, sc.H, screen);
    screen.classList.toggle("tall", sc.H > sc.W);
    cur = { sc, bits };
    const many = S.hours === "many" && S.style !== "classic";
    const time = many ? `every hour from ${A.hourWord(S.fromHour * 60 + S.minute)} to ${A.hourWord(S.toHour * 60 + S.minute)}` : `${A.clock(S.hour * 60 + S.minute)}`;
    const zone = S.timeKind === "sun" ? "sun time" : (S.zoneName || `UTC ${S.utcOffset}`);
    $("#caption").textContent = `The sun at ${time} ${zone}, every day of ${S.year}, at ${S.place || "your place"}. This is exactly what the e-paper shows, pixel for pixel.`;
    $("#styleHelp").textContent = STYLE_HELP[S.style];
    $("#manyRow").classList.toggle("dim", S.style === "classic");
    $("#widenRow").classList.toggle("dim", S.style === "classic" || (S.style === "sky" && many));
    $("#gnomonRow").hidden = !(S.style === "wall" || S.style === "floor");
    $("#gnomonWord").textContent = S.style === "floor" ? "Pole height" : "Nodus sticks out";
    $("#rotateRow").classList.toggle("dim", S.layout !== "portrait");
  }

  let t = 0;
  const changed = () => { read(); clearTimeout(t); t = setTimeout(draw, 60); };
  form.addEventListener("input", changed);
  form.addEventListener("change", changed);
  $("#markWhen").addEventListener("change", (e) => {
    const [y, m, d] = (e.target.value || "").split("-").map(Number);
    if (!m) { S.markM = 0; } else { S.markM = m; S.markD = d; if (y && y !== S.year) form.elements.year.value = y; }
    form.elements.markDate.checked = true;
    changed();
  });
  $("#todayBtn").addEventListener("click", () => { S.markM = 0; S.markD = 0; form.elements.markDate.checked = true; read(); fill(); draw(); });
  $("#tucsonBtn").addEventListener("click", () => {
    const D = A.DEFAULTS;
    Object.assign(S, { place: D.place, lat: D.lat, lon: D.lon, utcOffset: D.utcOffset, zoneName: D.zoneName });
    fill(); read(); draw();
  });
  $("#resetBtn").addEventListener("click", () => { S = A.clean({ year: new Date().getFullYear() }); keep(S); fill(); draw(); toast("Back to the starting settings"); });

  // ---------- downloads ----------
  function save(data, name, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`Saved ${name}`);
  }
  // What goes on the Pico: the picture without the marked date (the Pico adds today's dot itself).
  function devicePack() {
    const sc = A.scene(S, { device: true });
    const bits = paint(sc);
    const panel = A.toPanel(bits, sc.W, sc.H, S.rotate);
    const oneIsBlack = !S.flipBits;
    let py = A.picoData(sc, S.rotate, oneIsBlack);
    py = py.replace("DOT_R = 8", `DOT_R = 8\nDARK_ON_LIGHT = ${S.invert ? "False" : "True"}  # black dot on white, or white dot on black`);
    return { bin: A.packHLSB(panel.bits, panel.w, panel.h, oneIsBlack), py };
  }
  const base = () => `analemma-${(S.place || "place").split(",")[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  async function get(kind) {
    if (kind === "bin") return save(devicePack().bin, "analemma.bin", "application/octet-stream");
    if (kind === "py") return save(devicePack().py, "analemma_data.py", "text/x-python");
    if (kind === "main") {
      try { const r = await fetch("pico/main.py"); if (!r.ok) throw 0; return save(await r.text(), "main.py", "text/x-python"); }
      catch { return toast("Couldn't load main.py. Check the connection and try again."); }
    }
    if (kind === "copy") {
      try { await navigator.clipboard.writeText(devicePack().py); toast("Point list copied (it is the analemma_data.py file)"); }
      catch { save(devicePack().py, "analemma_data.py", "text/x-python"); }
      return;
    }
    const { sc, bits } = cur;
    if (kind === "png") { const c = document.createElement("canvas"); show(bits, sc.W, sc.H, c); c.toBlob((b) => save(b, base() + ".png"), "image/png"); return; }
    const panel = A.toPanel(bits, sc.W, sc.H, S.rotate);
    if (kind === "bmp") return save(A.bmp1(panel.bits, panel.w, panel.h), base() + ".bmp", "image/bmp");
    if (kind === "h") {
      const note = `Analemma for ${S.place}, made with Pico Analemma Planner. ${S.flipBits ? "1 = white, 0 = black." : "1 = black, 0 = white."}`;
      return save(A.cHeader(A.packHLSB(panel.bits, panel.w, panel.h, !S.flipBits), "analemma_bits", note), "analemma.h", "text/plain");
    }
    if (kind === "csv") return save(A.csv(sc), base() + ".csv", "text/csv");
  }
  document.querySelectorAll("[data-get]").forEach((b) => b.addEventListener("click", () => get(b.dataset.get)));

  fill(); read(); draw();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
