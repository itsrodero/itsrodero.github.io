/* Title idea generator + title length checker. Templates come from the page (per language). */
(function () {
  'use strict';
  var TT = window.TT;
  var L = TT.i18n();
  var form = document.getElementById('tg-form');
  if (!form) return;
  var list = document.getElementById('tg-list');
  var checker = document.getElementById('tc-input');

  var SMALL = ['a', 'an', 'the', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'vs', 'vs.', 'with', 'at', 'by'];
  function titleCase(s) {
    if (TT.lang !== 'en') return s;
    return s.split(/\s+/).map(function (w, i) {
      if (/[A-Z]/.test(w.slice(1))) return w; // keep brand casing like "iPhone" / "YouTube"
      return i > 0 && SMALL.indexOf(w.toLowerCase()) >= 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function clean(topic) {
    var t = topic.trim().replace(/\s+/g, ' ');
    (L.stripPrefixes || []).forEach(function (p) {
      if (t.toLowerCase().indexOf(p) === 0) t = t.slice(p.length);
    });
    return t.trim();
  }

  function fill(tpl, v) {
    var s = tpl.replace(/\{T\}/g, v.T).replace(/\{t\}/g, v.t).replace(/\{R\}/g, v.R).replace(/\{P\}/g, v.P)
      .replace(/\{Y\}/g, v.Y).replace(/\{A\}/g, v.A);
    if (TT.lang === 'es') s = s.replace(/\bde el\b/g, 'del').replace(/\ba el\b/g, 'al');
    return s;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = document.getElementById('tg-topic').value;
    var topic = clean(raw);
    if (!topic) { document.getElementById('tg-topic').focus(); return; }
    var v = {
      T: titleCase(cap(topic)),
      t: TT.lang === 'en' ? titleCase(topic) : topic,
      R: document.getElementById('tg-result').value.trim() || L.defResult,
      P: document.getElementById('tg-period').value.trim() || L.defPeriod,
      Y: String(new Date().getFullYear()),
      A: document.getElementById('tg-audience').value.trim() || L.defAudience
    };
    var style = document.getElementById('tg-style').value;
    var tpls = L.templates.filter(function (t) { return style === 'all' || t.s === style; });
    list.innerHTML = tpls.map(function (t) {
      var title = fill(t.t, v);
      var n = title.length;
      var st = n <= 60 ? ['badge-ok', L.lenGood] : n <= 70 ? ['badge-warn', L.lenOk] : ['badge-bad', L.lenLong];
      return '<li class="title-item"><div style="min-width:0"><p>' + TT.esc(title) + '</p>' +
        '<small>' + TT.esc(t.k) + ' · ' + n + ' ' + TT.esc(L.chars) + ' <span class="badge ' + st[0] + '">' + TT.esc(st[1]) + '</span></small></div>' +
        '<div class="thumb-card-actions"><button type="button" class="btn btn-ghost btn-sm" data-check="' + TT.esc(title) + '">' + TT.esc(L.check) + '</button>' +
        '<button type="button" class="btn btn-primary btn-sm" data-copy="' + TT.esc(title) + '">' + TT.esc(L.copy) + '</button></div></li>';
    }).join('');
    document.getElementById('tg-results').hidden = false;
    document.getElementById('tg-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  list.addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]');
    if (c) { TT.copy(c.dataset.copy, c, L.copied); return; }
    var k = e.target.closest('[data-check]');
    if (k) {
      checker.value = k.dataset.check; analyze();
      checker.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // ----- checker
  var CUT_MOBILE = 55, CUT_SIDE = 70;
  function cutAt(s, n) {
    if (s.length <= n) return TT.esc(s);
    var cut = s.slice(0, n);
    var sp = cut.lastIndexOf(' ');
    if (sp > n - 15) cut = cut.slice(0, sp);
    return TT.esc(cut) + '<mark>…</mark>';
  }

  function analyze() {
    var s = checker.value;
    var out = document.getElementById('tc-out');
    if (!s.trim()) { out.hidden = true; return; }
    out.hidden = false;
    var n = s.length;
    var notes = [];
    var words = s.split(/\s+/).filter(Boolean);
    var caps = words.filter(function (w) { return w.length > 2 && w === w.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(w); }).length;
    var emoji = (s.match(/\p{Extended_Pictographic}/gu) || []).length;

    if (n > 100) notes.push(['bad', L.nTooLong]);
    else if (n > CUT_SIDE) notes.push(['warn', L.nLong]);
    else if (n < 20) notes.push(['warn', L.nShort]);
    else notes.push(['ok', L.nGood]);
    if (words.length && caps / words.length > 0.3) notes.push(['warn', L.nCaps]);
    if (/[!?]{2,}/.test(s)) notes.push(['warn', L.nPunct]);
    if (emoji > 2) notes.push(['warn', L.nEmoji]);
    if (/\d/.test(s)) notes.push(['ok', L.nNumber]);
    var low = s.toLowerCase();
    if ((L.hype || []).some(function (h) { return low.indexOf(h) >= 0; })) notes.push(['warn', L.nHype]);
    if ((L.vague || []).some(function (h) { return low.indexOf(h) === 0; })) notes.push(['warn', L.nVague]);

    document.getElementById('tc-count').textContent = n + ' / 100';
    document.getElementById('tc-count').className = 'badge ' + (n > CUT_SIDE ? 'badge-bad' : n > 60 ? 'badge-warn' : 'badge-ok');
    document.getElementById('tc-mobile').innerHTML = cutAt(s, CUT_MOBILE);
    document.getElementById('tc-side').innerHTML = cutAt(s, CUT_SIDE);
    var badge = { ok: 'badge-ok', warn: 'badge-warn', bad: 'badge-bad' };
    var label = { ok: L.bOk, warn: L.bWarn, bad: L.bBad };
    document.getElementById('tc-notes').innerHTML = notes.map(function (x) {
      return '<li><span class="badge ' + badge[x[0]] + '">' + TT.esc(label[x[0]]) + '</span> ' + TT.esc(x[1]) + '</li>';
    }).join('');
  }
  checker.addEventListener('input', analyze);
})();
