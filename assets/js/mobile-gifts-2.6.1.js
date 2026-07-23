(function () {
  "use strict";

  function isPhone() {
    var viewportValues = [
      window.innerWidth,
      document.documentElement.clientWidth,
      window.visualViewport && window.visualViewport.width
    ].filter(function (value) {
      return Number.isFinite(value) && value > 0;
    });

    var viewport = viewportValues.length
      ? Math.min.apply(Math, viewportValues)
      : 1280;

    var mobileUserAgent =
      Boolean(navigator.userAgentData && navigator.userAgentData.mobile) ||
      /Android|iPhone|iPod|Mobile|Windows Phone/i.test(
        navigator.userAgent || ""
      );

    var screenWidth =
      Number(window.screen && window.screen.width) || viewport;
    var screenHeight =
      Number(window.screen && window.screen.height) || viewport;
    var shortSide = Math.min(screenWidth, screenHeight);

    return viewport <= 767 || mobileUserAgent || shortSide <= 600;
  }

  function applyMobileGifts() {
    var mobile = isPhone();

    document.documentElement.classList.toggle(
      "mobile-gifts-261",
      mobile
    );

    var grid = document.getElementById("giftGrid");

    if (grid && mobile) {
      var viewport = Math.min(
        window.innerWidth || 9999,
        document.documentElement.clientWidth || 9999,
        window.visualViewport
          ? window.visualViewport.width
          : 9999
      );

      var columns = viewport <= 329 ? 1 : 2;

      grid.style.setProperty(
        "grid-template-columns",
        columns === 2
          ? "repeat(2, minmax(0, 1fr))"
          : "1fr",
        "important"
      );
    }
  }

  function start() {
    applyMobileGifts();

    var grid = document.getElementById("giftGrid");

    if (grid) {
      new MutationObserver(applyMobileGifts).observe(grid, {
        childList: true
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.addEventListener("resize", applyMobileGifts);
  window.addEventListener("orientationchange", applyMobileGifts);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", applyMobileGifts);
  }
})();
