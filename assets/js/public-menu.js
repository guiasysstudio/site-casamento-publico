(function () {
  "use strict";

  function initializePublicMenu() {
    if (window.__PUBLIC_MENU_READY__) return;

    const button = document.querySelector("[data-menu-toggle]");
    const nav = document.querySelector("[data-site-nav]");

    if (!button || !nav) return;

    window.__PUBLIC_MENU_READY__ = true;
    document.documentElement.dataset.publicMenuReady = "true";

    nav.id = nav.id || "publicMainMenu";
    button.setAttribute("aria-controls", nav.id);

    let backdrop = document.querySelector("[data-public-menu-backdrop]");

    if (!backdrop) {
      backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = "public-menu-backdrop";
      backdrop.setAttribute("data-public-menu-backdrop", "");
      backdrop.setAttribute("aria-label", "Fechar menu");
      document.body.appendChild(backdrop);
    }

    function setOpen(open) {
      nav.classList.toggle("open", open);
      backdrop.classList.toggle("open", open);
      document.body.classList.toggle("public-menu-open", open);

      button.setAttribute("aria-expanded", String(open));
      button.setAttribute(
        "aria-label",
        open ? "Fechar menu" : "Abrir menu"
      );

      if (open) {
        window.requestAnimationFrame(() => {
          nav.querySelector("a")?.focus({ preventScroll: true });
        });
      }
    }

    function closeMenu() {
      setOpen(false);
    }

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setOpen(!nav.classList.contains("open"));
    });

    backdrop.addEventListener("click", closeMenu);

    nav.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeMenu();
        button.focus({ preventScroll: true });
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 1100) closeMenu();
    });

    window.addEventListener("orientationchange", closeMenu);
    window.visualViewport?.addEventListener("resize", () => {
      if (window.innerWidth > 1100) closeMenu();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializePublicMenu,
      { once: true }
    );
  } else {
    initializePublicMenu();
  }
})();
