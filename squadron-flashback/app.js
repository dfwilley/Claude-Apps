/* Squadron Flashback — the screens. The rules are in core.js; the questions are in questions.js.
   Everything is stored on the phone (the browser's storage for this site). Nothing is uploaded. */
(() => {
"use strict";

const $ = (id) => document.getElementById(id);
const esc = SF.esc;
const SKEY = "sf-state-v1";

let S;
try { S = SF.normalize(JSON.parse(localStorage.getItem(SKEY) || "null")); } catch { S = SF.defaultState(); }
let saveFailed = false;
function save() {
  try { localStorage.setItem(SKEY, JSON.stringify(S)); saveFailed = false; }
  catch { if (!saveFailed) toast("This phone wouldn't save that. Make a backup from the Share page."); saveFailed = true; }
}
const today = () => SF.dayKey();

let toastT;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2800); }

/* ---------- Views ---------- */
const VIEWS = ["today", "journal", "questions", "share"];
function show(v) {
  stopDictation();
  VIEWS.forEach((x) => { $("v-" + x).hidden = x !== v; });
  document.querySelectorAll(".tabs button").forEach((b) => { if (b.dataset.v === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  if (v === "today") renderToday(bonus && !SF.entryFor(S, current) ? current : undefined);
  if (v === "journal") renderJournal();
  if (v === "questions") renderQuestions();
  if (v === "share") renderShare();
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => show(b.dataset.v)));

/* ---------- Today ---------- */
let current = null;  // the question on the Today screen
let bonus = false;   // true when it is not the day's own question (picked from the list, or "another")
let shownDay = today();

function stage(name) { ["write", "done", "empty"].forEach((n) => { $("st-" + n).hidden = n !== name; }); }

function renderToday(forceId) {
  const day = today(); shownDay = day;
  $("todayDate").textContent = SF.longDate(day);
  const st = SF.stats(S, day);
  $("todayCount").textContent = st.stories
    ? `${SF.plural(st.stories, "story", "stories")} in your journal` + (st.streak > 1 ? ` · ${st.streak} days in a row` : "")
    : "Your first story starts today.";
  if (forceId && SF.questionById(S, forceId)) { current = forceId; bonus = forceId !== (S.today && S.today.qid); }
  else {
    current = SF.todaysQuestion(S, day); bonus = false; save();
    if (current && SF.entryFor(S, current)) { showQuestion(current); stage("done"); return; }
  }
  if (!current) { $("qcard").hidden = true; stage("empty"); return; }
  showQuestion(current);
  $("answer").value = S.draft && S.draft.qid === current ? S.draft.text : "";
  $("draftNote").textContent = $("answer").value ? "Picked up where you left off." : "";
  $("pickRow").hidden = bonus;
  stage("write");
}
function showQuestion(id) {
  const q = SF.questionById(S, id);
  $("qcard").hidden = false;
  $("qGroup").textContent = (id.startsWith("c-") ? "Your question · " : "") + SF.groupTitle(q.group);
  $("qText").textContent = q.text;
  $("qHint").textContent = SF.entryFor(S, id) ? "You've answered this one before. Anything you write now is added to that story."
    : "Take your time. Tell it the way you'd tell it in the ready room.";
}

$("answer").addEventListener("input", () => {
  const text = $("answer").value;
  S.draft = text.trim() ? { qid: current, text } : null; save();
  $("draftNote").textContent = "";
});

$("btnSave").onclick = () => {
  stopDictation();
  if (!$("answer").value.trim()) { toast("Write or dictate a few words first."); $("answer").focus(); return; }
  const e = SF.saveAnswer(S, current, $("answer").value);
  if (!e) return;
  S.draft = null; save(); persist();
  $("answer").value = "";
  const st = SF.stats(S, today());
  $("todayCount").textContent = `${SF.plural(st.stories, "story", "stories")} in your journal` + (st.streak > 1 ? ` · ${st.streak} days in a row` : "");
  $("doneNote").textContent = bonus ? "Added to your journal." : "Tomorrow's question will be waiting for you.";
  showQuestion(current); stage("done"); window.scrollTo(0, 0);
};
$("btnSwap").onclick = () => {
  if ($("answer").value.trim() && !confirm("Swap this question for another? What you've typed will be cleared.")) return;
  const next = SF.swapQuestion(S, today(), current);
  if (!next) return toast("That's the only question left.");
  S.draft = null; save(); renderToday();
};
$("btnSkip").onclick = () => {
  if (!confirm("Skip this question for good? You can still answer it later from the Questions page.")) return;
  SF.skipQuestion(S, today(), current); S.draft = null; save(); renderToday();
};
$("btnAnother").onclick = () => {
  const next = SF.anotherQuestion(S, today(), current);
  if (!next) { $("qcard").hidden = true; stage("empty"); return; }
  renderToday(next); window.scrollTo(0, 0);
};
$("btnRead").onclick = () => show("journal");

/* ---------- Dictation (the browser's own speech recognition, where it has one) ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null, dictBase = "";
$("btnDictate").hidden = !SR;
$("btnDictate").onclick = () => (recognizer ? stopDictation() : startDictation());
function startDictation() {
  const box = $("answer");
  try {
    const r = new SR(); r.lang = "en-US"; r.continuous = true; r.interimResults = true;
    dictBase = box.value.trim() ? box.value.replace(/\s*$/, " ") : "";
    let finals = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finals += t.trim() + " "; else interim += t;
      }
      box.value = dictBase + finals + interim;
      S.draft = { qid: current, text: box.value }; save();
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") toast("The microphone is turned off for this app. Use the microphone on the keyboard instead.");
      else if (e.error !== "no-speech" && e.error !== "aborted") toast("Dictation stopped. Use the microphone on the keyboard instead.");
    };
    r.onend = () => { if (recognizer === r) { recognizer = null; dictUi(false); } };
    recognizer = r; r.start(); dictUi(true);
  } catch { recognizer = null; dictUi(false); toast("Dictation isn't available here. Use the microphone on the keyboard."); }
}
function stopDictation() { const r = recognizer; recognizer = null; if (r) { try { r.stop(); } catch {} } dictUi(false); }
function dictUi(on) {
  $("btnDictate").textContent = on ? "■ Stop dictating" : "🎤 Dictate";
  $("btnDictate").classList.toggle("on", on);
  $("listening").hidden = !on;
}

/* ---------- Journal ---------- */
function renderJournal() {
  $("bookTitle").textContent = S.settings.title.trim() || "Squadron Flashback";
  const st = SF.stats(S, today());
  $("bookStats").textContent = st.stories ? `${SF.plural(st.stories, "story", "stories")} · ${SF.plural(st.words, "word", "words")}` : "";
  const box = $("journalList"); box.innerHTML = "";
  const find = $("find").value.trim(), by = $("sortBy").value;
  if (!S.entries.length) { box.innerHTML = `<p class="empty">Your stories will collect here, one day at a time.</p>`; return; }
  const list = SF.journal(S, { find, by });
  if (!list.length) { box.innerHTML = `<p class="empty">No story has “${esc(find)}” in it.</p>`; return; }
  let group = null;
  list.forEach((e) => {
    if (by === "group" && e.group !== group) {
      group = e.group; const h = document.createElement("h2"); h.className = "chap"; h.textContent = SF.groupTitle(group); box.appendChild(h);
    }
    box.appendChild(storyCard(e, by !== "group"));
  });
}
function storyCard(e, showGroup) {
  const el = document.createElement("article"); el.className = "story";
  const view = () => {
    el.innerHTML = `<h3>${esc(e.question)}</h3>
      <p class="meta">${showGroup ? esc(SF.groupTitle(e.group)) + " · " : ""}${esc(SF.shortDate(e.date))}${e.edited ? " · edited" : ""}</p>
      <p class="text">${esc(e.text)}</p>
      <div class="acts"><button class="ghost" data-act="edit">Edit</button><button class="ghost" data-act="del">Delete</button></div>`;
    el.querySelector('[data-act="edit"]').onclick = edit;
    el.querySelector('[data-act="del"]').onclick = () => {
      if (!confirm(`Delete this story for good?\n\n“${e.question}”\n\nThis can't be undone unless it's in a backup.`)) return;
      SF.deleteEntry(S, e.id); save(); renderJournal(); toast("Deleted.");
    };
  };
  const edit = () => {
    el.innerHTML = `<h3>${esc(e.question)}</h3>
      <textarea rows="10" aria-label="Edit this story"></textarea>
      <div class="row big" style="margin-top:8px"><button class="secondary" data-act="cancel">Cancel</button><button class="primary" data-act="ok">Save changes</button></div>`;
    const ta = el.querySelector("textarea"); ta.value = e.text; ta.focus();
    el.querySelector('[data-act="cancel"]').onclick = view;
    el.querySelector('[data-act="ok"]').onclick = () => {
      if (!ta.value.trim()) return toast("To remove a story, use Delete.");
      SF.editEntry(S, e.id, ta.value); save(); view(); toast("Saved.");
    };
  };
  view();
  return el;
}
$("find").addEventListener("input", renderJournal);
$("sortBy").addEventListener("change", renderJournal);
$("btnOwn").onclick = () => { $("ownForm").hidden = false; $("btnOwn").hidden = true; $("ownTitle").focus(); };
$("ownCancel").onclick = () => { $("ownForm").hidden = true; $("btnOwn").hidden = false; };
$("ownForm").onsubmit = (ev) => {
  ev.preventDefault();
  if (!SF.saveOwnStory(S, $("ownTitle").value, $("ownText").value)) return toast("Write the story first.");
  save(); persist(); $("ownTitle").value = ""; $("ownText").value = "";
  $("ownForm").hidden = true; $("btnOwn").hidden = false; renderJournal(); toast("Added to your journal.");
};

/* ---------- Questions ---------- */
function renderQuestions() {
  const sel = $("newQGroup");
  if (!sel.options.length) SF.GROUPS.forEach((g) => sel.add(new Option(g.title, g.code)));
  const done = SF.answeredIds(S), box = $("qList"), open = new Set([...box.querySelectorAll("details[open]")].map((d) => d.dataset.code));
  box.innerHTML = "";
  const item = (q, removable) => {
    const wrap = document.createElement("div"); wrap.className = "qwrap";
    const b = document.createElement("button"); b.className = "qitem" + (done.has(q.id) ? " done" : "");
    b.innerHTML = `<span class="q">${esc(q.text)}</span><span class="st">${done.has(q.id) ? "✓ Answered" : S.skipped[q.id] ? "Skipped" : ""}</span>`;
    b.onclick = () => { delete S.skipped[q.id]; save(); show("today"); renderToday(q.id); };
    wrap.appendChild(b);
    if (removable && !done.has(q.id)) {
      const d = document.createElement("button"); d.className = "ghost qdel"; d.textContent = "Remove";
      d.onclick = () => { if (!confirm("Remove this question?")) return; SF.removeQuestion(S, q.id); if (S.today && S.today.qid === q.id) S.today = null; save(); renderQuestions(); };
      wrap.appendChild(d);
    }
    return wrap;
  };
  const section = (code, title, qs, removable, startOpen) => {
    const d = document.createElement("details"); d.className = "qgroup"; d.dataset.code = code; d.open = open.has(code) || startOpen;
    d.innerHTML = `<summary>${esc(title)} <span>${qs.filter((q) => done.has(q.id)).length} of ${qs.length}</span></summary>`;
    qs.forEach((q) => d.appendChild(item(q, removable))); box.appendChild(d);
  };
  if (S.custom.length) section("mine", "Your questions", S.custom, true, true);
  SF.GROUPS.forEach((g) => section(g.code, g.title, SF.BUILTIN_IDS.filter((id) => SF.BUILTIN[id].group === g.code).map((id) => SF.BUILTIN[id]), false, false));
}
$("addQ").onsubmit = (ev) => {
  ev.preventDefault();
  if (!SF.addQuestion(S, $("newQ").value, $("newQGroup").value)) return;
  save(); $("newQ").value = ""; renderQuestions(); toast("Added. It will come up first.");
};

/* ---------- Share and settings ---------- */
function renderShare() {
  $("setTitle").value = S.settings.title; $("setAuthor").value = S.settings.author;
  $("setDedication").value = S.settings.dedication; $("setTime").value = S.settings.remindTime;
  $("lastBackup").textContent = S.lastBackup ? `Last backup: ${SF.shortDate(S.lastBackup)}` : "No backup yet.";
}
[["setTitle", "title"], ["setAuthor", "author"], ["setDedication", "dedication"], ["setTime", "remindTime"]].forEach(([id, k]) =>
  $(id).addEventListener("input", () => { S.settings[k] = $(id).value; save(); }));

async function persist() { try { await navigator.storage?.persist?.(); } catch {} }

// Calendar reminder: opens a ready-made daily repeating event (one file per half hour, in the phone's own time zone).
$("btnRemind").onclick = () => {
  const slot = SF.reminderSlot(S.settings.remindTime), h = Number(slot.slice(0, 2)), m = slot.slice(2);
  if (slot !== S.settings.remindTime.replace(":", "")) toast(`Reminders come in half-hour steps: using ${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}.`);
  window.location.href = `reminders/${slot}.ics`;
};

let offered = null, offeredUrl = null;
function offerFile(file, title, text) {
  offered = file; if (offeredUrl) URL.revokeObjectURL(offeredUrl); offeredUrl = URL.createObjectURL(file);
  $("dlgTitle").textContent = title; $("dlgText").textContent = text;
  $("dlgShare").hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
  const dl = $("dlgDownload"); dl.href = offeredUrl; dl.download = file.name;
  $("dlg").showModal();
}
$("dlgShare").onclick = async (e) => {
  e.preventDefault();
  try { await navigator.share({ files: [offered], title: offered.name }); $("dlg").close(); }
  catch (err) { if (err.name !== "AbortError") toast("Sharing didn't work. Try Download."); }
};
$("dlgDownload").addEventListener("click", () => setTimeout(() => $("dlg").close(), 300));

const count = () => SF.plural(S.entries.length, "story", "stories");
const fileName = () => SF.slug(S.settings.title);
$("btnBook").onclick = () => {
  if (!S.entries.length) return toast("Write a story first.");
  offerFile(new File([SF.bookHtml(S, today())], fileName() + ".html", { type: "text/html" }), "Your book is ready",
    `${count()}. Send it to family by AirDrop, Messages or email, or save it to Files. It opens in any web browser and prints as a book.`);
};
$("btnText").onclick = () => {
  if (!S.entries.length) return toast("Write a story first.");
  offerFile(new File([SF.bookText(S)], fileName() + ".txt", { type: "text/plain" }), "Plain text is ready", `${count()}, ready to paste into an email or a document.`);
};
$("btnBackup").onclick = () => {
  const file = new File([JSON.stringify(SF.makeBackup(S))], `squadron-flashback-backup-${today()}.json`, { type: "application/json" });
  S.lastBackup = today(); save(); renderShare();
  offerFile(file, "Backup ready", `${count()}. Save it to iCloud Drive or Dropbox. To bring the stories back, use “Restore from a backup.”`);
};
$("fileRestore").onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    let data; try { data = JSON.parse(await f.text()); } catch { throw new Error("That file can't be read as a backup."); }
    const r = SF.mergeBackup(S, data);
    save(); persist(); renderShare();
    toast(`Restored ${SF.plural(r.added, "story", "stories")}` + (r.updated ? `, updated ${r.updated}.` : "."));
  } catch (err) { toast(err.message); }
};

/* ---------- Start ---------- */
// If the app is left open overnight, bring up the new day's question when it comes back.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { stopDictation(); return; }
  if (shownDay === today() || $("answer").value.trim()) return;
  if (!$("v-today").hidden) renderToday();
});

renderToday();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

// For automated checks only.
window.__sf = { state: () => S };
})();
