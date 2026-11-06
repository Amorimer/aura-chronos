// Financeiro: pure helpers shared by the app screen, the assistant tools and WhatsApp.
// No I/O here, so the rules can be unit tested.

export type ExpenseRow = {
  id: string; user_id: string; amount: number; description: string; category: string;
  spent_on: string; source: "texto" | "foto" | "audio" | "app"; status: "pendente" | "confirmado";
  created_at: string; updated_at: string;
};
export type IncomeRow = { id: string; user_id: string; amount: number; description: string; received_on: string; created_at: string };
export type CategoryRow = { id: string; user_id: string; name: string; emoji: string };

export const DEFAULT_CATEGORIES: { name: string; emoji: string }[] = [
  { name: "Mercado", emoji: "🛒" }, { name: "Feira", emoji: "🥬" }, { name: "Transporte", emoji: "🚕" },
  { name: "Farmácia", emoji: "💊" }, { name: "Alimentação fora", emoji: "🍽️" }, { name: "Compras", emoji: "🛍️" },
  { name: "Contas da casa", emoji: "🏠" }, { name: "Saúde", emoji: "🩺" }, { name: "Lazer", emoji: "🎬" },
  { name: "Educação", emoji: "📚" }, { name: "Outros", emoji: "🏷️" },
];

/** Words that mean the same category, so "Uber", "táxi" and "99" all land in Transporte. */
const SYNONYMS: Record<string, string[]> = {
  Mercado: ["mercado", "supermercado", "mercadinho", "atacadao", "atacadista", "assai", "carrefour", "extra", "pao de acucar", "guanabara", "prezunic", "mundial", "hortifruti mercado", "acougue", "padaria"],
  Feira: ["feira", "hortifruti", "sacolao", "verdura", "fruta", "legume", "quitanda"],
  Transporte: ["transporte", "taxi", "uber", "99", "99pop", "onibus", "metro", "trem", "brt", "vlt", "passagem", "combustivel", "gasolina", "etanol", "posto", "estacionamento", "pedagio", "bilhete unico", "riocard", "corrida"],
  Farmácia: ["farmacia", "drogaria", "remedio", "medicamento", "drogasil", "raia", "pacheco", "venancio"],
  "Alimentação fora": ["restaurante", "lanche", "lanchonete", "ifood", "delivery", "pizza", "hamburguer", "cafe", "cafeteria", "bar", "almoco", "jantar", "quentinha", "marmita", "alimentacao fora", "comida fora"],
  Compras: ["shopping", "loja", "roupa", "sapato", "tenis", "presente", "compras", "eletronico", "magazine", "americanas", "shopee", "mercado livre", "amazon"],
  "Contas da casa": ["luz", "energia", "light", "enel", "agua", "cedae", "gas", "internet", "telefone", "celular", "aluguel", "condominio", "iptu", "conta de casa", "contas da casa", "tv", "streaming fixo"],
  Saúde: ["saude", "medico", "consulta", "dentista", "exame", "plano de saude", "laboratorio", "psicologo", "academia"],
  Lazer: ["lazer", "cinema", "show", "teatro", "netflix", "spotify", "jogo", "passeio", "viagem", "hotel", "festa"],
  Educação: ["educacao", "escola", "faculdade", "curso", "livro", "material escolar", "mensalidade escolar"],
};

export const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function titleCase(s: string) {
  const t = s.trim().replace(/\s+/g, " ").slice(0, 40);
  return t ? t[0].toUpperCase() + t.slice(1) : "Outros";
}

/**
 * Picks the category for a spend. The user's own categories win when the name matches
 * (ignoring accents and case); then synonyms of the defaults; else a new, tidy name.
 */
export function canonicalCategory(input: string | null | undefined, userCategories: string[] = [], hint = ""): string {
  const raw = (input ?? "").trim();
  const key = strip(raw);
  const own = userCategories.find((c) => strip(c) === key);
  if (key && own) return own;
  const haystack = ` ${strip(`${raw} ${hint}`)} `;
  for (const cat of Object.keys(SYNONYMS)) {
    if (strip(cat) === key) return userCategories.find((c) => strip(c) === strip(cat)) ?? cat;
  }
  for (const [cat, words] of Object.entries(SYNONYMS)) {
    if (words.some((w) => haystack.includes(` ${w} `))) return userCategories.find((c) => strip(c) === strip(cat)) ?? cat;
  }
  return key ? titleCase(raw) : "Outros";
}

/** "52,90", "R$ 1.234,56", "1234.56", "1.234", "12" → number. Null when it is not a positive amount. */
export function parseAmount(s: string | number | null | undefined): number | null {
  if (typeof s === "number") return Number.isFinite(s) && s > 0 ? Math.round(s * 100) / 100 : null;
  if (!s || /-\s*\d/.test(s)) return null;
  let t = s.replace(/[^\d,.]/g, "");
  if (!t) return null;
  const comma = t.lastIndexOf(","), dot = t.lastIndexOf(".");
  const decimalAt = (i: number) => i >= 0 && t.length - i - 1 > 0 && t.length - i - 1 <= 2;
  if (comma >= 0 && dot >= 0) {
    const dec = Math.max(comma, dot);
    t = t.slice(0, dec).replace(/[.,]/g, "") + "." + t.slice(dec + 1);
  } else if (comma >= 0) {
    t = decimalAt(comma) && (t.match(/,/g) ?? []).length === 1 ? t.replace(",", ".") : t.replace(/,/g, "");
  } else if (dot >= 0) {
    t = decimalAt(dot) && (t.match(/\./g) ?? []).length === 1 ? t : t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** First and next-first day of a "YYYY-MM" month, as dates. */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  return { start, end: `${ny}-${String(nm).padStart(2, "0")}-01` };
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} de ${y}`;
}

/** Totals for one month: by category (largest first), incomes, spends and balance. */
export function summarize(expenses: Pick<ExpenseRow, "amount" | "category" | "status">[], incomes: Pick<IncomeRow, "amount">[]) {
  const byCat = new Map<string, { total: number; count: number }>();
  let spent = 0, pending = 0;
  for (const e of expenses) {
    const a = Number(e.amount);
    spent += a;
    if (e.status === "pendente") pending++;
    const k = byCat.get(e.category) ?? { total: 0, count: 0 };
    k.total += a; k.count++;
    byCat.set(e.category, k);
  }
  const income = incomes.reduce((s, i) => s + Number(i.amount), 0);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    income: round(income), spent: round(spent), balance: round(income - spent), pending,
    categories: [...byCat.entries()].map(([name, v]) => ({ name, total: round(v.total), count: v.count })).sort((a, b) => b.total - a.total),
  };
}
