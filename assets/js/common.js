import { ensureAnonymousAuth } from "./firebase.js";
import { watchPublicConfig, DEFAULT_CONFIG } from "./config-service.js";

let currentConfig = DEFAULT_CONFIG;
let countdownTimer;

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", { day:"2-digit", month:"long", year:"numeric" }).format(date);
}
function formatTime(date) {
  return new Intl.DateTimeFormat("pt-BR", { hour:"2-digit", minute:"2-digit" }).format(date);
}
function applyConfig(config) {
  currentConfig = config;
  document.title = document.body.dataset.page === "home" ? config.pageTitle : document.title.replace(/Mislaine & Emerson/g, config.siteName);
  document.querySelectorAll("[data-site-name]").forEach(el => el.textContent = config.siteName);
  document.querySelectorAll("[data-intro-text]").forEach(el => el.textContent = config.introText);
  document.querySelectorAll("[data-venue-name]").forEach(el => el.textContent = config.venueName);
  document.querySelectorAll("[data-venue-address]").forEach(el => el.textContent = config.venueAddress);
  document.querySelectorAll("[data-wedding-date]").forEach(el => el.textContent = formatDate(config.weddingDate));
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
  button.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    button.setAttribute("aria-expanded", String(open));
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
setupMenu();
ensureAnonymousAuth()
  .then(() => watchPublicConfig(applyConfig, showConnectionError))
  .catch(showConnectionError);
export function getCurrentConfig(){ return currentConfig; }
