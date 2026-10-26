// Company data shown in the privacy policy and terms. Fill in the CNPJ data before launch.
export const CONTROLLER = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME || "[RAZÃO SOCIAL]",
  cnpj: process.env.NEXT_PUBLIC_COMPANY_CNPJ || "[CNPJ]",
  dpo: process.env.NEXT_PUBLIC_COMPANY_DPO || "[NOME DO ENCARREGADO]",
  email: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "amorimer.designer@gmail.com",
};

// Bump when the text changes in a way that needs a new acceptance.
export const PRIVACY_VERSION = "2026-10-26";
export const TERMS_VERSION = "2026-10-26";
