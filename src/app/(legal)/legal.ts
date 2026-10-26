// Company data shown in the privacy policy and terms.
export const CONTROLLER = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME || "Amorímer",
  cnpj: process.env.NEXT_PUBLIC_COMPANY_CNPJ || "45.326.269/0001-09",
  dpo: process.env.NEXT_PUBLIC_COMPANY_DPO || "Amorímer",
  email: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "amorimer.designer@gmail.com",
};

// Bump when the text changes in a way that needs a new acceptance.
export const PRIVACY_VERSION = "2026-10-26";
export const TERMS_VERSION = "2026-10-26";
