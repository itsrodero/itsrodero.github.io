/* YouTube revenue calculator: views × RPM, with indicative niche ranges scaled by audience country and a separate Shorts line. */
(function () {
  'use strict';
  var TT = window.TT;
  var form = document.getElementById('rc-form');
  if (!form) return;

  // Indicative long-form RPM ranges (USD, US-heavy audiences). Same table as the "RPM by niche" guide.
  var NICHES = {
    finance: [8, 25], business: [7, 20], realestate: [7, 18], legal: [7, 18], tech: [5, 15], education: [3, 10],
    diy: [3, 9], auto: [3, 9], history: [3, 8], health: [3, 8], lifestyle: [2, 7], parenting: [2, 6],
    truecrime: [2, 6], beauty: [2, 6], animals: [1.5, 5], news: [1.5, 5], sports: [1.5, 5],
    entertainment: [1, 4], gaming: [1, 4], music: [1, 3], kids: [0.5, 2]
  };
  // Share of the US-heavy range by audience. Same factors as the "RPM by country" table in the guide.
  var AUDIENCE = { tier1: 1, jpkr: 0.5, weu: 0.35, hispanic: 0.15, latam: 0.1, asia: 0.05, world: 0.25 };
  var FIELDS = ['rc-views', 'rc-period', 'rc-mode', 'rc-niche', 'rc-aud', 'rc-rpm', 'rc-shorts', 'rc-srpm', 'rc-cur'];
  var es = TT.lang === 'es';
  var $ = function (id) { return document.getElementById(id); };

  var saved = TT.store.get('tt.calc.' + TT.lang, null);
  if (saved) {
    FIELDS.forEach(function (id) {
      if (saved[id] !== undefined && $(id)) $(id).value = saved[id];
    });
  }
  // Links from the guides can preselect a niche and audience: #niche=finance&aud=weu
  var hash = location.hash.replace(/^#/, '');
  if (hash) {
    hash.split('&').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv[0] === 'niche' && NICHES[kv[1]]) { $('rc-niche').value = kv[1]; $('rc-mode').value = 'niche'; }
      if (kv[0] === 'aud' && AUDIENCE[kv[1]] !== undefined) { $('rc-aud').value = kv[1]; $('rc-mode').value = 'niche'; }
    });
  }

  function num(id) {
    var v = parseFloat($(id).value);
    return isFinite(v) && v >= 0 ? v : 0;
  }
  function money(v, cur, digits) {
    cur = cur || $('rc-cur').value;
    if (digits === undefined) digits = v < 100 ? 2 : 0;
    try {
      return new Intl.NumberFormat(es ? 'es-ES' : 'en-US', { style: 'currency', currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
    } catch (e) { return cur + ' ' + v.toFixed(digits); }
  }

  function syncMode() {
    var custom = $('rc-mode').value === 'custom';
    $('rc-niche-wrap').hidden = custom;
    $('rc-aud-wrap').hidden = custom;
    $('rc-rpm-wrap').hidden = !custom;
    $('rc-basis').hidden = custom;
  }

  function calc() {
    syncMode();
    var views = num('rc-views');
    var period = $('rc-period').value;
    var monthly = period === 'day' ? views * 30.4 : period === 'year' ? views / 12 : views;
    var lo, hi;
    if ($('rc-mode').value === 'custom') {
      lo = hi = num('rc-rpm');
    } else {
      var r = NICHES[$('rc-niche').value] || NICHES.education;
      var f = AUDIENCE[$('rc-aud').value];
      if (f === undefined) f = 1;
      lo = r[0] * f; hi = r[1] * f;
      $('rc-basis').textContent = es
        ? 'Rango del nicho con público de EE. UU.: ' + money(r[0]) + ' – ' + money(r[1]) + ' × ' + Math.round(f * 100) + ' % por el país del público.'
        : 'Niche range for a US-heavy audience: ' + money(r[0]) + ' – ' + money(r[1]) + ' × ' + Math.round(f * 100) + '% for audience country.';
    }
    var shorts = num('rc-shorts') * num('rc-srpm') / 1000;
    var mLo = monthly * lo / 1000 + shorts, mHi = monthly * hi / 1000 + shorts;
    // Both ends of a range use the same number of decimals, decided by the larger one.
    var range = function (a, b) {
      if (Math.abs(a - b) < 0.005) return money(a);
      var d = Math.max(a, b) < 100 ? 2 : 0;
      return money(a, null, d) + ' – ' + money(b, null, d);
    };

    $('rc-month').textContent = range(mLo, mHi);
    $('rc-year').textContent = range(mLo * 12, mHi * 12);
    $('rc-day').textContent = range(mLo / 30.4, mHi / 30.4);
    $('rc-shorts-out').textContent = money(shorts);
    $('rc-rpm-used').textContent = lo === hi ? money(lo) : money(lo) + ' – ' + money(hi);
    $('rc-views-month').textContent = Math.round(monthly).toLocaleString(es ? 'es-ES' : 'en-US');

    var state = {};
    FIELDS.forEach(function (id) { state[id] = $(id).value; });
    TT.store.set('tt.calc.' + TT.lang, state);
  }

  form.addEventListener('input', calc);
  form.addEventListener('change', calc);
  form.addEventListener('submit', function (e) { e.preventDefault(); calc(); });
  calc();
})();
