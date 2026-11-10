// Gate Time Puzzles: puzzle makers, grading and levels. No screen code here, so it can be tested with Node.
// Every puzzle is made on the phone from a recipe, so there is an endless supply and no signal is needed.
(function (root) {
  "use strict";

  // ---------- random numbers (seedable so tests repeat) ----------
  function makeRng(seed) {
    let s = (seed === undefined ? Math.floor(Math.random() * 4294967296) : seed) >>> 0;
    const next = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      ri: (a, b) => a + Math.floor(next() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
      shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
      },
    };
  }

  // ---------- formatting ----------
  const num = (n, dp = 0) => {
    const v = Math.abs(n) < 1e-9 ? 0 : Number(n);
    return v.toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: 0 });
  };
  const fixed = (n, dp) => Number(n).toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: dp });
  const wrap360 = (h) => ((Math.round(h) % 360) + 360) % 360;
  const hdg = (h) => { const x = wrap360(h); return String(x === 0 ? 360 : x).padStart(3, "0"); };
  const rwyNum = (n) => ((((n - 1) % 36) + 36) % 36) + 1;
  const rwy = (n) => String(rwyNum(n)).padStart(2, "0");
  const dur = (min) => {
    const m = Math.round(min);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  };
  const hhmm = (totalMin) => {
    const m = ((Math.round(totalMin) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, "0") + String(m % 60).padStart(2, "0");
  };
  const secs = (s) => {
    s = Math.round(s);
    if (s < 60) return `${s} s`;
    return `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`;
  };
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  // 11/16, 1 3/16, 2
  function fracStr(n, d) {
    const g = gcd(n, d); n /= g; d /= g;
    if (d === 1) return String(n);
    const w = Math.floor(n / d), r = n % d;
    return w ? `${w} ${r}/${d}` : `${r}/${d}`;
  }
  const dec = (v) => String(+Number(v).toFixed(6));
  const sinD = (a) => Math.sin((a * Math.PI) / 180);
  const cosD = (a) => Math.cos((a * Math.PI) / 180);
  const r5 = (m) => Math.round(m / 5) * 5;

  // ---------- categories ----------
  const CATS = {
    math: { label: "Math", icon: "🧮", blurb: "Mental math, percents, fractions, units, patterns and spreadsheet cells" },
    nav: { label: "Navigation", icon: "🧭", blurb: "Headings, runways, wind, time-speed-distance, fuel, Zulu time" },
    mech: { label: "Mechanics", icon: "⚙️", blurb: "Gears, levers, pulleys, torque, CG, hydraulics, electrics, hardware" },
  };

  // Each recipe: { id, cat, min (lowest level it appears), gen(level, rng) }
  // gen returns { text, big?, mono? (lines), answer, pool (wrong-answer candidates), how }
  const G = [];
  const add = (cat, id, min, gen) => G.push({ cat, id, min, gen });

  // =====================================================================
  // MATH
  // =====================================================================
  add("math", "arith", 1, (L, R) => {
    let a, b, ans, big, how, pool;
    if (L <= 2) {
      a = R.ri(14, 89); b = R.ri(12, 79);
      const tens = b - (b % 10), ones = b % 10;
      if (R.chance(0.5)) {
        ans = a + b; big = `${a} + ${b}`;
        how = `Add the tens, then the ones: ${a} + ${tens} = ${a + tens}, then + ${ones} = ${ans}.`;
      } else {
        if (a < b) [a, b] = [b, a];
        if (a === b) a += 7;
        const t2 = b - (b % 10), o2 = b % 10;
        ans = a - b; big = `${a} − ${b}`;
        how = `Take away the tens, then the ones: ${a} − ${t2} = ${a - t2}, then − ${o2} = ${ans}.`;
      }
      pool = [ans + 10, ans - 10, ans + 1, ans - 1, ans + 2, ans - 2];
    } else if (L <= 4) {
      a = R.ri(13, 98); b = R.ri(3, 9); ans = a * b; big = `${a} × ${b}`;
      const t = a - (a % 10), o = a % 10;
      how = `Split ${a} into ${t} + ${o}: ${t} × ${b} = ${t * b}, ${o} × ${b} = ${o * b}; ${t * b} + ${o * b} = ${num(ans)}.`;
      pool = [ans + b, ans - b, ans + 10, ans - 10, ans + 2, ans - 2];
    } else if (L <= 6) {
      a = R.ri(13, 49); b = R.ri(11, 29); ans = a * b; big = `${a} × ${b}`;
      const t = b - (b % 10), o = b % 10;
      how = `Split ${b} into ${t} + ${o}: ${a} × ${t} = ${num(a * t)}, ${a} × ${o} = ${a * o}; total ${num(ans)}.`;
      pool = [ans + 10, ans - 10, ans + a, ans - a, ans + 100, ans - 100];
    } else if (R.chance(0.5)) {
      ans = R.ri(13, 99); b = R.ri(6, 19); a = ans * b; big = `${num(a)} ÷ ${b}`;
      how = `Check it backwards: ${b} × ${ans} = ${num(a)}.`;
      pool = [ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10];
    } else {
      a = R.ri(102, 399); b = R.ri(12, 39); ans = a * b; big = `${a} × ${b}`;
      const t = b - (b % 10), o = b % 10;
      how = `Split ${b} into ${t} + ${o}: ${a} × ${t} = ${num(a * t)}, ${a} × ${o} = ${num(a * o)}; total ${num(ans)}.`;
      pool = [ans + 10, ans - 10, ans + a, ans - a, ans + 100, ans - 100, ans + 1000];
    }
    return { text: "Work it out:", big, answer: num(ans), pool: pool.filter((v) => v >= 0).map((v) => num(v)), how };
  });

  add("math", "pct", 1, (L, R) => {
    if (L <= 3) {
      const p = R.pick([10, 20, 25, 50, 5]);
      const y = R.ri(2, 30) * 20, ans = (y * p) / 100;
      const how = {
        10: `10% is one-tenth: ${num(y)} ÷ 10 = ${num(ans)}.`,
        5: `10% is ${num(y / 10)}; 5% is half of that: ${num(ans)}.`,
        20: `10% is ${num(y / 10)}; double it: ${num(ans)}.`,
        25: `25% is a quarter: ${num(y)} ÷ 4 = ${num(ans)}.`,
        50: `50% is half: ${num(y)} ÷ 2 = ${num(ans)}.`,
      }[p];
      const pool = [ans * 2, ans / 2, ans + y / 10, ans - y / 10, (y * p) / 10, ans + 5].filter((v) => v > 0);
      return { text: `What is ${p}% of ${num(y)}?`, answer: num(ans, 2), pool: pool.map((v) => num(v, 2)), how };
    }
    if (L <= 6) {
      const p = R.pick([15, 12.5, 35, 75, 40, 8, 2.5]);
      const y = R.ri(2, 25) * 40, ans = (y * p) / 100;
      let how = `1% of ${num(y)} is ${num(y / 100, 2)}; × ${p} = ${num(ans, 2)}.`;
      if (p === 15) how = `10% is ${num(y / 10, 2)}, 5% is ${num(y / 20, 2)}; together ${num(ans, 2)}.`;
      if (p === 12.5) how = `12.5% is one-eighth: ${num(y)} ÷ 8 = ${num(ans, 2)}.`;
      if (p === 75) how = `75% is three-quarters: ${num(y)} ÷ 4 = ${num(y / 4, 2)}, × 3 = ${num(ans, 2)}.`;
      if (p === 2.5) how = `10% is ${num(y / 10, 2)}; 2.5% is a quarter of that: ${num(ans, 2)}.`;
      const pool = [ans + y / 20, ans - y / 20, ans * 2, ans / 2, ans + y / 100, (y * p) / 10].filter((v) => v > 0);
      return { text: `What is ${p}% of ${num(y)}?`, answer: num(ans, 2), pool: pool.map((v) => num(v, 2)), how };
    }
    const p = R.pick([10, 20, 25, 40]);
    const x = R.ri(3, 30) * 20, sale = (x * (100 - p)) / 100;
    const money = (v) => "$" + num(v, 2);
    return {
      text: `After a ${p}% discount, a headset costs ${money(sale)}. What was the original price?`,
      answer: money(x),
      pool: [sale * (1 + p / 100), x + 10, x - 20, x + 20, sale + p].map(money),
      how: `The sale price is ${100 - p}% of the original, so ${money(sale)} ÷ ${(100 - p) / 100} = ${money(x)}. (Adding ${p}% back gives ${money(sale * (1 + p / 100))} — the common trap.)`,
    };
  });

  add("math", "units", 1, (L, R) => {
    const kinds = [
      { min: 1, f() {
        const g = R.ri(8, 60), ans = g * 6;
        return { text: `About how much does ${g} gal of 100LL avgas weigh?`, answer: `${num(ans)} lb`,
          pool: [g * 6.7, g * 8.3, g * 7, g * 5, ans + 12].map((v) => `${num(Math.round(v))} lb`),
          how: `Avgas is about 6 lb per gallon: ${g} × 6 = ${num(ans)} lb. (Jet A is about 6.7 lb, water 8.3 lb.)` };
      } },
      { min: 2, f() {
        const k = R.ri(6, 25) * 10, ans = Math.round(k * 1.15078);
        return { text: `${k} knots is about how many miles per hour?`, answer: `${ans} mph`,
          pool: [k * 1.852, k / 1.15078, ans + 10, ans - 10, k + 10].map((v) => `${Math.round(v)} mph`),
          how: `1 knot ≈ 1.15 mph: ${k} × 1.15 ≈ ${ans} mph. (× 1.85 would be km/h.)` };
      } },
      { min: 3, f() {
        const c = R.ri(-4, 8) * 5, f = (c * 9) / 5 + 32;
        return { text: `The ATIS temperature is ${c} °C. What is that in °F?`, answer: `${num(f)} °F`,
          pool: [((c - 32) * 5) / 9, (c * 9) / 5, f + 9, f - 9, f + 18].map((v) => `${num(Math.round(v))} °F`),
          how: `°F = °C × 9/5 + 32: ${c} × 1.8 = ${num((c * 9) / 5)}, + 32 = ${num(f)} °F.` };
      } },
      { min: 3, f() {
        const g = R.ri(6, 40), lb = g * 6;
        return { text: `The fuel totalizer shows ${num(lb)} lb of 100LL. About how many gallons is that?`, answer: `${g} gal`,
          pool: [lb / 6.7, lb / 8.3, g + 6, g - 4, lb / 5].map((v) => `${Math.round(v)} gal`),
          how: `Avgas is about 6 lb per gallon: ${num(lb)} ÷ 6 = ${g} gal.` };
      } },
      { min: 4, f() {
        const l = R.ri(4, 40) * 5, ans = l / 3.78541;
        return { text: `A ${l}-liter fuel can holds about how many US gallons?`, answer: `${fixed(ans, 1)} gal`,
          pool: [l / 4.54609, ans + 2, ans - 2, l / 2, ans * 1.5].filter((v) => v > 0).map((v) => `${fixed(v, 1)} gal`),
          how: `1 US gallon ≈ 3.785 liters: ${l} ÷ 3.785 ≈ ${fixed(ans, 1)} gal. (÷ 4.546 would be imperial gallons.)` };
      } },
      { min: 5, f() {
        const a = 29.5 + R.ri(0, 90) / 100, ans = Math.round(a * 33.8639);
        return { text: `Altimeter ${a.toFixed(2)} inHg is about how many hectopascals (hPa)?`, answer: `${num(ans)} hPa`,
          pool: [ans + 10, ans - 10, ans + 20, ans - 20, Math.round(a * 25.4)].map((v) => `${num(v)} hPa`),
          how: `29.92 inHg = 1013 hPa, and each 0.01 inHg ≈ 0.34 hPa: ${a.toFixed(2)} × 33.86 ≈ ${num(ans)} hPa.` };
      } },
    ].filter((k) => k.min <= L);
    return R.pick(kinds).f();
  });

  add("math", "frac", 2, (L, R) => {
    if (L < 5) {
      const d = L <= 3 ? R.pick([8, 16]) : R.pick([16, 32]);
      let n = R.ri(1, d - 1); if (n % 2 === 0) n += 1;
      const v = n / d;
      const pool = [(n + 2) / d, (n - 2) / d, n / (d * 2), n / (d / 2), v + 0.1, +("0." + String(n) + String(d))].filter((x) => x > 0 && x < 1.5);
      return { text: `What is ${n}/${d} as a decimal?`, answer: dec(v), pool: pool.map(dec),
        how: `1/${d} = ${dec(1 / d)}, so ${n}/${d} = ${n} × ${dec(1 / d)} = ${dec(v)}.` };
    }
    const dens = L >= 7 ? [4, 8, 16, 32, 64] : [4, 8, 16, 32];
    const da = R.pick(dens); let db = R.pick(dens); if (db === da) db = da === 4 ? 16 : da / 2;
    const odd = (d) => { let n = R.ri(1, d - 1); if (n % 2 === 0) n -= 1; return Math.max(1, n); };
    const a = odd(da), b = odd(db), lcd = Math.max(da, db);
    const an = a * (lcd / da), bn = b * (lcd / db), s = an + bn;
    return {
      text: "Add the fractions:", big: `${a}/${da} + ${b}/${db}`, answer: fracStr(s, lcd),
      pool: [fracStr(a + b, da + db), fracStr(s + 1, lcd), fracStr(s - 1, lcd), fracStr(s, lcd * 2), fracStr(s + 2, lcd)],
      how: `Put both in ${lcd}ths: ${a}/${da} = ${an}/${lcd} and ${b}/${db} = ${bn}/${lcd}. ${an} + ${bn} = ${s}/${lcd} = ${fracStr(s, lcd)}.`,
    };
  });

  add("math", "seq", 1, (L, R) => {
    let terms, ans, how, pool;
    if (L <= 2) {
      const a = R.ri(1, 30), d = R.ri(2, 12);
      terms = [0, 1, 2, 3].map((i) => a + i * d); ans = a + 4 * d;
      how = `Each step adds ${d}: ${terms[3]} + ${d} = ${ans}.`;
      pool = [ans + 1, ans - 1, ans + d, ans - 2, ans + 2];
    } else if (L <= 4) {
      const a = R.ri(1, 6), r = R.pick([2, 3]);
      terms = [0, 1, 2, 3].map((i) => a * r ** i); ans = a * r ** 4;
      how = `Each number is ${r} times the one before: ${terms[3]} × ${r} = ${ans}.`;
      pool = [terms[3] + (terms[3] - terms[2]), ans + r, ans - r, ans * 2, ans + 1];
    } else if (L <= 6) {
      if (R.chance(0.5)) {
        const a = R.ri(1, 20), d0 = R.ri(1, 5), inc = R.ri(1, 3);
        terms = [a]; for (let i = 0; i < 3; i++) terms.push(terms[i] + d0 + i * inc);
        ans = terms[3] + d0 + 3 * inc;
        how = `The gaps grow by ${inc}: +${d0}, +${d0 + inc}, +${d0 + 2 * inc}, so next is +${d0 + 3 * inc} = ${ans}.`;
        pool = [terms[3] + d0 + 2 * inc, ans + 1, ans - 1, ans + inc, ans + 2 * inc];
      } else {
        const n0 = R.ri(2, 8), k = R.ri(-3, 5);
        terms = [0, 1, 2, 3].map((i) => (n0 + i) ** 2 + k); ans = (n0 + 4) ** 2 + k;
        how = `They're squares ${k >= 0 ? "plus " + k : "minus " + -k}: ${n0}², ${n0 + 1}², … so next is ${n0 + 4}² ${k >= 0 ? "+ " + k : "− " + -k} = ${ans}.`;
        pool = [ans + 1, ans - 1, ans + 2, terms[3] + (terms[3] - terms[2]), ans + 3];
      }
    } else if (R.chance(0.5)) {
      const x = R.ri(1, 9), y = R.ri(1, 9);
      terms = [x, y]; while (terms.length < 5) terms.push(terms[terms.length - 1] + terms[terms.length - 2]);
      ans = terms[3] + terms[4];
      how = `Each number is the sum of the two before it: ${terms[3]} + ${terms[4]} = ${ans}.`;
      pool = [ans + 1, ans - 1, terms[4] + (terms[4] - terms[3]), ans + 2, terms[4] * 2];
    } else {
      const a = R.ri(1, 6), k = R.ri(1, 5);
      terms = [a, 2 * a, 2 * a + k, 2 * (2 * a + k), 2 * (2 * a + k) + k];
      ans = terms[4] * 2;
      how = `The steps alternate: × 2, + ${k}, × 2, + ${k}… The next step is × 2: ${terms[4]} × 2 = ${ans}.`;
      pool = [terms[4] + k, ans + k, ans - 1, ans + 2, ans + 1];
    }
    return { text: "What comes next?", big: terms.join(", ") + ", ?", answer: num(ans), pool: pool.map((v) => num(v)), how };
  });

  add("math", "sheet", 3, (L, R) => {
    const kinds = [];
    const a = R.ri(3, 15), b = R.ri(2, 12);
    kinds.push(() => ({ lines: [["A1", a], ["A2", b], ["A3", "=A1*2+A2"]], ask: "A3", ans: 2 * a + b,
      pool: [2 * (a + b), a + 2 * b, 2 * a + b + 1, 2 * a * b, 2 * a + b - 2],
      how: `A1*2+A2 = ${a} × 2 + ${b} = ${2 * a + b}. Multiplying goes before adding.` }));
    kinds.push(() => ({ lines: [["A1", a], ["A2", b], ["A3", "=A1*A2-A1"]], ask: "A3", ans: a * b - a,
      pool: [a * b, a * (b - 2), a * b - b, a * b - a + 1, a * (b + 1)],
      how: `A1*A2-A1 = ${a} × ${b} − ${a} = ${a * b} − ${a} = ${a * b - a}.` }));
    kinds.push(() => {
      const m = R.ri(6, 20), x = R.ri(1, m), y = R.ri(1, m), z = 3 * m - x - y;
      return { lines: [["A1", x], ["A2", y], ["A3", z], ["A4", "=AVERAGE(A1:A3)"]], ask: "A4", ans: m,
        pool: [3 * m, m + 1, m - 1, m + 2, Math.round((x + y) / 2)],
        how: `AVERAGE adds them and divides by how many: (${x} + ${y} + ${z}) ÷ 3 = ${3 * m} ÷ 3 = ${m}.` };
    });
    if (L >= 6) {
      const p = R.ri(20, 99), q = R.ri(3, 12), md = p % q;
      kinds.push(() => ({ lines: [["A1", p], ["A2", q], ["A3", "=MOD(A1,A2)"]], ask: "A3", ans: md,
        pool: [Math.floor(p / q), q - md, md + 1, md + 2, q],
        how: `MOD gives the remainder: ${p} ÷ ${q} = ${Math.floor(p / q)} remainder ${md}.` }));
      const r1 = R.ri(10, 99), r2 = R.ri(3, 9), rd = Math.round((r1 / r2) * 10) / 10;
      kinds.push(() => ({ lines: [["A1", r1], ["A2", r2], ["A3", "=ROUND(A1/A2,1)"]], ask: "A3", ans: rd, dp: 1,
        pool: [Math.floor((r1 / r2) * 10) / 10, rd + 0.1, rd - 0.1, Math.round(r1 / r2), Math.round((r2 / r1) * 10) / 10, rd + 1],
        how: `${r1} ÷ ${r2} = ${(r1 / r2).toFixed(3)}…, rounded to 1 decimal place = ${rd.toFixed(1)}.` }));
      const c = R.ri(5, 30);
      kinds.push(() => {
        const ans = a > c ? a - c : c * 2;
        return { lines: [["A1", a], ["A2", c], ["A3", "=IF(A1>A2,A1-A2,A2*2)"]], ask: "A3", ans,
          pool: [a > c ? c * 2 : a - c, a + c, Math.abs(a - c) + 1, ans + 2, a * 2],
          how: `Is A1 (${a}) > A2 (${c})? ${a > c ? `Yes, so A1−A2 = ${a - c}` : `No, so A2*2 = ${c * 2}`}.` };
      });
      const v = [R.ri(1, 40), R.ri(1, 40), R.ri(1, 40)];
      kinds.push(() => {
        const ans = Math.max(...v) - Math.min(...v);
        return { lines: [["A1", v[0]], ["A2", v[1]], ["A3", v[2]], ["A4", "=MAX(A1:A3)-MIN(A1:A3)"]], ask: "A4", ans,
          pool: [Math.max(...v), v[0] - v[2], ans + 1, ans + 2, v[0] + v[1] + v[2] - ans],
          how: `MAX is ${Math.max(...v)}, MIN is ${Math.min(...v)}; ${Math.max(...v)} − ${Math.min(...v)} = ${ans}.` };
      });
    }
    if (L >= 8) {
      kinds.push(() => {
        const b1 = a + b, b2 = b1 * b - a;
        return { lines: [["A1", a], ["A2", b], ["B1", "=A1+A2"], ["B2", "=B1*A2-A1"]], ask: "B2", ans: b2,
          pool: [b1 * b, b1 * (b - a), b2 + b, a + b * b - a, b2 - 1],
          how: `B1 = ${a} + ${b} = ${b1}. B2 = ${b1} × ${b} − ${a} = ${b1 * b} − ${a} = ${b2}.` };
      });
      kinds.push(() => {
        const ans = a * a - b * 3;
        return { lines: [["A1", a], ["A2", b], ["A3", "=A1^2-A2*3"]], ask: "A3", ans,
          pool: [(a * a - b) * 3, a * 2 - b * 3, ans + 3, a * a - b, ans - 1],
          how: `^ means "to the power": ${a}² = ${a * a}; ${b} × 3 = ${b * 3}; ${a * a} − ${b * 3} = ${ans}.` };
      });
    }
    const k = R.pick(kinds)();
    const f = (v) => (k.dp ? fixed(v, k.dp) : num(v));
    return {
      text: `In a spreadsheet, what does ${k.ask} show?`,
      mono: k.lines.map(([c, v]) => `${c.padEnd(3)} ${v}`),
      answer: f(k.ans), pool: k.pool.map(f), how: k.how,
    };
  });

  add("math", "sqrt", 5, (L, R) => {
    const n = R.ri(13, L >= 8 ? 99 : 45), x = n * n, lo = Math.floor(n / 10) * 10;
    return {
      text: "Square root:", big: `√${num(x)}`, answer: num(n),
      pool: [n + 1, n - 1, n + 2, n - 2, n + 10].map((v) => num(v)),
      how: `${lo}² = ${num(lo * lo)} and ${lo + 10}² = ${num((lo + 10) ** 2)}, so it's in the ${lo}s. ${x} ends in ${x % 10}, and ${n} × ${n} = ${num(x)}.`,
    };
  });

  // =====================================================================
  // NAVIGATION
  // =====================================================================
  add("nav", "recip", 1, (L, R) => {
    const h = L <= 2 ? R.ri(1, 36) * 10 : R.ri(1, 360), ans = hdg(h + 180);
    return {
      text: `What is the reciprocal (opposite direction) of ${hdg(h)}°?`, answer: ans + "°",
      pool: [h + 90, h - 90, h + 190, h + 170, h + 200, h + 160].map((v) => hdg(v) + "°"),
      how: `${wrap360(h) < 180 ? `${hdg(h)} + 180 = ${ans}` : `${hdg(h)} − 180 = ${ans}`}. Quick way: add 200 and take away 20 (or take away 200 and add 20).`,
    };
  });

  add("nav", "runway", 1, (L, R) => {
    if (L < 2 || R.chance(0.5)) {
      const n = R.ri(1, 36), suf = R.pick(L >= 2 ? ["", "L", "R", "C"] : ["", "", "L", "R"]);
      const osuf = suf === "L" ? "R" : suf === "R" ? "L" : suf;
      const other = rwyNum(n + 18);
      return {
        text: `You land on runway ${rwy(n)}${suf}. What's the number painted on the other end?`, answer: rwy(other) + osuf,
        pool: [rwy(other) + suf, rwy(n) + osuf, rwy(other + 1) + osuf, rwy(other - 1) + osuf, rwy(n + 9) + osuf, rwy(n + 20) + osuf],
        how: `Add or subtract 18 (that's 180°): ${rwy(n)} → ${rwy(other)}.${suf === "L" || suf === "R" ? " Left and right swap, because you're looking from the other end." : suf === "C" ? " Center stays center." : ""}`,
      };
    }
    const h = R.ri(1, 360), n = rwyNum(Math.round(h / 10));
    return {
      text: `Lined up for takeoff, the heading indicator reads ${hdg(h)}°. Which runway number are you on?`, answer: rwy(n),
      pool: [rwy(n + 1), rwy(n - 1), rwy(n + 18), rwy(n + 2), rwy(n - 2)],
      how: `Runway numbers are the magnetic heading ÷ 10, rounded: ${hdg(h)}° → ${rwy(n)}.`,
    };
  });

  add("nav", "tsd", 1, (L, R) => {
    let gs, t, d, kind;
    if (L <= 3) {
      gs = R.pick([60, 90, 120, 150, 180]); t = R.ri(3, 30) * 4; d = (gs * t) / 60;
      kind = L === 1 ? "time" : L === 2 ? R.pick(["time", "dist"]) : R.pick(["time", "dist", "gs"]);
    } else {
      gs = R.ri(19, 37) * 5; t = R.ri(12, 110); d = Math.round((gs * t) / 60);
      kind = R.pick(["time", "dist", "gs"]);
      if (kind === "time") t = Math.round((d / gs) * 60);
      if (kind === "gs") gs = Math.round((d / t) * 60);
    }
    const perMin = num(gs / 60, 2);
    if (kind === "time") {
      return {
        text: `${L >= 4 ? "About how long" : "How long"} to fly ${num(d)} nm at ${gs} kt groundspeed?`, answer: dur(t),
        pool: [t + 6, t - 6, t + 12, t - 12, (d / gs) * 100].filter((v) => v > 0).map(dur),
        how: `${num(d)} ÷ ${gs} = ${num(d / gs, 2)} h; × 60 = ${dur(t)}. Quick way: ${gs} kt is ${perMin} nm a minute, so ${num(d)} ÷ ${perMin} ≈ ${Math.round(t)} min.`,
      };
    }
    if (kind === "dist") {
      return {
        text: `How far do you go in ${dur(t)} at ${gs} kt groundspeed?`, answer: `${num(d)} nm`,
        pool: [d * 1.1, d * 0.9, d + 5, d - 5, (gs * t) / 100, d + 10].filter((v) => v > 0).map((v) => `${num(Math.round(v))} nm`),
        how: `${gs} kt is ${perMin} nm per minute; × ${t} min = ${num(d)} nm.`,
      };
    }
    return {
      text: `You covered ${num(d)} nm in ${dur(t)}. What's your groundspeed?`, answer: `${gs} kt`,
      pool: [gs + 10, gs - 10, gs + 20, gs - 20, Math.round((d * t) / 60), Math.round((d / t) * 100)].filter((v) => v > 0).map((v) => `${v} kt`),
      how: `${num(d)} nm ÷ ${t} min = ${num(d / t, 2)} nm a minute; × 60 = ${gs} kt.`,
    };
  });

  add("nav", "fuel", 2, (L, R) => {
    if (L <= 4) {
      const gph = R.pick([8, 9, 10, 12, 15]), t = R.ri(4, 24) * 10, fuel = (gph * t) / 60;
      const decHr = Math.floor(t / 60) + (t % 60) / 100;
      return {
        text: `Burning ${gph} gal/hr, how much fuel does a ${dur(t)} flight use?`, answer: `${fixed(fuel, 1)} gal`,
        pool: [gph * decHr, fuel + gph / 2, fuel - gph / 2, fuel + gph, fuel - 3].filter((v) => v > 0).map((v) => `${fixed(v, 1)} gal`),
        how: `${dur(t)} = ${num(t / 60, 2)} h; × ${gph} = ${fixed(fuel, 1)} gal.${t % 60 ? ` Careful: ${dur(t)} is ${num(t / 60, 2)} h, not ${num(decHr, 2)} h.` : ""}`,
      };
    }
    const U = R.ri(30, 60), gph = R.pick([8.5, 9, 9.5, 10, 10.5, 11, 12]);
    const total = (U / gph) * 60, e = r5(total - 45);
    return {
      text: `You have ${U} gal usable and burn ${gph} gal/hr. How long can you fly and still land with a 45-minute reserve?`, answer: dur(e),
      pool: [r5(total), r5(total - 30), e + 15, e - 15, e + 30].filter((v) => v > 0).map(dur),
      how: `${U} ÷ ${gph} = ${num(U / gph, 2)} h ≈ ${dur(r5(total))} total. Take off 45 min: about ${dur(e)}.`,
    };
  });

  add("nav", "xwind", 3, (L, R) => {
    const n = R.ri(1, 36), rh = n * 10;
    const ang = L <= 4 ? R.pick([30, 60, 90]) : L <= 6 ? R.pick([30, 45, 60, 90]) : R.ri(2, 8) * 10;
    const side = R.chance(0.5) ? 1 : -1, wd = wrap360(rh + side * ang), s = R.ri(5, 15) * 2;
    const xw = Math.round(s * sinD(ang)), hw = Math.round(s * cosD(ang));
    const askHead = L >= 5 && R.chance(0.4), ans = askHead ? hw : xw;
    return {
      text: `Runway ${rwy(n)}, wind ${hdg(wd)}° at ${s} kt. About how much ${askHead ? "headwind" : "crosswind"}?`, answer: `${ans} kt`,
      pool: [askHead ? xw : hw, s, Math.round(s / 2), ans + 3, ans - 3, ans + 5].filter((v) => v >= 0).map((v) => `${v} kt`),
      how: `The wind is ${ang}° off the runway (${hdg(rh)}°). Crosswind = ${s} × sin ${ang}° ≈ ${xw} kt; headwind = ${s} × cos ${ang}° ≈ ${hw} kt. Clock rule: 15° ≈ ¼ of the wind, 30° ≈ ½, 45° ≈ ¾, 60° or more ≈ all of it.`,
    };
  });

  add("nav", "var", 2, (L, R) => {
    const v = R.ri(2, 15), east = R.chance(0.5), EW = east ? "E" : "W";
    if (L <= 4) {
      const tc = L <= 2 ? R.ri(1, 36) * 10 : R.ri(1, 360), mc = east ? tc - v : tc + v;
      return {
        text: `True course ${hdg(tc)}°, variation ${v}° ${east ? "east" : "west"}. What's the magnetic course?`, answer: hdg(mc) + "°",
        pool: [east ? tc + v : tc - v, tc, mc + 10, mc - 10, tc + 2 * v].map((x) => hdg(x) + "°"),
        how: `"East is least, west is best": ${east ? `subtract east variation: ${hdg(tc)} − ${v}` : `add west variation: ${hdg(tc)} + ${v}`} = ${hdg(mc)}°.`,
      };
    }
    const tc = R.ri(1, 360), wca = R.ri(2, 12), right = R.chance(0.5);
    let dev = R.ri(-3, 3); if (dev === 0) dev = 2;
    const th = tc + (right ? wca : -wca), mh = th + (east ? -v : v), ch = mh + dev;
    const sd = (x) => (x > 0 ? "+" : "−") + Math.abs(x);
    return {
      text: "What's the compass heading?",
      mono: [`True course   ${hdg(tc)}°`, `Wind corr.    ${wca}° ${right ? "right" : "left"}`, `Variation     ${v}° ${EW}`, `Deviation     ${sd(dev)}°`],
      answer: hdg(ch) + "°",
      pool: [th + (east ? v : -v) + dev, tc - (right ? wca : -wca) + (east ? -v : v) + dev, mh, mh - dev, ch + 10, ch - 10].map((x) => hdg(x) + "°"),
      how: `True heading ${hdg(tc)} ${right ? "+" : "−"} ${wca} = ${hdg(th)}°. ${east ? "East is least" : "West is best"}: ${hdg(th)} ${east ? "−" : "+"} ${v} = ${hdg(mh)}° magnetic. Deviation ${sd(dev)} → ${hdg(ch)}° compass.`,
    };
  });

  add("nav", "turn", 1, (L, R) => {
    const h1 = L <= 3 ? R.ri(1, 36) * 10 : R.ri(1, 360);
    let delta = L <= 3 ? R.ri(1, 17) * 10 : R.ri(10, 170);
    const right = R.chance(0.5), h2 = h1 + (right ? delta : -delta);
    const dir = right ? "Right" : "Left", other = right ? "Left" : "Right";
    const pool = [`${other} ${360 - delta}°`, `${other} ${delta}°`, `${dir} ${delta + 10}°`, `${dir} ${Math.max(5, delta - 10)}°`];
    if (180 - delta !== delta) pool.push(`${dir} ${180 - delta}°`);
    return {
      text: `You're on heading ${hdg(h1)}°. What's the shortest turn to heading ${hdg(h2)}°?`, answer: `${dir} ${delta}°`, pool,
      how: `From ${hdg(h1)}° to ${hdg(h2)}° is ${delta}° to the ${dir.toLowerCase()}; going the other way would be ${360 - delta}°.`,
    };
  });

  add("nav", "descent", 3, (L, R) => {
    const kinds = ["time"];
    if (L >= 4) kinds.push("dist");
    if (L >= 6) kinds.push("rate");
    if (L >= 8) kinds.push("cross");
    const k = R.pick(kinds);
    const A2 = R.ri(4, 12) * 500, loss = R.ri(4, 14) * 500, A1 = A2 + loss;
    if (k === "time") {
      const rate = R.pick([500, 750, 1000]), t = Math.round((loss / rate) * 10) / 10;
      return {
        text: `Descending from ${num(A1)} ft to ${num(A2)} ft at ${rate} ft/min. How many minutes?`, answer: `${num(t, 1)} min`,
        pool: [loss / 1000, t + 2, t - 2, t + 1.5, loss / 100, t * 2].filter((v) => v > 0).map((v) => `${num(Math.round(v * 10) / 10, 1)} min`),
        how: `You lose ${num(loss)} ft. ${num(loss)} ÷ ${rate} = ${num(t, 1)} min.`,
      };
    }
    if (k === "dist") {
      const nm = (loss / 1000) * 3;
      return {
        text: `To descend from ${num(A1)} ft to ${num(A2)} ft on a 3° path, how many miles out do you start down?`, answer: `${num(nm, 1)} nm`,
        pool: [(loss / 1000) * 2, (loss / 1000) * 5, nm + 3, nm - 3, loss / 100].filter((v) => v > 0).map((v) => `${num(v, 1)} nm`),
        how: `A 3° path loses about 1,000 ft every 3 nm. ${num(loss)} ft = ${num(loss / 1000, 1)} × 3 = ${num(nm, 1)} nm.`,
      };
    }
    if (k === "rate") {
      const gs = R.ri(9, 18) * 10, fpm = gs * 5;
      return {
        text: `On a 3° glidepath at ${gs} kt groundspeed, about what descent rate do you need?`, answer: `${num(fpm)} ft/min`,
        pool: [gs * 3, gs * 10, fpm + 150, fpm - 150, gs * 7].map((v) => `${num(v)} ft/min`),
        how: `Rule of thumb for 3°: groundspeed × 5. ${gs} × 5 = ${num(fpm)} ft/min.`,
      };
    }
    const gs = R.pick([120, 150, 180]), t = R.ri(3, 10) * 2, dist = (gs * t) / 60, rate = R.ri(3, 10) * 100, lossX = t * rate;
    return {
      text: `ATC: "Cross a fix ${num(dist)} nm ahead at ${num(A1)} ft." You're at ${num(A1 + lossX)} ft, ${gs} kt groundspeed. What descent rate?`,
      answer: `${num(rate)} ft/min`,
      pool: [rate + 100, rate - 100, rate + 200, Math.round(lossX / dist), rate * 2].filter((v) => v > 0).map((v) => `${num(v)} ft/min`),
      how: `Time to the fix: ${num(dist)} ÷ ${gs} × 60 = ${t} min. You must lose ${num(lossX)} ft: ${num(lossX)} ÷ ${t} = ${num(rate)} ft/min.`,
    };
  });

  add("nav", "zulu", 2, (L, R) => {
    if (L <= 4) {
      const local = R.ri(0, 287) * 5, z = local + 420;
      return {
        text: `It's ${hhmm(local)} local time in Tucson. What time is it in Zulu (UTC)?`, answer: hhmm(z) + "Z",
        pool: [local + 360, local - 420, local + 480, z + 100, z - 60 + 1440].map((v) => hhmm(v) + "Z"),
        how: `Arizona stays on Mountain Standard Time (UTC−7) all year, with no daylight saving, so add 7 hours: ${hhmm(local)} + 7 h = ${hhmm(z)}Z.`,
      };
    }
    const dep = R.ri(0, 287) * 5, ete = L <= 6 ? R.ri(5, 50) * 5 : R.ri(25, 250), eta = dep + ete;
    if (L >= 7 && R.chance(0.5)) {
      const loc = eta - 420;
      return {
        text: `You depart at ${hhmm(dep)}Z with ${dur(ete)} en route, landing in Tucson. What's your arrival time on the local clock?`, answer: hhmm(loc) + " local",
        pool: [eta, loc + 60, eta - 360, loc - 60, loc + 10].map((v) => hhmm(v) + " local"),
        how: `ETA ${hhmm(dep)}Z + ${dur(ete)} = ${hhmm(eta)}Z. Tucson is UTC−7: ${hhmm(eta)} − 7 h = ${hhmm(loc)} local.`,
      };
    }
    return {
      text: `You depart at ${hhmm(dep)}Z with ${dur(ete)} en route. What's your ETA?`, answer: hhmm(eta) + "Z",
      pool: [eta + 10, eta - 10, eta + 60, eta - 60, eta + 40].map((v) => hhmm(v) + "Z"),
      how: `${hhmm(dep)}Z + ${dur(ete)} = ${hhmm(eta)}Z. Add the minutes first; every 60 minutes rolls over into the hour.`,
    };
  });

  add("nav", "stdturn", 2, (L, R) => {
    if (L <= 4 || R.chance(0.4)) {
      const d = R.ri(1, 12) * 30, s = d / 3;
      return {
        text: `How long does a ${d}° turn take at standard rate?`, answer: secs(s),
        pool: [d / 2, d / 6, s + 10, s - 10, d, s * 2].filter((v) => v > 0).map(secs),
        how: `Standard rate is 3° per second: ${d} ÷ 3 = ${secs(s)}. A full 360° takes 2 minutes.`,
      };
    }
    const tas = R.ri(9, 20) * 10, bank = tas / 10 + 7;
    return {
      text: `About what bank angle gives a standard-rate turn at ${tas} KTAS?`, answer: `${bank}°`,
      pool: [tas / 10, tas / 10 + 15, 45, bank + 6, bank - 6].filter((v) => v >= 5).map((v) => `${v}°`),
      how: `Rule of thumb: bank ≈ true airspeed ÷ 10 + 7. ${tas} ÷ 10 + 7 = ${bank}°. (15% of airspeed gives about the same.)`,
    };
  });

  add("nav", "isa", 3, (L, R) => {
    const k = R.ri(1, 12), alt = k * 1000, t = 15 - 2 * k;
    return {
      text: `What's the standard (ISA) temperature at ${num(alt)} ft?`, answer: `${t} °C`,
      pool: [15 - 3 * k, 15 - k, 15, t + 2, t - 2, 15 - 4 * k].map((v) => `${v} °C`),
      how: `Standard is 15 °C at sea level, dropping 2 °C per 1,000 ft: 15 − ${2 * k} = ${t} °C.`,
    };
  });

  add("nav", "pa", 4, (L, R) => {
    const tus = R.chance(0.35), elev = tus ? 2643 : R.ri(1, 70) * 100 + R.ri(0, 99);
    const set = 29.5 + R.ri(0, 90) / 100, pa = Math.round(elev + (29.92 - set) * 1000);
    const where = tus ? "Tucson (KTUS), field elevation 2,643 ft" : `An airport at ${num(elev)} ft`;
    if (L >= 7 && R.chance(0.5)) {
      const paR = Math.round(pa / 100) * 100, isa = 15 - (2 * paR) / 1000, oat = Math.round(isa + R.ri(5, 25));
      const da = Math.round((paR + 120 * (oat - isa)) / 100) * 100;
      return {
        text: `Pressure altitude ${num(paR)} ft and the temperature is ${oat} °C. About what's the density altitude?`, answer: `${num(da)} ft`,
        pool: [Math.round((paR + 120 * oat) / 100) * 100, paR, da + 1000, da - 1000, da + 2000].map((v) => `${num(v)} ft`),
        how: `Standard temp at ${num(paR)} ft is ${num(isa, 1)} °C, so it's ${num(oat - isa, 1)}° hotter. Add about 120 ft per degree: ${num(paR)} + 120 × ${num(oat - isa, 1)} ≈ ${num(da)} ft.`,
      };
    }
    return {
      text: `${where}. Altimeter setting ${set.toFixed(2)}. What's the pressure altitude?`, answer: `${num(pa)} ft`,
      pool: [Math.round(elev - (29.92 - set) * 1000), elev, pa + 100, pa - 100, Math.round(elev + (29.92 - set) * 100)].map((v) => `${num(v)} ft`),
      how: `Each 0.01 inHg below 29.92 adds about 10 ft. 29.92 − ${set.toFixed(2)} = ${(29.92 - set).toFixed(2)} → ${(29.92 - set) >= 0 ? "+" : "−"}${num(Math.abs(Math.round((29.92 - set) * 1000)))} ft: ${num(pa)} ft.`,
    };
  });

  add("nav", "sixty", 4, (L, R) => {
    for (let tries = 0; tries < 50; tries++) {
      const a = R.ri(2, 8), D = R.pick([30, 60, 90, 120]), d = (a * D) / 60;
      if (L < 7) {
        return {
          text: `After ${D} nm you're ${num(d, 1)} nm off course. How many degrees off are you?`, answer: `${a}°`,
          pool: [a * 2, Math.max(1, Math.round(a / 2)), a + 3, a + 5, Math.round(d) === a ? a + 4 : Math.round(d)].map((v) => `${v}°`),
          how: `60-to-1 rule: 1 nm off in 60 nm is 1°. ${num(d, 1)} ÷ ${D} × 60 = ${a}°. Turn ${a}° back to parallel your course.`,
        };
      }
      const Rm = R.pick([D, 2 * D]), conv = (d / Rm) * 60, total = a + conv;
      if (!Number.isInteger(total)) continue;
      return {
        text: `After ${D} nm you're ${num(d, 1)} nm off course, with ${Rm} nm still to go. How many degrees do you turn to reach the destination?`, answer: `${total}°`,
        pool: [a, conv, total + 3, total * 2, total - 2].filter((v) => v > 0).map((v) => `${v}°`),
        how: `60-to-1 rule: ${num(d, 1)} nm in ${D} nm = ${a}° to parallel, plus ${num(d, 1)} nm in ${Rm} nm = ${conv}° to converge. ${a} + ${conv} = ${total}°.`,
      };
    }
    return null;
  });

  // =====================================================================
  // MECHANICS
  // =====================================================================
  add("mech", "gear", 1, (L, R) => {
    const teeth = [10, 12, 15, 16, 20, 24, 30, 36, 40, 48, 60];
    const T1 = R.pick(teeth); let T2 = R.pick(teeth); if (T2 === T1) T2 = T1 === 60 ? 30 : 60;
    if (L <= 3) {
      const unit = T2 / gcd(T1, T2), rpm1 = unit * R.ri(1, Math.max(1, Math.floor(2400 / unit))), rpm2 = (rpm1 * T1) / T2;
      return {
        text: `A ${T1}-tooth gear turning at ${num(rpm1)} rpm drives a ${T2}-tooth gear. How fast does the ${T2}-tooth gear turn?`, answer: `${num(rpm2)} rpm`,
        pool: [(rpm1 * T2) / T1, rpm1, rpm2 * 2, rpm2 / 2, rpm2 + 10].map((v) => `${num(Math.round(v))} rpm`),
        how: `Speed × teeth stays the same: ${num(rpm1)} × ${T1} = ${num(rpm1 * T1)}; ÷ ${T2} = ${num(rpm2)} rpm. Smaller gear spins faster.`,
      };
    }
    if (L <= 6) {
      const Ti = R.pick(teeth), cw = R.chance(0.5), unit = T2 / gcd(T1, T2), rpm1 = unit * R.ri(1, Math.max(1, Math.floor(2400 / unit))), rpm2 = (rpm1 * T1) / T2;
      const same = cw ? "Clockwise" : "Counterclockwise", opp = cw ? "Counterclockwise" : "Clockwise";
      return {
        text: `Gear A (${T1} teeth) turns ${same.toLowerCase()} at ${num(rpm1)} rpm. It drives idler B (${Ti} teeth), which drives gear C (${T2} teeth). Which way and how fast does C turn?`,
        answer: `${same}, ${num(rpm2)} rpm`,
        pool: [`${opp}, ${num(rpm2)} rpm`, `${same}, ${num(Math.round((rpm1 * T2) / T1))} rpm`, `${opp}, ${num(Math.round((rpm1 * T2) / T1))} rpm`, `${same}, ${num(Math.round((rpm1 * T1) / Ti))} rpm`],
        how: `Each mesh flips direction, so A → B → C flips twice: C turns the same way as A. The idler doesn't change the speed: ${num(rpm1)} × ${T1} ÷ ${T2} = ${num(rpm2)} rpm.`,
      };
    }
    const T3 = R.pick(teeth), T4 = R.pick(teeth), base = (T2 * T4) / gcd(T1 * T3, T2 * T4);
    const rpmA = base * R.ri(1, Math.max(1, Math.floor(3600 / base))), rpmD = (rpmA * T1 * T3) / (T2 * T4);
    return {
      text: `Gear A (${T1} t) at ${num(rpmA)} rpm drives gear B (${T2} t). Gear C (${T3} t) is on B's shaft and drives gear D (${T4} t). How fast does D turn?`,
      answer: `${num(rpmD)} rpm`,
      pool: [(rpmA * T1) / T2, (rpmA * T2 * T4) / (T1 * T3), rpmD * 2, rpmD / 2, (rpmA * T1) / T4].map((v) => `${num(Math.round(v))} rpm`),
      how: `B turns ${num(rpmA)} × ${T1}/${T2} = ${num((rpmA * T1) / T2, 1)} rpm, and C turns with it. D turns ${num((rpmA * T1) / T2, 1)} × ${T3}/${T4} = ${num(rpmD)} rpm.`,
    };
  });

  add("mech", "lever", 1, (L, R) => {
    const d1 = R.ri(1, 8); let d2 = R.ri(1, 9); if (d2 === d1) d2 += 1;
    const unit = d2 / gcd(d1, d2), W1 = unit * R.ri(Math.ceil(20 / unit), Math.max(Math.ceil(20 / unit), Math.floor(400 / unit))), ans = (W1 * d1) / d2;
    return {
      text: `A ${num(W1)}-lb load sits ${d1} ft from the pivot. How much force ${d2} ft from the pivot on the other side balances it?`, answer: `${num(ans)} lb`,
      pool: [(W1 * d2) / d1, W1, ans + 10, ans - 10, W1 * d1].filter((v) => v > 0).map((v) => `${num(Math.round(v))} lb`),
      how: `Weight × distance must match on both sides: ${num(W1)} × ${d1} = ${num(W1 * d1)} ft-lb; ÷ ${d2} = ${num(ans)} lb.`,
    };
  });

  add("mech", "pulley", 2, (L, R) => {
    const n = R.ri(2, 6);
    if (L >= 5 && R.chance(0.5)) {
      const h = R.ri(1, 6);
      return {
        text: `A block and tackle has ${n} rope strands holding the load. How much rope do you pull to lift the load ${h} ft?`, answer: `${n * h} ft`,
        pool: [h, (n - 1) * h, (n + 1) * h, h * 2 === n * h ? h * 3 : h * 2, n * h + 1].map((v) => `${v} ft`),
        how: `With ${n} strands, every foot of lift takes ${n} ft of rope: ${h} × ${n} = ${n * h} ft. The force goes down by the same factor.`,
      };
    }
    const W = n * 10 * R.ri(2, 30), e = W / n;
    return {
      text: `A block and tackle has ${n} rope strands holding a ${num(W)}-lb engine. Ignoring friction, how hard do you pull?`, answer: `${num(e)} lb`,
      pool: [W, W / (n - 1), W / (n + 1), e * 2, e + 10].map((v) => `${num(Math.round(v))} lb`),
      how: `Each supporting strand carries an equal share: ${num(W)} ÷ ${n} = ${num(e)} lb.`,
    };
  });

  add("mech", "torque", 2, (L, R) => {
    if (L >= 6 && R.chance(0.6)) {
      const Lw = R.pick([10, 12, 15]), E = R.pick([2, 3, 5]), k = R.ri(Math.ceil(100 / (Lw + E)), Math.floor(600 / (Lw + E))), T = k * (Lw + E), set = k * Lw;
      return {
        text: `You need ${num(T)} in-lb. Your torque wrench is ${Lw} in long, with a ${E}-in crowfoot extension straight out the end. What do you set the wrench to?`,
        answer: `${num(set)} in-lb`,
        pool: [Math.round((T * (Lw + E)) / Lw), T, T - k * E * 2, set + 20, set - 20].filter((v) => v > 0).map((v) => `${num(v)} in-lb`),
        how: `Setting = desired × wrench length ÷ (wrench length + extension) = ${num(T)} × ${Lw} ÷ ${Lw + E} = ${num(set)} in-lb. The extension adds leverage, so you set it lower.`,
      };
    }
    const F = R.ri(2, 16) * 5, arm = R.pick([6, 9, 12, 15, 18, 24]), tin = F * arm, inFt = R.chance(0.5);
    return {
      text: `You pull ${F} lb on a wrench ${arm} in from the bolt. How much torque is that${inFt ? " in foot-pounds" : ""}?`,
      answer: inFt ? `${num(tin / 12, 2)} ft-lb` : `${num(tin)} in-lb`,
      pool: inFt
        ? [tin, (F * arm) / 10, (tin / 12) * 2, tin / 12 + 5, F * (arm / 12 + 1)].map((v) => `${num(v, 2)} ft-lb`)
        : [tin / 12, tin + F, tin - F, tin * 2, F + arm].map((v) => `${num(v, 2)} in-lb`),
      how: `Torque = force × distance: ${F} × ${arm} = ${num(tin)} in-lb${inFt ? `; ÷ 12 = ${num(tin / 12, 2)} ft-lb` : ""}.`,
    };
  });

  add("mech", "cg", 3, (L, R) => {
    for (let tries = 0; tries < 100; tries++) {
      const n = L >= 6 ? 3 : 2;
      const items = Array.from({ length: n }, () => ({ w: R.ri(2, 30) * 10, a: R.ri(20, 140) }));
      const W = items.reduce((s, x) => s + x.w, 0), M = items.reduce((s, x) => s + x.w * x.a, 0), cg = M / W;
      if (Math.abs(cg * 10 - Math.round(cg * 10)) > 1e-9) continue;
      const avg = items.reduce((s, x) => s + x.a, 0) / n;
      if (Math.abs(avg - cg) < 2) continue;
      const heavy = items.slice().sort((p, q) => q.w - p.w)[0].a;
      return {
        text: "Where's the center of gravity?",
        mono: items.map((x, i) => `Item ${i + 1}  ${String(x.w).padStart(3)} lb at ${x.a} in`),
        answer: `${num(cg, 1)} in`,
        pool: [avg, cg + 5, cg - 5, heavy, cg + 10].map((v) => `${num(Math.round(v * 10) / 10, 1)} in`),
        how: `CG = total moment ÷ total weight. Moments: ${items.map((x) => `${x.w} × ${x.a} = ${num(x.w * x.a)}`).join("; ")}. ${num(M)} ÷ ${num(W)} lb = ${num(cg, 1)} in. (Just averaging the arms gives ${num(avg, 1)} — the trap.)`,
      };
    }
    return null;
  });

  add("mech", "hydraulic", 3, (L, R) => {
    if (L <= 4 && R.chance(0.5)) {
      const A = R.pick([0.5, 1, 2, 4, 5]), p = R.ri(2, 30) * 50, F = p * A;
      return {
        text: `A hydraulic piston has ${A} sq in of area. How much force does ${num(p)} psi push it with?`, answer: `${num(F)} lb`,
        pool: [p / A, p, F * 2, F + 100, F / 2].map((v) => `${num(Math.round(v))} lb`),
        how: `Force = pressure × area: ${num(p)} psi × ${A} sq in = ${num(F)} lb.`,
      };
    }
    const A1 = R.pick([1, 2, 4, 5]); let A2 = R.pick([2, 4, 8, 10, 20]); if (A2 <= A1) A2 = A1 * 4;
    const F1 = R.ri(2, 20) * 10, F2 = (F1 * A2) / A1;
    return {
      text: `You push ${F1} lb on a ${A1}-sq-in piston. The output piston is ${A2} sq in. What force comes out?`, answer: `${num(F2)} lb`,
      pool: [(F1 * A1) / A2, F1, F1 * A2, F2 + F1, F2 / 2].map((v) => `${num(Math.round(v * 10) / 10, 1)} lb`),
      how: `Pressure is ${F1} ÷ ${A1} = ${num(F1 / A1, 1)} psi everywhere in the fluid. × ${A2} sq in = ${num(F2)} lb.`,
    };
  });

  add("mech", "ohm", 2, (L, R) => {
    const V = R.pick([14, 28]);
    const k = L <= 3 ? R.pick(["I", "V"]) : L <= 5 ? R.pick(["I", "V", "P"]) : R.pick(["P", "Ip"]);
    if (k === "I") {
      const Rr = R.pick(V === 14 ? [1, 2, 7, 14] : [1, 2, 4, 7, 14, 28]), I = V / Rr;
      return {
        text: `A ${V}-volt bus powers a ${Rr}-ohm load. How much current flows?`, answer: `${num(I)} A`,
        pool: [V * Rr, Rr / V, I + 2, I * 2, I + 1].map((v) => `${num(v, 2)} A`),
        how: `Ohm's law: amps = volts ÷ ohms. ${V} ÷ ${Rr} = ${num(I)} A.`,
      };
    }
    if (k === "V") {
      const I = R.ri(2, 12), Rr = R.ri(2, 10), Vv = I * Rr;
      return {
        text: `A ${Rr}-ohm resistor carries ${I} A. What's the voltage across it?`, answer: `${Vv} V`,
        pool: [I + Rr, Vv + I, Vv - Rr, Vv * 2, Math.round((Rr / I) * 10) / 10].map((v) => `${num(v, 1)} V`),
        how: `Volts = amps × ohms: ${I} × ${Rr} = ${Vv} V.`,
      };
    }
    if (k === "P") {
      const I = R.ri(2, 15), P = V * I;
      return {
        text: `A light on the ${V}-volt system draws ${I} A. How many watts?`, answer: `${P} W`,
        pool: [V + I, P / 2, P + V, Math.round((V / I) * 10) / 10, P * 2].map((v) => `${num(v, 1)} W`),
        how: `Watts = volts × amps: ${V} × ${I} = ${P} W.`,
      };
    }
    const P = R.ri(2, 30) * 10, I = Math.round((P / V) * 10) / 10;
    return {
      text: `A ${P}-watt light runs on a ${V}-volt system. About how many amps does it draw?`, answer: `${fixed(I, 1)} A`,
      pool: [V / P, (P / V) * 10, I * 2, I + 1, (P / (V === 14 ? 28 : 14))].map((v) => `${fixed(Math.round(v * 10) / 10, 1)} A`),
      how: `Amps = watts ÷ volts: ${P} ÷ ${V} ≈ ${fixed(I, 1)} A.`,
    };
  });

  add("mech", "hardware", 2, (L, R) => {
    const k = L <= 3 ? "thread" : R.pick(["thread", "andia", "anlen"]);
    if (k === "thread") {
      const tpi = R.pick([8, 10, 16, 20, 24, 28, 32]), n = R.ri(2, 16) * 2, adv = n / tpi;
      const f = (v) => `${dec(Math.round(v * 1000) / 1000)} in`;
      return {
        text: `A bolt has ${tpi} threads per inch. How far does the nut move in ${n} full turns?`, answer: f(adv),
        pool: [tpi / n, adv * 2, adv / 2, n / 100, adv + 0.125].map(f),
        how: `Each turn moves 1/${tpi} in. ${n} turns × 1/${tpi} = ${n}/${tpi} = ${dec(Math.round(adv * 1000) / 1000)} in.`,
      };
    }
    if (k === "andia") {
      const d = R.ri(3, 8);
      return {
        text: `What's the shank diameter of an AN${d} bolt?`, answer: `${fracStr(d, 16)} in`,
        pool: [fracStr(d, 32), fracStr(d, 8), fracStr(d + 1, 16), fracStr(d - 1, 16), fracStr(d, 10)].map((s) => `${s} in`),
        how: `The AN bolt number is the diameter in sixteenths of an inch: AN${d} = ${d}/16 = ${fracStr(d, 16)} in.`,
      };
    }
    const whole = R.ri(0, 3), eighths = R.ri(whole === 0 ? 3 : 0, 7), dash = whole * 10 + eighths, d = R.ri(3, 6);
    const len = whole * 8 + eighths;
    return {
      text: `What's the length of an AN${d}-${dash} bolt?`, answer: `${fracStr(len, 8)} in`,
      pool: [fracStr(dash, 8), fracStr(dash, 16), fracStr(len + 1, 8), fracStr(len + 8, 8), fracStr(len, 16)].map((s) => `${s} in`),
      how: `In the dash number, the last digit is eighths of an inch and any digits in front are whole inches: -${dash} = ${whole ? whole + " in + " : ""}${eighths}/8 = ${fracStr(len, 8)} in.`,
    };
  });

  add("mech", "spring", 1, (L, R) => {
    const k = R.ri(2, 20) * 5, x = R.ri(1, 8) / (L >= 4 ? 2 : 1), F = k * x;
    if (R.chance(0.5)) {
      return {
        text: `A spring has a rate of ${k} lb per inch. How far does a ${num(F, 1)}-lb load stretch it?`, answer: `${num(x, 1)} in`,
        pool: [k / F, x * 2, x + 1, F / 10, x + 0.5].map((v) => `${num(Math.round(v * 10) / 10, 1)} in`),
        how: `Stretch = load ÷ spring rate: ${num(F, 1)} ÷ ${k} = ${num(x, 1)} in.`,
      };
    }
    return {
      text: `A ${k}-lb/in spring is compressed ${num(x, 1)} in. How hard does it push back?`, answer: `${num(F, 1)} lb`,
      pool: [k / x, k + x, F * 2, F + k, F / 2].map((v) => `${num(Math.round(v * 10) / 10, 1)} lb`),
      how: `Force = spring rate × distance: ${k} × ${num(x, 1)} = ${num(F, 1)} lb.`,
    };
  });

  add("mech", "drill", 3, (L, R) => {
    const dens = L >= 6 ? [8, 16, 32, 64] : [8, 16, 32];
    const seen = new Set(), list = [];
    while (list.length < 4) {
      const d = R.pick(dens); let n = R.ri(1, d - 1); if (d > 8 && n % 2 === 0) n += 1;
      const v = n / d; if (v < 0.06 || v > 0.94) continue;
      const key = Math.round(v * 64); if (seen.has(key)) continue;
      // keep them close together so it takes thought
      if (list.length && Math.abs(v - list[0].v) > 0.15) continue;
      seen.add(key); list.push({ v, s: fracStr(n, d) });
    }
    const best = list.reduce((m, x) => (x.v > m.v ? x : m));
    return {
      text: "Which drill bit is the biggest?", answer: `${best.s} in`,
      pool: list.filter((x) => x !== best).map((x) => `${x.s} in`),
      how: `Put them all in 64ths: ${list.map((x) => `${x.s} = ${Math.round(x.v * 64)}/64`).join(", ")}. Biggest: ${best.s} in.`,
    };
  });

  add("mech", "belt", 4, (L, R) => {
    const D1 = R.pick([2, 3, 4, 5, 6, 8]); let D2 = R.pick([2, 3, 4, 5, 6, 8, 10, 12]); if (D2 === D1) D2 = D1 * 2;
    const unit = D2 / gcd(D1, D2), rpm1 = unit * R.ri(Math.ceil(600 / unit), Math.floor(3600 / unit)), rpm2 = (rpm1 * D1) / D2;
    return {
      text: `A motor turns a ${D1}-in pulley at ${num(rpm1)} rpm. The belt drives a ${D2}-in pulley. How fast does it turn?`, answer: `${num(rpm2)} rpm`,
      pool: [(rpm1 * D2) / D1, rpm1, rpm2 * 2, rpm2 + 100, rpm2 / 2].map((v) => `${num(Math.round(v))} rpm`),
      how: `The belt moves at one speed, so rpm × diameter matches: ${num(rpm1)} × ${D1} ÷ ${D2} = ${num(rpm2)} rpm.`,
    };
  });

  // =====================================================================
  // Building a puzzle
  // =====================================================================
  const BAD = /NaN|undefined|Infinity|null/;
  const levelOf = (rating) => Math.max(1, Math.min(10, Math.floor(rating)));

  function makePuzzle(cat, rating, R = makeRng(), opts = {}) {
    const avoidIds = opts.avoidIds || [], avoidTexts = new Set(opts.avoidTexts || []);
    const L = levelOf(rating);
    for (let tries = 0; tries < 40; tries++) {
      const list = G.filter((g) => g.cat === cat && g.min <= L);
      const fresh = list.filter((g) => !avoidIds.includes(g.id));
      const choices = fresh.length ? fresh : list;
      // newer (harder) recipes for this level come up more often
      const weights = choices.map((g) => (g.min >= L - 2 ? 3 : 1));
      let r = R.next() * weights.reduce((s, w) => s + w, 0), g = choices[0];
      for (let i = 0; i < choices.length; i++) { r -= weights[i]; if (r <= 0) { g = choices[i]; break; } }
      const p = g.gen(L, R);
      if (!p) continue;
      p.text = p.text.replace(/\b([Aa]) (?=8|1[18](?![\d.]))/g, (m, a) => a + "n ");
      const answer = String(p.answer);
      const key = p.text + "|" + (p.big || "") + "|" + (p.mono || []).join("/");
      if (avoidTexts.has(key) && tries < 30) continue;
      if (BAD.test(answer)) continue;
      const seen = new Set([answer]), wrong = [], neg = /^[-−]/.test(answer);
      for (const w of R.shuffle(p.pool.map(String))) {
        if (!w || BAD.test(w) || seen.has(w) || (!neg && /^[-−]/.test(w))) continue;
        seen.add(w); wrong.push(w);
        if (wrong.length === 3) break;
      }
      if (wrong.length < 3) continue;
      const options = R.shuffle([answer, ...wrong]);
      return { cat, id: g.id, level: L, key, text: p.text, big: p.big || "", mono: p.mono || null, options, correct: options.indexOf(answer), answer, how: p.how };
    }
    throw new Error("Could not make a puzzle for " + cat);
  }

  // ---------- grading, LSO style ----------
  const GRADES = {
    OKU: { label: "OK", underline: true, name: "Perfect pass", pts: 5, cls: "g-oku" },
    OK: { label: "OK", name: "OK pass", pts: 4, cls: "g-ok" },
    F: { label: "F", name: "Fair", pts: 3, cls: "g-fair" },
    B: { label: "B", name: "Bolter (ran out of time)", pts: 2.5, cls: "g-bolter" },
    NG: { label: "NG", name: "No grade (wrong answer)", pts: 2, cls: "g-ng" },
    WO: { label: "WO", name: "Wave-off (skipped)", pts: 1, cls: "g-wo" },
  };
  function grade({ correct, seconds, timedOut, skipped, limit = 60 }) {
    if (skipped) return "WO";
    if (timedOut) return "B";
    if (!correct) return "NG";
    const k = limit / 60;
    if (seconds <= 15 * k) return "OKU";
    if (seconds <= 35 * k) return "OK";
    return "F";
  }
  const STEP = { OKU: 0.5, OK: 0.35, F: 0.15, B: -0.3, NG: -0.45, WO: -0.1 };
  const updateRating = (r, g) => Math.max(1, Math.min(10.99, (r || 1) + STEP[g]));
  const RANKS = ["Student Pilot", "Solo", "Private Pilot", "Instrument Rated", "Commercial", "Flight Instructor", "Airline Transport", "Carrier Qualified", "Test Pilot", "Top Gun"];
  const rankOf = (L) => RANKS[Math.max(1, Math.min(10, L)) - 1];
  const gpa = (grades) => (grades.length ? grades.reduce((s, g) => s + GRADES[g].pts, 0) / grades.length : 0);

  const api = {
    makeRng, makePuzzle, grade, GRADES, updateRating, levelOf, rankOf, RANKS, gpa, CATS, RECIPES: G,
    num, fixed, hdg, rwy, rwyNum, dur, hhmm, secs, fracStr, dec, gcd,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GTP = api;
})(typeof self !== "undefined" ? self : this);
