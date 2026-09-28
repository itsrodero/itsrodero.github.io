/* Channel banner checker: size checks plus safe-area overlays for TV, desktop, tablet and mobile. */
(function () {
  'use strict';
  var TT = window.TT;
  var L = TT.i18n();
  var drop = document.getElementById('bn-drop');
  if (!drop) return;
  var file = document.getElementById('bn-file');
  var canvas = document.getElementById('bn-canvas');
  var ctx = canvas.getContext('2d');
  var img = null;
  var show = { desktop: true, tablet: true, mobile: true };

  // Visible areas as a share of a 16:9 banner (based on 2560×1440 artwork).
  var ZONES = [
    { key: 'desktop', w: 1, h: 423 / 1440, color: '#3b82f6' },
    { key: 'tablet', w: 1855 / 2560, h: 423 / 1440, color: '#f59e0b' },
    { key: 'mobile', w: 1546 / 2560, h: 423 / 1440, color: '#22c55e' }
  ];

  drop.addEventListener('click', function () { file.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('drag'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('drag'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });
  file.addEventListener('change', function () { if (file.files[0]) load(file.files[0]); });
  document.querySelectorAll('[data-zone]').forEach(function (cb) {
    cb.addEventListener('change', function () { show[cb.dataset.zone] = cb.checked; draw(); });
  });
  document.getElementById('bn-template').addEventListener('click', downloadTemplate);

  function load(f) {
    var err = document.getElementById('bn-error');
    if (!/^image\//.test(f.type)) { err.textContent = L.notImage; err.hidden = false; return; }
    err.hidden = true;
    var url = URL.createObjectURL(f);
    var im = new Image();
    im.onload = function () { img = im; checks(f, im); draw(); crops(); document.getElementById('bn-results').hidden = false; };
    im.src = url;
  }

  function zoneRect(z, W, H) {
    var w = W * z.w, h = H * z.h;
    return { x: (W - w) / 2, y: (H - h) / 2, w: w, h: h };
  }

  function drawZones(c, W, H, lineW, font, labels) {
    ZONES.forEach(function (z) {
      if (labels && !show[z.key]) return;
      var r = zoneRect(z, W, H);
      c.strokeStyle = z.color; c.lineWidth = lineW; c.setLineDash([lineW * 4, lineW * 3]);
      c.strokeRect(r.x, r.y, r.w, r.h);
      c.setLineDash([]);
      c.fillStyle = z.color; c.font = '700 ' + font + 'px system-ui, sans-serif';
      c.fillText(L[z.key], r.x + lineW * 3, r.y - lineW * 3);
    });
  }

  function draw() {
    if (!img) return;
    var W = canvas.width = 1280, H = canvas.height = 720;
    ctx.drawImage(img, 0, 0, W, H);
    // Dim everything outside the desktop band (only visible on TVs).
    var d = zoneRect(ZONES[0], W, H);
    ctx.fillStyle = 'rgba(15,23,42,.45)';
    ctx.fillRect(0, 0, W, d.y); ctx.fillRect(0, d.y + d.h, W, H - d.y - d.h);
    drawZones(ctx, W, H, 3, 18, true);
  }

  function crops() {
    var wrap = document.getElementById('bn-crops');
    wrap.innerHTML = '';
    ZONES.slice().reverse().forEach(function (z) {
      var W = img.naturalWidth, H = img.naturalHeight;
      var r = zoneRect(z, W, H);
      var c = document.createElement('canvas');
      var outW = z.key === 'mobile' ? 360 : z.key === 'tablet' ? 520 : 760;
      c.width = outW; c.height = Math.round(outW * r.h / r.w);
      c.getContext('2d').drawImage(img, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
      c.style.width = '100%'; c.style.maxWidth = outW + 'px'; c.style.borderRadius = '8px';
      var fig = document.createElement('figure');
      fig.appendChild(c);
      var cap = document.createElement('figcaption'); cap.textContent = L[z.key + 'Cap'];
      fig.appendChild(cap);
      wrap.appendChild(fig);
    });
  }

  function checks(f, im) {
    var W = im.naturalWidth, H = im.naturalHeight, mb = f.size / 1048576;
    var list = [];
    var ratioOk = Math.abs(W / H - 16 / 9) < 0.02;
    list.push([W >= 2048 && H >= 1152 ? 'ok' : 'bad', L.cSize.replace('{w}', W).replace('{h}', H), W >= 2048 && H >= 1152 ? (W >= 2560 ? L.sizeGreat : L.sizeOk) : L.sizeBad]);
    list.push([ratioOk ? 'ok' : 'bad', L.cRatio, ratioOk ? L.ratioOk : L.ratioBad]);
    list.push([mb <= 6 ? 'ok' : 'bad', L.cFile.replace('{mb}', mb.toFixed(2)), mb <= 6 ? L.fileOk : L.fileBad]);
    var badge = { ok: ['badge-ok', L.bOk], bad: ['badge-bad', L.bBad] };
    document.getElementById('bn-checks').innerHTML = list.map(function (c) {
      return '<li><span class="badge ' + badge[c[0]][0] + '">' + TT.esc(badge[c[0]][1]) + '</span> <strong>' + TT.esc(c[1]) + '</strong> — ' + TT.esc(c[2]) + '</li>';
    }).join('');
  }

  function downloadTemplate() {
    var c = document.createElement('canvas');
    c.width = 2560; c.height = 1440;
    var x = c.getContext('2d');
    x.fillStyle = '#e2e8f0'; x.fillRect(0, 0, 2560, 1440);
    var d = zoneRect(ZONES[0], 2560, 1440);
    x.fillStyle = '#f8fafc'; x.fillRect(d.x, d.y, d.w, d.h);
    drawZones(x, 2560, 1440, 6, 44, false);
    x.fillStyle = '#64748b'; x.font = '600 40px system-ui, sans-serif';
    x.fillText(L.tplNote, 60, 90);
    c.toBlob(function (b) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = 'youtube-banner-template-2560x1440.png';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }, 'image/png');
  }
})();
