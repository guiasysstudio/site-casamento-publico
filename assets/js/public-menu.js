(() => {
  const button = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-site-nav]");
  if (!button || !nav) return;

  const close = () => {
    nav.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Abrir menu");
  };

  const open = () => {
    nav.classList.add("is-open");
    document.body.classList.add("menu-open");
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "Fechar menu");
  };

  button.addEventListener("click", event => {
    event.stopPropagation();
    nav.classList.contains("is-open") ? close() : open();
  });

  nav.querySelectorAll("a").forEach(link => link.addEventListener("click", close));

  document.addEventListener("click", event => {
    if (nav.classList.contains("is-open") && !nav.contains(event.target) && !button.contains(event.target)) {
      close();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") close();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1100) close();
  });
})();
