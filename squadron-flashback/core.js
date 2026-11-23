// Squadron Flashback — the rules (which question comes up, the journal, the book, backups),
// kept apart from the screens so tests/squadron-flashback.test.js can check them.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./questions.js"));
  else root.SF = factory(root.SF_GROUPS);
})(this, function (GROUPS) {
  "use strict";

  const VERSION = 1;
  const APP = "squadron-flashback";
  const OWN = "own"; // group code for stories written without a question
  const pad = (n) => String(n).padStart(2, "0");

  const GROUP = {};
  const BUILTIN = {};
  const BUILTIN_IDS = [];
  GROUPS.forEach((g) => {
    GROUP[g.code] = g;
    g.questions.forEach((text, i) => {
      const id = g.code + "-" + pad(i + 1);
      BUILTIN[id] = { id, text, group: g.code };
      BUILTIN_IDS.push(id);
    });
  });
  const groupTitle = (code) => (GROUP[code] ? GROUP[code].title : "My own stories");
  const groupOrder = (code) => { const i = GROUPS.findIndex((g) => g.code === code); return i < 0 ? GROUPS.length : i; };

  /* ---------- Dates ---------- */
  const dayKey = (d) => { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const parseDay = (key) => { const p = String(key).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2], 12); };
  const addDays = (key, n) => { const d = parseDay(key); d.setDate(d.getDate() + n); return dayKey(d); };
  const longDate = (key) => parseDay(key).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const shortDate = (key) => parseDay(key).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  /* ---------- State ---------- */
  function defaultState() {
    return {
      version: VERSION,
      entries: [],   // {id, qid, question, group, text, date, created, edited}
      custom: [],    // your own questions: {id, text, group, added}
      skipped: {},   // question id -> true ("Not for me")
      today: null,   // {date, qid, salt}
      draft: null,   // {qid, text}: what is typed but not saved yet
      settings: { title: "Squadron Flashback", author: "", dedication: "For my grandchildren.", remindTime: "19:00" },
      lastBackup: null,
    };
  }
  const str = (v, max) => (typeof v === "string" ? v.slice(0, max || 200000) : "");
  const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  function cleanEntry(e) {
    if (!e || typeof e !== "object" || !str(e.id) || !str(e.text).trim()) return null;
    const date = isDay(e.date) ? e.date : dayKey();
    return { id: str(e.id, 60), qid: str(e.qid, 60) || null, question: str(e.question, 500) || "A story of my own",
      group: GROUP[e.group] ? e.group : OWN, text: str(e.text), date,
      created: str(e.created, 40) || date + "T12:00:00.000Z", edited: str(e.edited, 40) || null };
  }
  function cleanCustom(c) {
    if (!c || typeof c !== "object" || !str(c.id) || !str(c.text).trim()) return null;
    return { id: str(c.id, 60), text: str(c.text, 500).trim(), group: GROUP[c.group] ? c.group : GROUPS[0].code, added: isDay(c.added) ? c.added : dayKey() };
  }
  // Makes anything read from storage or a backup file safe to use.
  function normalize(raw) {
    const s = defaultState();
    if (!raw || typeof raw !== "object") return s;
    const seen = new Set();
    (Array.isArray(raw.entries) ? raw.entries : []).forEach((e) => { const c = cleanEntry(e); if (c && !seen.has(c.id)) { seen.add(c.id); s.entries.push(c); } });
    const seenQ = new Set();
    (Array.isArray(raw.custom) ? raw.custom : []).forEach((q) => { const c = cleanCustom(q); if (c && !seenQ.has(c.id) && !BUILTIN[c.id]) { seenQ.add(c.id); s.custom.push(c); } });
    if (raw.skipped && typeof raw.skipped === "object") Object.keys(raw.skipped).forEach((k) => { if (raw.skipped[k]) s.skipped[k] = true; });
    if (raw.today && isDay(raw.today.date) && str(raw.today.qid)) s.today = { date: raw.today.date, qid: raw.today.qid, salt: Number(raw.today.salt) || 0 };
    if (raw.draft && typeof raw.draft === "object" && str(raw.draft.text)) s.draft = { qid: str(raw.draft.qid, 60) || null, text: str(raw.draft.text) };
    if (raw.settings && typeof raw.settings === "object") {
      ["title", "author", "dedication"].forEach((k) => { if (typeof raw.settings[k] === "string") s.settings[k] = raw.settings[k].slice(0, 300); });
      if (/^\d{2}:\d{2}$/.test(raw.settings.remindTime || "")) s.settings.remindTime = raw.settings.remindTime;
    }
    if (isDay(raw.lastBackup)) s.lastBackup = raw.lastBackup;
    return s;
  }

  let idCount = 0;
  const newId = (prefix) => prefix + "-" + Date.now().toString(36) + (idCount++).toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- Questions ---------- */
  const questionById = (s, id) => BUILTIN[id] || s.custom.find((c) => c.id === id) || null;
  const answeredIds = (s) => new Set(s.entries.map((e) => e.qid).filter(Boolean));
  const entryFor = (s, qid) => s.entries.find((e) => e.qid === qid) || null;

  function addQuestion(s, text, group) {
    text = String(text || "").trim().replace(/\s+/g, " ").slice(0, 500);
    if (!text) return null;
    const q = { id: newId("c"), text, group: GROUP[group] ? group : GROUPS[0].code, added: dayKey() };
    s.custom.push(q);
    return q;
  }
  function removeQuestion(s, id) { // answered questions stay, so the journal keeps its link
    if (answeredIds(s).has(id)) return false;
    const n = s.custom.length;
    s.custom = s.custom.filter((c) => c.id !== id);
    delete s.skipped[id];
    return s.custom.length < n;
  }

  // A steady "random" number from a piece of text, so the same day always gives the same question.
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
    return h >>> 0;
  }

  // Picks a question nobody has answered or skipped. Your own questions come first, in the order you added them.
  // Otherwise it is a random built-in question, from a different group than the last story when it can be.
  function pickQuestion(s, day, opts) {
    opts = opts || {};
    const exclude = new Set(opts.exclude || []);
    const done = answeredIds(s);
    const open = (id) => !done.has(id) && !s.skipped[id] && !exclude.has(id);
    const mine = s.custom.find((c) => open(c.id));
    if (mine) return mine.id;
    let pool = BUILTIN_IDS.filter(open);
    if (!pool.length) return null;
    const last = s.entries.length ? s.entries.reduce((a, b) => (a.created > b.created ? a : b)).group : null;
    const other = pool.filter((id) => BUILTIN[id].group !== last);
    if (other.length) pool = other;
    return pool[hash(day + "#" + (opts.salt || 0)) % pool.length];
  }

  // The question for the day. It stays the same all day, even after it is answered.
  function todaysQuestion(s, day) {
    const t = s.today;
    if (t && t.date === day && questionById(s, t.qid) && !s.skipped[t.qid]) return t.qid;
    const qid = pickQuestion(s, day);
    s.today = qid ? { date: day, qid, salt: 0 } : null;
    return qid;
  }
  // "A different question": swaps the day's question for another one.
  function swapQuestion(s, day, current) {
    const salt = ((s.today && s.today.date === day && s.today.salt) || 0) + 1;
    const qid = pickQuestion(s, day, { exclude: [current], salt });
    if (qid) s.today = { date: day, qid, salt };
    return qid;
  }
  // "Not for me": never ask this one again (it can still be answered from the Questions page).
  function skipQuestion(s, day, qid) {
    s.skipped[qid] = true;
    if (s.today && s.today.qid === qid) s.today = null;
    return todaysQuestion(s, day);
  }
  // After saving, "I have time for another".
  const anotherQuestion = (s, day, current) => pickQuestion(s, day, { exclude: [current], salt: s.entries.length + 1 });

  /* ---------- Journal ---------- */
  const clean = (t) => String(t || "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();

  // Saves an answer. Answering a question a second time adds to the story already there.
  function saveAnswer(s, qid, text, now) {
    text = clean(text);
    const q = questionById(s, qid);
    if (!q || !text) return null;
    now = now || new Date();
    const had = entryFor(s, qid);
    if (had) { had.text = had.text + "\n\n" + text; had.edited = now.toISOString(); delete s.skipped[qid]; return had; }
    const e = { id: newId("e"), qid, question: q.text, group: q.group, text, date: dayKey(now), created: now.toISOString(), edited: null };
    s.entries.push(e);
    delete s.skipped[qid];
    return e;
  }
  // A story with no question behind it, under a title of your own.
  function saveOwnStory(s, title, text, now) {
    text = clean(text); title = String(title || "").trim().replace(/\s+/g, " ").slice(0, 200);
    if (!text) return null;
    now = now || new Date();
    const e = { id: newId("e"), qid: null, question: title || "A story of my own", group: OWN, text, date: dayKey(now), created: now.toISOString(), edited: null };
    s.entries.push(e);
    return e;
  }
  function editEntry(s, id, text, now) {
    const e = s.entries.find((x) => x.id === id); text = clean(text);
    if (!e || !text) return null;
    if (text !== e.text) { e.text = text; e.edited = (now || new Date()).toISOString(); }
    return e;
  }
  function deleteEntry(s, id) {
    const n = s.entries.length;
    s.entries = s.entries.filter((e) => e.id !== id);
    return s.entries.length < n;
  }

  const wordCount = (t) => (String(t || "").trim().match(/\S+/g) || []).length;
  // How many days in a row have a story, counting back from today (or from yesterday if today is still open).
  function streak(s, day) {
    const days = new Set(s.entries.map((e) => e.date));
    let d = days.has(day) ? day : addDays(day, -1), n = 0;
    while (days.has(d)) { n++; d = addDays(d, -1); }
    return n;
  }
  function stats(s, day) {
    return { stories: s.entries.length, words: s.entries.reduce((t, e) => t + wordCount(e.text), 0), streak: streak(s, day || dayKey()),
      open: BUILTIN_IDS.concat(s.custom.map((c) => c.id)).filter((id) => !answeredIds(s).has(id) && !s.skipped[id]).length };
  }

  // Journal entries, newest first, or sorted into the question groups. `find` filters by words in the question or the story.
  function journal(s, opts) {
    opts = opts || {};
    const words = String(opts.find || "").toLowerCase().split(/\s+/).filter(Boolean);
    const hit = (e) => { const hay = (e.question + " " + e.text).toLowerCase(); return words.every((w) => hay.includes(w)); };
    const list = s.entries.filter(hit);
    if (opts.by === "group") return list.sort((a, b) => groupOrder(a.group) - groupOrder(b.group) || a.created.localeCompare(b.created));
    return list.sort((a, b) => b.created.localeCompare(a.created));
  }
  function byGroup(s) { // [{code, title, entries}] in book order, only groups that have stories
    const out = [];
    journal(s, { by: "group" }).forEach((e) => {
      let g = out[out.length - 1];
      if (!g || g.code !== e.group) { g = { code: e.group, title: groupTitle(e.group), entries: [] }; out.push(g); }
      g.entries.push(e);
    });
    return out;
  }

  /* ---------- The book: one file that opens in any browser and prints cleanly ---------- */
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const paragraphs = (t) => esc(t).split(/\n{2,}/).map((p) => "<p>" + p.replace(/\n/g, "<br>") + "</p>").join("");
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
  const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "squadron-flashback";

  function bookHtml(s, day) {
    const st = s.settings, title = st.title.trim() || "Squadron Flashback";
    const groups = byGroup(s);
    const toc = groups.map((g) => `<li><a href="#g-${g.code}">${esc(g.title)}</a> <span>${g.entries.length}</span></li>`).join("");
    const body = groups.map((g) => `<section id="g-${g.code}"><h2>${esc(g.title)}</h2>` + g.entries.map((e) =>
      `<article><h3>${esc(e.question)}</h3><p class="meta">Written ${esc(shortDate(e.date))}</p><div class="text">${paragraphs(e.text)}</div></article>`).join("") + "</section>").join("\n");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
body{margin:0;background:#f4f1e8;color:#1c2430;font:18px/1.65 ui-serif,"New York",Georgia,serif}
main{max-width:680px;margin:0 auto;padding:32px 20px 60px}
header{text-align:center;padding:30px 0 22px;border-bottom:3px double #b08d3c;margin-bottom:20px}
h1{font-size:2.3rem;line-height:1.15;margin:0 0 8px;color:#14284a}.by{font-style:italic;color:#5c6572;margin:0}
.ded{margin:22px auto 0;max-width:30em;font-style:italic}
nav ol{padding-left:1.2em}nav li span{color:#5c6572;font-size:.85em}
a{color:#14284a}h2{font-size:1.6rem;margin:40px 0 10px;color:#14284a;border-bottom:1px solid #b08d3c;padding-bottom:6px}
article{margin:0 0 30px}h3{font-size:1.2rem;margin:0}.meta{color:#5c6572;font:14px -apple-system,system-ui,sans-serif;margin:2px 0 8px}
.text p{margin:0 0 .8em}
footer{text-align:center;color:#5c6572;font-size:.85rem;margin-top:40px}
@media print{nav{display:none}body{background:#fff}h2{break-before:page}h3{break-after:avoid}}
</style></head><body><main>
<header><h1>${esc(title)}</h1>${st.author.trim() ? `<p class="by">told by ${esc(st.author.trim())}</p>` : ""}${st.dedication.trim() ? `<p class="ded">${esc(st.dedication.trim())}</p>` : ""}</header>
<nav><h2 style="margin-top:0">Chapters</h2><ol>${toc}</ol></nav>
${body}
<footer>${plural(s.entries.length, "story", "stories")} · made with Squadron Flashback on ${esc(shortDate(day || dayKey()))}</footer>
</main></body></html>`;
  }
  // The same stories as plain text, for pasting into an email or a document.
  function bookText(s) {
    const st = s.settings;
    const head = (st.title.trim() || "Squadron Flashback") + (st.author.trim() ? "\ntold by " + st.author.trim() : "");
    return head + "\n\n" + byGroup(s).map((g) => g.title.toUpperCase() + "\n\n" + g.entries.map((e) => e.question + "\n(" + shortDate(e.date) + ")\n\n" + e.text).join("\n\n")).join("\n\n\n") + "\n";
  }

  /* ---------- Backups ---------- */
  function makeBackup(s, now) {
    const keep = { entries: s.entries, custom: s.custom, skipped: s.skipped, settings: s.settings };
    return { app: APP, version: VERSION, exported: (now || new Date()).toISOString(), state: keep };
  }
  // Adds what a backup has that this phone doesn't. Nothing here is thrown away; for a story on both, the newer wording wins.
  function mergeBackup(s, data) {
    if (!data || data.app !== APP || !data.state || !Array.isArray(data.state.entries)) throw new Error("That isn't a Squadron Flashback backup.");
    const inc = normalize(data.state);
    let added = 0, updated = 0;
    inc.custom.forEach((c) => { if (!s.custom.some((x) => x.id === c.id)) s.custom.push(c); });
    inc.entries.forEach((e) => {
      const same = s.entries.find((x) => x.id === e.id) || (e.qid && entryFor(s, e.qid));
      if (!same) { s.entries.push(e); added++; return; }
      const stamp = (x) => x.edited || x.created;
      if (same.text !== e.text && stamp(e) > stamp(same)) { same.text = e.text; same.edited = e.edited || e.created; updated++; }
    });
    Object.keys(inc.skipped).forEach((k) => { s.skipped[k] = true; });
    answeredIds(s).forEach((id) => { delete s.skipped[id]; });
    const blank = defaultState().settings;
    ["title", "author", "dedication"].forEach((k) => { if (s.settings[k] === blank[k] && inc.settings[k] !== blank[k]) s.settings[k] = inc.settings[k]; });
    return { added, updated };
  }

  // Reminder times come in half-hour steps: "19:10" -> "1900".
  function reminderSlot(time) {
    const p = String(time || "19:00").split(":").map(Number);
    const mins = (Math.round(((p[0] || 0) * 60 + (p[1] || 0)) / 30) * 30) % 1440;
    return pad(Math.floor(mins / 60)) + pad(mins % 60);
  }

  return { VERSION, APP, OWN, GROUPS, GROUP, BUILTIN, BUILTIN_IDS, groupTitle, dayKey, addDays, longDate, shortDate, defaultState, normalize,
    questionById, answeredIds, entryFor, addQuestion, removeQuestion, hash, pickQuestion, todaysQuestion, swapQuestion, skipQuestion, anotherQuestion,
    saveAnswer, saveOwnStory, editEntry, deleteEntry, wordCount, streak, stats, journal, byGroup, esc, plural, slug, bookHtml, bookText,
    makeBackup, mergeBackup, reminderSlot };
});
