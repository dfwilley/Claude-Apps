// Gear Bag Check — the packing rules, kept apart from the screens so tests/gear-bag-check.test.js can check them.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GB = factory();
})(this, function () {
  "use strict";

  const VERSION = 1;
  const KEEP_LOG = 200;
  const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Where an item shows on the checklist.
  const CATS = [["gear", "Gear"], ["uniform", "Uniform"], ["hair", "Hair"], ["water", "Water & snacks"]];

  // Each player picks their own look for their screens.
  const THEMES = [["field", "Field", "Green and orange"], ["berry", "Berry", "Pink and plum"], ["midnight", "Midnight", "Dark with violet"]];
  const THEME_KEYS = THEMES.map((t) => t[0]);

  // One tap adds the hair things to a bag.
  const HAIR_KIT = [["🎀", "Hair ties", "hair", 3], ["🧴", "Hair gel", "hair", 1], ["🪮", "Slick-back brush", "hair", 1]];
  const CAT_KEYS = CATS.map((c) => c[0]);

  // What can be wrong with an item. "ok" means nothing.
  const STATUS = {
    ok: { label: "Good", short: "", icon: "" },
    worn: { label: "Worn out or broken", short: "Worn out", icon: "🩹" },
    small: { label: "Too small", short: "Too small", icon: "📏" },
    lost: { label: "Can't find it", short: "Lost", icon: "🔍" },
  };
  const STATUS_ORDER = { lost: 0, worn: 1, small: 2, ok: 3 };

  // Starter bags for team sports: [emoji, name, category, how many].
  const TEMPLATES = {
    soccer: { name: "Soccer", emoji: "⚽", items: [
      ["👟", "Cleats", "uniform", 1], ["🦵", "Shin guards", "gear", 1], ["🧦", "Soccer socks", "uniform", 1],
      ["👕", "Jersey", "uniform", 1], ["🩳", "Shorts", "uniform", 1], ["⚽", "Soccer ball", "gear", 1],
      ["🧴", "Sunscreen", "gear", 1], ["💧", "Water bottle", "water", 2], ["🍎", "Snack", "water", 1],
    ] },
    baseball: { name: "Baseball", emoji: "⚾", items: [
      ["🧤", "Glove", "gear", 1], ["🏏", "Bat", "gear", 1], ["⛑️", "Batting helmet", "gear", 1],
      ["🧤", "Batting gloves", "gear", 1], ["👟", "Cleats", "uniform", 1], ["👕", "Jersey", "uniform", 1],
      ["👖", "Baseball pants", "uniform", 1], ["🎗️", "Belt", "uniform", 1], ["🧦", "Socks", "uniform", 1],
      ["🧢", "Cap", "uniform", 1], ["🧴", "Sunscreen", "gear", 1], ["💧", "Water bottle", "water", 2],
      ["🍎", "Snack", "water", 1],
    ] },
    softball: { name: "Softball", emoji: "🥎", items: [
      ["🧤", "Glove", "gear", 1], ["🏏", "Bat", "gear", 1], ["⛑️", "Helmet with face mask", "gear", 1],
      ["🧤", "Batting gloves", "gear", 1], ["👟", "Cleats", "uniform", 1], ["👕", "Jersey", "uniform", 1],
      ["👖", "Softball pants", "uniform", 1], ["🎗️", "Belt", "uniform", 1], ["🧦", "Socks", "uniform", 1],
      ["🧢", "Visor or cap", "uniform", 1], ["🎀", "Hair ties", "hair", 3], ["🧴", "Sunscreen", "gear", 1],
      ["💧", "Water bottle", "water", 2], ["🍎", "Snack", "water", 1],
    ] },
    basketball: { name: "Basketball", emoji: "🏀", items: [
      ["👟", "Basketball shoes", "uniform", 1], ["👕", "Jersey", "uniform", 1], ["🩳", "Shorts", "uniform", 1],
      ["🧦", "Socks", "uniform", 1], ["🏀", "Basketball", "gear", 1], ["🎀", "Hair ties", "hair", 3],
      ["💧", "Water bottle", "water", 2], ["🍎", "Snack", "water", 1],
    ] },
  };
  const TEMPLATE_KEYS = Object.keys(TEMPLATES);

  const ITEM_PICS = ["🎀", "🪮", "🧴", "💇", "👟", "🦵", "🧦", "👕", "🩳", "👖", "🎗️", "🧢", "🎀", "🧤", "⛑️", "🏏", "⚽", "⚾", "🥎", "🏀", "🏈", "🏐",
    "🎾", "🏒", "🥅", "🥍", "🏸", "🛼", "🛹", "🚲", "🏊", "🥽", "🩱", "🩴", "🧥", "🧣", "🕶️", "🧴", "🩹", "🪥", "🎒", "👜",
    "💧", "🥤", "🧃", "🍎", "🍌", "🥨", "🍫", "🍪", "🧊", "🏅", "📋", "📱", "🔑", "🪪", "💵", "🎧", "🧸", "⭐"];
  const BAG_PICS = ["⚽", "⚾", "🥎", "🏀", "🏈", "🏐", "🎾", "🏒", "🥍", "🏊", "🤸", "🥋", "🩰", "⛳", "🏃", "🚴", "🎒", "⛺", "🎵", "⭐"];
  const AVATARS = ["🦊", "🐻", "🐼", "🐯", "🦁", "🐸", "🐵", "🐰", "🦄", "🐲", "🐙", "🦖", "🐧", "🦋", "🐝", "🐬", "🦉", "🐢",
    "🐶", "🐱", "🦅", "🐺", "🦈", "🚀", "✈️", "⚽", "🏀", "⚾", "🥎", "🌈", "⭐", "🤖", "👑", "🦸"];
  const COLORS = ["#1E88E5", "#E53935", "#2E9E5B", "#8E44AD", "#F57C00", "#00897B", "#D81B60", "#5D6BD8"];

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

  function defaultState() {
    return { version: VERSION, kids: [], bags: [], checks: {}, log: [], settings: { speak: true, sound: true } };
  }

  function clampCount(n) { n = Math.round(Number(n) || 1); return Math.max(1, Math.min(9, n)); }
  function cleanText(t, max) { return String(t == null ? "" : t).replace(/\s+/g, " ").trim().slice(0, max || 40); }

  function kidById(s, id) { return s.kids.find((k) => k.id === id) || null; }
  function bagById(s, id) { return s.bags.find((b) => b.id === id) || null; }
  function bagsFor(s, kidId) { return s.bags.filter((b) => b.kidId === kidId); }

  function addKid(s, name, avatar, color) {
    const kid = { id: newId("k"), name: cleanText(name, 20) || "Player", avatar: avatar || AVATARS[s.kids.length % AVATARS.length],
      color: color || COLORS[s.kids.length % COLORS.length], theme: "field" };
    s.kids.push(kid);
    return kid;
  }
  function removeKid(s, kidId) {
    bagsFor(s, kidId).forEach((b) => removeBag(s, b.id));
    s.kids = s.kids.filter((k) => k.id !== kidId);
  }

  function makeItem(o) {
    return { id: newId("i"), emoji: o.emoji || "⭐", name: cleanText(o.name, 30) || "Item", count: clampCount(o.count),
      cat: CAT_KEYS.includes(o.cat) ? o.cat : "gear", status: "ok", note: "", statusDay: "" };
  }

  /** Adds a bag for a kid, from a starter template key or a blank {name, emoji}. */
  function addBag(s, kidId, from) {
    const t = typeof from === "string" ? TEMPLATES[from] : null;
    const bag = { id: newId("b"), kidId, name: t ? t.name : cleanText(from && from.name, 24) || "My bag",
      emoji: t ? t.emoji : (from && from.emoji) || "🎒", days: [], items: [] };
    if (t) t.items.forEach((x) => bag.items.push(makeItem({ emoji: x[0], name: x[1], cat: x[2], count: x[3] })));
    s.bags.push(bag);
    return bag;
  }
  function removeBag(s, bagId) {
    s.bags = s.bags.filter((b) => b.id !== bagId);
    delete s.checks[bagId];
  }
  /** Copies a bag to another player, with every item back in good shape (the copy is their own gear). */
  function copyBag(s, bagId, kidId) {
    const src = bagById(s, bagId); if (!src || !kidById(s, kidId)) return null;
    const bag = { id: newId("b"), kidId, name: src.name, emoji: src.emoji, days: src.days.slice(), items: [] };
    src.items.forEach((i) => bag.items.push(makeItem(i)));
    s.bags.push(bag);
    return bag;
  }
  /** Adds a kit's items to a bag, skipping any the bag already has (hair tie = hair ties). Returns how many were added. */
  function addKit(bag, kit) {
    const key = (n) => cleanText(n, 30).toLowerCase().replace(/s$/, "");
    const have = new Set(bag.items.map((i) => key(i.name)));
    let added = 0;
    kit.forEach((x) => { if (!have.has(key(x[1]))) { addItem(bag, { emoji: x[0], name: x[1], cat: x[2], count: x[3] }); added++; } });
    return added;
  }
  function addItem(bag, o) { const it = makeItem(o); bag.items.push(it); return it; }
  function removeItem(s, bagId, itemId) {
    const bag = bagById(s, bagId); if (!bag) return;
    bag.items = bag.items.filter((i) => i.id !== itemId);
    const c = s.checks[bagId]; if (c) c.packed = c.packed.filter((x) => x !== itemId);
  }
  function moveItem(bag, itemId, dir) {
    const i = bag.items.findIndex((x) => x.id === itemId), j = i + dir;
    if (i < 0 || j < 0 || j >= bag.items.length) return false;
    const t = bag.items[i]; bag.items[i] = bag.items[j]; bag.items[j] = t;
    return true;
  }

  /** True when the bag is used on that weekday. A bag with no days picked is "any day" but never "today". */
  function isToday(bag, date) { return bag.days.length > 0 && bag.days.includes(date.getDay()); }
  function bagsToday(s, kidId, date) { return bagsFor(s, kidId).filter((b) => isToday(b, date)); }

  /** Today's check for a bag. Yesterday's check marks are cleared: every trip starts with an empty bag. */
  function currentCheck(s, bagId, now) {
    const key = dayKey(now);
    let c = s.checks[bagId];
    if (!c || c.day !== key) { c = { day: key, packed: [] }; s.checks[bagId] = c; }
    return c;
  }
  function isPacked(s, bagId, itemId, now) { return currentCheck(s, bagId, now).packed.includes(itemId); }

  /** Tap an item at the door. Returns true when it is now in the bag. Packing a lost item means it was found. */
  function togglePacked(s, bagId, itemId, now) {
    const bag = bagById(s, bagId); const item = bag && bag.items.find((i) => i.id === itemId);
    if (!item) return false;
    const c = currentCheck(s, bagId, now);
    if (c.packed.includes(itemId)) { c.packed = c.packed.filter((x) => x !== itemId); return false; }
    if (item.status === "lost") { item.status = "ok"; item.note = ""; item.statusDay = ""; }
    c.packed.push(itemId);
    return true;
  }
  function startOver(s, bagId, now) { s.checks[bagId] = { day: dayKey(now), packed: [] }; }

  /** Marks an item worn out, too small, lost, or fixed ("ok"). A lost item comes out of today's bag. */
  function setStatus(s, bagId, itemId, status, note, now) {
    const bag = bagById(s, bagId); const item = bag && bag.items.find((i) => i.id === itemId);
    if (!item || !STATUS[status]) return false;
    item.status = status;
    item.note = status === "ok" ? "" : cleanText(note, 80);
    item.statusDay = status === "ok" ? "" : dayKey(now);
    if (status === "lost") { const c = currentCheck(s, bagId, now); c.packed = c.packed.filter((x) => x !== itemId); }
    return true;
  }

  /** What's in, what's missing, and what went in but needs replacing. */
  function summary(s, bagId, now) {
    const bag = bagById(s, bagId);
    if (!bag) return { packed: 0, total: 0, missing: [], flagged: [], allPacked: false };
    const c = currentCheck(s, bagId, now);
    const missing = bag.items.filter((i) => !c.packed.includes(i.id));
    const flagged = bag.items.filter((i) => c.packed.includes(i.id) && i.status !== "ok");
    const total = bag.items.length;
    return { packed: total - missing.length, total, missing, flagged, allPacked: total > 0 && missing.length === 0 };
  }

  /** Records a finished door check in the history. */
  function finishCheck(s, bagId, now) {
    const bag = bagById(s, bagId); if (!bag) return null;
    const sm = summary(s, bagId, now);
    const entry = { t: now.getTime(), kidId: bag.kidId, bagId, bagName: bag.name, packed: sm.packed, total: sm.total,
      missing: sm.missing.map((i) => i.name) };
    s.log.unshift(entry);
    if (s.log.length > KEEP_LOG) s.log.length = KEEP_LOG;
    return entry;
  }

  /** The grown-ups' "needs attention" list, across every kid: lost first, then worn out, then too small. */
  function attention(s) {
    const out = [];
    s.bags.forEach((bag) => {
      const kid = kidById(s, bag.kidId);
      bag.items.forEach((item) => { if (item.status !== "ok") out.push({ kid, bag, item }); });
    });
    out.sort((a, b) => STATUS_ORDER[a.item.status] - STATUS_ORDER[b.item.status] ||
      (a.kid ? a.kid.name : "").localeCompare(b.kid ? b.kid.name : "") || a.item.name.localeCompare(b.item.name));
    return out;
  }

  /** Checks and repairs a saved or restored file. Throws if it isn't a Gear Bag Check file. */
  function normalize(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.kids) || !Array.isArray(raw.bags)) {
      throw new Error("This isn't a Gear Bag Check backup.");
    }
    const s = defaultState();
    raw.kids.forEach((k) => {
      if (!k || !k.id) return;
      s.kids.push({ id: String(k.id), name: cleanText(k.name, 20) || "Player", avatar: k.avatar || "⭐", color: /^#[0-9a-f]{6}$/i.test(k.color) ? k.color : COLORS[0],
        theme: THEME_KEYS.includes(k.theme) ? k.theme : "field" });
    });
    const kidIds = new Set(s.kids.map((k) => k.id));
    raw.bags.forEach((b) => {
      if (!b || !b.id || !kidIds.has(String(b.kidId))) return;
      const bag = { id: String(b.id), kidId: String(b.kidId), name: cleanText(b.name, 24) || "My bag", emoji: b.emoji || "🎒",
        days: Array.isArray(b.days) ? b.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [], items: [] };
      (Array.isArray(b.items) ? b.items : []).forEach((i) => {
        if (!i || !i.id) return;
        bag.items.push({ id: String(i.id), emoji: i.emoji || "⭐", name: cleanText(i.name, 30) || "Item", count: clampCount(i.count),
          cat: CAT_KEYS.includes(i.cat) ? i.cat : "gear", status: STATUS[i.status] ? i.status : "ok",
          note: cleanText(i.note, 80), statusDay: typeof i.statusDay === "string" ? i.statusDay : "" });
      });
      s.bags.push(bag);
    });
    const bagIds = new Set(s.bags.map((b) => b.id));
    if (raw.checks && typeof raw.checks === "object") {
      Object.keys(raw.checks).forEach((id) => {
        const c = raw.checks[id];
        if (bagIds.has(id) && c && typeof c.day === "string" && Array.isArray(c.packed)) s.checks[id] = { day: c.day, packed: c.packed.map(String) };
      });
    }
    if (Array.isArray(raw.log)) s.log = raw.log.filter((e) => e && typeof e.t === "number").slice(0, KEEP_LOG);
    if (raw.settings) { s.settings.speak = raw.settings.speak !== false; s.settings.sound = raw.settings.sound !== false; }
    return s;
  }

  return { VERSION, CATS, CAT_KEYS, THEMES, THEME_KEYS, HAIR_KIT, STATUS, TEMPLATES, TEMPLATE_KEYS, ITEM_PICS, BAG_PICS, AVATARS, COLORS, DAY_LETTERS, DAY_NAMES,
    newId, dayKey, defaultState, kidById, bagById, bagsFor, addKid, removeKid, addBag, removeBag, copyBag, addKit, addItem, removeItem, moveItem,
    isToday, bagsToday, currentCheck, isPacked, togglePacked, startOver, setStatus, summary, finishCheck, attention, normalize };
});
