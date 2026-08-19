(function () {
  function hexToUrl(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  }

  function loadImage(name, count) {
    var jobs = [];
    var i;
    for (i = 0; i < count; i++) {
      var n = i < 10 ? "0" + i : String(i);
      jobs.push(
        fetch("assets/embed/hex/" + name + "_" + n + ".txt").then(function (res) {
          return res.text();
        })
      );
    }
    return Promise.all(jobs).then(function (parts) {
      var hex = parts
        .map(function (part) {
          return part.replace(/^H\n/, "").replace(/\s+/g, "");
        })
        .join("");
      return hexToUrl(hex);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var map = window.DANDELION_IMG_CHUNKS || {};
    Object.keys(map).forEach(function (name) {
      loadImage(name, map[name])
        .then(function (url) {
          document.querySelectorAll('[data-img="' + name + '"]').forEach(function (el) {
            el.src = url;
          });
          if (name === "logo") {
            var icon = document.querySelector('link[rel="icon"]');
            if (icon) icon.href = url;
          }
        })
        .catch(function () {});
    });
  });
})();
