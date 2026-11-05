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
  ];
  const REWARD_PICS = [
    ["📖", "Extra story time"], ["🍦", "Ice cream trip"], ["🎬", "Pick the movie"], ["🛝", "Trip to the park"],
    ["🌙", "Stay up 15 minutes late"], ["🍕", "Pick dinner"], ["🎮", "Extra game time"], ["🧁", "Bake a treat together"],
    ["🎨", "Craft time"], ["🏊", "Swimming"], ["🎁", "Small toy"], ["🍿", "Movie night"], ["🚲", "Bike ride"],
    ["🧩", "Puzzle with a grown-up"], ["⛺", "Living room campout"], ["🦕", "Museum trip"], ["🍩", "Donut breakfast"], ["✈️", "Visit Granddad's airplane"],
  ];
  const AVATARS = ["🦊", "🐻", "🐼", "🐯", "🦁", "🐸", "🐵", "🐰", "🦄", "🐲", "🐙", "🦖", "🐧", "🦋", "🐝", "🐬", "🦉", "🐢"];
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
      version: 1,
      kids: [],
      chores: [
        chore("🛏️", "Make bed"), chore("🪥", "Brush teeth"), chore("🧸", "Pick up toys"),
        chore("🍽️", "Clear your plate"), chore("🧺", "Clothes in hamper"), chore("🐶", "Feed the dog"),
      ],
      rewards: [
        reward("📖", "Extra story time", 5), reward("🌙", "Stay up 15 minutes late", 8),
        reward("🎬", "Pick the movie", 10), reward("🍦", "Ice cream trip", 15),
      ],
      done: {}, // { "YYYY-MM-DD": { kidId: { choreId: "done" | "waiting" } } }
      log: [], // newest first: { t, kid, kind, text, pic, delta }
      settings: { pin: "", needsApproval: false, sound: true, speak: true },
      setupDone: false,
    };
  }

  /** Fills in anything missing from an older or hand-edited save. */
  function normalize(s) {
    const d = defaultState();
    if (!s || typeof s !== "object") return d;
    const out = Object.assign({}, d, s);
    out.settings = Object.assign({}, d.settings, s.settings || {});
    out.kids = (Array.isArray(s.kids) ? s.kids : []).map((k, i) => ({
      id: k.id || newId("k"), name: String(k.name || "Kid"), avatar: k.avatar || AVATARS[i % AVATARS.length],
      color: k.color || COLORS[i % COLORS.length], stars: Math.max(0, Math.round(Number(k.stars) || 0)),
    }));
    out.chores = (Array.isArray(s.chores) ? s.chores : d.chores).map((c) => ({
      id: c.id || newId("c"), pic: c.pic || "⭐", name: String(c.name || "Chore"),
      stars: clamp(Math.round(Number(c.stars) || 1), 1, 5),
      days: Array.isArray(c.days) && c.days.length ? c.days.filter((x) => x >= 0 && x <= 6) : ALL_DAYS.slice(),
      kids: Array.isArray(c.kids) ? c.kids : [],
    }));
    out.rewards = (Array.isArray(s.rewards) ? s.rewards : d.rewards).map((r) => ({
      id: r.id || newId("r"), pic: r.pic || "🎁", name: String(r.name || "Reward"), cost: Math.max(1, Math.round(Number(r.cost) || 1)),
    }));
    out.done = s.done && typeof s.done === "object" ? s.done : {};
    out.log = Array.isArray(s.log) ? s.log : [];
    out.setupDone = !!s.setupDone;
    return out;
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function kidById(s, id) { return s.kids.find((k) => k.id === id); }
  function choreById(s, id) { return s.chores.find((c) => c.id === id); }
  function rewardById(s, id) { return s.rewards.find((r) => r.id === id); }

  /** Is this chore on this kid's list for this day? */
  function isDue(chore, date, kidId) {
    if (chore.kids && chore.kids.length && !chore.kids.includes(kidId)) return false;
    return (chore.days || ALL_DAYS).includes(date.getDay());
  }

  function statusOf(s, kidId, choreId, date) {
    const day = s.done[dayKey(date)];
    return (day && day[kidId] && day[kidId][choreId]) || "";
  }

  /** Today's list for a kid: [{ chore, status }] where status is "", "waiting" or "done". */
  function choresFor(s, kidId, date) {
    return s.chores.filter((c) => isDue(c, date, kidId)).map((c) => ({ chore: c, status: statusOf(s, kidId, c.id, date) }));
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
   * Kid taps "I did it!". Gives the stars right away, or marks it "waiting"
   * when a grown-up has to check chores first. Returns the stars given (0 if waiting or already done).
   */
  function markDone(s, kidId, choreId, date, now) {
    const kid = kidById(s, kidId), chore = choreById(s, choreId);
    if (!kid || !chore || statusOf(s, kidId, choreId, date)) return 0;
    if (s.settings.needsApproval) {
      setStatus(s, kidId, choreId, date, "waiting");
      return 0;
    }
    setStatus(s, kidId, choreId, date, "done");
    kid.stars += chore.stars;
    addLog(s, { t: (now || new Date()).toISOString(), kid: kidId, kind: "chore", text: chore.name, pic: chore.pic, delta: chore.stars, day: dayKey(date) });
    return chore.stars;
  }

  /** "Not done yet" — takes the check off and the stars back (never below zero). */
  function undo(s, kidId, choreId, date, now) {
    const kid = kidById(s, kidId), chore = choreById(s, choreId);
    const st = statusOf(s, kidId, choreId, date);
    if (!kid || !st) return 0;
    setStatus(s, kidId, choreId, date, "");
    if (st !== "done" || !chore) return 0;
    const back = Math.min(kid.stars, chore.stars);
    kid.stars -= back;
    addLog(s, { t: (now || new Date()).toISOString(), kid: kidId, kind: "undo", text: chore.name + " (taken off)", pic: chore.pic, delta: -back, day: dayKey(date) });
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

  function approve(s, kidId, choreId, day, now) {
    const date = parseDay(day), kid = kidById(s, kidId), chore = choreById(s, choreId);
    if (!kid || !chore || statusOf(s, kidId, choreId, date) !== "waiting") return 0;
    setStatus(s, kidId, choreId, date, "done");
    kid.stars += chore.stars;
    addLog(s, { t: (now || new Date()).toISOString(), kid: kidId, kind: "chore", text: chore.name, pic: chore.pic, delta: chore.stars, day });
    return chore.stars;
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
        if (!isDue(c, d, kidId)) return "off";
        const st = statusOf(s, kidId, c.id, d);
        if (st) return st;
        return dayKey(d) > todayKey ? "future" : "";
      }),
    }));
    const earned = days.map((d) => s.log
      .filter((e) => e.kid === kidId && (e.kind === "chore" || e.kind === "undo") && e.day === dayKey(d))
      .reduce((a, e) => a + e.delta, 0));
    return { days: days.map(dayKey), rows, earned, total: earned.reduce((a, b) => a + b, 0) };
  }

  /** Clears check-offs older than KEEP_DAYS and removes data for kids/chores that were deleted. */
  function prune(s, today) {
    const cutoff = dayKey(addDays(today, -KEEP_DAYS));
    Object.keys(s.done).forEach((k) => { if (k < cutoff) delete s.done[k]; });
    const kidIds = new Set(s.kids.map((k) => k.id));
    Object.keys(s.done).forEach((day) => Object.keys(s.done[day]).forEach((kid) => { if (!kidIds.has(kid)) delete s.done[day][kid]; }));
    s.chores.forEach((c) => { c.kids = c.kids.filter((id) => kidIds.has(id)); });
    return s;
  }

  function removeKid(s, kidId) { s.kids = s.kids.filter((k) => k.id !== kidId); s.log = s.log.filter((e) => e.kid !== kidId); return prune(s, new Date()); }

  /** "1 star" / "3 stars" */
  function starWord(n) { return n + (Math.abs(n) === 1 ? " star" : " stars"); }

  function validPin(p) { return /^\d{4}$/.test(String(p || "")); }

  return {
    ALL_DAYS, DAY_LETTERS, DAY_NAMES, CHORE_PICS, REWARD_PICS, AVATARS, COLORS, KEEP_DAYS,
    newId, dayKey, parseDay, addDays, weekStart, defaultState, normalize, kidById, choreById, rewardById,
    isDue, statusOf, choresFor, progress, markDone, undo, waitingList, approve, reject,
    canAfford, starsNeeded, redeem, adjust, weekChart, prune, removeKid, starWord, validPin,
  };
});
