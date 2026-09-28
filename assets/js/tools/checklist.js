/* Thumbnail checklist: weighted self-review with a live score. Items live in the page HTML. */
(function () {
  'use strict';
  var TT = window.TT;
  var L = TT.i18n();
  var root = document.getElementById('ck-list');
  if (!root) return;
  var KEY = 'tt.checklist.' + TT.lang;
  var boxes = Array.prototype.slice.call(root.querySelectorAll('input[type=checkbox]'));
  var saved = TT.store.get(KEY, {});
  var total = boxes.reduce(function (s, b) { return s + (+b.dataset.weight || 1); }, 0);

  boxes.forEach(function (b) {
    if (saved[b.id]) b.checked = true;
    b.addEventListener('change', update);
  });

  function update() {
    var state = {}, got = 0;
    boxes.forEach(function (b) {
      state[b.id] = b.checked;
      b.closest('.check-item').classList.toggle('done', b.checked);
      if (b.checked) got += (+b.dataset.weight || 1);
    });
    TT.store.set(KEY, state);
    var pct = Math.round(got / total * 100);
    document.getElementById('ck-score').textContent = pct;
    var label = pct >= 80 ? L.ready : pct >= 50 ? L.close : L.work;
    var lab = document.getElementById('ck-label');
    lab.textContent = label;
    lab.className = 'badge ' + (pct >= 80 ? 'badge-ok' : pct >= 50 ? 'badge-warn' : 'badge-bad');
    document.getElementById('ck-bar').style.width = pct + '%';

    var todo = boxes.filter(function (b) { return !b.checked; })
      .sort(function (a, b) { return (+b.dataset.weight || 1) - (+a.dataset.weight || 1); })
      .slice(0, 3);
    document.getElementById('ck-next').innerHTML = todo.length
      ? todo.map(function (b) { return '<li><a href="#' + b.id + '">' + TT.esc(b.closest('.check-item').querySelector('label').textContent) + '</a></li>'; }).join('')
      : '<li>' + TT.esc(L.allDone) + '</li>';
    document.getElementById('ck-count').textContent = boxes.filter(function (b) { return b.checked; }).length + ' / ' + boxes.length;
  }

  document.getElementById('ck-reset').addEventListener('click', function () {
    boxes.forEach(function (b) { b.checked = false; });
    update();
  });
  document.getElementById('ck-print').addEventListener('click', function () { window.print(); });
  update();
})();
