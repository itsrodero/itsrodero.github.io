/* Thumbnail analyzer: measures an image locally with the Canvas API. Nothing is uploaded. */
(function () {
  'use strict';
  var TT = window.TT;
  var L = TT.i18n();
  var drop = document.getElementById('an-drop');
  if (!drop) return;
  var fileInput = document.getElementById('an-file');
  var urlInput = document.getElementById('an-url');
  var errorBox = document.getElementById('an-error');
  var results = document.getElementById('an-results');

  function fmt(s, vars) {
    return s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] !== undefined ? vars[k] : ''; });
  }
  function showError(msg) { errorBox.textContent = msg; errorBox.hidden = false; }
  function clearError() { errorBox.hidden = true; }

  // ---------- loading ----------
  drop.addEventListener('click', function () { fileInput.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('drag'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('drag'); });
  });
  drop.addEventListener('drop', function (e) {
    var f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFile(f);
  });
  fileInput.addEventListener('change', function () { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
  document.getElementById('an-url-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = TT.videoId(urlInput.value);
    if (!id) { showError(L.invalidUrl); return; }
    loadYouTube(id);
  });
  document.getElementById('an-reset').addEventListener('click', function () {
    results.hidden = true; fileInput.value = ''; urlInput.value = '';
    drop.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  function loadFile(file) {
    clearError();
    if (!/^image\//.test(file.type)) { showError(L.notImage); return; }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      analyze(img, { name: file.name, bytes: file.size, crop: null, source: 'file' });
      URL.revokeObjectURL(url);
    };
    img.onerror = function () { showError(L.notImage); };
    img.src = url;
  }

  function loadYouTube(id) {
    clearError();
    // Try the 16:9 max size first, then the letterboxed 4:3 versions (cropped back to 16:9).
    var tries = [
      { name: 'maxresdefault', crop: null },
      { name: 'sddefault', crop: [0, 60, 640, 360] },
      { name: 'hqdefault', crop: [0, 45, 480, 270] }
    ];
    (function next(i) {
      if (i >= tries.length) { showError(L.loadFailed); return; }
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        if (img.naturalWidth <= 120) { next(i + 1); return; }
        analyze(img, { name: id, bytes: null, crop: tries[i].crop, source: 'youtube', size: tries[i].name });
      };
      img.onerror = function () { next(i + 1); };
      img.src = TT.thumbUrl(id, tries[i].name);
    })(0);
  }

  // ---------- analysis ----------
  function toCanvas(img, crop, w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    if (crop) ctx.drawImage(img, crop[0], crop[1], crop[2], crop[3], 0, 0, w, h);
    else ctx.drawImage(img, 0, 0, w, h);
    return c;
  }

  function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }

  function measure(canvas) {
    var w = canvas.width, h = canvas.height;
    var d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    var n = w * h, lum = new Float32Array(n);
    var sumL = 0, sumL2 = 0, sumRg = 0, sumYb = 0, sumRg2 = 0, sumYb2 = 0;
    for (var i = 0, p = 0; i < n; i++, p += 4) {
      var r = d[p], g = d[p + 1], b = d[p + 2];
      // Perceived lightness (CIE L*, 0-1) from relative luminance.
      var Y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      var Ls = (Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y) / 100;
      lum[i] = Ls; sumL += Ls; sumL2 += Ls * Ls;
      var rg = r - g, yb = 0.5 * (r + g) - b;
      sumRg += rg; sumYb += yb; sumRg2 += rg * rg; sumYb2 += yb * yb;
    }
    var meanL = sumL / n;
    var contrast = Math.sqrt(Math.max(0, sumL2 / n - meanL * meanL));
    var mRg = sumRg / n, mYb = sumYb / n;
    var sRg = Math.sqrt(Math.max(0, sumRg2 / n - mRg * mRg)), sYb = Math.sqrt(Math.max(0, sumYb2 / n - mYb * mYb));
    // Hasler & Süsstrunk (2003) colorfulness metric.
    var colorfulness = Math.sqrt(sRg * sRg + sYb * sYb) + 0.3 * Math.sqrt(mRg * mRg + mYb * mYb);

    // Edge density with a Sobel operator (share of pixels with a strong gradient).
    var edges = 0, edgesBR = 0, pixBR = 0, strong = 0.25;
    var brX = Math.floor(w * 0.78), brY = Math.floor(h * 0.78);
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var k = y * w + x;
        var gx = -lum[k - w - 1] - 2 * lum[k - 1] - lum[k + w - 1] + lum[k - w + 1] + 2 * lum[k + 1] + lum[k + w + 1];
        var gy = -lum[k - w - 1] - 2 * lum[k - w] - lum[k - w + 1] + lum[k + w - 1] + 2 * lum[k + w] + lum[k + w + 1];
        var mag = Math.sqrt(gx * gx + gy * gy);
        var isEdge = mag > strong;
        if (isEdge) edges++;
        if (x >= brX && y >= brY) { pixBR++; if (isEdge) edgesBR++; }
      }
    }
    var edgeDensity = edges / ((w - 2) * (h - 2));
    var cornerDensity = pixBR ? edgesBR / pixBR : 0;

    // Average lightness of the outer border (how the edges sit on light/dark YouTube themes).
    var bw = Math.max(2, Math.round(w * 0.04)), bSum = 0, bN = 0;
    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < w; xx++) {
        if (xx < bw || xx >= w - bw || yy < bw || yy >= h - bw) { bSum += lum[yy * w + xx]; bN++; }
      }
    }
    return { brightness: meanL, contrast: contrast, colorfulness: colorfulness, edgeDensity: edgeDensity,
      cornerDensity: cornerDensity, borderL: bSum / bN, data: d, w: w, h: h };
  }

  function palette(m, k) {
    // k-means on a subsample of pixels.
    var pts = [], d = m.data;
    for (var p = 0; p < d.length; p += 4 * 7) pts.push([d[p], d[p + 1], d[p + 2]]);
    var cents = [];
    for (var i = 0; i < k; i++) cents.push(pts[Math.floor((i + 0.5) * pts.length / k)].slice());
    var assign = new Array(pts.length);
    for (var it = 0; it < 10; it++) {
      var sums = cents.map(function () { return [0, 0, 0, 0]; });
      for (var j = 0; j < pts.length; j++) {
        var best = 0, bd = Infinity;
        for (var c = 0; c < k; c++) {
          var dr = pts[j][0] - cents[c][0], dg = pts[j][1] - cents[c][1], db = pts[j][2] - cents[c][2];
          var dist = dr * dr + dg * dg + db * db;
          if (dist < bd) { bd = dist; best = c; }
        }
        assign[j] = best;
        sums[best][0] += pts[j][0]; sums[best][1] += pts[j][1]; sums[best][2] += pts[j][2]; sums[best][3]++;
      }
      for (var c2 = 0; c2 < k; c2++) if (sums[c2][3]) cents[c2] = [sums[c2][0] / sums[c2][3], sums[c2][1] / sums[c2][3], sums[c2][2] / sums[c2][3]];
    }
    var counts = cents.map(function () { return 0; });
    assign.forEach(function (a) { counts[a]++; });
    return cents.map(function (c, idx) {
      return { rgb: c.map(Math.round), share: counts[idx] / pts.length };
    }).filter(function (c) { return c.share > 0.02; }).sort(function (a, b) { return b.share - a.share; });
  }

  function hex(rgb) { return '#' + rgb.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
  function textOn(rgb) { return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) > 150 ? '#111' : '#fff'; }

  function rate(value, low, high) { return value < low ? 'low' : value > high ? 'high' : 'ok'; }

  function analyze(img, info) {
    var srcW = info.crop ? info.crop[2] : img.naturalWidth;
    var srcH = info.crop ? info.crop[3] : img.naturalHeight;
    var work = toCanvas(img, info.crop, 320, Math.round(320 * srcH / srcW));
    var m = measure(work);
    var pal = palette(m, 5);
    var checks = [];

    // Technical
    var ratio = srcW / srcH;
    var ratioOk = Math.abs(ratio - 16 / 9) < 0.02;
    if (info.source === 'file') {
      checks.push({ status: ratioOk ? 'ok' : 'bad', name: L.cAspect, value: srcW + '×' + srcH, text: ratioOk ? L.aspectOk : L.aspectBad });
      var wideEnough = srcW >= 1280;
      checks.push({ status: srcW < 640 ? 'bad' : wideEnough ? 'ok' : 'warn', name: L.cResolution, value: srcW + ' px',
        text: srcW < 640 ? L.resTooSmall : wideEnough ? L.resOk : L.resSmall });
      if (info.bytes) {
        var mb = info.bytes / 1048576;
        checks.push({ status: mb > 50 ? 'bad' : mb > 2 ? 'warn' : 'ok', name: L.cFileSize, value: mb.toFixed(2) + ' MB',
          text: mb > 50 ? L.sizeTooBig : mb > 2 ? L.sizeMobile : L.sizeOk });
      }
    }

    var b = m.brightness * 100;
    var bRate = rate(b, 25, 80);
    checks.push({ status: bRate === 'ok' ? 'ok' : 'warn', name: L.cBrightness, value: Math.round(b) + '%', bar: b, zone: [25, 80],
      text: bRate === 'low' ? L.brightLow : bRate === 'high' ? L.brightHigh : L.brightOk });

    var c = m.contrast * 100;
    var cStatus = c < 14 ? 'bad' : c < 19 ? 'warn' : 'ok';
    checks.push({ status: cStatus, name: L.cContrast, value: Math.round(c), bar: Math.min(100, c * 2.5), zone: [47.5, 100],
      text: cStatus === 'bad' ? L.contrastLow : cStatus === 'warn' ? L.contrastMid : L.contrastOk });

    var cf = m.colorfulness;
    var cfLabel = cf < 15 ? L.cf1 : cf < 33 ? L.cf2 : cf < 45 ? L.cf3 : cf < 59 ? L.cf4 : cf < 82 ? L.cf5 : L.cf6;
    var cfStatus = cf < 25 ? 'warn' : cf > 100 ? 'warn' : 'ok';
    checks.push({ status: cfStatus, name: L.cColor, value: Math.round(cf) + ' · ' + cfLabel, bar: Math.min(100, cf), zone: [33, 90],
      text: cf < 25 ? L.colorLow : cf > 100 ? L.colorHigh : L.colorOk });

    var e = m.edgeDensity * 100;
    var eStatus = e > 22 ? 'warn' : e < 3 ? 'warn' : 'ok';
    checks.push({ status: eStatus, name: L.cComplexity, value: Math.round(e) + '%', bar: Math.min(100, e * 3), zone: [9, 66],
      text: e > 22 ? L.busy : e < 3 ? L.plain : L.complexityOk });

    var borderDark = m.borderL < 0.12, borderLight = m.borderL > 0.92;
    checks.push({ status: borderDark || borderLight ? 'warn' : 'ok', name: L.cEdges, value: Math.round(m.borderL * 100) + '%',
      text: borderDark ? L.edgesDark : borderLight ? L.edgesLight : L.edgesOk });

    var corner = m.cornerDensity * 100;
    checks.push({ status: corner > Math.max(18, e * 1.6) ? 'warn' : 'ok', name: L.cCorner, value: Math.round(corner) + '%',
      text: corner > Math.max(18, e * 1.6) ? L.cornerBusy : L.cornerOk });

    var mainShare = pal.length ? pal[0].share : 0;
    var majorColors = pal.filter(function (p) { return p.share >= 0.1; }).length;
    checks.push({ status: majorColors > 4 ? 'warn' : 'ok', name: L.cPalette, value: fmt(L.colorsValue, { n: majorColors }),
      text: majorColors > 4 ? L.paletteBusy : fmt(L.paletteOk, { p: Math.round(mainShare * 100) }) });

    render(img, info, work, checks, pal);
  }

  // ---------- rendering ----------
  function drawPreview(src, w, dark, gray) {
    var c = document.createElement('canvas');
    var ratio = window.devicePixelRatio || 1;
    var h = Math.round(w * 9 / 16);
    c.width = Math.round(w * ratio); c.height = Math.round(h * ratio);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    c.style.borderRadius = (w < 200 ? 6 : 10) + 'px';
    var ctx = c.getContext('2d');
    if (gray) ctx.filter = 'grayscale(1)';
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  function render(img, info, work, checks, pal) {
    var full = toCanvas(img, info.crop, 1280, 720);
    var prev = document.getElementById('an-previews');
    prev.innerHTML = '';
    [[168, L.pSidebar], [246, L.pSearch], [360, L.pHome]].forEach(function (s) {
      var fig = document.createElement('figure');
      fig.appendChild(drawPreview(full, s[0]));
      var cap = document.createElement('figcaption'); cap.textContent = s[1] + ' · ' + s[0] + ' px';
      fig.appendChild(cap); prev.appendChild(fig);
    });
    var gfig = document.createElement('figure');
    gfig.appendChild(drawPreview(full, 246, false, true));
    var gcap = document.createElement('figcaption'); gcap.textContent = L.pGray;
    gfig.appendChild(gcap); prev.appendChild(gfig);

    var themes = document.getElementById('an-themes');
    themes.innerHTML = '';
    [['#ffffff', L.pLight], ['#0f0f0f', L.pDark]].forEach(function (t) {
      var box = document.createElement('figure');
      box.style.background = t[0]; box.style.padding = '14px'; box.style.borderRadius = '12px';
      box.style.border = '1px solid ' + (t[0] === '#ffffff' ? '#e2e8f0' : '#272727');
      box.appendChild(drawPreview(full, 246));
      var cap = document.createElement('figcaption'); cap.textContent = t[1];
      cap.style.color = t[0] === '#ffffff' ? '#606060' : '#aaa';
      box.appendChild(cap); themes.appendChild(box);
    });

    var passed = checks.filter(function (c) { return c.status === 'ok'; }).length;
    document.getElementById('an-summary').innerHTML =
      '<p class="metric-value">' + fmt(L.summary, { p: passed, t: checks.length }) + '</p>' +
      '<p class="muted small">' + TT.esc(L.summaryNote) + '</p>';

    var badge = { ok: ['badge-ok', L.bOk], warn: ['badge-warn', L.bWarn], bad: ['badge-bad', L.bBad] };
    document.getElementById('an-metrics').innerHTML = checks.map(function (c) {
      var bar = '';
      if (c.bar !== undefined) {
        bar = '<div class="bar"><span class="zone" style="left:' + c.zone[0] + '%;width:' + (c.zone[1] - c.zone[0]) + '%"></span>' +
          '<i style="width:' + Math.max(2, Math.min(100, c.bar)) + '%"></i></div>';
      }
      return '<div class="metric"><div class="metric-head"><span class="metric-name">' + TT.esc(c.name) + '</span>' +
        '<span class="badge ' + badge[c.status][0] + '">' + TT.esc(badge[c.status][1]) + '</span></div>' +
        '<div class="metric-value">' + TT.esc(c.value) + '</div>' + bar + '<p>' + TT.esc(c.text) + '</p></div>';
    }).join('');

    document.getElementById('an-palette').innerHTML = pal.map(function (p) {
      return '<div style="flex:' + p.share.toFixed(3) + ';background:' + hex(p.rgb) + ';color:' + textOn(p.rgb) + '" title="' + hex(p.rgb) + '">' +
        (p.share > 0.07 ? hex(p.rgb) + ' · ' + Math.round(p.share * 100) + '%' : '') + '</div>';
    }).join('');

    var recs = checks.filter(function (c) { return c.status !== 'ok'; }).map(function (c) { return c.text; });
    document.getElementById('an-recs').innerHTML = recs.length
      ? recs.map(function (r) { return '<li>' + TT.esc(r) + '</li>'; }).join('')
      : '<li>' + TT.esc(L.allGood) + '</li>';

    results.hidden = false;
    setTimeout(function () { results.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  }

  var pre = new URLSearchParams(location.search).get('v');
  if (pre && TT.videoId(pre)) { urlInput.value = 'https://www.youtube.com/watch?v=' + pre; loadYouTube(TT.videoId(pre)); }
})();
