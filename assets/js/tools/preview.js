/* Feed preview: shows a thumbnail + title inside mock YouTube layouts, next to real competitor videos. */
(function () {
  'use strict';
  var TT = window.TT;
  var L = TT.i18n();
  var stage = document.getElementById('pv-stage');
  if (!stage) return;
  var KEY = 'tt.preview';
  var saved = TT.store.get(KEY, {});
  var state = {
    variants: [],   // up to 3 of your own thumbnails: { img, name }
    active: 0,
    showAll: false,
    title: saved.title || '',
    channel: saved.channel || '',
    dur: saved.dur || '12:34',
    others: saved.others || [],
    layout: 'home',
    theme: 'light',
    pos: 1
  };

  var el = {
    file: document.getElementById('pv-file'),
    drop: document.getElementById('pv-drop'),
    mineUrl: document.getElementById('pv-mine-url'),
    title: document.getElementById('pv-title'),
    channel: document.getElementById('pv-channel'),
    dur: document.getElementById('pv-dur'),
    count: document.getElementById('pv-count'),
    compUrl: document.getElementById('pv-comp-url'),
    compList: document.getElementById('pv-comp-list'),
    error: document.getElementById('pv-error')
  };
  el.title.value = state.title;
  el.channel.value = state.channel;
  el.dur.value = state.dur;

  function save() {
    TT.store.set(KEY, { title: state.title, channel: state.channel, dur: state.dur, others: state.others });
  }
  function err(msg) { el.error.textContent = msg; el.error.hidden = !msg; }

  // ----- inputs
  el.drop.addEventListener('click', function () { el.file.click(); });
  el.drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.file.click(); } });
  ['dragenter', 'dragover'].forEach(function (ev) { el.drop.addEventListener(ev, function (e) { e.preventDefault(); el.drop.classList.add('drag'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { el.drop.addEventListener(ev, function (e) { e.preventDefault(); el.drop.classList.remove('drag'); }); });
  el.drop.addEventListener('drop', function (e) { useFiles(e.dataTransfer.files); });
  el.file.addEventListener('change', function () { useFiles(el.file.files); });

  function useFiles(list) {
    var files = Array.prototype.filter.call(list || [], function (f) { return /^image\//.test(f.type); }).slice(0, 3);
    if (!files.length) { err(L.notImage); return; }
    err((list.length > 3) ? L.maxVariants : '');
    state.variants.forEach(function (v) { if (v.img.indexOf('blob:') === 0) URL.revokeObjectURL(v.img); });
    state.variants = files.map(function (f) { return { img: URL.createObjectURL(f), name: f.name }; });
    state.active = 0;
    el.drop.querySelector('strong').textContent = files.map(function (f) { return f.name; }).join(', ');
    renderVariantBar(); render();
  }

  var varBar = document.getElementById('pv-varbar');
  var varSeg = document.getElementById('pv-var-seg');
  var allBox = document.getElementById('pv-all');
  function renderVariantBar() {
    varBar.hidden = state.variants.length < 2;
    varSeg.innerHTML = state.variants.map(function (v, i) {
      return '<button type="button" data-var="' + i + '" aria-pressed="' + (i === state.active) + '" title="' + TT.esc(v.name) + '">' +
        TT.esc(L.variant) + ' ' + 'ABC'.charAt(i) + '</button>';
    }).join('');
  }
  varSeg.addEventListener('click', function (e) {
    var b = e.target.closest('[data-var]');
    if (!b) return;
    state.active = +b.dataset.var; state.showAll = false; allBox.checked = false;
    renderVariantBar(); render();
  });
  allBox.addEventListener('change', function () { state.showAll = allBox.checked; render(); });

  document.getElementById('pv-mine-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = TT.videoId(el.mineUrl.value);
    if (!id) { err(L.invalidUrl); return; }
    err('');
    loadMine(id);
  });

  function loadMine(id) {
    var v = { img: TT.thumbUrl(id, 'maxresdefault'), name: 'YouTube' };
    state.variants = [v]; state.active = 0;
    renderVariantBar();
    var probe = new Image();
    probe.onload = function () { if (probe.naturalWidth <= 120) { v.img = TT.thumbUrl(id, 'mqdefault'); render(); } };
    probe.src = v.img;
    TT.oembed(id).then(function (d) {
      if (!el.title.value) { el.title.value = d.title; state.title = d.title; updateCount(); }
      if (!el.channel.value) { el.channel.value = d.author_name; state.channel = d.author_name; }
      save(); render();
    }).catch(function () {});
    render();
  }

  el.title.addEventListener('input', function () { state.title = el.title.value; updateCount(); save(); render(); });
  el.channel.addEventListener('input', function () { state.channel = el.channel.value; save(); render(); });
  el.dur.addEventListener('input', function () { state.dur = el.dur.value; save(); render(); });
  function updateCount() {
    var n = el.title.value.length;
    el.count.textContent = TT.esc(n + ' / 100');
    el.count.className = 'hint' + (n > 70 ? ' warn-text' : '');
  }
  updateCount();

  document.getElementById('pv-comp-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = TT.videoId(el.compUrl.value);
    if (!id) { err(L.invalidUrl); return; }
    if (state.others.length >= 5) { err(L.maxComp); return; }
    if (state.others.some(function (o) { return o.id === id; })) { el.compUrl.value = ''; return; }
    err('');
    var item = { id: id, title: L.loading, channel: '' };
    state.others.push(item);
    el.compUrl.value = '';
    renderComp(); render();
    TT.oembed(id).then(function (d) { item.title = d.title; item.channel = d.author_name; })
      .catch(function () { item.title = L.untitled; })
      .finally(function () { save(); renderComp(); render(); });
  });

  function renderComp() {
    el.compList.innerHTML = state.others.map(function (o, i) {
      return '<li class="title-item"><div style="display:flex;gap:10px;align-items:center;min-width:0">' +
        '<img src="' + TT.thumbUrl(o.id, 'mqdefault') + '" alt="" width="80" height="45" style="border-radius:6px;flex:none">' +
        '<p style="font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + TT.esc(o.title) + '</p></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-rm="' + i + '">' + TT.esc(L.remove) + '</button></li>';
    }).join('');
  }
  el.compList.addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]');
    if (!b) return;
    state.others.splice(+b.dataset.rm, 1);
    save(); renderComp(); render();
  });

  // ----- view controls
  document.querySelectorAll('[data-layout]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.layout = b.dataset.layout;
      document.querySelectorAll('[data-layout]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      render();
    });
  });
  document.querySelectorAll('[data-theme-btn]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.theme = b.dataset.themeBtn;
      document.querySelectorAll('[data-theme-btn]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      render();
    });
  });
  document.getElementById('pv-shuffle').addEventListener('click', function () {
    var slots = Math.max(1, Math.min(6, state.others.length + 1));
    var p = state.pos;
    while (slots > 1 && p === state.pos) p = Math.floor(Math.random() * slots);
    state.pos = p;
    render();
  });

  // ----- rendering
  function avatar(name, mine) {
    var letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
    var hue = 0;
    for (var i = 0; i < (name || '').length; i++) hue = (hue * 31 + name.charCodeAt(i)) % 360;
    return '<div class="yt-avatar" style="display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;background:' +
      (mine ? '#d32f2f' : 'hsl(' + hue + ',45%,45%)') + '">' + TT.esc(letter) + '</div>';
  }

  function card(item, compact) {
    var thumb = item.placeholder
      ? '<div class="yt-thumb"></div>'
      : '<div class="yt-thumb"><img src="' + TT.esc(item.img) + '" alt="" loading="lazy"><span class="yt-dur">' + TT.esc(item.dur || '') + '</span></div>';
    var title = item.placeholder
      ? '<span class="yt-ph" style="width:92%"></span><span class="yt-ph" style="width:70%"></span>'
      : '<p class="yt-title">' + TT.esc(item.title || L.untitledMine) + '</p>';
    var sub = item.placeholder ? '<span class="yt-ph" style="width:40%;height:10px;margin-top:8px"></span>'
      : '<p class="yt-sub">' + TT.esc(item.channel || L.yourChannel) + (item.meta ? '<br>' + TT.esc(item.meta) : '') + '</p>';
    var av = compact ? '' : item.placeholder ? '<div class="yt-avatar yt-ph-avatar"></div>' : avatar(item.channel, item.mine);
    var info = '<div class="yt-info">' + av + '<div style="min-width:0;flex:1">' + title + sub + '</div></div>';
    return '<div class="yt-card' + (item.mine ? ' mine' : '') + '">' + thumb + info + '</div>';
  }

  function feed(img) {
    var mine = {
      mine: true,
      img: img || 'data:image/svg+xml;utf8,' + encodeURIComponent(L.emptySvg),
      title: state.title,
      channel: state.channel || L.yourChannel,
      dur: state.dur,
      meta: L.mineMeta
    };
    var others = state.others.map(function (o, i) {
      return { img: TT.thumbUrl(o.id, 'mqdefault'), title: o.title, channel: o.channel, dur: ['8:21', '14:02', '10:47', '22:15', '6:58'][i % 5], meta: '' };
    });
    var total = { home: 6, mobile: 3, side: 6, search: 4 }[state.layout];
    while (others.length < total - 1) others.push({ placeholder: true });
    others = others.slice(0, total - 1);
    var pos = Math.min(state.pos, others.length);
    var items = others.slice(0, pos).concat([mine], others.slice(pos));

    var cls = { home: 'yt-grid', mobile: 'yt-mobile', side: 'yt-side', search: 'yt-side yt-search' }[state.layout];
    return '<div class="' + cls + '">' + items.map(function (it) { return card(it, state.layout === 'side'); }).join('') + '</div>';
  }

  function render() {
    stage.className = 'yt-stage ' + state.theme;
    var v = state.variants;
    if (state.showAll && v.length > 1) {
      stage.innerHTML = v.map(function (x, i) {
        return '<p class="yt-variant-label">' + TT.esc(L.variant) + ' ' + 'ABC'.charAt(i) + '</p>' + feed(x.img);
      }).join('');
    } else {
      stage.innerHTML = feed(v[state.active] ? v[state.active].img : null);
    }
  }

  renderComp();
  renderVariantBar();
  render();
  var pre = new URLSearchParams(location.search).get('v');
  if (pre && TT.videoId(pre)) { el.mineUrl.value = 'https://www.youtube.com/watch?v=' + pre; loadMine(TT.videoId(pre)); }
})();
