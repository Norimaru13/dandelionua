document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-img]').forEach(function (el) {
    var src = window.DANDELION_IMG && window.DANDELION_IMG[el.getAttribute('data-img')];
    if (src) el.src = src;
  });
  var logo = window.DANDELION_IMG && window.DANDELION_IMG.logo;
  var icon = document.querySelector('link[rel="icon"]');
  if (logo && icon) icon.href = logo;
});
