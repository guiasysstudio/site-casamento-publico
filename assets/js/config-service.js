import { db } from "./firebase.js";
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

export const DEFAULT_CONFIG = {
  siteName: "Mislaine & Emerson",
  pageTitle: "Casamento de Mislaine & Emerson",
  introText: "Estamos preparando este momento com muito carinho. Neste espaço você poderá confirmar sua presença e escolher uma forma especial de nos presentear.",
  weddingDate: new Date("2026-09-06T17:00:00-04:00"),
  confirmationDeadline: new Date("2026-09-01T17:00:00-04:00"),
  venueName: "CATRE",
  venueAddress: "Av. Brasília, 5373 - Boa Esperança, Rolim de Moura - RO",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=CATRE%20Av.%20Bras%C3%ADlia%205373%20Boa%20Esperan%C3%A7a%20Rolim%20de%20Moura%20RO",
  childMaxAge: 12,
  reservationHours: 24,
  domain: ""
};

function convertConfig(data = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...data,
    weddingDate: data.weddingDate?.toDate?.() || DEFAULT_CONFIG.weddingDate,
    confirmationDeadline: data.confirmationDeadline?.toDate?.() || DEFAULT_CONFIG.confirmationDeadline
  };
}
export async function getPublicConfig() {
  const snapshot = await getDoc(doc(db, "configuracoes", "publico"));
  return snapshot.exists() ? convertConfig(snapshot.data()) : DEFAULT_CONFIG;
}
export function watchPublicConfig(callback, onError) {
  return onSnapshot(doc(db, "configuracoes", "publico"), snapshot => {
    callback(snapshot.exists() ? convertConfig(snapshot.data()) : DEFAULT_CONFIG);
  }, onError);
}
export async function getPixConfig() {
  const snapshot = await getDoc(doc(db, "configuracoes", "pixPublico"));
  return snapshot.exists() ? snapshot.data() : null;
}
export async function getDeliveryConfig() {
  const snapshot = await getDoc(doc(db, "configuracoes", "entregaPublica"));
  return snapshot.exists() ? snapshot.data() : null;
}
