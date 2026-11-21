// Brick Pile: the built-in ideas, used when there is no key (and free to use when there is one).
// Each build is written as a side view, one text line per layer from the bottom up. From that one description the app
// works out which pieces the build needs, picks them from the builder's pile, draws the picture in the builder's own
// colours and writes the steps. So a build cannot ask for a piece that its picture does not show.
(function (root) {
  "use strict";
  const B = root.BrickPile || require("./core.js");

  // The pieces a build may be written with. w is how many studs wide it looks from the side; h is its height in studs.
  // size is what it counts as when the pile only says "small", "medium" or "large".
  const brick = (name, w, size) => ({ name, w, h: 1.2, size, kind: "brick", shape: "block" });
  const plate = (name, w, size) => ({ name, w, h: 0.4, size, kind: "plate", shape: "block" });
  const TYPES = {
    B24: brick("2 x 4 brick", 4, "large"), B22: brick("2 x 2 brick", 2, "medium"), B14: brick("1 x 4 brick", 4, "medium"),
    B12: brick("1 x 2 brick", 2, "small"), B11: brick("1 x 1 brick", 1, "small"),
    P28: plate("2 x 8 plate", 8, "large"), P26: plate("2 x 6 plate", 6, "large"), P24: plate("2 x 4 plate", 4, "large"),
    P22: plate("2 x 2 plate", 2, "medium"), P12: plate("1 x 2 plate", 2, "small"),
    SL: { name: "2 x 2 roof slope", w: 2, h: 1.2, size: "medium", kind: "slope", shape: "slopeL" }, // low on the left
    SR: { name: "2 x 2 roof slope", w: 2, h: 1.2, size: "medium", kind: "slope", shape: "slopeR" }, // low on the right
    W: { name: "wheel", w: 2, h: 1.6, size: "wheel", kind: "wheel", shape: "wheel" },
    C: { name: "1 x 2 clear brick", w: 2, h: 1.2, size: "small", kind: "brick", shape: "block", clear: true },
    R: { name: "1 x 1 round brick", w: 1, h: 1.2, size: "small", kind: "round", shape: "round" },
  };

  // Each piece is written TYPE@x:group. x is how many studs from the left it starts. Pieces in the same group (a, b, c)
  // are given the same colour where the pile allows; "like" says which colours suit a group best.
  const E = "easy", M = "medium", H = "tricky";
  const BUILDS = [
    { id: "tower", name: "Stripy tower", level: E, about: "How tall can it go before it wobbles?", rows: ["B22@0:a", "B22@0:b", "B22@0:a", "B22@0:b", "B22@0:a", "R@0:b"] },
    { id: "stairs", name: "Stairs", level: E, about: "Three steps for a figure to climb.", rows: ["B24@0:a B22@4:a", "B24@0:b", "B22@0:c"] },
    { id: "car", name: "Little car", level: E, about: "A low car that really rolls.", like: { a: ["red", "blue", "yellow"] }, rows: ["W@0 W@4", "P26@0:a", "B24@0:a B12@4:b", "C@2"] },
    { id: "table", name: "Table", level: E, about: "A table for a brick picnic.", like: { b: ["brown", "tan", "white"] }, rows: ["B11@0:a B11@5:a", "P26@0:b"] },
    { id: "chair", name: "Chair", level: E, about: "A chair with a tall back.", rows: ["B11@0:a B11@3:a", "P24@0:b", "B12@0:a", "B12@0:a"] },
    { id: "bridge", name: "Bridge", level: E, about: "Drive a car under it or walk a figure over it.", like: { a: ["light gray", "dark gray"] }, rows: ["B22@0:a B22@6:a", "B22@0:a B22@6:a", "P28@0:b"] },
    { id: "pyramid", name: "Pyramid", level: E, about: "Three layers, each smaller than the last.", like: { a: ["tan", "yellow", "orange"] }, rows: ["B24@0:a B24@4:a", "B24@2:b", "B22@3:c"] },
    { id: "snake", name: "Snake", level: E, about: "A long striped snake with its head up.", like: { a: ["green", "lime"], b: ["yellow", "orange"] }, rows: ["B24@0:a B24@4:b B24@8:a", "B22@10:b", "R@10:c R@11:c"] },
    { id: "bed", name: "Bed", level: E, about: "A bed with a pillow, just right for a figure.", like: { c: ["white"] }, rows: ["B22@0:a B22@6:a", "P28@0:b", "B12@0:c"] },
    { id: "bench", name: "Park bench", level: E, about: "Somewhere to sit and watch the builds go by.", like: { b: ["brown", "tan", "green"] }, rows: ["B12@0:a B12@4:a", "P26@0:b"] },
    { id: "podium", name: "Winners' podium", level: E, about: "First, second and third place for a race.", rows: ["B24@0:a B24@4:a B24@8:a", "B24@0:a B24@4:a", "B24@4:b"] },
    { id: "boat", name: "Sailing boat", level: E, about: "A boat with a mast and a little flag.", like: { a: ["blue", "red", "white"], c: ["brown", "black", "white"] }, rows: ["P26@1:a", "P28@0:a", "B24@2:b", "B11@3:c", "B11@3:c", "P12@3:b"] },
    { id: "gate", name: "Garden gate", level: E, about: "Two posts and a top to walk under.", rows: ["B22@0:a B22@6:a", "B22@0:a B22@6:a", "B22@0:a B22@6:a", "P28@0:b", "B24@2:b"] },
    { id: "sofa", name: "Sofa", level: E, about: "A comfy sofa with two arms.", rows: ["B24@0:a B24@4:a", "B12@0:b B12@6:b"] },

    { id: "house", name: "House", level: M, about: "A house with a window and a pointed roof.", like: { b: ["red", "brown", "dark gray", "blue"] }, rows: ["B24@0:a B24@4:a", "B22@0:a C@2 B24@4:a", "B24@0:a B24@4:a", "SL@0:b B24@2:b SR@6:b", "SL@2:b SR@4:b"] },
    { id: "truck", name: "Truck", level: M, about: "A truck with a cab and a load on the back.", like: { b: ["red", "blue", "green"] }, rows: ["W@0 W@6", "P28@0:a", "B22@0:b B24@3:c", "C@0"] },
    { id: "robot", name: "Robot", level: M, about: "A chunky robot with big feet.", like: { b: ["light gray", "dark gray", "blue"] }, rows: ["B22@0:a B22@4:a", "B12@0:a B12@4:a", "P26@0:b", "B24@1:b", "B24@1:b", "B22@2:c", "R@2:a"] },
    { id: "dog", name: "Dog", level: M, about: "A dog with a wagging tail and one ear up.", like: { a: ["brown", "tan", "white", "black"] }, rows: ["B12@0:a B12@4:a", "B24@0:a B12@4:a", "B11@0:b B22@4:a", "B11@5:b"] },
    { id: "giraffe", name: "Giraffe", level: M, about: "Long legs and a longer neck.", like: { a: ["yellow", "tan", "orange"], b: ["brown", "orange"] }, rows: ["B11@0:a B11@3:a", "B11@0:a B11@3:a", "B24@0:a", "B11@3:b", "B11@3:a", "B11@3:b", "B12@3:a"] },
    { id: "jet", name: "Jet on the runway", level: M, about: "A jet with a cockpit and a tail fin.", like: { a: ["white", "light gray", "blue"] }, rows: ["W@2", "P28@0:a", "B11@0:b B24@1:a C@5", "B11@0:b"] },
    { id: "flower", name: "Flower", level: M, about: "A flower that never needs watering.", like: { a: ["green", "lime"], b: ["red", "pink", "yellow", "purple"] }, rows: ["P24@0:a", "B12@1:a", "B12@1:a", "B24@0:b", "B12@1:b"] },
    { id: "tree", name: "Tree", level: M, about: "A leafy tree for a park or a garden.", like: { a: ["brown", "tan", "black"], b: ["green", "lime"] }, rows: ["B22@2:a", "B22@2:a", "P26@0:b", "B24@1:b", "B22@2:b"] },
    { id: "rocket", name: "Rocket", level: M, about: "Three, two, one, lift off!", like: { a: ["white", "light gray"], b: ["red", "orange"] }, rows: ["SL@0:b B22@2:a SR@4:b", "B22@2:a", "B22@2:b", "B22@2:a", "C@2", "B12@2:b", "R@2:b"] },
    { id: "duck", name: "Duck", level: M, about: "A little duck with a beak.", like: { a: ["yellow", "white"], b: ["orange", "red"] }, rows: ["B24@0:a", "B24@0:a", "P12@3:b", "B22@2:a"] },
    { id: "tractor", name: "Tractor", level: M, about: "A tractor with a cab and a roof.", like: { a: ["green", "red", "blue"] }, rows: ["W@0 W@4", "P26@0:a", "B22@0:b B24@2:a", "B22@0:b", "P24@0:c"] },

    { id: "lighthouse", name: "Lighthouse", level: H, about: "A striped tower with a light at the top.", like: { a: ["white"], b: ["red"] }, rows: ["B24@0:a B24@4:a", "B24@2:b", "B22@3:a", "B22@3:b", "B22@3:a", "C@3", "P24@2:b", "R@3:a"] },
    { id: "bus", name: "Bus", level: H, about: "A bus with a row of windows.", like: { a: ["red", "yellow", "blue"] }, rows: ["W@0 W@6", "P28@0:a", "B24@0:a B24@4:a", "C@0 C@2 C@4 C@6", "P28@0:a"] },
    { id: "dinosaur", name: "Dinosaur", level: H, about: "A long-necked dinosaur with spikes on its back.", like: { a: ["green", "lime", "dark gray"], b: ["orange", "red", "yellow"] }, rows: ["B12@2:a B12@6:a", "B24@0:a B24@4:a", "B11@2:b B11@4:b B22@6:a", "B22@6:a", "B24@6:a"] },
    { id: "train", name: "Steam engine", level: H, about: "An engine with a cab, a boiler and a chimney.", like: { a: ["black", "red", "green"] }, rows: ["W@0 W@3 W@6", "P28@0:a", "B24@0:b B24@4:a", "B22@0:b R@5:c", "P24@0:c"] },
    { id: "castle", name: "Castle wall", level: H, about: "A wall with towers at the top to defend.", like: { a: ["light gray", "dark gray", "tan"] }, rows: ["B24@0:a B24@4:a B24@8:a", "B22@0:b B24@2:a B24@6:a B22@10:b", "B24@0:a B24@4:a B24@8:a", "B22@0:b B22@5:b B22@10:b"] },
    { id: "helicopter", name: "Helicopter", level: H, about: "A helicopter on its skids, rotor ready to spin.", like: { a: ["red", "yellow", "blue"], b: ["black", "dark gray", "light gray"] }, rows: ["P12@1:c P12@5:c", "B24@0:a B24@4:a", "C@0 B22@2:a", "B11@3:b", "P28@0:b"] },
    { id: "skyscraper", name: "Skyscraper", level: H, about: "A tall tower with windows on every floor.", like: { a: ["light gray", "white", "blue"] }, rows: ["B24@0:a", "B12@0:a C@2", "B24@0:a", "C@0 B12@2:a", "B24@0:a", "B12@0:a C@2", "B24@0:a", "B22@1:b", "R@1:b"] },
  ];

  // The pieces of a build, in order from the bottom layer up and left to right.
  function piecesOf(build) {
    const out = [];
    build.rows.forEach((row, r) => row.split(" ").forEach((tok) => {
      const m = /^([A-Z]+\d*)@(\d+)(?::([a-z]))?$/.exec(tok);
      if (!m || !TYPES[m[1]]) throw new Error(`${build.id}: cannot read "${tok}"`);
      out.push({ t: m[1], type: TYPES[m[1]], x: Number(m[2]), row: r, group: m[3] || "" });
    }));
    return out;
  }

  // What a line of the pile counts as: a wheel, or a small, medium or large block. "2 x 4 brick" is large because it
  // has 8 studs; "small brick" (from the on-device count) is small because it says so.
  function sizeOf(item) {
    const n = item.name;
    if (item.kind === "wheel" || /wheel|tire|tyre/.test(n)) return "wheel";
    const m = /(\d+) x (\d+)/.exec(n);
    if (m) { const studs = Number(m[1]) * Number(m[2]); return studs <= 2 ? "small" : studs <= 6 ? "medium" : "large"; }
    if (/small|tiny|little/.test(n)) return "small";
    if (/large|big|long/.test(n)) return "large";
    return "medium";
  }
  const isSlope = (item) => item.kind === "slope" || /slope|roof/.test(item.name);
  const isBlock = (item) => ["brick", "plate", "tile", "round"].includes(item.kind) && !isSlope(item) && sizeOf(item) !== "wheel";

  // Pick the pieces for one build out of the pile. Returns which line of the pile each piece comes from
  // (or nothing, if the pile has no piece that will do).
  function plan(build, items) {
    const pool = new Map(items.map((i) => [i.id, i.count])), pieces = piecesOf(build), got = pieces.map(() => null), like = build.like || {};
    const left = (i) => pool.get(i.id) || 0;
    // Can this line stand in for this piece? "strict" means the real thing; otherwise a near enough stand-in.
    const fits = (i, type, strict) => {
      if (type.shape === "wheel") return sizeOf(i) === "wheel";
      if (type.kind === "slope") return strict ? isSlope(i) : isBlock(i) && sizeOf(i) === "medium";
      if (type.clear) return strict ? i.color === "clear" && isBlock(i) && sizeOf(i) !== "large" : isBlock(i) && sizeOf(i) === "small";
      return isBlock(i) && sizeOf(i) === type.size;
    };
    const score = (i, type, color) => (i.color === color ? 100 : 0) + (i.name === type.name ? 20 : 0) + (i.kind === type.kind ? 5 : 0) - (i.color === "clear" && !type.clear ? 10 : 0) + Math.min(left(i), 9) / 10;
    const take = (k, strict, color) => {
      if (got[k]) return true;
      const type = pieces[k].type, c = items.filter((i) => left(i) > 0 && fits(i, type, strict)).sort((a, b) => score(b, type, color) - score(a, type, color))[0];
      if (!c) return false;
      pool.set(c.id, left(c) - 1); got[k] = c; return true;
    };
    const special = (p) => p.type.shape === "wheel" || p.type.kind === "slope" || p.type.clear;
    // 1. Wheels and clear pieces: the real thing, if the pile has it.
    pieces.forEach((p, k) => { if (p.type.shape === "wheel" || p.type.clear) take(k, true, "clear"); });
    // 2. Each colour group, biggest first: find one colour that has every block the group needs.
    const groups = Array.from(new Set(pieces.map((p) => p.group))).filter(Boolean)
      .sort((a, b) => pieces.filter((p) => p.group === b).length - pieces.filter((p) => p.group === a).length);
    const used = new Set(), chosen = {};
    for (const g of groups) {
      const mine = pieces.map((p, k) => k).filter((k) => pieces[k].group === g && !special(pieces[k]));
      const need = {}; mine.forEach((k) => { need[pieces[k].type.size] = (need[pieces[k].type.size] || 0) + 1; });
      const have = (color, size) => items.filter((i) => i.color === color && isBlock(i) && sizeOf(i) === size).reduce((n, i) => n + left(i), 0);
      const cover = (color) => Object.keys(need).reduce((n, s) => n + Math.min(need[s], have(color, s)), 0);
      const liked = like[g] || [];
      const colors = Array.from(new Set(items.filter((i) => isBlock(i) && i.color !== "clear").map((i) => i.color)))
        .sort((a, b) => cover(b) - cover(a) || (liked.indexOf(a) + 99) % 99 - (liked.indexOf(b) + 99) % 99 || used.has(a) - used.has(b));
      // a liked colour or an unused colour wins if it covers the whole group; otherwise whichever covers most
      const full = colors.filter((c) => cover(c) === mine.length);
      const color = liked.find((c) => full.includes(c) && !used.has(c)) || full.find((c) => !used.has(c)) || liked.find((c) => full.includes(c)) || full[0] || colors[0];
      chosen[g] = color; if (color) used.add(color);
      mine.forEach((k) => take(k, true, color));
    }
    // 3. Blocks in no group, then slopes (a real slope first), then stand-ins for anything special still missing.
    pieces.forEach((p, k) => { if (!special(p)) take(k, true, chosen[p.group]); });
    pieces.forEach((p, k) => { if (p.type.kind === "slope") take(k, true, chosen[p.group]) || take(k, false, chosen[p.group]); });
    pieces.forEach((p, k) => { if (p.type.clear) take(k, false, "white"); });
    return { pieces, got, missing: got.filter((g) => !g).length };
  }

  const count = (list) => { const out = []; for (const s of list) { const last = out[out.length - 1]; if (last && last.what === s) last.n++; else out.push({ what: s, n: 1 }); } return out; };
  const say = (list) => count(list).map((c) => (c.n > 1 ? `${c.n} × ${c.what}` : c.what)).join(", ");

  const standIn = (type, i) => (type.kind === "slope" && !isSlope(i)) || (!!type.clear && i.color !== "clear");

  // Turn a build and the pieces picked for it into something the screen can show: parts, steps and a picture.
  function idea(build, items) {
    const { pieces, got, missing } = plan(build, items);
    const parts = [], lacking = [];
    pieces.forEach((p, k) => {
      const i = got[k];
      if (!i) { const m = lacking.find((x) => x.name === p.type.name); if (m) m.count++; else lacking.push({ name: p.type.name, count: 1 }); return; }
      const part = parts.find((x) => x.name === i.name && x.color === i.color); if (part) part.count++; else parts.push({ name: i.name, color: i.color, count: 1 });
    });
    // Steps: one per layer, bottom first, naming the pieces left to right as they are called in the pile.
    const rows = build.rows.length, steps = [];
    for (let r = 0; r < rows; r++) {
      const names = pieces.map((p, k) => (p.row === r ? (got[k] ? B.label(got[k]) + (standIn(p.type, got[k]) ? ` (in place of a ${p.type.name})` : "") : `a ${p.type.name} (not in your pile)`) : null)).filter(Boolean);
      steps.push(`${r === 0 ? "Bottom layer" : r === rows - 1 ? "Top" : "Layer " + (r + 1)}: ${say(names)}.`);
    }
    // Picture: every piece as a shape, measured in studs, with the top of the build at y = 0.
    const heights = build.rows.map((_, r) => Math.max(...pieces.filter((p) => p.row === r).map((p) => p.type.h)));
    const base = heights.map((_, r) => heights.slice(0, r).reduce((a, b) => a + b, 0)), tall = heights.reduce((a, b) => a + b, 0);
    const x0 = Math.min(...pieces.map((p) => p.x)), wide = Math.max(...pieces.map((p) => p.x + p.type.w)) - x0;
    const shapes = pieces.map((p, k) => ({ s: p.type.shape, x: p.x - x0, y: +(tall - base[p.row] - p.type.h).toFixed(2), w: p.type.w, h: p.type.h, color: got[k] ? got[k].color : null }));
    return { id: build.id, builtin: true, name: build.name, level: build.level, about: build.about, parts, short: [], lacking, missing, steps,
      pieces: pieces.length - missing, draw: { w: wide, h: +tall.toFixed(2), shapes } };
  }

  // Up to "n" ideas for this pile that have not been shown yet. Builds the pile can make completely come first, in the
  // order that suits the builder's age; if those run out, builds that are only a piece or two short are offered.
  const ORDER = { little: [E, M, H], kid: [M, E, H], grownup: [H, M, E] };
  function suggest(items, who, shown, n) {
    const order = ORDER[who] || ORDER.kid, skip = new Set(shown || []);
    const all = BUILDS.filter((b) => !skip.has(b.id)).map((b) => idea(b, items));
    const rank = (a, b) => order.indexOf(a.level) - order.indexOf(b.level) || b.pieces - a.pieces;
    const ready = all.filter((i) => !i.missing).sort(rank);
    const near = all.filter((i) => i.missing && i.missing <= 3 && i.pieces >= 2).sort((a, b) => a.missing - b.missing || rank(a, b));
    return ready.concat(near).slice(0, n || 3);
  }

  const api = { TYPES, BUILDS, piecesOf, sizeOf, isSlope, isBlock, plan, idea, suggest };
  root.BrickBuilds = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
