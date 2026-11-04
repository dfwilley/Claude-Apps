// Blue Book — Excel, CSV, backup and the printable PDF summary.
(function (root) {
  'use strict';
  const C = root.BBCareer, F = root.BBFiles;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const sorted = flights => flights.slice().sort((a, b) => (a.date || '9').localeCompare(b.date || '9') || (a.row || 0) - (b.row || 0));
  const photoName = (db, f) => { const p = db.pages.find(p => p.id === f.pageId); return p ? `photos/${p.photoId}.jpg` : ''; };
  const pageLabel = (db, f) => { const p = db.pages.find(p => p.id === f.pageId); return p ? `${p.label || ''}`.trim() : ''; };

  const FLIGHT_COLS = [
    ['Date', 'date', 14, 'date'], ['Type/model', 'type', 11], ['BuNo', 'buno', 9], ['Squadron', 'squadron', 12], ['Kind of flight', 'kind', 9],
    ['Flight time', 'total', 8, 'hours'], ['Night', 'night', 7, 'hours'], ['Day', '_day', 7, 'hours'], ['Instr. actual', 'instActual', 8, 'hours'], ['Instr. sim', 'instSim', 8, 'hours'],
    ['Approaches', 'approaches', 8, 'num'], ['Landings day', 'dayLand', 8, 'num'], ['Landings night', 'nightLand', 8, 'num'],
    ['Ship landings day', 'dayShip', 9, 'num'], ['Ship landings night', 'nightShip', 9, 'num'], ['Traps day', 'dayTraps', 7, 'num'], ['Traps night', 'nightTraps', 7, 'num'],
    ['Cat shots', 'cats', 7, 'num'], ['Ship', 'ship', 18], ['Remarks', 'remarks', 34], ['Logbook page', '_page', 16], ['Page photo', '_photo', 26, 'link'], ['Needs a look', '_flags', 30],
  ];
  function flightValue(db, f, key) {
    if (key === '_day') return f.total != null ? Math.round(Math.max(0, f.total - (f.night || 0)) * 10) / 10 : null;
    if (key === '_photo') return photoName(db, f);
    if (key === '_page') return pageLabel(db, f);
    if (key === '_flags') return (f.flags || []).map(x => `${x.field}: ${x.reason}`).join('; ');
    return f[key];
  }

  const TOTAL_COLS = [['Flights', 'flights', 'num'], ['Hours', 'hours', 'hours'], ['Day', 'day', 'hours'], ['Night', 'night', 'hours'], ['Instr. actual', 'instActual', 'hours'], ['Instr. sim', 'instSim', 'hours'],
    ['Landings', 'landings', 'num'], ['Ship landings', 'shipLandings', 'num'], ['Night ship landings', 'nightShipLandings', 'num'], ['Traps', 'traps', 'num'], ['Night traps', 'nightTraps', 'num'], ['Cat shots', 'cats', 'num'],
    ['First flight', 'first', 'date'], ['Last flight', 'last', 'date']];
  function totalsSheet(name, firstHeader, list, all) {
    return { name, columns: [{ header: firstHeader, width: 20 }, ...TOTAL_COLS.map(([h, , k]) => ({ header: h, width: k === 'date' ? 14 : 10, kind: k }))],
      rows: [...list.map(t => [t.name, ...TOTAL_COLS.map(([, k]) => t[k])]), ['All', ...TOTAL_COLS.map(([, k]) => all[k])]] };
  }

  function workbook(db) {
    const flights = sorted(db.flights); const t = C.totals(flights);
    const sheets = [
      { name: 'Flights', columns: FLIGHT_COLS.map(([h, , w, k]) => ({ header: h, width: w, kind: k })), rows: flights.map(f => FLIGHT_COLS.map(([, key]) => flightValue(db, f, key))) },
      totalsSheet('By aircraft', 'Type/model', t.type, t.all), totalsSheet('By squadron', 'Squadron', t.squadron, t.all),
      totalsSheet('By ship', 'Ship', t.ship, t.all), totalsSheet('By year', 'Year', t.year, t.all),
      { name: 'Deployments', columns: [{ header: 'Name', width: 36 }, { header: 'Ship', width: 18 }, { header: 'Squadron', width: 14 }, { header: 'Start', width: 14, kind: 'date' }, { header: 'End', width: 14, kind: 'date' },
        { header: 'Flights', width: 9, kind: 'num' }, { header: 'Ship landings', width: 11, kind: 'num' }, { header: 'Traps', width: 9, kind: 'num' }],
        rows: (db.deployments || []).filter(d => d.status === 'confirmed').sort((a, b) => a.start.localeCompare(b.start)).map(d => [d.name, d.ship, d.squadron, d.start, d.end, d.flights, d.shipLandings, d.traps]) },
      { name: 'Logbook pages', columns: [{ header: 'Page', width: 18 }, { header: 'Month', width: 10 }, { header: 'Year', width: 8, kind: 'num' }, { header: 'Squadron', width: 14 }, { header: 'Ship', width: 18 },
        { header: 'Flights', width: 8, kind: 'num' }, { header: 'Photo', width: 28, kind: 'link' }, { header: 'Added', width: 14, kind: 'date' }],
        rows: db.pages.slice().sort((a, b) => (a.year || 0) - (b.year || 0) || (a.month || 0) - (b.month || 0)).map(p => [p.label || '', p.month ? C.monthYear(`2000-${String(p.month).padStart(2, '0')}-01`).slice(0, 3) : '', p.year || null, p.squadron || '', p.ship || '',
          db.flights.filter(f => f.pageId === p.id).length, `photos/${p.photoId}.jpg`, (p.added || '').slice(0, 10)]) },
    ];
    return F.xlsx(sheets);
  }

  function flightsCSV(db) {
    const flights = sorted(db.flights);
    return F.csv([FLIGHT_COLS.map(c => c[0]), ...flights.map(f => FLIGHT_COLS.map(([, key]) => flightValue(db, f, key)))]);
  }

  async function backup(db, store, onProgress) {
    const files = [
      { name: 'README.txt', data: 'Blue Book backup\r\n\r\nBlue Book.xlsx - every flight plus career totals (opens in Excel or Numbers).\r\nflights.csv - the same flights as plain text.\r\nphotos/ - your logbook page photos; the Excel file links to them.\r\nbluebook.json - everything, for restoring into Blue Book (Settings > Restore from a backup).\r\n' },
      { name: 'bluebook.json', data: JSON.stringify(db) },
      { name: 'Blue Book.xlsx', data: workbook(db) },
      { name: 'flights.csv', data: flightsCSV(db) },
    ];
    let i = 0;
    for (const p of db.pages) {
      try { files.push({ name: `photos/${p.photoId}.jpg`, data: await store.getPhoto(p.photoId) }); } catch (e) { /* missing photo: skip */ }
      if (onProgress) onProgress(++i / db.pages.length);
    }
    return F.zip(files);
  }

  // ---------- PDF summary ----------
  async function pdf(db, opts, store, onProgress) {
    const { jsPDF } = root.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const W = 612, H = 792, M = 50; let y = M;
    const navy = [20, 48, 94], gold = [176, 132, 40], gray = [90, 90, 90];
    const flights = sorted(db.flights); const t = C.totals(flights);
    const name = (db.settings && db.settings.name) || 'Naval Aviator';
    const fmt1 = v => (v || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const fmt0 = v => (v || 0).toLocaleString('en-US');
    const clean = s => String(s == null ? '' : s).replace(/[—–]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    const page = () => { doc.addPage(); y = M; footer(); };
    let pageNo = 1;
    const footer = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...gray); doc.text(clean(`Blue Book - ${name} - page ${pageNo++}`), W / 2, H - 24, { align: 'center' }); };
    const need = h => { if (y + h > H - 50) page(); };
    const heading = s => { need(90); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...navy); doc.text(clean(s), M, y + 12); y += 20; doc.setDrawColor(...gold); doc.setLineWidth(1.2); doc.line(M, y, W - M, y); y += 12; };
    function table(cols, rows, opt) {
      opt = opt || {}; const widths = cols.map(c => c.w); const total = widths.reduce((s, v) => s + v, 0); const sc = (W - 2 * M) / total;
      const head = () => { doc.setFillColor(...navy); doc.rect(M, y, W - 2 * M, 18, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255); let x = M; cols.forEach((c, i) => { const w = widths[i] * sc; doc.text(clean(c.h), c.num ? x + w - 4 : x + 4, y + 12, { align: c.num ? 'right' : 'left' }); x += w; }); y += 18; };
      need(40); head();
      rows.forEach((r, ri) => {
        if (y + 16 > H - 50) { page(); head(); }
        const last = opt.boldLast && ri === rows.length - 1;
        if (ri % 2 === 0 || last) { doc.setFillColor(last ? 232 : 244, last ? 236 : 246, last ? 246 : 250); doc.rect(M, y, W - 2 * M, 16, 'F'); }
        doc.setFont('helvetica', last ? 'bold' : 'normal'); doc.setFontSize(8.5); doc.setTextColor(30, 30, 30);
        let x = M; r.forEach((v, i) => { const w = widths[i] * sc; let s = clean(v); while (s.length > 3 && doc.getTextWidth(s) > w - 8) s = s.slice(0, -2); if (s !== clean(v)) s += '…'.replace('…', '.'); doc.text(s, cols[i].num ? x + w - 4 : x + 4, y + 11, { align: cols[i].num ? 'right' : 'left' }); x += w; });
        y += 16;
      });
      y += 14;
    }

    // Cover
    footer();
    doc.setFillColor(...navy); doc.rect(0, 0, W, 170, 'F');
    doc.setTextColor(232, 200, 120); doc.setFont('times', 'bold'); doc.setFontSize(34); doc.text('BLUE BOOK', M, 78);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal'); doc.setFontSize(15); doc.text(clean(`Flight record of ${name}`), M, 108);
    doc.setFontSize(10.5); doc.text(clean(t.all.first ? `${C.longDate(t.all.first)} to ${C.longDate(t.all.last)}` : 'No flights yet'), M, 130);
    doc.text(clean(`Made ${C.longDate(today())} from ${db.pages.length} logbook pages`), M, 148);
    y = 200;
    const tiles = [['Total hours', fmt1(t.all.hours)], ['Flights', fmt0(t.all.flights)], ['Night hours', fmt1(t.all.night)], ['Instrument hours', fmt1(t.all.instActual + t.all.instSim)],
      ['Traps', fmt0(t.all.traps)], ['Night traps', fmt0(t.all.nightTraps)], ['Ship landings', fmt0(t.all.shipLandings)], ['Cat shots', fmt0(t.all.cats)]];
    const tw = (W - 2 * M - 3 * 10) / 4;
    tiles.forEach(([label, v], i) => {
      const x = M + (i % 4) * (tw + 10), ty = y + Math.floor(i / 4) * 74;
      doc.setDrawColor(200, 206, 220); doc.setLineWidth(0.8); doc.roundedRect(x, ty, tw, 64, 6, 6, 'S');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...navy); doc.text(v, x + 10, ty + 30);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gray); doc.text(label, x + 10, ty + 50);
    });
    y += 160;
    heading('Day and night');
    table([{ h: '', w: 3 }, { h: 'Hours', w: 1, num: 1 }, { h: 'Landings', w: 1, num: 1 }, { h: 'Ship landings', w: 1.2, num: 1 }, { h: 'Traps', w: 1, num: 1 }],
      [['Day', fmt1(t.all.day), fmt0(t.all.landings - t.all.nightLandings), fmt0(t.all.shipLandings - t.all.nightShipLandings), fmt0(t.all.traps - t.all.nightTraps)],
       ['Night', fmt1(t.all.night), fmt0(t.all.nightLandings), fmt0(t.all.nightShipLandings), fmt0(t.all.nightTraps)],
       ['Total', fmt1(t.all.hours), fmt0(t.all.landings), fmt0(t.all.shipLandings), fmt0(t.all.traps)]], { boldLast: true });

    const group = (title, label, list) => {
      if (!list.length) return; heading(title);
      table([{ h: label, w: 3 }, { h: 'Flights', w: 1, num: 1 }, { h: 'Hours', w: 1, num: 1 }, { h: 'Night', w: 1, num: 1 }, { h: 'Ship ldg', w: 1, num: 1 }, { h: 'Traps', w: 1, num: 1 }, { h: 'Night traps', w: 1.1, num: 1 }, { h: 'Dates', w: 3 }],
        [...list.map(g => [g.name, fmt0(g.flights), fmt1(g.hours), fmt1(g.night), fmt0(g.shipLandings), fmt0(g.traps), fmt0(g.nightTraps), g.first ? `${C.monthYear(g.first)} - ${C.monthYear(g.last)}` : '']),
          ['All', fmt0(t.all.flights), fmt1(t.all.hours), fmt1(t.all.night), fmt0(t.all.shipLandings), fmt0(t.all.traps), fmt0(t.all.nightTraps), '']], { boldLast: true });
    };
    group('By aircraft', 'Type/model', t.type); group('By squadron', 'Squadron', t.squadron); group('By ship', 'Ship', t.ship); group('By year', 'Year', t.year);

    // Timeline drawing
    const deps = (db.deployments || []).filter(d => d.status === 'confirmed');
    if (t.all.first) {
      heading('Career timeline');
      const y0 = +t.all.first.slice(0, 4), y1 = +t.all.last.slice(0, 4) + 1;
      const x0 = M + 90, x1 = W - M; const span = Date.UTC(y1, 0, 1) - Date.UTC(y0, 0, 1);
      const X = iso => x0 + (Date.parse(iso) - Date.UTC(y0, 0, 1)) / span * (x1 - x0);
      const lanes = [['Squadron', C.segments(flights, 'squadron', 120)], ['Aircraft', C.segments(flights, 'type', 120)], ['At sea', deps.map(d => ({ value: d.ship, start: d.start, end: d.end }))]];
      need(40 + lanes.length * 36);
      doc.setFontSize(7); doc.setTextColor(...gray); doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.5);
      const step = Math.max(1, Math.ceil((y1 - y0) / 12));
      for (let yr = y0; yr <= y1; yr += step) { const x = X(`${yr}-01-01`); doc.line(x, y, x, y + lanes.length * 36); doc.text(String(yr), x, y + lanes.length * 36 + 10, { align: 'center' }); }
      const palette = [[20, 48, 94], [176, 132, 40], [52, 120, 110], [140, 60, 70], [90, 90, 150], [110, 120, 40]];
      lanes.forEach(([label, segs], li) => {
        const ly = y + li * 36; doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...navy); doc.text(label, M, ly + 14);
        const names = [...new Set(segs.map(s => s.value))];
        const sub = {}; // stack overlapping bars
        segs.forEach(s => {
          const c = palette[names.indexOf(s.value) % palette.length]; const xa = X(s.start), xb = Math.max(xa + 3, X(s.end) + 2);
          let row = 0; while ((sub[row] || []).some(([a, b]) => xa < b && xb > a)) row++; (sub[row] = sub[row] || []).push([xa, xb]);
          const by = ly + 2 + row * 11; if (row > 2) return;
          doc.setFillColor(...c); doc.rect(xa, by, xb - xa, 9, 'F');
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(255, 255, 255);
          const lab = clean(s.value); if (doc.getTextWidth(lab) < xb - xa - 4) doc.text(lab, xa + 2, by + 6.8);
        });
      });
      y += lanes.length * 36 + 24;
    }

    if (deps.length) {
      heading('Deployments and ship time');
      table([{ h: 'Name', w: 4 }, { h: 'Ship', w: 2.4 }, { h: 'Dates', w: 3 }, { h: 'Flights', w: 1, num: 1 }, { h: 'Ship ldg', w: 1, num: 1 }, { h: 'Traps', w: 1, num: 1 }],
        deps.sort((a, b) => a.start.localeCompare(b.start)).map(d => [d.name, d.ship, `${C.longDate(d.start)} - ${C.longDate(d.end)}`, fmt0(d.flights), fmt0(d.shipLandings), fmt0(d.traps)]));
    }
    const ms = C.milestones(flights, deps).filter(m => m.kind !== 'deploy-end');
    if (ms.length) {
      heading('Milestones');
      table([{ h: 'Date', w: 1.5 }, { h: 'Milestone', w: 5 }], ms.map(m => [C.longDate(m.date), m.text]));
    }

    if (opts && opts.photos) {
      const pages = db.pages.slice().sort((a, b) => (a.year || 0) - (b.year || 0) || (a.month || 0) - (b.month || 0));
      let i = 0;
      for (const p of pages) {
        try {
          const bytes = await store.getPhoto(p.photoId);
          const img = await root.BBImage.loadImage(new Blob([bytes], { type: 'image/jpeg' }));
          const c = root.BBImage.toCanvas(img, 1600); const data = c.toDataURL('image/jpeg', 0.72);
          const land = c.width > c.height;
          doc.addPage('letter', land ? 'landscape' : 'portrait'); const pw = land ? H : W, ph = land ? W : H;
          const s = Math.min((pw - 60) / c.width, (ph - 80) / c.height);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...navy); doc.text(clean(`Logbook page: ${p.label || ''}`), 30, 30);
          doc.addImage(data, 'JPEG', (pw - c.width * s) / 2, 44, c.width * s, c.height * s);
        } catch (e) { /* skip a missing photo */ }
        if (onProgress) onProgress(++i / pages.length);
      }
    }
    return new Uint8Array(doc.output('arraybuffer'));
  }

  root.BBExport = { workbook, flightsCSV, backup, pdf, today, FLIGHT_COLS };
})(typeof window !== 'undefined' ? window : globalThis);
