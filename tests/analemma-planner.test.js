// Tests the sun math, picture layout and Pico files of Pico Analemma Planner. Run: node tests/analemma-planner.test.js
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const os = require("os");
const A = require(path.join(__dirname, "../analemma-planner/core.js"));
const assert = require("assert");
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} not within ${tol} of ${b}`);

// ---------- the sun, against published values ----------
const tucson = A.clean({});
assert.strictEqual(tucson.lat, 32.22);
assert.strictEqual(tucson.utcOffset, -7);
const sunNoon = (m, d) => A.sunAt(A.momentOf(2026, A.dayOfYear(2026, m, d), 720, tucson), tucson.lat, tucson.lon);
near(sunNoon(2, 11).eot, -14.2, 0.3, "equation of time, Feb 11");
near(sunNoon(11, 3).eot, 16.4, 0.3, "equation of time, Nov 3");
near(sunNoon(6, 21).decl, 23.44, 0.05, "June solstice declination");
near(sunNoon(12, 21).decl, -23.44, 0.05, "December solstice declination");
// At Tucson, the sun at noon MST is east of due south all year (Tucson is west of the MST meridian)
for (let doy = 1; doy <= 365; doy++) {
  const p = A.sunAt(A.momentOf(2026, doy, 720, tucson), tucson.lat, tucson.lon);
  assert(p.az > 140 && p.az < 180, `noon azimuth day ${doy}: ${p.az}`);
  assert(p.alt > 33 && p.alt < 82, `noon altitude day ${doy}: ${p.alt}`);
}
// Sun time centres the figure on due south
const sunTime = A.clean({ timeKind: "sun" });
const hs = A.yearOfSun(sunTime, 720).map((p) => p.ha);
near(hs.reduce((a, b) => a + b, 0) / hs.length, 0, 0.3, "mean hour angle at sun-time noon");
// Sunrise and sunset, Tucson, Nov 27 2026: about 7:04 am and 5:19 pm
const t = A.sunTimes(2026, 11, 27, tucson);
assert.strictEqual(A.clock(t.rise), "7:04 am");
assert.strictEqual(A.clock(t.set), "5:19 pm");
assert.strictEqual(A.clock(t.noon), "12:11 pm");
// Seasons land on the right days
const ss = A.seasons(A.yearOfSun(tucson, 720)).map((z) => A.dateWord(z.day.m, z.day.d));
assert.deepStrictEqual(ss, ["Mar 20", "Jun 21", "Sep 22", "Dec 21"]);
assert.strictEqual(A.yearOfSun(A.clean({ year: 2028 }), 720).length, 366);

// ---------- words ----------
assert.strictEqual(A.clock(0), "12:00 am");
assert.strictEqual(A.clock(13 * 60 + 5), "1:05 pm");
assert.strictEqual(A.hourWord(9 * 60), "9 am");
assert.strictEqual(A.fastSlow(12.3), "Sundial 12 min fast");
assert.strictEqual(A.fastSlow(-14.2), "Sundial 14 min slow");
assert.strictEqual(A.clean({ lat: "abc", style: "nope", widen: 9 }).lat, A.DEFAULTS.lat);
assert.strictEqual(A.clean({ style: "nope" }).style, "sky");
assert.strictEqual(A.clean({ widen: 9 }).widen, 4);

// ---------- every picture fits the panel and has no bad numbers ----------
let pictures = 0;
for (const style of ["sky", "wall", "floor", "classic"]) for (const hours of ["one", "many"]) for (const layout of ["landscape", "portrait"])
  for (const opt of [{}, { panel: false, title: false }, { timeKind: "sun", line: "dots" }, { lat: -33.9, lon: 151.2, utcOffset: 10, place: "Sydney" }, { lat: 51.5, lon: 0, utcOffset: 0, hour: 9 }]) {
    const sc = A.scene(Object.assign({ style, hours, layout, markM: 3, markD: 15 }, opt));
    assert.strictEqual(sc.W * sc.H, 800 * 480);
    let curvePts = 0;
    for (const o of sc.shapes) {
      const nums = o.t === "line" || o.t === "poly" ? o.pts.flat() : [o.x, o.y, o.r || 0];
      assert(nums.every(Number.isFinite), `${style}/${hours}/${layout} ${o.t} has a bad number`);
      assert(nums.length < 3 || o.t === "text" || nums.every((v) => v > -20 && v < 820), `${style} ${o.t} far off the picture`);
      if (o.t === "text") assert(!/NaN|undefined|Infinity/.test(o.s), `bad text ${o.s}`);
      if (o.curve) curvePts += o.pts.length;
      if (o.curve) for (const [x, y] of o.pts) assert(x >= sc.area.x - 0.5 && x <= sc.area.x + sc.area.w + 0.5 && y >= sc.area.y - 0.5 && y <= sc.area.y + sc.area.h + 0.5, `${style} curve leaves the drawing area`);
    }
    if (opt.line !== "dots") assert(curvePts > 100, `${style}/${hours}/${layout} ${JSON.stringify(opt)} drew a curve (${curvePts})`);
    assert(sc.mark, `${style} marked date is on the picture`);
    pictures++;
  }
// The Pico version leaves the date off and keeps a box free for today's numbers
const dev = A.scene({}, { device: true });
assert.strictEqual(dev.mark, null);
assert(dev.todayBox && dev.todayBox.w > 100 && dev.todayBox.h > 100, "room for today's numbers");
assert(!dev.shapes.some((o) => o.t === "text" && /Sundial/.test(o.s)), "no fixed date numbers on the Pico picture");
const devTall = A.scene({ layout: "portrait" }, { device: true });
assert(devTall.todayBox.x > 200, "tall picture: today's box is the right-hand column");

// ---------- files ----------
// framebuf MONO_HLSB: leftmost pixel is the high bit
const bits = new Uint8Array(800 * 480); bits[0] = 1; bits[9] = 1; bits[800 * 2 + 799] = 1;
const hl = A.packHLSB(bits, 800, 480, true);
assert.strictEqual(hl.length, 48000);
assert.strictEqual(hl[0], 0x80); assert.strictEqual(hl[1], 0x40); assert.strictEqual(hl[100 * 2 + 99], 0x01);
const hlFlip = A.packHLSB(bits, 800, 480, false);
assert.strictEqual(hlFlip[0], 0x7f); assert.strictEqual(hlFlip[5], 0xff);
// Turning a tall picture to fit the panel, and points turn the same way
for (const rot of ["cw", "ccw"]) {
  const tall = new Uint8Array(480 * 800); tall[10 * 480 + 20] = 1; // x 20, y 10
  const out = A.toPanel(tall, 480, 800, rot);
  assert.strictEqual(out.w, 800); assert.strictEqual(out.h, 480);
  const [px, py] = A.pointToPanel(20, 10, 480, 800, rot);
  assert.strictEqual(out.bits[py * 800 + px], 1, `turn ${rot}`);
  assert.strictEqual(out.bits.reduce((a, b) => a + b, 0), 1);
}
assert.deepStrictEqual(A.pointToPanel(5, 6, 800, 480, "cw"), [5, 6]);
// 1-bit BMP
const bmp = A.bmp1(bits, 800, 480);
assert.strictEqual(bmp.length, 62 + 100 * 480);
assert.strictEqual(String.fromCharCode(bmp[0], bmp[1]), "BM");
const dv = new DataView(bmp.buffer);
assert.strictEqual(dv.getUint32(2, true), bmp.length);
assert.strictEqual(dv.getUint16(28, true), 1);
assert.strictEqual(bmp[62 + 479 * 100], 0x80, "top row is stored last"); assert.strictEqual(bmp[62 + 479 * 100 + 1], 0x40);
// C header
const h = A.cHeader(hl, "analemma_bits", "test");
assert(/const uint8_t analemma_bits\[48000\]/.test(h));
assert.strictEqual((h.match(/0x/g) || []).length, 48000);
// CSV
const csv = A.csv(A.scene({ style: "wall", year: 2026 })).trim().split("\n");
assert.strictEqual(csv.length, 366);
assert(csv[0].includes("below_nodus_in"));
assert(csv[1].startsWith("2026-01-01,"));

// ---------- the Pico's Python files are valid Python ----------
const pyOK = (() => { try { execFileSync("python3", ["--version"]); return true; } catch { return false; } })();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "apl-"));
for (const [layout, rot] of [["landscape", "cw"], ["portrait", "cw"], ["portrait", "ccw"]]) {
  const sc = A.scene({ layout }, { device: true });
  const py = A.picoData(sc, rot, true);
  assert(/POINTS = \[/.test(py) && /TODAY_BOX = \(\d+, \d+, \d+, \d+\)/.test(py));
  assert.strictEqual(py.match(/TEXT_TURN = (\d+)/)[1], layout === "landscape" ? "0" : rot === "cw" ? "90" : "270");
  const n = (py.match(/\(\d+,\d+\)/g) || []).length;
  assert.strictEqual(n, 365, "a point for every day");
  for (const m of py.matchAll(/\((\d+),(\d+)\)/g)) assert(+m[1] < 800 && +m[2] < 480, "points are on the panel");
  if (pyOK) {
    const f = path.join(tmp, "analemma_data.py"); fs.writeFileSync(f, py);
    const out = execFileSync("python3", ["-I", "-c", "import runpy,sys;d=runpy.run_path(sys.argv[1]);print(len(d['POINTS']),d['TODAY_BOX'][2]>0)", f]).toString().trim();
    assert.strictEqual(out, "365 True");
  }
}
if (pyOK) {
  execFileSync("python3", ["-I", "-c", "import ast,sys;ast.parse(open(sys.argv[1]).read())", path.join(__dirname, "../analemma-planner/pico/main.py")]);
  // The Pico's own sun numbers match the page's
  const code = `
import sys, types
sys.modules['framebuf'] = types.ModuleType('framebuf')
A = types.ModuleType('analemma_data'); A.ONE_IS_BLACK = True; A.UTC_OFFSET = -7; sys.modules['analemma_data'] = A
src = open(sys.argv[1]).read().replace('\\nmain()\\n', '\\n')
g = {}; exec(src, g)
d, e = g['sun_numbers'](331, 2026)
print('%.2f %.2f' % (d, e))`;
  const out = execFileSync("python3", ["-I", "-c", code, path.join(__dirname, "../analemma-planner/pico/main.py")]).toString().trim().split(" ").map(Number);
  const js = A.solar(Date.UTC(2026, 0, 331, 19));
  near(out[0], js.decl, 0.02, "Pico declination"); near(out[1], js.eot, 0.05, "Pico equation of time");
} else console.log("(python3 not found: skipped the Python checks)");
fs.rmSync(tmp, { recursive: true, force: true });

// ---------- offline list covers every file the page needs ----------
const sw = fs.readFileSync(path.join(__dirname, "../analemma-planner/sw.js"), "utf8");
for (const f of ["index.html", "style.css", "core.js", "app.js", "manifest.webmanifest", "icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "pico/main.py"]) {
  assert(sw.includes(`"${f}"`), `sw.js keeps ${f}`);
  assert(fs.existsSync(path.join(__dirname, "../analemma-planner", f)), `${f} exists`);
}

console.log(`analemma-planner: all tests passed (${pictures} pictures checked)`);
