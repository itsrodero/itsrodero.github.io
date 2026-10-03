/* TubeTools — shared behaviour for every page. */
(function () {
  'use strict';

  // Mobile menu
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Tools dropdown (click / keyboard; hover is handled in CSS on desktop)
  document.querySelectorAll('.nav-dd').forEach(function (dd) {
    var btn = dd.querySelector('.nav-dd-btn');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = dd.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function (e) {
    document.querySelectorAll('.nav-dd.open').forEach(function (dd) {
      if (!dd.contains(e.target)) {
        dd.classList.remove('open');
        dd.querySelector('.nav-dd-btn').setAttribute('aria-expanded', 'false');
      }
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.nav-dd.open').forEach(function (dd) { dd.classList.remove('open'); });
    if (nav && nav.classList.contains('open')) { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
  });

  // "Privacy settings" re-opens Google's consent message (AdSense Privacy & messaging).
  window.googlefc = window.googlefc || {};
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
  document.querySelectorAll('.js-privacy-settings').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (typeof window.googlefc.showRevocationMessage === 'function') {
        e.preventDefault();
        window.googlefc.showRevocationMessage();
      }
    });
  });

  // Highlight the current section in the side table of contents.
  var sideLinks = document.querySelectorAll('.toc-side a');
  if (sideLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    sideLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && byId[en.target.id]) {
          sideLinks.forEach(function (a) { a.classList.remove('is-current'); });
          byId[en.target.id].classList.add('is-current');
        }
      });
    }, { rootMargin: '-80px 0px -70% 0px' });
    Object.keys(byId).forEach(function (id) { var h = document.getElementById(id); if (h) io.observe(h); });
  }

  // Suggest the other language version when the browser prefers it (never redirects).
  (function () {
    var pageLang = (document.documentElement.lang || 'en').slice(0, 2);
    var other = pageLang === 'es' ? 'en' : 'es';
    var alt = document.querySelector('link[rel="alternate"][hreflang="' + other + '"]');
    if (!alt) return;
    var prefs = (navigator.languages || [navigator.language || '']).map(function (l) { return String(l).slice(0, 2).toLowerCase(); });
    var first = prefs[0];
    if (first !== other || prefs.indexOf(pageLang) === 0) return;
    try { if (localStorage.getItem('tt.langbar') === 'closed') return; } catch (e) { /* ignore */ }
    var text = other === 'en'
      ? { msg: 'This page is also available in English.', link: 'Read in English', close: 'Close' }
      : { msg: 'Esta página también está disponible en español.', link: 'Leer en español', close: 'Cerrar' };
    var bar = document.createElement('div');
    bar.className = 'lang-bar';
    bar.setAttribute('lang', other);
    bar.innerHTML = '<div class="container"><span>' + text.msg + ' <a href="' + new URL(alt.href).pathname + '" hreflang="' + other + '">' +
      text.link + ' →</a></span><button type="button" aria-label="' + text.close + '">×</button></div>';
    bar.querySelector('button').addEventListener('click', function () {
      bar.remove();
      try { localStorage.setItem('tt.langbar', 'closed'); } catch (e) { /* ignore */ }
    });
    var header = document.querySelector('.site-header');
    if (header) header.insertAdjacentElement('afterend', bar);
  })();

  // Shared helpers for the tools
  var TT = window.TT = {};

  TT.store = {
    get: function (key, fallback) {
      try { var v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    },
    remove: function (key) {
      try { localStorage.removeItem(key); } catch (e) { /* storage unavailable */ }
    }
  };

  // Accepts watch, youtu.be, shorts, live, embed, m./music. URLs or a bare 11-char ID.
  TT.videoId = function (input) {
    var s = (input || '').trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    var url;
    try { url = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { return null; }
    var host = url.hostname.replace(/^www\.|^m\.|^music\./, '');
    var id = null;
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
      id = url.searchParams.get('v');
      if (!id) {
        var m = url.pathname.match(/^\/(?:shorts|live|embed|v)\/([A-Za-z0-9_-]{11})/);
        if (m) id = m[1];
      }
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  };

  TT.thumbUrl = function (id, name) { return 'https://i.ytimg.com/vi/' + id + '/' + name + '.jpg'; };

  // YouTube's official oEmbed endpoint (CORS-enabled): returns title and channel name.
  TT.oembed = function (id) {
    return fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id))
      .then(function (r) { if (!r.ok) throw new Error('oembed ' + r.status); return r.json(); });
  };

  TT.copy = function (text, btn, doneLabel) {
    var done = function () {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = doneLabel || '✓';
      setTimeout(function () { btn.textContent = old; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
    }
  };

  TT.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  TT.i18n = function () {
    var el = document.getElementById('tool-i18n');
    try { return el ? JSON.parse(el.textContent) : {}; } catch (e) { return {}; }
  };

  TT.lang = document.documentElement.lang || 'en';

  // Copy-paste templates in guides: <pre class="template"> gets a Copy button.
  document.querySelectorAll('pre.template').forEach(function (pre) {
    var es = TT.lang === 'es';
    var box = document.createElement('div');
    box.className = 'template-box';
    pre.parentNode.insertBefore(box, pre);
    box.appendChild(pre);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-sm template-copy';
    btn.textContent = es ? 'Copiar plantilla' : 'Copy template';
    btn.addEventListener('click', function () { TT.copy(pre.textContent, btn, es ? 'Copiada ✓' : 'Copied ✓'); });
    box.appendChild(btn);
  });
})();
