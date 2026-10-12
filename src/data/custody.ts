// Fuente única de quién es quién en el respaldo del oro (WEB-008B).
// Todo lo que está acá sale de fuentes públicas de Tether Gold, revisadas el 2026-10-12:
// - gold.tether.to y gold.tether.to/faq: emisor, estándar LBMA Good Delivery y canje por lingotes.
// - gold.tether.to/reports: informes trimestrales de reservas, revisados por BDO Italia (ISAE 3000R).
//   El del 30/06/2026 dice que el oro está en bóvedas en Suiza y que es de quienes tienen XAUT.
// Ese informe es sobre Tether Gold, no sobre Aura Gold: no presentarlo como auditoría de Aura.
export const CUSTODY = {
  token: "Tether Gold (XAUT)",
  issuer: "TG Commodities, S.A. de C.V.",
  auditor: "BDO Italia",
  assuranceStandard: "ISAE 3000 Revised",
  metalStandard: "Good Delivery de la LBMA",
  siteUrl: "https://gold.tether.to/",
  faqUrl: "https://gold.tether.to/faq",
  reportsUrl: "https://gold.tether.to/reports",
} as const;
