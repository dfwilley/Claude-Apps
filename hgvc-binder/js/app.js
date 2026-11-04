// HGVC Binder — the screens.
(function () {
  'use strict';
  const H = window.HB, Store = window.Store;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => H.iso(new Date());

  let S = H.emptyState();
  let tab = 'all';
  let sub = 'points';
  const RULES_URL = 'https://club.hiltongrandvacations.com/en/help/club-navigator/types-of-points';

  // ---------- saving ----------
  let saveTimer = null;
  function commit(msg) {
    render();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try { await Store.save(S); if (Store.native) Store.schedule(H.notifications(S, today())).catch(() => {}); }
      catch (e) { toast(e.message, true); }
    }, 150);
    if (msg) toast(msg);
  }
  function toast(msg, bad) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = 'toast'; }, bad ? 6000 : 2800);
  }
  const prop = id => S.properties.find(p => p.id === id);

  // ---------- small pieces ----------
  function tile(label, value, note, cls) {
    return `<div class="tile ${cls || ''}"><div class="tile-label">${esc(label)}</div><div class="tile-value">${value}</div>${note ? `<div class="tile-note">${note}</div>` : ''}</div>`;
  }
  function daysText(n) { return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? Math.abs(n) + ' days ago' : 'in ' + n + ' days'; }
  function kindIcon(k) { return { expire: '⏳', save: '💾', fee: '💵' }[k] || '•'; }
  function urgency(days) { return days <= 14 ? 'urgent' : days <= 45 ? 'soon' : ''; }

  // ---------- top ----------
  function renderTabs() {
    const items = [{ id: 'all', name: 'All Properties' }].concat(S.properties.map(p => ({ id: p.id, name: p.short || p.name })));
    $('#tabs').innerHTML = items.map(t => `<button role="tab" class="tab ${t.id === tab ? 'on' : ''}" aria-selected="${t.id === tab}" data-tab="${esc(t.id)}">${esc(t.name)}</button>`).join('')
      + `<button class="tab add" data-act="add-property" aria-label="Add a property">＋</button>`;
    const m = S.meta || {};
    $('#sync').innerHTML = m.hgvAsOf ? `Owner site data from ${esc(H.longDate(m.hgvAsOf))}` : (S.properties.length ? 'Entered by hand' : '');
  }

  // ---------- screens are made of blocks you can move and resize ----------
  // Each screen is a list of blocks {id, html, size}. Sizes: s (small), m (medium), l (full width).
  // Your order and sizes are kept per screen (all, points, fees, binder) in settings.layout.
  let arranging = false;
  const SIZES = ['s', 'm', 'l'];
  const SIZE_NAMES = { s: 'Small', m: 'Medium', l: 'Wide' };
  function blk(id, html, size) { return html ? { id, html, size: size || 'l' } : null; }
  function arranged(screen, blocks) {
    blocks = blocks.filter(Boolean);
    const saved = ((S.settings || {}).layout || {})[screen] || [];
    const pos = id => { const i = saved.findIndex(x => x.id === id); return i < 0 ? 1000 + blocks.findIndex(b => b.id === id) : i; };
    for (const b of blocks) { const sv = saved.find(x => x.id === b.id); if (sv && SIZES.includes(sv.size)) b.size = sv.size; }
    blocks.sort((a, b) => pos(a.id) - pos(b.id));
    const tools = b => arranging ? `<div class="blk-tools" role="group" aria-label="Arrange ${esc(b.id)}">
        <button class="blk-handle" data-act="noop" aria-label="Drag to move" title="Drag to move">⠿</button>
        <button data-act="blk-move" data-dir="-1" aria-label="Move earlier">◀</button><button data-act="blk-move" data-dir="1" aria-label="Move later">▶</button>
        <span class="grow"></span>${SIZES.map(z => `<button data-act="blk-size" data-size="${z}" class="${b.size === z ? 'on' : ''}" aria-pressed="${b.size === z}" aria-label="${SIZE_NAMES[z]}">${z.toUpperCase()}</button>`).join('')}</div>` : '';
    return `<div class="board ${arranging ? 'arranging' : ''}" data-screen="${screen}">${blocks.map(b => `<div class="blk sz-${b.size}" data-blk="${esc(b.id)}">${tools(b)}<div class="blk-body">${b.html}</div></div>`).join('')}</div>`;
  }
  function saveLayout(board) {
    const screen = board.dataset.screen;
    S.settings = S.settings || {}; S.settings.layout = S.settings.layout || {};
    S.settings.layout[screen] = [...board.querySelectorAll(':scope > .blk')].map(el => ({ id: el.dataset.blk, size: SIZES.find(z => el.classList.contains('sz-' + z)) || 'l' }));
    commit();
  }
  function arrangeBar() {
    return arranging ? `<div class="arrange-bar" role="status"><span class="grow">Drag ⠿ or tap ◀ ▶ to move · S M L to resize</span><button class="btn small" data-act="arrange-reset">Reset this screen</button><button class="btn small primary" data-act="arrange">Done</button></div>` : '';
  }

  // Drag a block by its ⠿ handle (works with a finger or a mouse).
  let drag = null;
  document.addEventListener('pointerdown', e => {
    const h = e.target.closest('.blk-handle'); if (!h) return;
    const el = h.closest('.blk'); e.preventDefault();
    drag = { el, board: el.parentElement, id: e.pointerId }; el.classList.add('dragging'); h.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.el.style.pointerEvents = 'none';
    const over = document.elementFromPoint(e.clientX, e.clientY); drag.el.style.pointerEvents = '';
    const t = over && over.closest('.blk');
    if (t && t !== drag.el && t.parentElement === drag.board) {
      const r = t.getBoundingClientRect();
      const after = (e.clientY > r.top + r.height / 2) || (e.clientY > r.top && e.clientX > r.left + r.width / 2 && e.clientY < r.bottom && r.width < drag.board.clientWidth * 0.9);
      drag.board.insertBefore(drag.el, after ? t.nextSibling : t);
    }
    if (e.clientY < 90) window.scrollBy(0, -12); else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
  });
  const endDrag = e => { if (!drag || e.pointerId !== drag.id) return; drag.el.classList.remove('dragging'); const b = drag.board; drag = null; saveLayout(b); };
  document.addEventListener('pointerup', endDrag); document.addEventListener('pointercancel', endDrag);

  function resList(list, t, showProp) {
    return '<ul class="list">' + list.map(({ r, p }) => {
      const up = r.checkIn && H.daysBetween(t, r.checkIn) >= 0 && r.status !== 'Cancelled';
      const days = r.checkIn ? H.daysBetween(t, r.checkIn) : null;
      return `<li class="row" ${showProp ? `data-tab="${esc(p.id)}" tabindex="0"` : ''}><span class="ic" aria-hidden="true">${r.status === 'Cancelled' ? '✕' : up ? '🏝' : '✓'}</span><span class="grow"><b>${esc(r.resort)}</b><small>${esc(H.shortDate(r.checkIn))}${r.checkOut ? ' – ' + esc(H.shortDate(r.checkOut)) : ''}${r.unit ? ' · ' + esc(r.unit) : ''}${r.via ? ' · ' + esc(r.via) : ''}${r.refLast4 ? ' · No. ' + esc(H.mask(r.refLast4)) : ''}${r.status === 'Cancelled' ? ' · cancelled' : ''}</small>${showProp ? `<small>Points from ${esc(p.short || p.name)}${up && days != null ? ' · ' + daysText(days) : ''}</small>` : (up && days != null ? `<small>${daysText(days)}</small>` : '')}</span><span class="when"><b>${H.pts(r.points)}</b><small>points</small></span>${showProp ? '' : `<button class="link" data-act="edit-res" data-id="${esc(r.id)}">Edit</button>`}</li>`;
    }).join('') + '</ul>';
  }
  function splitRes(items, t) {
    const up = items.filter(x => x.r.status !== 'Cancelled' && x.r.checkIn && H.daysBetween(t, x.r.checkOut || x.r.checkIn) >= 0).sort((a, b) => a.r.checkIn < b.r.checkIn ? -1 : 1);
    const past = items.filter(x => !up.includes(x)).sort((a, b) => (a.r.checkIn || '') < (b.r.checkIn || '') ? 1 : -1);
    return { up, past };
  }
  function resCard(items, t, showProp, addBtn) {
    const { up, past } = splitRes(items, t);
    let h = `<section class="card"><div class="card-head"><h2>Reservations</h2>${addBtn ? '<button class="btn small" data-act="add-res">＋ Add</button>' : ''}</div>`;
    h += up.length ? `<h3>Upcoming</h3>${resList(up, t, showProp)}` : '<p class="muted">No upcoming reservations.</p>';
    if (past.length) h += `<details ${up.length ? '' : 'open'}><summary>Past and cancelled (${past.length})</summary>${resList(past, t, showProp)}</details>`;
    return h + '</section>';
  }

  // ---------- All Properties ----------
  function renderAll() {
    const t = today(); const sm = H.summary(S, t);
    if (!S.properties.length) return renderWelcome();
    let al = '';
    for (const e of sm.expiring.filter(e => e.days <= 60)) {
      const save = e.batch.saveBy && H.daysBetween(t, e.batch.saveBy) >= 0 ? ` Save them by <b>${esc(H.longDate(e.batch.saveBy))}</b>${e.batch.saveNote ? ' (' + esc(e.batch.saveNote) + ')' : ''}.` : '';
      al += `<div class="alert ${urgency(e.days)}" role="status">⏳ <b>${H.pts(e.batch.available)} ${esc(e.property.currency || 'points')}</b> at ${esc(e.property.short || e.property.name)} expire <b>${esc(H.longDate(e.batch.expires))}</b> (${daysText(e.days)}).${save}</div>`;
    }
    for (const d of sm.due) {
      const days = d.fee.due ? H.daysBetween(t, d.fee.due) : null;
      if (days != null && days > 60) continue;
      al += `<div class="alert ${days != null ? urgency(days) : ''}" role="status">💵 <b>${H.money(H.num(d.fee.amount))}</b> ${esc(d.fee.label || 'fee')} for ${esc(d.property.short || d.property.name)} is unpaid${d.fee.due ? `, due <b>${esc(H.longDate(d.fee.due))}</b> (${daysText(days)})` : ''}.</div>`;
    }
    const cur = Object.entries(sm.byCurrency).map(([c, n]) => `<div class="mini"><span>${esc(c)}</span><b>${H.pts(n)}</b></div>`).join('');
    const allRes = []; for (const p of S.properties) for (const r of p.reservations || []) allRes.push({ r, p });
    const next = splitRes(allRes, t).up[0];
    const coming = `<section class="card"><h2>Coming up</h2>${sm.deadlines.length ? '<ul class="list">' + sm.deadlines.slice(0, 10).map(d =>
      `<li class="row ${urgency(d.days)}" data-tab="${esc(d.propertyId)}" tabindex="0"><span class="ic" aria-hidden="true">${kindIcon(d.kind)}</span><span class="grow"><b>${esc(d.title)}</b><small>${esc(d.sub)}</small></span><span class="when">${esc(H.longDate(d.date))}<small>${daysText(d.days)}</small></span></li>`).join('') + '</ul>' : '<p class="muted">Nothing coming up.</p>'}
      ${Store.native ? '<p class="muted small">Your iPhone will remind you before each of these. Change when in the menu under Reminders.</p>' : '<button class="btn" data-act="ics">Add these reminders to my calendar</button>'}</section>`;
    let props = `<section class="card"><h2>Properties</h2><div class="table-wrap"><table class="props"><thead><tr><th>Property</th><th class="r">Points / yr</th><th class="r">Available</th><th>Next expiration</th><th class="r">Latest fee</th><th class="r">Cost / point</th></tr></thead><tbody>`;
    for (const p of S.properties) {
      const ps = H.pointsSummary(p, t); const fy = H.feeYears(p); const last = fy[fy.length - 1];
      props += `<tr data-tab="${esc(p.id)}" tabindex="0" class="click"><td><b>${esc(p.short || p.name)}</b><small>${esc(p.account || '')}${p.currency ? ' · ' + esc(p.currency) : ''}</small></td><td class="r">${H.pts(p.annualPoints)}</td><td class="r">${H.pts(ps.availableNow)}</td>
        <td>${ps.nextExpiring ? esc(H.shortDate(ps.nextExpiring.date)) + '<small>' + H.pts(ps.nextExpiring.points) + ' pts</small>' : '—'}</td>
        <td class="r">${last ? H.money(last.total) + '<small>' + last.year + (last.paid ? ' · paid' : ' · unpaid') + '</small>' : '—'}</td><td class="r">${last && last.costPerPoint ? '$' + last.costPerPoint.toFixed(3) : '—'}</td></tr>`;
    }
    props += `</tbody></table></div><p class="muted small">ClubPoints, By Hilton Club points and HGV Max points are separate pools — each can only be used on its own account.</p></section>`;
    return arrangeBar() + arranged('all', [
      blk('alerts', al, 'l'),
      blk('t-points', tile('Points available now', H.pts(sm.totalAvailable), cur), 's'),
      blk('t-fees', tile('Fees unpaid', H.money(sm.dueTotal), sm.due.length ? sm.due.length + ' item' + (sm.due.length > 1 ? 's' : '') : 'All paid', sm.dueTotal > 0 ? 'warn' : 'good'), 's'),
      blk('t-annual', tile('Points each year', H.pts(sm.annualPoints), S.properties.length + ' properties'), 's'),
      blk('t-trip', tile('Next trip', next ? esc(H.shortDate(next.r.checkIn)) : '—', next ? esc(next.r.resort) + ' · ' + daysText(H.daysBetween(t, next.r.checkIn)) : 'None booked'), 's'),
      blk('coming', coming, 'm'),
      blk('reservations', resCard(allRes, t, true, false), 'm'),
      blk('properties', props, 'l')
    ]);
  }

  function renderWelcome() {
    return `<section class="card welcome"><img src="icon-180.png" alt="" width="72" height="72"><h2>Welcome to HGVC Binder</h2>
      <p>Your Hilton Grand Vacations points, fees and papers, one tab per property.</p>
      <button class="btn primary" data-act="import-file">Open a data file</button>
      <p class="muted small">From anywhere on this ${Store.native ? 'iPhone' : 'device'}: Files, iCloud Drive, Downloads, Dropbox, or a file someone sent you by Messages, Mail or AirDrop (save it to Files first).</p>
      ${Store.native ? '<button class="btn" data-act="pick-folder">Use a folder for automatic updates</button>' : ''}
      <button class="btn" data-act="add-property">Add a property by hand</button>
      <p class="muted small">The data file is a “Claude - HGVC Binder Data … .json” file. The monthly Claude task writes a new one after reading the owner account without changing anything.</p></section>`;
  }

  // ---------- one property ----------
  function renderProperty(p) {
    let h = `<section class="prop-head"><div><h2>${esc(p.name)}</h2><p class="muted">${esc([p.location, p.account, p.currency].filter(Boolean).join(' · '))}</p></div>
      <div class="seg" role="tablist">${['points', 'fees', 'binder'].map(s => `<button role="tab" aria-selected="${sub === s}" class="${sub === s ? 'on' : ''}" data-sub="${s}">${{ points: 'Points', fees: 'Fees', binder: 'Binder' }[s]}</button>`).join('')}</div></section>`;
    h += arrangeBar() + (sub === 'points' ? renderPoints(p) : sub === 'fees' ? renderFees(p) : renderBinder(p));
    return h;
  }

  function renderPoints(p) {
    const t = today(); const ps = H.pointsSummary(p, t); let al = '';
    if (ps.nextExpiring && ps.nextExpiring.days <= 60) {
      const b = ps.nextExpiring.batch;
      al = `<div class="alert ${urgency(ps.nextExpiring.days)}">⏳ <b>${H.pts(b.available)}</b> points expire <b>${esc(H.longDate(b.expires))}</b> (${daysText(ps.nextExpiring.days)}).${b.saveBy && H.daysBetween(t, b.saveBy) >= 0 ? ` Save by <b>${esc(H.longDate(b.saveBy))}</b>${b.saveNote ? ' — ' + esc(b.saveNote) : ''}.` : ''}</div>`;
    }
    let yrs = `<section class="card"><div class="card-head"><h2>Points by year</h2><button class="btn small" data-act="add-batch">＋ Add</button></div>
      <p class="muted small">Use year: ${esc(p.useYear || 'January 1 – December 31')} · ${H.pts(p.annualPoints)} points a year</p><ul class="list">`;
    const batches = (p.batches || []).slice().sort((a, b) => (a.expires || '9') < (b.expires || '9') ? -1 : 1);
    for (const b of batches) {
      const dead = b.expires && H.daysBetween(t, b.expires) < 0;
      const extra = [b.saved ? H.pts(b.saved) + ' saved' : '', b.borrowed ? H.pts(b.borrowed) + ' borrowed' : '', H.batchUsed(b) ? H.pts(H.batchUsed(b)) + ' used' : ''].filter(Boolean).join(' · ');
      yrs += `<li class="row batch ${dead ? 'dim' : ''}"><span class="grow"><b>${esc(b.label || b.year)}</b><small>${esc({ current: 'This year', saved: 'Saved', borrowed: 'Borrowed', bonus: 'Bonus', future: 'Future year' }[b.kind] || b.kind || '')} · ${H.pts(b.points)} allotted${extra ? ' · ' + extra : ''}</small>
        <small>${b.expires ? (dead ? 'Expired ' : 'Expires ') + esc(H.longDate(b.expires)) : ''}${b.saveBy ? ' · save by ' + esc(H.longDate(b.saveBy)) : ''}</small></span>
        <span class="when"><b class="big">${H.pts(b.available)}</b><small>available</small></span><button class="link" data-act="edit-batch" data-id="${esc(b.id)}" aria-label="Edit ${esc(b.label || b.year)}">Edit</button></li>`;
    }
    yrs += `</ul></section>`;
    const hist = (p.ledger || []).length ? `<section class="card"><details><summary><h2 style="display:inline">Points history</h2> <span class="muted small">(${p.ledger.length} entries from the owner site)</span></summary><div class="table-wrap"><table><thead><tr><th>Date</th><th>Year</th><th>What</th><th class="r">Points</th></tr></thead><tbody>` +
        p.ledger.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map(l => `<tr><td>${esc(H.shortDate(l.date))}</td><td>${esc(l.year || '')}</td><td>${esc(l.type)}${l.note ? '<small>' + esc(l.note) + '</small>' : ''}</td><td class="r ${H.num(l.points) < 0 ? 'neg' : ''}">${H.num(l.points) > 0 ? '+' : ''}${H.pts(l.points)}</td></tr>`).join('') + `</tbody></table></div></details></section>` : '';
    const rules = `<section class="card info"><h2>The rules, in short</h2><ul>
      <li>This year's points expire at the end of the year (December 31).</li>
      <li><b>Saving</b> moves unused points into next year for a fee (cheaper online). Saved points can't be saved again or used for a Home Week or Hilton Honors.</li>
      <li><b>Borrowing</b> takes points from next year with no fee, but gives up next year's Home Week rights.</li>
      <li>Bonus points last two years and can't be saved or borrowed.</li></ul>
      <p class="small">From HGV's Club Navigator. Fees and dates change yearly — check your Club Rules. <a href="${RULES_URL}" target="_blank" rel="noopener">HGV: Types of Points</a></p></section>`;
    return arranged('points', [
      blk('alerts', al, 'l'),
      blk('t-avail', tile('Available now', H.pts(ps.availableNow)), 's'),
      blk('t-used', tile('Used this year', H.pts(ps.usedThisYear)), 's'),
      blk('t-saved', tile('Saved this year', H.pts(ps.savedThisYear), 'moved to next year'), 's'),
      blk('t-borrowed', tile('Borrowed', H.pts(ps.borrowedThisYear), 'taken from next year'), 's'),
      blk('years', yrs, 'l'),
      blk('reservations', resCard((p.reservations || []).map(r => ({ r, p })), t, false, true), 'l'),
      blk('history', hist, 'l'),
      blk('rules', rules, 'l')
    ]);
  }

  function feeChart(years) {
    if (!years.length) return '';
    const W = 420, Hh = 230, pad = { l: 58, r: 8, t: 26, b: 38 };
    const raw = Math.max.apply(null, years.map(y => y.total)) * 1.12 || 1;
    const mag = Math.pow(10, Math.floor(Math.log10(raw / 4))); const stepV = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10].map(m => m * mag).find(v => v * 4 >= raw); const max = stepV * 4;
    const bw = Math.min(70, (W - pad.l - pad.r) / years.length * 0.6);
    const step = (W - pad.l - pad.r) / years.length;
    const y = v => pad.t + (Hh - pad.t - pad.b) * (1 - v / max);
    let g = '';
    for (let i = 0; i <= 4; i++) { const v = max / 4 * i; g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.l - 8}" y="${y(v) + 4}" class="axis" text-anchor="end">$${Math.round(v).toLocaleString('en-US')}</text>`; }
    years.forEach((r, i) => {
      const x = pad.l + step * i + (step - bw) / 2;
      g += `<rect x="${x}" y="${y(r.total)}" width="${bw}" height="${Hh - pad.b - y(r.total)}" rx="4" class="${r.paid ? 'bar' : 'bar unpaid'}"><title>${r.year}: ${H.money(r.total)}</title></rect>`;
      g += `<text x="${x + bw / 2}" y="${y(r.total) - 6}" class="val" text-anchor="middle">${H.money(r.total).replace(/\.\d\d$/, '')}</text>`;
      g += `<text x="${x + bw / 2}" y="${Hh - pad.b + 16}" class="axis" text-anchor="middle">${r.year}</text>`;
      if (r.change != null) { const flat = Math.abs(r.change) < 0.0005; g += `<text x="${x + bw / 2}" y="${Hh - pad.b + 30}" class="chg ${flat ? '' : r.change > 0 ? 'up' : 'down'}" text-anchor="middle">${flat ? 'no change' : (r.change > 0 ? '▲ ' : '▼ ') + Math.abs(r.change * 100).toFixed(1) + '%'}</text>`; }
    });
    return `<figure class="chart"><svg viewBox="0 0 ${W} ${Hh + 6}" role="img" aria-label="Yearly fees: ${years.map(r => r.year + ' ' + H.money(r.total)).join(', ')}">${g}</svg>
      <figcaption class="small muted">Total billed each year, with the change from the year before. Lighter bar = not paid yet.</figcaption></figure>`;
  }

  function renderFees(p) {
    const t = today(); const years = H.feeYears(p); let al = '';
    for (const f of H.feesDue(p)) {
      const d = f.due ? H.daysBetween(t, f.due) : null;
      al += `<div class="alert ${d != null ? urgency(d) : ''}">💵 <b>${H.money(H.num(f.amount))}</b> ${esc(f.label || 'fee')} (${esc(f.year)}) is unpaid${f.due ? `, due <b>${esc(H.longDate(f.due))}</b> (${daysText(d)})` : ''}. Pay it on the owner site — this app never makes payments.</div>`;
    }
    const last = years[years.length - 1];
    let by = `<section class="card"><div class="card-head"><h2>By year</h2><span><button class="btn small" data-act="import-pdf">Read a PDF statement</button> <button class="btn small" data-act="add-fee">＋ Add</button></span></div>`;
    for (const r of years.slice().reverse()) {
      by += `<div class="year"><div class="year-head"><b>${r.year}</b><span>${H.money(r.total)}</span><span class="pill ${r.paid ? 'good' : 'warn'}">${r.paid ? 'Paid' : 'Unpaid'}</span>${r.due ? `<small>due ${esc(H.longDate(r.due))}</small>` : ''}${r.costPerPoint ? `<small>$${r.costPerPoint.toFixed(3)} / point</small>` : ''}</div><ul class="list">` +
        r.items.map(f => `<li class="row"><label class="check"><input type="checkbox" data-act="toggle-paid" data-id="${esc(f.id)}" ${f.paid ? 'checked' : ''} ${H.num(f.amount) <= 0 ? 'disabled' : ''}><span class="sr">Paid</span></label><button class="grow link-row" data-act="edit-fee" data-id="${esc(f.id)}" aria-label="Edit ${esc(f.label)}">${esc(f.label)}<small>${esc(f.kind || '')}${f.paidDate ? ' · paid ' + esc(H.shortDate(f.paidDate)) : ''}${f.note ? ' · ' + esc(f.note) : ''} · <span class="edit-hint">Edit</span></small></button><span class="when ${H.num(f.amount) < 0 ? 'neg' : ''}">${H.money(H.num(f.amount))}</span></li>`).join('') + '</ul></div>';
    }
    if (!years.length) by += '<p class="muted">No fees yet. Add one, or read a PDF statement you downloaded from the owner site.</p>';
    const pays = (p.fees || []).filter(f => f.kind === 'Payment');
    if (pays.length) by += `<details><summary>Payments on the owner site (${pays.length})</summary><ul class="list">${pays.map(f => `<li class="row"><span class="grow">${esc(H.shortDate(f.paidDate || f.due))}<small>${esc(f.label || '')}</small></span><span class="when">${H.money(Math.abs(H.num(f.amount)))}</span></li>`).join('')}</ul></details>`;
    by += `</section>`;
    return arranged('fees', [
      blk('alerts', al, 'l'),
      blk('t-latest', tile('Latest year', last ? H.money(last.total) : '—', last ? last.year + (last.paid ? ' · paid' : ' · unpaid') : ''), 's'),
      blk('t-cpp', tile('Cost per point', last && last.costPerPoint ? '$' + last.costPerPoint.toFixed(3) : '—', p.annualPoints ? 'fee ÷ ' + H.pts(p.annualPoints) + ' points' : 'add annual points in Binder'), 's'),
      blk('t-change', tile('Change from last year', last && last.change != null ? (last.change > 0 ? '+' : '') + (last.change * 100).toFixed(1) + '%' : '—'), 's'),
      blk('chart', `<section class="card"><h2>Fee history</h2>${feeChart(years)}</section>`, 'l'),
      blk('by-year', by, 'l')
    ]);
  }

  function renderBinder(p) {
    const rows = [['Resort', p.name], ['Location', p.location], ['Account', p.account], ['Points currency', p.currency], ['Unit type', p.unitType], ['Season', p.season],
      ['Home weeks', (p.homeWeeks || []).map(w => w.label + (w.points ? ' — ' + H.pts(w.points) + ' pts' : '')).join('\n')], ['Purchase date', H.longDate(p.purchaseDate)], ['Ownership', p.ownership],
      ['Check-in day', p.checkInDay], ['Points each year', p.annualPoints ? H.pts(p.annualPoints) : ''], ['Use year', p.useYear]].filter(r => r[1]);
    const summary = `<section class="card"><div class="card-head"><h2>Contract summary</h2><button class="btn small" data-act="edit-contract">Edit</button></div><dl class="dl">${rows.map(r => `<dt>${esc(r[0])}</dt><dd>${esc(r[1]).replace(/\n/g, '<br>')}</dd>`).join('')}</dl></section>`;
    const nums = `<section class="card"><h2>Account numbers</h2><dl class="dl nums">
      <dt>Contract no.</dt><dd><span id="num-contract" class="mono">${esc(H.mask(p.contractLast4))}</span> <button class="link" data-act="reveal" data-which="contract">${Store.native ? 'Show' : ''}</button></dd>
      <dt>Member no.</dt><dd><span id="num-member" class="mono">${esc(H.mask(p.memberLast4))}</span> <button class="link" data-act="reveal" data-which="member">${Store.native ? 'Show' : ''}</button></dd></dl>
      <p class="muted small">${Store.native ? 'Full numbers stay locked in this iPhone\'s Keychain and need Face ID to show.' : 'Only the last 4 digits are kept here. Full numbers are kept only in the iPhone app, behind Face ID.'}</p></section>`;
    const kinds = ['Statement', 'Deed / contract', 'Receipt', 'Other'];
    let docsH = `<section class="card"><div class="card-head"><h2>Documents</h2><button class="btn small" data-act="add-doc">＋ Add</button></div>`;
    const docs = p.docs || [];
    if (!docs.length) docsH += '<p class="muted">Keep yearly statements, the deed or contract, and receipts here. They stay on this device.</p>';
    for (const k of kinds) {
      const list = docs.filter(d => (d.kind || 'Other') === k).sort((a, b) => (b.year || 0) - (a.year || 0));
      if (!list.length) continue;
      docsH += `<h3>${esc(k)}</h3><ul class="list">${list.map(d => `<li class="row"><span class="ic" aria-hidden="true">${/pdf/.test(d.mime) ? '📄' : '🖼'}</span><button class="grow link-row" data-act="open-doc" data-id="${esc(d.id)}"><b>${esc(d.name)}</b><small>${esc(d.year || '')}${d.size ? ' · ' + Math.max(1, Math.round(d.size / 1024)) + ' KB' : ''}</small></button><button class="link" data-act="edit-doc" data-id="${esc(d.id)}">Edit</button></li>`).join('')}</ul>`;
    }
    docsH += `</section>`;
    const phones = `<section class="card"><div class="card-head"><h2>Phone numbers</h2><button class="btn small" data-act="add-contact">＋ Add</button></div><ul class="list">${(p.contacts || []).map(c => `<li class="row"><span class="ic" aria-hidden="true">📞</span><span class="grow"><b>${esc(c.label)}</b><small>${esc(c.note || '')}</small></span><a class="btn small" href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a><button class="link" data-act="edit-contact" data-id="${esc(c.id)}">Edit</button></li>`).join('') || '<li class="muted">No numbers yet.</li>'}</ul></section>`;
    const notes = `<section class="card"><h2>Notes</h2><label class="sr" for="notes">Notes</label><textarea id="notes" rows="4" placeholder="Anything worth remembering about this property">${esc(p.notes)}</textarea></section>`;
    return arranged('binder', [blk('summary', summary, 'l'), blk('numbers', nums, 'm'), blk('docs', docsH, 'm'), blk('phones', phones, 'l'), blk('notes', notes, 'l')])
      + `<p class="center"><button class="link danger" data-act="remove-property">Remove this property from the app</button></p>`;
  }

  function render() {
    if (tab !== 'all' && !prop(tab)) tab = 'all';
    renderTabs();
    $('#arrange-btn').classList.toggle('on', arranging);
    $('#arrange-btn').setAttribute('aria-pressed', arranging);
    const main = $('#main');
    main.innerHTML = tab === 'all' ? renderAll() : renderProperty(prop(tab));
    const n = $('#notes'); if (n) n.addEventListener('change', () => { prop(tab).notes = n.value; commit(); });
  }

  // ---------- forms ----------
  function openForm({ title, fields, values, onSave, onDelete, note }) {
    const dlg = $('#dlg'); values = values || {};
    const field = f => {
      const v = values[f.key] == null ? (f.default == null ? '' : f.default) : values[f.key];
      const id = 'f-' + f.key;
      if (f.type === 'select') return `<label for="${id}">${esc(f.label)}</label><select id="${id}" name="${f.key}">${f.options.map(o => `<option ${String(o) === String(v) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      if (f.type === 'check') return `<label class="inline"><input type="checkbox" id="${id}" name="${f.key}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
      if (f.type === 'textarea') return `<label for="${id}">${esc(f.label)}</label><textarea id="${id}" name="${f.key}" rows="3">${esc(v)}</textarea>`;
      return `<label for="${id}">${esc(f.label)}</label><input id="${id}" name="${f.key}" type="${f.type || 'text'}" ${f.type === 'number' ? 'step="' + (f.step || 'any') + '" inputmode="decimal"' : ''} value="${esc(v)}" ${f.placeholder ? 'placeholder="' + esc(f.placeholder) + '"' : ''}>${f.help ? `<small class="muted">${esc(f.help)}</small>` : ''}`;
    };
    dlg.innerHTML = `<form method="dialog" class="form"><h2>${esc(title)}</h2>${note ? `<p class="muted small">${note}</p>` : ''}${fields.map(field).join('')}
      <div class="actions">${onDelete ? '<button type="button" class="btn danger" value="delete">Delete</button>' : ''}<span class="grow"></span><button type="button" class="btn" value="cancel">Cancel</button><button type="submit" class="btn primary" value="save">Save</button></div></form>`;
    const form = $('form', dlg);
    form.addEventListener('click', e => {
      const b = e.target.closest('button[type=button]'); if (!b) return;
      if (b.value === 'cancel') dlg.close();
      if (b.value === 'delete' && confirm('Delete this? This can\'t be undone.')) { dlg.close(); onDelete(); }
    });
    form.addEventListener('submit', e => {
      e.preventDefault(); const out = {};
      for (const f of fields) { const el = form.elements[f.key]; out[f.key] = f.type === 'check' ? el.checked : f.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value.trim(); }
      const err = onSave(out); if (err) { toast(err, true); return; }
      dlg.close();
    });
    dlg.showModal();
    const first = $('input,select,textarea', dlg); if (first) first.focus();
  }

  const KINDS = ['current', 'future', 'saved', 'borrowed', 'bonus'];
  function editBatch(p, b) {
    const isNew = !b; b = b || { kind: 'current', year: new Date().getFullYear(), expires: new Date().getFullYear() + '-12-31' };
    openForm({ title: isNew ? 'Add points' : 'Edit ' + (b.label || b.year), values: b, note: 'Saved points can only be saved once. Borrowing gives up next year\'s Home Week.',
      fields: [{ key: 'label', label: 'Name', placeholder: 'ClubPoints 2026' }, { key: 'year', label: 'Use year', type: 'number', step: 1 }, { key: 'kind', label: 'Kind', type: 'select', options: KINDS },
        { key: 'points', label: 'Points allotted', type: 'number', step: 1 }, { key: 'available', label: 'Points available', type: 'number', step: 1 },
        { key: 'saved', label: 'Saved to next year', type: 'number', step: 1 }, { key: 'borrowed', label: 'Borrowed into last year', type: 'number', step: 1 },
        { key: 'expires', label: 'Expires', type: 'date' }, { key: 'saveBy', label: 'Save-by date (a save deadline or discount deadline)', type: 'date' }, { key: 'saveNote', label: 'Why this date', placeholder: '$112 off the save fee online' }],
      onSave: v => { Object.assign(b, v, { source: 'manual' }); if (isNew) { b.id = H.uid(); p.batches.push(b); } commit('Saved'); },
      onDelete: isNew ? null : () => { p.batches = p.batches.filter(x => x !== b); commit('Deleted'); } });
  }
  function editRes(p, r) {
    const isNew = !r; r = r || { status: 'Confirmed' };
    openForm({ title: isNew ? 'Add a reservation' : 'Edit reservation', values: r, note: 'This only records a trip here. Book, change or cancel trips on the owner site.',
      fields: [{ key: 'resort', label: 'Resort' }, { key: 'checkIn', label: 'Check in', type: 'date' }, { key: 'checkOut', label: 'Check out', type: 'date' }, { key: 'unit', label: 'Unit', placeholder: '2 Bedroom' },
        { key: 'points', label: 'Points used', type: 'number', step: 1 }, { key: 'via', label: 'Booked through', placeholder: 'Club, RCI, Destination Xchange' }, { key: 'refLast4', label: 'Reservation no. (last 4 is enough)' },
        { key: 'status', label: 'Status', type: 'select', options: ['Confirmed', 'Completed', 'Cancelled'] }],
      onSave: v => { if (!v.resort) return 'Add the resort name.'; v.refLast4 = H.last4(v.refLast4); Object.assign(r, v, { source: 'manual' }); if (isNew) { r.id = H.uid(); p.reservations.push(r); } commit('Saved'); },
      onDelete: isNew ? null : () => { p.reservations = p.reservations.filter(x => x !== r); commit('Deleted'); } });
  }
  function editFee(p, f) {
    const isNew = !f; f = f || { year: new Date().getFullYear() + 1, kind: 'Maintenance fee', paid: false };
    openForm({ title: isNew ? 'Add a fee' : 'Edit fee', values: f,
      fields: [{ key: 'year', label: 'Year it pays for', type: 'number', step: 1 }, { key: 'label', label: 'Description', placeholder: 'Maintenance fee & taxes' },
        { key: 'kind', label: 'Kind', type: 'select', options: ['Maintenance fee', 'Club dues', 'Credit', 'Late fee', 'Other'] }, { key: 'amount', label: 'Amount ($)', type: 'number', step: '0.01', help: 'Use a minus sign for credits.' },
        { key: 'due', label: 'Due date', type: 'date' }, { key: 'paid', label: 'Paid', type: 'check' }, { key: 'paidDate', label: 'Date paid', type: 'date' }],
      onSave: v => { if (v.amount == null) return 'Add the amount.'; Object.assign(f, v, { source: 'manual' }); if (v.paid) f.paidBy = 'me'; if (isNew) { f.id = H.uid(); p.fees.push(f); } commit('Saved'); },
      onDelete: isNew ? null : () => { p.fees = p.fees.filter(x => x !== f); commit('Deleted'); } });
  }
  const CONTRACT_FIELDS = [{ key: 'name', label: 'Resort name' }, { key: 'short', label: 'Short name for the tab' }, { key: 'location', label: 'Location' },
    { key: 'account', label: 'Account', type: 'select', options: ['HGVC', 'HGV Max', 'Hilton Club', 'Other'] }, { key: 'currency', label: 'Points currency', placeholder: 'ClubPoints' },
    { key: 'unitType', label: 'Unit type' }, { key: 'season', label: 'Season' }, { key: 'purchaseDate', label: 'Purchase date', type: 'date' },
    { key: 'ownership', label: 'Ownership', type: 'select', options: ['Deeded', 'Points only (trust)', 'Deeded — points in trust', 'Not sure'] },
    { key: 'checkInDay', label: 'Check-in day' }, { key: 'annualPoints', label: 'Points each year', type: 'number', step: 1 }, { key: 'useYear', label: 'Use year', default: 'January 1 – December 31' },
    { key: 'contractLast4', label: 'Contract no. — last 4 digits only' }, { key: 'memberLast4', label: 'Member no. — last 4 digits only' }];
  function editContract(p) {
    const isNew = !p; p = p || { account: 'HGVC', currency: 'ClubPoints', ownership: 'Deeded' };
    openForm({ title: isNew ? 'Add a property' : 'Edit contract summary', values: p, fields: CONTRACT_FIELDS,
      note: isNew ? '' : 'Changes you make here stay, even when the owner site data updates.',
      onSave: v => {
        if (!v.name) return 'Add the resort name.';
        v.contractLast4 = H.last4(v.contractLast4); v.memberLast4 = H.last4(v.memberLast4);
        if (isNew) { const np = H.normalizeProperty(Object.assign(v, { id: H.slug(v.name) + '-' + H.uid().slice(0, 4), source: 'manual' })); S.properties.push(np); tab = np.id; sub = 'points'; }
        else { p.locked = p.locked || {}; for (const k of Object.keys(v)) if (String(v[k] ?? '') !== String(p[k] ?? '')) p.locked[k] = true; Object.assign(p, v); }
        commit('Saved');
      } });
  }
  function editContact(p, c) {
    const isNew = !c; c = c || {};
    openForm({ title: isNew ? 'Add a phone number' : 'Edit phone number', values: c, fields: [{ key: 'label', label: 'Who' }, { key: 'phone', label: 'Phone', type: 'tel' }, { key: 'note', label: 'Note', placeholder: 'hours, menu option' }],
      onSave: v => { if (!v.label || !v.phone) return 'Add a name and a number.'; Object.assign(c, v); if (isNew) { c.id = H.uid(); p.contacts.push(c); } commit('Saved'); },
      onDelete: isNew ? null : () => { p.contacts = p.contacts.filter(x => x !== c); commit('Deleted'); } });
  }
  function editDoc(p, d) {
    openForm({ title: 'Edit document', values: d, fields: [{ key: 'name', label: 'Name' }, { key: 'kind', label: 'Kind', type: 'select', options: ['Statement', 'Deed / contract', 'Receipt', 'Other'] }, { key: 'year', label: 'Year', type: 'number', step: 1 }],
      onSave: v => { Object.assign(d, v); commit('Saved'); },
      onDelete: async () => { await Store.deleteDoc(d.id).catch(() => {}); p.docs = p.docs.filter(x => x !== d); commit('Deleted'); } });
  }

  function pickFile(accept) {
    return new Promise(resolve => {
      const i = document.createElement('input'); i.type = 'file'; i.style.display = 'none';
      if (accept) i.accept = accept; else i.removeAttribute('accept');
      i.onchange = () => { resolve(i.files[0] || null); i.remove(); }; document.body.appendChild(i); i.click();
    });
  }

  async function addDoc(p) {
    const file = await pickFile('application/pdf,image/*'); if (!file) return;
    const y = (file.name.match(/20\d\d/) || [])[0];
    const d = { id: H.uid(), name: file.name.replace(/\.[^.]+$/, ''), mime: file.type || 'application/pdf', size: file.size, year: y ? +y : new Date().getFullYear(),
      kind: /statement|invoice|assessment|bill/i.test(file.name) ? 'Statement' : /deed|contract|purchase/i.test(file.name) ? 'Deed / contract' : /receipt|paid|confirm/i.test(file.name) ? 'Receipt' : 'Other', added: today() };
    try { await Store.putDoc(d.id, file); p.docs.push(d); commit('Added ' + d.name); editDoc(p, d); }
    catch (e) { toast('Couldn\'t keep that file: ' + e.message, true); }
  }

  async function importPdf(p) {
    const file = await pickFile('application/pdf'); if (!file) return;
    toast('Reading the statement…');
    let text;
    try { text = await Store.pdfText(file); } catch (e) { return toast('Couldn\'t read that PDF: ' + e.message, true); }
    const st = H.parseStatement(text);
    if (!st.lines.length && st.total == null) return toast('No amounts found in that PDF. It may be a scanned picture — add the fee by hand.', true);
    if (st.contractLast4 && p.contractLast4 && st.contractLast4 !== p.contractLast4 && !confirm('That statement is for contract •••• ' + st.contractLast4 + ', not •••• ' + p.contractLast4 + '. Add it to ' + p.name + ' anyway?')) return;
    const rows = H.statementToFees(st);
    const list = rows.map(r => `• ${r.label}: ${H.money(r.amount)}`).join('\n');
    if (!confirm(`From the ${st.year || ''} statement${st.due ? ', due ' + H.longDate(st.due) : ''}:\n\n${list}${st.total != null ? '\n\nTotal due: ' + H.money(st.total) : ''}\n\nAdd these to ${p.name}? You can edit them afterward.`)) return;
    const old = p.fees.filter(f => +f.year === +rows[0].year && f.kind !== 'Payment' && f.from !== 'statement');
    if (old.length && confirm(`${p.name} already has ${old.length} fee line${old.length > 1 ? 's' : ''} for ${rows[0].year} (${H.money(old.reduce((s, f) => s + H.num(f.amount), 0))}). Replace ${old.length > 1 ? 'them' : 'it'} with the statement's lines so the year isn't counted twice?`)) {
      p.suppress = (p.suppress || []).concat(old.filter(f => f.source !== 'manual').map(f => f.id));
      if (old.some(f => f.paid)) rows.forEach(r => { r.paid = true; r.paidBy = 'me'; });
      p.fees = p.fees.filter(f => !old.includes(f));
    }
    p.fees.push(...rows);
    const d = { id: H.uid(), name: (st.year || '') + ' statement', mime: 'application/pdf', size: file.size, year: st.year, kind: 'Statement', added: today() };
    try { await Store.putDoc(d.id, file); p.docs.push(d); } catch (e) { /* the fees still count */ }
    commit('Added ' + rows.length + ' fee line' + (rows.length > 1 ? 's' : '') + ' and kept the PDF in the Binder');
  }

  async function importData(raw, how) {
    const v = H.validateDataFile(raw);
    if (!v.ok) return toast(v.problems.join(' '), true);
    if (v.data.kind === 'backup') {
      if (!confirm('Replace everything in the app with this backup from ' + H.longDate(v.data.savedAt) + '? Documents aren\'t in backups and stay as they are.')) return;
      S = Object.assign(H.emptyState(), v.data, { properties: v.data.properties }); return commit('Backup restored');
    }
    const r = H.mergeData(S, v.data); S = r.state;
    commit(how === 'auto' ? null : r.changes.join(' · '));
  }

  async function autoLoad() {
    if (!Store.native) return;
    try {
      const st = await Store.folderStatus(); if (!st || !st.chosen) return;
      const found = await Store.loadFolderData(); if (!found) return;
      const v = H.validateDataFile(found.json); if (!v.ok) return toast(v.problems[0], true);
      const asOf = v.data.asOf || v.data.generated;
      if (S.meta && S.meta.hgvAsOf && asOf && asOf <= S.meta.hgvAsOf && S.meta.dataFile === found.name) return;
      const r = H.mergeData(S, v.data); S = r.state; S.meta.dataFile = found.name; commit();
    } catch (e) { toast(e.message, true); }
  }

  async function reveal(p, which) {
    const span = $('#num-' + which);
    try {
      await Store.unlock('Show your ' + which + ' number');
      const key = p.id + '.' + which;
      let full = await Store.secretGet(key);
      if (!full) {
        full = prompt('Type the full ' + which + ' number once. It\'s kept only in this iPhone\'s Keychain, behind Face ID.');
        if (!full) return;
        if (p[which + 'Last4'] && H.last4(full) !== p[which + 'Last4'] && !confirm('That number doesn\'t end in ' + p[which + 'Last4'] + '. Keep it anyway?')) return;
        await Store.secretSet(key, full.trim());
        if (!p[which + 'Last4']) { p[which + 'Last4'] = H.last4(full); commit(); }
      }
      span.textContent = full; span.classList.add('shown');
      setTimeout(() => { if (span.isConnected) { span.textContent = H.mask(p[which + 'Last4']); span.classList.remove('shown'); } }, 20000);
    } catch (e) { if (!/cancel/i.test(e.message)) toast(e.message, true); }
  }

  function settings() {
    const r = Object.assign({}, H.DEFAULT_SETTINGS.remind, (S.settings || {}).remind || {});
    openForm({ title: 'Reminders', values: { expire: r.expire.join(', '), save: r.save.join(', '), fee: r.fee.join(', ') },
      note: 'How many days ahead to remind you. Separate numbers with commas.',
      fields: [{ key: 'expire', label: 'Before points expire' }, { key: 'save', label: 'Before the last day to save points' }, { key: 'fee', label: 'Before a fee is due' }],
      onSave: v => {
        const parse = s => String(s).split(/[,\s]+/).map(Number).filter(n => n >= 0 && n < 400);
        S.settings = Object.assign({}, S.settings, { remind: { expire: parse(v.expire), save: parse(v.save), fee: parse(v.fee) } }); commit('Reminders updated');
      } });
  }

  function menu() {
    const dlg = $('#dlg');
    const items = [
      ['import-file', '⬇︎ Open a data file (Files, iCloud, Dropbox, Downloads…)'],
      Store.native ? ['pick-folder', '📁 Use a folder for automatic updates'] : null,
      ['send-copy', '📤 Send a copy of the data to someone'],
      ['add-property', '＋ Add a property'],
      Store.native ? ['settings', '🔔 Reminder settings'] : ['ics', '📅 Add reminders to my calendar'],
      Store.native ? ['settings', null] : ['settings', '🔔 Reminder timing (for the calendar file)'],
      ['backup', '💾 Back up the binder'],
      ['about', 'ⓘ About, privacy & limits']
    ].filter(x => x && x[1]);
    dlg.innerHTML = `<div class="menu"><h2>Menu</h2>${items.map(i => `<button class="menu-item" data-act="${i[0]}">${esc(i[1])}</button>`).join('')}<button class="btn" data-act="close">Close</button></div>`;
    dlg.showModal();
  }

  function about() {
    const dlg = $('#dlg');
    dlg.innerHTML = `<div class="form about"><h2>About HGVC Binder</h2>
      <p><b>What it does.</b> Keeps your points, fees and papers for each Hilton Grand Vacations property in one place, and reminds you before points expire and fees come due.</p>
      <p><b>Where the data comes from.</b> A scheduled Claude task signs in with your existing browser sign-in, reads your owner account <i>read-only</i>, and writes a data file to Dropbox. Open a data file from anywhere — Files, iCloud Drive, Downloads, Dropbox, or one sent by Messages, Mail or AirDrop. ${Store.native ? 'Or pick a folder (in any of those places) and the app reads the newest file there each time it opens.' : ''} “Send a copy of the data” shares the current points, fees and trips (no documents) so someone else can open it in their copy of the app. You can also type or edit anything by hand, and read PDF statements you download yourself.</p>
      <p><b>What it never does.</b> It never stores your HGV password, never books, changes or cancels reservations, and never makes payments.</p>
      <p><b>Limits.</b> If HGV changes its website, the scheduled task may stop finding things until it's adjusted. If HGV asks for a security code, the task stops and you sign in once yourself. The task only runs while your computer and the Claude app are on. Statement reading works best on HGV's text PDFs; scanned pictures need typing in.</p>
      <p><b>Privacy.</b> Everything stays on this device${Store.native ? '' : ' (this browser)'} — nothing is sent anywhere. Contract and member numbers show only their last 4 digits${Store.native ? '; full numbers sit in the iPhone Keychain behind Face ID' : ''}.</p>
      <p class="small muted">Not made by or affiliated with Hilton Grand Vacations. Version 1.0</p>
      <div class="actions"><span class="grow"></span><button class="btn primary" data-act="close">Done</button></div></div>`;
    dlg.showModal();
  }

  // ---------- clicks ----------
  document.addEventListener('click', async e => {
    // Arranging: only the arrange controls work; the rest of each block is "frozen".
    if (arranging && e.target.closest('.blk-body')) { e.preventDefault(); e.stopPropagation(); return; }
    const ar = e.target.closest('[data-act="arrange"],[data-act="arrange-reset"],[data-act="blk-move"],[data-act="blk-size"],[data-act="noop"]');
    if (ar) {
      const act = ar.dataset.act; const board = $('.board');
      if (act === 'arrange') { arranging = !arranging; render(); if (arranging) toast('Arrange mode: move and resize, then tap Done'); }
      else if (act === 'arrange-reset' && board) { const L = (S.settings || {}).layout; if (L) delete L[board.dataset.screen]; commit('Back to the standard layout'); }
      else if (act === 'blk-move') { const el = ar.closest('.blk'); const sib = ar.dataset.dir === '-1' ? el.previousElementSibling : el.nextElementSibling; if (sib) { el.parentElement.insertBefore(el, ar.dataset.dir === '-1' ? sib : sib.nextSibling); saveLayout(el.parentElement); } }
      else if (act === 'blk-size') { const el = ar.closest('.blk'); SIZES.forEach(z => el.classList.remove('sz-' + z)); el.classList.add('sz-' + ar.dataset.size); saveLayout(el.parentElement); }
      return;
    }
    const tb = e.target.closest('[data-tab]');
    if (tb && !e.target.closest('[data-act]')) { tab = tb.dataset.tab; sub = 'points'; render(); window.scrollTo(0, 0); return; }
    const sb = e.target.closest('[data-sub]'); if (sb) { sub = sb.dataset.sub; render(); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act, id = a.dataset.id, p = prop(tab);
    const dlg = $('#dlg'); if (dlg.open && $('.menu', dlg)) dlg.close();
    switch (act) {
      case 'close': dlg.close(); break;
      case 'menu': menu(); break;
      case 'about': about(); break;
      case 'settings': settings(); break;
      case 'add-property': editContract(null); break;
      case 'edit-contract': editContract(p); break;
      case 'remove-property':
        if (confirm('Remove ' + p.name + ' and its documents from this app? This doesn\'t change anything with HGV.')) {
          for (const d of p.docs || []) await Store.deleteDoc(d.id).catch(() => {});
          S.properties = S.properties.filter(x => x !== p); tab = 'all'; commit('Removed');
        } break;
      case 'add-batch': editBatch(p); break;
      case 'edit-batch': editBatch(p, p.batches.find(x => x.id === id)); break;
      case 'add-res': editRes(p); break;
      case 'edit-res': editRes(p, p.reservations.find(x => x.id === id)); break;
      case 'add-fee': editFee(p); break;
      case 'edit-fee': editFee(p, p.fees.find(x => x.id === id)); break;
      case 'add-contact': editContact(p); break;
      case 'edit-contact': editContact(p, p.contacts.find(x => x.id === id)); break;
      case 'add-doc': addDoc(p); break;
      case 'edit-doc': editDoc(p, p.docs.find(x => x.id === id)); break;
      case 'open-doc': Store.openDoc(p.docs.find(x => x.id === id)).catch(err => toast(err.message, true)); break;
      case 'import-pdf': importPdf(p); break;
      case 'reveal': if (Store.native) reveal(p, a.dataset.which); break;
      case 'pick-folder': try { const r = await Store.pickFolder(); if (r) { toast('Folder chosen'); autoLoad(); } } catch (err) { toast(err.message, true); } break;
      case 'import-file': { const f = await pickFile(''); if (f) { if (f.size > 20e6) toast('That file is too big to be a data file.', true); else importData(await f.text()); } break; }
      case 'send-copy': {
        if (!S.properties.length) { toast('Nothing to send yet.', true); break; }
        const copy = { app: 'HGVC Binder', schema: H.SCHEMA, asOf: (S.meta && S.meta.hgvAsOf) || today(), generated: new Date().toISOString(), source: 'Shared from HGVC Binder',
          properties: S.properties.map(p => Object.assign({}, p, { docs: [], locked: undefined, suppress: undefined }, Object.fromEntries(['batches', 'ledger', 'reservations', 'fees'].map(k => [k, (p[k] || []).map(x => Object.assign({}, x, { source: undefined }))])))) };
        Store.share('Claude - HGVC Binder Data ' + today() + '.json', new Blob([JSON.stringify(copy)], { type: 'application/json' }));
        toast('Send it by Messages, Mail or AirDrop. They save it to Files, then use “Open a data file”.'); break;
      }
      case 'ics': Store.share('HGVC Binder reminders.ics', new Blob([H.buildICS(S, today())], { type: 'text/calendar' })); toast('Open the file to add the dates to your calendar'); break;
      case 'backup': Store.share('HGVC Binder backup ' + today() + '.json', new Blob([JSON.stringify(Object.assign({}, S, { app: 'HGVC Binder', kind: 'backup', savedAt: today() }), null, 1)], { type: 'application/json' })); break;
    }
  });
  document.addEventListener('change', e => {
    const c = e.target.closest('[data-act="toggle-paid"]'); if (!c) return;
    const f = prop(tab).fees.find(x => x.id === c.dataset.id);
    f.paid = c.checked; f.paidBy = c.checked ? 'me' : null; f.paidDate = c.checked ? (f.paidDate || today()) : null; commit(c.checked ? 'Marked paid' : 'Marked unpaid');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('tr[data-tab],li[data-tab]')) e.target.click(); });

  // ---------- start ----------
  async function start() {
    const saved = await Store.load();
    if (saved && Array.isArray(saved.properties)) {
      S = Object.assign(H.emptyState(), saved);
      S.properties = saved.properties.filter(p => p && typeof p === 'object' && p.name).map(H.normalizeProperty);
    }
    render();
    autoLoad();
    if (Store.native) { Store.on('foreground', autoLoad); Store.schedule(H.notifications(S, today())).catch(() => {}); }
    else if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.HBApp = { importData, get state() { return S; } };
  start();
})();
