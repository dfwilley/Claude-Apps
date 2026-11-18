// Fit the Part: the puzzles and the arithmetic behind them. No screen code here, so it can be tested with Node.
// Each puzzle is a flat part whose sizes are named values (W, H, t ...). Some are given, some are asked for,
// and every clue is a straight-line sum (for example s - 2t = 0, "the slot is twice the tab"). The answers are
// never typed in by hand: solve() works them out from the givens and the clues, and the tests check that each
// puzzle has exactly one answer and that the drawing's dimensions match it.
(function (root) {
  "use strict";

  const LEVELS = [
    { name: "Apprentice", blurb: "One idea at a time: centered, evenly spaced, what's left over." },
    { name: "Journeyman", blurb: "Clues that lean on each other. Find one number, then the next." },
    { name: "Toolmaker", blurb: "Three unknowns that have to be worked out together." },
  ];

  // ---------- numbers ----------
  // Decimal inches the way SolidWorks shows them: up to 3 places, no trailing zeros.
  function fmt(n) {
    const r = Math.round(n * 1000) / 1000;
    return (Object.is(r, -0) ? 0 : r).toString();
  }
  // What the player typed: "1.5", ".5", "3/4" or "1 1/2". Anything else is NaN.
  function parse(text) {
    const s = String(text == null ? "" : text).trim();
    let m;
    if (/^(\d+\.?\d*|\.\d+)$/.test(s)) return parseFloat(s);
    if ((m = s.match(/^(\d+)\s*\/\s*(\d+)$/)) && +m[2]) return m[1] / m[2];
    if ((m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)) && +m[3]) return +m[1] + m[2] / m[3];
    return NaN;
  }
  const isRight = (answer, typed) => isFinite(typed) && Math.abs(typed - answer) < 0.0006;
  // Stars for a solved puzzle: a miss is a wrong answer or a hint.
  const stars = (misses) => (misses <= 0 ? 3 : misses <= 2 ? 2 : 1);

  // ---------- solving ----------
  // An equation is { k: { name: coefficient, ... }, c: constant }, meaning sum(coefficient * value) = c.
  const E = (k, c) => ({ k, c: c || 0 });
  // Solves given values plus equations. Returns { ok: true, v } only when there is exactly one answer.
  function solve(given, eqs) {
    const names = Object.keys(given);
    for (const e of eqs) for (const n of Object.keys(e.k)) if (!names.includes(n)) names.push(n);
    const n = names.length, rows = [];
    for (const g of Object.keys(given)) { const r = new Array(n + 1).fill(0); r[names.indexOf(g)] = 1; r[n] = given[g]; rows.push(r); }
    for (const e of eqs) { const r = new Array(n + 1).fill(0); for (const kk of Object.keys(e.k)) r[names.indexOf(kk)] += e.k[kk]; r[n] = e.c; rows.push(r); }
    let rank = 0;
    for (let col = 0; col < n; col++) {
      let p = -1, big = 1e-9;
      for (let i = rank; i < rows.length; i++) if (Math.abs(rows[i][col]) > big) { big = Math.abs(rows[i][col]); p = i; }
      if (p < 0) return { ok: false, why: `nothing pins down ${names[col]}` };
      [rows[rank], rows[p]] = [rows[p], rows[rank]];
      const d = rows[rank][col];
      for (let j = col; j <= n; j++) rows[rank][j] /= d;
      for (let i = 0; i < rows.length; i++) {
        if (i === rank) continue;
        const m = rows[i][col];
        if (m) for (let j = col; j <= n; j++) rows[i][j] -= m * rows[rank][j];
      }
      rank++;
    }
    for (let i = rank; i < rows.length; i++) if (Math.abs(rows[i][n]) > 1e-7) return { ok: false, why: "the clues disagree" };
    const v = {};
    names.forEach((nm, i) => { v[nm] = Math.round(rows[i][n] * 1e6) / 1e6; });
    return { ok: true, v };
  }

  // ---------- the puzzles ----------
  // sets: three choices of given numbers, so a puzzle played again has new numbers.
  // ask:  the missing values, in the order they get the letters A, B, C.
  // clues: what the player reads (t), the sums behind it (eqs), and how the same idea is said in SolidWorks (sw).
  // draw: the part in inches, x to the right and y down from its top-left corner.
  //   outline: corner points, or { circle: diameter } for a round part
  //   holes: { x, y, d }     cuts: { x, y, w, h, r } centered on x, y with corner radius r
  //   dims:  { n, t: "h", a, b, side: "t" | "b", row, ea, eb }   a width from x = a to x = b
  //          { n, t: "v", a, b, side: "l" | "r", row, ea, eb }   a height from y = a to y = b
  //          { n, t: "d", x, y, d, ang }                         a hole's diameter on a leader
  //          n is the value shown; ea and eb say where the two witness lines start on the part; dia adds the diameter mark.
  // how:  the working, one line at a time (also used as hints).
  // idea: a small part to model, with the numbers from the puzzle just solved.
  const rect = (W, H) => [[0, 0], [W, 0], [W, H], [0, H]];
  const PUZZLES = [
    // ===== Apprentice =====
    {
      id: "tag", name: "Key tag", level: 0,
      sets: [{ W: 4, H: 2, d: 0.5 }, { W: 3, H: 1.5, d: 0.375 }, { W: 5, H: 2.5, d: 0.75 }],
      ask: [{ n: "x", what: "hole center, in from the left edge" }, { n: "y", what: "hole center, down from the top edge" }],
      clues: [
        { t: "The hole is centered left to right.", eqs: [E({ x: 1, W: -0.5 })], sw: "Draw the plate with Center Rectangle starting on the origin, then put the circle's center on the origin. Nothing to type: it stays centered whatever the size." },
        { t: "It is centered top to bottom too.", eqs: [E({ y: 1, H: -0.5 })], sw: "Same trick. Or draw a construction line corner to corner and give the hole a Midpoint relation to it." },
      ],
      draw: ({ W, H, d, x, y }) => ({
        outline: rect(W, H), holes: [{ x, y, d }],
        dims: [
          { n: "x", t: "h", a: 0, b: x, side: "t", row: 1, eb: y }, { n: "W", t: "h", a: 0, b: W, side: "b", row: 1 },
          { n: "y", t: "v", a: 0, b: y, side: "l", row: 1, eb: x }, { n: "H", t: "v", a: 0, b: H, side: "r", row: 1 },
          { n: "d", t: "d", x, y, d, ang: 40 },
        ],
      }),
      how: ({ W, H, x, y }, f) => [
        `Centered left to right means half the width: ${f(W)} ÷ 2 = ${f(x)}.`,
        `Centered top to bottom means half the height: ${f(H)} ÷ 2 = ${f(y)}.`,
      ],
      idea: ({ W, H, d }, f) => ({
        name: "Hangar key tag",
        what: "A flat tag with a hole for the key ring. A good first part: one sketch, one extrude.",
        steps: [
          `Sketch on the Front Plane: a Center Rectangle ${f(W)} × ${f(H)} on the origin.`,
          `Add a ${f(d)} circle on the origin for the ring hole.`,
          "Extruded Boss/Base, 0.125 thick. Because the circle is inside the rectangle, it comes out as a hole.",
          "Fillet the four corners 0.25 so it doesn't snag a pocket.",
        ],
      }),
    },
    {
      id: "strap", name: "Two-hole strap", level: 0,
      sets: [{ W: 5, H: 1, e: 0.5 }, { W: 3.5, H: 0.75, e: 0.375 }, { W: 6, H: 1.5, e: 0.75 }],
      ask: [{ n: "c", what: "hole to hole, center to center" }, { n: "y", what: "hole centers, down from the top edge" }],
      clues: [
        { t: "Both holes sit the same distance in from their ends.", eqs: [E({ c: 1, e: 2, W: -1 })], sw: "Draw a vertical centerline through the middle, select both circles and the centerline, and add a Symmetric relation. One dimension then places both holes." },
        { t: "Both are on the strap's centerline.", eqs: [E({ y: 1, H: -0.5 })], sw: "A Horizontal relation between each hole center and the origin keeps them on the centerline." },
      ],
      draw: ({ W, H, e, c, y }) => ({
        outline: rect(W, H), holes: [{ x: e, y, d: H * 0.3 }, { x: e + c, y, d: H * 0.3 }],
        dims: [
          { n: "e", t: "h", a: 0, b: e, side: "t", row: 1, eb: y }, { n: "c", t: "h", a: e, b: e + c, side: "t", row: 1, ea: y, eb: y },
          { n: "W", t: "h", a: 0, b: W, side: "b", row: 1 },
          { n: "y", t: "v", a: 0, b: y, side: "l", row: 1, eb: e }, { n: "H", t: "v", a: 0, b: H, side: "r", row: 1 },
        ],
      }),
      how: ({ W, H, e, c, y }, f) => [
        `The two end distances use up 2 × ${f(e)} = ${f(2 * e)} of the length.`,
        `What is left is hole to hole: ${f(W)} − ${f(2 * e)} = ${f(c)}.`,
        `The centerline is half the height: ${f(H)} ÷ 2 = ${f(y)}.`,
      ],
      idea: ({ W, H, e, c }, f) => ({
        name: "Shop-light hanger strap",
        what: "A flat link with a hole at each end, for hanging a light or joining two brackets.",
        steps: [
          `Sketch a Center Rectangle ${f(W)} × ${f(H)} on the origin.`,
          `Draw one circle ${f(e)} in from the left end, on the centerline.`,
          `Mirror Entities about a vertical centerline to get the second hole. Check with Smart Dimension: the holes should read ${f(c)} apart.`,
          "Extruded Boss/Base 0.125, then a full-round look: Fillet the corners at half the strap's height.",
        ],
      }),
    },
    {
      id: "comb", name: "Tab and slot", level: 0,
      sets: [{ W: 4, H: 2, g: 1 }, { W: 3, H: 1.5, g: 0.75 }, { W: 5, H: 2, g: 0.5 }],
      ask: [{ n: "t", what: "width of one tab" }, { n: "s", what: "width of the slot" }],
      clues: [
        { t: "The slot is twice as wide as a tab.", eqs: [E({ s: 1, t: -2 })], sw: "Dimension the tab, then dimension the slot and type = in the box, click the tab's dimension and add *2. That is an equation: change the tab and the slot follows." },
        { t: "The two tabs are the same width.", eqs: [E({ t: 2, s: 1, W: -1 })], sw: "Select the two short top edges and add an Equal relation." },
      ],
      draw: ({ W, H, g, t, s }) => ({
        outline: [[0, 0], [t, 0], [t, g], [t + s, g], [t + s, 0], [W, 0], [W, H], [0, H]],
        dims: [
          { n: "t", t: "h", a: 0, b: t, side: "t", row: 1 }, { n: "s", t: "h", a: t, b: t + s, side: "t", row: 1 },
          { n: "W", t: "h", a: 0, b: W, side: "b", row: 1 },
          { n: "g", t: "v", a: 0, b: g, side: "l", row: 1, eb: t }, { n: "H", t: "v", a: 0, b: H, side: "r", row: 1 },
        ],
      }),
      how: ({ W, t, s }, f) => [
        "A slot twice as wide as a tab is worth two tabs. So the full width is tab + two tabs + tab: four tab-widths.",
        `One tab: ${f(W)} ÷ 4 = ${f(t)}.`,
        `The slot: 2 × ${f(t)} = ${f(s)}.`,
      ],
      idea: ({ W, H, g, t, s }, f) => ({
        name: "Cord-wrap fork",
        what: "A forked plate for winding up an extension cord or a headset cable: the cord drops into the slot.",
        steps: [
          `Sketch a Corner Rectangle ${f(W)} × ${f(H)}.`,
          `Sketch the slot as a second rectangle on the top edge, ${f(s)} wide and ${f(g)} deep, with ${f(t)} left on each side.`,
          "Extruded Boss/Base 0.19 thick, then Extruded Cut, Through All, for the slot. (Or draw it as one outline and extrude once.)",
          "Fillet the bottom of the slot so the cord isn't bent over a sharp corner.",
        ],
      }),
    },
    {
      id: "step", name: "Step block", level: 0,
      sets: [{ W: 3, H: 2, a: 1 }, { W: 4, H: 1.5, a: 1.5 }, { W: 2.5, H: 1, a: 0.75 }],
      ask: [{ n: "b", what: "width of the low side" }, { n: "h", what: "how far the step drops" }],
      clues: [
        { t: "The tall side and the low side together make the full width.", eqs: [E({ a: 1, b: 1, W: -1 })], sw: "You would dimension the full width and the tall side only. The low side is then a driven dimension: SolidWorks works it out, just as you did." },
        { t: "The step drops exactly half the block's height.", eqs: [E({ h: 1, H: -0.5 })], sw: "Add a Midpoint relation between the step's corner and the tall left edge. No number needed." },
      ],
      draw: ({ W, H, a, b, h }) => ({
        outline: [[0, 0], [a, 0], [a, h], [W, h], [W, H], [0, H]],
        dims: [
          { n: "a", t: "h", a: 0, b: a, side: "t", row: 1 }, { n: "b", t: "h", a, b: W, side: "t", row: 1, eb: h },
          { n: "W", t: "h", a: 0, b: W, side: "b", row: 1 },
          { n: "H", t: "v", a: 0, b: H, side: "l", row: 1 }, { n: "h", t: "v", a: 0, b: h, side: "r", row: 1, ea: a },
        ],
      }),
      how: ({ W, H, a, b, h }, f) => [
        `The low side is what is left of the width: ${f(W)} − ${f(a)} = ${f(b)}.`,
        `Half the height: ${f(H)} ÷ 2 = ${f(h)}.`,
      ],
      idea: ({ W, H, a, h }, f) => ({
        name: "Drill-press step block",
        what: "A stepped block that holds up the back of a hold-down clamp at two different heights.",
        steps: [
          `Sketch the L-shaped outline with the Line tool: ${f(W)} wide, ${f(H)} tall, the tall side ${f(a)} wide.`,
          `Give the step its ${f(h)} drop with Smart Dimension. The sketch lines turn black when every size is pinned down.`,
          "Extruded Boss/Base, 1 inch deep, Mid Plane so the part is centered on the sketch.",
          "Chamfer the outside edges 0.03 so it is kind to fingers.",
        ],
      }),
    },
    {
      id: "ring", name: "Spacer", level: 0,
      sets: [{ D: 2 }, { D: 1 }, { D: 3 }],
      ask: [{ n: "d", what: "diameter of the hole" }, { n: "w", what: "thickness of the wall" }],
      clues: [
        { t: "The wall of the ring is half as thick as the hole is wide.", eqs: [E({ w: 1, d: -0.5 })], sw: "Dimension the hole, then set the outside circle with an equation: = hole dimension * 2." },
        { t: "Wall, hole, wall: together they span the outside diameter.", eqs: [E({ w: 2, d: 1, D: -1 })], sw: "Two circles on the same center point are Concentric. Draw both from the origin and they already are." },
      ],
      draw: ({ D, d, w }) => ({
        outline: { circle: D }, holes: [{ x: D / 2, y: D / 2, d }],
        dims: [
          { n: "w", t: "h", a: 0, b: w, side: "t", row: 1, ea: D / 2, eb: D / 2 }, { n: "d", t: "h", a: w, b: w + d, side: "t", row: 1, ea: D / 2, eb: D / 2, dia: true },
          { n: "D", t: "h", a: 0, b: D, side: "b", row: 1, ea: D / 2, eb: D / 2, dia: true },
        ],
      }),
      how: ({ D, d, w }, f) => [
        "Each wall is half a hole, so the two walls together are worth one more hole. The outside diameter is two hole-widths.",
        `The hole: ${f(D)} ÷ 2 = ${f(d)}.`,
        `One wall: ${f(d)} ÷ 2 = ${f(w)}.`,
      ],
      idea: ({ D, d }, f) => ({
        name: "Standoff spacer",
        what: "A plain round spacer, the kind that holds a panel off a bracket.",
        steps: [
          `Sketch two circles on the origin: ${f(D)} outside and ${f(d)} inside.`,
          "Extruded Boss/Base to the length you need, say 0.5.",
          "Chamfer both ends of the bore 0.02 so a screw starts easily.",
          "Try it a second way: sketch half the cross-section and use Revolved Boss/Base. Same part, different thinking.",
        ],
      }),
    },
    {
      id: "rail", name: "Hook rail", level: 0,
      sets: [{ W: 8, H: 1.5, e: 1 }, { W: 6, H: 1.25, e: 0.75 }, { W: 10, H: 2, e: 1 }],
      ask: [{ n: "p", what: "spacing from one hole to the next" }, { n: "y", what: "hole centers, down from the top edge" }],
      clues: [
        { t: "Three holes, evenly spaced. The end holes sit the same distance in from each end.", eqs: [E({ p: 2, e: 2, W: -1 })], sw: "Draw one hole and use Linear Sketch Pattern: 3 instances at the spacing. Change the count later and the rail updates." },
        { t: "All three are on the centerline.", eqs: [E({ y: 1, H: -0.5 })], sw: "A Horizontal relation from the first hole's center to the origin does it." },
      ],
      draw: ({ W, H, e, p, y }) => ({
        outline: rect(W, H), holes: [0, 1, 2].map((i) => ({ x: e + i * p, y, d: H * 0.25 })),
        dims: [
          { n: "e", t: "h", a: 0, b: e, side: "t", row: 1, eb: y }, { n: "p", t: "h", a: e, b: e + p, side: "t", row: 1, ea: y, eb: y },
          { n: "p", t: "h", a: e + p, b: e + 2 * p, side: "t", row: 1, ea: y, eb: y },
          { n: "W", t: "h", a: 0, b: W, side: "b", row: 1 },
          { n: "y", t: "v", a: 0, b: y, side: "l", row: 1, eb: e }, { n: "H", t: "v", a: 0, b: H, side: "r", row: 1 },
        ],
      }),
      how: ({ W, H, e, p, y }, f) => [
        `Take the two end distances off the length: ${f(W)} − 2 × ${f(e)} = ${f(W - 2 * e)}.`,
        `Three holes have two spaces between them: ${f(W - 2 * e)} ÷ 2 = ${f(p)}.`,
        `The centerline is half the height: ${f(H)} ÷ 2 = ${f(y)}.`,
      ],
      idea: ({ W, H, e, p }, f) => ({
        name: "Headset hook rail",
        what: "A strip with three evenly spaced holes for screw-in hooks. Headsets, cleco pliers, a flashlight.",
        steps: [
          `Sketch a Center Rectangle ${f(W)} × ${f(H)} and Extruded Boss/Base 0.25 thick.`,
          `New sketch on the face: one circle ${f(e)} in from the left end, on the centerline.`,
          `Extruded Cut, Through All, then Linear Pattern the cut: 3 instances, ${f(p)} apart.`,
          "Add a countersink to each hole with Hole Wizard if the hooks have flat heads.",
        ],
      }),
    },

    // ===== Journeyman =====
    {
      id: "hinge", name: "Hinge leaf", level: 1,
      sets: [{ W: 5, H: 2 }, { W: 2.5, H: 1 }, { W: 7.5, H: 3 }],
      ask: [{ n: "t", what: "width of one knuckle (and of one gap)" }, { n: "L", what: "how far a knuckle sticks up" }, { n: "b", what: "height of the leaf below the knuckles" }],
      clues: [
        { t: "Three knuckles and two gaps, and every one of them is the same width.", eqs: [E({ t: 5, W: -1 })], sw: "Draw one gap as a cut, then Linear Pattern it. Or select all five top edges and add an Equal relation." },
        { t: "A knuckle sticks up half as far as it is wide.", eqs: [E({ L: 1, t: -0.5 })], sw: "An equation on the knuckle height: = knuckle width / 2." },
        { t: "Knuckle and leaf together make the full height.", eqs: [E({ L: 1, b: 1, H: -1 })], sw: "Dimension the full height and the knuckle only. The rest is driven." },
      ],
      draw: ({ W, H, t, L, b }) => ({
        outline: [[0, 0], [t, 0], [t, L], [2 * t, L], [2 * t, 0], [3 * t, 0], [3 * t, L], [4 * t, L], [4 * t, 0], [W, 0], [W, H], [0, H]],
        dims: [
          { n: "t", t: "h", a: 0, b: t, side: "t", row: 1 }, { n: "t", t: "h", a: t, b: 2 * t, side: "t", row: 1 },
          { n: "W", t: "h", a: 0, b: W, side: "b", row: 1 }, { n: "H", t: "v", a: 0, b: H, side: "r", row: 1 },
          { n: "L", t: "v", a: 0, b: L, side: "l", row: 1, eb: t }, { n: "b", t: "v", a: L, b: L + b, side: "l", row: 1, ea: t },
        ],
      }),
      how: ({ W, H, t, L, b }, f) => [
        `Three knuckles and two gaps are five equal widths: ${f(W)} ÷ 5 = ${f(t)}.`,
        `Half as tall as wide: ${f(t)} ÷ 2 = ${f(L)}.`,
        `The leaf is the rest of the height: ${f(H)} − ${f(L)} = ${f(b)}.`,
      ],
      idea: ({ W, H, t, L }, f) => ({
        name: "Hinge leaf for a shop box",
        what: "One half of a simple hinge. Model it, then mirror the idea for the mating leaf (two knuckles, three gaps).",
        steps: [
          `Sketch a Corner Rectangle ${f(W)} × ${f(H)} and Extruded Boss/Base 0.09 thick.`,
          `Sketch one gap on the top edge: ${f(t)} wide, ${f(L)} deep, starting ${f(t)} in. Extruded Cut, Through All.`,
          `Linear Pattern the cut: 2 instances, ${f(2 * t)} apart.`,
          "Stretch goal: add screw holes with Hole Wizard, then make an Assembly of two leaves and a pin.",
        ],
      }),
    },
    {
      id: "panel", name: "Switch panel", level: 1,
      sets: [{ W: 4, H: 4, a: 1.5, b: 1 }, { W: 3, H: 2, a: 1, b: 0.5 }, { W: 5, H: 2.5, a: 2, b: 1 }],
      ask: [{ n: "m", what: "from the left edge to the cutout" }, { n: "n", what: "from the top edge down to the cutout" }, { n: "q", what: "from the cutout down to the bottom edge" }],
      clues: [
        { t: "The cutout is centered left to right.", eqs: [E({ m: 2, a: 1, W: -1 })], sw: "A vertical centerline through the origin, then a Symmetric relation on the cutout's two sides." },
        { t: "It sits high: there is twice as much plate below it as above it.", eqs: [E({ q: 1, n: -2 })], sw: "Dimension the top margin, then give the bottom margin an equation: = top margin * 2." },
        { t: "Above, cutout, below: together they make the full height.", eqs: [E({ n: 1, b: 1, q: 1, H: -1 })], sw: "Nothing to add. Once the sketch is fully defined the lines turn black." },
      ],
      draw: ({ W, H, a, b, m, n, q }) => ({
        outline: rect(W, H), cuts: [{ x: m + a / 2, y: n + b / 2, w: a, h: b, r: 0 }],
        dims: [
          { n: "m", t: "h", a: 0, b: m, side: "t", row: 1, eb: n }, { n: "a", t: "h", a: m, b: m + a, side: "t", row: 1, ea: n, eb: n },
          { n: "W", t: "h", a: 0, b: W, side: "b", row: 1 }, { n: "H", t: "v", a: 0, b: H, side: "l", row: 1 },
          { n: "n", t: "v", a: 0, b: n, side: "r", row: 1, eb: m + a }, { n: "b", t: "v", a: n, b: n + b, side: "r", row: 1, ea: m + a, eb: m + a },
          { n: "q", t: "v", a: n + b, b: H, side: "r", row: 1, ea: m + a },
        ],
      }),
      how: ({ W, H, a, b, m, n, q }, f) => [
        `Left to right, what is not cutout is split evenly: (${f(W)} − ${f(a)}) ÷ 2 = ${f(m)}.`,
        `Top to bottom, ${f(H)} − ${f(b)} = ${f(H - b)} of plate is left, in three shares: one above and two below.`,
        `Above: ${f(H - b)} ÷ 3 = ${f(n)}. Below: 2 × ${f(n)} = ${f(q)}.`,
      ],
      idea: ({ W, H, a, b, n }, f) => ({
        name: "Rocker-switch blank",
        what: "A small panel with a rectangular opening for a snap-in rocker switch, with room below for a label.",
        steps: [
          `Sketch a Center Rectangle ${f(W)} × ${f(H)} and Extruded Boss/Base 0.063 thick.`,
          `Sketch the ${f(a)} × ${f(b)} opening on the face, ${f(n)} down from the top, centered on a vertical centerline.`,
          "Extruded Cut, Through All.",
          "Add four corner mounting holes with a Linear Sketch Pattern, then measure a real switch and change the opening to suit.",
        ],
      }),
    },
    {
      id: "adjuster", name: "Slotted adjuster", level: 1,
      sets: [{ W: 5, H: 1.5, e: 0.5 }, { W: 3, H: 1, e: 0.5 }, { W: 7, H: 2, e: 0.5 }],
      ask: [{ n: "L", what: "length of the slot, end to end" }, { n: "w", what: "width of the slot" }, { n: "u", what: "from the top edge down to the slot" }],
      clues: [
        { t: "The slot stops the same distance short of each end.", eqs: [E({ L: 1, e: 2, W: -1 })], sw: "Draw it with the Straight Slot tool from the origin outward, so it is centered without a relation." },
        { t: "It is 8 times as long as it is wide.", eqs: [E({ L: 1, w: -8 })], sw: "An equation on the slot width: = slot length / 8." },
        { t: "It is centered top to bottom.", eqs: [E({ u: 2, w: 1, H: -1 })], sw: "The slot's centerline gets a Horizontal relation with the origin." },
      ],
      draw: ({ W, H, e, L, w, u }) => ({
        outline: rect(W, H), cuts: [{ x: W / 2, y: H / 2, w: L, h: w, r: w / 2 }],
        dims: [
          { n: "e", t: "h", a: 0, b: e, side: "t", row: 1, eb: H / 2 }, { n: "L", t: "h", a: e, b: e + L, side: "t", row: 1, ea: H / 2, eb: H / 2 },
          { n: "W", t: "h", a: 0, b: W, side: "b", row: 1 }, { n: "H", t: "v", a: 0, b: H, side: "l", row: 1 },
          { n: "u", t: "v", a: 0, b: u, side: "r", row: 1, eb: W / 2 }, { n: "w", t: "v", a: u, b: u + w, side: "r", row: 1, ea: W / 2, eb: W / 2 },
        ],
      }),
      how: ({ W, H, e, L, w, u }, f) => [
        `The slot is the length less both ends: ${f(W)} − 2 × ${f(e)} = ${f(L)}.`,
        `One eighth of that is its width: ${f(L)} ÷ 8 = ${f(w)}.`,
        `Above and below the slot share what is left of the height: (${f(H)} − ${f(w)}) ÷ 2 = ${f(u)}.`,
      ],
      idea: ({ W, H, L, w }, f) => ({
        name: "Sliding fence stop",
        what: "A plate with a long slot, so a bolt and wing nut can lock it anywhere along its travel. Handy on a drill-press fence.",
        steps: [
          `Sketch a Center Rectangle ${f(W)} × ${f(H)} and Extruded Boss/Base 0.25 thick.`,
          `On the face, use Straight Slot: ${f(L)} long overall and ${f(w)} wide, centered on the origin.`,
          "Extruded Cut, Through All.",
          "Fillet the plate's corners, then add a second body: a small stop block that bolts through the slot.",
        ],
      }),
    },
    {
      id: "tee", name: "T-plate", level: 1,
      sets: [{ W: 6, H: 5 }, { W: 3, H: 2 }, { W: 4.5, H: 4 }],
      ask: [{ n: "b", what: "width of the stem" }, { n: "a", what: "thickness of the bar across the top" }, { n: "c", what: "length of the stem below the bar" }],
      clues: [
        { t: "The stem is one third as wide as the bar is long.", eqs: [E({ b: 3, W: -1 })], sw: "An equation on the stem width: = bar length / 3." },
        { t: "The bar is as thick as the stem is wide.", eqs: [E({ a: 1, b: -1 })], sw: "Select the bar's end edge and the stem's bottom edge and add an Equal relation." },
        { t: "Bar and stem together make the full height.", eqs: [E({ a: 1, c: 1, H: -1 })], sw: "Dimension the full height. The stem length is then driven." },
      ],
      draw: ({ W, H, a, b, c }) => ({
        outline: [[0, 0], [W, 0], [W, a], [(W + b) / 2, a], [(W + b) / 2, H], [(W - b) / 2, H], [(W - b) / 2, a], [0, a]],
        dims: [
          { n: "W", t: "h", a: 0, b: W, side: "t", row: 1 }, { n: "b", t: "h", a: (W - b) / 2, b: (W + b) / 2, side: "b", row: 1 },
          { n: "a", t: "v", a: 0, b: a, side: "r", row: 1 }, { n: "c", t: "v", a, b: a + c, side: "r", row: 1, eb: (W + b) / 2 },
          { n: "H", t: "v", a: 0, b: H, side: "l", row: 1, eb: (W - b) / 2 },
        ],
      }),
      how: ({ W, H, a, b, c }, f) => [
        `A third of the bar's length: ${f(W)} ÷ 3 = ${f(b)}.`,
        `The bar is the same thickness: ${f(a)}.`,
        `The stem is the rest of the height: ${f(H)} − ${f(a)} = ${f(c)}.`,
      ],
      idea: ({ W, H, a, b }, f) => ({
        name: "T mending plate",
        what: "A T-shaped plate for joining a rail to an upright on a workbench or a shelf frame.",
        steps: [
          `Sketch the T outline: bar ${f(W)} × ${f(a)}, stem ${f(b)} wide, ${f(H)} tall overall.`,
          "Add a vertical centerline through the origin and make the stem's sides Symmetric about it.",
          "Extruded Boss/Base 0.125 thick.",
          "Add screw holes: one in each arm, two down the stem. Fillet the two inside corners 0.125 so it doesn't crack there.",
        ],
      }),
    },
    {
      id: "doubler", name: "Doubler plate", level: 1,
      sets: [{ S: 2, d: 0.25 }, { S: 1.5, d: 0.125 }, { S: 3, d: 0.375 }],
      ask: [{ n: "e", what: "hole center, in from the nearest edges" }, { n: "p", what: "spacing from hole to hole" }],
      clues: [
        { t: "The plate is square, with a hole near each corner.", eqs: [], sw: "Draw a Center Rectangle and add an Equal relation between two neighboring sides. Now one dimension sizes the square." },
        { t: "Each hole's center is two hole-diameters in from both of its edges.", eqs: [E({ e: 1, d: -2 })], sw: "An equation on the edge distance: = hole diameter * 2. Change the rivet size and the layout follows." },
        { t: "Edge distance, spacing, edge distance: together they make one side.", eqs: [E({ e: 2, p: 1, S: -1 })], sw: "Draw one hole and Linear Pattern it in two directions, 2 by 2." },
      ],
      draw: ({ S, d, e, p }) => ({
        outline: rect(S, S), holes: [[e, e], [e + p, e], [e, e + p], [e + p, e + p]].map(([x, y]) => ({ x, y, d })),
        dims: [
          { n: "e", t: "h", a: 0, b: e, side: "t", row: 1, eb: e }, { n: "p", t: "h", a: e, b: e + p, side: "t", row: 1, ea: e, eb: e },
          { n: "S", t: "h", a: 0, b: S, side: "b", row: 1 },
          { n: "e", t: "v", a: 0, b: e, side: "l", row: 1, eb: e }, { n: "p", t: "v", a: e, b: e + p, side: "l", row: 1, ea: e, eb: e },
          { n: "d", t: "d", x: e + p, y: e + p, d, ang: 225 },
        ],
      }),
      how: ({ S, d, e, p }, f) => [
        `Two hole-diameters: 2 × ${f(d)} = ${f(e)}.`,
        `Take an edge distance off each end of a side: ${f(S)} − 2 × ${f(e)} = ${f(p)}.`,
      ],
      idea: ({ S, d, e, p }, f) => ({
        name: "Practice doubler",
        what: "A small square doubler with four holes. Laying out holes from an edge-distance rule is everyday work on an RV.",
        steps: [
          `Sketch a Center Rectangle ${f(S)} square and Extruded Boss/Base 0.032 thick.`,
          `Sketch one ${f(d)} circle ${f(e)} in from two edges. Extruded Cut, Through All.`,
          `Linear Pattern the hole: 2 instances each way, ${f(p)} apart.`,
          "Open Tools, Equations and tie the edge distance to the hole size. Then change the hole and watch the plate redraw.",
        ],
      }),
    },
    {
      id: "channel", name: "U-channel", level: 1,
      sets: [{ W: 3, H: 2 }, { W: 1.5, H: 1 }, { W: 4.5, H: 2.25 }],
      ask: [{ n: "t", what: "thickness of a wall (the floor is the same)" }, { n: "i", what: "width of the opening" }, { n: "k", what: "depth of the opening" }],
      clues: [
        { t: "The opening is 4 times as wide as a wall is thick.", eqs: [E({ i: 1, t: -4 })], sw: "An equation on the opening: = wall thickness * 4." },
        { t: "The two walls and the floor are all the same thickness.", eqs: [E({ t: 2, i: 1, W: -1 }), E({ k: 1, t: 1, H: -1 })], sw: "Easier still: sketch only the outside U as three lines and extrude it as a Thin Feature. One thickness, typed once." },
      ],
      draw: ({ W, H, t, i, k }) => ({
        outline: [[0, 0], [t, 0], [t, k], [t + i, k], [t + i, 0], [W, 0], [W, H], [0, H]],
        dims: [
          { n: "t", t: "h", a: 0, b: t, side: "t", row: 1 }, { n: "i", t: "h", a: t, b: t + i, side: "t", row: 1 },
          { n: "W", t: "h", a: 0, b: W, side: "b", row: 1 },
          { n: "k", t: "v", a: 0, b: k, side: "l", row: 1, eb: t }, { n: "H", t: "v", a: 0, b: H, side: "r", row: 1 },
        ],
      }),
      how: ({ W, H, t, i, k }, f) => [
        "The opening is worth four walls, and there is a wall each side of it: six wall-thicknesses across.",
        `One wall: ${f(W)} ÷ 6 = ${f(t)}. The opening: 4 × ${f(t)} = ${f(i)}.`,
        `The floor is one wall thick, so the opening's depth is ${f(H)} − ${f(t)} = ${f(k)}.`,
      ],
      idea: ({ W, H, t }, f) => ({
        name: "Channel edge guard",
        what: "A length of U-channel to slip over the edge of a shelf or protect a panel edge in storage.",
        steps: [
          `Sketch three lines for the outside of the U: ${f(H)} down, ${f(W)} across, ${f(H)} up.`,
          `Extruded Boss/Base, 6 inches long. SolidWorks offers a Thin Feature because the sketch is open: set the thickness to ${f(t)}, inward.`,
          "Fillet the two inside corners.",
          "Compare: redraw it as a closed outline like the puzzle. Which way is easier to change later?",
        ],
      }),
    },

    // ===== Toolmaker =====
    {
      id: "shaft", name: "Stepped pin", level: 2,
      sets: [{ L: 6, D: 1.5, g: 0.75 }, { L: 3, D: 1, g: 0.5 }, { L: 9, D: 2, g: 1 }],
      ask: [{ n: "a", what: "length of the left end" }, { n: "b", what: "length of the middle section" }, { n: "c", what: "length of the right end" }],
      clues: [
        { t: "The middle section is as long as the two ends put together.", eqs: [E({ b: 1, a: -1, c: -1 }), E({ a: 1, b: 1, c: 1, L: -1 })], sw: "An equation on the middle section: = overall length / 2." },
        { t: "The left end is twice as long as the right end.", eqs: [E({ a: 1, c: -2 })], sw: "An equation on the left end: = right end * 2." },
      ],
      draw: ({ L, D, g, a, b, c }) => {
        const y0 = (D - g) / 2, y1 = (D + g) / 2;
        return {
          outline: [[0, y0], [a, y0], [a, 0], [a + b, 0], [a + b, y0], [L, y0], [L, y1], [a + b, y1], [a + b, D], [a, D], [a, y1], [0, y1]],
          center: [[-0.04 * L, D / 2], [1.04 * L, D / 2]],
          dims: [
            { n: "a", t: "h", a: 0, b: a, side: "t", row: 1, ea: y0 }, { n: "b", t: "h", a, b: a + b, side: "t", row: 1 },
            { n: "c", t: "h", a: a + b, b: a + b + c, side: "t", row: 1, eb: y0 },
            { n: "L", t: "h", a: 0, b: L, side: "b", row: 1, ea: y1, eb: y1 },
            { n: "g", t: "v", a: y0, b: y1, side: "l", row: 1, dia: true }, { n: "D", t: "v", a: 0, b: D, side: "r", row: 1, ea: a + b, eb: a + b, dia: true },
          ],
        };
      },
      how: ({ L, a, b, c }, f) => [
        `If the middle equals the two ends together, the middle is half of everything: ${f(L)} ÷ 2 = ${f(b)}.`,
        `The two ends share the other ${f(L - b)}, in three shares: two for the left, one for the right.`,
        `Right end: ${f(L - b)} ÷ 3 = ${f(c)}. Left end: 2 × ${f(c)} = ${f(a)}.`,
      ],
      idea: ({ L, D, g, a, b }, f) => ({
        name: "Stepped locating pin",
        what: "A round pin with a fat middle. Round parts are a different way of thinking: you draw half the outline and spin it.",
        steps: [
          "Sketch on the Front Plane: a horizontal centerline through the origin.",
          `Above it, draw half the outline: ${f(L)} long, ${f(g / 2)} high at the ends and ${f(D / 2)} high for the ${f(b)} middle section, starting ${f(a)} from the left.`,
          "Revolved Boss/Base, 360 degrees, about the centerline.",
          "Chamfer both ends 0.03. Dimension tip: click the centerline, then move the cursor across it, and SolidWorks gives a diameter.",
        ],
      }),
    },
    {
      id: "windows", name: "Fuse panel", level: 2,
      sets: [{ W: 6, H: 2, c: 1 }, { W: 4.5, H: 1.5, c: 0.75 }, { W: 9, H: 4, c: 1.5 }],
      ask: [{ n: "g", what: "gap between two windows" }, { n: "m", what: "margin from an end to the first window" }, { n: "n", what: "from the top edge down to the windows" }],
      clues: [
        { t: (v, f) => `Three square windows, ${f(v.c)} on a side, with equal gaps between them and equal margins at the two ends.`, eqs: [E({ m: 2, g: 2, c: 3, W: -1 })], sw: "Cut one window, then Linear Pattern it: 3 instances, spaced one window plus one gap." },
        { t: "Each end margin is twice as wide as a gap.", eqs: [E({ m: 1, g: -2 })], sw: "An equation on the margin: = gap * 2." },
        { t: "The row of windows is centered top to bottom.", eqs: [E({ n: 2, c: 1, H: -1 })], sw: "A horizontal centerline through the origin, and the window made Symmetric about it." },
      ],
      draw: ({ W, H, c, g, m, n }) => ({
        outline: rect(W, H), cuts: [0, 1, 2].map((i) => ({ x: m + c / 2 + i * (c + g), y: n + c / 2, w: c, h: c, r: 0 })),
        dims: [
          { n: "m", t: "h", a: 0, b: m, side: "t", row: 1, eb: n }, { n: "c", t: "h", a: m, b: m + c, side: "t", row: 1, ea: n, eb: n },
          { n: "g", t: "h", a: m + c, b: m + c + g, side: "t", row: 1, ea: n, eb: n },
          { n: "W", t: "h", a: 0, b: W, side: "b", row: 1 }, { n: "H", t: "v", a: 0, b: H, side: "l", row: 1 },
          { n: "n", t: "v", a: 0, b: n, side: "r", row: 1, eb: W - m },
        ],
      }),
      how: ({ W, H, c, g, m, n }, f) => [
        `The three windows take 3 × ${f(c)} = ${f(3 * c)}, leaving ${f(W)} − ${f(3 * c)} = ${f(W - 3 * c)} for gaps and margins.`,
        "Each margin is worth two gaps, so two margins and two gaps are six gap-widths.",
        `A gap: ${f(W - 3 * c)} ÷ 6 = ${f(g)}. A margin: 2 × ${f(g)} = ${f(m)}.`,
        `Top to bottom: (${f(H)} − ${f(c)}) ÷ 2 = ${f(n)}.`,
      ],
      idea: ({ W, H, c, g, m, n }, f) => ({
        name: "Three-switch row panel",
        what: "A panel with a row of three square openings, for switches, indicator lights or panel-mount fuse holders.",
        steps: [
          `Sketch a Corner Rectangle ${f(W)} × ${f(H)} and Extruded Boss/Base 0.063 thick.`,
          `Sketch one ${f(c)} square, ${f(m)} in from the left and ${f(n)} down. Extruded Cut, Through All.`,
          `Linear Pattern the cut: 3 instances, ${f(c + g)} apart (a window plus a gap).`,
          "Now change the pattern to 4 and see what breaks. Fixing it with equations is the real lesson.",
        ],
      }),
    },
    {
      id: "twoholes", name: "Big hole, little hole", level: 2,
      sets: [{ W: 4, H: 2, s: 1.25, f: 0.25 }, { W: 3, H: 1.5, s: 0.75, f: 0.25 }, { W: 5, H: 2.5, s: 1.5, f: 0.5 }],
      ask: [{ n: "D", what: "diameter of the big hole" }, { n: "d", what: "diameter of the small hole" }, { n: "c", what: "hole to hole, center to center" }],
      clues: [
        { t: (v, f) => `The big hole is ${f(v.f)} bigger across than the small one.`, eqs: [E({ D: 1, d: -1, f: -1 })], sw: "An equation on the big hole: = small hole + the difference." },
        { t: (v, f) => `Laid side by side, the two diameters add up to ${f(v.s)}.`, eqs: [E({ D: 1, d: 1, s: -1 })], sw: "SolidWorks solves this pair for you only if you write both as equations. Working it by hand first is quicker." },
        { t: "The metal left between the holes is as wide as the small hole.", eqs: [E({ c: 1, D: -0.5, d: -1.5 })], sw: "Dimension the gap itself: hold Shift and click the two circles' edges, not their centers." },
      ],
      draw: ({ W, H, D, d, c }) => {
        const x1 = (W - c - (d - D) / 2) / 2;
        return {
          outline: rect(W, H), holes: [{ x: x1, y: H / 2, d: D }, { x: x1 + c, y: H / 2, d }],
          dims: [
            { n: "c", t: "h", a: x1, b: x1 + c, side: "t", row: 1, ea: H / 2, eb: H / 2 }, { n: "W", t: "h", a: 0, b: W, side: "b", row: 1 },
            { n: "H", t: "v", a: 0, b: H, side: "r", row: 1 },
            { n: "D", t: "d", x: x1, y: H / 2, d: D, ang: 130 }, { n: "d", t: "d", x: x1 + c, y: H / 2, d, ang: 50 },
          ],
        };
      },
      how: ({ s, f: diff, D, d, c }, f) => [
        `Take the extra ${f(diff)} off the total and two equal holes are left: ${f(s)} − ${f(diff)} = ${f(s - diff)}, so the small hole is ${f(s - diff)} ÷ 2 = ${f(d)}.`,
        `The big hole: ${f(d)} + ${f(diff)} = ${f(D)}.`,
        `Center to center is half the big hole, the gap, and half the small hole: ${f(D / 2)} + ${f(d)} + ${f(d / 2)} = ${f(c)}.`,
      ],
      idea: ({ W, H, D, d, c }, f) => ({
        name: "Two-size hanger plate",
        what: "A plate with a big hole and a small one, for hanging two different tools, or as a go/no-go gauge for two rod sizes.",
        steps: [
          `Sketch a Center Rectangle ${f(W)} × ${f(H)} and Extruded Boss/Base 0.125 thick.`,
          `Sketch a ${f(D)} circle and a ${f(d)} circle on the horizontal centerline, ${f(c)} apart.`,
          "Extruded Cut, Through All.",
          "Join the two holes with a narrow slot and you have a keyhole: slide the tool in at the big end, hang it at the small end.",
        ],
      }),
    },
    {
      id: "gable", name: "Birdhouse front", level: 2,
      sets: [{ W: 4, H: 4.5 }, { W: 3, H: 3 }, { W: 5, H: 6 }],
      ask: [{ n: "r", what: "rise of the roof, eaves to peak" }, { n: "h", what: "height of the walls, base to eaves" }, { n: "u", what: "hole center, up from the base" }],
      clues: [
        { t: "The roof rises half as much as the walls are tall.", eqs: [E({ r: 1, h: -0.5 }), E({ r: 1, h: 1, H: -1 })], sw: "An equation on the roof rise: = wall height / 2." },
        { t: "The hole is halfway up the wall, under the peak.", eqs: [E({ u: 1, h: -0.5 })], sw: "A Midpoint relation between the hole's center and a construction line drawn up the middle of the wall." },
      ],
      draw: ({ W, H, r, h, u }) => ({
        outline: [[0, r], [W / 2, 0], [W, r], [W, H], [0, H]], holes: [{ x: W / 2, y: H - u, d: W * 0.3 }],
        dims: [
          { n: "W", t: "h", a: 0, b: W, side: "b", row: 1 },
          { n: "r", t: "v", a: 0, b: r, side: "l", row: 1, ea: W / 2 }, { n: "h", t: "v", a: r, b: r + h, side: "l", row: 1 },
          { n: "u", t: "v", a: H - u, b: H, side: "r", row: 1, ea: W / 2 }, { n: "H", t: "v", a: 0, b: H, side: "r", row: 2, ea: W / 2 },
        ],
      }),
      how: ({ H, r, h, u }, f) => [
        "The roof is half a wall, so the full height is one and a half walls: three half-walls.",
        `One half-wall is the roof rise: ${f(H)} ÷ 3 = ${f(r)}. The walls: 2 × ${f(r)} = ${f(h)}.`,
        `Halfway up the wall: ${f(h)} ÷ 2 = ${f(u)}.`,
      ],
      idea: ({ W, H, r, u }, f) => ({
        name: "Birdhouse front",
        what: "The front panel of a small birdhouse: a peaked plate with an entry hole. A first step toward a whole assembly.",
        steps: [
          `Sketch the five-sided outline: ${f(W)} wide, ${f(H)} to the peak, the roof starting ${f(r)} below the peak.`,
          "Make the two roof lines Equal, and the peak sits in the middle on its own.",
          `Add the entry hole ${f(u)} up from the base. Extruded Boss/Base 0.5 thick.`,
          "Stretch goal: model the sides, floor and roof as separate parts and mate them in an Assembly.",
        ],
      }),
    },
    {
      id: "zee", name: "Z-bracket", level: 2,
      sets: [{ W: 3.5, H: 2, t: 0.5 }, { W: 2.75, H: 1.5, t: 0.25 }, { W: 4.25, H: 3, t: 0.75 }],
      ask: [{ n: "f", what: "length of a flange, including the web" }, { n: "s", what: "how far the top flange sticks out past the web" }, { n: "g", what: "from the top down to the bottom flange" }],
      clues: [
        { t: "Both flanges are the same length, measured to the far side of the web.", eqs: [E({ f: 2, t: -1, W: -1 })], sw: "Select the top and bottom edges and add an Equal relation." },
        { t: "The web and both flanges are all the same thickness.", eqs: [E({ s: 1, t: 1, f: -1 }), E({ g: 1, t: 1, H: -1 })], sw: "Sketch a three-line Z and extrude it as a Thin Feature, or use Sheet Metal's Base Flange so it can be flattened." },
      ],
      draw: ({ W, H, t, f, s, g }) => ({
        outline: [[0, 0], [f, 0], [f, g], [W, g], [W, H], [s, H], [s, t], [0, t]],
        dims: [
          { n: "s", t: "h", a: 0, b: s, side: "t", row: 1, eb: t }, { n: "f", t: "h", a: 0, b: f, side: "t", row: 2 },
          { n: "W", t: "h", a: 0, b: W, side: "b", row: 1, ea: t },
          { n: "t", t: "v", a: 0, b: t, side: "l", row: 1 },
          { n: "g", t: "v", a: 0, b: g, side: "r", row: 1, ea: f }, { n: "H", t: "v", a: 0, b: H, side: "r", row: 2, ea: f },
        ],
      }),
      how: ({ W, H, t, f: fl, s, g }, f) => [
        `Lay the two flanges end to end and they overlap by the web's thickness: flange + flange − ${f(t)} = ${f(W)}.`,
        `So two flanges are ${f(W)} + ${f(t)} = ${f(W + t)}, and one is ${f(fl)}.`,
        `Past the web, the flange sticks out ${f(fl)} − ${f(t)} = ${f(s)}.`,
        `The bottom flange is ${f(t)} thick, so its top is ${f(H)} − ${f(t)} = ${f(g)} down.`,
      ],
      idea: ({ W, H, t, f: fl }, f) => ({
        name: "Z-clip offset bracket",
        what: "A Z-shaped clip that holds a panel or a picture rail off the wall. Also the cross-section of many aircraft stiffeners.",
        steps: [
          `Sketch three lines in a Z: ${f(fl)} across, ${f(H)} down, ${f(fl)} across the other way. Overall width ${f(W)}.`,
          `Sheet Metal, Base Flange/Tab: thickness 0.063, 2 inches deep. (The puzzle's chunky ${f(t)} suits a machined block instead.)`,
          "Click Flatten to see the flat pattern you would cut before bending.",
          "Add a mounting hole in each flange on the flat pattern, then unflatten.",
        ],
      }),
    },
    {
      id: "plus", name: "Cross knob", level: 2,
      sets: [{ S: 5 }, { S: 2.5 }, { S: 3.75 }],
      ask: [{ n: "a", what: "width of an arm" }, { n: "b", what: "how far an arm sticks out from the hub" }, { n: "d", what: "diameter of the center hole" }],
      clues: [
        { t: "All four arms are alike, and each sticks out twice as far as it is wide.", eqs: [E({ b: 1, a: -2 }), E({ b: 2, a: 1, S: -1 })], sw: "Draw one arm and use Circular Sketch Pattern: 4 instances around the origin." },
        { t: "The center hole is half as wide as an arm.", eqs: [E({ d: 1, a: -0.5 })], sw: "An equation on the hole: = arm width / 2." },
      ],
      draw: ({ S, a, b, d }) => ({
        outline: [[b, 0], [b + a, 0], [b + a, b], [S, b], [S, b + a], [b + a, b + a], [b + a, S], [b, S], [b, b + a], [0, b + a], [0, b], [b, b]],
        holes: [{ x: S / 2, y: S / 2, d }],
        dims: [
          { n: "b", t: "h", a: 0, b, side: "t", row: 1, ea: b }, { n: "a", t: "h", a: b, b: b + a, side: "t", row: 1 },
          { n: "S", t: "h", a: 0, b: S, side: "b", row: 1, ea: b + a, eb: b + a },
          { n: "S", t: "v", a: 0, b: S, side: "r", row: 1, ea: b + a, eb: b + a },
          { n: "d", t: "d", x: S / 2, y: S / 2, d, ang: 135, len: 1.1 * b },
        ],
      }),
      how: ({ S, a, b, d }, f) => [
        "Straight across: an arm, the hub, an arm. Each arm is two widths long and the hub is one width, so that is five widths.",
        `Arm width: ${f(S)} ÷ 5 = ${f(a)}. Stick-out: 2 × ${f(a)} = ${f(b)}.`,
        `The hole is half an arm: ${f(a)} ÷ 2 = ${f(d)}.`,
      ],
      idea: ({ S, a, d }, f) => ({
        name: "Four-arm clamp knob",
        what: "A cross-shaped knob you can grip with cold or oily hands. Press a bolt into it and it replaces a wing nut on a jig.",
        steps: [
          `Sketch two Center Rectangles on the origin, one ${f(S)} × ${f(a)} and one ${f(a)} × ${f(S)}, and trim the middle with Trim Entities.`,
          `Add the ${f(d)} center hole. Extruded Boss/Base 0.5 thick.`,
          `Fillet the four arm ends with a full ${f(a / 2)} radius and the inside corners 0.125.`,
          "On the back, sketch a hexagon with the Polygon tool and cut it 0.2 deep to trap a bolt head.",
        ],
      }),
    },
  ];

  const byId = (id) => PUZZLES.find((p) => p.id === id) || null;
  const eqsOf = (p) => p.clues.reduce((all, c) => all.concat(c.eqs), []);
  // Every value of a puzzle for one of its number sets, or null if it cannot be solved.
  function values(p, setIndex) {
    const r = solve(p.sets[((setIndex % p.sets.length) + p.sets.length) % p.sets.length], eqsOf(p));
    return r.ok ? r.v : null;
  }
  const letter = (p, name) => { const i = p.ask.findIndex((q) => q.n === name); return i < 0 ? "" : "ABC"[i]; };
  const clueText = (c, v) => (typeof c.t === "function" ? c.t(v, fmt) : c.t);
  // The puzzle to offer next: the first unsolved one after `afterId`, going round once.
  function nextId(done, afterId) {
    const start = Math.max(0, PUZZLES.findIndex((p) => p.id === afterId) + 1);
    for (let i = 0; i < PUZZLES.length; i++) { const p = PUZZLES[(start + i) % PUZZLES.length]; if (!done[p.id]) return p.id; }
    return PUZZLES[start % PUZZLES.length].id;
  }

  const API = { LEVELS, PUZZLES, E, fmt, parse, isRight, stars, solve, byId, eqsOf, values, letter, clueText, nextId };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.FTP = API;
})(this);
