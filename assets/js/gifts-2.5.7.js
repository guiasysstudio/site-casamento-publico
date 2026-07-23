(function () {
  "use strict";

  function viewportWidth() {
    var values = [
      window.innerWidth,
      document.documentElement.clientWidth,
      window.visualViewport && window.visualViewport.width
    ].filter(function (value) {
      return Number.isFinite(value) && value > 0;
    });

    return values.length ? Math.min.apply(Math, values) : 1280;
  }

  function phoneDevice() {
    var userAgentPhone =
      Boolean(navigator.userAgentData && navigator.userAgentData.mobile) ||
      /Android|iPhone|iPod|Mobile|Windows Phone/i.test(
        navigator.userAgent || ""
      );

    var physicalWidth = Number(window.screen && window.screen.width) || 9999;
    var physicalHeight = Number(window.screen && window.screen.height) || 9999;
    var shortSide = Math.min(physicalWidth, physicalHeight);

    return userAgentPhone || shortSide <= 600;
  }

  function applyGiftLayout() {
    var width = viewportWidth();
    var layout = "desktop";
    var columns = 4;

    if (phoneDevice() || width <= 700) {
      layout = width <= 335 ? "narrow" : "phone";
      columns = width <= 335 ? 1 : 2;
    } else if (width <= 1050) {
      layout = "tablet";
      columns = 3;
    } else if (width >= 1500) {
      layout = "wide";
      columns = 5;
    }

    document.documentElement.setAttribute("data-gifts-layout", layout);

    var grid = document.getElementById("giftGrid");
    if (grid) {
      grid.style.setProperty(
        "grid-template-columns",
        "repeat(" + columns + ", minmax(0, 1fr))",
        "important"
      );
      grid.style.setProperty("width", "100%", "important");
      grid.style.setProperty("max-width", "100%", "important");
    }
  }

  function start() {
    applyGiftLayout();

    var grid = document.getElementById("giftGrid");
    if (grid) {
      new MutationObserver(applyGiftLayout).observe(grid, {
        childList: true
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.addEventListener("resize", applyGiftLayout);
  window.addEventListener("orientationchange", applyGiftLayout);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", applyGiftLayout);
  }

  console.info("[Site Casamento] Build 2.5.7 carregado.");
})();
