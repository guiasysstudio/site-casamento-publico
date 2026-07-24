import { db, ensureAnonymousAuth } from "./firebase.js";
import { getCurrentConfig } from "./common.js";
import { getPixConfig, getDeliveryConfig } from "./config-service.js";
import {
  buildPixPayload,
  normalizePixConfig,
  validatePixPayload
} from "./pix.js";

import {
  renderQrToCanvas
} from "./qr-local.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  setDoc,
  getDoc,
  getDocs,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const byId = id => document.getElementById(id);

const grid = byId("giftGrid");
const search = byId("giftSearch");
const category = byId("categoryFilter");
const price = byId("priceFilter");

const reservationModal = byId("reservationModal");
const reservationForm = byId("reservationForm");
const reservationGiftId = byId("reservationGiftId");
const reservationTitle = byId("reservationTitle");
const reservationName = byId("reservationName");
const reservationWhatsapp = byId("reservationWhatsapp");
const reservationProfileNotice = byId("reservationProfileNotice");
const deliveryChoice = byId("deliveryChoice");
const deliveryAddressBox = byId("deliveryAddressBox");
const deliveryAddressText = byId("deliveryAddressText");
const reservationMessage = byId("reservationMessage");
const reservationSubmitButton = byId("reservationSubmitButton");

const pixModal = byId("pixModal");
const pixForm = byId("pixForm");
const pixGiftId = byId("pixGiftId");
const pixTitle = byId("pixTitle");
const pixName = byId("pixName");
const pixWhatsapp = byId("pixWhatsapp");
const pixValue = byId("pixValue");
const generatePixButton = byId("generatePixButton");
const pixGenerated = byId("pixGenerated");
const pixQrCanvas = byId("pixQrCanvas");
const pixBeneficiary = byId("pixBeneficiary");
const pixPayload = byId("pixPayload");
const copyPixButton = byId("copyPixButton");
const pixMessage = byId("pixMessage");
const pixGiftSummary = byId("pixGiftSummary");
const pixValueHelp = byId("pixValueHelp");
const pixDestinationLabel = byId("pixDestinationLabel");
const pixSubmitButton = byId("pixSubmitButton");

const myReservationsButton = byId("myReservationsButton");
const myReservationsModal = byId("myReservationsModal");
const myReservationsLookupForm = byId("myReservationsLookupForm");
const myReservationsName = byId("myReservationsName");
const myReservationsWhatsapp = byId("myReservationsWhatsapp");
const searchMyReservationsButton = byId("searchMyReservationsButton");
const myReservationsMessage = byId("myReservationsMessage");
const myReservationsList = byId("myReservationsList");

const myPixButton = byId("myPixButton");
const myPixModal = byId("myPixModal");
const myPixLookupForm = byId("myPixLookupForm");
const myPixName = byId("myPixName");
const myPixWhatsapp = byId("myPixWhatsapp");
const searchMyPixButton = byId("searchMyPixButton");
const myPixMessage = byId("myPixMessage");
const myPixList = byId("myPixList");

const requiredElements = {
  grid,
  reservationModal,
  reservationForm,
  reservationProfileNotice,
  pixModal,
  pixForm,
  myReservationsModal,
  myReservationsLookupForm,
  myPixModal,
  myPixLookupForm
};

const missingElements = Object.entries(requiredElements)
  .filter(([, element]) => !element)
  .map(([name]) => name);

if (missingElements.length) {
  throw new Error(
    `Elementos obrigatórios não encontrados: ${missingElements.join(", ")}`
  );
}

let gifts = [];
let selectedGift = null;
let pixPayloadGenerated = "";
let pixConfig = null;
let pixGeneration = null;
let currentReservationProfile = null;
let reservationProfileCheckSequence = 0;

const digits = value => String(value || "").replace(/\D/g, "");

function maskPhone(value) {
  const phone = digits(value).slice(0, 11);

  if (phone.length <= 2) return phone;
  if (phone.length <= 7) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2)}`;
  }

  return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
}

function isValidWhatsapp(value) {
  return /^[1-9]\d9\d{8}$/.test(digits(value));
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDisplayName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function hasNameAndSurname(value) {
  const words = normalizeName(value).split(" ").filter(Boolean);
  return words.length >= 2 && words.every(word => word.length >= 2);
}

async function sha256(value) {
  const encoded = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);

  return [...new Uint8Array(hashBuffer)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function buildReservationProfile(name, whatsappValue) {
  const displayName = formatDisplayName(name);
  const normalizedName = normalizeName(displayName);
  const whatsapp = digits(whatsappValue);

  if (!hasNameAndSurname(displayName)) {
    throw new Error("Informe seu nome e sobrenome.");
  }

  if (!isValidWhatsapp(whatsapp)) {
    throw new Error(
      "Informe um WhatsApp válido no formato (69) 99999-9999."
    );
  }

  const profileId = await sha256(`${normalizedName}|${whatsapp}`);

  return {
    profileId,
    displayName,
    normalizedName,
    whatsapp
  };
}

const money = value => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
}).format(Number(value || 0));

const escapeHtml = value => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");


function normalizeImageMode(value) {
  return ["original", "fit", "remove-white"].includes(value)
    ? value
    : "fit";
}


function normalizeImageScale(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 85;

  return Math.max(35, Math.min(160, Math.round(number)));
}

function icon(categoryName) {
  return ({
    "Cozinha": "🍽️",
    "Quarto": "🛏️",
    "Sala": "🛋️",
    "Banheiro": "🧴",
    "Lavanderia": "🧺"
  })[categoryName] || "🎁";
}

function timestampMillis(value) {
  return value?.toMillis?.() || value?.toDate?.().getTime?.() || 0;
}

function reservationExpiration(gift) {
  return gift.reservationExpiresAt?.toDate?.() || null;
}

function isReservationActive(gift) {
  const expiration = reservationExpiration(gift);

  return gift.purchaseStatus === "reservado" &&
    expiration &&
    expiration.getTime() > Date.now();
}

function reservationRemaining(gift) {
  const expiration = reservationExpiration(gift);
  if (!expiration) return "";

  const distance = expiration.getTime() - Date.now();
  if (distance <= 0) return "";

  const hours = Math.floor(distance / 3600000);
  const minutes = Math.max(
    0,
    Math.floor((distance % 3600000) / 60000)
  );

  return `${hours}h ${String(minutes).padStart(2, "0")}min`;
}

function statusText(gift) {
  if (isReservationActive(gift)) {
    return [`Reservado • ${reservationRemaining(gift)}`, "reserved"];
  }

  if (gift.pixStatus === "parcial") {
    return ["PIX parcial", "partial"];
  }

  return ["Disponível", "available"];
}

function filtered() {
  const term = search.value.trim().toLocaleLowerCase("pt-BR");
  const selectedCategory = category.value;
  const selectedPrice = price.value;

  return gifts.filter(gift => {
    const value = Number(gift.valorEstimado);

    return (
      (!term ||
        gift.nome.toLocaleLowerCase("pt-BR").includes(term) ||
        (gift.loja || "").toLocaleLowerCase("pt-BR").includes(term)) &&
      (!selectedCategory || gift.categoria === selectedCategory) &&
      (!selectedPrice ||
        (selectedPrice === "0-100" && value <= 100) ||
        (selectedPrice === "100-300" && value > 100 && value <= 300) ||
        (selectedPrice === "300-500" && value > 300 && value <= 500) ||
        (selectedPrice === "500+" && value > 500))
    );
  });
}

function render() {
  const list = filtered();

  const moneyCard = `
    <article class="money-gift-card">
      <div class="money-icon"><span class="ui-icon icon-money" aria-hidden="true"></span></div>
      <div>
        <h2>Presente em Dinheiro</h2>
        <p style="margin:8px 0 0;color:var(--muted)">
          Envie qualquer valor ao casal, sem vínculo com um produto específico.
        </p>
      </div>
      <button class="btn btn-primary" data-pix="presente-dinheiro">
        Presentear por PIX
      </button>
    </article>
  `;

  grid.innerHTML = moneyCard + (
    list.length
      ? list.map(gift => {
          const [label, statusClass] = statusText(gift);
          const reserved = isReservationActive(gift);
          const hasStoreLink = Boolean(
            String(gift.linkCompra || "").trim()
          );
          const percentage = Math.min(
            100,
            (
              Number(gift.pixConfirmedTotal || 0) /
              Number(gift.valorEstimado || 1)
            ) * 100
          );

          let reserveText = "Reservar e comprar";

          if (reserved) reserveText = "Reservado";
          else if (!hasStoreLink) reserveText = "Link indisponível";

          const imageMode = normalizeImageMode(gift.imageMode);
          const imageScale = normalizeImageScale(gift.imageScale);
          const imageFallback =
            gift.imageProcessingStatus === "cors-fallback"
              ? " image-cors-fallback"
              : "";

          return `
            <article class="gift-card">
              <div class="gift-media image-mode-${imageMode}${imageFallback}">
                ${
                  gift.imagemUrl
                    ? `
                      <img
                        src="${escapeHtml(gift.imagemUrl)}"
                        alt="${escapeHtml(gift.nome)}"
                        loading="lazy"
                        decoding="async"
                        referrerpolicy="no-referrer"
                        data-product-image
                        data-fallback-icon="${escapeHtml(icon(gift.categoria))}"
                        style="--gift-image-scale:${imageScale / 100}"
                      >
                    `
                    : `
                      <div class="gift-placeholder"><span class="ui-icon icon-gift" aria-hidden="true"></span></div>
                    `
                }
              </div>

              <div class="gift-body">
                <div class="gift-meta">
                  <span class="badge">
                    ${escapeHtml(gift.categoria)}
                  </span>
                  <span class="badge ${statusClass}">
                    ${escapeHtml(label)}
                  </span>
                </div>

                <h2>${escapeHtml(gift.nome)}</h2>
                <p class="gift-price">
                  ${money(gift.valorEstimado)}
                </p>
                <p class="gift-store">
                  Valor estimado •
                  ${escapeHtml(gift.loja || "Loja externa")}
                </p>

                ${
                  gift.pixStatus === "parcial"
                    ? `
                      <small>
                        ${money(gift.pixConfirmedTotal)}
                        arrecadados por PIX
                      </small>
                      <div class="progress">
                        <span style="width:${percentage}%"></span>
                      </div>
                    `
                    : ""
                }

                <div class="gift-actions">
                  <button
                    class="btn btn-primary"
                    data-reserve="${gift.id}"
                    ${reserved || !hasStoreLink ? "disabled" : ""}
                  >
                    ${reserveText}
                  </button>

                  <button
                    class="btn btn-secondary"
                    data-pix="${gift.id}"
                    ${reserved ? "disabled" : ""}
                  >
                    Presentear por PIX
                  </button>
                </div>
              </div>
            </article>
          `;
        }).join("")
      : `
        <div class="empty-state card">
          Nenhum presente encontrado.
        </div>
      `
  );

  grid.querySelectorAll("[data-product-image]").forEach(image => {
    image.addEventListener("error", () => {
      const media = image.closest(".gift-media");

      if (!media || media.querySelector(".broken-image-placeholder")) {
        return;
      }

      image.remove();

      const placeholder = document.createElement("div");
      placeholder.className = "broken-image-placeholder";
      placeholder.innerHTML =
        '<span class="ui-icon icon-gift" aria-hidden="true"></span>';
      placeholder.title = "Não foi possível carregar a imagem";

      media.appendChild(placeholder);
    });
  });

  grid.querySelectorAll("[data-reserve]").forEach(button => {
    button.addEventListener("click", () => {
      openReservation(button.dataset.reserve);
    });
  });

  grid.querySelectorAll("[data-pix]").forEach(button => {
    button.addEventListener("click", () => {
      openPix(button.dataset.pix);
    });
  });
}

function openModal(dialogOrId) {
  const dialog = typeof dialogOrId === "string"
    ? byId(dialogOrId)
    : dialogOrId;

  if (!(dialog instanceof HTMLDialogElement)) {
    throw new Error("A janela solicitada não foi encontrada.");
  }

  document.querySelectorAll("dialog.site-dialog[open]")
    .forEach(openDialog => {
      if (openDialog !== dialog) openDialog.close();
    });

  if (!dialog.open) dialog.showModal();

  document.body.classList.add("modal-open");

  window.requestAnimationFrame(() => {
    dialog.querySelector(
      "input:not([type='hidden']), select, textarea, button"
    )?.focus();
  });
}

function closeDialog(dialog) {
  if (dialog instanceof HTMLDialogElement && dialog.open) {
    dialog.close();
  }

  if (!document.querySelector("dialog.site-dialog[open]")) {
    document.body.classList.remove("modal-open");
  }
}

function closeModals() {
  document.querySelectorAll("dialog.site-dialog[open]")
    .forEach(dialog => dialog.close());

  document.body.classList.remove("modal-open");
}

document.querySelectorAll("[data-close-modal]").forEach(button => {
  button.addEventListener("click", event => {
    closeDialog(event.currentTarget.closest("dialog"));
  });
});

document.querySelectorAll("dialog.site-dialog").forEach(dialog => {
  dialog.addEventListener("click", event => {
    if (event.target === dialog) closeDialog(dialog);
  });

  dialog.addEventListener("close", () => {
    if (!document.querySelector("dialog.site-dialog[open]")) {
      document.body.classList.remove("modal-open");
    }
  });

  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    closeDialog(dialog);
  });
});

function hideProfileNotice() {
  reservationProfileNotice.className = "field full notice hidden";
  reservationProfileNotice.textContent = "";
  currentReservationProfile = null;
}

async function checkExistingReservationProfile() {
  const sequence = ++reservationProfileCheckSequence;
  hideProfileNotice();

  if (
    !hasNameAndSurname(reservationName.value) ||
    !isValidWhatsapp(reservationWhatsapp.value)
  ) {
    return null;
  }

  try {
    const profile = await buildReservationProfile(
      reservationName.value,
      reservationWhatsapp.value
    );

    const profileSnapshot = await getDoc(
      doc(db, "perfisReservas", profile.profileId)
    );

    if (sequence !== reservationProfileCheckSequence) {
      return null;
    }

    if (!profileSnapshot.exists()) {
      currentReservationProfile = {
        ...profile,
        exists: false
      };
      return currentReservationProfile;
    }

    const savedProfile = profileSnapshot.data();

    currentReservationProfile = {
      ...profile,
      exists: true,
      canonicalName: savedProfile.displayName || profile.displayName
    };

    reservationProfileNotice.className =
      "field full notice info";

    reservationProfileNotice.innerHTML = `
      Encontramos outras reservas vinculadas a
      <strong>${escapeHtml(currentReservationProfile.canonicalName)}</strong>
      e este WhatsApp. Esta nova reserva será adicionada ao mesmo cadastro.
    `;

    return currentReservationProfile;
  } catch (error) {
    console.error("Erro ao consultar perfil de reserva:", error);
    return null;
  }
}

async function openReservation(id) {
  try {
    selectedGift = gifts.find(gift => gift.id === id);

    if (!selectedGift) {
      throw new Error("O presente selecionado não foi encontrado.");
    }

    if (!String(selectedGift.linkCompra || "").trim()) {
      throw new Error(
        "O link de compra deste presente ainda não foi cadastrado."
      );
    }

    reservationForm.reset();
    reservationGiftId.value = id;
    reservationTitle.textContent = selectedGift.nome;
    reservationMessage.classList.add("hidden");
    reservationMessage.textContent = "";
    reservationSubmitButton.disabled = false;
    reservationSubmitButton.textContent =
      `Reservar por ${getCurrentConfig().reservationHours || 24} horas`;

    hideProfileNotice();

    const savedLookup = JSON.parse(
      localStorage.getItem("casamento.reserva.ultimoAcesso") || "null"
    );

    if (savedLookup?.name && savedLookup?.whatsapp) {
      reservationName.value = savedLookup.name;
      reservationWhatsapp.value = maskPhone(savedLookup.whatsapp);
      checkExistingReservationProfile();
    }

    deliveryAddressBox.classList.remove("hidden");
    deliveryAddressText.textContent =
      "Carregando endereço de entrega...";

    openModal(reservationModal);

    try {
      const delivery = await Promise.race([
        getDeliveryConfig(),
        new Promise((_, reject) => {
          window.setTimeout(
            () => reject(
              new Error("Tempo limite ao carregar o endereço.")
            ),
            6000
          );
        })
      ]);

      deliveryAddressText.textContent = delivery?.active
        ? `${delivery.street || ""}, ${delivery.number || ""}` +
          `${delivery.complement ? ` - ${delivery.complement}` : ""}` +
          ` - ${delivery.neighborhood || ""}, ${delivery.city || ""}` +
          ` - ${delivery.state || ""}, ${delivery.zipCode || ""}` +
          `${delivery.recipient ? `. Destinatário: ${delivery.recipient}` : ""}` +
          `${delivery.phone ? `. Telefone: ${delivery.phone}` : ""}`
        : "O endereço de entrega ainda não foi ativado no painel administrativo.";
    } catch (error) {
      console.error("Erro ao carregar endereço:", error);

      deliveryAddressText.textContent =
        "Não foi possível carregar o endereço agora. Você ainda pode escolher receber no seu endereço e entregar pessoalmente.";
    }
  } catch (error) {
    console.error("Erro ao abrir reserva:", error);
    alert(error.message || "Não foi possível abrir a reserva.");
    closeModals();
  }
}

deliveryChoice.addEventListener("change", () => {
  deliveryAddressBox.classList.toggle(
    "hidden",
    deliveryChoice.value !== "casal"
  );
});

[
  reservationWhatsapp,
  pixWhatsapp,
  myReservationsWhatsapp,
  myPixWhatsapp
].forEach(input => {
  input.addEventListener("input", () => {
    input.value = maskPhone(input.value);
  });
});

reservationName.addEventListener(
  "blur",
  checkExistingReservationProfile
);

reservationWhatsapp.addEventListener(
  "blur",
  checkExistingReservationProfile
);

reservationForm.addEventListener("submit", async event => {
  event.preventDefault();

  const message = reservationMessage;
  message.classList.add("hidden");
  reservationSubmitButton.disabled = true;
  reservationSubmitButton.textContent = "Reservando...";

  try {
    const enteredProfile = await buildReservationProfile(
      reservationName.value,
      reservationWhatsapp.value
    );

    const user = await ensureAnonymousAuth();
    const giftRef = doc(
      db,
      "presentes",
      reservationGiftId.value
    );
    const reservationRef = doc(collection(db, "reservas"));
    const profileRef = doc(
      db,
      "perfisReservas",
      enteredProfile.profileId
    );
    const profileReservationRef = doc(
      db,
      "perfisReservas",
      enteredProfile.profileId,
      "reservas",
      reservationRef.id
    );

    const configuration = getCurrentConfig();
    const expiresAt = Timestamp.fromDate(
      new Date(
        Date.now() +
        (configuration.reservationHours || 24) * 3600000
      )
    );

    let profileAlreadyExisted = false;
    let canonicalName = enteredProfile.displayName;

    await runTransaction(db, async transaction => {
      const giftSnapshot = await transaction.get(giftRef);
      const profileSnapshot = await transaction.get(profileRef);

      if (!giftSnapshot.exists()) {
        throw new Error("Presente não encontrado.");
      }

      const gift = giftSnapshot.data();
      const currentReservationActive =
        gift.purchaseStatus === "reservado" &&
        gift.reservationExpiresAt?.toMillis?.() > Date.now();

      if (
        !gift.ativo ||
        !gift.visivelPublico ||
        gift.purchaseStatus === "comprado" ||
        gift.pixStatus === "concluido"
      ) {
        throw new Error("Este presente não está mais disponível.");
      }

      if (!String(gift.linkCompra || "").trim()) {
        throw new Error("O link da loja ainda não foi cadastrado.");
      }

      if (currentReservationActive) {
        throw new Error(
          "Este presente acabou de ser reservado por outra pessoa."
        );
      }

      const now = serverTimestamp();
      const existingProfile = profileSnapshot.exists()
        ? profileSnapshot.data()
        : null;

      profileAlreadyExisted = Boolean(existingProfile);
      canonicalName =
        existingProfile?.displayName ||
        enteredProfile.displayName;

      const aliases = [
        ...new Set([
          ...(existingProfile?.aliases || []),
          enteredProfile.displayName
        ])
      ].slice(-10);

      const reservation = {
        profileId: enteredProfile.profileId,
        giftId: giftSnapshot.id,
        giftName: gift.nome,
        guestName: canonicalName,
        submittedName: enteredProfile.displayName,
        guestNameNormalized: enteredProfile.normalizedName,
        whatsapp: enteredProfile.whatsapp,
        deliveryChoice: deliveryChoice.value,
        ownerUid: user.uid,
        status: "reservado",
        storeUrl: gift.linkCompra,
        createdAt: now,
        updatedAt: now,
        expiresAt
      };

      transaction.set(profileRef, {
        profileId: enteredProfile.profileId,
        displayName: canonicalName,
        normalizedName: enteredProfile.normalizedName,
        whatsapp: enteredProfile.whatsapp,
        aliases,
        reservationCount:
          Number(existingProfile?.reservationCount || 0) + 1,
        createdAt:
          existingProfile?.createdAt ||
          now,
        updatedAt: now,
        lastReservationAt: now
      });

      transaction.set(reservationRef, reservation);
      transaction.set(profileReservationRef, reservation);

      transaction.update(giftRef, {
        purchaseStatus: "reservado",
        reservationId: reservationRef.id,
        reservationProfileId: enteredProfile.profileId,
        reservedByUid: user.uid,
        reservationExpiresAt: expiresAt,
        updatedAt: now
      });
    });

    localStorage.setItem(
      "casamento.reserva.ultimoAcesso",
      JSON.stringify({
        name: canonicalName,
        whatsapp: enteredProfile.whatsapp
      })
    );

    const expirationText = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(expiresAt.toDate());

    message.className = "notice success";

    message.innerHTML = `
      <strong>Presente reservado com sucesso!</strong><br>
      ${
        profileAlreadyExisted
          ? `
            Encontramos outras reservas vinculadas a
            <strong>${escapeHtml(canonicalName)}</strong>
            e este WhatsApp. A nova reserva foi adicionada ao mesmo cadastro.
            <br>
          `
          : ""
      }
      Sua reserva ficará ativa até ${expirationText}.

      <div class="actions" style="margin-top:14px">
        <a
          class="btn btn-primary"
          href="${escapeHtml(selectedGift.linkCompra)}"
          target="_blank"
          rel="noopener"
        >
          Abrir produto na loja
        </a>

        <button
          class="btn btn-secondary"
          id="viewReservationAfterSave"
          type="button"
        >
          Ver minhas reservas
        </button>
      </div>

      <small>
        Depois da compra, consulte suas reservas e clique em
        “Já comprei o produto”.
      </small>
    `;

    message.classList.remove("hidden");

    byId("viewReservationAfterSave")?.addEventListener("click", () => {
      closeModals();
      openMyReservations({
        name: canonicalName,
        whatsapp: enteredProfile.whatsapp,
        searchImmediately: true
      });
    });

    render();
  } catch (error) {
    console.error("Erro ao reservar presente:", error);

    const permissionDenied =
      error?.code === "permission-denied" ||
      /missing or insufficient permissions/i.test(
        String(error?.message || "")
      );

    message.className = "notice danger";
    message.textContent = permissionDenied
      ? "Não foi possível concluir a reserva agora. Atualize a página e tente novamente. Se o problema continuar, avise os noivos."
      : (
          error.message ||
          "Não foi possível reservar este presente."
        );

    message.classList.remove("hidden");
  } finally {
    reservationSubmitButton.disabled = false;
    reservationSubmitButton.textContent =
      `Reservar por ${getCurrentConfig().reservationHours || 24} horas`;
  }
});

function showPixMessage(message, type = "danger") {
  pixMessage.className = `notice ${type}`;
  pixMessage.textContent = message;
  pixMessage.classList.remove("hidden");
}

function hidePixMessage() {
  pixMessage.classList.add("hidden");
  pixMessage.textContent = "";
}

function currentPixSignature() {
  return JSON.stringify({
    giftId: pixGiftId.value,
    name: formatDisplayName(pixName.value),
    whatsapp: digits(pixWhatsapp.value),
    value: Number(pixValue.value).toFixed(2)
  });
}

function invalidatePixGeneration({
  keepMessage = true
} = {}) {
  pixPayloadGenerated = "";
  pixGeneration = null;
  pixGenerated.classList.add("hidden");
  pixPayload.value = "";
  pixSubmitButton.disabled = false;
  pixSubmitButton.textContent = "Já fiz o PIX";

  if (!keepMessage) {
    hidePixMessage();
  }
}

function pixRemainingValue(gift) {
  if (!gift) return null;

  return Math.max(
    0,
    Number(gift.valorEstimado || 0) -
    Number(gift.pixConfirmedTotal || 0)
  );
}

async function openPix(id) {
  selectedGift = id === "presente-dinheiro"
    ? null
    : gifts.find(gift => gift.id === id);

  pixForm.reset();
  invalidatePixGeneration({
    keepMessage: false
  });

  generatePixButton.disabled = true;
  generatePixButton.textContent =
    "Carregando configuração PIX...";

  pixGiftId.value = id;
  pixTitle.textContent =
    selectedGift?.nome || "Presente em Dinheiro";

  if (selectedGift) {
    const remaining = pixRemainingValue(selectedGift);
    const estimated = Number(
      selectedGift.valorEstimado || 0
    );

    pixValue.value = (
      remaining > 0
        ? remaining
        : estimated
    ).toFixed(2);

    pixGiftSummary.innerHTML = `
      <strong>${escapeHtml(selectedGift.nome)}</strong>
      <span>
        Valor estimado: ${money(estimated)}
      </span>
      <small>
        Já confirmado por PIX:
        ${money(selectedGift.pixConfirmedTotal || 0)}
        • Valor restante:
        ${money(remaining)}
      </small>
    `;

    pixValueHelp.textContent =
      "Você pode contribuir com o valor restante, uma parte dele ou até um valor maior. O excedente será tratado como presente em dinheiro.";
  } else {
    pixValue.value = "";

    pixGiftSummary.innerHTML = `
      <strong>Presente em Dinheiro</strong>
      <span>
        Escolha livremente o valor que deseja enviar ao casal.
      </span>
      <small>
        Esta contribuição não fica vinculada a um produto.
      </small>
    `;

    pixValueHelp.textContent =
      "Informe qualquer valor maior que zero.";
  }

  openModal(pixModal);

  try {
    const rawConfiguration = await getPixConfig();

    if (!rawConfiguration?.active) {
      throw new Error(
        "O PIX ainda não está disponível. Os noivos precisam ativá-lo no painel."
      );
    }

    pixConfig = normalizePixConfig(rawConfiguration);

    generatePixButton.disabled = false;
    generatePixButton.textContent =
      "Gerar QR Code e PIX Copia e Cola";
  } catch (error) {
    pixConfig = null;
    generatePixButton.disabled = true;
    generatePixButton.textContent = "PIX indisponível";
    showPixMessage(
      error.message ||
      "Não foi possível carregar a configuração do PIX.",
      "warning"
    );
  }
}

[
  pixName,
  pixWhatsapp,
  pixValue
].forEach(element => {
  element.addEventListener("input", () => {
    if (pixGeneration) {
      invalidatePixGeneration({
        keepMessage: false
      });
    }
  });
});

pixWhatsapp.addEventListener("input", () => {
  pixWhatsapp.value = maskPhone(pixWhatsapp.value);
});

generatePixButton.addEventListener(
  "click",
  async () => {
    const originalText = generatePixButton.textContent;
    generatePixButton.disabled = true;
    generatePixButton.textContent = "Gerando PIX...";
    hidePixMessage();

    try {
      if (!pixConfig?.active) {
        throw new Error("PIX indisponível.");
      }

      if (!hasNameAndSurname(pixName.value)) {
        throw new Error("Informe seu nome e sobrenome.");
      }

      if (!isValidWhatsapp(pixWhatsapp.value)) {
        throw new Error(
          "Informe um WhatsApp válido no formato (69) 99999-9999."
        );
      }

      const value = Number(pixValue.value);

      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Informe um valor PIX válido.");
      }

      const contributionRef = doc(
        collection(db, "pixInformados")
      );

      const txid = contributionRef.id
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 25);

      pixPayloadGenerated = buildPixPayload({
        key: pixConfig.key,
        name: pixConfig.holderName,
        city: pixConfig.city,
        amount: value,
        description:
          pixConfig.description ||
          "PRESENTE DE CASAMENTO",
        txid
      });

      if (!validatePixPayload(pixPayloadGenerated)) {
        throw new Error(
          "Não foi possível validar o código PIX gerado."
        );
      }

      renderQrToCanvas(
        pixQrCanvas,
        pixPayloadGenerated,
        {
          size: 240,
          margin: 4,
          level: "M"
        }
      );

      pixPayload.value = pixPayloadGenerated;
      pixBeneficiary.textContent =
        `${pixConfig.holderName} • ${money(value)}`;

      pixDestinationLabel.textContent =
        selectedGift?.nome ||
        "Presente em Dinheiro";

      pixGeneration = {
        id: contributionRef.id,
        txid,
        signature: currentPixSignature(),
        value,
        payload: pixPayloadGenerated
      };

      pixGenerated.classList.remove("hidden");
      showPixMessage(
        "PIX gerado. Faça o pagamento no banco e depois clique em “Já fiz o PIX”.",
        "success"
      );

      pixGenerated.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    } catch (error) {
      invalidatePixGeneration();
      showPixMessage(
        error.message ||
        "Não foi possível gerar o PIX."
      );
    } finally {
      generatePixButton.disabled = !pixConfig?.active;
      generatePixButton.textContent = originalText;
    }
  }
);

copyPixButton.addEventListener(
  "click",
  async () => {
    if (!pixPayloadGenerated) {
      showPixMessage(
        "Gere o PIX antes de copiar o código."
      );
      return;
    }

    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(
          pixPayloadGenerated
        );
      } else {
        pixPayload.focus();
        pixPayload.select();

        const copied = document.execCommand("copy");

        if (!copied) {
          throw new Error();
        }
      }

      copyPixButton.textContent = "Código copiado";

      window.setTimeout(() => {
        copyPixButton.textContent = "Copiar código PIX";
      }, 1800);
    } catch {
      pixPayload.focus();
      pixPayload.select();

      showPixMessage(
        "Não foi possível copiar automaticamente. O código foi selecionado; use Ctrl+C.",
        "warning"
      );
    }
  }
);

pixForm.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    pixSubmitButton.disabled = true;
    pixSubmitButton.textContent = "Registrando...";

    try {
      if (!pixGeneration || !pixPayloadGenerated) {
        throw new Error(
          "Gere o PIX antes de informar o pagamento."
        );
      }

      if (
        pixGeneration.signature !== currentPixSignature()
      ) {
        throw new Error(
          "Os dados foram alterados depois da geração. Gere o PIX novamente."
        );
      }

      const user = await ensureAnonymousAuth();

      const value = Number(pixValue.value);
      const isCash =
        pixGiftId.value === "presente-dinheiro";

      const pixProfile = await buildReservationProfile(
        pixName.value,
        pixWhatsapp.value
      );

      const pixData = {
        profileId: pixProfile.profileId,

        giftId: pixGiftId.value,
        giftName:
          selectedGift?.nome ||
          "Presente em Dinheiro",
        destinationType:
          isCash ? "cash" : "gift",

        guestName: pixProfile.displayName,
        guestNameNormalized:
          pixProfile.normalizedName,
        whatsapp: pixProfile.whatsapp,

        value,
        ownerUid: user.uid,
        status: "aguardando_confirmacao",

        txid: pixGeneration.txid,
        payload: pixGeneration.payload,
        keyType: pixConfig.keyType,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const batch = writeBatch(db);

      batch.set(
        doc(
          db,
          "perfisPix",
          pixProfile.profileId
        ),
        {
          profileId: pixProfile.profileId,
          displayName: pixProfile.displayName,
          normalizedName: pixProfile.normalizedName,
          whatsapp: pixProfile.whatsapp,
          updatedAt: serverTimestamp(),
          lastPixAt: serverTimestamp()
        },
        { merge: true }
      );

      batch.set(
        doc(
          db,
          "perfisPix",
          pixProfile.profileId,
          "pix",
          pixGeneration.id
        ),
        pixData
      );

      batch.set(
        doc(
          db,
          "pixInformados",
          pixGeneration.id
        ),
        pixData
      );

      await batch.commit();

      localStorage.setItem(
        "casamento.pix.ultimoAcesso",
        JSON.stringify({
          name: pixProfile.displayName,
          whatsapp: pixProfile.whatsapp
        })
      );

      pixSubmitButton.textContent = "PIX informado";
      generatePixButton.disabled = true;

      showPixMessage(
        "PIX informado com sucesso. Os noivos confirmarão o recebimento pelo painel administrativo.",
        "success"
      );
    } catch (error) {
      const permissionDenied =
        error?.code === "permission-denied" ||
        /missing or insufficient permissions/i.test(
          String(error?.message || "")
        );

      showPixMessage(
        permissionDenied
          ? "Não foi possível registrar o PIX. Publique as regras atualizadas do Firebase e tente novamente."
          : (
              error.message ||
              "Não foi possível informar o PIX."
            )
      );

      pixSubmitButton.disabled = false;
      pixSubmitButton.textContent = "Já fiz o PIX";
    }
  }
);
function pixPublicStatusLabel(status) {
  return ({
    aguardando_confirmacao: "Aguardando confirmação",
    confirmado: "Confirmado",
    recusado: "Recusado"
  })[status] || "Status desconhecido";
}

function pixPublicStatusClass(status) {
  return status === "confirmado"
    ? "confirmed"
    : status === "recusado"
      ? "rejected"
      : "pending";
}

function pixPublicStatusNote(status) {
  return ({
    aguardando_confirmacao:
      "Os noivos ainda precisam conferir o recebimento no banco.",
    confirmado:
      "O recebimento deste PIX já foi confirmado pelos noivos.",
    recusado:
      "Este PIX foi recusado. Confirme no aplicativo do banco se o pagamento foi concluído corretamente."
  })[status] || "";
}

function showMyPixMessage(text, type = "") {
  myPixMessage.className = `notice ${type}`.trim();
  myPixMessage.textContent = text;
  myPixMessage.classList.remove("hidden");
}

function hideMyPixMessage() {
  myPixMessage.classList.add("hidden");
  myPixMessage.textContent = "";
}

function openMyPix({
  name = "",
  whatsapp = "",
  searchImmediately = false
} = {}) {
  myPixLookupForm.reset();
  myPixName.value = name;
  myPixWhatsapp.value = maskPhone(whatsapp);
  myPixList.classList.add("hidden");
  myPixList.innerHTML = "";
  hideMyPixMessage();

  openModal(myPixModal);

  if (searchImmediately && name && whatsapp) {
    searchPixByIdentity();
  }
}

function renderMyPix(profile, entries) {
  const confirmed = entries.filter(
    item => item.data.status === "confirmado"
  );

  const pending = entries.filter(
    item => item.data.status === "aguardando_confirmacao"
  );

  const totalConfirmed = confirmed.reduce(
    (total, item) =>
      total + Number(item.data.value || 0),
    0
  );

  myPixList.classList.remove("hidden");
  myPixList.innerHTML = `
    <div class="notice success" style="margin-bottom:14px">
      PIX encontrados para
      <strong>${escapeHtml(profile.displayName)}</strong>.
    </div>

    <div class="pix-lookup-summary">
      <article>
        <span>Total informado</span>
        <strong>${money(
          entries.reduce(
            (total, item) =>
              total + Number(item.data.value || 0),
            0
          )
        )}</strong>
      </article>

      <article>
        <span>Total confirmado</span>
        <strong>${money(totalConfirmed)}</strong>
      </article>

      <article>
        <span>Aguardando</span>
        <strong>${pending.length}</strong>
      </article>
    </div>

    <div class="pix-lookup-list">
      ${entries.map(item => {
        const pix = item.data;
        const createdAt = pix.createdAt?.toDate?.();
        const status = pix.status ||
          "aguardando_confirmacao";

        return `
          <article class="pix-lookup-item">
            <div class="pix-lookup-item-header">
              <h3>${escapeHtml(
                pix.giftName || "Presente em Dinheiro"
              )}</h3>

              <span
                class="pix-lookup-status ${pixPublicStatusClass(status)}"
              >
                ${escapeHtml(pixPublicStatusLabel(status))}
              </span>
            </div>

            <div class="pix-lookup-details">
              <div>
                <span>Valor</span>
                <strong>${money(pix.value)}</strong>
              </div>

              <div>
                <span>Data informada</span>
                <strong>
                  ${
                    createdAt
                      ? createdAt.toLocaleString("pt-BR")
                      : "—"
                  }
                </strong>
              </div>

              <div>
                <span>Identificação</span>
                <strong>${escapeHtml(pix.txid || "—")}</strong>
              </div>
            </div>

            <p class="pix-lookup-note">
              ${escapeHtml(pixPublicStatusNote(status))}
            </p>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

async function searchPixByIdentity() {
  hideMyPixMessage();
  myPixList.classList.add("hidden");
  myPixList.innerHTML = "";
  searchMyPixButton.disabled = true;
  searchMyPixButton.textContent = "Consultando...";

  try {
    const profile = await buildReservationProfile(
      myPixName.value,
      myPixWhatsapp.value
    );

    const user = await ensureAnonymousAuth();
    const entries = [];

    const profileRef = doc(
      db,
      "perfisPix",
      profile.profileId
    );

    const profileSnapshot = await getDoc(profileRef);

    if (profileSnapshot.exists()) {
      const savedProfile = profileSnapshot.data();

      profile.displayName =
        savedProfile.displayName || profile.displayName;

      const profilePixSnapshot = await getDocs(
        collection(
          db,
          "perfisPix",
          profile.profileId,
          "pix"
        )
      );

      profilePixSnapshot.docs.forEach(snapshot => {
        entries.push({
          id: snapshot.id,
          data: snapshot.data(),
          legacy: false
        });
      });
    }

    /*
     * Compatibilidade com PIX informados antes desta atualização.
     * Só encontra registros antigos no mesmo navegador, pelo UID anônimo.
     */
    const legacySnapshot = await getDocs(
      query(
        collection(db, "pixInformados"),
        where("ownerUid", "==", user.uid)
      )
    );

    legacySnapshot.docs.forEach(snapshot => {
      const pix = snapshot.data();

      const samePerson =
        !pix.profileId &&
        pix.whatsapp === profile.whatsapp &&
        normalizeName(pix.guestName) ===
          profile.normalizedName;

      const alreadyIncluded = entries.some(
        item => item.id === snapshot.id
      );

      if (samePerson && !alreadyIncluded) {
        entries.push({
          id: snapshot.id,
          data: pix,
          legacy: true
        });
      }
    });

    entries.sort(
      (a, b) =>
        timestampMillis(b.data.createdAt) -
        timestampMillis(a.data.createdAt)
    );

    if (!entries.length) {
      showMyPixMessage(
        "Nenhum PIX foi encontrado com este nome e WhatsApp.",
        "warning"
      );
      return;
    }

    localStorage.setItem(
      "casamento.pix.ultimoAcesso",
      JSON.stringify({
        name: profile.displayName,
        whatsapp: profile.whatsapp
      })
    );

    renderMyPix(profile, entries);
  } catch (error) {
    console.error(error);

    const permissionDenied =
      error?.code === "permission-denied" ||
      /missing or insufficient permissions/i.test(
        String(error?.message || "")
      );

    showMyPixMessage(
      permissionDenied
        ? "Não foi possível consultar os PIX. Publique as regras atualizadas do Firebase."
        : (
            error.message ||
            "Não foi possível consultar seus PIX."
          ),
      "danger"
    );
  } finally {
    searchMyPixButton.disabled = false;
    searchMyPixButton.textContent = "Consultar PIX";
  }
}

myPixButton.addEventListener("click", () => {
  const savedLookup = JSON.parse(
    localStorage.getItem(
      "casamento.pix.ultimoAcesso"
    ) || "null"
  );

  openMyPix({
    name: savedLookup?.name || "",
    whatsapp: savedLookup?.whatsapp || "",
    searchImmediately: false
  });
});

myPixLookupForm.addEventListener(
  "submit",
  async event => {
    event.preventDefault();
    await searchPixByIdentity();
  }
);
function reservationStatus(reservation) {
  const expiration = reservation.expiresAt?.toDate?.();

  if (
    reservation.status === "reservado" &&
    expiration &&
    expiration.getTime() <= Date.now()
  ) {
    return "expirada";
  }

  return reservation.status;
}

function statusLabel(status) {
  return ({
    reservado: "Reservado",
    expirada: "Reserva expirada",
    compra_informada: "Compra informada ao casal",
    compra_confirmada: "Compra confirmada",
    cancelada: "Reserva cancelada",
    cancelada_admin: "Liberada pelo administrador"
  })[status] || String(status || "").replaceAll("_", " ");
}

function showMyReservationsMessage(text, type = "") {
  myReservationsMessage.className =
    `notice ${type}`.trim();
  myReservationsMessage.textContent = text;
  myReservationsMessage.classList.remove("hidden");
}

function hideMyReservationsMessage() {
  myReservationsMessage.classList.add("hidden");
  myReservationsMessage.textContent = "";
}

async function openMyReservations({
  name = "",
  whatsapp = "",
  searchImmediately = false
} = {}) {
  myReservationsLookupForm.reset();
  myReservationsName.value = name;
  myReservationsWhatsapp.value = maskPhone(whatsapp);
  myReservationsList.classList.add("hidden");
  myReservationsList.innerHTML = "";
  hideMyReservationsMessage();

  openModal(myReservationsModal);

  if (searchImmediately && name && whatsapp) {
    await searchReservationsByIdentity();
  }
}

function renderReservationCards(profile, reservations) {
  myReservationsList.classList.remove("hidden");
  myReservationsList.innerHTML = `
    <div class="notice success" style="margin-bottom:16px">
      Reservas encontradas para
      <strong>${escapeHtml(profile.displayName)}</strong>.
    </div>

    <div class="reservation-list">
      ${reservations.map(item => {
        const reservation = item.data;
        const expiration =
          reservation.expiresAt?.toDate?.();
        const status = reservationStatus(reservation);
        const active = status === "reservado";

        return `
          <article
            class="reservation-item"
            data-reservation-id="${item.id}"
            data-profile-id="${profile.profileId}"
            data-legacy="${item.legacy ? "true" : "false"}"
          >
            <h3>${escapeHtml(reservation.giftName)}</h3>

            <p>
              <strong>Status:</strong>
              ${escapeHtml(statusLabel(status))}
            </p>

            <p>
              <strong>Validade:</strong>
              ${
                expiration
                  ? expiration.toLocaleString("pt-BR")
                  : "—"
              }
            </p>

            <div class="actions">
              ${
                reservation.storeUrl
                  ? `
                    <a
                      class="btn btn-secondary"
                      href="${escapeHtml(reservation.storeUrl)}"
                      target="_blank"
                      rel="noopener"
                    >
                      Abrir produto na loja
                    </a>
                  `
                  : ""
              }

              ${
                active
                  ? `
                    <button
                      class="btn btn-primary"
                      type="button"
                      data-bought
                    >
                      Já comprei o produto
                    </button>

                    <button
                      class="btn btn-danger"
                      type="button"
                      data-cancel
                    >
                      Cancelar reserva
                    </button>
                  `
                  : ""
              }
            </div>

            ${
              status === "compra_informada"
                ? `
                  <div
                    class="notice success"
                    style="margin-top:12px"
                  >
                    A compra foi informada e aguarda a confirmação do administrador.
                  </div>
                `
                : ""
            }
          </article>
        `;
      }).join("")}
    </div>
  `;

  myReservationsList
    .querySelectorAll("[data-bought]")
    .forEach(button => {
      button.addEventListener("click", async () => {
        const card = button.closest("[data-reservation-id]");

        if (
          confirm(
            "Confirma que você já realizou a compra deste produto?"
          )
        ) {
          await changeReservation({
            profile,
            reservationId:
              card.dataset.reservationId,
            newStatus: "compra_informada",
            legacy: card.dataset.legacy === "true"
          });
        }
      });
    });

  myReservationsList
    .querySelectorAll("[data-cancel]")
    .forEach(button => {
      button.addEventListener("click", async () => {
        const card = button.closest("[data-reservation-id]");

        if (
          confirm(
            "Deseja cancelar esta reserva e liberar o presente?"
          )
        ) {
          await changeReservation({
            profile,
            reservationId:
              card.dataset.reservationId,
            newStatus: "cancelada",
            legacy: card.dataset.legacy === "true"
          });
        }
      });
    });
}

async function searchReservationsByIdentity() {
  hideMyReservationsMessage();
  myReservationsList.classList.add("hidden");
  myReservationsList.innerHTML = "";
  searchMyReservationsButton.disabled = true;
  searchMyReservationsButton.textContent = "Consultando...";

  try {
    const profile = await buildReservationProfile(
      myReservationsName.value,
      myReservationsWhatsapp.value
    );

    const user = await ensureAnonymousAuth();
    const profileRef = doc(
      db,
      "perfisReservas",
      profile.profileId
    );
    const profileSnapshot = await getDoc(profileRef);

    const reservations = [];

    if (profileSnapshot.exists()) {
      const savedProfile = profileSnapshot.data();

      profile.displayName =
        savedProfile.displayName || profile.displayName;

      const profileReservationsSnapshot = await getDocs(
        collection(
          db,
          "perfisReservas",
          profile.profileId,
          "reservas"
        )
      );

      profileReservationsSnapshot.docs.forEach(snapshot => {
        reservations.push({
          id: snapshot.id,
          data: snapshot.data(),
          legacy: false
        });
      });
    }

    /*
     * Compatibilidade com reservas antigas feitas antes desta atualização.
     * Não usa orderBy, portanto não exige índice composto.
     */
    const legacySnapshot = await getDocs(
      query(
        collection(db, "reservas"),
        where("ownerUid", "==", user.uid)
      )
    );

    legacySnapshot.docs.forEach(snapshot => {
      const reservation = snapshot.data();

      const samePerson =
        !reservation.profileId &&
        reservation.whatsapp === profile.whatsapp &&
        normalizeName(reservation.guestName) ===
          profile.normalizedName;

      const alreadyIncluded = reservations.some(
        item => item.id === snapshot.id
      );

      if (samePerson && !alreadyIncluded) {
        reservations.push({
          id: snapshot.id,
          data: reservation,
          legacy: true
        });
      }
    });

    reservations.sort(
      (a, b) =>
        timestampMillis(b.data.createdAt) -
        timestampMillis(a.data.createdAt)
    );

    if (!reservations.length) {
      showMyReservationsMessage(
        "Nenhuma reserva foi encontrada com este nome e WhatsApp.",
        "warning"
      );
      return;
    }

    localStorage.setItem(
      "casamento.reserva.ultimoAcesso",
      JSON.stringify({
        name: profile.displayName,
        whatsapp: profile.whatsapp
      })
    );

    renderReservationCards(profile, reservations);
  } catch (error) {
    console.error(error);

    showMyReservationsMessage(
      error.message ||
      "Não foi possível consultar suas reservas.",
      "danger"
    );
  } finally {
    searchMyReservationsButton.disabled = false;
    searchMyReservationsButton.textContent =
      "Consultar reservas";
  }
}

async function changeReservation({
  profile,
  reservationId,
  newStatus,
  legacy
}) {
  try {
    const user = await ensureAnonymousAuth();
    const reservationRef = doc(
      db,
      "reservas",
      reservationId
    );
    const profileReservationRef = doc(
      db,
      "perfisReservas",
      profile.profileId,
      "reservas",
      reservationId
    );

    await runTransaction(db, async transaction => {
      const reservationSnapshot =
        await transaction.get(reservationRef);

      if (!reservationSnapshot.exists()) {
        throw new Error("Reserva não encontrada.");
      }

      const reservation = reservationSnapshot.data();

      const accessAllowed = legacy
        ? reservation.ownerUid === user.uid
        : reservation.profileId === profile.profileId;

      if (!accessAllowed) {
        throw new Error(
          "Os dados informados não correspondem a esta reserva."
        );
      }

      if (
        reservation.status !== "reservado" ||
        reservation.expiresAt?.toMillis?.() <= Date.now()
      ) {
        throw new Error("Esta reserva não está mais ativa.");
      }

      const giftRef = doc(
        db,
        "presentes",
        reservation.giftId
      );
      const giftSnapshot =
        await transaction.get(giftRef);

      let profileReservationSnapshot = null;

      if (!legacy) {
        profileReservationSnapshot =
          await transaction.get(profileReservationRef);

        if (!profileReservationSnapshot.exists()) {
          throw new Error(
            "O registro da reserva não foi encontrado no cadastro."
          );
        }
      }

      if (!giftSnapshot.exists()) {
        throw new Error("Presente não encontrado.");
      }

      const gift = giftSnapshot.data();

      if (gift.reservationId !== reservationId) {
        throw new Error(
          "Esta reserva já não está vinculada ao presente."
        );
      }

      const now = serverTimestamp();

      if (newStatus === "cancelada") {
        transaction.update(giftRef, {
          purchaseStatus: "disponivel",
          reservationId: null,
          reservationProfileId: null,
          reservedByUid: null,
          reservationExpiresAt: null,
          updatedAt: now
        });
      } else {
        transaction.update(giftRef, {
          purchaseStatus: "compra_informada",
          updatedAt: now
        });
      }

      transaction.update(reservationRef, {
        status: newStatus,
        updatedAt: now
      });

      if (!legacy) {
        transaction.update(profileReservationRef, {
          status: newStatus,
          updatedAt: now
        });
      }
    });

    await searchReservationsByIdentity();
  } catch (error) {
    alert(error.message);
  }
}

myReservationsButton.addEventListener("click", () => {
  const savedLookup = JSON.parse(
    localStorage.getItem("casamento.reserva.ultimoAcesso") || "null"
  );

  openMyReservations({
    name: savedLookup?.name || "",
    whatsapp: savedLookup?.whatsapp || "",
    searchImmediately: false
  });
});

myReservationsLookupForm.addEventListener(
  "submit",
  async event => {
    event.preventDefault();
    await searchReservationsByIdentity();
  }
);

[search, category, price].forEach(element => {
  element.addEventListener("input", render);
  element.addEventListener("change", render);
});

ensureAnonymousAuth().then(() => {
  const giftsQuery = query(
    collection(db, "presentes"),
    where("ativo", "==", true),
    where("visivelPublico", "==", true)
  );

  onSnapshot(
    giftsQuery,
    snapshot => {
      gifts = snapshot.docs
        .map(documentSnapshot => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data()
        }))
        .sort((a, b) =>
          a.nome.localeCompare(b.nome, "pt-BR")
        );

      const currentCategory = category.value;

      category.innerHTML =
        '<option value="">Todas as categorias</option>' +
        [...new Set(gifts.map(gift => gift.categoria))]
          .sort()
          .map(item =>
            `<option>${escapeHtml(item)}</option>`
          )
          .join("");

      category.value = currentCategory;
      render();
    },
    error => {
      console.error(error);

      grid.innerHTML = `
        <div class="notice danger">
          Não foi possível carregar os presentes.
          Inicialize o projeto pelo painel ADM e aplique
          as regras atualizadas do Firestore.
        </div>
      `;
    }
  );
});

setInterval(render, 30000);
