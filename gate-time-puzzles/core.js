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
    math: { label: "Math", icon: "🧮", blurb: "Mental math, estimates, percents, fractions, ratios, algebra, odds, binary and hex, patterns, Excel formulas" },
    nav: { label: "Navigation", icon: "🧭", blurb: "Wind triangles, holds, VORs, fuel planning, descents, Zulu time, altitudes, regs and light signals" },
    mech: { label: "Mechanics", icon: "⚙️", blurb: "Gears, levers, torque, weight and balance, G-loads, rivets, bend allowance, hydraulics, electrics, horsepower" },
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
  // MORE MATH
  // =====================================================================
  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const sup = (n) => String(n).split("").map((c) => SUP[c]).join("");
  const sig = (v, s) => { if (v === 0) return 0; const p = 10 ** (Math.floor(Math.log10(Math.abs(v))) - (s - 1)); return Math.round(v / p) * p; };
  const money = (v) => "$" + fixed(v, 2);

  add("math", "estimate", 3, (L, R) => {
    const a = L >= 7 ? R.ri(1100, 9800) : R.ri(110, 980), b = L >= 7 ? R.ri(31, 98) : R.ri(11, 49);
    const exact = a * b, est = sig(exact, 2), ra = sig(a, 1), rb = sig(b, 1);
    return {
      text: "No paper allowed — which is closest?", big: `${num(a)} × ${b}`, answer: `≈ ${num(est)}`,
      pool: [est * 10, est / 10, sig(exact * 1.45, 2), sig(exact * 0.6, 2), sig(exact * 2, 2)].map((v) => `≈ ${num(v)}`),
      how: `Round to one digit: ${num(ra)} × ${rb} = ${num(ra * rb)} — the only choice in that neighborhood is ≈ ${num(est)}. (Exactly ${num(exact)}.)`,
    };
  });

  add("math", "ratio", 2, (L, R) => {
    if (L <= 4) {
      const unit = R.pick([4.25, 5.5, 6.75, 7.2, 3.8, 5.9, 6.4]), n1 = R.ri(2, 6), n2 = R.ri(7, 15), c1 = unit * n1, c2 = unit * n2;
      return {
        text: `${n1} gallons of 100LL cost ${money(c1)}. At the same price, what do ${n2} gallons cost?`, answer: money(c2),
        pool: [c2 + unit, c2 - unit, c1 + n2, c1 * (n2 - n1), c2 + 10].filter((v) => v > 0).map(money),
        how: `One gallon is ${money(c1)} ÷ ${n1} = ${money(unit)}; × ${n2} = ${money(c2)}.`,
      };
    }
    if (L <= 7) {
      const S = R.pick([12, 24, 32, 48, 72]), m = R.ri(6, 30), ft = (m * S) / 12;
      return {
        text: `A 1:${S} scale model of a ship is ${m} inches long. How long is the real ship?`, answer: `${num(ft, 1)} ft`,
        pool: [m * S, ft / 2, ft * 2, (m * S) / 10, ft + 12].map((v) => `${num(v, 1)} ft`),
        how: `Real size is ${S} times bigger: ${m} × ${S} = ${num(m * S)} inches; ÷ 12 = ${num(ft, 1)} ft.`,
      };
    }
    for (;;) {
      const w1 = R.ri(3, 12), h1 = R.ri(4, 20), w2 = R.ri(2, 15);
      if (w2 === w1 || (w1 * h1) % w2) continue;
      const h2 = (w1 * h1) / w2;
      return {
        text: `${w1} builders can rivet a wing in ${h1} hours. Working at the same pace, how long would ${w2} builders take?`, answer: `${num(h2)} h`,
        pool: [(h1 * w2) / w1, h1 + (w1 - w2), h1, h2 + 2, Math.max(1, h2 - 2)].filter((v) => v > 0).map((v) => `${num(Math.round(v * 10) / 10, 1)} h`),
        how: `Total work is ${w1} × ${h1} = ${w1 * h1} builder-hours. ÷ ${w2} builders = ${num(h2)} h. Fewer builders means longer, not shorter.`,
      };
    }
  });

  add("math", "average", 2, (L, R) => {
    if (L <= 4) {
      const n = R.ri(4, 5), m = R.ri(10, 90), xs = Array.from({ length: n - 1 }, () => m + R.ri(-15, 15));
      xs.push(m * n - xs.reduce((s, x) => s + x, 0));
      if (xs[n - 1] < 1) xs[n - 1] = m;
      const avg = xs.reduce((s, x) => s + x, 0) / n;
      const sorted = xs.slice().sort((a, b) => a - b);
      return {
        text: "What's the average (mean)?", big: xs.join(", "), answer: num(avg, 1),
        pool: [avg + 1, avg - 1, avg + 2, sorted[Math.floor(n / 2)], (sorted[0] + sorted[n - 1]) / 2].map((v) => num(v, 1)),
        how: `Add them: ${num(xs.reduce((s, x) => s + x, 0))}; ÷ ${n} = ${num(avg, 1)}.`,
      };
    }
    if (L <= 6 && R.chance(0.5)) {
      const n = R.pick([5, 7]), xs = Array.from({ length: n }, () => R.ri(1, 60)), s = xs.slice().sort((a, b) => a - b), med = s[(n - 1) / 2];
      const mean = xs.reduce((a, b) => a + b, 0) / n;
      return {
        text: "What's the median (middle value)?", big: xs.join(", "), answer: num(med),
        pool: [xs[(n - 1) / 2], Math.round(mean), s[(n - 1) / 2 + 1], s[(n - 1) / 2 - 1], s[n - 1] - s[0]].map((v) => num(v)),
        how: `Sort them: ${s.join(", ")}. The middle one is ${med}.`,
      };
    }
    for (;;) {
      const n = R.ri(3, 5), T = R.ri(80, 92), xs = Array.from({ length: n }, () => R.ri(70, 98));
      const need = T * (n + 1) - xs.reduce((a, b) => a + b, 0);
      if (need < 60 || need > 100) continue;
      return {
        text: `Your checkride written scores so far: ${xs.join(", ")}. What do you need on the next test to average exactly ${T}?`, answer: num(need),
        pool: [T, need + 2, need - 2, need + 5, T * 2 - xs[xs.length - 1]].filter((v) => v > 0 && v <= 100).map((v) => num(v)),
        how: `${n + 1} tests at ${T} = ${T * (n + 1)} points total. You have ${xs.reduce((a, b) => a + b, 0)}, so you need ${T * (n + 1)} − ${xs.reduce((a, b) => a + b, 0)} = ${need}.`,
      };
    }
  });

  add("math", "together", 6, (L, R) => {
    const pairs = [[3, 6], [4, 12], [6, 12], [10, 15], [12, 24], [20, 30], [15, 30], [12, 36], [20, 60], [30, 45], [24, 40]];
    const [a, b] = R.pick(pairs), t = (a * b) / (a + b);
    if (L >= 9 && R.chance(0.5)) {
      // one fills, one drains
      const [f, d] = [a, b].sort((x, y) => x - y), tt = (f * d) / (d - f);
      return {
        text: `A hose fills a tank in ${f} minutes, but a leak would empty the full tank in ${d} minutes. With both going, how long to fill it?`, answer: dur(tt),
        pool: [d - f, f + d, (f * d) / (f + d), f * 2, tt + 10].map(dur),
        how: `Each minute the hose adds 1/${f} and the leak takes 1/${d}. Net 1/${f} − 1/${d} = 1/${num(tt, 1)}, so ${dur(tt)}.`,
      };
    }
    return {
      text: `Fuel pump A can fill a tank in ${a} minutes; pump B takes ${b} minutes. Running both, how long?`, answer: dur(t),
      pool: [(a + b) / 2, a + b, a / 2, Math.min(a, b) - 1, t + 5].filter((v) => v > 0).map(dur),
      how: `Rates add: 1/${a} + 1/${b} = 1/${num(t, 1)} of a tank per minute. So it takes ${a} × ${b} ÷ (${a} + ${b}) = ${dur(t)}.`,
    };
  });

  add("math", "powers", 3, (L, R) => {
    if (L <= 5) {
      const base = R.pick([2, 2, 3, 5]), n = base === 2 ? R.ri(5, 12) : base === 3 ? R.ri(3, 7) : R.ri(3, 5), v = base ** n;
      return {
        text: "Work it out:", big: `${base}${sup(n)}`, answer: num(v),
        pool: [base ** (n + 1), base ** (n - 1), base * n, n ** base, v + base].map((x) => num(x)),
        how: `${base} multiplied by itself ${n} times = ${num(v)}.${base === 2 ? " (2¹⁰ = 1,024 is a handy one to know.)" : ""}`,
      };
    }
    const a = R.ri(2, 9), b = R.ri(2, 9), p = R.ri(-4, 6) || 3, q = R.ri(-5, 5) || -2;
    let c = a * b, e = p + q; if (c >= 10) { c /= 10; e += 1; }
    const sci = (m, x) => `${num(m, 2)} × 10${sup(x)}`;
    if (L >= 8 && R.chance(0.5)) {
      const prod = a * b; // divide prod×10^(p+q) by b×10^q
      return {
        text: "Work it out (scientific notation):", big: `(${num(prod)} × 10${sup(p + q)}) ÷ (${b} × 10${sup(q)})`, answer: sci(a, p),
        pool: [sci(a, p + 2 * q), sci(a, p + 1), sci(a, p - 1), sci(b, p), sci(a, q)].map(String),
        how: `Divide the numbers: ${prod} ÷ ${b} = ${a}. Subtract the powers: ${p + q} − (${q}) = ${p}. Answer ${sci(a, p)}.`,
      };
    }
    return {
      text: "Work it out (scientific notation):", big: `(${a} × 10${sup(p)}) × (${b} × 10${sup(q)})`, answer: sci(c, e),
      pool: [sci(c, p * q === e ? e + 2 : p * q), sci(c, e + 1), sci(c, e - 1), sci(a + b, e), sci(c, e + 2)],
      how: `Multiply the numbers: ${a} × ${b} = ${a * b}. Add the powers: ${p} + ${q} = ${p + q}.${a * b >= 10 ? ` ${a * b} = ${num(c, 2)} × 10, so the power goes up one.` : ""} Answer ${sci(c, e)}.`,
    };
  });

  add("math", "netpct", 5, (L, R) => {
    const p1 = R.pick([10, 20, 25, 50]) * (R.chance(0.6) ? 1 : -1), p2 = R.pick([10, 20, 25, 40, 50]) * (R.chance(0.5) ? 1 : -1);
    const net = ((1 + p1 / 100) * (1 + p2 / 100) - 1) * 100;
    const word = (v) => (Math.abs(v) < 1e-9 ? "No change" : v > 0 ? `Up ${num(v, 2)}%` : `Down ${num(-v, 2)}%`);
    const say = (v) => (v > 0 ? `goes up ${v}%` : `drops ${-v}%`);
    return {
      text: `The price of avgas ${say(p1)}, then ${say(p2)}. What's the overall change?`, answer: word(net),
      pool: [word(p1 + p2), word(-net), word(net + 5), word(net - 5), "No change", word(p1 * p2 / 100)],
      how: `Multiply the factors: ${num(1 + p1 / 100, 2)} × ${num(1 + p2 / 100, 2)} = ${num(1 + net / 100, 4)}, so ${word(net).toLowerCase()}. Percents don't simply add, because the second change applies to the new price.`,
    };
  });

  add("math", "divis", 3, (L, R) => {
    const rules = [
      { d: 3, rule: "the digits add up to a multiple of 3" }, { d: 9, rule: "the digits add up to a multiple of 9" },
      { d: 4, rule: "the last two digits make a multiple of 4" }, { d: 6, rule: "it's even and divisible by 3" },
    ];
    if (L >= 6) rules.push({ d: 8, rule: "the last three digits make a multiple of 8" }, { d: 11, rule: "the alternating digit sum (+ − + …) is a multiple of 11" });
    const { d, rule } = R.pick(rules), lo = L >= 6 ? 1000 : 100, hi = L >= 6 ? 9999 : 999;
    let good = R.ri(Math.ceil(lo / d), Math.floor(hi / d)) * d;
    const bad = new Set();
    while (bad.size < 5) { const v = R.ri(lo, hi); if (v % d) bad.add(v); }
    return {
      text: `Which of these is divisible by ${d}?`, answer: num(good), pool: [...bad].map((v) => num(v)),
      how: `A number divides by ${d} when ${rule}. ${num(good)} ÷ ${d} = ${num(good / d)}.`,
    };
  });

  add("math", "clock", 6, (L, R) => {
    const h = R.ri(1, 12), m = L <= 7 ? R.ri(0, 11) * 5 : R.ri(1, 59);
    let a = Math.abs(30 * (h % 12) - 5.5 * m); if (a > 180) a = 360 - a;
    let wrong = Math.abs(30 * (h % 12) - 6 * m); if (wrong > 180) wrong = 360 - wrong;
    return {
      text: `What's the smaller angle between the hour and minute hands at ${h}:${String(m).padStart(2, "0")}?`, answer: `${num(a, 1)}°`,
      pool: [wrong, 360 - a, a + 15, Math.abs(a - 15), a + 30].map((v) => `${num(v, 1)}°`),
      how: `Minute hand: ${m} × 6° = ${6 * m}°. Hour hand: ${h % 12} × 30° + ${m} × 0.5° = ${num(30 * (h % 12) + 0.5 * m, 1)}° (it creeps forward as the minutes pass). Difference: ${num(a, 1)}°.`,
    };
  });

  add("math", "odds", 5, (L, R) => {
    const kinds = ["dice", "coins"]; if (L >= 7) kinds.push("atleast"); if (L >= 9) kinds.push("cards");
    const k = R.pick(kinds);
    if (k === "dice") {
      const s = R.ri(3, 11), ways = 6 - Math.abs(s - 7);
      return {
        text: `Roll two dice. What are the chances they add up to ${s}?`, answer: fracStr(ways, 36),
        pool: [fracStr(1, 11), fracStr(ways + 1, 36), fracStr(ways, 12), fracStr(Math.max(1, ways - 1), 36), fracStr(1, 6)],
        how: `There are 36 equally likely rolls. ${ways} of them total ${s}, so ${ways}/36 = ${fracStr(ways, 36)}.`,
      };
    }
    if (k === "coins") {
      const n = R.ri(3, 5), h = R.ri(0, n), C = (a, b) => { let r = 1; for (let i = 1; i <= b; i++) r = (r * (a - b + i)) / i; return r; }, ways = C(n, h);
      return {
        text: `Flip a coin ${n} times. What are the chances of exactly ${h} head${h === 1 ? "" : "s"}?`, answer: fracStr(ways, 2 ** n),
        pool: [fracStr(1, n + 1), fracStr(1, 2 ** n), fracStr(h || 1, n), fracStr(ways + 1, 2 ** n), fracStr(1, 2)],
        how: `${n} flips make ${2 ** n} equally likely outcomes. ${ways} of them have exactly ${h} heads, so ${ways}/${2 ** n} = ${fracStr(ways, 2 ** n)}.`,
      };
    }
    if (k === "atleast") {
      const n = R.ri(2, 3), miss = 5 ** n, all = 6 ** n;
      return {
        text: `Roll one die ${n} times. What are the chances of at least one six?`, answer: fracStr(all - miss, all),
        pool: [fracStr(n, 6), fracStr(1, 6), fracStr(miss, all), fracStr(1, 6 ** n), fracStr(n, 36)],
        how: `Easier backwards: no six on any roll is (5/6)${sup(n)} = ${miss}/${all}. So at least one six = 1 − ${miss}/${all} = ${fracStr(all - miss, all)}.`,
      };
    }
    return {
      text: "Draw 2 cards from a full 52-card deck. What are the chances both are aces?", answer: fracStr(12, 2652),
      pool: [fracStr(1, 169), fracStr(2, 52), fracStr(1, 13), fracStr(4, 2652), fracStr(1, 26)],
      how: "First ace: 4/52. Then 3 aces are left in 51 cards: 3/51. Multiply: 12/2,652 = 1/221.",
    };
  });

  add("math", "algebra", 4, (L, R) => {
    if (L <= 6) {
      const x = R.ri(-9, 15), a = R.ri(2, 9), b = R.ri(-20, 30), c = a * x + b;
      const bs = b >= 0 ? `+ ${b}` : `− ${-b}`;
      return {
        text: "Solve for x:", big: `${a}x ${bs} = ${c}`, answer: `x = ${x}`,
        pool: [(c + b) / a, x + 1, x - 1, c - b, -x].filter((v) => Number.isInteger(v)).map((v) => `x = ${v}`),
        how: `${b >= 0 ? `Take ${b} from` : `Add ${-b} to`} both sides: ${a}x = ${c - b}. Divide by ${a}: x = ${x}.`,
      };
    }
    if (L <= 8) {
      const x = R.ri(2, 20), y = R.ri(1, 15), a = R.ri(1, 4), b = R.ri(1, 4), s = a * x + b * y, d = x - y;
      return {
        text: "Find x:", mono: [`${a === 1 ? "" : a}x + ${b === 1 ? "" : b}y = ${s}`, `x − y = ${d}`], answer: `x = ${x}`,
        pool: [y, x + 1, x - 1, x + d, s - d].filter((v) => v !== x).map((v) => `x = ${v}`),
        how: `From the second line, y = x − ${d}. Put that in the first: ${a}x + ${b}(x − ${d}) = ${s} → ${a + b}x = ${s + b * d} → x = ${x} (and y = ${y}).`,
      };
    }
    for (;;) {
      const x = R.ri(-8, 12), a = R.ri(3, 9), c = R.ri(1, a - 1), b = R.ri(1, 25), d = a * x - b - c * x;
      if (a === c) continue;
      const ds = d >= 0 ? `+ ${d}` : `− ${-d}`;
      return {
        text: "Solve for x:", big: `${a}x − ${b} = ${c}x ${ds}`, answer: `x = ${x}`,
        pool: [(d - b) / (a - c), (d + b) / (a + c), x + 1, x - 1, -x].filter((v) => Number.isInteger(v)).map((v) => `x = ${v}`),
        how: `Get the x's on one side: ${a}x − ${c}x = ${d} + ${b} → ${a - c}x = ${d + b} → x = ${x}.`,
      };
    }
  });

  add("math", "binary", 4, (L, R) => {
    if (L <= 6) {
      const v = R.ri(9, L <= 5 ? 63 : 255), b = v.toString(2);
      return {
        text: "What is this binary number in decimal?", big: b, answer: num(v),
        pool: [v + 1, v - 1, v + 2, parseInt(b.split("").reverse().join(""), 2), v + 8].filter((x) => x !== v).map((x) => num(x)),
        how: `Place values from the right: 1, 2, 4, 8, 16, 32… Add the ones with a 1: ${b.split("").reverse().map((c, i) => (c === "1" ? 2 ** i : 0)).filter(Boolean).reverse().join(" + ")} = ${v}.`,
      };
    }
    if (R.chance(0.5)) {
      const v = R.ri(16, 255), h = v.toString(16).toUpperCase();
      return {
        text: "What is this hexadecimal number in decimal? (VBA writes it &H…)", big: h, answer: num(v),
        pool: [parseInt(h, 10) || v + 6, v + 16, v - 16, parseInt(h.split("").reverse().join(""), 16), v + 1].filter((x) => x !== v).map((x) => num(x)),
        how: `First digit × 16 plus second digit: ${h[0]} = ${parseInt(h[0], 16)}, ${h[1] || 0} = ${parseInt(h[1] || "0", 16)}. ${parseInt(h[0], 16)} × 16 + ${parseInt(h[1] || "0", 16)} = ${v}.`,
      };
    }
    const v = R.ri(20, 120), b = v.toString(2);
    const flip = (i) => b.slice(0, i) + (b[i] === "1" ? "0" : "1") + b.slice(i + 1);
    return {
      text: `What is ${v} in binary?`, answer: b,
      pool: [flip(b.length - 1), flip(b.length - 2), flip(1), (v * 2).toString(2), b.split("").reverse().join("")],
      how: `Take off the biggest powers of 2: ${b.split("").reverse().map((c, i) => (c === "1" ? 2 ** i : 0)).filter(Boolean).reverse().join(" + ")} = ${v}, giving ${b}.`,
    };
  });

  add("math", "sheet2", 5, (L, R) => {
    const kinds = [];
    const xs = Array.from({ length: 5 }, () => R.ri(1, 30)), lim = R.ri(8, 22);
    kinds.push(() => {
      const ans = xs.filter((v) => v > lim).length;
      return { lines: xs.map((v, i) => [`A${i + 1}`, v]).concat([["B1", `=COUNTIF(A1:A5,">${lim}")`]]), ask: "B1", ans,
        pool: [xs.filter((v) => v >= lim).length + (xs.includes(lim) ? 0 : 1), 5 - ans, xs.filter((v) => v > lim).reduce((a, b) => a + b, 0), ans + 1, ans + 2],
        how: `COUNTIF counts the cells over ${lim}: ${xs.filter((v) => v > lim).join(", ") || "none"} → ${ans}.` };
    });
    const v = R.ri(10, 99) + R.ri(1, 9) / 10, d = R.pick([3, 4, 6, 7]), q = v / d;
    kinds.push(() => {
      const ans = Math.ceil(q);
      return { lines: [["A1", num(v, 1)], ["A2", d], ["A3", "=ROUNDUP(A1/A2,0)"]], ask: "A3", ans,
        pool: [Math.floor(q), Math.round(q) === ans ? ans + 1 : Math.round(q), ans + 1, Math.ceil(d / v * 100)],
        how: `${num(v, 1)} ÷ ${d} = ${q.toFixed(3)}…; ROUNDUP always goes up: ${ans}.` };
    });
    if (L >= 7) {
      const q1 = [R.ri(2, 9), R.ri(2, 9), R.ri(2, 9)], p1 = [R.ri(3, 12), R.ri(3, 12), R.ri(3, 12)];
      kinds.push(() => {
        const ans = q1.reduce((s, x, i) => s + x * p1[i], 0);
        return { lines: [0, 1, 2].map((i) => [`A${i + 1}`, `${q1[i]}    B${i + 1}  ${p1[i]}`]).concat([["C1", "=SUMPRODUCT(A1:A3,B1:B3)"]]), ask: "C1", ans,
          pool: [q1.reduce((a, b) => a + b, 0) * p1.reduce((a, b) => a + b, 0), q1.reduce((a, b) => a + b, 0) + p1.reduce((a, b) => a + b, 0), ans + q1[0], ans - p1[2], ans + 10],
          how: `SUMPRODUCT multiplies row by row and adds: ${q1.map((x, i) => `${x}×${p1[i]}`).join(" + ")} = ${ans}.` };
      });
      const codes = ["KTUS", "KPHX", "KFLG", "KPRC"], prices = codes.map(() => R.ri(55, 79) / 10), pickI = R.ri(0, 3);
      kinds.push(() => ({
        lines: codes.map((c, i) => [`A${i + 1}`, `${c}   B${i + 1}  ${prices[i].toFixed(2)}`]).concat([["C1", `=VLOOKUP("${codes[pickI]}",A1:B4,2,FALSE)`]]),
        ask: "C1", ans: prices[pickI], dp: 2,
        pool: [prices[(pickI + 1) % 4], prices[(pickI + 3) % 4], prices[(pickI + 2) % 4], pickI + 1, 2],
        how: `VLOOKUP finds "${codes[pickI]}" in column A and returns column 2 of that row: ${prices[pickI].toFixed(2)}.` }));
      const a = R.ri(1, 40), b = R.ri(1, 40);
      kinds.push(() => {
        const ans = a > 10 && b > 10 ? a + b : a > 10 || b > 10 ? Math.max(a, b) : 0;
        return { lines: [["A1", a], ["A2", b], ["A3", "=IF(AND(A1>10,A2>10),A1+A2,IF(OR(A1>10,A2>10),MAX(A1,A2),0))"]], ask: "A3", ans,
          pool: [a + b, Math.max(a, b), Math.min(a, b), 0, a * b, ans + 10],
          how: `AND(A1>10, A2>10) is ${a > 10 && b > 10 ? "TRUE → A1+A2" : `FALSE; OR(…) is ${a > 10 || b > 10 ? "TRUE → MAX" : "FALSE → 0"}`} = ${ans}.` };
      });
    }
    if (L >= 9) {
      const n = -(R.ri(10, 99) + R.ri(1, 9) / 10);
      kinds.push(() => ({ lines: [["A1", num(n, 1)], ["A2", "=INT(A1)+TRUNC(A1)"]], ask: "A2", ans: Math.floor(n) + Math.trunc(n),
        pool: [Math.trunc(n) * 2, Math.floor(n) * 2, Math.round(n) * 2, Math.trunc(n) * 2 + 1],
        how: `INT rounds down (toward minus infinity): INT(${num(n, 1)}) = ${Math.floor(n)}. TRUNC just chops the decimal: ${Math.trunc(n)}. Sum ${Math.floor(n) + Math.trunc(n)}.` }));
    }
    const k = R.pick(kinds)();
    const f = (x) => (k.dp ? fixed(x, k.dp) : num(x));
    return { text: `In a spreadsheet, what does ${k.ask} show?`, mono: k.lines.map(([c, x]) => `${c.padEnd(3)} ${x}`), answer: f(k.ans), pool: k.pool.map(f), how: k.how };
  });

  add("math", "area", 3, (L, R) => {
    if (L <= 5) {
      const w = R.ri(30, 60), d = R.ri(30, 50), cov = R.pick([200, 250, 300]), area = w * d, gal = Math.ceil(area / cov);
      return {
        text: `Your hangar floor is ${w} × ${d} ft. One gallon of epoxy covers ${cov} sq ft. How many whole gallons do you buy?`, answer: `${gal} gal`,
        pool: [Math.floor(area / cov), gal + 1, Math.ceil((2 * (w + d)) / cov) + 1, gal * 2, Math.ceil(area / 100)].filter((v) => v > 0).map((v) => `${v} gal`),
        how: `Area = ${w} × ${d} = ${num(area)} sq ft. ÷ ${cov} = ${num(area / cov, 2)} gallons, so buy ${gal}.`,
      };
    }
    const r = R.ri(4, 15), h = R.ri(10, 40);
    if (R.chance(0.5)) {
      const c = 2 * Math.PI * r;
      return {
        text: `How much edge trim goes around a round table top ${2 * r} in across?`, answer: `${num(c, 1)} in`,
        pool: [Math.PI * r * r, Math.PI * r, 4 * 2 * r, c + 6, 3 * 2 * r].map((v) => `${num(v, 1)} in`),
        how: `Circumference = π × diameter = 3.1416 × ${2 * r} = ${num(c, 1)} in.`,
      };
    }
    const vol = Math.PI * r * r * h, gal = vol / 231;
    return {
      text: `A round tank is ${2 * r} in across and ${h} in tall. About how many gallons does it hold? (231 cubic inches per gallon)`, answer: `${num(gal, 1)} gal`,
      pool: [(Math.PI * 4 * r * r * h) / 231, (2 * r * 2 * r * h) / 231, gal * 0.5, gal + 5, vol / 1000].map((v) => `${num(v, 1)} gal`),
      how: `Volume = π × radius² × height = 3.1416 × ${r}² × ${h} = ${num(vol)} cu in. ÷ 231 = ${num(gal, 1)} gal. (Use the radius, ${r} in, not the diameter.)`,
    };
  });

  // =====================================================================
  // MORE NAVIGATION
  // =====================================================================
  add("nav", "windtri", 5, (L, R) => {
    for (;;) {
      const tc = R.ri(1, 360), tas = R.ri(20, 36) * 5, s = R.ri(2, 7) * 5;
      const off = R.ri(20, 160) * (R.chance(0.5) ? 1 : -1), wd = wrap360(tc + off);
      const xw = s * sinD(off), hw = s * cosD(off), wca = Math.asin(xw / tas) * 180 / Math.PI, w = Math.round(wca);
      const gs = Math.round(tas * cosD(wca) - hw);
      if (Math.abs(w) < 3) continue;
      const side = w > 0 ? "right" : "left", other = w > 0 ? "left" : "right";
      const k = L >= 8 ? R.pick(["wca", "gs", "th"]) : R.pick(["wca", "gs"]);
      const intro = `True course ${hdg(tc)}°, true airspeed ${tas} kt, wind ${hdg(wd)}° at ${s} kt.`;
      const how = `Crosswind = ${s} × sin ${Math.abs(off)}° ≈ ${num(Math.abs(xw), 1)} kt from the ${side}; ${hw >= 0 ? "headwind" : "tailwind"} ≈ ${num(Math.abs(hw), 1)} kt. Wind correction ≈ crosswind × 60 ÷ TAS ≈ ${Math.abs(w)}° ${side}. Groundspeed ≈ ${tas} ${hw >= 0 ? "−" : "+"} ${num(Math.abs(hw), 0)} ≈ ${gs} kt.`;
      if (k === "wca") return { text: `${intro} How much wind correction?`, answer: `${Math.abs(w)}° ${side}`,
        pool: [`${Math.abs(w)}° ${other}`, `${Math.abs(w) + 4}° ${side}`, `${Math.max(1, Math.abs(w) - 4)}° ${side}`, `${Math.round(Math.abs(xw))}° ${side}`, `${Math.abs(w) * 2}° ${side}`], how };
      if (k === "gs") return { text: `${intro} About what groundspeed?`, answer: `${gs} kt`,
        pool: [tas, Math.round(tas + hw), gs + 8, gs - 8, tas - s].map((v) => `${v} kt`), how };
      return { text: `${intro} What true heading do you fly?`, answer: hdg(tc + w) + "°",
        pool: [tc - w, tc, tc + 2 * w, tc + w + 5, wd].map((v) => hdg(v) + "°"), how: how + ` True heading = ${hdg(tc)} ${w > 0 ? "+" : "−"} ${Math.abs(w)} = ${hdg(tc + w)}°.` };
    }
  });

  add("nav", "hold", 6, (L, R) => {
    const pts = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
    for (;;) {
      const I = L <= 7 ? R.ri(1, 36) * 10 : R.ri(1, 360), right = L <= 7 ? true : R.chance(0.7), H = R.ri(1, 360);
      let p = wrap360(H + 180 - I); if (!right) p = wrap360(360 - p);
      if ([0, 110, 290, 360].some((b) => Math.abs(p - b) < 10)) continue;
      const entry = p >= 110 && p <= 290 ? "Direct" : p > 290 ? "Teardrop" : "Parallel";
      let where;
      if (L >= 8) {
        const radial = wrap360(I + 180), side = pts[Math.round(radial / 45) % 8];
        where = `Hold ${side} of the VOR on the ${hdg(radial)}° radial, ${right ? "standard (right)" : "left"} turns.`;
      } else where = `Holding inbound course ${hdg(I)}° to the fix, right turns.`;
      return {
        text: `${where} You're flying heading ${hdg(H)}° to the fix. Which entry?`, answer: entry,
        pool: ["Direct", "Teardrop", "Parallel", "No entry turn needed"],
        how: `${L >= 8 ? `The inbound course is the radial's opposite: ${hdg(I)}°. ` : ""}Draw the 70° line through the fix. Arriving from the holding side beyond the fix (a 110° slice) = parallel; from the non-holding side beyond the fix (a 70° slice) = teardrop; anywhere else (180°) = direct. Heading ${hdg(H)}° puts you in the ${entry.toLowerCase()} slice.`,
      };
    }
  });

  add("nav", "vor", 3, (L, R) => {
    const radial = L >= 5 ? R.ri(1, 360) : R.ri(1, 36) * 10;
    const k = R.pick(["to", "to-flag", "from-flag"]);
    if (k === "to") return {
      text: `You're on the ${hdg(radial)}° radial. What course do you fly direct TO the station?`, answer: hdg(radial + 180) + "°",
      pool: [radial, radial + 90, radial - 90, radial + 170].map((v) => hdg(v) + "°"),
      how: `Radials point away from the station. To fly back in, use the opposite: ${hdg(radial)} ± 180 = ${hdg(radial + 180)}°.`,
    };
    const obs = radial, to = k === "to-flag", on = to ? obs + 180 : obs;
    return {
      text: `OBS set to ${hdg(obs)}°, needle centered, ${to ? "TO" : "FROM"} flag. Which radial are you on?`, answer: hdg(on) + "°",
      pool: [to ? obs : obs + 180, obs + 90, obs - 90, on + 10].map((v) => hdg(v) + "°"),
      how: to ? `With a TO flag, you're on the opposite radial of the OBS setting: ${hdg(obs)} ± 180 = ${hdg(on)}°.` : `With a FROM flag and the needle centered, you're on the radial the OBS shows: ${hdg(obs)}°.`,
    };
  });

  const VFRMIN = [
    ["Class B airspace", "3 SM; clear of clouds"],
    ["Class C or D airspace", "3 SM; 500 below, 1,000 above, 2,000 horizontal"],
    ["Class E airspace below 10,000 ft MSL", "3 SM; 500 below, 1,000 above, 2,000 horizontal"],
    ["Class E airspace at or above 10,000 ft MSL", "5 SM; 1,000 below, 1,000 above, 1 SM horizontal"],
    ["Class G, daytime, 1,200 ft AGL or lower", "1 SM; clear of clouds"],
  ];
  const REGS = [
    ["VFR fuel reserve for a daytime flight (Part 91)?", "30 minutes at normal cruise", ["45 minutes at normal cruise", "1 hour at normal cruise", "20 minutes at normal cruise"]],
    ["VFR fuel reserve at night (Part 91)?", "45 minutes at normal cruise", ["30 minutes at normal cruise", "1 hour at normal cruise", "60 minutes plus alternate"]],
    ["Above what cabin altitude must the required crew use oxygen the whole time?", "14,000 ft MSL", ["12,500 ft MSL", "15,000 ft MSL", "10,000 ft MSL"]],
    ["Above what cabin altitude must every passenger be offered oxygen?", "15,000 ft MSL", ["14,000 ft MSL", "12,500 ft MSL", "18,000 ft MSL"]],
    ["Crew must use oxygen after how long between 12,500 and 14,000 ft MSL?", "More than 30 minutes", ["More than 15 minutes", "More than 1 hour", "Any time at all"]],
    ["Transponder code for lost communications?", "7600", ["7700", "7500", "1200"]],
    ["Transponder code for an emergency?", "7700", ["7600", "7500", "7000"]],
    ["Transponder code for unlawful interference (hijack)?", "7500", ["7700", "7600", "7400"]],
    ["Standard VFR transponder code in the US?", "1200", ["7000", "2000", "1400"]],
  ];
  const GUN = {
    ground: { "Steady green": "Cleared for takeoff", "Flashing green": "Cleared to taxi", "Steady red": "Stop", "Flashing red": "Taxi clear of the runway in use", "Flashing white": "Return to starting point on the airport", "Alternating red and green": "Exercise extreme caution" },
    air: { "Steady green": "Cleared to land", "Flashing green": "Return for landing", "Steady red": "Give way to other aircraft and keep circling", "Flashing red": "Airport unsafe — do not land", "Alternating red and green": "Exercise extreme caution" },
  };
  add("nav", "regs", 2, (L, R) => {
    const k = L <= 3 ? R.pick(["gun", "regs"]) : R.pick(["gun", "regs", "vfrmin", "vfrmin"]);
    if (k === "vfrmin") {
      const [where, ans] = R.pick(VFRMIN);
      return { text: `VFR weather minimums in ${where}: visibility and cloud clearance?`, answer: ans,
        pool: [...new Set(VFRMIN.map((x) => x[1]))].concat(["3 SM; 1,000 below, 1,000 above, 1 SM horizontal", "1 SM; 500 below, 1,000 above, 2,000 horizontal"]),
        how: `${where}: ${ans} (14 CFR 91.155).` };
    }
    if (k === "regs") {
      const [q, a, w] = R.pick(REGS);
      return { text: q, answer: a, pool: w, how: `${a}.${/oxygen/.test(q) ? " (14 CFR 91.211)" : /fuel/.test(q) ? " (14 CFR 91.151)" : ""}` };
    }
    const where = R.chance(0.5) ? "ground" : "air", sig = R.pick(Object.keys(GUN[where])), ans = GUN[where][sig];
    return {
      text: `${where === "ground" ? "You're on the ground" : "You're in the air"} and the tower flashes a light gun at you: ${sig.toLowerCase()}. What does it mean?`, answer: ans,
      pool: Object.values(GUN[where]).concat(Object.values(GUN[where === "ground" ? "air" : "ground"])),
      how: `${sig} ${where === "ground" ? "on the ground" : "in the air"} = "${ans}" (14 CFR 91.125). The same color can mean something different on the ground and in the air.`,
    };
  });

  add("nav", "cruisealt", 3, (L, R) => {
    const mc = R.ri(1, 359), east = mc < 180, base = R.ri(4, 15), ifr = L >= 6 && R.chance(0.5);
    const odd = (n) => (n % 2 ? n : n + 1), even = (n) => (n % 2 ? n + 1 : n);
    const th = east ? odd(base) : even(base), wth = east ? even(base) : odd(base);
    const ans = ifr ? th * 1000 : th * 1000 + 500;
    const f = (v) => `${num(v)} ft`;
    return {
      text: `${ifr ? "IFR, picking your own altitude" : "VFR (more than 3,000 ft above the ground)"}, magnetic course ${hdg(mc)}°, wanting to cruise near ${num(base * 1000)} ft. Which altitude is legal?`, answer: f(ans),
      pool: ifr ? [wth * 1000, th * 1000 + 500, wth * 1000 + 500, (wth + 2) * 1000].map(f) : [wth * 1000 + 500, th * 1000, wth * 1000, (wth + 2) * 1000 + 500].map(f),
      how: `${hdg(mc)}° is ${east ? "0–179° (eastbound): odd" : "180–359° (westbound): even"} thousands${ifr ? "" : " plus 500 for VFR"}. "East is odd, west is even." So ${f(ans)}. (14 CFR 91.159 / 91.179)`,
    };
  });

  add("nav", "glide", 4, (L, R) => {
    const ratio = R.pick([8, 9, 10, 11, 12]), h = R.ri(4, 20) * 500, nm = Math.round((h * ratio) / 6076);
    return {
      text: `Engine quits ${num(h)} ft above the ground. Your glide ratio is ${ratio}:1. About how far can you glide?`, answer: `${nm} nm`,
      pool: [Math.round((h * ratio) / 1000), Math.round(h / 1000), nm * 2, Math.max(1, Math.round(nm / 2)), nm + 4].map((v) => `${v} nm`),
      how: `${num(h)} ft × ${ratio} = ${num(h * ratio)} ft of distance. A nautical mile is about 6,076 ft: ${num(h * ratio)} ÷ 6,076 ≈ ${nm} nm.`,
    };
  });

  add("nav", "tas", 5, (L, R) => {
    const ias = R.ri(20, 34) * 5, k = R.ri(2, 12), tas = Math.round(ias * (1 + 0.02 * k));
    return {
      text: `Indicated ${ias} kt at ${num(k * 1000)} ft. About what's your true airspeed?`, answer: `${tas} kt`,
      pool: [ias, ias + k, Math.round(ias * (1 + 0.05 * k)), tas + 12, Math.round(ias * (1 - 0.02 * k))].map((v) => `${v} kt`),
      how: `Rule of thumb: true airspeed is about 2% higher per 1,000 ft. ${k} × 2% = ${2 * k}%; ${ias} × ${num(1 + 0.02 * k, 2)} ≈ ${tas} kt.`,
    };
  });

  add("nav", "checkpoint", 6, (L, R) => {
    const gs = R.pick([120, 135, 144, 150, 156, 165, 180]), t1 = R.ri(6, 15), d1 = Math.round((gs * t1) / 60);
    const g = (d1 / t1) * 60, d2 = R.ri(25, 90), t2 = Math.round((d2 / g) * 60), pass = R.ri(0, 287) * 5;
    return {
      text: `Checkpoints A to B, ${d1} nm, took ${t1} minutes. You passed B at ${hhmm(pass)}Z. C is ${d2} nm beyond B. ETA at C?`, answer: hhmm(pass + t2) + "Z",
      pool: [pass + t2 + 5, pass + t2 - 5, pass + d2 / 2, pass + t2 + 10, pass + Math.round((d2 / d1) * t1 * 0.8)].map((v) => hhmm(v) + "Z"),
      how: `Groundspeed: ${d1} nm in ${t1} min = ${num(d1 / t1, 2)} nm/min (${Math.round(g)} kt). ${d2} nm ÷ ${num(d1 / t1, 2)} ≈ ${t2} min. ${hhmm(pass)} + ${t2} min = ${hhmm(pass + t2)}Z.`,
    };
  });

  add("nav", "tripfuel", 7, (L, R) => {
    const D = R.ri(15, 45) * 10, tas = R.ri(26, 35) * 5, w = R.ri(2, 6) * 5, head = R.chance(0.65), gph = R.pick([8, 8.5, 9, 9.5, 10, 10.5, 11, 12]);
    const gs = head ? tas - w : tas + w, t = D / gs, fuel = t * gph + 0.75 * gph;
    const f = (v) => `${fixed(v, 1)} gal`;
    return {
      text: `${D} nm trip, TAS ${tas} kt, ${w}-kt ${head ? "headwind" : "tailwind"}, burning ${gph} gal/hr. Fuel needed including a 45-minute reserve?`, answer: f(fuel),
      pool: [(D / tas) * gph + 0.75 * gph, (D / (head ? tas + w : tas - w)) * gph + 0.75 * gph, t * gph, t * gph + 0.5 * gph, fuel + gph].map(f),
      how: `Groundspeed ${tas} ${head ? "−" : "+"} ${w} = ${gs} kt. Time ${D} ÷ ${gs} = ${num(t, 2)} h. Burn ${num(t, 2)} × ${gph} = ${fixed(t * gph, 1)} gal, plus 45 min (${fixed(0.75 * gph, 2)} gal) = ${f(fuel)}.`,
    };
  });

  add("nav", "vdp", 7, (L, R) => {
    const hat = R.ri(15, 50) * 20, nm = hat / 300;
    return {
      text: `Non-precision approach, MDA is ${num(hat)} ft above the touchdown zone. About how far from the threshold is your 3° visual descent point?`, answer: `${num(nm, 1)} nm`,
      pool: [hat / 100, hat / 200, hat / 600, nm + 1, hat / 1000].map((v) => `${num(v, 1)} nm`),
      how: `A 3° path drops about 300 ft per nautical mile. ${num(hat)} ÷ 300 = ${num(nm, 1)} nm.`,
    };
  });

  add("nav", "compass", 4, (L, R) => {
    const items = [
      ["Northern Hemisphere: you accelerate on an east or west heading. The magnetic compass briefly shows…", "A turn toward north", ["A turn toward south", "No change", "A turn toward east"], "ANDS: Accelerate North, Decelerate South."],
      ["Northern Hemisphere: you slow down on an east or west heading. The magnetic compass briefly shows…", "A turn toward south", ["A turn toward north", "No change", "A turn toward west"], "ANDS: Accelerate North, Decelerate South."],
      ["Turning to a north heading by the magnetic compass, when do you roll out?", "Before it reads north (undershoot)", ["After it passes north (overshoot)", "Exactly on north", "When it stops moving"], "UNOS: Undershoot North, Overshoot South (by about the latitude)."],
      ["Turning to a south heading by the magnetic compass, when do you roll out?", "After it passes south (overshoot)", ["Before it reads south (undershoot)", "Exactly on south", "When the card stops swinging"], "UNOS: Undershoot North, Overshoot South (by about the latitude)."],
      ["Starting a turn from a north heading, the magnetic compass first shows…", "A turn the opposite way", ["The correct turn, but faster", "No movement at first", "The correct turn, but slower"], "From north it lags and swings the wrong way at first; from south it leads."],
    ];
    const [q, a, w, h] = R.pick(items);
    return { text: q, answer: a, pool: w, how: h };
  });

  // =====================================================================
  // MORE MECHANICS
  // =====================================================================
  add("mech", "loadfactor", 4, (L, R) => {
    const bank = R.pick(L >= 7 ? [30, 45, 60, 70, 75] : [30, 45, 60]), n = 1 / cosD(bank);
    if (L >= 6 && R.chance(0.6)) {
      const vs = R.ri(9, 14) * 5, v = Math.round(vs * Math.sqrt(n));
      return {
        text: `Stall speed is ${vs} kt in level flight. About what is it in a level ${bank}° bank?`, answer: `${v} kt`,
        pool: [Math.round(vs * n), vs, v + 6, Math.round(vs + bank / 2), Math.max(vs + 1, v - 6)].map((x) => `${x} kt`),
        how: `Load factor in a ${bank}° bank = 1 ÷ cos ${bank}° = ${num(n, 2)} G. Stall speed goes up by the square root: ${vs} × √${num(n, 2)} = ${vs} × ${num(Math.sqrt(n), 2)} ≈ ${v} kt.`,
      };
    }
    return {
      text: `In a level, coordinated ${bank}° bank, what's the load factor?`, answer: `${num(n, 2)} G`,
      pool: [bank / 30, 1 + bank / 100, n * 1.3, 1, Math.sqrt(n)].map((x) => `${num(x, 2)} G`),
      how: `Load factor = 1 ÷ cos(bank) = 1 ÷ ${num(cosD(bank), 3)} = ${num(n, 2)} G.`,
    };
  });

  add("mech", "weightspeed", 6, (L, R) => {
    const W1 = R.ri(20, 30) * 100, W2 = W1 - R.ri(3, 9) * 100, va = R.ri(20, 26) * 5, v2 = Math.round(va * Math.sqrt(W2 / W1));
    const name = R.chance(0.5) ? "Maneuvering speed (Va)" : "Best glide speed";
    return {
      text: `${name} is ${va} KIAS at ${num(W1)} lb gross. About what is it at ${num(W2)} lb?`, answer: `${v2} KIAS`,
      pool: [va, Math.round((va * W2) / W1), Math.round(va * Math.sqrt(W1 / W2)), v2 + 6, v2 - 6].map((x) => `${x} KIAS`),
      how: `It changes with the square root of weight: ${va} × √(${num(W2)} ÷ ${num(W1)}) = ${va} × ${num(Math.sqrt(W2 / W1), 3)} ≈ ${v2} KIAS. Lighter means slower.`,
    };
  });

  add("mech", "cgshift", 6, (L, R) => {
    for (;;) {
      const W = R.ri(14, 26) * 100, cg = R.ri(780, 900) / 10, dw = R.ri(2, 12) * 10, a = R.ri(60, 100), b = a + R.ri(30, 70) * (R.chance(0.5) ? 1 : -1);
      if (b < 30 || b > 160) continue;
      const shift = (dw * (b - a)) / W, ncg = cg + shift;
      if (Math.abs(shift) < 0.4) continue;
      if (L >= 8 && R.chance(0.5)) {
        // adding weight
        const nw = W + dw, ncg2 = (W * cg + dw * b) / nw;
        return {
          text: `Airplane weighs ${num(W)} lb, CG at ${num(cg, 1)} in. You load ${dw} lb of bags at ${b} in. New CG?`, answer: `${num(ncg2, 1)} in`,
          pool: [cg + (dw * b) / W, (cg + b) / 2, cg + (dw * (b - cg)) / W + 1.5, ncg2 - 1.2, cg].map((v) => `${num(v, 1)} in`),
          how: `Moment: ${num(W)} × ${num(cg, 1)} = ${num(W * cg)}; bags ${dw} × ${b} = ${num(dw * b)}. Total ${num(W * cg + dw * b)} ÷ ${num(nw)} lb = ${num(ncg2, 1)} in.`,
        };
      }
      return {
        text: `Airplane weighs ${num(W)} lb with CG at ${num(cg, 1)} in. You move ${dw} lb from station ${a} to station ${b}. New CG?`, answer: `${num(ncg, 1)} in`,
        pool: [cg - shift, cg + shift * 2, cg + (dw * (b - a)) / (W + dw) + 0.6, cg + (b - a) / 10, cg].map((v) => `${num(v, 1)} in`),
        how: `CG change = weight moved × distance ÷ total weight = ${dw} × ${b - a} ÷ ${num(W)} = ${num(shift, 2)} in. ${num(cg, 1)} ${shift >= 0 ? "+" : "−"} ${num(Math.abs(shift), 2)} = ${num(ncg, 1)} in.`,
      };
    }
  });

  add("mech", "rivet", 3, (L, R) => {
    if (L <= 5) {
      const d = R.ri(3, 6), l = R.ri(3, 12), part = `AN470AD${d}-${l}`;
      if (R.chance(0.5)) return {
        text: `What's the shank diameter of an ${part} rivet?`, answer: `${fracStr(d, 32)} in`,
        pool: [fracStr(d, 16), fracStr(d, 8), fracStr(l, 32), fracStr(d + 1, 32)].map((s) => `${s} in`),
        how: `The number after AD is the diameter in 32nds of an inch: ${d}/32 = ${fracStr(d, 32)} in.`,
      };
      return {
        text: `How long is an ${part} rivet?`, answer: `${fracStr(l, 16)} in`,
        pool: [fracStr(l, 32), fracStr(l, 8), fracStr(d, 16), fracStr(l + 1, 16)].map((s) => `${s} in`),
        how: `The dash number is the length in 16ths of an inch: ${l}/16 = ${fracStr(l, 16)} in.`,
      };
    }
    const ts = [0.016, 0.020, 0.025, 0.032, 0.040, 0.050, 0.063], t1 = R.pick(ts), t2 = R.pick(ts), d = R.pick([3, 4, 5]);
    const grip = t1 + t2, need = grip + 1.5 * (d / 32), l = Math.ceil(need * 16 - 1e-9);
    return {
      text: `Riveting ${t1.toFixed(3)} skin to a ${t2.toFixed(3)} rib with a ${fracStr(d, 32)}-in rivet. Grip + 1.5 × diameter, rounded up to the next 1/16: which rivet?`, answer: `AN470AD${d}-${l}`,
      pool: [`AN470AD${d}-${l + 1}`, `AN470AD${d}-${Math.max(2, l - 1)}`, `AN470AD${d}-${Math.max(2, Math.ceil(grip * 16))}`, `AN470AD${d + 1}-${l}`, `AN470AD${d}-${l + 2}`],
      how: `Grip ${t1.toFixed(3)} + ${t2.toFixed(3)} = ${grip.toFixed(3)} in. 1.5 × ${(d / 32).toFixed(4)} = ${(1.5 * d / 32).toFixed(3)}. Total ${need.toFixed(3)} in → next 1/16 is ${l}/16 → -${l}.`,
    };
  });

  add("mech", "tank", 4, (L, R) => {
    const l = R.ri(12, 40), w = R.ri(8, 24), h = R.ri(6, 16), cu = l * w * h, gal = cu / 231;
    if (L >= 7) {
      const lb = gal * 6;
      return {
        text: `A ${l} × ${w} × ${h} in fuel tank is full of avgas. About how much does the fuel weigh?`, answer: `${num(Math.round(lb))} lb`,
        pool: [cu / 1000 * 6, gal * 8.3, gal, lb + 20, (cu / 1728) * 6].map((v) => `${num(Math.round(v))} lb`),
        how: `${l} × ${w} × ${h} = ${num(cu)} cu in ÷ 231 = ${num(gal, 1)} gal × 6 lb/gal ≈ ${num(Math.round(lb))} lb.`,
      };
    }
    return {
      text: `How many gallons fit in a ${l} × ${w} × ${h} in tank? (231 cubic inches per gallon)`, answer: `${num(gal, 1)} gal`,
      pool: [cu / 1728, cu / 100, gal * 2, gal + 3, cu / 277].map((v) => `${num(v, 1)} gal`),
      how: `${l} × ${w} × ${h} = ${num(cu)} cubic inches. ÷ 231 = ${num(gal, 1)} gal.`,
    };
  });

  add("mech", "horsepower", 6, (L, R) => {
    const T = R.ri(15, 30) * 10, rpm = R.ri(20, 28) * 100, hp = (T * rpm) / 5252;
    if (R.chance(0.5)) return {
      text: `An engine makes ${T} ft-lb of torque at ${num(rpm)} rpm. About how much horsepower?`, answer: `${num(Math.round(hp))} hp`,
      pool: [(T * rpm) / 33000, (T * rpm) / 1000, hp * 1.5, hp + 25, (T * rpm) / 63025].map((v) => `${num(Math.round(v))} hp`),
      how: `Horsepower = torque × rpm ÷ 5,252: ${T} × ${num(rpm)} ÷ 5,252 ≈ ${num(Math.round(hp))} hp.`,
    };
    const P = R.ri(14, 21) * 10, t = (P * 5252) / rpm;
    return {
      text: `A ${P}-hp engine turning ${num(rpm)} rpm. About how much torque is that?`, answer: `${num(Math.round(t))} ft-lb`,
      pool: [(P * rpm) / 5252, (P * 33000) / rpm, t * 0.7, t + 50, (P * 63025) / rpm].map((v) => `${num(Math.round(v))} ft-lb`),
      how: `Torque = hp × 5,252 ÷ rpm = ${P} × 5,252 ÷ ${num(rpm)} ≈ ${num(Math.round(t))} ft-lb.`,
    };
  });

  add("mech", "resist", 4, (L, R) => {
    const pairs = [[6, 3], [12, 6], [4, 4], [20, 5], [10, 15], [12, 4], [30, 20], [60, 30], [9, 18]];
    if (L >= 7 && R.chance(0.6)) {
      const trios = [[6, 3, 2], [12, 6, 4], [20, 30, 60], [4, 6, 12], [10, 15, 30]], [a, b, c] = R.pick(trios), rp = 1 / (1 / a + 1 / b + 1 / c);
      if (L >= 9) {
        const V = R.pick([12, 24, 28]), I = V / rp;
        return {
          text: `Three loads of ${a}, ${b} and ${c} Ω are wired in parallel across ${V} V. Total current?`, answer: `${num(I, 1)} A`,
          pool: [V / (a + b + c), V / a, I / 2, I + 2, V / ((a + b + c) / 3)].map((v) => `${num(v, 1)} A`),
          how: `Parallel: 1/R = 1/${a} + 1/${b} + 1/${c} → R = ${num(rp, 2)} Ω. Current = ${V} ÷ ${num(rp, 2)} = ${num(I, 1)} A (or add each branch: ${num(V / a, 1)} + ${num(V / b, 1)} + ${num(V / c, 1)}).`,
        };
      }
      return {
        text: `${a}, ${b} and ${c} ohms in parallel. Total resistance?`, answer: `${num(rp, 2)} Ω`,
        pool: [a + b + c, (a + b + c) / 3, Math.min(a, b, c), rp * 2, rp + 1].map((v) => `${num(v, 2)} Ω`),
        how: `1/R = 1/${a} + 1/${b} + 1/${c} = ${num(1 / rp, 3)} → R = ${num(rp, 2)} Ω. Parallel is always less than the smallest one.`,
      };
    }
    const [a, b] = R.pick(pairs), par = R.chance(0.6), rr = par ? (a * b) / (a + b) : a + b;
    return {
      text: `A ${a}-ohm and a ${b}-ohm resistor in ${par ? "parallel" : "series"}. Total resistance?`, answer: `${num(rr, 2)} Ω`,
      pool: [par ? a + b : (a * b) / (a + b), (a + b) / 2, Math.min(a, b), a * b, rr + 2].map((v) => `${num(v, 2)} Ω`),
      how: par ? `Parallel pair: product ÷ sum = ${a * b} ÷ ${a + b} = ${num(rr, 2)} Ω.` : `Series just adds: ${a} + ${b} = ${rr} Ω.`,
    };
  });

  add("mech", "battery", 3, (L, R) => {
    const C = R.pick([17, 24, 28, 35, 42]), I = R.ri(4, 20), usable = L >= 6 ? R.pick([0.5, 0.7, 0.8]) : 1, min = (C * usable / I) * 60;
    return {
      text: `Alternator fails. Battery is ${C} amp-hours${usable < 1 ? `, but only ${usable * 100}% is usable` : ""}, and the load is ${I} A. About how long until it's flat?`, answer: dur(min),
      pool: [(C / I) * 60 * (usable < 1 ? 1 : 0.5), (I / C) * 60, min + 30, Math.max(5, min - 20), C * 2].map(dur),
      how: `Hours = amp-hours ÷ amps: ${C}${usable < 1 ? ` × ${usable}` : ""} ÷ ${I} = ${num(min / 60, 2)} h ≈ ${dur(min)}. Shedding load buys time.`,
    };
  });

  add("mech", "pythag", 2, (L, R) => {
    if (L <= 5) {
      const [a, b, c] = R.pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]]), k = a > 7 ? 1 : R.ri(1, 4);
      const askHyp = R.chance(0.6);
      if (askHyp) return {
        text: `A diagonal brace spans a frame ${a * k} ft wide and ${b * k} ft tall. How long is the brace?`, answer: `${c * k} ft`,
        pool: [(a + b) * k, c * k + 1, c * k - 1, Math.round(((a + b) * k) / 2) + 3, b * k + 2].map((v) => `${v} ft`),
        how: `a² + b² = c²: ${a * k}² + ${b * k}² = ${(a * k) ** 2 + (b * k) ** 2} = ${c * k}².`,
      };
      return {
        text: `A ${c * k}-ft ladder leans on the hangar, its foot ${a * k} ft from the wall. How high does it reach?`, answer: `${b * k} ft`,
        pool: [c * k - a * k, b * k + 1, b * k - 1, c * k, b * k + 2].map((v) => `${v} ft`),
        how: `${c * k}² − ${a * k}² = ${(c * k) ** 2 - (a * k) ** 2} = ${b * k}².`,
      };
    }
    const a = R.ri(4, 30), b = R.ri(4, 30), c = Math.hypot(a, b);
    return {
      text: `Square up a hangar door frame: it's ${a} ft wide and ${b} ft tall. What should the diagonal measure?`, answer: `${num(c, 1)} ft`,
      pool: [a + b, c + 1, c - 1, Math.max(a, b) + 1, (a + b) / 1.5].map((v) => `${num(v, 1)} ft`),
      how: `√(${a}² + ${b}²) = √${a * a + b * b} ≈ ${num(c, 1)} ft. Both diagonals equal = square.`,
    };
  });

  add("mech", "waterp", 5, (L, R) => {
    const ft = R.ri(4, 40), psi = ft * 0.433;
    return {
      text: `What's the water pressure at the bottom of a ${ft}-ft-tall full water tank?`, answer: `${num(psi, 1)} psi`,
      pool: [ft * 62.4, ft * 0.5 + 1, ft * 14.7 / 33, psi + 3, ft / 0.433].map((v) => `${num(v, 1)} psi`),
      how: `Water adds 0.433 psi per foot of depth (62.4 lb per cu ft ÷ 144 sq in): ${ft} × 0.433 = ${num(psi, 1)} psi. Height matters, not the tank's width.`,
    };
  });

  add("mech", "actuator", 7, (L, R) => {
    const d = R.pick([0.75, 1, 1.25, 1.5, 2]), p = R.ri(6, 30) * 100, A = Math.PI * (d / 2) ** 2, F = p * A;
    return {
      text: `A hydraulic actuator has a ${d}-in bore. At ${num(p)} psi, about how hard does it push?`, answer: `${num(Math.round(F))} lb`,
      pool: [p * d, p * Math.PI * d * d, F * 2, p * d * d, F + 300].map((v) => `${num(Math.round(v))} lb`),
      how: `Piston area = π × r² = 3.1416 × ${d / 2}² = ${num(A, 3)} sq in. Force = ${num(p)} × ${num(A, 3)} ≈ ${num(Math.round(F))} lb.`,
    };
  });

  add("mech", "lever2", 6, (L, R) => {
    for (;;) {
      const w1 = R.ri(4, 20) * 10, d1 = R.ri(1, 4), w2 = R.ri(2, 12) * 10, d2 = R.ri(d1 + 1, 7), d3 = R.ri(2, 8), m = w1 * d1 + w2 * d2;
      if (m % d3) continue;
      const F = m / d3;
      return {
        text: `On one side of a pivot: ${w1} lb at ${d1} ft and ${w2} lb at ${d2} ft. What force at ${d3} ft on the other side balances them?`, answer: `${num(F)} lb`,
        pool: [w1 + w2, ((w1 + w2) * d1) / d3, F + 10, (w1 * d1) / d3, ((w1 + w2) * (d1 + d2)) / d3].map((v) => `${num(Math.round(v))} lb`),
        how: `Add the moments: ${w1} × ${d1} + ${w2} × ${d2} = ${m} ft-lb. ÷ ${d3} ft = ${num(F)} lb.`,
      };
    }
  });

  add("mech", "tipspeed", 7, (L, R) => {
    const D = R.pick([68, 70, 72, 74, 76]), rpm = R.ri(22, 27) * 100, v = Math.round((Math.PI * (D / 12) * rpm) / 60);
    return {
      text: `A ${D}-in prop turning ${num(rpm)} rpm. About what's the tip speed in feet per second?`, answer: `${num(v)} ft/s`,
      pool: [v / 2, Math.PI * D * rpm / 60, (D / 12) * rpm / 60, v + 90, v * 0.68].map((x) => `${num(Math.round(x))} ft/s`),
      how: `Tip travels π × diameter each turn: 3.1416 × ${num(D / 12, 2)} ft = ${num(Math.PI * D / 12, 2)} ft. × ${num(rpm)} rpm ÷ 60 = ${num(v)} ft/s (sound is about 1,100 ft/s).`,
    };
  });

  add("mech", "bend", 8, (L, R) => {
    const T = R.pick([0.025, 0.032, 0.040, 0.050, 0.063]), Rd = R.pick([0.0625, 0.09375, 0.125, 0.1875, 0.25]), N = L >= 10 ? R.pick([45, 90, 120]) : 90;
    const ba = (0.01743 * Rd + 0.0078 * T) * N, f = (v) => `${v.toFixed(3)} in`;
    return {
      text: `Sheet metal: ${T.toFixed(3)} in thick, ${Rd}-in bend radius, ${N}° bend. What's the bend allowance?`, answer: f(ba),
      pool: [0.01743 * Rd * N, (Rd + T) * 1, (0.01743 * T + 0.0078 * Rd) * N, ba + 0.05, ((Rd + T / 2) * Math.PI) / 2 + 0.03].map(f),
      how: `BA = (0.01743 × R + 0.0078 × T) × degrees = (0.01743 × ${Rd} + 0.0078 × ${T}) × ${N} = ${f(ba)}.`,
    };
  });

  add("mech", "tire", 8, (L, R) => {
    const p1 = R.ri(6, 12) * 5, t1 = R.ri(4, 7) * 10, t2 = R.ri(9, 13) * 10, p2 = ((p1 + 14.7) * (t2 + 460)) / (t1 + 460) - 14.7;
    return {
      text: `You set the tires to ${p1} psi at ${t1} °F. On the ramp at ${t2} °F, what will the gauge read?`, answer: `${num(p2, 1)} psi`,
      pool: [(p1 * t2) / t1, p1, (p1 * (t2 + 460)) / (t1 + 460) + 2, p2 + 4, p1 + (t2 - t1) / 2].map((v) => `${num(v, 1)} psi`),
      how: `Use absolute units: (${p1} + 14.7) × (${t2} + 460) ÷ (${t1} + 460) = ${num(p2 + 14.7, 1)} psi absolute; − 14.7 = ${num(p2, 1)} psi on the gauge.`,
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
  const STEP = { OKU: 0.6, OK: 0.4, F: 0.15, B: -0.3, NG: -0.45, WO: -0.1 };
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
