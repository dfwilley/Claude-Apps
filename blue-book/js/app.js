// Blue Book — the screens.
(function () {
  'use strict';
  const X = window.BBExtract, C = window.BBCareer, I = window.BBImage, S = window.BBStore, E = window.BBExport;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const f1 = v => (v || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const f0 = v => (v || 0).toLocaleString('en-US');
  const main = $('#main');

  let db = null; let tab = 'pages'; let saveTimer = null;
  const ui = { totalsBy: 'type', query: '', filters: {}, reviewPageId: null };

  function emptyDB() { return { version: 1, settings: { name: '', template: X.defaultTemplate(), calibrated: false }, pages: [], flights: [], deployments: [] }; }
  function save(now) {
    clearTimeout(saveTimer);
    const go = () => S.saveDB(db).catch(e => toast('Could not save: ' + e.message, true));
    if (now) return go(); saveTimer = setTimeout(go, 350);
  }
  function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, bad ? 6000 : 2600); }
  function pageLabel(p) { return [p.month ? MONTHS[p.month - 1].slice(0, 3) : '', p.year || '', p.squadron ? '· ' + p.squadron : ''].filter(Boolean).join(' ') || 'Page (month not set)'; }
  const knownTypes = () => [...new Set(db.flights.map(f => f.type).filter(Boolean))];
  const listOf = key => [...new Set(db.flights.map(f => f[key]).concat(db.pages.map(p => p[key])).filter(Boolean))].sort();

  // ---------- Sheets (pop-up panels) ----------
  const sheet = $('#sheet'), sheetBody = $('#sheet-body');
  // onClose runs if the panel is dismissed (tap outside / a Close button) rather than finished.
  let sheetOnClose = null, sheetLocked = false;
  function openSheet(html, onOpen, opts) {
    opts = opts || {}; sheetOnClose = opts.onClose || null; sheetLocked = !!opts.locked;
    sheetBody.innerHTML = html; sheet.hidden = false; document.body.classList.add('locked'); if (onOpen) onOpen(sheetBody);
    const f = sheetBody.querySelector('h2'); if (f) { f.tabIndex = -1; f.focus(); }
  }
  function closeSheet(dismissed) {
    const cb = sheetOnClose; sheetOnClose = null; sheet.hidden = true; sheetBody.innerHTML = ''; document.body.classList.remove('locked');
    if (dismissed && cb) cb();
  }
  sheet.addEventListener('click', e => { if ((e.target === sheet && !sheetLocked) || e.target.closest('[data-close]')) closeSheet(true); });

  // ---------- Tabs ----------
  $$('.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
  function show(t) {
    tab = t; ui.reviewPageId = t === 'pages' ? ui.reviewPageId : null;
    $$('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.tab === t); b.setAttribute('aria-current', b.dataset.tab === t ? 'page' : 'false'); });
    render(); main.scrollTop = 0; window.scrollTo(0, 0);
  }
  function render() {
    const t = C.totals(db.flights);
    $('#sub').textContent = db.flights.length ? `${f1(t.all.hours)} hours · ${f0(t.all.flights)} flights · ${f0(t.all.traps)} traps` : 'Your flight record, from your logbooks';
    if (tab === 'pages') ui.reviewPageId ? renderReview() : renderPages();
    else if (tab === 'totals') renderTotals(t);
    else if (tab === 'timeline') renderTimeline();
    else if (tab === 'search') renderSearch();
    else renderMore();
  }

  // ================= PAGES =================
  function renderPages() {
    const pages = db.pages.slice().sort((a, b) => (a.status === 'review' ? 0 : 1) - (b.status === 'review' ? 0 : 1) || (b.year || 0) - (a.year || 0) || (b.month || 0) - (a.month || 0));
    const toReview = pages.filter(p => p.status === 'review').length;
    main.innerHTML = `
      <section class="card hero">
        <h2>Add logbook pages</h2>
        <p>Photograph one page (or a two-page spread) at a time. Lay the book flat in good light, fill the frame and hold the phone straight over it.</p>
        <div class="btns">
          <button class="primary" id="b-scan">${S.isNative ? 'Scan pages' : 'Take a photo'}</button>
          <button id="b-import">Import photos</button>
        </div>
        <p class="small">Read by ${esc(window.BBOcr.engine())}. Nothing is uploaded.</p>
      </section>
      ${!db.settings.calibrated && db.pages.length ? `<section class="card warn"><p>Columns aren't set up yet. <button class="link" id="b-cols">Set up columns</button></p></section>` : ''}
      ${toReview ? `<p class="section-note">${toReview} page${toReview > 1 ? 's' : ''} waiting for your review.</p>` : ''}
      <section class="pagelist">${pages.map(p => {
        const n = p.status === 'saved' ? db.flights.filter(f => f.pageId === p.id).length : (p.rows || []).filter(r => r.rowType === 'flight').length;
        const flags = p.status === 'saved' ? db.flights.filter(f => f.pageId === p.id && f.flags && f.flags.length).length : (p.rows || []).filter(r => r.rowType === 'flight' && r.flags.length).length;
        return `<button class="pagecard" data-page="${p.id}">
          <img alt="" data-photo="${esc(p.photoId)}" loading="lazy">
          <span class="pc-text"><strong>${esc(pageLabel(p))}</strong>
          <span>${n} flight${n === 1 ? '' : 's'}${p.ship ? ' · ' + esc(p.ship) : ''}</span>
          <span class="${p.status === 'review' ? 'tag-review' : flags ? 'tag-flag' : 'tag-ok'}">${p.status === 'review' ? 'Needs review' : flags ? flags + ' to check' : 'Saved'}</span></span></button>`;
      }).join('') || '<p class="empty">No pages yet. Start with your first logbook page.</p>'}</section>`;
    $('#b-scan').onclick = () => S.isNative ? nativeScan() : $('#pick-camera').click();
    $('#b-import').onclick = () => $('#pick-photos').click();
    if ($('#b-cols')) $('#b-cols').onclick = () => openColumns(db.pages[db.pages.length - 1]);
    $$('[data-page]').forEach(b => b.onclick = () => { ui.reviewPageId = b.dataset.page; render(); window.scrollTo(0, 0); });
    loadThumbs();
  }
  async function loadThumbs() { for (const img of $$('img[data-photo]')) { try { img.src = await S.photoURLAsync(img.dataset.photo); } catch (e) { img.alt = 'photo missing'; } } }

  $('#pick-camera').addEventListener('change', e => { const files = [...e.target.files]; e.target.value = ''; queuePhotos(files); });
  $('#pick-photos').addEventListener('change', e => { const files = [...e.target.files]; e.target.value = ''; queuePhotos(files); });

  async function queuePhotos(files) {
    for (let i = 0; i < files.length; i++) {
      let img;
      try { img = await I.loadImage(files[i]); } catch (e) { toast(e.message, true); continue; }
      const canvas = I.toCanvas(img, 3600);
      const ok = await cropStep(canvas, i + 1, files.length);
      if (!ok) continue;
      const photoId = uid('pg');
      await S.putPhoto(photoId, await I.toBlob(ok, 'image/jpeg', 0.88));
      await newPage(photoId, ok);
    }
  }

  async function nativeScan() {
    let ids;
    try { ids = await S.scan(); } catch (e) { toast(e.message, true); return; }
    for (const id of ids || []) {
      const img = await I.loadURL(S.photoURL(id)); await newPage(id, I.toCanvas(img, 2600));
    }
  }

  // Crop step: auto-found corners you can drag, plus rotate. Resolves with the straightened canvas, or null to skip.
  function cropStep(canvas, n, of) {
    return new Promise(resolve => {
      let src = canvas; let found = I.findPageCorners(src); let corners = found.corners;
      openSheet(`<h2>Straighten page ${of > 1 ? `${n} of ${of}` : ''}</h2>
        <p class="small">${found.found ? 'Found the page edges. Drag a corner if it missed.' : "Couldn't find the page edges — drag the four corners to the page's corners."}</p>
        <div class="cropwrap" id="cropwrap"><canvas id="cropc"></canvas>${[0, 1, 2, 3].map(i => `<div class="handle" data-i="${i}" role="slider" aria-label="Corner ${i + 1}" tabindex="0"></div>`).join('')}<svg id="cropsvg"></svg></div>
        <div class="btns"><button id="c-rot">Rotate</button><button id="c-auto">Find edges again</button><button id="c-skip">Skip this photo</button><button class="primary" id="c-ok">Use this page</button></div>`, body => {
        const cv = $('#cropc', body), wrap = $('#cropwrap', body), svg = $('#cropsvg', body);
        const draw = () => {
          const maxW = Math.min(wrap.clientWidth || 340, 900), s = Math.min(maxW / src.width, (window.innerHeight * 0.55) / src.height);
          cv.width = Math.round(src.width * s); cv.height = Math.round(src.height * s); cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
          wrap.style.height = cv.height + 'px'; wrap.style.width = cv.width + 'px'; svg.setAttribute('width', cv.width); svg.setAttribute('height', cv.height);
          place();
        };
        const place = () => {
          $$('.handle', body).forEach(h => { const [x, y] = corners[+h.dataset.i]; h.style.left = x * cv.width + 'px'; h.style.top = y * cv.height + 'px'; });
          svg.innerHTML = `<polygon points="${corners.map(([x, y]) => `${x * cv.width},${y * cv.height}`).join(' ')}" />`;
        };
        $$('.handle', body).forEach(h => {
          h.addEventListener('pointerdown', e => {
            h.setPointerCapture(e.pointerId); const r = cv.getBoundingClientRect();
            const move = ev => { corners[+h.dataset.i] = [Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))]; place(); };
            const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); };
            h.addEventListener('pointermove', move); h.addEventListener('pointerup', up);
          });
          h.addEventListener('keydown', e => { const d = { ArrowLeft: [-0.005, 0], ArrowRight: [0.005, 0], ArrowUp: [0, -0.005], ArrowDown: [0, 0.005] }[e.key]; if (!d) return; e.preventDefault(); const c = corners[+h.dataset.i]; c[0] = Math.max(0, Math.min(1, c[0] + d[0])); c[1] = Math.max(0, Math.min(1, c[1] + d[1])); place(); });
        });
        $('#c-rot', body).onclick = () => { src = I.rotate(src, 1); found = I.findPageCorners(src); corners = found.corners; draw(); };
        $('#c-auto', body).onclick = () => { found = I.findPageCorners(src); corners = found.corners; place(); };
        $('#c-skip', body).onclick = () => { closeSheet(); resolve(null); };
        $('#c-ok', body).onclick = () => { const out = I.warp(src, corners, 2600); closeSheet(); resolve(out); };
        requestAnimationFrame(draw);
      }, { onClose: () => resolve(null) });
    });
  }

  // A new page: set month/year/squadron/ship, then read it.
  async function newPage(photoId, canvas) {
    const prev = db.pages.slice().sort((a, b) => (b.year || 0) - (a.year || 0) || (b.month || 0) - (a.month || 0))[0];
    let month = prev && prev.month ? prev.month % 12 + 1 : null, year = prev && prev.year ? (prev.month === 12 ? prev.year + 1 : prev.year) : null;
    const page = { id: uid('p'), photoId, added: new Date().toISOString(), status: 'review', year, month, squadron: prev ? prev.squadron : '', ship: prev ? prev.ship : '', w: canvas.width, h: canvas.height };
    db.pages.push(page); save();
    const info = await pageInfo(page, true);
    if (!info) { /* kept as a page to review later */ }
    if (!db.settings.calibrated) { ui.reviewPageId = page.id; await openColumns(page, canvas); }
    await readPage(page, canvas);
  }

  function pageInfo(page, isNew) {
    return new Promise(resolve => {
      const y = page.year || '', yrs = []; for (let v = 1960; v <= new Date().getFullYear(); v++) yrs.push(v);
      openSheet(`<h2>${isNew ? 'Which month is this page?' : 'Page details'}</h2>
        <p class="small">These fill in the date, squadron and ship for every line on the page. A line that names its own ship keeps it.</p>
        <div class="form">
          <label>Month<select id="pi-m"><option value="">—</option>${MONTHS.map((m, i) => `<option value="${i + 1}" ${page.month === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          <label>Year<input id="pi-y" inputmode="numeric" pattern="[0-9]*" maxlength="4" value="${esc(y)}" placeholder="e.g. 1988"></label>
          <label>Squadron<input id="pi-s" list="dl-sq" value="${esc(page.squadron || '')}" placeholder="e.g. VMA-231"></label>
          <label>Ship (if aboard)<input id="pi-ship" list="dl-ship" value="${esc(page.ship || '')}" placeholder="e.g. USS Nassau (LHA-4)"></label>
        </div>
        <datalist id="dl-sq">${listOf('squadron').map(v => `<option value="${esc(v)}">`).join('')}</datalist>
        <datalist id="dl-ship">${listOf('ship').map(v => `<option value="${esc(v)}">`).join('')}</datalist>
        <div class="btns"><button class="primary" id="pi-ok">${isNew ? 'Read this page' : 'Done'}</button></div>`, body => {
        $('#pi-ok', body).onclick = () => {
          page.month = +$('#pi-m', body).value || null; const yy = +$('#pi-y', body).value; page.year = yy >= 1940 && yy <= 2100 ? yy : null;
          page.squadron = $('#pi-s', body).value.trim(); page.ship = $('#pi-ship', body).value.trim(); page.label = pageLabel(page);
          save(); closeSheet(); resolve(page);
        };
      }, { onClose: () => resolve(page) });
    });
  }

  function progress(title, sub) {
    openSheet(`<h2>${esc(title)}</h2><p class="small" id="pg-sub">${esc(sub || '')}</p><div class="bar"><div id="pg-bar"></div></div>`, null, { locked: true });
    return v => { const b = $('#pg-bar'); if (b) b.style.width = Math.round(v * 100) + '%'; };
  }

  async function readPage(page, canvas) {
    const set = progress('Reading the page…', 'This can take up to a minute on a full page. Your photo stays on this phone.');
    try {
      if (!canvas) canvas = I.toCanvas(await I.loadURL(await S.photoURLAsync(page.photoId)), 2600);
      const prepared = I.forReading(canvas); set(0.05);
      const small = I.toCanvas(canvas, 1600); const g = I.grayOf(small);
      page.ruledLines = X.findRuledLines(g.gray, g.w, g.h, 'h', { minFrac: 0.3 }).filter(v => v > 0.015 && v < 0.985);
      page.words = await window.BBOcr.read(page.photoId, prepared.canvas, v => set(0.05 + v * 0.75));
      const bands = X.rowBands(page.words, db.settings.template, page.ruledLines);
      const more = await window.BBOcr.secondLook(prepared, page.words, db.settings.template, bands, v => set(0.8 + v * 0.2));
      page.words = page.words.concat(more);
      extractInto(page);
      closeSheet(); ui.reviewPageId = page.id; tab = 'pages'; render();
      const flagged = page.rows.filter(r => r.rowType === 'flight' && r.flags.length).length;
      toast(`Found ${page.rows.filter(r => r.rowType === 'flight').length} lines${flagged ? `, ${flagged} to check` : ''}.`);
    } catch (e) {
      closeSheet(); page.rows = page.rows || []; save(); ui.reviewPageId = page.id; render();
      toast("Couldn't read the page: " + e.message + ' You can type the lines in.', true);
    }
  }

  function extractInto(page) {
    const res = X.extractPage(page.words || [], db.settings.template, page, { ruledLines: page.ruledLines, knownTypes: knownTypes() });
    page.rows = res.rows.map((r, i) => Object.assign(r, { id: uid('f'), row: i })); page.notes = res.notes; save();
  }

  // ---------- Column setup ----------
  async function openColumns(page, canvas) {
    if (!page) return;
    if (!canvas) canvas = I.toCanvas(await I.loadURL(await S.photoURLAsync(page.photoId)), 2600);
    const tpl = JSON.parse(JSON.stringify(db.settings.template));
    return new Promise(resolve => {
      openSheet(`<h2>Match the columns to your logbook</h2>
        <p class="small">Do this once; every page after uses it. Drag the gold lines onto the printed column lines, and the blue lines to the first and last flight lines. Tap a column to say what it holds.</p>
        <div class="colscroll"><div class="colwrap" id="colwrap"><canvas id="colc"></canvas><div id="colover"></div></div></div>
        <div class="btns"><button id="co-find">Find printed lines</button><button id="co-add">Add a column</button><button id="co-reset">Start over</button><button class="primary" id="co-ok">Save columns</button></div>`, body => {
        const cv = $('#colc', body), over = $('#colover', body), wrap = $('#colwrap', body);
        const W = Math.min(1400, Math.max(900, Math.round(canvas.width * 0.45))), s = W / canvas.width; cv.width = W; cv.height = Math.round(canvas.height * s);
        cv.getContext('2d').drawImage(canvas, 0, 0, cv.width, cv.height); wrap.style.width = cv.width + 'px'; wrap.style.height = cv.height + 'px';
        const draw = () => {
          tpl.columns.sort((a, b) => a.x0 - b.x0);
          over.innerHTML = tpl.columns.map((c, i) => `<button class="colband" data-c="${i}" style="left:${c.x0 * 100}%;width:${(c.x1 - c.x0) * 100}%;top:${tpl.top * 100}%;height:${(tpl.bottom - tpl.top) * 100}%"><span>${esc(X.FIELD[c.field].label)}</span></button>`).join('') +
            tpl.columns.map((c, i) => `<div class="vdiv" data-d="${i}" style="left:${c.x0 * 100}%"></div>`).join('') + `<div class="vdiv" data-d="end" style="left:${tpl.columns[tpl.columns.length - 1].x1 * 100}%"></div>` +
            `<div class="hdiv" data-h="top" style="top:${tpl.top * 100}%"></div><div class="hdiv" data-h="bottom" style="top:${tpl.bottom * 100}%"></div>`;
          $$('.vdiv', over).forEach(d => drag(d, (fx) => {
            const cols = tpl.columns;
            if (d.dataset.d === 'end') { cols[cols.length - 1].x1 = Math.max(cols[cols.length - 1].x0 + 0.01, Math.min(1, fx)); }
            else { const i = +d.dataset.d; const lo = i ? cols[i - 1].x0 + 0.01 : 0, hi = cols[i].x1 - 0.01; const v = Math.max(lo, Math.min(hi, fx)); cols[i].x0 = v; if (i) cols[i - 1].x1 = v; }
          }, 'x'));
          $$('.hdiv', over).forEach(d => drag(d, (_, fy) => { if (d.dataset.h === 'top') tpl.top = Math.max(0, Math.min(tpl.bottom - 0.05, fy)); else tpl.bottom = Math.min(1, Math.max(tpl.top + 0.05, fy)); }, 'y'));
          $$('.colband', over).forEach(b => b.onclick = () => pickField(+b.dataset.c));
        };
        const drag = (el, fn, axis) => el.addEventListener('pointerdown', e => {
          e.preventDefault(); el.setPointerCapture(e.pointerId); const r = cv.getBoundingClientRect();
          const mv = ev => { fn((ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height); if (axis === 'x') el.style.left = ((ev.clientX - r.left) / r.width * 100) + '%'; else el.style.top = ((ev.clientY - r.top) / r.height * 100) + '%'; };
          const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); draw(); };
          el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
        });
        const pickField = i => {
          const c = tpl.columns[i];
          const menu = document.createElement('div'); menu.className = 'fieldmenu';
          menu.innerHTML = `<p><strong>Column ${i + 1}</strong> holds:</p><div class="chips">${X.FIELDS.map(f => `<button data-f="${f.key}" class="${f.key === c.field ? 'on' : ''}">${esc(f.label)}</button>`).join('')}</div>
            <div class="btns"><button data-act="split">Split in two</button>${tpl.columns.length > 1 ? '<button data-act="del">Remove column</button>' : ''}<button data-act="close">Done</button></div>`;
          body.appendChild(menu); menu.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          menu.onclick = e => {
            const b = e.target.closest('button'); if (!b) return;
            if (b.dataset.f) c.field = b.dataset.f;
            if (b.dataset.act === 'split') { const mid = (c.x0 + c.x1) / 2; tpl.columns.splice(i + 1, 0, { field: 'skip', x0: mid, x1: c.x1 }); c.x1 = mid; }
            if (b.dataset.act === 'del') { const gone = tpl.columns.splice(i, 1)[0]; if (tpl.columns[i - 1]) tpl.columns[i - 1].x1 = gone.x1; else if (tpl.columns[0]) tpl.columns[0].x0 = gone.x0; }
            menu.remove(); draw();
          };
        };
        $('#co-find', body).onclick = () => {
          const small = I.toCanvas(canvas, 1600); const g = I.grayOf(small);
          const ys = X.findRuledLines(g.gray, g.w, g.h, 'h', { minFrac: 0.3 }).filter(v => v > 0.015 && v < 0.985);
          const xs = X.findRuledLines(g.gray, g.w, g.h, 'v', { minFrac: 0.25 }).filter(v => v > 0.015 && v < 0.985); // ignore the photo's own edges
          if (xs.length < 3) { toast("Couldn't find printed column lines on this photo; drag them by hand.", true); return; }
          const fields = tpl.columns.map(c => c.field);
          tpl.columns = []; for (let k = 1; k < xs.length; k++) if (xs[k] - xs[k - 1] > 0.008) tpl.columns.push({ field: fields[tpl.columns.length] || 'skip', x0: xs[k - 1], x1: xs[k] });
          if (ys.length >= 4) { // the flight lines start where the evenly spaced lines start (skips a taller heading row)
            const gaps = ys.slice(1).map((v, k) => v - ys[k]); const med = gaps.slice().sort((a, b) => a - b)[gaps.length >> 1];
            const even = k => Math.abs(gaps[k] - med) < med * 0.25; let k0 = 0; while (k0 < gaps.length - 1 && !(even(k0) && even(k0 + 1))) k0++;
            tpl.top = ys[k0]; tpl.bottom = ys[ys.length - 1]; }
          draw(); toast(`Found ${tpl.columns.length} columns. Tap each one to check what it holds.`);
        };
        $('#co-add', body).onclick = () => { const last = tpl.columns[tpl.columns.length - 1]; if (last.x1 < 0.97) tpl.columns.push({ field: 'skip', x0: last.x1, x1: Math.min(1, last.x1 + 0.05) }); else { const mid = (last.x0 + last.x1) / 2; tpl.columns.push({ field: 'skip', x0: mid, x1: last.x1 }); last.x1 = mid; } draw(); };
        $('#co-reset', body).onclick = () => { Object.assign(tpl, X.defaultTemplate()); draw(); };
        $('#co-ok', body).onclick = () => { db.settings.template = tpl; db.settings.calibrated = true; save(); closeSheet(); resolve(); };
        draw();
      }, { onClose: () => resolve() });
    });
  }

  // ---------- Review ----------
  const EDIT_FIELDS = ['date', 'type', 'buno', 'kind', 'squadron', 'total', 'night', 'instActual', 'instSim', 'approaches', 'dayLand', 'nightLand', 'dayShip', 'nightShip', 'dayTraps', 'nightTraps', 'cats', 'ship', 'remarks'];
  const LABEL = Object.assign({}, Object.fromEntries(X.FIELDS.map(f => [f.key, f.label])), { date: 'Date' });

  function rowsOf(page) { return page.status === 'saved' ? db.flights.filter(f => f.pageId === page.id).sort((a, b) => (a.row || 0) - (b.row || 0)) : (page.rows || []); }

  function fieldInput(r, k) {
    const fl = (r.flags || []).filter(x => x.field === k || (k === 'date' && x.field === 'day'));
    const kind = (X.FIELD[k] || {}).kind;
    const v = r[k] == null ? '' : r[k];
    const type = k === 'date' ? 'date' : (kind === 'hours' || kind === 'count') ? 'text' : 'text';
    const im = kind === 'hours' ? 'decimal' : kind === 'count' ? 'numeric' : 'text';
    const wide = k === 'remarks' || k === 'ship' ? ' wide' : '';
    const raw = r.raw && r.raw[k === 'date' ? (r.raw.date != null ? 'date' : 'day') : k];
    return `<label class="fld${fl.length ? ' flag' : ''}${wide}"><span>${esc(LABEL[k])}${fl.length ? ' ⚠' : ''}</span>
      <input data-k="${k}" type="${type}" inputmode="${im}" value="${esc(v)}" ${k === 'type' ? 'list="dl-types" autocapitalize="characters"' : k === 'ship' ? 'list="dl-ship"' : k === 'squadron' ? 'list="dl-sq"' : ''} aria-describedby="${r.id}-${k}-why">
      ${fl.length ? `<small id="${r.id}-${k}-why">${esc(fl.map(x => x.reason).join('; '))}${raw ? ` — read as “${esc(raw)}”` : ''}</small>` : ''}</label>`;
  }

  // Main boxes: always date, type, BuNo, time; plus anything with a value or a question. The rest fold away.
  const CORE = new Set(['date', 'type', 'buno', 'total']);
  function lineFields(r, fields) {
    const hot = k => CORE.has(k) || (r[k] != null && r[k] !== '' && r[k] !== 0) || (r.flags || []).some(x => x.field === k || (k === 'date' && x.field === 'day'));
    const a = fields.filter(hot), b = fields.filter(k => !hot(k));
    return `<div class="lf"><div class="fields">${a.map(k => fieldInput(r, k)).join('')}</div>${b.length ? `<details class="more"><summary>More fields (${b.length})</summary><div class="fields">${b.map(k => fieldInput(r, k)).join('')}</div></details>` : ''}</div>`;
  }

  function renderReview() {
    const page = db.pages.find(p => p.id === ui.reviewPageId); if (!page) { ui.reviewPageId = null; return renderPages(); }
    const rows = rowsOf(page); const flights = rows.filter(r => r.rowType !== 'totals'); const flagged = flights.filter(r => r.flags && r.flags.length).length;
    const shown = new Set(db.settings.template.columns.map(c => c.field === 'day' ? 'date' : c.field));
    ['date', 'total'].forEach(k => shown.add(k));
    const fields = EDIT_FIELDS.filter(k => shown.has(k) || flights.some(r => r[k] != null && r[k] !== ''));
    main.innerHTML = `
      <div class="crumbs"><button class="link" id="rv-back">‹ All pages</button></div>
      <section class="card">
        <div class="rowhead"><h2>${esc(pageLabel(page))}</h2><button id="rv-info">Edit month, squadron, ship</button></div>
        <p class="small">${page.ship ? 'Ship: ' + esc(page.ship) + ' · ' : ''}${flights.length} line${flights.length === 1 ? '' : 's'}${flagged ? ` · <strong class="flagtext">${flagged} flagged</strong> — yellow boxes are the ones it wasn't sure about` : ' · nothing flagged'}</p>
        ${(page.notes || []).map(n => `<p class="note">${esc(n)}</p>`).join('')}
        <details class="fullpage"><summary>Show the whole page</summary><div class="pagewrap"><img id="rv-img" alt="Logbook page photo"><div id="rv-bands"></div></div></details>
      </section>
      <datalist id="dl-types">${[...new Set([...knownTypes(), ...X.KNOWN_TYPES])].map(v => `<option value="${esc(v)}">`).join('')}</datalist>
      <datalist id="dl-sq">${listOf('squadron').map(v => `<option value="${esc(v)}">`).join('')}</datalist>
      <datalist id="dl-ship">${listOf('ship').map(v => `<option value="${esc(v)}">`).join('')}</datalist>
      <section id="rv-rows">${rows.map((r, i) => r.rowType === 'totals' ? `<div class="line totals"><p class="small">Line ${i + 1}: totals line on the page (used only to check the math): ${esc(Object.values(r.raw).join(' '))}</p></div>` :
        `<article class="line${r.flags && r.flags.length ? ' has-flags' : ''}" data-row="${r.id}" id="line-${r.id}">
          <div class="strip"><canvas data-strip="${r.id}" aria-label="Photo of this line"></canvas></div>
          ${lineFields(r, fields)}
          <div class="btns small-btns">${r.flags && r.flags.length ? '<button data-act="ok">Looks right</button>' : '<span class="okmark">✓ No questions</span>'}<button data-act="del">Delete line</button></div>
        </article>`).join('') || '<p class="empty">No lines were found on this page. Check the columns, or add lines by hand.</p>'}</section>
      <div class="btns sticky">
        <button id="rv-add">Add a line</button><button id="rv-cols">Adjust columns &amp; re-read</button>
        <button class="primary" id="rv-save">${page.status === 'saved' ? 'Save changes' : 'Save page'}</button>
      </div>
      <p class="center"><button class="link danger" id="rv-delpage">Delete this page</button></p>`;
    $('#rv-back').onclick = () => { ui.reviewPageId = null; render(); };
    $('#rv-info').onclick = async () => {
      await pageInfo(page, false);
      for (const r of rowsOf(page)) { if (r.rowType === 'totals') continue; if (r.day && page.year && page.month) r.date = X.isoDate(page.year, page.month, r.day); r.squadron = r.squadron || page.squadron; if (!r.ship && X.hasShipWork(r)) r.ship = page.ship; X.recheck(r, 'day'); }
      save(); render();
    };
    $('#rv-cols').onclick = async () => {
      if (page.status === 'saved' && !confirm('Re-reading replaces the lines on this page with a fresh read (your edits on this page will be lost). Continue?')) return;
      await openColumns(page);
      if (page.status === 'saved') { db.flights = db.flights.filter(f => f.pageId !== page.id); page.status = 'review'; }
      if (page.words && page.words.length) { extractInto(page); render(); } else await readPage(page);
    };
    $('#rv-add').onclick = () => {
      const r = { id: uid('f'), rowType: 'flight', flags: [], raw: {}, conf: {}, row: rows.length, squadron: page.squadron, date: page.year && page.month ? X.isoDate(page.year, page.month, 1) : null, pageId: page.id };
      X.sanity(r); if (page.status === 'saved') db.flights.push(r); else page.rows.push(r); save(); render();
      setTimeout(() => { const el = $(`#line-${r.id}`); if (el) { el.scrollIntoView({ block: 'center' }); el.querySelector('input').focus(); } }, 50);
    };
    $('#rv-save').onclick = () => savePage(page);
    $('#rv-delpage').onclick = async () => {
      if (!confirm('Delete this page, its photo and its flights from Blue Book? This cannot be undone.')) return;
      db.flights = db.flights.filter(f => f.pageId !== page.id); db.pages = db.pages.filter(p => p.id !== page.id);
      try { await S.deletePhoto(page.photoId); } catch (e) { /* already gone */ }
      ui.reviewPageId = null; save(true); render(); toast('Page deleted.');
    };
    // edits
    $('#rv-rows').addEventListener('change', e => {
      const inp = e.target.closest('input[data-k]'); if (!inp) return;
      const r = rowsOf(page).find(x => x.id === inp.closest('[data-row]').dataset.row); const k = inp.dataset.k; const kind = (X.FIELD[k] || {}).kind;
      let v = inp.value.trim();
      if (kind === 'hours') { const p = X.parseHours(v); v = p.value; if (p.bad) { toast('Flight times look like 1.5'); } }
      else if (kind === 'count') { const p = X.parseCount(v); v = p.value; }
      else if (k === 'type') v = X.normalizeType(v, knownTypes()).value;
      if (k === 'date') { r.day = v ? +v.slice(8, 10) : null; X.recheck(r, 'day'); }
      r[k] = v === '' ? (kind === 'hours' || kind === 'count' ? null : '') : v;
      X.recheck(r, k); save(); refreshLine(r, fields);
    });
    $('#rv-rows').addEventListener('click', e => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const id = b.closest('[data-row]').dataset.row; const r = rowsOf(page).find(x => x.id === id);
      if (b.dataset.act === 'ok') { r.flags = []; X.sanity(r); r.flags = r.flags.filter(x => x.reason === 'no flight time'); r.checked = true; save(); refreshLine(r, fields); }
      if (b.dataset.act === 'del') { if (page.status === 'saved') db.flights = db.flights.filter(f => f.id !== id); else page.rows = page.rows.filter(x => x.id !== id); save(); render(); }
    });
    drawStrips(page, rows);
  }

  function refreshLine(r, fields) {
    const el = $(`#line-${r.id}`); if (!el) return;
    const focus = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.k;
    el.classList.toggle('has-flags', !!(r.flags && r.flags.length));
    const open = $('details.more', el) && $('details.more', el).open;
    $('.lf', el).outerHTML = lineFields(r, fields); if (open && $('details.more', el)) $('details.more', el).open = true;
    const btns = $('.small-btns', el); btns.innerHTML = (r.flags && r.flags.length ? '<button data-act="ok">Looks right</button>' : '<span class="okmark">✓ No questions</span>') + '<button data-act="del">Delete line</button>';
    if (focus) { const next = $(`input[data-k="${focus}"]`, el); if (next) { /* keep place */ } }
  }

  async function drawStrips(page, rows) {
    let img; try { img = await I.loadURL(await S.photoURLAsync(page.photoId)); } catch (e) { return; }
    const full = $('#rv-img'); if (full) { full.src = img.src; const bands = $('#rv-bands'); if (bands) bands.innerHTML = rows.filter(r => r.band).map(r => `<button class="pband${r.flags && r.flags.length ? ' flag' : ''}" data-go="${r.id}" style="top:${r.band.y0 * 100}%;height:${(r.band.y1 - r.band.y0) * 100}%" aria-label="Go to this line"></button>`).join(''); $$('[data-go]').forEach(b => b.onclick = () => { const el = $(`#line-${b.dataset.go}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }); }
    for (const r of rows) {
      const cv = $(`canvas[data-strip="${r.id}"]`); if (!cv) continue;
      if (!r.band) { cv.parentElement.innerHTML = '<p class="small">Added by hand</p>'; continue; }
      const s = I.strip(img, r.band, 0.006); cv.width = s.width; cv.height = s.height; cv.getContext('2d').drawImage(s, 0, 0);
    }
  }

  function savePage(page) {
    if (page.status !== 'saved') {
      const rows = (page.rows || []).filter(r => r.rowType === 'flight');
      for (const r of rows) { delete r.rowType; r.pageId = page.id; db.flights.push(r); }
      page.status = 'saved'; page.totalsRows = (page.rows || []).filter(r => r.rowType === 'totals'); delete page.rows;
    }
    page.label = pageLabel(page);
    refreshDeployments(); save(true);
    const left = db.flights.filter(f => f.pageId === page.id && f.flags && f.flags.length).length;
    toast(left ? `Saved. ${left} line${left > 1 ? 's' : ''} still marked “needs a look” — find them under Search.` : 'Page saved.');
    const next = db.pages.find(p => p.status === 'review');
    ui.reviewPageId = next ? next.id : null; render(); window.scrollTo(0, 0);
  }

  // Keep suggestions current; never undo something you've confirmed or dismissed.
  function refreshDeployments() {
    const sugg = C.suggestDeployments(db.flights);
    const keep = (db.deployments || []).filter(d => d.status === 'confirmed' || d.status === 'dismissed');
    const keys = new Set(keep.map(d => d.key));
    // confirmed ones keep their name but get fresh numbers if the same run grew
    for (const d of keep) { const s = sugg.find(s => s.key === d.key); if (s && d.status === 'confirmed') Object.assign(d, { end: s.end, days: s.days, flights: s.flights, traps: s.traps, shipLandings: s.shipLandings }); }
    db.deployments = [...keep, ...sugg.filter(s => !keys.has(s.key)).map(s => Object.assign(s, { status: 'suggested' }))];
  }

  // ================= TOTALS =================
  function renderTotals(t) {
    const a = t.all;
    const groups = { type: ['Aircraft', 'Type/model'], squadron: ['Squadron', 'Squadron'], ship: ['Ship', 'Ship'], year: ['Year', 'Year'], daynight: ['Day / night', ''] };
    const sugg = (db.deployments || []).filter(d => d.status === 'suggested').length;
    main.innerHTML = `
      ${!db.flights.length ? '<p class="empty">Save a logbook page and your totals show up here.</p>' : ''}
      <section class="tiles">
        ${[['Total hours', f1(a.hours)], ['Flights', f0(a.flights)], ['Night hours', f1(a.night)], ['Instrument', f1(a.instActual + a.instSim)], ['Traps', f0(a.traps)], ['Night traps', f0(a.nightTraps)], ['Ship landings', f0(a.shipLandings)], ['Cat shots', f0(a.cats)]]
          .map(([l, v]) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`).join('')}
      </section>
      ${a.first ? `<p class="small center">${C.longDate(a.first)} to ${C.longDate(a.last)}</p>` : ''}
      ${sugg ? `<section class="card warn"><p>${sugg} possible deployment${sugg > 1 ? 's' : ''} found from your ship landings. <button class="link" id="go-tl">Review on the Timeline</button></p></section>` : ''}
      <div class="seg" role="tablist">${Object.entries(groups).map(([k, [l]]) => `<button role="tab" data-by="${k}" aria-selected="${ui.totalsBy === k}" class="${ui.totalsBy === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <section class="card tablecard">${ui.totalsBy === 'daynight' ? dayNightTable(a) : groupTable(t[ui.totalsBy], groups[ui.totalsBy][1], a)}</section>`;
    $$('[data-by]').forEach(b => b.onclick = () => { ui.totalsBy = b.dataset.by; render(); });
    if ($('#go-tl')) $('#go-tl').onclick = () => show('timeline');
    $$('[data-filter]').forEach(b => b.onclick = () => { const [k, v] = b.dataset.filter.split('|'); ui.filters = { [k]: v }; ui.query = ''; show('search'); });
  }
  function groupTable(list, label, a) {
    if (!list.length) return '<p class="empty">Nothing here yet.</p>';
    const key = { 'Type/model': 'type', Squadron: 'squadron', Ship: 'ship', Year: 'year' }[label];
    return `<div class="tscroll"><table><thead><tr><th scope="col">${label}</th><th scope="col">Flights</th><th scope="col">Hours</th><th scope="col">Night</th><th scope="col">Instr.</th><th scope="col">Ship ldg</th><th scope="col">Traps</th><th scope="col">Night traps</th><th scope="col">Cats</th></tr></thead><tbody>
      ${list.map(g => `<tr><th scope="row"><button class="link" data-filter="${key}|${esc(g.name)}">${esc(g.name)}</button><small>${g.first ? C.monthYear(g.first) + ' – ' + C.monthYear(g.last) : ''}</small></th><td>${f0(g.flights)}</td><td>${f1(g.hours)}</td><td>${f1(g.night)}</td><td>${f1(g.instActual + g.instSim)}</td><td>${f0(g.shipLandings)}</td><td>${f0(g.traps)}</td><td>${f0(g.nightTraps)}</td><td>${f0(g.cats)}</td></tr>`).join('')}
      <tr class="sum"><th scope="row">All</th><td>${f0(a.flights)}</td><td>${f1(a.hours)}</td><td>${f1(a.night)}</td><td>${f1(a.instActual + a.instSim)}</td><td>${f0(a.shipLandings)}</td><td>${f0(a.traps)}</td><td>${f0(a.nightTraps)}</td><td>${f0(a.cats)}</td></tr></tbody></table></div>
      ${label === 'Ship' ? '<p class="small">Only flights with ship landings, traps or cat shots count toward a ship.</p>' : ''}`;
  }
  function dayNightTable(a) {
    return `<table><thead><tr><th></th><th scope="col">Hours</th><th scope="col">Field landings</th><th scope="col">Ship landings</th><th scope="col">Traps</th></tr></thead><tbody>
      <tr><th scope="row">Day</th><td>${f1(a.day)}</td><td>${f0(a.landings - a.nightLandings)}</td><td>${f0(a.shipLandings - a.nightShipLandings)}</td><td>${f0(a.traps - a.nightTraps)}</td></tr>
      <tr><th scope="row">Night</th><td>${f1(a.night)}</td><td>${f0(a.nightLandings)}</td><td>${f0(a.nightShipLandings)}</td><td>${f0(a.nightTraps)}</td></tr>
      <tr class="sum"><th scope="row">Total</th><td>${f1(a.hours)}</td><td>${f0(a.landings)}</td><td>${f0(a.shipLandings)}</td><td>${f0(a.traps)}</td></tr></tbody></table>
      <p class="small">Day hours are flight time minus night time. Instrument: ${f1(a.instActual)} actual, ${f1(a.instSim)} simulated. Approaches: ${f0(a.approaches)}.</p>`;
  }

  // ================= TIMELINE =================
  function renderTimeline() {
    refreshDeployments();
    const flights = db.flights.filter(f => f.date);
    const deps = (db.deployments || []);
    const confirmed = deps.filter(d => d.status === 'confirmed'), sugg = deps.filter(d => d.status === 'suggested');
    if (!flights.length) { main.innerHTML = '<p class="empty">Save logbook pages and your career timeline builds itself here: squadrons, aircraft, ships and deployments.</p>'; return; }
    const first = flights.reduce((m, f) => f.date < m ? f.date : m, '9999'), last = flights.reduce((m, f) => f.date > m ? f.date : m, '0000');
    const y0 = +first.slice(0, 4), y1 = +last.slice(0, 4) + 1, PX = 110; const width = (y1 - y0) * PX + 20;
    const X0 = iso => 10 + (Date.parse(iso) - Date.UTC(y0, 0, 1)) / (Date.UTC(y1, 0, 1) - Date.UTC(y0, 0, 1)) * (width - 20);
    const lanes = [['Squadron', 'squadron', C.segments(flights, 'squadron', 120)], ['Aircraft', 'type', C.segments(flights, 'type', 120)],
      ['At sea', 'ship', [...confirmed.map(d => ({ value: d.ship, start: d.start, end: d.end, dep: d })), ...sugg.map(d => ({ value: d.ship, start: d.start, end: d.end, dep: d, sugg: true }))]]];
    const colors = ['#14305e', '#b5852a', '#2f7a6e', '#8c3c46', '#5a5a96', '#6e7828', '#3a6ea5', '#9c5a1e'];
    let svg = ''; let yy = 22;
    for (let yr = y0; yr <= y1; yr++) { const x = X0(`${yr}-01-01`); svg += `<line x1="${x}" x2="${x}" y1="14" y2="${22 + lanes.length * 64}" class="yr"/><text x="${x + 3}" y="11" class="yrt">${yr}</text>`; }
    lanes.forEach(([label, key, segs]) => {
      svg += `<text x="${10}" y="${yy + 12}" class="lane">${label}</text>`;
      const names = [...new Set(segs.map(s => s.value))]; const rows = [];
      segs.forEach(s => {
        const xa = X0(s.start), xb = Math.max(xa + 6, X0(s.end) + 3);
        let r = 0; while ((rows[r] || []).some(([a, b]) => xa < b + 2 && xb > a - 2)) r++; (rows[r] = rows[r] || []).push([xa, xb]); if (r > 2) return;
        const by = yy + 18 + r * 15; const c = colors[names.indexOf(s.value) % colors.length];
        const data = s.dep ? `data-dep="${esc(s.dep.key)}"` : `data-seg="${key}|${esc(s.value)}|${s.start}|${s.end}"`;
        svg += `<g class="seg${s.sugg ? ' sugg' : ''}" ${data} tabindex="0" role="button" aria-label="${esc(s.value)}, ${C.monthYear(s.start)} to ${C.monthYear(s.end)}"><rect x="${xa}" y="${by}" width="${xb - xa}" height="13" rx="3" fill="${c}"/>${xb - xa > s.value.length * 6.2 + 6 ? `<text x="${xa + 4}" y="${by + 10}" class="segt">${esc(s.value)}</text>` : ''}<title>${esc(s.value)}: ${C.monthYear(s.start)} – ${C.monthYear(s.end)}${s.flights ? `, ${s.flights} flights, ${f1(s.hours)} hrs` : ''}</title></g>`;
      });
      yy += 64;
    });
    const ms = C.milestones(flights, confirmed);
    main.innerHTML = `
      <section class="card"><h2>Career timeline</h2><p class="small">Swipe sideways. Tap a bar to see those flights.</p>
        <div class="tlscroll"><svg class="tl" width="${width}" height="${yy + 8}" role="img" aria-label="Career timeline">${svg}</svg></div></section>
      ${sugg.length ? `<section class="card"><h2>Possible deployments</h2><p class="small">Found from runs of ship landings with the same ship. Confirm, rename or dismiss each one.</p>
        ${sugg.map(d => depCard(d)).join('')}</section>` : ''}
      ${confirmed.length ? `<section class="card"><h2>Deployments</h2>${confirmed.sort((a, b) => a.start.localeCompare(b.start)).map(d => depCard(d)).join('')}</section>` : ''}
      <section class="card"><h2>Milestones</h2><ol class="ms">${ms.map(m => `<li><button class="link" ${m.flightId ? `data-flight="${m.flightId}"` : `data-dep="${esc(m.deploymentKey)}"`}><time>${C.longDate(m.date)}</time> ${esc(m.text)}</button></li>`).join('')}</ol></section>`;
    $$('[data-seg]').forEach(g => { const go = () => { const [k, v, a, b] = g.dataset.seg.split('|'); ui.filters = { [k]: v, from: a, to: b }; ui.query = ''; show('search'); }; g.onclick = go; g.onkeydown = e => { if (e.key === 'Enter') go(); }; });
    $$('[data-dep]').forEach(g => g.onclick = () => { const d = deps.find(d => d.key === g.dataset.dep); if (d) { ui.filters = { ship: d.ship, from: d.start, to: d.end }; ui.query = ''; show('search'); } });
    $$('[data-flight]').forEach(b => b.onclick = () => openFlight(b.dataset.flight));
    $$('[data-depact]').forEach(b => b.onclick = e => {
      e.stopPropagation(); const d = deps.find(x => x.key === b.dataset.key);
      if (b.dataset.depact === 'confirm') d.status = 'confirmed';
      if (b.dataset.depact === 'dismiss') d.status = 'dismissed';
      if (b.dataset.depact === 'rename') { const n = prompt('Name for this deployment (for example, 22nd MEU, 1991):', d.name); if (n && n.trim()) { d.name = n.trim(); d.status = 'confirmed'; } }
      if (b.dataset.depact === 'unconfirm') d.status = 'suggested';
      save(); render();
    });
  }
  function depCard(d) {
    return `<div class="dep"><div><strong>${esc(d.name)}</strong><span class="small">${C.longDate(d.start)} – ${C.longDate(d.end)} · ${d.flights} flights · ${d.shipLandings} ship landings${d.traps ? ` · ${d.traps} traps` : ''}${d.squadron ? ' · ' + esc(d.squadron) : ''}</span></div>
      <div class="btns small-btns">${d.status === 'suggested' ? `<button class="primary" data-depact="confirm" data-key="${esc(d.key)}">Confirm</button><button data-depact="rename" data-key="${esc(d.key)}">Rename</button><button data-depact="dismiss" data-key="${esc(d.key)}">Not a deployment</button>` :
        `<button data-depact="rename" data-key="${esc(d.key)}">Rename</button><button data-depact="unconfirm" data-key="${esc(d.key)}">Undo</button>`}<button data-dep="${esc(d.key)}">Flights</button></div></div>`;
  }

  // ================= SEARCH =================
  function renderSearch() {
    const fl = ui.filters;
    let res = C.search(db.flights, ui.query, fl);
    if (fl.from) res = res.filter(f => f.date >= fl.from && f.date <= fl.to);
    const t = C.totals(res).all;
    const opt = (k, list, label) => `<label>${label}<select data-f="${k}"><option value="">All</option>${list.map(v => `<option ${fl[k] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`;
    main.innerHTML = `
      <section class="card">
        <label class="searchbox"><span class="sr">Search</span><input id="q" type="search" placeholder="Date, type, BuNo, ship or a word in the remarks" value="${esc(ui.query)}" autocomplete="off"></label>
        <div class="filters">${opt('type', listOf('type'), 'Aircraft')}${opt('squadron', listOf('squadron'), 'Squadron')}${opt('ship', listOf('ship'), 'Ship')}${opt('year', [...new Set(db.flights.map(f => f.date && f.date.slice(0, 4)).filter(Boolean))].sort(), 'Year')}</div>
        <div class="chips"><button data-chip="night" class="${fl.night ? 'on' : ''}">Night flights</button><button data-chip="flagged" class="${fl.flagged ? 'on' : ''}">Needs a look</button>${fl.from ? `<button data-chip="range" class="on">${C.monthYear(fl.from)} – ${C.monthYear(fl.to)} ✕</button>` : ''}</div>
        <p class="small">Try: <em>16 Mar 1988</em>, <em>3/16/88</em>, <em>163853</em>, <em>Nassau</em>, <em>bolter</em>.</p>
      </section>
      <p class="section-note" aria-live="polite">${res.length.toLocaleString('en-US')} flight${res.length === 1 ? '' : 's'} · ${f1(t.hours)} hrs · ${f1(t.night)} night${t.traps ? ` · ${f0(t.traps)} traps` : ''}${t.shipLandings ? ` · ${f0(t.shipLandings)} ship landings` : ''}</p>
      <ul class="results">${res.slice(0, 400).map(f => `<li><button data-flight="${f.id}"><span class="r1"><strong>${esc(f.date ? C.longDate(f.date) : 'No date')}</strong> ${esc(f.type || '')} ${f.buno ? '· ' + esc(f.buno) : ''}${f.flags && f.flags.length ? ' <span class="tag-flag">check</span>' : ''}</span>
        <span class="r2">${f.total != null ? f1(f.total) + ' hrs' : ''}${f.night ? ' · ' + f1(f.night) + ' night' : ''}${(f.dayTraps || 0) + (f.nightTraps || 0) ? ' · ' + ((f.dayTraps || 0) + (f.nightTraps || 0)) + ' trap' : ''}${(f.dayShip || 0) + (f.nightShip || 0) ? ' · ' + ((f.dayShip || 0) + (f.nightShip || 0)) + ' ship ldg' : ''}${f.ship ? ' · ' + esc(f.ship) : ''}${f.squadron ? ' · ' + esc(f.squadron) : ''}</span>
        ${f.remarks ? `<span class="r3">${esc(f.remarks)}</span>` : ''}</button></li>`).join('')}</ul>
      ${res.length > 400 ? '<p class="small center">Showing the first 400. Narrow the search to see more.</p>' : ''}`;
    const q = $('#q'); let tmr;
    q.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => { ui.query = q.value; const pos = q.selectionStart; render(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); }, 250); };
    $$('[data-f]').forEach(s => s.onchange = () => { if (s.value) ui.filters[s.dataset.f] = s.value; else delete ui.filters[s.dataset.f]; render(); });
    $$('[data-chip]').forEach(b => b.onclick = () => { const k = b.dataset.chip; if (k === 'range') { delete ui.filters.from; delete ui.filters.to; } else ui.filters[k] = !ui.filters[k]; render(); });
    $$('[data-flight]').forEach(b => b.onclick = () => openFlight(b.dataset.flight));
  }

  // One flight, with its logbook line one tap from the photo.
  async function openFlight(id) {
    const f = db.flights.find(x => x.id === id); if (!f) return;
    const page = db.pages.find(p => p.id === f.pageId);
    const show = k => f[k] != null && f[k] !== '' && f[k] !== 0;
    const rows = EDIT_FIELDS.filter(k => k !== 'date' && show(k)).map(k => `<div><dt>${esc(LABEL[k])}</dt><dd>${esc(typeof f[k] === 'number' && (X.FIELD[k] || {}).kind === 'hours' ? f1(f[k]) : f[k])}</dd></div>`).join('');
    openSheet(`<h2>${esc(f.date ? C.longDate(f.date) : 'No date')} · ${esc(f.type || '')}</h2>
      ${f.flags && f.flags.length ? `<p class="note">Needs a look: ${esc(f.flags.map(x => `${LABEL[x.field] || x.field} — ${x.reason}`).join('; '))}</p>` : ''}
      <dl class="facts">${rows}</dl>
      ${page ? `<p class="small">From the logbook page ${esc(pageLabel(page))}</p><div class="strip big"><canvas id="fl-strip" aria-label="This flight's line in the logbook"></canvas></div>
      <div class="pagewrap"><img id="fl-page" alt="Logbook page photo"><div class="pband hl" style="top:${f.band ? f.band.y0 * 100 : 0}%;height:${f.band ? (f.band.y1 - f.band.y0) * 100 : 0}%"></div></div>` : ''}
      <div class="btns"><button data-close>Close</button>${page ? '<button class="primary" id="fl-edit">Edit on its page</button>' : ''}</div>`, async body => {
      if (page) {
        $('#fl-edit', body).onclick = () => { closeSheet(); ui.reviewPageId = page.id; show_('pages'); setTimeout(() => { const el = $(`#line-${f.id}`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('pulse'); } }, 300); };
        try {
          const img = await I.loadURL(await S.photoURLAsync(page.photoId)); $('#fl-page', body).src = img.src;
          if (f.band) { const s = I.strip(img, f.band, 0.012); const cv = $('#fl-strip', body); cv.width = s.width; cv.height = s.height; cv.getContext('2d').drawImage(s, 0, 0); } else $('#fl-strip', body).remove();
        } catch (e) { /* photo missing */ }
      }
    });
  }
  const show_ = t => { tab = t; $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); render(); };

  // ================= EXPORT / SETTINGS =================
  async function renderMore() {
    const usage = await S.usage();
    main.innerHTML = `
      <section class="card">
        <h2>Export and share</h2>
        <label class="field">Your name (for the PDF cover)<input id="m-name" value="${esc(db.settings.name || '')}" placeholder="e.g. Maj. D. F. Willey, USMC (Ret.)" autocomplete="name"></label>
        <div class="stack">
          <button class="primary" id="x-pdf">PDF summary for family</button>
          <label class="check"><input type="checkbox" id="x-pdfphotos"> Add the logbook page photos at the end (larger file)</label>
          <button id="x-xlsx">Excel workbook (.xlsx)</button>
          <button id="x-csv">Flights as CSV</button>
          <button id="x-zip">Full backup (.zip): Excel, CSV, data and every page photo</button>
        </div>
        <p class="small">Files are made on this phone. ${S.isNative ? 'You choose where each one goes (Save to Files, AirDrop, Mail…).' : 'Your browser saves or shares each one; nothing is sent anywhere unless you choose to.'}</p>
      </section>
      <section class="card">
        <h2>Your logbook data</h2>
        <p>${db.pages.length} page${db.pages.length === 1 ? '' : 's'} · ${db.flights.length.toLocaleString('en-US')} flights${usage && usage.usage ? ` · about ${(usage.usage / 1048576).toFixed(0)} MB used` : ''}.</p>
        <p class="small">${S.isNative ? "Everything is kept in this app's own folder on your iPhone. It's included in your normal iPhone backup." : "Everything is kept in this browser's private storage on this phone. Make a full backup now and then — clearing Safari's website data would erase it."}</p>
        <div class="stack"><button id="m-cols">Column setup</button><button id="m-restore">Restore from a backup</button><button class="danger" id="m-wipe">Erase everything</button></div>
      </section>
      <section class="card small">
        <h2>Privacy</h2>
        <p>Blue Book never uploads your photos or flight data. The text reader runs on this phone${S.isNative ? " (Apple's built-in reader)" : ' (Tesseract, included with the app)'}, and the app is blocked from contacting any other site. Logbook pages often show a Social Security number; it stays in the photo on this phone and is never read into the data.</p>
      </section>`;
    $('#m-name').onchange = e => { db.settings.name = e.target.value.trim(); save(); };
    const stamp = E.today();
    $('#x-pdf').onclick = () => run('Making the PDF…', async set => { const b = await E.pdf(db, { photos: $('#x-pdfphotos').checked }, S, set); await S.share(`Blue Book Summary ${stamp}.pdf`, b, 'application/pdf'); });
    $('#x-xlsx').onclick = () => run('Making the Excel file…', async () => S.share(`Blue Book ${stamp}.xlsx`, E.workbook(db), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
    $('#x-csv').onclick = () => run('Making the CSV…', async () => S.share(`Blue Book Flights ${stamp}.csv`, new TextEncoder().encode(E.flightsCSV(db)), 'text/csv'));
    $('#x-zip').onclick = () => run('Packing the backup…', async set => S.share(`Blue Book Backup ${stamp}.zip`, await E.backup(db, S, set), 'application/zip'));
    $('#m-cols').onclick = () => { const p = db.pages[db.pages.length - 1]; if (!p) toast('Add a logbook page first.'); else openColumns(p); };
    $('#m-restore').onclick = () => $('#pick-backup').click();
    $('#m-wipe').onclick = async () => {
      if (!confirm('Erase every page, photo and flight from Blue Book on this phone? Make a backup first if you want to keep them.')) return;
      if (prompt('Type ERASE to confirm') !== 'ERASE') return;
      for (const p of db.pages) { try { await S.deletePhoto(p.photoId); } catch (e) { /* ok */ } }
      db = emptyDB(); save(true); toast('Erased.'); render();
    };
  }
  async function run(title, fn) { const set = progress(title, ''); try { await fn(set); closeSheet(); } catch (e) { closeSheet(); toast('Something went wrong: ' + e.message, true); } }

  $('#pick-backup').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    await run('Restoring…', async set => {
      const files = window.BBFiles.unzip(new Uint8Array(await file.arrayBuffer()));
      if (!files['bluebook.json']) throw new Error("This isn't a Blue Book backup.");
      const incoming = JSON.parse(new TextDecoder().decode(files['bluebook.json']));
      if (db.flights.length && !confirm(`Replace the ${db.flights.length} flights on this phone with the ${incoming.flights.length} in the backup?`)) return;
      let i = 0; for (const p of incoming.pages) { const ph = files[`photos/${p.photoId}.jpg`]; if (ph) await S.putPhoto(p.photoId, new Blob([ph], { type: 'image/jpeg' })); set(++i / incoming.pages.length); }
      db = incoming; save(true); toast(`Restored ${db.flights.length} flights and ${db.pages.length} pages.`); render();
    });
  });

  // ---------- Start ----------
  (async function start() {
    try { db = await S.loadDB(); } catch (e) { toast('Could not open your data: ' + e.message, true); }
    if (!db) db = emptyDB();
    db.settings = Object.assign(emptyDB().settings, db.settings || {}); db.deployments = db.deployments || [];
    S.persist();
    render();
    if (!S.isNative && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    window.__bb = { get db() { return db; }, render, readPage, extractInto, savePage, show };
  })();
})();
