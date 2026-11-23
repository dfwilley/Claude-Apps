// Tests the rules of Squadron Flashback. Run: node tests/squadron-flashback.test.js
const path = require("path"), fs = require("fs");
const dir = path.join(__dirname, "../squadron-flashback");
const SF = require(path.join(dir, "core.js"));
const assert = require("assert");

// The question bank
assert(SF.GROUPS.length >= 10);
assert(SF.BUILTIN_IDS.length >= 120, "plenty of questions");
const texts = new Set();
SF.GROUPS.forEach((g) => {
  assert(/^[a-z]+$/.test(g.code) && g.code !== SF.OWN && g.title);
  assert(g.questions.length >= 10, g.title + " has at least ten questions");
  g.questions.forEach((q) => {
    assert(/[?.]$/.test(q) && q.length > 15 && q.length < 140, "reads as a question: " + q);
    assert(!texts.has(q.toLowerCase()), "no repeats: " + q); texts.add(q.toLowerCase());
    assert(!/[—–]/.test(q), "plain punctuation: " + q);
  });
});
assert.equal(new Set(SF.BUILTIN_IDS).size, SF.BUILTIN_IDS.length);
assert.equal(SF.BUILTIN["lesson-01"].group, "lesson");

// The same day always gives the same question, and different days move around
let s = SF.defaultState();
const d1 = "2026-11-23";
const q1 = SF.todaysQuestion(s, d1);
assert(SF.BUILTIN[q1]);
assert.equal(SF.todaysQuestion(s, d1), q1);
assert.equal(SF.pickQuestion(SF.defaultState(), d1), q1);
const month = new Set(); for (let i = 0; i < 30; i++) month.add(SF.pickQuestion(SF.defaultState(), SF.addDays(d1, i)));
assert(month.size >= 20, "a month of days brings a good spread of questions");

// A different question, and Not for me
const q2 = SF.swapQuestion(s, d1, q1);
assert(q2 && q2 !== q1); assert.equal(SF.todaysQuestion(s, d1), q2);
const q3 = SF.skipQuestion(s, d1, q2);
assert(q3 && q3 !== q2 && s.skipped[q2]); assert.equal(SF.todaysQuestion(s, d1), q3);
for (let i = 0; i < 60; i++) assert.notEqual(SF.pickQuestion(s, SF.addDays(d1, i)), q2, "a skipped question is not asked again");

// Saving an answer; the day's question stays put once answered
const mon = new Date(2026, 10, 23, 19, 5);
const e1 = SF.saveAnswer(s, q3, "  We were low on gas.  \r\nThe ball was high.  ", mon);
assert.equal(e1.text, "We were low on gas.\nThe ball was high."); assert.equal(e1.date, d1); assert.equal(e1.group, SF.BUILTIN[q3].group);
assert.equal(SF.saveAnswer(s, q3, "   ", mon), null); assert.equal(SF.saveAnswer(s, "nope-99", "x", mon), null);
assert.equal(SF.todaysQuestion(s, d1), q3);
const more = SF.anotherQuestion(s, d1, q3);
assert(more && more !== q3 && SF.BUILTIN[more].group !== e1.group, "the next one comes from another chapter");
// Answering again adds to the same story
SF.saveAnswer(s, q3, "One more thing.", new Date(2026, 10, 23, 20));
assert.equal(s.entries.length, 1); assert(e1.text.endsWith("\n\nOne more thing.")); assert(e1.edited);
// The next day brings a new, unanswered question
const d2 = "2026-11-24", q4 = SF.todaysQuestion(s, d2);
assert(q4 !== q3 && !SF.entryFor(s, q4));

// Your own questions come first
const mine = SF.addQuestion(s, "  Tell me about   the cross-country to Pensacola. ", "planes");
assert.equal(mine.text, "Tell me about the cross-country to Pensacola."); assert.equal(SF.addQuestion(s, "  ", "planes"), null);
assert.equal(SF.pickQuestion(s, "2026-11-25"), mine.id);
const e2 = SF.saveAnswer(s, mine.id, "Long day.", new Date(2026, 10, 24, 9));
assert.equal(e2.question, mine.text); assert.equal(SF.removeQuestion(s, mine.id), false, "an answered question stays");
const extra = SF.addQuestion(s, "Throwaway?", "nonsense"); assert.equal(extra.group, SF.GROUPS[0].code);
assert.equal(SF.removeQuestion(s, extra.id), true); assert.equal(s.custom.length, 1);

// A story of your own, editing, deleting
const e3 = SF.saveOwnStory(s, "", "No question for this one.", new Date(2026, 10, 26, 9));
assert.equal(e3.question, "A story of my own"); assert.equal(e3.group, SF.OWN); assert.equal(SF.saveOwnStory(s, "Title", " "), null);
assert.equal(SF.editEntry(s, e3.id, "Changed.").text, "Changed."); assert(e3.edited); assert.equal(SF.editEntry(s, e3.id, ""), null);
assert.equal(SF.groupTitle(SF.OWN), "My own stories");

// Counting: streaks, words
assert.equal(SF.streak(s, "2026-11-24"), 2); assert.equal(SF.streak(s, "2026-11-25"), 2, "today still open keeps the streak");
assert.equal(SF.streak(s, "2026-11-26"), 1); assert.equal(SF.streak(s, "2026-11-28"), 0);
assert.equal(SF.wordCount(" two  words\n"), 2);
const st = SF.stats(s, "2026-11-26");
assert.equal(st.stories, 3); assert.equal(st.open, SF.BUILTIN_IDS.length + 1 - 2 - 1);

// The journal: newest first, by chapter, and finding words
assert.deepEqual(SF.journal(s).map((e) => e.id), [e3.id, e2.id, e1.id]);
assert.equal(SF.journal(s, { find: "BALL gas" }).length, 1); assert.equal(SF.journal(s, { find: "pensacola" })[0].id, e2.id); assert.equal(SF.journal(s, { find: "zzz" }).length, 0);
const groups = SF.byGroup(s);
assert.equal(groups[groups.length - 1].code, SF.OWN); assert.equal(groups.reduce((n, g) => n + g.entries.length, 0), 3);

// The book
s.settings.title = "Dad's <Navy> Days"; s.settings.author = "Granddad";
SF.editEntry(s, e3.id, "First <b>para</b>.\n\nSecond & last.");
const html = SF.bookHtml(s, "2026-11-26");
assert(html.includes("Dad&#39;s &lt;Navy&gt; Days") && !html.includes("<b>para</b>") && html.includes("<p>First &lt;b&gt;para&lt;/b&gt;.</p><p>Second &amp; last.</p>"));
assert(html.includes("told by Granddad") && html.includes("3 stories") && html.includes("For my grandchildren."));
assert(!/https?:\/\//.test(html), "the book loads nothing from the internet");
const txt = SF.bookText(s); assert(txt.startsWith("Dad's <Navy> Days\ntold by Granddad") && txt.includes(mine.text) && txt.includes("MY OWN STORIES"));
assert.equal(SF.slug(s.settings.title), "dad-s-navy-days"); assert.equal(SF.slug("!!!"), "squadron-flashback");

// Backup and restore
const backup = JSON.parse(JSON.stringify(SF.makeBackup(s, new Date(2026, 10, 26))));
assert.equal(backup.app, "squadron-flashback"); assert(!("draft" in backup.state) && !("today" in backup.state));
let phone = SF.defaultState();
assert.deepEqual(SF.mergeBackup(phone, backup), { added: 3, updated: 0 });
assert.equal(phone.custom.length, 1); assert.equal(phone.settings.title, "Dad's <Navy> Days"); assert(phone.skipped[q2]);
assert.deepEqual(SF.mergeBackup(phone, backup), { added: 0, updated: 0 }, "restoring twice adds nothing");
// A newer wording on the phone is kept; a newer wording in the backup comes over
SF.editEntry(phone, e1.id, "Phone wording.", new Date(2026, 10, 30));
assert.deepEqual(SF.mergeBackup(phone, backup), { added: 0, updated: 0 }); assert.equal(phone.entries.find((e) => e.id === e1.id).text, "Phone wording.");
backup.state.entries.find((e) => e.id === e1.id).text = "Backup wording."; backup.state.entries.find((e) => e.id === e1.id).edited = new Date(2026, 11, 5).toISOString();
assert.deepEqual(SF.mergeBackup(phone, backup), { added: 0, updated: 1 });
// The same question answered separately on two phones stays one story
const other = SF.defaultState(); SF.saveAnswer(other, q3, "Other phone.", new Date(2026, 10, 20));
assert.equal(SF.mergeBackup(other, backup).added, 2); assert.equal(other.entries.filter((e) => e.qid === q3).length, 1);
assert.throws(() => SF.mergeBackup(phone, { app: "ask-me-tomorrow", state: { entries: [] } }), /isn't a Squadron Flashback backup/);
assert.throws(() => SF.mergeBackup(phone, null));

// Anything odd in storage is made safe
const n = SF.normalize({ entries: [{ id: "a", text: "ok", date: "bad", group: "zz" }, { id: "a", text: "twice" }, { id: "b" }, null, "x"], custom: [{ id: "lesson-01", text: "clash" }, { id: "c-1", text: " mine " }],
  skipped: { "wings-01": 1, "wings-02": 0 }, today: { date: "2026-11-23", qid: "wings-03" }, draft: { qid: "wings-03", text: "half" }, settings: { title: 5, remindTime: "7pm", author: "Me" }, lastBackup: "yesterday" });
assert.equal(n.entries.length, 1); assert.equal(n.entries[0].group, SF.OWN); assert(/^\d{4}-\d{2}-\d{2}$/.test(n.entries[0].date));
assert.deepEqual(n.custom.map((c) => c.text), ["mine"]); assert.deepEqual(n.skipped, { "wings-01": true });
assert.equal(n.settings.title, "Squadron Flashback"); assert.equal(n.settings.remindTime, "19:00"); assert.equal(n.settings.author, "Me"); assert.equal(n.lastBackup, null);
assert.equal(n.draft.text, "half"); assert.deepEqual(SF.normalize(null), SF.defaultState()); assert.deepEqual(SF.normalize("junk"), SF.defaultState());

// When every question is answered or skipped there is nothing left to ask
const full = SF.defaultState(); SF.BUILTIN_IDS.forEach((id, i) => { if (i % 2) full.skipped[id] = true; else SF.saveAnswer(full, id, "Done.", mon); });
assert.equal(SF.todaysQuestion(full, d1), null); assert.equal(full.today, null); assert.equal(SF.stats(full, d1).open, 0);
assert.equal(SF.swapQuestion(full, d1, "wings-01"), null);

// Reminders: half-hour steps, and a file for each
assert.equal(SF.reminderSlot("19:00"), "1900"); assert.equal(SF.reminderSlot("07:10"), "0700"); assert.equal(SF.reminderSlot("07:20"), "0730"); assert.equal(SF.reminderSlot("23:50"), "0000");
for (let m = 0; m < 1440; m += 30) {
  const slot = String(Math.floor(m / 60)).padStart(2, "0") + String(m % 60).padStart(2, "0");
  const ics = fs.readFileSync(path.join(dir, "reminders", slot + ".ics"), "utf8");
  assert(ics.includes(`T${slot}00\r\n`) && ics.includes("RRULE:FREQ=DAILY") && ics.includes("squadron-flashback/"));
}

// Offline: every file the page needs is on the service worker's list
const sw = fs.readFileSync(path.join(dir, "sw.js"), "utf8"), page = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const shell = JSON.parse(sw.match(/SHELL = (\[.*?\]);/)[1]);
[...page.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]).forEach((f) => assert(shell.includes(f), f + " is kept for offline use"));
shell.filter((f) => f !== "./").forEach((f) => assert(fs.existsSync(path.join(dir, f)), f + " exists"));
// Nothing leaves the phone: no web addresses in the app's own code
["app.js", "core.js", "questions.js", "index.html", "style.css"].forEach((f) => assert(!/https?:\/\/(?!www\.w3\.org)/.test(fs.readFileSync(path.join(dir, f), "utf8")), f + " talks to no server"));

console.log("squadron-flashback: all tests passed");
