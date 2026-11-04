// Knot of the Day — app logic.
(() => {
  const KEY = 'knotOfTheDay.v1';
  const byId = Object.fromEntries(KNOTS.map(k => [k.id, k]));
  const prepared = {};
  const prep = k => prepared[k.id] || (prepared[k.id] = KnotEngine.prepare(k));

  // ---------- saved progress (stays on this phone) ----------
  let state = { learned: {}, tries: {}, notes: {}, daily: {} };
  try { const raw = localStorage.getItem(KEY); if (raw) state = Object.assign(state, JSON.parse(raw)); } catch (e) { /* storage unavailable: run without saving */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { } };

  // ---------- dates ----------
  const now = () => new Date();
  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const longDate = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });

  // ---------- knot status ----------
  const isLearned = id => !!state.learned[id];
  const isReady = k => k.needs.every(isLearned);
  const status = k => isLearned(k.id) ? 'learned' : !isReady(k) ? 'locked' : (state.tries[k.id] ? 'practicing' : 'ready');

  function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  // Today's knot is chosen once per day and then stays put.
  function todaysKnot() {
    const key = dayKey(now());
    if (state.daily[key] && byId[state.daily[key]]) return byId[state.daily[key]];
    let pool = KNOTS.filter(k => status(k) === 'practicing');
    if (!pool.length) pool = KNOTS.filter(k => status(k) === 'ready');
    let review = false;
    if (!pool.length) { pool = KNOTS.slice(); review = true; }
    // easiest first: stick to the lowest level available
    const minLevel = Math.min(...pool.map(k => k.level));
    pool = pool.filter(k => k.level === minLevel);
    const pick = pool[hash(key) % pool.length];
    state.daily = { [key]: pick.id };
    state.reviewDay = review ? key : null;
    save();
    return pick;
  }

  // ---------- elements ----------
  const $ = id => document.getElementById(id);
  const stage = $('stage');
  let current = null, step = 0, animFrame = null, shown = null;

  function draw(reveal, withArrow) {
    const k = current, steps = k.steps;
    const next = withArrow && steps[step + 1] ? steps[step + 1].r : null;
    stage.innerHTML = KnotEngine.render(prep(k), reveal, next);
    shown = reveal.slice();
  }

  function animateTo(target) {
    cancelAnimationFrame(animFrame);
    const from = shown ? shown.slice() : target.map(() => 0);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { draw(target, true); return; }
    const t0 = performance.now(), dur = 750;
    const tick = t => {
      const p = Math.min(1, (t - t0) / dur), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const r = target.map((v, i) => from[i] + (v - from[i]) * e);
      if (p < 1) { draw(r, false); animFrame = requestAnimationFrame(tick); } else draw(target, true);
    };
    animFrame = requestAnimationFrame(tick);
  }

  function showStep(i, animate) {
    const k = current;
    step = Math.max(0, Math.min(k.steps.length - 1, i));
    const s = k.steps[step];
    if (animate) animateTo(s.r); else { cancelAnimationFrame(animFrame); draw(s.r, true); }
    const last = step === k.steps.length - 1;
    $('stepnum').textContent = last ? 'Finished knot' : `Step ${step + 1} of ${k.steps.length - 1}`;
    $('caption').textContent = s.t;
    stage.setAttribute('aria-label', `${k.name}, ${$('stepnum').textContent}. ${s.t}. Tap for next step.`);
    $('prev').disabled = step === 0;
    $('next').textContent = last ? 'Start over ↺' : 'Next ›';
    $('dots').innerHTML = k.steps.map((_, j) => `<span class="${j === step ? 'on' : j < step ? 'done' : ''}"></span>`).join('');
  }

  function openKnot(k, fromToday) {
    current = k;
    shown = null;
    const today = todaysKnot();
    const isToday = k.id === today.id;
    const st = status(k);
    $('lesson-badge').textContent = isToday
      ? (state.reviewDay === dayKey(now()) ? 'Today’s review knot' : 'Today’s knot')
      : ({ learned: 'Learned ✔', ready: 'Ready to try', practicing: 'Practicing', locked: 'Coming up' })[st];
    $('lesson-badge').className = 'badge ' + (isToday ? 'today' : st);
    $('knot-name').textContent = k.name;
    $('knot-also').textContent = k.also ? `Also called: ${k.also}` : '';
    $('knot-also').hidden = !k.also;
    $('knot-summary').textContent = k.summary;
    $('knot-sea').textContent = k.sea;
    $('knot-rv').textContent = k.rv;
    $('knot-story').textContent = k.story;
    $('note').value = state.notes[k.id] || '';
    $('note-saved').textContent = '';
    $('go-today').hidden = isToday;
    updateProgressButtons();
    showStep(0, false);
    switchView('lesson');
    if (!fromToday) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateProgressButtons() {
    const k = current, n = state.tries[k.id] || 0, locked = status(k) === 'locked';
    $('tries').textContent = isLearned(k.id)
      ? `Learned on ${new Date(state.learned[k.id]).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.` + (n ? ` Tied ${n} time${n === 1 ? '' : 's'}.` : '')
      : locked ? `Learn ${k.needs.filter(id => !isLearned(id)).map(id => byId[id].name).join(' and ')} first, or go ahead and peek.`
      : n ? `Tied ${n} time${n === 1 ? '' : 's'}. ${n >= 3 ? 'Ready to mark it learned?' : 'Tie it 3 times to really know it.'}` : 'Tie it 3 times to really know it.';
    $('btn-learned').textContent = isLearned(k.id) ? 'Learned ✔ (tap to undo)' : 'Mark as learned';
    $('btn-learned').classList.toggle('is-on', isLearned(k.id));
  }

  function refreshCounts() {
    $('learned-count').textContent = KNOTS.filter(k => isLearned(k.id)).length;
    $('total-count').textContent = KNOTS.length;
  }

  // ---------- My Knots list ----------
  function renderGroups() {
    const today = todaysKnot();
    const groups = [
      ['ready', 'Ready to try next', 'You know everything these build on.'],
      ['practicing', 'Practicing', ''],
      ['learned', 'Learned', ''],
      ['locked', 'Coming up', 'Learn the knot listed under each one to unlock it.'],
    ];
    const merged = KNOTS.map(k => ({ k, s: status(k) }));
    $('groups').innerHTML = groups.map(([key, title, help]) => {
      const items = merged.filter(m => key === 'ready' ? m.s === 'ready' : m.s === key);
      if (!items.length) return '';
      return `<section class="group g-${key}"><h2>${title} <span class="count">${items.length}</span></h2>${help ? `<p class="help">${help}</p>` : ''}<ul>` +
        items.map(({ k }) => {
          const thumb = KnotEngine.render(prep(k), k.steps[k.steps.length - 1].r, null);
          const sub = key === 'locked' ? 'After: ' + k.needs.filter(id => !isLearned(id)).map(id => byId[id].name).join(', ')
            : key === 'learned' ? 'Tap to review' : (state.tries[k.id] ? `Tied ${state.tries[k.id]}×` : 'New');
          return `<li><button class="knot-row" data-id="${k.id}"><span class="thumb">${thumb}</span><span class="row-text"><b>${k.name}${k.id === today.id ? ' <em class="tag">Today</em>' : ''}</b><small>${sub}</small></span><span class="chev">›</span></button></li>`;
        }).join('') + '</ul></section>';
    }).join('');
  }

  function switchView(v) {
    $('view-lesson').hidden = v !== 'lesson';
    $('view-knots').hidden = v !== 'knots';
    $('tab-today').setAttribute('aria-selected', v === 'lesson');
    $('tab-knots').setAttribute('aria-selected', v === 'knots');
    if (v === 'knots') renderGroups();
  }

  let toastTimer;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3800);
  }

  // ---------- events ----------
  const advance = () => showStep(step === current.steps.length - 1 ? 0 : step + 1, step !== current.steps.length - 1);
  stage.addEventListener('click', advance);
  $('next').addEventListener('click', advance);
  $('prev').addEventListener('click', () => showStep(step - 1, false));
  let sx = null;
  stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 50) { e.preventDefault(); dx < 0 ? advance() : showStep(step - 1, false); }
  });
  document.addEventListener('keydown', e => {
    if ($('view-lesson').hidden || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight') advance();
    if (e.key === 'ArrowLeft') showStep(step - 1, false);
  });

  $('btn-tied').addEventListener('click', () => {
    const id = current.id;
    state.tries[id] = (state.tries[id] || 0) + 1; save();
    updateProgressButtons();
    const n = state.tries[id];
    toast(n === 3 && !isLearned(id) ? 'Three times! Mark it learned when it feels easy.' : 'Nice work. Tied it again.');
  });

  $('btn-learned').addEventListener('click', () => {
    const id = current.id;
    const before = new Set(KNOTS.filter(k => isReady(k) && !isLearned(k.id)).map(k => k.id));
    if (isLearned(id)) { delete state.learned[id]; save(); toast(`${current.name} moved back to practicing.`); }
    else {
      state.learned[id] = Date.now(); save();
      const unlocked = KNOTS.filter(k => !before.has(k.id) && k.id !== id && isReady(k) && !isLearned(k.id));
      toast(unlocked.length ? `Learned! Now ready: ${unlocked.map(k => k.name).join(', ')}.` : 'Learned! Well done.');
    }
    updateProgressButtons(); refreshCounts();
  });

  let noteTimer;
  $('note').addEventListener('input', () => {
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      const v = $('note').value.trim();
      if (v) state.notes[current.id] = $('note').value; else delete state.notes[current.id];
      save(); $('note-saved').textContent = 'Saved';
    }, 500);
  });

  $('tab-today').addEventListener('click', () => openKnot(todaysKnot(), true));
  $('tab-knots').addEventListener('click', () => switchView('knots'));
  $('go-today').addEventListener('click', () => openKnot(todaysKnot()));
  $('groups').addEventListener('click', e => {
    const b = e.target.closest('.knot-row'); if (b) openKnot(byId[b.dataset.id]);
  });
  $('reset').addEventListener('click', () => {
    if (!confirm('Clear all learned knots, tie counts, and notes on this phone?')) return;
    state = { learned: {}, tries: {}, notes: {}, daily: {} }; save(); refreshCounts(); renderGroups(); toast('Progress cleared.');
  });

  // A new day may roll over while the app sits open.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    $('today-date').textContent = longDate(now());
    if (!state.daily[dayKey(now())] && !$('view-lesson').hidden) openKnot(todaysKnot(), true);
  });

  // ---------- start ----------
  $('today-date').textContent = longDate(now());
  refreshCounts();
  const hashId = location.hash.slice(1);
  openKnot(byId[hashId] || todaysKnot(), true);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }
})();
