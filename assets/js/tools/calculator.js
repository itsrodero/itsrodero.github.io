/* YouTube revenue calculator: views × RPM, with indicative niche ranges and a separate Shorts line. */
(function () {
  'use strict';
  var TT = window.TT;
  var L = TT.i18n();
  var form = document.getElementById('rc-form');
  if (!form) return;

  // Indicative long-form RPM ranges (USD, US-heavy audiences). Same table as the "RPM by niche" guide.
  var NICHES = {
    finance: [8, 25], business: [7, 20], tech: [5, 15], education: [3, 10], auto: [3, 9], health: [3, 8],
    lifestyle: [2, 7], beauty: [2, 6], entertainment: [1, 4], gaming: [1, 4], kids: [0.5, 2]
  };
  var $ = function (id) { return document.getElementById(id); };
  var saved = TT.store.get('tt.calc.' + TT.lang, null);
  if (saved) {
    ['rc-views', 'rc-period', 'rc-mode', 'rc-niche', 'rc-rpm', 'rc-shorts', 'rc-srpm', 'rc-cur'].forEach(function (id) {
      if (saved[id] !== undefined && $(id)) $(id).value = saved[id];
    });
  }

  function num(id) {
    var v = parseFloat($(id).value);
    return isFinite(v) && v >= 0 ? v : 0;
  }
  function money(v) {
    var cur = $('rc-cur').value;
    try {
      return new Intl.NumberFormat(TT.lang === 'es' ? 'es-ES' : 'en-US', { style: 'currency', currency: cur, maximumFractionDigits: v < 100 ? 2 : 0 }).format(v);
    } catch (e) { return cur + ' ' + v.toFixed(2); }
  }

  function syncMode() {
    var custom = $('rc-mode').value === 'custom';
    $('rc-niche-wrap').hidden = custom;
    $('rc-rpm-wrap').hidden = !custom;
  }

  function calc() {
    syncMode();
    var views = num('rc-views');
    var period = $('rc-period').value;
    var monthly = period === 'day' ? views * 30.4 : period === 'year' ? views / 12 : views;
    var lo, hi;
    if ($('rc-mode').value === 'custom') { lo = hi = num('rc-rpm'); }
    else { var r = NICHES[$('rc-niche').value]; lo = r[0]; hi = r[1]; }
    var shorts = num('rc-shorts') * num('rc-srpm') / 1000;
    var mLo = monthly * lo / 1000 + shorts, mHi = monthly * hi / 1000 + shorts;
    var range = function (a, b) { return Math.abs(a - b) < 0.005 ? money(a) : money(a) + ' – ' + money(b); };

    $('rc-month').textContent = range(mLo, mHi);
    $('rc-year').textContent = range(mLo * 12, mHi * 12);
    $('rc-day').textContent = range(mLo / 30.4, mHi / 30.4);
    $('rc-shorts-out').textContent = money(shorts);
    $('rc-rpm-used').textContent = lo === hi ? money(lo) : money(lo) + ' – ' + money(hi);
    $('rc-views-month').textContent = Math.round(monthly).toLocaleString(TT.lang === 'es' ? 'es-ES' : 'en-US');

    var state = {};
    ['rc-views', 'rc-period', 'rc-mode', 'rc-niche', 'rc-rpm', 'rc-shorts', 'rc-srpm', 'rc-cur'].forEach(function (id) { state[id] = $(id).value; });
    TT.store.set('tt.calc.' + TT.lang, state);
  }

  form.addEventListener('input', calc);
  form.addEventListener('change', calc);
  form.addEventListener('submit', function (e) { e.preventDefault(); calc(); });
  calc();
})();
