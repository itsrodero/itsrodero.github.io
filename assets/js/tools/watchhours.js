/* Watch hours calculator: projects when a channel reaches the YPP watch-time and Shorts thresholds. */
(function () {
  'use strict';
  var TT = window.TT;
  var L = TT.i18n();
  var form = document.getElementById('wh-form');
  if (!form) return;
  var $ = function (id) { return document.getElementById(id); };
  var CHANGE = new Date('2027-02-01T00:00:00');
  var KEY = 'tt.watchhours.' + TT.lang;
  var FIELDS = ['wh-hours', 'wh-views', 'wh-avd', 'wh-subs', 'wh-subgain', 'wh-shorts90', 'wh-shortsday'];

  var saved = TT.store.get(KEY, null);
  if (saved) FIELDS.forEach(function (id) { if (saved[id] !== undefined) $(id).value = saved[id]; });

  function num(id) { var v = parseFloat($(id).value); return isFinite(v) && v >= 0 ? v : 0; }
  function minutes(str) {
    var s = String(str || '').trim();
    if (!s) return 0;
    if (s.indexOf(':') >= 0) {
      var parts = s.split(':').map(Number);
      if (parts.some(isNaN)) return 0;
      return parts.length === 3 ? parts[0] * 60 + parts[1] + parts[2] / 60 : parts[0] + parts[1] / 60;
    }
    var n = parseFloat(s.replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  var loc = TT.lang === 'es' ? 'es-ES' : 'en-US';
  function fmtNum(n, d) { return Number(n).toLocaleString(loc, { maximumFractionDigits: d || 0 }); }
  function fmtDate(d) { return d.toLocaleDateString(loc, { year: 'numeric', month: 'long', day: 'numeric' }); }
  function addDays(days) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + Math.ceil(days)); return d; }

  function target(label, current, perDay, goal, unit) {
    if (current >= goal) return { reached: true, label: label, text: L.reached };
    if (perDay <= 0) return { reached: false, label: label, text: L.noPace };
    var days = (goal - current) / perDay;
    if (days > 3650) return { reached: false, label: label, text: L.tooLong };
    return { reached: false, label: label, days: days, date: addDays(days) };
  }

  function card(r, extra) {
    var body;
    if (r.reached) body = '<b>' + TT.esc(L.done) + '</b><span>' + TT.esc(r.text) + '</span>';
    else if (!r.date) body = '<b>—</b><span>' + TT.esc(r.text) + '</span>';
    else body = '<b>' + TT.esc(fmtDate(r.date)) + '</b><span>' + TT.esc(L.inDays.replace('{d}', fmtNum(Math.ceil(r.days)))) + '</span>';
    return '<div class="result-box' + (extra || '') + '"><span class="label">' + TT.esc(r.label) + '</span>' + body + '</div>';
  }

  function calc() {
    var hours = num('wh-hours');
    var views = num('wh-views');
    var avd = minutes($('wh-avd').value);
    var perDay = views * avd / 60;
    var subs = num('wh-subs');
    var subPerDay = num('wh-subgain') / 30.4;
    var shorts90 = num('wh-shorts90');
    var shortsDay = num('wh-shortsday');

    $('wh-daily').textContent = fmtNum(perDay, 1);
    $('wh-yearly').textContent = fmtNum(perDay * 365);
    $('wh-need').textContent = avd > 0 ? fmtNum(Math.ceil(8000 / 365 * 60 / avd)) : '—';
    $('wh-need4').textContent = avd > 0 ? fmtNum(Math.ceil(4000 / 365 * 60 / avd)) : '—';

    var r4 = target(L.t4000, hours, perDay, 4000);
    var r8 = target(L.t8000, hours, perDay, 8000);
    var rs = target(L.t1000subs, subs, subPerDay, 1000);
    $('wh-results').innerHTML = card(r4) + card(r8, ' highlight') + card(rs);

    // Verdict about the February 1, 2027 change.
    var v;
    var subsOk = subs >= 1000 || (rs.date && rs.date < CHANGE);
    if (r4.reached && subs >= 1000) v = ['ok', L.vNow];
    else if ((r4.reached || (r4.date && r4.date < CHANGE)) && subsOk) v = ['ok', L.vBefore];
    else if (r4.date && r4.date < CHANGE && !subsOk) v = ['warn', L.vSubs];
    else v = ['warn', L.vAfter];
    $('wh-verdict').className = 'callout ' + (v[0] === 'ok' ? 'callout-tip' : 'callout-warn');
    $('wh-verdict').innerHTML = '<span class="callout-title">' + TT.esc(L.verdict) + '</span>' + TT.esc(v[1]);

    // Shorts path: views must be earned within a rolling 90-day window.
    var pace90 = shortsDay * 90;
    var best = Math.max(shorts90, pace90);
    function shortsLine(goal) {
      var ok = best >= goal;
      return '<li><span class="badge ' + (ok ? 'badge-ok' : 'badge-warn') + '">' + fmtNum(goal / 1e6) + 'M</span> ' +
        TT.esc((ok ? L.sOk : L.sNo).replace('{need}', fmtNum(Math.ceil(goal / 90)))) + '</li>';
    }
    $('wh-shorts').innerHTML = shortsLine(10e6) + shortsLine(20e6);

    var state = {};
    FIELDS.forEach(function (id) { state[id] = $(id).value; });
    TT.store.set(KEY, state);
  }

  form.addEventListener('input', calc);
  form.addEventListener('submit', function (e) { e.preventDefault(); calc(); });
  calc();
})();
