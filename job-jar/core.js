// The Job Jar! — rules shared by the web app and checked by tests/job-jar.test.js.
// The iPhone/iPad app follows the same rules in Swift (native/job-jar/JobJar/Core.swift).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JJ = factory();
})(this, function () {
  "use strict";

  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]; // Sunday = 0
  const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const KEEP_DAYS = 90; // chore check-offs older than this are cleared away
  const KEEP_LOG = 500;

  const CHORE_PICS = [
    ["🛏️", "Make bed"], ["🪥", "Brush teeth"], ["🐶", "Feed the dog"], ["🐱", "Feed the cat"], ["🐟", "Feed the fish"],
    ["🧸", "Pick up toys"], ["🍽️", "Clear your plate"], ["🧺", "Clothes in hamper"], ["👕", "Get dressed"],
    ["👟", "Put shoes away"], ["🪴", "Water plants"], ["📚", "Read a book"], ["🍴", "Set the table"],
    ["🧼", "Wash hands"], ["🛁", "Take a bath"], ["🗑️", "Take out trash"], ["🧹", "Sweep"], ["🧽", "Wipe the table"],
    ["🎒", "Pack backpack"], ["✏️", "Homework"], ["🎹", "Practice music"], ["🧦", "Match socks"],
    ["🥣", "Help with breakfast"], ["🛒", "Help put away groceries"], ["🚗", "Clean up the car"], ["🌙", "Ready for bed"],
    ["🚿", "Take a shower"], ["🦷", "Floss"], ["💇", "Brush hair"], ["💊", "Take vitamins"], ["🧥", "Hang up coat"], ["👚", "Fold laundry"], ["🥗", "Eat your veggies"], ["🥪", "Pack lunch"], ["🍳", "Help cook"], ["🥄", "Unload the dishwasher"], ["🫧", "Wash dishes"], ["🪣", "Mop"], ["🚽", "Clean the bathroom"], ["🪟", "Wash windows"], ["🛋️", "Tidy the living room"], ["📦", "Put things away"], ["🚮", "Pick up trash"], ["♻️", "Recycling"], ["📬", "Get the mail"], ["🐕", "Walk the dog"], ["🐹", "Feed the hamster"], ["🐔", "Feed the chickens"], ["🌱", "Weed the garden"], ["🍂", "Rake leaves"], ["❄️", "Shovel snow"], ["🚲", "Put bike away"], ["💡", "Turn off lights"], ["📵", "Screens off"], ["🏃", "Exercise"], ["⚽", "Practice sports"], ["🙏", "Say prayers"], ["😴", "Quiet time"], ["🤝", "Help someone"], ["💬", "Use kind words"], ["👂", "Listen the first time"],
  ];
  const REWARD_PICS = [
    ["📖", "Extra story time"], ["🍦", "Ice cream trip"], ["🎬", "Pick the movie"], ["🛝", "Trip to the park"],
    ["🌙", "Stay up 15 minutes late"], ["🍕", "Pick dinner"], ["🎮", "Extra game time"], ["🧁", "Bake a treat together"],
    ["🎨", "Craft time"], ["🏊", "Swimming"], ["🎁", "Small toy"], ["🍿", "Movie night"], ["🚲", "Bike ride"],
    ["🧩", "Puzzle with a grown-up"], ["⛺", "Living room campout"], ["🦕", "Museum trip"], ["🍩", "Donut breakfast"], ["✈️", "Visit Granddad's airplane"],
  ];
  const AVATARS = ["🦊", "🐻", "🐼", "🐯", "🦁", "🐸", "🐵", "🐰", "🦄", "🐲", "🐙", "🦖", "🐧", "🦋", "🐝", "🐬", "🦉", "🐢",
    "🐶", "🐱", "🐭", "🐹", "🐨", "🐮", "🐷", "🐔", "🦆", "🦅", "🐺", "🐴", "🦓", "🦒", "🐘", "🦛", "🦘", "🐿️", "🦔", "🦦", "🦥", "🐳", "🦈", "🐊", "🦎", "🐍", "🦜", "🦩", "🐞", "🦀", "🐠", "🦕", "🚀", "🚂", "🚗", "✈️", "⚽", "🏀", "⚾", "🎸", "🎨", "🌈", "⭐", "🌻", "🌙", "🍎", "🍕", "🤖", "👑", "🦸",
    "🐈", "🐩", "🐇", "🦌", "🐗", "🐑", "🐐", "🦙", "🐪", "🦏", "🦍", "🦧", "🐆", "🦇", "🦃", "🐓", "🦢", "🦚", "🦭", "🐋",
    "🐡", "🦑", "🦞", "🦐", "🐌", "🐛", "🐜", "🦗", "🐾", "🐉", "🦤", "🐻‍❄️", "🧚", "🧜", "🧙", "🦹", "🧞", "🥷", "👸", "🤴",
    "🧑‍🚀", "👻", "👽", "👾", "🤠", "😎", "🥳", "🤩", "😺", "🎃", "⛄", "🎅", "🚒", "🚓", "🚑", "🚜", "🏎️", "🚁", "🛸", "🚤",
    "⛵", "🚢", "🛻", "🚌", "🏍️", "🛹", "🚲", "🏈", "🎾", "🏐", "🏒", "🥋", "⛸️", "🏓", "🎳", "🏆", "🥇", "🛼", "🥁", "🎹",
    "🎺", "🎻", "🎤", "🎧", "🎭", "🎪", "🪁", "🌸", "🌺", "🌷", "🌵", "🌴", "🍀", "🍄", "🌊", "🔥", "⚡", "❄️", "☀️", "🌟",
    "💎", "🌋", "🪐", "🌎", "🍓", "🍉", "🍌", "🍒", "🥑", "🍔", "🌮", "🍩", "🍪", "🧁", "🍭", "🍦", "🥕", "🎈", "🎁", "🧸",
    "🪀", "🔮", "🧩", "🎯", "💖", "🏰", "⚓", "🎲"];
  // Money mode: every star becomes one coin of the family's chosen kind.
  // d = coin size in millimeters (to draw them to scale), face/edge = drawing colors.
  const COINS = {
    penny: { cents: 1, name: "penny", plural: "pennies", d: 19.05, face: "#D9894A", edge: "#9C5A2A" },
    nickel: { cents: 5, name: "nickel", plural: "nickels", d: 21.21, face: "#C9CDD3", edge: "#8C9199" },
    dime: { cents: 10, name: "dime", plural: "dimes", d: 17.91, face: "#D5D9DE", edge: "#9298A1" },
    quarter: { cents: 25, name: "quarter", plural: "quarters", d: 24.26, face: "#CDD1D7", edge: "#8A9099" },
    half: { cents: 50, name: "half dollar", plural: "half dollars", d: 30.61, face: "#D2D6DB", edge: "#8E949C" },
    dollar: { cents: 100, name: "dollar coin", plural: "dollar coins", d: 26.49, face: "#E7C25A", edge: "#A9832A" },
  };
  const COIN_KEYS = Object.keys(COINS);
  const MAX_PAY = 20; // most stars or coins one chore can earn
  const MAX_COUNT = 10; // a grown-up can pay a chore up to this many times over (3 goals = 3 times the pay)
  const MAX_TIMES = 3; // a special day can double or triple what chores pay
  const MATCH_PERCENTS = [25, 50, 100, 200];
  const COLORS = ["#FF8A3D", "#3DA5FF", "#34C47C", "#B36BFF", "#FF5C8A", "#F2B800", "#20B8B0", "#8A6CFF"];

  let counter = 0;
  function newId(prefix) {
    counter = (counter + 1) % 1000;
    return (prefix || "id") + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36) + counter;
  }

  /** Local calendar day as "YYYY-MM-DD". */
  function dayKey(d) {
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    return y + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }
  function parseDay(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
  }
  function addDays(d, n) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12); return x; }
  /** The Sunday that starts the week containing d. */
  function weekStart(d) { return addDays(d, -d.getDay()); }

  function defaultState() {
    const chore = (pic, name, stars) => ({ id: newId("c"), pic, name, stars: stars || 1, days: ALL_DAYS.slice(), kids: [] });
    const reward = (pic, name, cost) => ({ id: newId("r"), pic, name, cost });
    return {
      version: 2, // 2 = "grown-up checks chores first" starts switched on
      kids: [],
      chores: [
        chore("🛏️", "Make bed"), chore("🪥", "Brush teeth"), chore("🧸", "Pick up toys"),
        chore("🍽️", "Clear your plate"), chore("🧺", "Clothes in hamper"), chore("🐶", "Feed the dog"),
      ],
      rewards: [
        reward("📖", "Extra story time", 5), reward("🌙", "Stay up 15 minutes late", 8),
        reward("🎬", "Pick the movie", 10), reward("🍦", "Ice cream trip", 15),
      ],
      specials: [], // special days: { id, pic, name, date: "YYYY-MM-DD", yearly, times: 2 | 3, kids: [] }
      matches: [], // someone matching what kids earn: { id, pic, who, percent, kids: [], until, cap, earned: { kidId: n }, given: { kidId: n } }
      counts: {}, // chores a grown-up paid more than once: { "YYYY-MM-DD": { kidId: { choreId: 3 } } }
      done: {}, // { "YYYY-MM-DD": { kidId: { choreId: "done" | "waiting" } } }
      log: [], // newest first: { t, kid, kind, text, pic, delta }
      settings: { pin: "", needsApproval: true, sound: true, speak: true, money: false, coin: "nickel" },
      setupDone: false,
    };
  }

  /** Fills in anything missing from an older or hand-edited save. */
  function normalize(s) {
    const d = defaultState();
    if (!s || typeof s !== "object") return d;
    const out = Object.assign({}, d, s);
    out.settings = Object.assign({}, d.settings, s.settings || {});
    // Saves from before version 2 had the grown-up check off unless someone turned it on.
    // Switch it on once; a grown-up can still turn it off in Settings.
    if ((Number(s.version) || 1) < 2) out.settings.needsApproval = true;
    out.settings.needsApproval = !!out.settings.needsApproval;
    out.version = 2;
    out.settings.money = !!out.settings.money;
    if (!COINS[out.settings.coin]) out.settings.coin = "nickel";
    out.kids = (Array.isArray(s.kids) ? s.kids : []).map((k, i) => ({
      id: k.id || newId("k"), name: String(k.name || "Kid"), avatar: k.avatar || AVATARS[i % AVATARS.length],
      color: k.color || COLORS[i % COLORS.length], stars: Math.max(0, Math.round(Number(k.stars) || 0)),
      photo: validPhoto(k.photo) ? k.photo : "",
    }));
    out.chores = (Array.isArray(s.chores) ? s.chores : d.chores).map((c) => ({
      id: c.id || newId("c"), pic: c.pic || "⭐", name: String(c.name || "Chore"),
      stars: clamp(Math.round(Number(c.stars) || 1), 1, MAX_PAY),
      days: Array.isArray(c.days) && c.days.length ? c.days.filter((x) => x >= 0 && x <= 6) : ALL_DAYS.slice(),
      kids: Array.isArray(c.kids) ? c.kids : [],
      from: validDay(c.from) ? c.from : "", until: validDay(c.until) ? c.until : "", // a special chore only shows between these days
      once: !!c.once, // only needs doing once a day: the first kid to do it gets it, then it leaves the other kids' lists
    }));
    out.specials = (Array.isArray(s.specials) ? s.specials : []).filter((x) => x && validDay(x.date)).map((x) => ({
      id: x.id || newId("s"), pic: x.pic || "🎉", name: String(x.name || "Special day"), date: x.date, yearly: !!x.yearly,
      times: clamp(Math.round(Number(x.times) || 2), 2, MAX_TIMES), kids: Array.isArray(x.kids) ? x.kids : [],
    }));
    out.matches = (Array.isArray(s.matches) ? s.matches : []).filter((m) => m && typeof m === "object").map((m) => ({
      id: m.id || newId("m"), pic: m.pic || "💝", who: String(m.who || "Grandma"),
      percent: clamp(Math.round(Number(m.percent) || 100), 1, 500), kids: Array.isArray(m.kids) ? m.kids : [],
      until: validDay(m.until) ? m.until : "", cap: Math.max(0, Math.round(Number(m.cap) || 0)),
      earned: counts(m.earned), given: counts(m.given),
    }));
    out.rewards = (Array.isArray(s.rewards) ? s.rewards : d.rewards).map((r) => ({
      id: r.id || newId("r"), pic: r.pic || "🎁", name: String(r.name || "Reward"), cost: Math.max(1, Math.round(Number(r.cost) || 1)),
    }));
    out.done = s.done && typeof s.done === "object" ? s.done : {};
    out.counts = {};
    if (s.counts && typeof s.counts === "object") Object.keys(s.counts).forEach((day) => {
      const kids = s.counts[day];
      if (!validDay(day) || !kids || typeof kids !== "object") return;
      Object.keys(kids).forEach((kid) => {
        const c = counts(kids[kid]);
        Object.keys(c).forEach((id) => { if (c[id] > 1) ((out.counts[day] = out.counts[day] || {})[kid] = out.counts[day][kid] || {})[id] = Math.min(MAX_COUNT, c[id]); });
      });
    });
    out.log = Array.isArray(s.log) ? s.log : [];
    out.setupDone = !!s.setupDone;
    return out;
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function validDay(k) { return typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k); }
  function counts(o) {
    const out = {};
    if (o && typeof o === "object") Object.keys(o).forEach((k) => { const n = Math.round(Number(o[k]) || 0); if (n > 0) out[k] = n; });
    return out;
  }
  function kidById(s, id) { return s.kids.find((k) => k.id === id); }
  function choreById(s, id) { return s.chores.find((c) => c.id === id); }
  function rewardById(s, id) { return s.rewards.find((r) => r.id === id); }

  /** Is this chore on this kid's list for this day? */
  function isDue(chore, date, kidId) {
    if (chore.kids && chore.kids.length && !chore.kids.includes(kidId)) return false;
    const k = dayKey(date);
    if ((chore.from && k < chore.from) || (chore.until && k > chore.until)) return false; // a special chore outside its days
    return (chore.days || ALL_DAYS).includes(date.getDay());
  }

  /** The special day (birthday, holiday...) that counts for this kid on this date, or null. The biggest one wins. */
  function specialFor(s, kidId, date) {
    const k = dayKey(date);
    let best = null;
    (s.specials || []).forEach((x) => {
      if (x.kids && x.kids.length && !x.kids.includes(kidId)) return;
      const hit = x.yearly ? x.date.slice(5) === k.slice(5) && k >= x.date : x.date === k;
      if (hit && (!best || x.times > best.times)) best = x;
    });
    return best;
  }
  /** 1 on an ordinary day, 2 or 3 on a special day. */
  function timesFor(s, kidId, date) { const x = specialFor(s, kidId, date); return x ? x.times : 1; }
  /** What a chore pays this kid on this date (doubled or tripled on a special day). */
  function payFor(s, kidId, chore, date) { return chore.stars * timesFor(s, kidId, date); }

  /** Is this match counting for this kid on this day? */
  function matchActive(m, kidId, day) {
    return (!m.kids.length || m.kids.includes(kidId)) && (!m.until || day <= m.until);
  }
  function matchesFor(s, kidId, date) { const k = dayKey(date); return (s.matches || []).filter((m) => matchActive(m, kidId, k)); }

  /**
   * After a kid's chore earnings change by `delta` on `day`, brings every match up to date:
   * a 50% match has given half of what the kid earned so far (rounded down), up to its limit.
   * Returns the total added by matches (negative if some was taken back).
   */
  function settleMatches(s, kidId, day, delta, now) {
    const kid = kidById(s, kidId);
    let total = 0;
    if (!kid || !delta) return 0;
    (s.matches || []).forEach((m) => {
      if (!matchActive(m, kidId, day)) return;
      m.earned[kidId] = Math.max(0, (m.earned[kidId] || 0) + delta);
      let target = Math.floor((m.earned[kidId] * m.percent) / 100);
      if (m.cap > 0) target = Math.min(target, m.cap);
      const given = m.given[kidId] || 0;
      let diff = target - given;
      if (diff < 0) diff = -Math.min(kid.stars, -diff);
      if (!diff) return;
      kid.stars += diff;
      m.given[kidId] = given + diff;
      total += diff;
      addLog(s, { t: (now || new Date()).toISOString(), kid: kidId, kind: "match", text: m.who + (diff > 0 ? "'s match" : "'s match (taken back)"), pic: m.pic, delta: diff, day });
    });
    return total;
  }

  /** How many times over a grown-up paid this chore that day (1 unless they chose more). */
  function countOf(s, kidId, choreId, date) {
    const d = (s.counts || {})[dayKey(date)];
    return (d && d[kidId] && d[kidId][choreId]) || 1;
  }
  function setCount(s, kidId, choreId, date, n) {
    const k = dayKey(date);
    s.counts = s.counts || {};
    if (n > 1) ((s.counts[k] = s.counts[k] || {})[kidId] = s.counts[k][kidId] || {})[choreId] = n;
    else if (s.counts[k] && s.counts[k][kidId]) delete s.counts[k][kidId][choreId];
  }

  /**
   * Puts a finished chore's pay in the jar, then any matching. `count` pays it that many
   * times over (3 goals scored = 3 times the pay). Returns what the chore paid.
   */
  function payChore(s, kid, chore, date, now, count) {
    const n = clamp(Math.round(Number(count) || 1), 1, MAX_COUNT);
    const x = specialFor(s, kid.id, date), pay = payFor(s, kid.id, chore, date) * n, day = dayKey(date);
    kid.stars += pay;
    setCount(s, kid.id, chore.id, date, n);
    addLog(s, { t: (now || new Date()).toISOString(), kid: kid.id, kind: "chore", text: chore.name + (n > 1 ? " ×" + n : "") + (x ? " (×" + x.times + " " + x.name + ")" : ""), pic: chore.pic, delta: pay, day });
    settleMatches(s, kid.id, day, pay, now);
    return pay;
  }

  /**
   * Grown-up pays a chore that is already done `more` more times (another goal, or extra credit).
   * Returns what was added (0 if the chore isn't done or the limit is reached).
   */
  function addMore(s, kidId, choreId, day, more, now) {
    const date = parseDay(day), kid = kidById(s, kidId), chore = choreById(s, choreId);
    if (!kid || !chore || statusOf(s, kidId, choreId, date) !== "done") return 0;
    const had = countOf(s, kidId, choreId, date);
    const n = clamp(had + Math.round(Number(more) || 1), 1, MAX_COUNT), added = n - had;
    if (added <= 0) return 0;
    const pay = payFor(s, kidId, chore, date) * added;
    kid.stars += pay;
    setCount(s, kidId, choreId, date, n);
    addLog(s, { t: (now || new Date()).toISOString(), kid: kidId, kind: "chore", text: chore.name + " (" + added + " more)", pic: chore.pic, delta: pay, day });
    settleMatches(s, kidId, day, pay, now);
    return pay;
  }

  /** Chores a kid has finished and been paid for on this day: [{ kidId, chore, count }]. */
  function doneList(s, date) {
    const day = s.done[dayKey(date)] || {}, out = [];
    s.kids.forEach((kid) => s.chores.forEach((chore) => {
      if (day[kid.id] && day[kid.id][chore.id] === "done") out.push({ kidId: kid.id, chore, count: countOf(s, kid.id, chore.id, date) });
    }));
    return out;
  }

  function statusOf(s, kidId, choreId, date) {
    const day = s.done[dayKey(date)];
    return (day && day[kidId] && day[kidId][choreId]) || "";
  }

  /** For a once-a-day chore: the kid who has done it (or is waiting for a grown-up's OK) that day, or "". */
  function takenBy(s, chore, date) {
    if (!chore.once) return "";
    const day = s.done[dayKey(date)] || {};
    const k = s.kids.find((kid) => day[kid.id] && day[kid.id][chore.id]);
    return k ? k.id : "";
  }
  function takenByOther(s, chore, date, kidId) { const t = takenBy(s, chore, date); return !!t && t !== kidId; }

  /** Today's list for a kid: [{ chore, status }] where status is "", "waiting" or "done". */
  function choresFor(s, kidId, date) {
    return s.chores.filter((c) => isDue(c, date, kidId) && !takenByOther(s, c, date, kidId)).map((c) => ({ chore: c, status: statusOf(s, kidId, c.id, date) }));
  }

  function progress(s, kidId, date) {
    const list = choresFor(s, kidId, date);
    const finished = list.filter((x) => x.status === "done" || x.status === "waiting").length;
    return { finished, total: list.length, allDone: list.length > 0 && finished === list.length };
  }

  function setStatus(s, kidId, choreId, date, status) {
    const k = dayKey(date);
    s.done[k] = s.done[k] || {};
    s.done[k][kidId] = s.done[k][kidId] || {};
    if (status) s.done[k][kidId][choreId] = status;
    else delete s.done[k][kidId][choreId];
  }

  function addLog(s, entry) {
    s.log.unshift(Object.assign({ t: new Date().toISOString() }, entry));
    if (s.log.length > KEEP_LOG) s.log.length = KEEP_LOG;
  }

  /**
   * Kid taps "I did it!". Marks it "waiting" until a grown-up OKs it (the usual setting),
   * or gives the stars right away when the grown-up check is turned off. Returns the stars given (0 if waiting or already done).
   */
  function markDone(s, kidId, choreId, date, now) {
    const kid = kidById(s, kidId), chore = choreById(s, choreId);
    if (!kid || !chore || statusOf(s, kidId, choreId, date)) return 0;
    if (takenByOther(s, chore, date, kidId)) return 0; // a once-a-day chore another kid already did
    if (s.settings.needsApproval) {
      setStatus(s, kidId, choreId, date, "waiting");
      return 0;
    }
    setStatus(s, kidId, choreId, date, "done");
    return payChore(s, kid, chore, date, now);
  }

  /** "Not done yet" — takes the check off and the stars back (never below zero). */
  function undo(s, kidId, choreId, date, now) {
    const kid = kidById(s, kidId), chore = choreById(s, choreId);
    const st = statusOf(s, kidId, choreId, date);
    if (!kid || !st) return 0;
    setStatus(s, kidId, choreId, date, "");
    if (st !== "done" || !chore) return 0;
    const back = Math.min(kid.stars, payFor(s, kidId, chore, date) * countOf(s, kidId, choreId, date));
    setCount(s, kidId, choreId, date, 1);
    kid.stars -= back;
    addLog(s, { t: (now || new Date()).toISOString(), kid: kidId, kind: "undo", text: chore.name + " (taken off)", pic: chore.pic, delta: -back, day: dayKey(date) });
    settleMatches(s, kidId, dayKey(date), -back, now);
    return back;
  }

  /** Chores waiting for a grown-up, across all days: [{ day, kidId, chore }]. */
  function waitingList(s) {
    const out = [];
    Object.keys(s.done).sort().reverse().forEach((day) => {
      Object.keys(s.done[day]).forEach((kidId) => {
        Object.keys(s.done[day][kidId]).forEach((choreId) => {
          const chore = choreById(s, choreId);
          if (s.done[day][kidId][choreId] === "waiting" && chore && kidById(s, kidId)) out.push({ day, kidId, chore });
        });
      });
    });
    return out;
  }

  /** Grown-up OKs a waiting chore. `count` pays it that many times over (default once). */
  function approve(s, kidId, choreId, day, now, count) {
    const date = parseDay(day), kid = kidById(s, kidId), chore = choreById(s, choreId);
    if (!kid || !chore || statusOf(s, kidId, choreId, date) !== "waiting") return 0;
    setStatus(s, kidId, choreId, date, "done");
    return payChore(s, kid, chore, date, now, count); // a special day counts by the day the chore was done, not the day it was OK'd
  }

  function reject(s, kidId, choreId, day) {
    const date = parseDay(day);
    if (statusOf(s, kidId, choreId, date) === "waiting") setStatus(s, kidId, choreId, date, "");
  }

  function canAfford(s, kidId, rewardId) {
    const kid = kidById(s, kidId), r = rewardById(s, rewardId);
    return !!(kid && r && kid.stars >= r.cost);
  }
  function starsNeeded(s, kidId, rewardId) {
    const kid = kidById(s, kidId), r = rewardById(s, rewardId);
    return kid && r ? Math.max(0, r.cost - kid.stars) : 0;
  }

  /** Trades stars for a reward (a grown-up has already said yes). */
  function redeem(s, kidId, rewardId, now) {
    if (!canAfford(s, kidId, rewardId)) return false;
    const kid = kidById(s, kidId), r = rewardById(s, rewardId);
    kid.stars -= r.cost;
    addLog(s, { t: (now || new Date()).toISOString(), kid: kidId, kind: "reward", text: r.name, pic: r.pic, delta: -r.cost });
    return true;
  }

  /** Grown-up gives bonus stars (positive) or takes some away (negative). */
  function adjust(s, kidId, delta, reason, now) {
    const kid = kidById(s, kidId);
    if (!kid || !delta) return 0;
    const change = delta < 0 ? -Math.min(kid.stars, -delta) : delta;
    kid.stars += change;
    addLog(s, { t: (now || new Date()).toISOString(), kid: kidId, kind: change > 0 ? "bonus" : "minus", text: reason || (change > 0 ? "Bonus stars" : "Stars taken away"), pic: change > 0 ? "🌟" : "➖", delta: change });
    return change;
  }

  /** Week chart for one kid: rows of chores, 7 columns (Sun–Sat) of "", "done", "waiting", "off" or "future". */
  function weekChart(s, kidId, today) {
    const start = weekStart(today);
    const days = ALL_DAYS.map((i) => addDays(start, i));
    const todayKey = dayKey(today);
    const chores = s.chores.filter((c) => !c.kids.length || c.kids.includes(kidId));
    const rows = chores.map((c) => ({
      chore: c,
      cells: days.map((d) => {
        if (!isDue(c, d, kidId) || takenByOther(s, c, d, kidId)) return "off";
        const st = statusOf(s, kidId, c.id, d);
        if (st) return st;
        return dayKey(d) > todayKey ? "future" : "";
      }),
    }));
    const earned = days.map((d) => s.log
      .filter((e) => e.kid === kidId && (e.kind === "chore" || e.kind === "undo" || e.kind === "match") && e.day === dayKey(d))
      .reduce((a, e) => a + e.delta, 0));
    return { days: days.map(dayKey), rows, earned, total: earned.reduce((a, b) => a + b, 0) };
  }

  /** Clears check-offs older than KEEP_DAYS and removes data for kids/chores that were deleted. */
  function prune(s, today) {
    const cutoff = dayKey(addDays(today, -KEEP_DAYS));
    Object.keys(s.done).forEach((k) => { if (k < cutoff) delete s.done[k]; });
    Object.keys(s.counts || {}).forEach((k) => { if (k < cutoff) delete s.counts[k]; });
    const kidIds = new Set(s.kids.map((k) => k.id));
    Object.keys(s.done).forEach((day) => Object.keys(s.done[day]).forEach((kid) => { if (!kidIds.has(kid)) delete s.done[day][kid]; }));
    s.chores.forEach((c) => { c.kids = c.kids.filter((id) => kidIds.has(id)); });
    // A special day or a match made for kids who were all removed goes away too (empty would mean "everyone").
    const keep = (x) => { const had = x.kids.length; x.kids = x.kids.filter((id) => kidIds.has(id)); return !had || x.kids.length; };
    s.specials = (s.specials || []).filter(keep);
    s.matches = (s.matches || []).filter(keep);
    s.matches.forEach((m) => [m.earned, m.given].forEach((o) => Object.keys(o).forEach((id) => { if (!kidIds.has(id)) delete o[id]; })));
    return s;
  }

  function removeKid(s, kidId) { s.kids = s.kids.filter((k) => k.id !== kidId); s.log = s.log.filter((e) => e.kid !== kidId); return prune(s, new Date()); }

  /** "1 star" / "3 stars" */
  function starWord(n) { return n + (Math.abs(n) === 1 ? " star" : " stars"); }

  /** The last emoji in what someone typed ("" if there is none), so any emoji on the keyboard can be a picture. */
  function pickEmoji(text) {
    const t = String(text || "");
    let parts;
    if (typeof Intl !== "undefined" && Intl.Segmenter) parts = Array.from(new Intl.Segmenter("en", { granularity: "grapheme" }).segment(t), (x) => x.segment);
    else parts = Array.from(t);
    for (let i = parts.length - 1; i >= 0; i--) if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(parts[i])) return parts[i];
    return "";
  }

  function validPin(p) { return /^\d{4}$/.test(String(p || "")); }

  /** A kid's own picture, saved as a small JPEG/PNG "data:" address. */
  function validPhoto(p) { return typeof p === "string" && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(p) && p.length < 400000; }

  function coinOf(s) { return COINS[(s.settings && s.settings.coin) || "nickel"] || COINS.nickel; }

  /** 25 -> "25¢", 135 -> "$1.35", 100 -> "$1.00" */
  function money(cents) {
    const neg = cents < 0, c = Math.abs(Math.round(cents));
    const t = c < 100 ? c + "¢" : "$" + Math.floor(c / 100) + "." + String(c % 100).padStart(2, "0");
    return (neg ? "−" : "") + t;
  }
  /** Words for reading out loud: 25 -> "25 cents", 135 -> "1 dollar and 35 cents" */
  function moneyWords(cents) {
    const c = Math.abs(Math.round(cents)), dol = Math.floor(c / 100), ct = c % 100;
    const parts = [];
    if (dol) parts.push(dol + (dol === 1 ? " dollar" : " dollars"));
    if (ct || !dol) parts.push(ct + (ct === 1 ? " cent" : " cents"));
    return parts.join(" and ");
  }
  /** How an amount of stars shows on screen: "3 stars" or, in money mode, "15¢". */
  function amountText(s, n) { return s.settings.money ? money(n * coinOf(s).cents) : starWord(n); }
  function amountShort(s, n) { return s.settings.money ? money(n * coinOf(s).cents) : "⭐ " + n; }
  function amountSpeech(s, n) { return s.settings.money ? moneyWords(n * coinOf(s).cents) : starWord(n); }
  /** "5 nickels" */
  function coinCount(s, n) { const c = coinOf(s); return n + " " + (n === 1 ? c.name : c.plural); }

  return {
    ALL_DAYS, DAY_LETTERS, DAY_NAMES, CHORE_PICS, REWARD_PICS, AVATARS, COLORS, KEEP_DAYS, COINS, COIN_KEYS, MAX_PAY, MAX_TIMES, MATCH_PERCENTS,
    MAX_COUNT, countOf, addMore, doneList, takenBy, takenByOther, pickEmoji, validDay, specialFor, timesFor, payFor, matchesFor, matchActive, settleMatches,
    validPhoto, coinOf, money, moneyWords, amountText, amountShort, amountSpeech, coinCount,
    newId, dayKey, parseDay, addDays, weekStart, defaultState, normalize, kidById, choreById, rewardById,
    isDue, statusOf, choresFor, progress, markDone, undo, waitingList, approve, reject,
    canAfford, starsNeeded, redeem, adjust, weekChart, prune, removeKid, starWord, validPin,
  };
});
