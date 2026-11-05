/* Ask Me Tomorrow — one question a day, answered out loud, kept as a memoir.
   Everything is stored on the phone (IndexedDB for recordings, localStorage for settings). */
(() => {
"use strict";

const APP_URL = "https://dfwilley.github.io/Ask-Me-Tomorrow/";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- Questions ---------- */
const CHAPTERS = window.AMT_CHAPTERS;
const CH = Object.fromEntries(CHAPTERS.map((c) => [c.code, c]));
const BUILTIN = {};
CHAPTERS.forEach((c) => c.questions.forEach((q, i) => {
  const id = `${c.code}-${String(i + 1).padStart(2, "0")}`;
  BUILTIN[id] = { id, text: q, chapter: c.code };
}));
// Interleave chapters so consecutive days move around a life: early-01, family-01, school-01, ...
const BUILTIN_ORDER = (() => {
  const out = []; const max = Math.max(...CHAPTERS.map((c) => c.questions.length));
  for (let i = 0; i < max; i++) CHAPTERS.forEach((c) => { if (i < c.questions.length) out.push(`${c.code}-${String(i + 1).padStart(2, "0")}`); });
  return out;
})();

/* ---------- Dates ---------- */
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const longDate = (key) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }); };
const shortDate = (key) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); };
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 864e5);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/* ---------- Settings and state (small, in localStorage) ---------- */
const SKEY = "amt-state-v1";
const DEFAULT_STATE = {
  custom: [],            // {id, text, chapter, added}
  later: {},             // qid -> day it was put off
  never: {},             // qid -> true
  today: null,           // {date, qid}
  settings: { title: "Granddad's Stories", author: "", dedication: "For my grandchildren.", transcript: false, remindTime: "19:00" },
  lastBackup: null,
};
let S;
try { S = Object.assign(structuredClone(DEFAULT_STATE), JSON.parse(localStorage.getItem(SKEY) || "{}")); S.settings = Object.assign({}, DEFAULT_STATE.settings, S.settings); }
catch { S = structuredClone(DEFAULT_STATE); }
const saveState = () => { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch {} };

const qById = (id) => BUILTIN[id] || S.custom.find((c) => c.id === id) || null;

/* ---------- Recordings (IndexedDB) ---------- */
let db;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("ask-me-tomorrow", 1);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains("answers")) d.createObjectStore("answers", { keyPath: "id" }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const tx = (mode, fn) => new Promise((res, rej) => {
  const t = db.transaction("answers", mode); const st = t.objectStore("answers"); let out;
  const r = fn(st); if (r) r.onsuccess = () => { out = r.result; };
  t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
});
const dbAll = () => tx("readonly", (s) => s.getAll());
const dbPut = (a) => tx("readwrite", (s) => s.put(a));
const dbDel = (id) => tx("readwrite", (s) => s.delete(id));

let ANSWERS = []; // all answers, with blobs
const answeredIds = () => new Set(ANSWERS.map((a) => a.qid));
async function reloadAnswers() { ANSWERS = (await dbAll()).sort((a, b) => a.created.localeCompare(b.created)); }

/* ---------- Picking the question ---------- */
function queue() { // your own questions first (oldest first), then the built-in interleaved order
  return [...S.custom.map((c) => c.id), ...BUILTIN_ORDER];
}
function pickNext(exclude = new Set()) {
  const done = answeredIds(); const today = dayKey();
  const ok = (id) => !done.has(id) && !exclude.has(id) && !S.never[id] && qById(id);
  const fresh = queue().find((id) => ok(id) && !(S.later[id] && daysBetween(S.later[id], today) < 14));
  if (fresh) return fresh;
  return queue().find((id) => ok(id)) || null; // fall back to ones put off
}
let current = null; // question id shown on Today
function todaysQuestion() {
  const t = dayKey();
  if (S.today && S.today.date === t && qById(S.today.qid)) return S.today.qid;
  const id = pickNext();
  S.today = id ? { date: t, qid: id } : null; saveState();
  return id;
}

/* ---------- Views ---------- */
const VIEWS = ["today", "memoir", "questions", "book"];
function show(v) {
  VIEWS.forEach((x) => { $("v-" + x).hidden = x !== v; });
  document.querySelectorAll(".tabs button").forEach((b) => { if (b.dataset.v === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  if (v === "memoir") renderMemoir();
  if (v === "questions") renderQuestions();
  if (v === "book") renderBook();
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => { if (!recording) show(b.dataset.v); else toast("Finish recording first."); }));

let toastT;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }

/* ---------- Today ---------- */
function stage(name) { ["ask", "rec", "review", "done", "empty"].forEach((n) => { $("st-" + n).hidden = n !== name; }); }
function renderToday(forceId) {
  $("todayDate").textContent = longDate(dayKey());
  const n = ANSWERS.length;
  $("todayCount").textContent = n ? `${n} ${n === 1 ? "story" : "stories"} saved so far` : "Your first story starts today.";
  $("micErr").hidden = true;
  if (forceId) current = forceId;
  else {
    const tq = todaysQuestion();
    const answeredToday = ANSWERS.some((a) => a.date === dayKey() && a.qid === tq);
    current = tq;
    if (tq && answeredToday) { showQuestion(tq); stage("done"); return; }
  }
  if (!current) { $("qcard").hidden = true; stage("empty"); return; }
  $("qcard").hidden = false; showQuestion(current); stage("ask");
}
function showQuestion(id) {
  const q = qById(id);
  $("qChapter").textContent = id.startsWith("c-") ? `Your question · ${CH[q.chapter]?.title || ""}` : CH[q.chapter].title;
  $("qText").textContent = q.text;
  const prior = ANSWERS.filter((a) => a.qid === id).length;
  $("qHint").textContent = prior ? "You've answered this before — this adds to that story." : "Take your time. Tell it the way you'd tell it at the kitchen table.";
}

$("btnLater").onclick = () => {
  if (!current) return;
  S.later[current] = dayKey(); const next = pickNext(new Set([current]));
  if (S.today && S.today.qid === current) S.today = next ? { date: dayKey(), qid: next } : null; // only swap the day's question, not a bonus one
  saveState();
  renderToday(next || undefined); toast("Okay — I'll ask that one another day.");
};
$("btnNever").onclick = () => {
  if (!current) return;
  if (!confirm("Skip this question for good? You can still answer it later from the Questions page.")) return;
  S.never[current] = true; const next = pickNext(new Set([current]));
  if (S.today && S.today.qid === current) S.today = next ? { date: dayKey(), qid: next } : null;
  saveState(); renderToday(next || undefined);
};
$("btnAnother").onclick = () => {
  const next = pickNext(new Set([current]));
  if (!next) { stage("empty"); $("qcard").hidden = true; return; }
  current = next; showQuestion(next); stage("ask"); window.scrollTo(0, 0);
};
$("btnListen").onclick = () => show("memoir");

/* ---------- Recording ---------- */
let rec = null, stream = null, chunks = [], recording = false, paused = false;
let elapsed = 0, lastTick = 0, tickT = null, audioCtx = null, analyser = null, rafId = null;
let recognizer = null, finalText = "", pendingBlob = null, pendingDur = 0, pendingUrl = null;

function pickMime() {
  if (!window.MediaRecorder) return "";
  for (const m of ["audio/mp4", "audio/mp4;codecs=mp4a.40.2", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {}
  }
  return "";
}

$("btnRec").onclick = startRecording;
async function startRecording() {
  $("micErr").hidden = true;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    return micError("This browser can't record audio. Open the app in Safari on your iPhone.");
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    return micError(e.name === "NotAllowedError"
      ? "The microphone is turned off for this app. In Settings › Safari › Microphone (or the aA menu › Website Settings), allow it, then try again."
      : "Couldn't start the microphone: " + e.message);
  }
  const mime = pickMime();
  try { rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
  catch { rec = new MediaRecorder(stream); }
  chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = finishRecording;
  rec.start(1000);
  recording = true; paused = false; elapsed = 0; lastTick = performance.now();
  tickT = setInterval(tick, 250); tick();
  finalText = ""; $("liveText").textContent = "";
  startMeter(); startTranscript();
  $("btnPause").textContent = "Pause"; $("recState").textContent = "Recording…";
  stage("rec");
  try { await navigator.wakeLock?.request("screen"); } catch {}
}
function micError(msg) { $("micErr").textContent = msg; $("micErr").hidden = false; }
function tick() {
  const now = performance.now();
  if (!paused) elapsed += (now - lastTick) / 1000;
  lastTick = now;
  $("recTime").textContent = mmss(elapsed);
}
$("btnPause").onclick = () => {
  if (!rec) return;
  if (!paused) { try { rec.pause(); } catch {} paused = true; $("btnPause").textContent = "Keep going"; $("recState").textContent = "Paused"; stopTranscript(); }
  else { try { rec.resume(); } catch {} paused = false; lastTick = performance.now(); $("btnPause").textContent = "Pause"; $("recState").textContent = "Recording…"; startTranscript(); }
};
$("btnStop").onclick = () => { if (rec && rec.state !== "inactive") { tick(); rec.stop(); } };

function finishRecording() {
  recording = false; clearInterval(tickT); stopMeter(); stopTranscript();
  stream?.getTracks().forEach((t) => t.stop());
  const type = (rec.mimeType || pickMime() || "audio/mp4").split(";")[0];
  pendingBlob = new Blob(chunks, { type }); pendingDur = elapsed;
  if (pendingUrl) URL.revokeObjectURL(pendingUrl);
  pendingUrl = URL.createObjectURL(pendingBlob);
  $("reviewAudio").src = pendingUrl;
  $("reviewText").value = finalText.trim();
  stage("review");
}
$("btnRedo").onclick = () => {
  if (!confirm("Throw away this recording and start over?")) return;
  pendingBlob = null; stage("ask");
};
$("btnSave").onclick = async () => {
  if (!pendingBlob) return;
  const q = qById(current);
  const a = {
    id: "a-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    qid: current, question: q.text, chapter: q.chapter,
    date: dayKey(), created: new Date().toISOString(),
    duration: Math.round(pendingDur), mime: pendingBlob.type, blob: pendingBlob,
    text: $("reviewText").value.trim(),
  };
  $("btnSave").disabled = true;
  try { await dbPut(a); await reloadAnswers(); }
  catch (e) { $("btnSave").disabled = false; return micError("Couldn't save the story: " + e.message); }
  $("btnSave").disabled = false; pendingBlob = null;
  delete S.later[current]; saveState();
  requestPersist();
  $("todayCount").textContent = `${ANSWERS.length} ${ANSWERS.length === 1 ? "story" : "stories"} saved so far`;
  stage("done");
};

function startMeter() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser(); analyser.fftSize = 512; src.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const loop = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0; for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
      const rms = Math.sqrt(sum / buf.length);
      $("meterBar").style.width = paused ? "0%" : Math.min(100, rms * 400) + "%";
      rafId = requestAnimationFrame(loop);
    };
    loop();
  } catch {}
}
function stopMeter() { cancelAnimationFrame(rafId); $("meterBar").style.width = "0%"; try { audioCtx?.close(); } catch {} audioCtx = null; }

/* ---------- Optional live transcript (Web Speech API) ---------- */
function startTranscript() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!S.settings.transcript || !SR) { $("liveText").hidden = true; return; }
  $("liveText").hidden = false;
  try {
    recognizer = new SR(); recognizer.lang = "en-US"; recognizer.continuous = true; recognizer.interimResults = true;
    recognizer.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript.trim() + " "; else interim += r[0].transcript;
      }
      $("liveText").textContent = (finalText + interim).trim() || "Listening…";
    };
    recognizer.onend = () => { if (recording && !paused && recognizer) { try { recognizer.start(); } catch {} } };
    recognizer.onerror = () => {};
    recognizer.start();
    $("liveText").textContent = finalText.trim() || "Listening…";
  } catch { $("liveText").hidden = true; }
}
function stopTranscript() { const r = recognizer; recognizer = null; try { r?.stop(); } catch {} }

/* ---------- Memoir ---------- */
function chapterOrder(code) { const i = CHAPTERS.findIndex((c) => c.code === code); return i < 0 ? 999 : i; }
function renderMemoir() {
  $("bookTitle").textContent = S.settings.title || "My Stories";
  const secs = ANSWERS.reduce((t, a) => t + (a.duration || 0), 0); const mins = Math.round(secs / 60);
  const len = secs < 60 ? "under a minute" : `about ${mins} ${mins === 1 ? "minute" : "minutes"}`;
  $("bookStats").textContent = ANSWERS.length ? `${stories(ANSWERS.length)} · ${len} of recordings` : "";
  const box = $("memoirList"); box.innerHTML = "";
  if (!ANSWERS.length) { box.innerHTML = `<p class="empty">Your stories will collect here, chapter by chapter.</p>`; return; }
  const byCh = {};
  ANSWERS.forEach((a) => (byCh[a.chapter] ||= []).push(a));
  Object.keys(byCh).sort((a, b) => chapterOrder(a) - chapterOrder(b)).forEach((code) => {
    const h = document.createElement("h2"); h.className = "chap"; h.textContent = CH[code]?.title || "More stories"; box.appendChild(h);
    byCh[code].forEach((a) => box.appendChild(storyCard(a)));
  });
}
function storyCard(a) {
  const el = document.createElement("article"); el.className = "story";
  el.innerHTML = `<h3>${esc(a.question)}</h3>
    <p class="meta">${esc(shortDate(a.date))} · ${mmss(a.duration || 0)}</p>
    <audio controls preload="none"></audio>
    ${a.text ? `<p class="text">${esc(a.text)}</p>` : ""}
    <div class="acts">
      <button class="ghost" data-act="edit">Edit written version</button>
      <button class="ghost" data-act="more">Add to this story</button>
      <button class="ghost" data-act="save">Save recording</button>
      <button class="ghost" data-act="del">Delete</button>
    </div>`;
  el.querySelector("audio").src = URL.createObjectURL(a.blob);
  el.querySelector('[data-act="edit"]').onclick = async () => {
    const t = prompt("Written version of this story:", a.text || "");
    if (t === null) return;
    a.text = t.trim(); await dbPut(a); await reloadAnswers(); renderMemoir(); toast("Saved.");
  };
  el.querySelector('[data-act="more"]').onclick = () => { show("today"); renderToday(a.qid); };
  el.querySelector('[data-act="save"]').onclick = () => {
    const ext = extFor(a.mime);
    offerFile(new File([a.blob], `${slug(a.question)}.${ext}`, { type: a.mime || "audio/mp4" }), "Save this recording", "Send it to family or save it to Files.");
  };
  el.querySelector('[data-act="del"]').onclick = async () => {
    if (!confirm(`Delete this story for good?\n\n“${a.question}”\n\nThis can't be undone unless it's in a backup.`)) return;
    await dbDel(a.id); await reloadAnswers(); renderMemoir(); toast("Deleted.");
  };
  return el;
}
const stories = (n) => `${n} ${n === 1 ? "story" : "stories"}`;
const extFor = (mime) => /webm/.test(mime || "") ? "webm" : /ogg/.test(mime || "") ? "ogg" : "m4a";
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "story";

/* ---------- Questions page ---------- */
function renderQuestions() {
  const sel = $("newQChapter");
  if (!sel.options.length) CHAPTERS.forEach((c) => sel.add(new Option(c.title, c.code)));
  const done = answeredIds(); const box = $("qList"); box.innerHTML = "";
  const status = (id) => done.has(id) ? "✓ Answered" : S.never[id] ? "Skipped" : S.later[id] ? "Later" : "";
  const item = (q, removable) => {
    const wrap = document.createElement("div"); wrap.className = "qwrap";
    const b = document.createElement("button"); b.className = "qitem" + (done.has(q.id) ? " done" : "");
    b.innerHTML = `<span class="q">${esc(q.text)}</span><span class="st">${status(q.id)}</span>`;
    b.onclick = () => { delete S.never[q.id]; saveState(); show("today"); renderToday(q.id); };
    wrap.appendChild(b);
    if (removable && !done.has(q.id)) {
      const d = document.createElement("button"); d.className = "ghost qdel"; d.textContent = "Remove";
      d.onclick = (e) => { e.stopPropagation(); if (!confirm("Remove this question?")) return; S.custom = S.custom.filter((c) => c.id !== q.id); saveState(); renderQuestions(); };
      wrap.appendChild(d);
    }
    return wrap;
  };
  if (S.custom.length) {
    const d = document.createElement("details"); d.className = "chapgroup"; d.open = true;
    d.innerHTML = `<summary>Your questions <span>${S.custom.filter((c) => done.has(c.id)).length} of ${S.custom.length}</span></summary>`;
    S.custom.forEach((c) => d.appendChild(item(c, true))); box.appendChild(d);
  }
  CHAPTERS.forEach((c) => {
    const ids = c.questions.map((_, i) => `${c.code}-${String(i + 1).padStart(2, "0")}`);
    const d = document.createElement("details"); d.className = "chapgroup";
    d.innerHTML = `<summary>${esc(c.title)} <span>${ids.filter((i) => done.has(i)).length} of ${ids.length}</span></summary>`;
    ids.forEach((id) => d.appendChild(item(BUILTIN[id], false))); box.appendChild(d);
  });
}
$("addQ").onsubmit = (e) => {
  e.preventDefault();
  const text = $("newQ").value.trim(); if (!text) return;
  S.custom.push({ id: "c-" + Date.now().toString(36), text, chapter: $("newQChapter").value, added: dayKey() });
  saveState(); $("newQ").value = ""; renderQuestions(); toast("Added. It will come up first.");
};

/* ---------- Book and settings ---------- */
function renderBook() {
  $("setTitle").value = S.settings.title; $("setAuthor").value = S.settings.author;
  $("setDedication").value = S.settings.dedication; $("setTranscript").checked = !!S.settings.transcript;
  $("setTime").value = S.settings.remindTime || "19:00";
  $("lastBackup").textContent = S.lastBackup ? `Last backup: ${shortDate(S.lastBackup)}` : "No backup yet.";
  storageInfo();
}
[["setTitle", "title"], ["setAuthor", "author"], ["setDedication", "dedication"], ["setTime", "remindTime"]].forEach(([id, k]) =>
  $(id).addEventListener("input", () => { S.settings[k] = $(id).value; saveState(); }));
$("setTranscript").addEventListener("change", () => {
  S.settings.transcript = $("setTranscript").checked; saveState();
  if (S.settings.transcript && !(window.SpeechRecognition || window.webkitSpeechRecognition)) toast("This browser doesn't offer speech recognition.");
});
async function storageInfo() {
  try {
    const persisted = await navigator.storage?.persisted?.();
    const est = await navigator.storage?.estimate?.();
    const mb = est ? (est.usage / 1048576).toFixed(1) : null;
    $("storeInfo").textContent = (mb ? `Using about ${mb} MB on this phone. ` : "") + (persisted ? "Storage is protected from automatic clean-up." : "");
  } catch { $("storeInfo").textContent = ""; }
}
async function requestPersist() { try { await navigator.storage?.persist?.(); } catch {} }

// Calendar reminder: opens a ready-made daily repeating event (one file per half hour, in the phone's own time zone).
$("btnRemind").onclick = () => {
  const [h, m] = (S.settings.remindTime || "19:00").split(":").map(Number);
  let mins = Math.round((h * 60 + m) / 30) * 30 % 1440;
  const hhmm = String(Math.floor(mins / 60)).padStart(2, "0") + String(mins % 60).padStart(2, "0");
  if (mins !== h * 60 + m) toast(`Reminders come in half-hour steps: using ${Math.floor(mins / 60) % 12 || 12}:${String(mins % 60).padStart(2, "0")} ${mins < 720 ? "AM" : "PM"}.`);
  window.location.href = `reminders/${hhmm}.ics`;
};

/* ---------- Files: share sheet / download ---------- */
let offered = null, offeredUrl = null;
function offerFile(file, title, text) {
  offered = file; if (offeredUrl) URL.revokeObjectURL(offeredUrl); offeredUrl = URL.createObjectURL(file);
  $("dlgTitle").textContent = title; $("dlgText").textContent = text;
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  $("dlgShare").hidden = !canShare;
  const dl = $("dlgDownload"); dl.href = offeredUrl; dl.download = file.name;
  $("dlg").showModal();
}
$("dlgShare").onclick = async (e) => {
  e.preventDefault();
  try { await navigator.share({ files: [offered], title: offered.name }); $("dlg").close(); }
  catch (err) { if (err.name !== "AbortError") toast("Sharing didn't work — try Download."); }
};
$("dlgDownload").addEventListener("click", () => setTimeout(() => $("dlg").close(), 300));

const blobToDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
async function dataURLToBlob(u) { return (await fetch(u)).blob(); }

/* ---------- Memoir book (one self-contained HTML file) ---------- */
$("btnBook").onclick = async () => {
  if (!ANSWERS.length) return toast("Record a story first.");
  const btn = $("btnBook"); btn.disabled = true; btn.textContent = "Putting the book together…";
  try {
    const st = S.settings; const title = st.title || "My Stories";
    const byCh = {}; ANSWERS.forEach((a) => (byCh[a.chapter] ||= []).push(a));
    const codes = Object.keys(byCh).sort((a, b) => chapterOrder(a) - chapterOrder(b));
    let toc = "", body = "";
    for (const code of codes) {
      const name = CH[code]?.title || "More stories"; const anchor = "ch-" + code;
      toc += `<li><a href="#${anchor}">${esc(name)}</a> <span>${byCh[code].length}</span></li>`;
      body += `<section id="${anchor}"><h2>${esc(name)}</h2>`;
      for (const a of byCh[code]) {
        const src = await blobToDataURL(a.blob);
        body += `<article><h3>${esc(a.question)}</h3><p class="meta">Told ${esc(shortDate(a.date))} · ${mmss(a.duration || 0)}</p>
<audio controls preload="none" src="${src}"></audio>${a.text ? `<div class="text">${esc(a.text).replace(/\n/g, "<br>")}</div>` : `<p class="meta noprint">(Recording only)</p>`}</article>`;
      }
      body += `</section>`;
    }
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
body{margin:0;background:#f6f1e7;color:#2a2420;font:18px/1.6 ui-serif,"New York",Georgia,serif}
main{max-width:680px;margin:0 auto;padding:32px 20px 60px}
header{text-align:center;padding:30px 0 20px;border-bottom:1px solid #d9cfbd;margin-bottom:20px}
h1{font-size:2.3rem;line-height:1.15;margin:0 0 8px}.by{font-style:italic;color:#6c625a;margin:0}
.ded{margin:22px auto 0;max-width:30em;font-style:italic}
nav ol{padding-left:1.2em}nav li span{color:#6c625a;font-size:.85em}
a{color:#8f3a22}h2{font-size:1.6rem;margin:40px 0 10px;border-bottom:1px solid #d9cfbd;padding-bottom:6px}
article{margin:0 0 30px}h3{font-size:1.2rem;margin:0}.meta{color:#6c625a;font:14px -apple-system,system-ui,sans-serif;margin:2px 0 8px}
audio{width:100%}.text{margin-top:10px}
footer{text-align:center;color:#6c625a;font-size:.85rem;margin-top:40px}
@media print{audio,.noprint,nav{display:none}body{background:#fff}h2{break-before:page}article{break-inside:avoid}}
</style></head><body><main>
<header><h1>${esc(title)}</h1>${st.author ? `<p class="by">told by ${esc(st.author)}</p>` : ""}${st.dedication ? `<p class="ded">${esc(st.dedication)}</p>` : ""}</header>
<nav><h2 style="margin-top:0">Chapters</h2><ol>${toc}</ol></nav>
${body}
<footer>${stories(ANSWERS.length)} · made with Ask Me Tomorrow on ${esc(shortDate(dayKey()))}</footer>
</main></body></html>`;
    const file = new File([html], `${slug(title)}.html`, { type: "text/html" });
    offerFile(file, "Your memoir is ready", `${stories(ANSWERS.length)}, ${(file.size / 1048576).toFixed(1)} MB. Send it to family by AirDrop, Messages or email, or save it to Files. It opens in any web browser.`);
  } catch (e) { toast("Couldn't make the book: " + e.message); }
  finally { btn.disabled = false; btn.textContent = "Make the memoir book"; }
};

/* ---------- Backup and restore ---------- */
$("btnBackup").onclick = async () => {
  const btn = $("btnBackup"); btn.disabled = true; btn.textContent = "Packing…";
  try {
    const answers = [];
    for (const a of ANSWERS) { const { blob, ...meta } = a; answers.push({ ...meta, audio: await blobToDataURL(blob) }); }
    const { today, ...keep } = S;
    const data = { app: "ask-me-tomorrow", version: 1, exported: new Date().toISOString(), state: keep, answers };
    const file = new File([JSON.stringify(data)], `ask-me-tomorrow-backup-${dayKey()}.json`, { type: "application/json" });
    S.lastBackup = dayKey(); saveState(); renderBook();
    offerFile(file, "Backup ready", `${stories(answers.length)}, ${(file.size / 1048576).toFixed(1)} MB. Save it to iCloud Drive or Dropbox. To bring the stories back, use “Restore from a backup.”`);
  } catch (e) { toast("Backup failed: " + e.message); }
  finally { btn.disabled = false; btn.textContent = "Back up everything"; }
};
$("fileRestore").onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.app !== "ask-me-tomorrow" || !Array.isArray(data.answers)) throw new Error("That isn't an Ask Me Tomorrow backup.");
    const have = new Set(ANSWERS.map((a) => a.id)); let added = 0;
    for (const a of data.answers) {
      if (have.has(a.id)) continue;
      const { audio, ...meta } = a; await dbPut({ ...meta, blob: await dataURLToBlob(audio) }); added++;
    }
    const st = data.state || {};
    const haveQ = new Set(S.custom.map((c) => c.id));
    (st.custom || []).forEach((c) => { if (!haveQ.has(c.id)) S.custom.push(c); });
    Object.assign(S.never, st.never || {}); Object.assign(S.later, st.later || {});
    if (st.settings) S.settings = Object.assign({}, S.settings, st.settings);
    saveState(); await reloadAnswers(); renderBook(); requestPersist();
    toast(`Restored ${added} ${added === 1 ? "story" : "stories"}.`);
  } catch (err) { toast("Restore failed: " + err.message); }
};

/* ---------- Start ---------- */
window.addEventListener("beforeunload", (e) => { if (recording) { e.preventDefault(); e.returnValue = ""; } });
// If the app is left open overnight, bring up the new day's question when it comes back.
let shownDay = dayKey();
document.addEventListener("visibilitychange", () => {
  if (document.hidden || recording || !$("st-review").hidden || shownDay === dayKey()) return;
  shownDay = dayKey(); if (!$("v-today").hidden) renderToday();
});

(async () => {
  try { db = await openDB(); await reloadAnswers(); }
  catch (e) { micError("This browser won't let the app store stories (private browsing?). " + e.message); }
  renderToday();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();

// For automated checks only.
window.__amt = { state: () => S, answers: () => ANSWERS, pickNext, BUILTIN_ORDER };
})();
