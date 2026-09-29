/* Thumbnail downloader: reads thumbnails straight from YouTube's image CDN (i.ytimg.com). */
(function () {
  'use strict';
  var TT = window.TT;
  var L = TT.i18n();
  var form = document.getElementById('dl-form');
  if (!form) return;
  var input = document.getElementById('dl-url');
  var errorBox = document.getElementById('dl-error');
  var results = document.getElementById('dl-results');
  var grid = document.getElementById('dl-grid');
  var metaBox = document.getElementById('dl-meta');
  var historyWrap = document.getElementById('dl-history-wrap');
  var historyList = document.getElementById('dl-history');
  var HISTORY_KEY = 'tt.history';

  var SIZES = [
    { key: 'maxresdefault', w: 1280, h: 720, label: L.max },
    { key: 'sddefault', w: 640, h: 480, label: L.sd },
    { key: 'hqdefault', w: 480, h: 360, label: L.hq },
    { key: 'mqdefault', w: 320, h: 180, label: L.mq },
    { key: 'default', w: 120, h: 90, label: L.small }
  ];

  var current = { id: null, title: null };

  function fileBase() {
    var t = (current.title || 'youtube-thumbnail-' + current.id).normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || current.id;
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    results.hidden = true;
  }

  function download(size, btn) {
    var url = TT.thumbUrl(current.id, size.key);
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = L.downloading;
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.blob();
    }).then(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileBase() + '-' + size.w + 'x' + size.h + '.jpg';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      btn.textContent = L.done;
    }).catch(function () {
      window.open(url, '_blank', 'noopener');
      btn.textContent = label;
    }).finally(function () {
      btn.disabled = false;
      setTimeout(function () { btn.textContent = label; }, 1800);
    });
  }

  function card(size) {
    var el = document.createElement('div');
    el.className = 'thumb-card';
    el.hidden = true;
    el._size = size;
    var url = TT.thumbUrl(current.id, size.key);
    el.innerHTML =
      '<img alt="" width="' + size.w + '" height="' + size.h + '">' +
      '<div class="thumb-card-body"><div><strong>' + TT.esc(size.label) + '</strong>' +
      '<small>' + size.w + ' × ' + size.h + ' px · ' + size.key + '.jpg</small></div>' +
      '<div class="thumb-card-actions">' +
      '<button type="button" class="btn btn-primary btn-sm js-dl">' + TT.esc(L.download) + '</button>' +
      '<button type="button" class="btn btn-ghost btn-sm js-copy">' + TT.esc(L.copy) + '</button>' +
      '</div></div>';
    var img = el.querySelector('img');
    img.alt = L.altPrefix + ' ' + size.w + '×' + size.h;
    img.style.aspectRatio = size.w + ' / ' + size.h;
    img.style.objectFit = 'contain';
    img.style.background = '#000';
    img.onload = function () {
      // Missing sizes come back as a 120×90 grey placeholder.
      if (size.key !== 'default' && img.naturalWidth <= 120) { el.remove(); pickMain(); return; }
      el.hidden = false;
      pickMain();
    };
    img.onerror = function () { el.remove(); pickMain(); };
    img.src = url;
    el.querySelector('.js-dl').addEventListener('click', function (e) { download(size, e.currentTarget); });
    el.querySelector('.js-copy').addEventListener('click', function (e) { TT.copy(url, e.currentTarget, L.copied); });
    return el;
  }

  function pickMain() {
    var first = grid.querySelector('.thumb-card:not([hidden])');
    grid.querySelectorAll('.thumb-card').forEach(function (c) { c.classList.toggle('is-main', c === first); });
  }

  function renderMeta() {
    var links =
      '<button type="button" class="btn btn-primary btn-sm" id="dl-all">' + TT.esc(L.all) + '</button> ' +
      '<a class="btn btn-ghost btn-sm" href="' + L.analyzerUrl + '?v=' + current.id + '">' + TT.esc(L.analyze) + '</a> ' +
      '<a class="btn btn-ghost btn-sm" href="' + L.previewUrl + '?v=' + current.id + '">' + TT.esc(L.preview) + '</a>';
    metaBox.innerHTML =
      '<div><p class="title">' + TT.esc(current.title || L.untitled) + '</p>' +
      '<p class="channel">' + TT.esc(current.channel || '') + '</p></div>';
    document.getElementById('dl-links').innerHTML = links;
    document.getElementById('dl-all').addEventListener('click', downloadAll);
  }

  // Downloads every size that exists for this video, one after another.
  function downloadAll(e) {
    var btn = e.currentTarget;
    var cards = Array.prototype.filter.call(grid.querySelectorAll('.thumb-card'), function (c) { return !c.hidden && c._size; });
    btn.disabled = true;
    (function next(i) {
      if (i >= cards.length) { btn.disabled = false; return; }
      download(cards[i]._size, cards[i].querySelector('.js-dl'));
      setTimeout(function () { next(i + 1); }, 700);
    })(0);
  }

  function saveHistory() {
    var h = TT.store.get(HISTORY_KEY, []).filter(function (x) { return x !== current.id; });
    h.unshift(current.id);
    TT.store.set(HISTORY_KEY, h.slice(0, 8));
    renderHistory();
  }

  function renderHistory() {
    var h = TT.store.get(HISTORY_KEY, []);
    historyWrap.hidden = !h.length;
    historyList.innerHTML = h.map(function (id) {
      return '<button type="button" data-id="' + TT.esc(id) + '" title="' + TT.esc(id) + '">' +
        '<img src="' + TT.thumbUrl(id, 'mqdefault') + '" alt="" loading="lazy" width="320" height="180"></button>';
    }).join('');
  }

  function run(id) {
    errorBox.hidden = true;
    current = { id: id, title: null, channel: null };
    grid.innerHTML = '';
    SIZES.forEach(function (s) { grid.appendChild(card(s)); });
    results.hidden = false;
    renderMeta();
    saveHistory();
    TT.oembed(id).then(function (d) {
      current.title = d.title; current.channel = d.author_name; renderMeta();
    }).catch(function () { /* private or removed video: thumbnails may still exist */ });
    if (history.replaceState) history.replaceState(null, '', location.pathname + '?v=' + id);
    setTimeout(function () { results.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = TT.videoId(input.value);
    if (!id) { showError(L.invalid); return; }
    run(id);
  });

  historyList.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-id]');
    if (!b) return;
    input.value = 'https://www.youtube.com/watch?v=' + b.dataset.id;
    run(b.dataset.id);
  });
  document.getElementById('dl-clear-history').addEventListener('click', function () {
    TT.store.remove(HISTORY_KEY); renderHistory();
  });

  renderHistory();
  var pre = new URLSearchParams(location.search).get('v');
  if (pre && TT.videoId(pre)) { input.value = 'https://www.youtube.com/watch?v=' + pre; run(TT.videoId(pre)); }
})();
