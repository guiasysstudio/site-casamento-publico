import { ensureAnonymousAuth } from "./firebase.js";
import { watchPublicConfig, DEFAULT_CONFIG } from "./config-service.js";


function resolveResponsiveDevice() {
  const viewportValues = [
    window.innerWidth,
    document.documentElement.clientWidth,
    window.visualViewport?.width
  ].filter(value => Number.isFinite(value) && value > 0);

  const viewportWidth = viewportValues.length
    ? Math.min(...viewportValues)
    : 1280;

  const screenShortSide = Math.min(
    Number(window.screen?.width || viewportWidth),
    Number(window.screen?.height || viewportWidth)
  );

  const touchDevice =
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches;

  let device = "desktop";

  if (
    viewportWidth <= 700 ||
    screenShortSide <= 600
  ) {
    device = "mobile";
  } else if (
    viewportWidth <= 1100 ||
    screenShortSide <= 1100 ||
    (touchDevice && viewportWidth <= 1366)
  ) {
    device = "tablet";
  }

  document.documentElement.dataset.device = device;

  if (document.body) {
    document.body.classList.remove(
      "device-mobile",
      "device-tablet",
      "device-desktop"
    );
    document.body.classList.add(`device-${device}`);
  }

  return device;
}

let responsiveFrame;

function scheduleResponsiveDeviceUpdate() {
  window.cancelAnimationFrame(responsiveFrame);
  responsiveFrame = window.requestAnimationFrame(() => {
    const device = resolveResponsiveDevice();

    if (device === "desktop") {
      const nav = document.querySelector("[data-site-nav]");
      const button = document.querySelector("[data-menu-toggle]");

      nav?.classList.remove("open");
      button?.setAttribute("aria-expanded", "false");
    }
  });
}

let currentConfig = DEFAULT_CONFIG;
let countdownTimer;

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", { day:"2-digit", month:"long", year:"numeric" }).format(date);
}
function formatTime(date) {
  return new Intl.DateTimeFormat("pt-BR", { hour:"2-digit", minute:"2-digit" }).format(date);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function applyConfig(config) {
  currentConfig = config;
  document.title = document.body.dataset.page === "home" ? config.pageTitle : document.title.replace(/Mislaine & Emerson/g, config.siteName);
  document.querySelectorAll("[data-site-name]").forEach(el => el.textContent = config.siteName);
  document.querySelectorAll("[data-intro-text]").forEach(el => el.textContent = config.introText);
  document.querySelectorAll("[data-venue-name]").forEach(el => el.textContent = config.venueName);
  document.querySelectorAll("[data-venue-address]").forEach(el => el.textContent = config.venueAddress);
  document.querySelectorAll("[data-wedding-date]").forEach(el => el.textContent = formatDate(config.weddingDate));
  document.querySelectorAll("[data-wedding-date-short]").forEach(el => el.textContent = formatShortDate(config.weddingDate));
  document.querySelectorAll("[data-wedding-time]").forEach(el => el.textContent = formatTime(config.weddingDate));
  document.querySelectorAll("[data-maps-link]").forEach(el => el.href = config.mapsUrl || "#");
  startCountdown(config.weddingDate);
}
function startCountdown(date) {
  const root = document.querySelector("[data-countdown]");
  if (!root) return;
  clearInterval(countdownTimer);
  const update = () => {
    const distance = Math.max(0, date.getTime() - Date.now());
    const values = {
      days: Math.floor(distance / 86400000),
      hours: Math.floor((distance % 86400000) / 3600000),
      minutes: Math.floor((distance % 3600000) / 60000),
      seconds: Math.floor((distance % 60000) / 1000)
    };
    Object.entries(values).forEach(([key,value]) => {
      const node = root.querySelector(`[data-${key}]`);
      if (node) node.textContent = key === "days" ? String(value) : String(value).padStart(2,"0");
    });
  };
  update();
  countdownTimer = setInterval(update, 1000);
}
function setupMenu() {
  const button = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-site-nav]");

  if (!button || !nav) return;

  const closeMenu = () => {
    nav.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Abrir menu");
  };

  button.addEventListener("click", event => {
    event.stopPropagation();

    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute(
      "aria-label",
      open ? "Fechar menu" : "Abrir menu"
    );
  });

  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("click", event => {
    if (
      nav.classList.contains("open") &&
      !nav.contains(event.target) &&
      !button.contains(event.target)
    ) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });
}
function showConnectionError(error) {
  const area = document.querySelector("[data-global-message]");
  if (!area) return;
  area.className = "notice danger";
  area.textContent = error.code === "auth/operation-not-allowed"
    ? "Ative o método de autenticação Anônima no Firebase Authentication."
    : "Não foi possível conectar ao Firebase. Verifique a configuração, as regras e a conexão.";
  area.classList.remove("hidden");
  console.error(error);
}
resolveResponsiveDevice();
setupMenu();

window.addEventListener("resize", scheduleResponsiveDeviceUpdate);
window.addEventListener("orientationchange", scheduleResponsiveDeviceUpdate);
window.visualViewport?.addEventListener(
  "resize",
  scheduleResponsiveDeviceUpdate
);
window.screen?.orientation?.addEventListener?.(
  "change",
  scheduleResponsiveDeviceUpdate
);
ensureAnonymousAuth()
  .then(() => watchPublicConfig(applyConfig, showConnectionError))
  .catch(showConnectionError);
export function getCurrentConfig(){ return currentConfig; }
