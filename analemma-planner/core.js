// Pico Analemma Planner: sun math, the picture layout and the file makers. No screen code here, so it can be tested with Node.
// The picture is described as a list of simple shapes (lines, dots, text) in pixels; app.js paints them on a canvas.
(function (root) {
  "use strict";

  const D = Math.PI / 180;
  const sin = (d) => Math.sin(d * D), cos = (d) => Math.cos(d * D), tan = (d) => Math.tan(d * D);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const wrap = (a, m) => ((a % m) + m) % m;

  // ---------- the sun (NOAA's formulas, good to well under a minute of time) ----------
  // Returns the sun's declination (degrees north of the equator) and the equation of time
  // (minutes a sundial runs ahead of a clock) at a moment given in milliseconds since 1970 UTC.
  function solar(ms) {
    const jd = ms / 86400000 + 2440587.5;
    const T = (jd - 2451545) / 36525;
    const L0 = wrap(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const C = sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + sin(2 * M) * (0.019993 - 0.000101 * T) + sin(3 * M) * 0.000289;
    const om = 125.04 - 1934.136 * T;
    const lam = L0 + C - 0.00569 - 0.00478 * sin(om);
    const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const eps = eps0 + 0.00256 * cos(om);
    const decl = Math.asin(sin(eps) * sin(lam)) / D;
    const y = tan(eps / 2) ** 2;
    const eot = 4 / D * (y * sin(2 * L0) - 2 * e * sin(M) + 4 * e * y * sin(M) * cos(2 * L0) - 0.5 * y * y * sin(4 * L0) - 1.25 * e * e * sin(2 * M));
    return { decl, eot };
  }

  // Where the sun is in the sky from a place (lat north +, lon east +): altitude above the horizon and
  // azimuth (0 north, 90 east, 180 south, 270 west), both in degrees.
  function sunAt(ms, lat, lon) {
    const { decl, eot } = solar(ms);
    const utcMin = wrap(ms / 60000, 1440);
    const tst = utcMin + eot + 4 * lon; // true solar time, minutes
    const ha = tst / 4 - 180; // hour angle, degrees (negative = morning)
    const cz = Math.max(-1, Math.min(1, sin(lat) * sin(decl) + cos(lat) * cos(decl) * cos(ha)));
    const alt = 90 - Math.acos(cz) / D;
    const az = wrap(Math.atan2(sin(ha), cos(ha) * sin(lat) - tan(decl) * cos(lat)) / D + 180, 360);
    return { alt, az, decl, eot, ha };
  }

  // Unit vector toward the sun: east, north, up.
  const vec = (alt, az) => [cos(alt) * sin(az), cos(alt) * cos(az), sin(alt)];

  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const daysIn = (y) => (isLeap(y) ? 366 : 365);
  // Day of the year (1 = Jan 1) for a calendar date.
  const dayOfYear = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 864e5) + 1;
  const dateOf = (y, doy) => { const t = new Date(Date.UTC(y, 0, doy)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };

  // The moment (ms UTC) for a local date and time. "clock" = the time on a clock in that time zone;
  // "sun" = local mean solar time, which centres the figure on the north-south line.
  function momentOf(y, doy, minutes, s) {
    const utcMin = s.timeKind === "sun" ? minutes - 4 * s.lon : minutes - s.utcOffset * 60;
    return Date.UTC(y, 0, doy) + utcMin * 60000;
  }

  // The sun at the same time on every day of the year.
  function yearOfSun(s, minutes) {
    const out = [];
    for (let doy = 1; doy <= daysIn(s.year); doy++) {
      const p = sunAt(momentOf(s.year, doy, minutes, s), s.lat, s.lon);
      const dt = dateOf(s.year, doy);
      out.push(Object.assign(p, { doy, m: dt.m, d: dt.d }));
    }
    return out;
  }

  // Solstices and equinoxes, to the day, from the declination through the year.
  function seasons(days) {
    let hi = days[0], lo = days[0];
    const ups = [], downs = [];
    for (let i = 1; i < days.length; i++) {
      const a = days[i - 1], b = days[i];
      if (b.decl > hi.decl) hi = b;
      if (b.decl < lo.decl) lo = b;
      if (a.decl < 0 && b.decl >= 0) ups.push(Math.abs(a.decl) < Math.abs(b.decl) ? a : b);
      if (a.decl >= 0 && b.decl < 0) downs.push(Math.abs(a.decl) < Math.abs(b.decl) ? a : b);
    }
    return [
      { name: "March equinox", short: "Equinox", day: ups[0] },
      { name: "June solstice", short: "Solstice", day: hi },
      { name: "September equinox", short: "Equinox", day: downs[0] },
      { name: "December solstice", short: "Solstice", day: lo },
    ].filter((x) => x.day);
  }

  // Sunrise, solar noon and sunset as minutes after local clock midnight (null if the sun doesn't rise or set).
  function sunTimes(y, m, d, s) {
    const doy = dayOfYear(y, m, d);
    const { decl, eot } = solar(Date.UTC(y, 0, doy, 12) - s.utcOffset * 3600000);
    const noon = 720 - 4 * s.lon - eot + s.utcOffset * 60;
    const c = (cos(90.833) / (cos(s.lat) * cos(decl))) - tan(s.lat) * tan(decl);
    if (c > 1 || c < -1) return { noon, rise: null, set: null, decl, eot };
    const h = Math.acos(c) / D;
    return { noon, rise: noon - 4 * h, set: noon + 4 * h, decl, eot };
  }

  // ---------- words and numbers ----------
  function clock(min, withAmPm = true) {
    let m = Math.round(min);
    m = wrap(m, 1440);
    const h = Math.floor(m / 60), mm = m % 60;
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(mm).padStart(2, "0")}${withAmPm ? (h < 12 ? " am" : " pm") : ""}`;
  }
  const hourWord = (min) => { const h = Math.floor(wrap(min, 1440) / 60), mm = wrap(min, 1440) % 60; const h12 = ((h + 11) % 12) + 1; return mm ? clock(min) : `${h12} ${h < 12 ? "am" : "pm"}`; };
  const deg = (v, dp = 1) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(dp)}°`;
  const latWord = (v) => `${Math.abs(v).toFixed(1)}° ${v < 0 ? "S" : "N"}`;
  const lonWord = (v) => `${Math.abs(v).toFixed(1)}° ${v < 0 ? "W" : "E"}`;
  const zoneWord = (s) => {
    if (s.timeKind === "sun") return "sun time";
    if (s.zoneName) return s.zoneName;
    const o = s.utcOffset;
    return `UTC${o < 0 ? "−" : "+"}${Math.abs(o)}`;
  };
  function fastSlow(eot) {
    const m = Math.round(Math.abs(eot));
    if (m === 0) return "Sundial matches the clock";
    return `Sundial ${m} min ${eot > 0 ? "fast" : "slow"}`;
  }
  const dateWord = (m, d) => `${MONTHS[m - 1]} ${d}`;

  // ---------- settings ----------
  const DEFAULTS = {
    place: "Tucson, AZ", lat: 32.22, lon: -110.93, utcOffset: -7, zoneName: "MST", year: new Date().getFullYear(),
    hour: 12, minute: 0, timeKind: "clock",
    style: "sky", // sky | wall | floor | classic
    hours: "one", // one | many
    fromHour: 9, toHour: 15,
    layout: "landscape", // landscape | portrait
    invert: false,
    line: "medium", // thin | medium | thick | dashed | dots | weekly
    months: "labels", // none | dots | labels
    seasons: true, grid: true, gridLabels: true, title: true, panel: true,
    markDate: true, markM: 0, markD: 0, // 0 = today
    titleText: "Analemma",
    gnomon: 12, unit: "in",
    widen: 2, // draw sky, wall and floor figures this many times wider than real (1 = true shape)
    rotate: "cw", // portrait on the screen: turn clockwise or counter-clockwise
    flipBits: false,
  };

  function clean(s) {
    const o = Object.assign({}, DEFAULTS, s || {});
    const num = (k, lo, hi) => { const v = Number(o[k]); o[k] = Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : DEFAULTS[k]; };
    num("lat", -66, 66); num("lon", -180, 180); num("utcOffset", -12, 14); num("year", 1900, 2200);
    num("hour", 0, 23); num("minute", 0, 59); num("fromHour", 0, 23); num("toHour", 0, 23); num("gnomon", 0.01, 100000);
    num("markM", 0, 12); num("widen", 1, 4); num("markD", 0, 31);
    o.year = Math.round(o.year);
    if (o.toHour < o.fromHour) [o.fromHour, o.toHour] = [o.toHour, o.fromHour];
    if (!["sky", "wall", "floor", "classic"].includes(o.style)) o.style = "sky";
    if (!["landscape", "portrait"].includes(o.layout)) o.layout = "landscape";
    return o;
  }

  // ---------- turning sun positions into flat drawing coordinates (y up) ----------
  // Sky: a photo taken looking toward the middle of the figure (a pinhole camera, so straight lines stay straight).
  function camera(dirs) {
    let f = [0, 0, 0];
    for (const v of dirs) { f[0] += v[0]; f[1] += v[1]; f[2] += v[2]; }
    const n = Math.hypot(...f) || 1; f = f.map((x) => x / n);
    let r = [f[1], -f[0], 0]; // f × up
    const rn = Math.hypot(...r);
    r = rn < 1e-6 ? [1, 0, 0] : r.map((x) => x / rn);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return (v) => { const z = dot(v, f); return z < 0.2 ? null : [dot(v, r) / z, dot(v, u) / z]; };
  }
  // Wall: the shadow of a point (nodus) sticking out from a south-facing wall (north-facing in the south), seen from in front.
  // Units are the nodus's distance from the wall. Floor: the shadow of the tip of an upright pole (or the spot of
  // sunlight from a small hole that high), seen from above with north up. Units are the pole's height.
  function wallXY(v, south) {
    const toward = south ? -v[1] : v[1]; // how much the sun is in front of the wall
    if (toward < 0.08 || v[2] < 0.02) return null;
    return [(south ? -1 : 1) * v[0] / toward, -v[2] / toward];
  }
  function floorXY(v) {
    if (v[2] < sin(12)) return null; // long shadows run off the floor
    return [-v[0] / v[2], -v[1] / v[2]];
  }

  // ---------- picture layout ----------
  const LINE = { thin: 1.6, medium: 3, thick: 5, dashed: 3, dots: 3, weekly: 3 };

  // Builds the whole picture as shapes. opts.device = true leaves out the marked date and its numbers,
  // and keeps a box free so the Pico can write today's numbers there itself.
  function scene(raw, opts = {}) {
    const s = clean(raw);
    const W = s.layout === "portrait" ? 480 : 800, H = s.layout === "portrait" ? 800 : 480;
    const shapes = [];
    const add = (o) => shapes.push(o);
    const today = new Date();
    const mk = s.markM ? { m: s.markM, d: Math.min(s.markD || 1, new Date(Date.UTC(s.year, s.markM, 0)).getUTCDate()) } : { m: today.getMonth() + 1, d: today.getDate() };
    const markOn = s.markDate && !opts.device;
    const mainMin = s.hour * 60 + s.minute;
    const many = s.hours === "many" && s.style !== "classic";
    const south = s.lat >= 0;

    // which times to draw
    let times = [mainMin];
    if (many) {
      times = [];
      for (let h = s.fromHour; h <= s.toHour; h++) times.push(h * 60 + s.minute);
      if (!times.includes(mainMin)) times.push(mainMin);
      times.sort((a, b) => a - b);
    }
    const curves = times.map((t) => ({ t, main: t === mainMin, days: yearOfSun(s, t) }));
    const mainDays = curves.find((c) => c.main).days;

    // project
    let proj, sx = 1, sy = 1, unitsWord = "";
    if (s.style === "sky") {
      if (many) proj = (p) => (p.alt < 1 ? null : [south ? p.az : -wrap(p.az + 180, 360), p.alt]);
      else { const cam = camera(mainDays.map((p) => vec(p.alt, p.az))); proj = (p) => (p.alt < 0 ? null : cam(vec(p.alt, p.az))); }
    } else if (s.style === "wall") proj = (p) => wallXY(vec(p.alt, p.az), south);
    else if (s.style === "floor") proj = (p) => floorXY(vec(p.alt, p.az));
    else proj = (p) => [p.eot, p.decl];
    for (const c of curves) for (const p of c.days) p.xy = proj(p);

    // layout boxes
    const pad = 14;
    let top = pad, bottom = H - pad, left = pad, right = W - pad;
    if (s.title) top += 40;
    let panel = null;
    if (s.panel) {
      if (W > H) { panel = { x: W - 236, y: pad, w: 236 - pad, h: H - 2 * pad }; right = panel.x - 12; }
      else { panel = { x: pad, y: H - 200, w: W - 2 * pad, h: 200 - pad, cols: true }; bottom = panel.y - 10; }
    }
    const area = { x: left, y: top, w: right - left, h: bottom - top };
    const labelRoom = s.months === "labels" || s.seasons || markOn ? 50 : 14;
    const fit = { x: area.x + labelRoom, y: area.y + 18, w: area.w - 2 * labelRoom, h: area.h - 36 };
    if (s.style === "classic") { fit.x += 30; fit.w -= 30; fit.h -= 14; }

    // scale to fit
    const all = [];
    for (const c of curves) for (const p of c.days) if (p.xy) all.push(p.xy);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of all) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (!all.length) { x0 = -1; x1 = 1; y0 = -1; y1 = 1; }
    if (s.style === "floor" || s.style === "wall") { // keep the pole or nodus in view when it is close by
      const near = (v0, v1) => Math.min(Math.abs(v0), Math.abs(v1)) < (v1 - v0) * 0.6;
      if (s.style === "floor" && near(y0, y1)) { y0 = Math.min(y0, 0); y1 = Math.max(y1, 0); }
      if (s.style === "wall" && near(y0, y1)) { y0 = Math.min(y0, 0); y1 = Math.max(y1, 0); }
    }
    const bw = Math.max(x1 - x0, 1e-9), bh = Math.max(y1 - y0, 1e-9);
    if (s.style === "classic") { sy = fit.h / bh; sx = Math.min(fit.w / bw, (sy * bh * 0.62) / bw); }
    else { const k = s.style === "sky" && many ? 1 : s.widen; sy = Math.min(fit.w / (bw * k), fit.h / bh); sx = sy * k; }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const fx = fit.x + fit.w / 2, fy = fit.y + fit.h / 2;
    const toPx = (q) => [fx + (q[0] - cx) * sx, fy - (q[1] - cy) * sy];
    const fromPx = (px, py) => [(px - fx) / sx + cx, (fy - py) / sy + cy];
    for (const c of curves) for (const p of c.days) p.px = p.xy ? toPx(p.xy) : null;

    // clip polylines to the drawing area
    const inA = ([x, y]) => x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h;
    function clipped(pts, extra) {
      const out = []; let cur = [];
      for (const q of pts) { if (q && inA(q)) cur.push(q); else { if (cur.length > 1) out.push(cur); cur = []; } }
      if (cur.length > 1) out.push(cur);
      return out.map((p) => Object.assign({ t: "line", pts: p }, extra));
    }

    // ---- grid and reference marks ----
    const gl = s.gridLabels;
    const gridLine = { w: 1, dash: [2, 5], ink: true };
    const nice = (span, want) => { const raw = span / want, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };
    const [ax0, ay1] = fromPx(area.x, area.y), [ax1, ay0] = fromPx(area.x + area.w, area.y + area.h);
    if (s.style === "sky" && !many) {
      const cam = camera(mainDays.map((p) => vec(p.alt, p.az)));
      const P = (alt, az) => { const q = cam(vec(alt, az)); return q ? toPx(q) : null; };
      const lastY = [];
      if (s.grid) {
        for (let a = 0; a <= 80; a += 10) {
          const pts = []; for (let z = 90; z <= 270; z += 1) pts.push(P(a, south ? z : z + 180));
          clipped(pts, gridLine).forEach(add);
          if (gl) { // label where the line meets the left edge
            const ends = clipped(pts, {}).flatMap((l) => [l.pts[0], l.pts[l.pts.length - 1]]).filter((q) => q[0] < area.x + 4 && q[1] > area.y + 14 && q[1] < area.y + area.h - 18);
            if (ends.length && !lastY.some((y) => Math.abs(y - ends[0][1]) < 16)) { lastY.push(ends[0][1]); add({ t: "text", x: area.x + 2, y: ends[0][1] - 3, s: `${a}°`, size: 13, align: "left" }); }
          }
        }
        for (let z = 100; z <= 260; z += 10) {
          const az = south ? z : wrap(z + 180, 360);
          const pts = []; for (let a = 0; a <= 89; a += 0.5) pts.push(P(a, az));
          clipped(pts, az === 180 || az === 0 ? { w: 1.5, ink: true } : gridLine).forEach(add);
          if (gl) {
            const seg = pts.filter((q) => q && inA(q));
            if (seg.length) { const q = seg.reduce((m, v) => (v[1] > m[1] ? v : m)); if (q[1] > area.y + area.h - 4) add({ t: "text", x: q[0], y: area.y + area.h - 2, s: az === 180 ? "S" : az === 0 ? "N" : `${az}°`, size: 13, align: "center", base: "bottom" }); }
          }
        }
      }
    } else if (s.style === "sky" && many) {
      if (s.grid) {
        const st = 10;
        for (let a = Math.max(0, Math.ceil(ay0 / st) * st); a <= Math.min(90, ay1); a += st) {
          clipped([toPx([ax0, a]), toPx([ax1, a])].map((q) => [Math.max(area.x, Math.min(area.x + area.w, q[0])), q[1]]), gridLine).forEach(add);
          if (gl && a >= 0 && a <= 90) add({ t: "text", x: area.x + 2, y: toPx([0, a])[1] - 3, s: `${a}°`, size: 13, align: "left" });
        }
        for (let z = Math.ceil(ax0 / 30) * 30; z <= ax1; z += 30) {
          const x = toPx([z, 0])[0];
          add({ t: "line", pts: [[x, area.y], [x, area.y + area.h]], ...(Math.abs(z) % 360 === 180 ? { w: 1.5, ink: true } : gridLine) });
          const azv = wrap(south ? z : z + 180, 360);
          if (gl) add({ t: "text", x, y: area.y + area.h - 2, s: { 90: "E", 180: "S", 270: "W", 0: "N" }[azv] || `${azv}°`, size: 13, align: "center", base: "bottom" });
        }
      }
    } else if (s.style === "wall" || s.style === "floor") {
      const step = nice(Math.max(ax1 - ax0, ay1 - ay0) * s.gnomon, 7) / s.gnomon;
      const u = (v) => { const val = v * s.gnomon; const r = Math.abs(val) >= 10 ? Math.round(val) : Math.round(val * 10) / 10; return `${r} ${s.unit}`.trim(); };
      if (s.grid) {
        for (let v = Math.ceil(ay0 / step) * step; v <= ay1 + 1e-9; v += step) {
          const y = toPx([0, v])[1];
          if (Math.abs(v) > 1e-9) add({ t: "line", pts: [[area.x, y], [area.x + area.w, y]], ...gridLine });
          if (gl && Math.abs(v) > 1e-9) add({ t: "text", x: area.x + 2, y: y - 3, s: u(Math.abs(v)), size: 13, align: "left" });
        }
        for (let v = Math.ceil(ax0 / step) * step; v <= ax1 + 1e-9; v += step) {
          if (Math.abs(v) < 1e-9) continue;
          const x = toPx([v, 0])[0];
          add({ t: "line", pts: [[x, area.y], [x, area.y + area.h]], ...gridLine });
          if (gl) add({ t: "text", x, y: area.y + area.h - 2, s: u(Math.abs(v)), size: 13, align: "center", base: "bottom" });
        }
      }
      // the noon line (north-south) through the pole or nodus, and the pole or nodus itself
      const o = toPx([0, 0]);
      if (o[0] >= area.x && o[0] <= area.x + area.w) add({ t: "line", pts: [[o[0], area.y], [o[0], area.y + area.h]], w: 1.5, ink: true });
      if (inA(o)) {
        add({ t: "dot", x: o[0], y: o[1], r: 6, ink: true });
        add({ t: "text", x: o[0] + 9, y: o[1] + (s.style === "floor" ? -4 : 14), s: s.style === "floor" ? "pole" : "nodus", size: 13, align: "left" });
      }
      if (s.style === "floor") { // north arrow
        const ax = area.x + area.w - 16, ay = area.y + 6;
        add({ t: "line", pts: [[ax, ay + 34], [ax, ay + 12]], w: 2, ink: true });
        add({ t: "poly", pts: [[ax - 6, ay + 16], [ax + 6, ay + 16], [ax, ay + 4]], ink: true });
        add({ t: "text", x: ax, y: ay + 50, s: "N", size: 14, align: "center", bold: true });
      }
      unitsWord = s.style === "floor" ? `Pole ${u(1)} tall` : `Nodus ${u(1)} from wall`;
    } else if (s.style === "classic") {
      const xs = nice(ax1 - ax0, 6), ys = 10;
      for (let v = Math.ceil(ay0 / ys) * ys; v <= ay1; v += ys) {
        const y = toPx([0, v])[1];
        add({ t: "line", pts: [[fit.x - 6, y], [area.x + area.w, y]], ...(v === 0 ? { w: 1.5, ink: true } : gridLine), skip: !s.grid && v !== 0 });
        if (gl) add({ t: "text", x: fit.x - 10, y: y + 5, s: v ? `${Math.abs(v)}° ${v > 0 ? "N" : "S"}` : "0°", size: 13, align: "right" });
      }
      for (let v = Math.ceil(ax0 / xs) * xs; v <= ax1; v += xs) {
        const x = toPx([v, 0])[0];
        add({ t: "line", pts: [[x, area.y], [x, area.y + area.h - 16]], ...(v === 0 ? { w: 1.5, ink: true } : gridLine), skip: !s.grid && v !== 0 });
        if (gl) add({ t: "text", x, y: area.y + area.h, s: `${v > 0 ? "+" : ""}${v}`, size: 13, align: "center", base: "bottom" });
      }
      if (gl) {
        add({ t: "text", x: area.x + area.w, y: area.y + area.h - 18, s: "sundial fast, min →", size: 12, align: "right", base: "bottom" });
        add({ t: "text", x: fit.x, y: area.y + area.h - 18, s: "← slow", size: 12, align: "left", base: "bottom" });
      }
    }
    for (let i = shapes.length - 1; i >= 0; i--) if (shapes[i].skip) shapes.splice(i, 1);

    // ---- the figure eights ----
    const lw = LINE[s.line] || 3;
    for (const c of curves) {
      const pts = c.days.map((p) => p.px);
      pts.push(pts[0]); // close the loop
      const w = c.main || !many ? lw : Math.max(1.6, lw * 0.6);
      if (s.line === "dots" || s.line === "weekly") {
        c.days.forEach((p, i) => { if (p.px && inA(p.px) && (s.line === "dots" || i % 7 === 0)) add({ t: "dot", x: p.px[0], y: p.px[1], r: s.line === "dots" ? 1.7 : 2.6, ink: true }); });
      } else clipped(pts, { w, ink: true, dash: s.line === "dashed" ? [10, 6] : null, curve: true }).forEach(add);
      if (many) { // label each hour at its top
        const valid = c.days.filter((p) => p.px && inA(p.px));
        if (valid.length) {
          const tp = valid.reduce((m, p) => (p.px[1] < m.px[1] ? p : m));
          add({ t: "text", x: tp.px[0], y: Math.max(area.y + 14, tp.px[1] - 8), s: hourWord(c.t), size: c.main ? 15 : 13, bold: c.main, align: "center", base: "bottom", halo: true });
        }
      }
    }

    // ---- month, season and date marks (on the main curve) ----
    const vis = mainDays.filter((p) => p.px && inA(p.px));
    const mcx = vis.length ? vis.reduce((a, p) => a + p.px[0], 0) / vis.length : fx;
    const mcy = vis.length ? vis.reduce((a, p) => a + p.px[1], 0) / vis.length : fy;
    const side = (p) => (p.px[0] >= mcx ? 1 : -1);
    const labelAt = (p, str, size, bold, flip) => {
      const sd = side(p) * (flip ? -1 : 1);
      add({ t: "text", x: p.px[0] + sd * 10, y: p.px[1] + 5, s: str, size, bold, align: sd > 0 ? "left" : "right", halo: true });
    };
    const markDoy = markOn ? dayOfYear(s.year, mk.m, mk.d) : 0;
    if (s.months !== "none") {
      for (const p of mainDays) {
        if (p.d !== 1 || !p.px || !inA(p.px)) continue;
        add({ t: "dot", x: p.px[0], y: p.px[1], r: 4.5, ink: true });
        if (s.months === "labels" && !(markDoy && Math.abs(p.doy - markDoy) < 6)) labelAt(p, MONTHS[p.m - 1], 14, false, false);
      }
    }
    if (s.seasons) {
      for (const z of seasons(mainDays)) {
        const p = z.day;
        if (!p.px || !inA(p.px)) continue;
        add({ t: "ring", x: p.px[0], y: p.px[1], r: 7, w: 2 });
        if (z.short === "Solstice") {
          const up = p.px[1] < mcy ? -1 : 1;
          const yy = p.px[1] + up * 12;
          add({ t: "text", x: p.px[0], y: yy, s: dateWord(p.m, p.d), size: 13, align: "center", base: up < 0 ? "bottom" : "top", halo: true });
        } else if (!(markDoy && Math.abs(p.doy - markDoy) < 6)) labelAt(p, dateWord(p.m, p.d), 13, false, false);
      }
    }
    let mark = null;
    if (markOn) {
      const doy = dayOfYear(s.year, mk.m, mk.d);
      const p = mainDays[doy - 1];
      if (p && p.px && inA(p.px)) {
        mark = p;
        add({ t: "dot", x: p.px[0], y: p.px[1], r: 11, ink: false });
        add({ t: "dot", x: p.px[0], y: p.px[1], r: 8, ink: true });
        labelAt(p, dateWord(mk.m, mk.d), 16, true, true);
      }
    }

    // ---- title ----
    const timeWord = `${clock(mainMin)} ${zoneWord(s)}`;
    if (s.title) {
      const tx = s.panel && W > H ? (area.x + area.x + area.w) / 2 : W / 2;
      add({ t: "text", x: tx, y: pad + 26, s: s.titleText || "Analemma", size: 26, bold: true, align: "center" });
    }

    // ---- side panel ----
    let todayBox = null;
    if (panel) {
      add({ t: "rect", x: panel.x, y: panel.y, w: panel.w, h: panel.h, w2: 2 });
      let y = panel.y + 30;
      let px = panel.x + 14;
      const pw = panel.cols ? panel.w / 2 - 24 : panel.w - 28;
      const line = (str, size = 16, bold = false, gap = 6) => { add({ t: "text", x: px, y, s: str, size, bold, align: "left", maxW: panel.cols ? panel.w / 2 - 24 : pw }); y += size + gap; };
      line(s.place || "My place", 20, true, 4);
      line(`${latWord(s.lat)}  ${lonWord(s.lon)}`, 14, false, 10);
      const what = { sky: many ? "The sun in the sky" : "The sun in the sky", wall: "Spot on a wall", floor: "Shadow on the floor", classic: "Sun height vs. sundial" }[s.style];
      line(what, 15, false, 4);
      line(many ? `every hour, ${hourWord(times[0])}–${hourWord(times[times.length - 1])}` : `at ${timeWord}`, 15, false, 4);
      if (many) line(zoneWord(s) === "sun time" ? "(sun time)" : `(${zoneWord(s)})`, 15, false, 4);
      if (unitsWord) line(unitsWord, 15, false, 4);
      if (s.widen > 1 && s.style !== "classic" && !(s.style === "sky" && many)) line(`(drawn ${s.widen}× wider)`, 13, false, 4);
      if (panel.cols) { // tall picture: today's numbers go in a second column
        px = panel.x + panel.w / 2 + 8; y = panel.y + 30;
        add({ t: "line", pts: [[px - 10, panel.y + 14], [px - 10, panel.y + panel.h - 14]], w: 1, ink: true });
      } else {
        y += 8;
        add({ t: "line", pts: [[px, y], [px + pw, y]], w: 1, ink: true });
        y += 26;
      }
      const boxTop = y - 20;
      if (opts.device) {
        todayBox = { x: px, y: boxTop, w: panel.x + panel.w - px - 8, h: panel.y + panel.h - boxTop - 8 };
      } else if (markOn) {
        const t = sunTimes(s.year, mk.m, mk.d, s);
        const p = mainDays[dayOfYear(s.year, mk.m, mk.d) - 1];
        line(dateWord(mk.m, mk.d), 22, true, 8);
        line(fastSlow(p.eot), 15);
        if (s.style !== "classic") line(`Sun ${Math.round(p.alt)}° high`, 15);
        line(`Sun is ${Math.abs(p.decl).toFixed(1)}° ${p.decl >= 0 ? "N" : "S"}`, 15);
        if (s.timeKind === "clock") line(`Due ${south ? "south" : "north"} at ${clock(t.noon)}`, 15);
        if (t.rise != null && s.timeKind === "clock") { line(`Sunrise ${clock(t.rise)}`, 15); line(`Sunset ${clock(t.set)}`, 15); }
      }
    }

    // painting order: grid lines first, then curves, then marks and text
    return { W, H, shapes, area, todayBox, settings: s, mainDays, mark, curves: curves.map((c) => ({ t: c.t, main: c.main })) };
  }

  // ---------- making files ----------
  // A bitmap is a Uint8Array with one byte per pixel: 1 = ink (black on the e-paper), 0 = paper.

  // Turn the picture so it fills the 800 x 480 panel. Portrait pictures turn a quarter turn.
  function toPanel(bits, w, h, rotate) {
    if (w === 800 && h === 480) return { bits, w, h };
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = bits[y * w + x];
      // clockwise: picture's top edge becomes the panel's right edge
      const nx = rotate === "ccw" ? y : h - 1 - y, ny = rotate === "ccw" ? w - 1 - x : x;
      out[ny * h + nx] = v;
    }
    return { bits: out, w: h, h: w };
  }
  // Same turn for one point (picture pixels to panel pixels).
  function pointToPanel(x, y, w, h, rotate) {
    if (w === 800 && h === 480) return [x, y];
    return rotate === "ccw" ? [y, w - 1 - x] : [h - 1 - y, x];
  }

  // MicroPython framebuf MONO_HLSB: rows of bytes, leftmost pixel in the highest bit.
  function packHLSB(bits, w, h, oneIsInk = true) {
    const bpr = Math.ceil(w / 8), out = new Uint8Array(bpr * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const on = bits[y * w + x] ? oneIsInk : !oneIsInk;
      if (on) out[y * bpr + (x >> 3)] |= 0x80 >> (x & 7);
    }
    if (!oneIsInk) for (let y = 0; y < h; y++) for (let x = w; x < bpr * 8; x++) out[y * bpr + (x >> 3)] |= 0x80 >> (x & 7);
    return out;
  }

  // A 1-bit Windows BMP (the kind Waveshare's own examples load). Palette: 0 = white, 1 = black.
  function bmp1(bits, w, h) {
    const rowBytes = Math.ceil(w / 32) * 4, dataSize = rowBytes * h, off = 14 + 40 + 8, size = off + dataSize;
    const b = new Uint8Array(size), v = new DataView(b.buffer);
    b[0] = 0x42; b[1] = 0x4d; v.setUint32(2, size, true); v.setUint32(10, off, true);
    v.setUint32(14, 40, true); v.setInt32(18, w, true); v.setInt32(22, h, true); v.setUint16(26, 1, true); v.setUint16(28, 1, true);
    v.setUint32(30, 0, true); v.setUint32(34, dataSize, true); v.setInt32(38, 2835, true); v.setInt32(42, 2835, true); v.setUint32(46, 2, true); v.setUint32(50, 2, true);
    b.set([255, 255, 255, 0, 0, 0, 0, 0], 54); // white, black
    for (let y = 0; y < h; y++) {
      const row = off + (h - 1 - y) * rowBytes; // bottom row first
      for (let x = 0; x < w; x++) if (bits[y * w + x]) b[row + (x >> 3)] |= 0x80 >> (x & 7);
    }
    return b;
  }

  // C array for Arduino / ESP32 / Pico C code.
  function cHeader(bytes, name, note) {
    const lines = [];
    for (let i = 0; i < bytes.length; i += 16) lines.push("  " + Array.from(bytes.slice(i, i + 16), (x) => "0x" + x.toString(16).padStart(2, "0")).join(", ") + ",");
    return `// ${note}\n// ${bytes.length} bytes, 800 x 480, 1 bit per pixel, rows left to right, leftmost pixel in the high bit.\n#pragma once\n#include <stdint.h>\n\nconst uint8_t ${name}[${bytes.length}] = {\n${lines.join("\n")}\n};\n`;
  }

  // The list of points (one per day) for the Pico, as a MicroPython file.
  function picoData(sc, rotate, oneIsBlack) {
    const s = sc.settings;
    const pts = sc.mainDays.map((p) => {
      if (!p.px) return "None";
      const [x, y] = pointToPanel(p.px[0], p.px[1], sc.W, sc.H, rotate);
      return `(${Math.round(x)},${Math.round(y)})`;
    });
    const rows = [];
    for (let i = 0; i < pts.length; i += 10) rows.push("    " + pts.slice(i, i + 10).join(", ") + ",");
    let box = "None";
    if (sc.todayBox) {
      const b = sc.todayBox;
      const a = pointToPanel(b.x, b.y, sc.W, sc.H, rotate), c = pointToPanel(b.x + b.w, b.y + b.h, sc.W, sc.H, rotate);
      box = `(${Math.round(Math.min(a[0], c[0]))}, ${Math.round(Math.min(a[1], c[1]))}, ${Math.round(Math.abs(c[0] - a[0]))}, ${Math.round(Math.abs(c[1] - a[1]))})`;
    }
    const turn = sc.W === 800 ? 0 : rotate === "ccw" ? 270 : 90;
    return `# Pico Analemma Planner: points for analemma.bin (made ${new Date().toISOString().slice(0, 10)}).
# ${s.place}, ${latWord(s.lat)} ${lonWord(s.lon)}, sun at ${clock(s.hour * 60 + s.minute)} ${zoneWord(s)}, ${s.style} view.
# POINTS[n] is where the sun's dot goes on day n + 1 of the year, in panel pixels (x, y), or None if off the picture.

PLACE = ${JSON.stringify(s.place || "")}
LAT = ${s.lat}
LON = ${s.lon}
UTC_OFFSET = ${s.utcOffset}  # hours; Arizona stays on MST all year
TIME_KIND = ${JSON.stringify(s.timeKind)}
SUN_MINUTES = ${s.hour * 60 + s.minute}
ONE_IS_BLACK = ${oneIsBlack ? "True" : "False"}  # how analemma.bin stores black; match your driver
TEXT_TURN = ${turn}  # degrees to turn text so it reads upright on your mounted panel
TODAY_BOX = ${box}  # (x, y, w, h) free space for today's numbers, or None
DOT_R = 8

POINTS = [
${rows.join("\n")}
]
`;
  }

  // Spreadsheet of every day: handy for laying out a real wall or floor mark.
  function csv(sc) {
    const s = sc.settings;
    const u = s.style === "wall" || s.style === "floor";
    const head = ["date", "declination_deg", "sundial_fast_min", "sun_altitude_deg", "sun_azimuth_deg", "pixel_x", "pixel_y"];
    if (u) head.push(`${s.style}_across_${s.unit}`, `${s.style === "wall" ? "below_nodus" : "north_of_pole"}_${s.unit}`);
    const rows = [head.join(",")];
    for (const p of sc.mainDays) {
      const r = [`${s.year}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`, p.decl.toFixed(3), p.eot.toFixed(2), p.alt.toFixed(3), p.az.toFixed(3),
        p.px ? p.px[0].toFixed(1) : "", p.px ? p.px[1].toFixed(1) : ""];
      if (u) {
        const q = p.xy;
        r.push(q ? (q[0] * s.gnomon).toFixed(2) : "", q ? ((s.style === "wall" ? -q[1] : q[1]) * s.gnomon).toFixed(2) : "");
      }
      rows.push(r.join(","));
    }
    return rows.join("\n") + "\n";
  }

  const api = {
    solar, sunAt, vec, momentOf, yearOfSun, seasons, sunTimes, dayOfYear, dateOf, daysIn, isLeap,
    clock, hourWord, deg, fastSlow, dateWord, MONTHS, DEFAULTS, clean, scene, camera, wallXY, floorXY,
    toPanel, pointToPanel, packHLSB, bmp1, cHeader, picoData, csv,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.APL = api;
})(typeof self !== "undefined" ? self : this);
