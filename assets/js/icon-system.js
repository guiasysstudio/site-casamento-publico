(() => {
  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();

  const buttonRules = [
    [/^inicio$/, "home"],
    [/^confirmar presenca$/, "presence"],
    [/^ver lista de presentes$/, "gift"],
    [/^lista de presentes$/, "gift"],
    [/^nova confirmacao$/, "add"],
    [/^consultar confirmacao$/, "search"],
    [/^adicionar filho$/, "add"],
    [/^remover$/, "remove"],
    [/^cancelar edicao$/, "cancel"],
    [/^alterar confirmacao$/, "edit"],
    [/^cancelar presenca$/, "cancel"],
    [/^confirmar novamente$/, "check"],
    [/^consultar minhas reservas$/, "reservations"],
    [/^consultar reservas$/, "search"],
    [/^ver minhas reservas$/, "reservations"],
    [/^consultar meus pix$/, "pix"],
    [/^consultar pix$/, "search"],
    [/^presentear por pix$/, "pix"],
    [/^gerar qr code e pix copia e cola$/, "qrcode"],
    [/^copiar codigo pix$/, "copy"],
    [/^ja fiz o pix$/, "check"],
    [/^reservar por 24 horas$/, "clock"],
    [/^reservar e comprar$/, "gift"],
    [/^abrir produto na loja$/, "store"],
    [/^ja comprei o produto$/, "bought"],
    [/^cancelar reserva$/, "cancel"],
    [/^(salvando|carregando|processando|consultando|gerando|registrando)/, "loading-sequence"]
  ];

  const idIcons = {
    addChildButton: "add",
    submitConfirmation: "check",
    cancelEditButton: "cancel",
    myReservationsButton: "reservations",
    myPixButton: "pix",
    reservationSubmitButton: "clock",
    generatePixButton: "qrcode",
    copyPixButton: "copy",
    pixSubmitButton: "check",
    searchMyReservationsButton: "search",
    searchMyPixButton: "search",
    viewReservationAfterSave: "reservations"
  };

  function icon(name, extraClass = "") {
    const span = document.createElement("span");
    const loadingClass =
      name === "loading-sequence"
        ? " icon-loading-1 loading-icon-sequence"
        : "";

    span.className =
      `ui-icon icon-${name}${loadingClass}${extraClass ? ` ${extraClass}` : ""}`;
    span.setAttribute("aria-hidden", "true");
    span.dataset.generatedIcon = "true";
    return span;
  }

  function leadingIcon(element, name) {
    if (!element || !name) return;

    const current = element.querySelector(":scope > .ui-icon");

    if (
      current?.classList.contains(`icon-${name}`) ||
      (
        name === "loading-sequence" &&
        current?.classList.contains("loading-icon-sequence")
      )
    ) {
      return;
    }

    current?.remove();
    element.prepend(icon(name));
  }

  function iconNameForText(text) {
    const normalized = normalize(text);

    for (const [pattern, name] of buttonRules) {
      if (pattern.test(normalized)) return name;
    }

    return "";
  }

  function scanFixed(root) {
    root.querySelectorAll?.("[data-menu-toggle], .menu-toggle")
      .forEach(button => {
        const current = button.querySelector(":scope > .icon-menu");

        if (current && button.children.length === 1) return;
        button.replaceChildren(icon("menu"));
      });

    root.querySelectorAll?.(".modal-close")
      .forEach(button => {
        const current = button.querySelector(":scope > .icon-close");

        if (current && button.children.length === 1) return;
        button.replaceChildren(icon("close"));
      });

    root.querySelectorAll?.(".site-nav a")
      .forEach(link => {
        const href = link.getAttribute("href") || "";
        const name = href.includes("confirmar-presenca")
          ? "presence"
          : href.includes("lista-presentes")
            ? "gift"
            : "home";

        leadingIcon(link, name);
      });
  }

  function scanButtons(root) {
    root.querySelectorAll?.("button, a.btn")
      .forEach(element => {
        if (element.matches(".menu-toggle, .modal-close")) return;

        const name =
          element.dataset.icon ||
          idIcons[element.id] ||
          (
            element.hasAttribute("data-bought")
              ? "bought"
              : element.hasAttribute("data-cancel")
                ? "cancel"
                : element.hasAttribute("data-reserve")
                  ? "gift"
                  : element.hasAttribute("data-pix")
                    ? "pix"
                    : element.hasAttribute("data-edit")
                      ? "edit"
                      : element.hasAttribute("data-restore")
                        ? "check"
                        : ""
          ) ||
          iconNameForText(element.textContent);

        if (name) leadingIcon(element, name);
      });
  }

  function scanLoading(root) {
    root.querySelectorAll?.(".loading")
      .forEach(element => {
        if (!element.querySelector(".loading-icon-sequence")) {
          element.prepend(icon("loading-sequence", "loading-icon-sequence"));
        }
      });
  }

  function scanGiftVisuals(root) {
    root.querySelectorAll?.(".gift-placeholder, .broken-image-placeholder")
      .forEach(holder => {
        if (!holder.querySelector(".ui-icon")) {
          holder.replaceChildren(icon("gift"));
        }
      });

    root.querySelectorAll?.(".money-icon")
      .forEach(holder => {
        if (!holder.querySelector(".ui-icon")) {
          holder.replaceChildren(icon("money"));
        }
      });
  }

  function scanBadges(root) {
    root.querySelectorAll?.(".badge, .pix-lookup-status")
      .forEach(badge => {
        if (badge.querySelector(":scope > .ui-icon")) return;

        const text = normalize(badge.textContent);
        const name =
          badge.classList.contains("available") ||
          badge.classList.contains("confirmed") ||
          text.includes("disponivel") ||
          text.includes("confirmado")
            ? "check"
            : badge.classList.contains("reserved") ||
              badge.classList.contains("pending") ||
              text.includes("reservado") ||
              text.includes("aguardando")
              ? "clock"
              : badge.classList.contains("partial") ||
                text.includes("pix parcial")
                ? "pix"
                : badge.classList.contains("rejected") ||
                  text.includes("recusado")
                  ? "error"
                  : "";

        if (name) badge.prepend(icon(name));
      });
  }

  function scanSummary(root) {
    root.querySelectorAll?.(".summary-box .summary-item")
      .forEach((item, index) => {
        if (item.querySelector(":scope > .summary-icon")) return;

        const name = index === 0
          ? "user"
          : index === 1
            ? "child"
            : "family";

        item.prepend(icon(name, "summary-icon"));
      });
  }

  let scheduled = false;

  function scan(root = document) {
    scanFixed(root);
    scanButtons(root);
    scanLoading(root);
    scanGiftVisuals(root);
    scanBadges(root);
    scanSummary(root);
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      scan(document);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    scan(document);

    new MutationObserver(scheduleScan).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  });
})();
