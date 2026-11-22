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
  const THEMES = [["field", "Field", "Green and orange"], ["berry", "Berry", "Pink and plum"], ["midnight", "Midnight", "Dark with violet"],
    ["custom", "Custom", "Your own colors, with a color wheel"]];
  // Ready-made color sets for the Custom style: [name, background, main color, second color].
  const PALETTES = [["Lavender", "#F4F0FF", "#7B5CD6", "#E8679A"], ["Ocean", "#EAF6FB", "#0F7FA8", "#F2A541"], ["Mint", "#EEFAF4", "#1E9E77", "#7A6FF0"],
    ["Sunset", "#FFF3EA", "#E2553C", "#8E44AD"], ["Black & gold", "#121212", "#E3B341", "#E8E3D6"], ["Navy & coral", "#0F1B2D", "#FF7A6B", "#5BC0EB"]];
  // Verse of the day: Berean Standard Bible (public domain), wording checked against biblehub.com, November 21, 2026.
  const VERSES = [
    ["Joshua 1:9", "Have I not commanded you to be strong and courageous? Do not be afraid; do not be discouraged, for the LORD your God is with you wherever you go."],
    ["Philippians 4:13", "I can do all things through Christ who gives me strength."],
    ["Isaiah 40:31", "But those who wait upon the LORD will renew their strength; they will mount up with wings like eagles; they will run and not grow weary, they will walk and not faint."],
    ["Colossians 3:23", "Whatever you do, work at it with your whole being, as for the Lord and not for men,"],
    ["2 Timothy 1:7", "For God has not given us a spirit of fear, but of power, love, and self-control."],
    ["Isaiah 41:10", "Do not fear, for I am with you; do not be afraid, for I am your God. I will strengthen you; I will surely help you; I will uphold you with My righteous right hand."],
    ["1 Corinthians 9:24", "Do you not know that in a race all the runners run, but only one receives the prize? Run in such a way as to take the prize."],
    ["Psalm 28:7", "The LORD is my strength and my shield; my heart trusts in Him, and I am helped. Therefore my heart rejoices, and I give thanks to Him with my song."],
    ["Proverbs 3:5-6", "Trust in the LORD with all your heart, and lean not on your own understanding; in all your ways acknowledge Him, and He will make your paths straight."],
    ["Romans 8:31", "What then shall we say in response to these things? If God is for us, who can be against us?"],
    ["Psalm 118:24", "This is the day that the LORD has made; we will rejoice and be glad in it."],
    ["Psalm 56:3", "When I am afraid, I put my trust in You."],
    ["Ephesians 6:10", "Finally, be strong in the Lord and in His mighty power."],
    ["Psalm 46:1", "God is our refuge and strength, an ever-present help in times of trouble."],
    ["1 Corinthians 10:31", "So whether you eat or drink or whatever you do, do it all to the glory of God."],
    ["Galatians 6:9", "Let us not grow weary in well-doing, for in due time we will reap a harvest if we do not give up."],
    ["Proverbs 16:3", "Commit your works to the LORD and your plans will be achieved."],
    ["Deuteronomy 31:6", "Be strong and courageous; do not be afraid or terrified of them, for it is the LORD your God who goes with you; He will never leave you nor forsake you."],
    ["Psalm 18:32", "It is God who arms me with strength and makes my way clear."],
    ["Philippians 4:6", "Be anxious for nothing, but in everything, by prayer and petition, with thanksgiving, present your requests to God."],
    ["Matthew 5:16", "In the same way, let your light shine before men, that they may see your good deeds and glorify your Father in heaven."],
    ["1 Timothy 4:12", "Let no one despise your youth, but set an example for the believers in speech, in conduct, in love, in faith, in purity."],
    ["Psalm 121:2", "My help comes from the LORD, the Maker of heaven and earth."],
  ];
  // Short pre-game prayers (written for this app).
  const PRAYERS = [
    "Lord, thank You for my team and for the chance to play today. Help me give my best, keep every player safe, and play with a good attitude whether we win or lose. Amen.",
    "God, calm my nerves and help me focus. Help me be a good teammate, encourage the people around me, and show kindness on the field. Amen.",
    "Father, thank You for the strength to play. Protect the players on both teams, and help me be thankful no matter what the score is. In Jesus' name, Amen.",
    "Lord, remind me that who I am doesn't depend on the scoreboard. Help me play hard, play fair, and honor You in how I compete. Amen.",
    "God, give me courage when I'm nervous, patience when things go wrong, and joy in the game. Help me shake off mistakes and keep going. Amen.",
    "Lord, bless our team and our coaches. Help us work together, listen well, and lift each other up. Let our effort today bring You glory. Amen.",
  ];
  // Quick picks for the main screen's color (cream is the default).
  const HOME_COLORS = [["Cream", "#FBF6EA"], ["White", "#FFFFFF"], ["Blush", "#FDEBF1"], ["Lavender", "#EFEAFB"], ["Mint", "#E6F6EE"], ["Sky", "#E5F2FB"],
    ["Peach", "#FDEDE1"], ["Sage", "#DDE8D8"], ["Navy", "#14213D"], ["Black", "#111111"]];
  const MAX_REPEAT = 26; // weeks a repeating schedule item can be copied ahead
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
  const MORE_ITEM_PICS = ["🦷", "🧊", "🩹", "🧼", "🪥", "💅", "💄", "🧽", "🧻", "🎽", "👗", "👒", "👚", "🩱", "🧥", "⌚", "🕶️", "🎧", "📱", "🔋", "🔌",
    "📓", "✏️", "📚", "🗝️", "🧳", "👛", "💼", "🥤", "🧋", "🍫", "🥜", "🍊", "🍇", "🍓", "🥯", "🥪", "🍿", "🧁", "🍬", "🧃", "🫙", "🪭", "☂️", "🧢", "🎯", "🥊", "🏓",
    "🏸", "🎿", "⛸️", "🛷", "🥌", "🤿", "🎳", "🏹", "🎻", "🎸", "🎹", "🥁", "🎤", "🎨", "📷", "🏆", "🥇", "🎖️", "📣", "💖", "🌸", "🌈", "🔥", "⚡", "💎", "🦄"];
  const BAG_PICS = ["⚽", "⚾", "🥎", "🏀", "🏈", "🏐", "🎾", "🏒", "🥍", "🏊", "🤸", "🥋", "🩰", "⛳", "🏃", "🚴", "🎒", "⛺", "🎵", "⭐"];
  const MORE_BAG_PICS = ["🏋️", "🤾", "🏇", "🛹", "🎿", "🏂", "🧗", "🏓", "🏸", "🥊", "🤺", "⛸️", "🏄", "🚣", "🤽", "🏌️", "🎻", "🎸", "🎹", "🥁", "🎤",
    "💃", "🎨", "🎭", "📚", "🏕️", "🏖️", "🎯", "🏆", "🥇", "💖", "🌸", "🌈", "🔥", "⚡", "💎", "🦋", "🎀", "👑", "🚀"];
  const AVATARS = ["🦊", "🐻", "🐼", "🐯", "🦁", "🐸", "🐵", "🐰", "🦄", "🐲", "🐙", "🦖", "🐧", "🦋", "🐝", "🐬", "🦉", "🐢",
    "🐶", "🐱", "🦅", "🐺", "🦈", "🚀", "✈️", "⚽", "🏀", "⚾", "🥎", "🌈", "⭐", "🤖", "👑", "🦸"];
  const MORE_AVATARS = ["😎", "🤩", "🥰", "😊", "😁", "🤠", "🥳", "😺", "🐈", "🐕", "🐇", "🐥", "🦢", "🦩", "🦚", "🐠", "🦭", "🐋", "🦦", "🦥", "🦔", "🐞",
    "🌸", "🌺", "🌷", "🌻", "🌼", "🍓", "🍒", "🍉", "🍑", "🧁", "🍩", "🍦", "💖", "💜", "💙", "💚", "🧡", "🖤", "🤍", "✨", "💫", "🔥", "⚡", "🌊", "❄️", "☀️",
    "🌙", "🎀", "💎", "🎧", "🎨", "🎸", "🎤", "📸", "🏐", "🎾", "🏈", "🏒", "⛸️", "🏄", "🤸", "💃", "🏆", "🥇", "🦄", "🐉", "🌵", "🦂"];
  const uniq = (a) => Array.from(new Set(a));
  ITEM_PICS.push(...MORE_ITEM_PICS); BAG_PICS.push(...MORE_BAG_PICS); AVATARS.push(...MORE_AVATARS);
  [ITEM_PICS, BAG_PICS, AVATARS].forEach((list) => { const u = uniq(list); list.length = 0; list.push(...u); });

  // Fonts that come with iPhones and iPads (other phones and computers fall back to a similar kind).
  const FONTS = [
    ["rounded", "Standard", 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Nunito", system-ui, sans-serif'],
    ["clean", "Clean", '"Avenir Next", Avenir, "Segoe UI", system-ui, sans-serif'],
    ["modern", "Modern", 'Futura, "Century Gothic", "Trebuchet MS", sans-serif'],
    ["classic", "Classic", 'Georgia, "Times New Roman", serif'],
    ["fancy", "Fancy", 'Didot, "Bodoni 72", "Bodoni MT", Georgia, serif'],
    ["handwritten", "Handwritten", '"Bradley Hand", "Segoe Print", "Comic Sans MS", cursive'],
    ["notebook", "Notebook", 'Noteworthy, "Segoe Print", "Comic Sans MS", cursive'],
    ["marker", "Marker", '"Marker Felt", "Comic Sans MS", cursive'],
    ["chalk", "Chalkboard", '"Chalkboard SE", Chalkboard, "Comic Sans MS", cursive'],
    ["typewriter", "Typewriter", '"American Typewriter", "Courier New", monospace'],
    ["sporty", "Sporty", '"DIN Condensed", "Arial Narrow", Impact, sans-serif'],
    ["block", "Block", 'Rockwell, Superclarendon, "Rockwell Extra Bold", Georgia, serif'],
  ];
  const FONT_KEYS = FONTS.map((f) => f[0]);
  /** An emoji (or a few characters) someone typed in: trimmed and kept short. */
  function cleanEmoji(t, fallback) { const v = String(t == null ? "" : t).trim(); return v && Array.from(v).length <= 8 ? v : fallback; }

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
    return { version: VERSION, kids: [], bags: [], checks: {}, log: [], events: [], settings: { speak: true, sound: true, homeBg: "" } };
  }

  function clampCount(n) { n = Math.round(Number(n) || 1); return Math.max(1, Math.min(9, n)); }
  function cleanText(t, max) { return String(t == null ? "" : t).replace(/\s+/g, " ").trim().slice(0, max || 40); }

  function kidById(s, id) { return s.kids.find((k) => k.id === id) || null; }
  function bagById(s, id) { return s.bags.find((b) => b.id === id) || null; }
  function bagsFor(s, kidId) { return s.bags.filter((b) => b.kidId === kidId); }

  function addKid(s, name, avatar, color) {
    const kid = { id: newId("k"), name: cleanText(name, 20) || "Player", avatar: avatar || AVATARS[s.kids.length % AVATARS.length],
      color: color || COLORS[s.kids.length % COLORS.length], theme: "field", font: "rounded", plain: false, faith: false, custom: { bg: PALETTES[0][1], accent: PALETTES[0][2], accent2: PALETTES[0][3] } };
    s.kids.push(kid);
    return kid;
  }
  function removeKid(s, kidId) {
    bagsFor(s, kidId).forEach((b) => removeBag(s, b.id));
    s.events = s.events.filter((e) => e.kidId !== kidId);
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
    s.events.forEach((e) => { if (e.bagId === bagId) e.bagId = ""; });
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
  /** Bags needed today: their weekly days, or a schedule item today that uses them. */
  function bagsToday(s, kidId, date) {
    const fromSchedule = new Set(eventsOn(s, kidId, dayKey(date)).map((e) => e.bagId).filter(Boolean));
    return bagsFor(s, kidId).filter((b) => isToday(b, date) || fromSchedule.has(b.id));
  }

  // ---------- Schedule ----------
  function parseDay(key) { const p = String(key).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
  function addDays(key, n) { const d = parseDay(key); d.setDate(d.getDate() + n); return dayKey(d); }
  function validDay(k) { return typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k) && dayKey(parseDay(k)) === k; }
  function validTime(t) { return typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }
  function cleanEvent(s, kidId, o) {
    const bag = o.bagId && bagById(s, o.bagId);
    return { kidId, date: validDay(o.date) ? o.date : "", time: validTime(o.time) ? o.time : "",
      title: cleanText(o.title, 40) || (bag ? bag.name : ""), bagId: bag && bag.kidId === kidId ? bag.id : "", place: cleanText(o.place, 60), note: cleanText(o.note, 80) };
  }
  /** Adds a schedule item; repeat > 1 also adds it on the same weekday for that many weeks in all. Returns what was added. */
  function addEvent(s, kidId, o, repeat) {
    if (!kidById(s, kidId)) return [];
    const base = cleanEvent(s, kidId, o);
    if (!base.date || !base.title) return [];
    const weeks = Math.max(1, Math.min(MAX_REPEAT, Math.round(Number(repeat) || 1)));
    const group = weeks > 1 ? newId("g") : "";
    const out = [];
    for (let w = 0; w < weeks; w++) {
      const e = Object.assign({ id: newId("e"), group }, base, { date: addDays(base.date, 7 * w) });
      s.events.push(e); out.push(e);
    }
    return out;
  }
  function updateEvent(s, eventId, o) {
    const e = s.events.find((x) => x.id === eventId); if (!e) return false;
    const c = cleanEvent(s, e.kidId, o);
    if (!c.date || !c.title) return false;
    Object.assign(e, c);
    return true;
  }
  /** Removes one schedule item, or with all=true every repeat of it from that date on. */
  function removeEvent(s, eventId, all) {
    const e = s.events.find((x) => x.id === eventId); if (!e) return 0;
    const before = s.events.length;
    s.events = s.events.filter((x) => x.id !== eventId && !(all && e.group && x.group === e.group && x.date >= e.date));
    return before - s.events.length;
  }
  /** Places this player has used before, most recent first, for picking again. */
  function placesFor(s, kidId) {
    const seen = new Map();
    s.events.filter((e) => e.kidId === kidId && e.place).sort((a, b) => b.date.localeCompare(a.date))
      .forEach((e) => { const k = e.place.toLowerCase(); if (!seen.has(k)) seen.set(k, e.place); });
    return Array.from(seen.values()).slice(0, 30);
  }
  const byTime = (a, b) => (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")) || a.title.localeCompare(b.title);
  function eventsOn(s, kidId, key) { return s.events.filter((e) => e.kidId === kidId && e.date === key).sort(byTime); }
  /** The next schedule items from today on. */
  function upcoming(s, kidId, date, n) {
    const key = dayKey(date);
    return s.events.filter((e) => e.kidId === kidId && e.date >= key).sort(byTime).slice(0, n || 3);
  }
  /** Day keys in a month grid (weeks start Sunday), with blanks ("") before the 1st. */
  function monthGrid(year, month) {
    const first = new Date(year, month, 1, 12), days = new Date(year, month + 1, 0, 12).getDate();
    const cells = []; for (let i = 0; i < first.getDay(); i++) cells.push("");
    for (let d = 1; d <= days; d++) cells.push(dayKey(new Date(year, month, d, 12)));
    return cells;
  }
  /** Turns "17:30" into "5:30 PM". */
  function time12(t) {
    if (!validTime(t)) return "";
    let h = Number(t.slice(0, 2)); const m = t.slice(3), ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + m + " " + ap;
  }

  // ---------- Countdown, verse and prayer ----------
  function dayNumber(date) { return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000); }
  function verseFor(date) { return VERSES[((dayNumber(date) % VERSES.length) + VERSES.length) % VERSES.length]; }
  function prayerFor(date, step) { const n = PRAYERS.length; return PRAYERS[(((dayNumber(date) + (step || 0)) % n) + n) % n]; }
  /** When a schedule item starts (a plan with no time counts as the start of its day). */
  function startOf(e) { const d = parseDay(e.date); if (e.time) d.setHours(Number(e.time.slice(0, 2)), Number(e.time.slice(3)), 0, 0); else d.setHours(0, 0, 0, 0); return d; }
  /** The next schedule item that hasn't finished: timed ones stay "next" for 2 hours after they start. */
  function nextUp(s, kidId, now) {
    const today = dayKey(now), limit = now.getTime() - 2 * 3600000;
    return s.events.filter((e) => e.kidId === kidId && e.date >= today && (!e.time || e.date > today || startOf(e).getTime() >= limit))
      .sort((a, b) => (a.date + (a.time || "00:00")).localeCompare(b.date + (b.time || "00:00")))[0] || null;
  }
  /** "in 2 hr 15 min", "tomorrow at 5:30 PM", "in 3 days", "happening now". */
  function countdown(e, now) {
    const days = dayNumber(parseDay(e.date)) - dayNumber(now);
    if (!e.time) return days <= 0 ? "today" : days === 1 ? "tomorrow" : "in " + days + " days";
    const mins = Math.round((startOf(e).getTime() - now.getTime()) / 60000);
    if (mins <= 0) return "happening now";
    if (mins < 60) return "in " + mins + " min";
    if (days === 0 || mins < 6 * 60) { const h = Math.floor(mins / 60), m = mins % 60; return "in " + h + " hr" + (m ? " " + m + " min" : ""); }
    if (days === 1) return "tomorrow at " + time12(e.time);
    return "in " + days + " days";
  }

  // ---------- Custom colors ----------
  function hexRgb(h) { const n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbHex(c) { return "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase(); }
  function mix(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)); }
  function luminance(h) {
    return hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  }
  function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  const isHex = (h) => /^#[0-9a-f]{6}$/i.test(h);
  /** Color wheel math: hue 0-360, saturation and brightness 0-1. */
  function hsvToHex(h, sat, v) {
    h = ((h % 360) + 360) % 360; const c = v * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return rgbHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
  }
  function hexToHsv(hex) {
    const [r, g, b] = hexRgb(hex).map((v) => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
    return { h: (h + 360) % 360, s: max ? d / max : 0, v: max };
  }
  /** The screen colors worked out from a player's three picks, with text that stays readable on each. */
  function customTokens(c) {
    const bg = isHex(c && c.bg) ? c.bg : PALETTES[0][1], accent = isHex(c && c.accent) ? c.accent : PALETTES[0][2];
    const accent2 = isHex(c && c.accent2) ? c.accent2 : PALETTES[0][3];
    const dark = luminance(bg) < 0.18;
    const card = dark ? mix(bg, "#FFFFFF", 0.07) : mix(bg, "#FFFFFF", 0.8);
    const ink = dark ? mix("#FFFFFF", accent, 0.08) : mix("#141218", accent, 0.15);
    const onColor = (x) => (contrast(x, "#FFFFFF") >= contrast(x, "#141218") ? "#FFFFFF" : "#141218");
    return { "--bg": bg, "--card": card, "--ink": ink, "--navy": ink, "--soft": mix(ink, bg, 0.4), "--line": mix(bg, ink, dark ? 0.2 : 0.13),
      "--field": accent, "--on-field": onColor(accent), "--field-soft": mix(card, accent, dark ? 0.3 : 0.16),
      "--orange": accent2, "--on-orange": onColor(accent2), "--orange-soft": mix(card, accent2, dark ? 0.28 : 0.16),
      "--shadow": dark ? "0 1px 0 rgba(0,0,0,.3), 0 10px 28px rgba(0,0,0,.35)" : "0 1px 0 rgba(0,0,0,.04), 0 10px 26px rgba(0,0,0,.08)",
      dark };
  }

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
      s.kids.push({ id: String(k.id), name: cleanText(k.name, 20) || "Player", avatar: cleanEmoji(k.avatar, "⭐"), color: /^#[0-9a-f]{6}$/i.test(k.color) ? k.color : COLORS[0],
        theme: THEME_KEYS.includes(k.theme) ? k.theme : "field", font: FONT_KEYS.includes(k.font) ? k.font : "rounded", plain: k.plain === true, faith: k.faith === true,
        custom: { bg: isHex(k.custom && k.custom.bg) ? k.custom.bg : PALETTES[0][1], accent: isHex(k.custom && k.custom.accent) ? k.custom.accent : PALETTES[0][2],
          accent2: isHex(k.custom && k.custom.accent2) ? k.custom.accent2 : PALETTES[0][3] } });
    });
    const kidIds = new Set(s.kids.map((k) => k.id));
    raw.bags.forEach((b) => {
      if (!b || !b.id || !kidIds.has(String(b.kidId))) return;
      const bag = { id: String(b.id), kidId: String(b.kidId), name: cleanText(b.name, 24) || "My bag", emoji: cleanEmoji(b.emoji, "🎒"),
        days: Array.isArray(b.days) ? b.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [], items: [] };
      (Array.isArray(b.items) ? b.items : []).forEach((i) => {
        if (!i || !i.id) return;
        bag.items.push({ id: String(i.id), emoji: cleanEmoji(i.emoji, "⭐"), name: cleanText(i.name, 30) || "Item", count: clampCount(i.count),
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
    if (Array.isArray(raw.events)) {
      raw.events.forEach((e) => {
        if (!e || !e.id || !kidIds.has(String(e.kidId)) || !validDay(e.date)) return;
        const c = cleanEvent(s, String(e.kidId), e);
        if (c.title) s.events.push(Object.assign({ id: String(e.id), group: typeof e.group === "string" ? e.group : "" }, c));
      });
    }
    if (raw.settings) {
      s.settings.speak = raw.settings.speak !== false; s.settings.sound = raw.settings.sound !== false;
      s.settings.homeBg = isHex(raw.settings.homeBg) ? raw.settings.homeBg.toUpperCase() : "";
    }
    return s;
  }

  return { HOME_COLORS, FONTS, FONT_KEYS, cleanEmoji, hsvToHex, hexToHsv, VERSES, PRAYERS, verseFor, prayerFor, nextUp, countdown, startOf, VERSION, CATS, CAT_KEYS, THEMES, THEME_KEYS, HAIR_KIT, PALETTES, MAX_REPEAT, STATUS, TEMPLATES, TEMPLATE_KEYS, ITEM_PICS, BAG_PICS, AVATARS, COLORS, DAY_LETTERS, DAY_NAMES,
    newId, dayKey, defaultState, kidById, bagById, bagsFor, addKid, removeKid, addBag, removeBag, copyBag, addKit, addItem, removeItem, moveItem,
    isToday, bagsToday, parseDay, addDays, addEvent, updateEvent, removeEvent, eventsOn, upcoming, placesFor, monthGrid, time12, contrast, customTokens, currentCheck, isPacked, togglePacked, startOver, setStatus, summary, finishCheck, attention, normalize };
});
