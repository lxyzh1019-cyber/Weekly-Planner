// Mockup helper: ?look=pop|calm picks the look; ?measure=1 writes measured sizes into #measure.
(function () {
  var q = new URLSearchParams(location.search);
  document.documentElement.setAttribute('data-look', q.get('look') === 'calm' ? 'calm' : 'pop');
  if (q.get('measure')) document.documentElement.classList.add('show-measure');
  window.addEventListener('load', function () {
    var run = function () {
      var out = ['width=' + innerWidth];
      document.querySelectorAll('.ph').forEach(function (h, i) {
        out.push((h.getAttribute('data-name') || ('header' + i)) + ' total=' + h.getBoundingClientRect().height);
        h.querySelectorAll('[data-m]').forEach(function (e) {
          var r = e.getBoundingClientRect();
          out.push('  ' + e.getAttribute('data-m') + ' ' + r.width + 'x' + r.height);
        });
        var f = h.querySelector('.ph-title'), cs = getComputedStyle(f), hs = getComputedStyle(h);
        out.push('  title-font=' + cs.fontFamily.slice(0, 30) + ' size=' + cs.fontSize + ' rule=' + hs.borderBottomWidth + ' position=' + hs.position + ' bg=' + hs.backgroundColor);
      });
      document.getElementById('measure').textContent = out.join('\n');
      document.body.setAttribute('data-done', '1');
    };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(run);
  });
})();
