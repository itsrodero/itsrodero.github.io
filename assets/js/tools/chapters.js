/* Chapters (timestamps) formatter: normalizes timestamps and checks YouTube's chapter rules. */
(function () {
  'use strict';
  var TT = window.TT;
  var L = TT.i18n();
  var input = document.getElementById('ch-input');
  if (!input) return;
  var lengthInput = document.getElementById('ch-length');
  var fix = document.getElementById('ch-fix');
  var out = document.getElementById('ch-output');
  var issues = document.getElementById('ch-issues');
  var KEY = 'tt.chapters';

  var saved = TT.store.get(KEY, null);
  if (saved) { input.value = saved.text || ''; lengthInput.value = saved.len || ''; }

  var TIME = /(?:^|[\s(\[])((?:\d{1,2}:)?\d{1,2}:\d{2})(?=$|[\s)\]\-–—:|.,])/;

  function toSec(t) {
    var p = t.split(':').map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  }
  function fmt(sec, long) {
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    var ss = (s < 10 ? '0' : '') + s;
    if (long) return h + ':' + (m < 10 ? '0' : '') + m + ':' + ss;
    return m + ':' + ss;
  }
  function clean(title) {
    return title.replace(/^[\s\-–—:|.,)\]]+/, '').replace(/[\s\-–—:|(\[]+$/, '').trim();
  }

  function parse(text) {
    var rows = [];
    text.split(/\r?\n/).forEach(function (line, i) {
      if (!line.trim()) return;
      var m = line.match(TIME);
      if (!m) { rows.push({ line: i + 1, error: true, raw: line.trim() }); return; }
      var title = clean(line.replace(m[1], ' ').replace(/[()\[\]]/g, ' ').replace(/\s+/g, ' '));
      rows.push({ line: i + 1, sec: toSec(m[1]), title: title });
    });
    return rows;
  }

  function run() {
    TT.store.set(KEY, { text: input.value, len: lengthInput.value });
    var rows = parse(input.value);
    var problems = [];
    var chapters = rows.filter(function (r) { return !r.error; });
    rows.filter(function (r) { return r.error; }).forEach(function (r) {
      problems.push(['warn', L.noTime.replace('{n}', r.line).replace('{t}', r.raw.slice(0, 40))]);
    });
    if (fix.checked) {
      chapters.sort(function (a, b) { return a.sec - b.sec; });
      chapters = chapters.filter(function (c, i) { return i === 0 || c.sec !== chapters[i - 1].sec; });
      if (chapters.length && chapters[0].sec !== 0) chapters.unshift({ sec: 0, title: L.introTitle, added: true });
    }
    var len = 0;
    if (lengthInput.value.trim()) {
      var lv = lengthInput.value.trim();
      len = lv.indexOf(':') >= 0 ? toSec(lv) : parseFloat(lv) * 60;
    }

    if (!chapters.length) {
      out.value = '';
      issues.innerHTML = rows.length ? problems.map(li).join('') : '<li>' + TT.esc(L.empty) + '</li>';
      return;
    }
    if (chapters[0].sec !== 0) problems.push(['bad', L.first]);
    if (chapters.length < 3) problems.push(['bad', L.three]);
    for (var i = 1; i < chapters.length; i++) {
      if (chapters[i].sec <= chapters[i - 1].sec) problems.push(['bad', L.order.replace('{t}', fmt(chapters[i].sec, false))]);
      else if (chapters[i].sec - chapters[i - 1].sec < 10) problems.push(['bad', L.short.replace('{t}', fmt(chapters[i - 1].sec, false))]);
    }
    if (len) {
      var last = chapters[chapters.length - 1];
      if (last.sec >= len) problems.push(['bad', L.beyond.replace('{t}', fmt(last.sec, false))]);
      else if (len - last.sec < 10) problems.push(['bad', L.short.replace('{t}', fmt(last.sec, false))]);
    }
    chapters.forEach(function (c) { if (!c.title) problems.push(['warn', L.noTitle.replace('{t}', fmt(c.sec, false))]); });
    if (chapters.some(function (c) { return c.added; })) problems.push(['info', L.added]);

    var long = chapters.some(function (c) { return c.sec >= 3600; }) || len >= 3600;
    out.value = chapters.map(function (c) { return fmt(c.sec, long) + ' ' + (c.title || '…'); }).join('\n');
    var bad = problems.filter(function (p) { return p[0] === 'bad'; }).length;
    if (!bad) problems.unshift(['ok', L.valid.replace('{n}', chapters.length)]);
    issues.innerHTML = problems.map(li).join('');
  }

  function li(p) {
    var cls = { ok: 'badge-ok', warn: 'badge-warn', bad: 'badge-bad', info: 'badge-muted' }[p[0]];
    var lab = { ok: L.bOk, warn: L.bWarn, bad: L.bBad, info: L.bInfo }[p[0]];
    return '<li><span class="badge ' + cls + '">' + TT.esc(lab) + '</span> ' + TT.esc(p[1]) + '</li>';
  }

  input.addEventListener('input', run);
  lengthInput.addEventListener('input', run);
  fix.addEventListener('change', run);
  document.getElementById('ch-copy').addEventListener('click', function (e) { TT.copy(out.value, e.currentTarget, L.copied); });
  document.getElementById('ch-example').addEventListener('click', function () { input.value = L.example; run(); });
  run();
})();
