"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toLocalDate } from "@/lib/time";
import {
  brl, canonicalCategory, DEFAULT_CATEGORIES, monthLabel, monthRange, parseAmount, shiftMonth, summarize,
  type CategoryRow, type ExpenseRow, type IncomeRow,
} from "@/lib/finance";
import { Field, fieldCls, Sheet } from "./sheet";
import { IconCheck, IconChevronLeft, IconChevronRight, IconEye, IconEyeOff, IconPlus } from "./icons";

const SOURCE: Record<ExpenseRow["source"], string> = { texto: "WhatsApp (texto)", foto: "WhatsApp (foto)", audio: "WhatsApp (áudio)", app: "App" };
const HIDE_KEY = "aura:hide-money";

/** Values start hidden: the screen may be shared or seen by others. One tap shows them, remembered on this device. */
function useHideMoney() {
  const [hide, setHide] = useState(true);
  useEffect(() => {
    try { setHide(localStorage.getItem(HIDE_KEY) !== "0"); } catch { /* private mode: keep hidden */ }
  }, []);
  const toggle = () => setHide((h) => {
    try { localStorage.setItem(HIDE_KEY, h ? "0" : "1"); } catch { /* ignore */ }
    return !h;
  });
  return { hide, toggle };
}

const fmtDay = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

export function Finance({ tz }: { tz: string }) {
  const today = toLocalDate(new Date(), tz);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [incomes, setIncomes] = useState<IncomeRow[]>([]);
  const [pending, setPending] = useState<ExpenseRow[]>([]);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<ExpenseRow | "new" | null>(null);
  const [editIncome, setEditIncome] = useState<IncomeRow | "new" | null>(null);
  const [manageCats, setManageCats] = useState(false);
  const { hide, toggle } = useHideMoney();
  const money = (n: number) => (hide ? "R$ •••••" : brl(n));

  const load = useCallback(async () => {
    const sb = createClient();
    const r = monthRange(month);
    const [ex, inc, pend, c] = await Promise.all([
      sb.from("expenses").select("*").gte("spent_on", r.start).lt("spent_on", r.end).order("spent_on", { ascending: false }).order("created_at", { ascending: false }),
      sb.from("incomes").select("*").gte("received_on", r.start).lt("received_on", r.end).order("received_on", { ascending: false }),
      sb.from("expenses").select("*").eq("status", "pendente").order("spent_on", { ascending: false }).limit(50),
      sb.from("finance_categories").select("*").order("name"),
    ]);
    if (!c.error && (c.data ?? []).length === 0) {
      await sb.rpc("ensure_finance_categories");
      const again = await sb.from("finance_categories").select("*").order("name");
      setCats((again.data as CategoryRow[]) ?? []);
    } else setCats((c.data as CategoryRow[]) ?? []);
    setExpenses((ex.data as ExpenseRow[]) ?? []);
    setIncomes((inc.data as IncomeRow[]) ?? []);
    setPending((pend.data as ExpenseRow[]) ?? []);
    setLoading(false);
  }, [month]);
  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("m");
    if (m && /^\d{4}-\d{2}$/.test(m)) setMonth(m);
  }, []);

  const s = useMemo(() => summarize(expenses, incomes), [expenses, incomes]);
  const emoji = (name: string) => cats.find((c) => c.name === name)?.emoji ?? DEFAULT_CATEGORIES.find((c) => c.name === name)?.emoji ?? "🏷️";

  async function confirm(e: ExpenseRow) {
    setPending((p) => p.filter((x) => x.id !== e.id));
    setExpenses((list) => list.map((x) => (x.id === e.id ? { ...x, status: "confirmado" } : x)));
    await createClient().from("expenses").update({ status: "confirmado" }).eq("id", e.id);
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur pt-safe">
        <div className="h-14 px-5 flex items-center justify-between">
          <h1 className="text-[17px] font-semibold">Finanças</h1>
          <button onClick={toggle} aria-pressed={!hide} aria-label={hide ? "Mostrar valores" : "Ocultar valores"}
            className="w-11 h-11 -mr-2 grid place-items-center rounded-full text-muted">
            {hide ? <IconEyeOff size={22} /> : <IconEye size={22} />}
          </button>
        </div>
        <div className="px-3 pb-2 flex items-center justify-between">
          <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mês anterior" className="w-11 h-11 grid place-items-center rounded-full"><IconChevronLeft /></button>
          <div className="font-medium">{monthLabel(month)}</div>
          <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Próximo mês" className="w-11 h-11 grid place-items-center rounded-full"><IconChevronRight /></button>
        </div>
      </header>

      <div className="px-4 pb-28 flex flex-col gap-4">
        <section aria-label="Resumo do mês" className="grid grid-cols-3 gap-2">
          {[["Entradas", s.income], ["Gastos", s.spent], ["Saldo", s.balance]].map(([label, v]) => (
            <div key={label as string} className="rounded-2xl bg-surface border border-line p-3">
              <div className="text-xs text-muted">{label}</div>
              <div className={`mt-1 font-semibold text-[15px] tabular-nums ${label === "Saldo" && (v as number) < 0 && !hide ? "text-danger" : ""}`}>
                {loading ? "…" : money(v as number)}
              </div>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setEditExpense("new")} className="h-12 rounded-full bg-accent text-on-accent font-semibold flex items-center justify-center gap-1.5"><IconPlus size={18} />Gasto</button>
          <button onClick={() => setEditIncome("new")} className="h-12 rounded-full border border-line-input font-semibold flex items-center justify-center gap-1.5"><IconPlus size={18} />Entrada</button>
        </div>

        {pending.length > 0 && (
          <section aria-labelledby="pend" className="rounded-2xl bg-warn-soft p-3">
            <h2 id="pend" className="font-semibold text-sm px-1">Para conferir ({pending.length})</h2>
            <p className="text-xs text-muted px-1 mt-0.5">Registrados pelo WhatsApp. Confira o valor e a categoria.</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {pending.map((e) => (
                <li key={e.id} className="flex items-center gap-2 rounded-xl bg-surface border border-line p-2.5">
                  <button onClick={() => setEditExpense(e)} className="flex-1 text-left min-w-0">
                    <div className="font-medium truncate">{e.description || e.category}</div>
                    <div className="text-xs text-muted">{emoji(e.category)} {e.category} · {fmtDay(e.spent_on)} · {SOURCE[e.source]}</div>
                  </button>
                  <div className="font-semibold tabular-nums">{money(Number(e.amount))}</div>
                  <button onClick={() => confirm(e)} aria-label={`Confirmar ${e.description || e.category}`}
                    className="w-11 h-11 grid place-items-center rounded-full bg-accent text-on-accent shrink-0"><IconCheck size={20} /></button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="cats">
          <div className="flex items-center justify-between px-1">
            <h2 id="cats" className="font-semibold">Gastos por categoria</h2>
            <button onClick={() => setManageCats(true)} className="text-sm text-accent font-medium h-11 px-1">Categorias</button>
          </div>
          {loading ? (
            <div className="flex flex-col gap-2 mt-1">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-surface-2 animate-pulse" />)}</div>
          ) : s.categories.length === 0 ? (
            <div className="text-center py-10 rounded-2xl bg-surface border border-line mt-1 px-6">
              <p className="font-medium">Nenhum gasto em {monthLabel(month).toLowerCase()}</p>
              <p className="text-sm text-muted mt-1">Mande no WhatsApp “gastei 32,50 na farmácia” ou a foto da nota fiscal. Ou toque em + Gasto.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2 mt-1">
              {s.categories.map((c) => {
                const open = openCat === c.name;
                const pct = s.spent ? Math.round((c.total / s.spent) * 100) : 0;
                return (
                  <li key={c.name} className="rounded-2xl bg-surface border border-line overflow-hidden">
                    <button onClick={() => setOpenCat(open ? null : c.name)} aria-expanded={open} className="w-full p-3 text-left">
                      <div className="flex items-center gap-3">
                        <span className="text-xl" aria-hidden>{emoji(c.name)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted">{c.count} {c.count === 1 ? "gasto" : "gastos"} · {pct}%</div>
                        </div>
                        <div className="font-semibold tabular-nums">{money(c.total)}</div>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden" aria-hidden>
                        <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                    {open && (
                      <ul className="border-t border-line">
                        {expenses.filter((e) => e.category === c.name).map((e) => (
                          <li key={e.id}>
                            <button onClick={() => setEditExpense(e)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left border-b border-line last:border-0">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{e.description || c.name}</div>
                                <div className="text-xs text-muted">{fmtDay(e.spent_on)} · {SOURCE[e.source]}{e.status === "pendente" ? " · para conferir" : ""}</div>
                              </div>
                              <div className="text-sm tabular-nums">{money(Number(e.amount))}</div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="inc">
          <h2 id="inc" className="font-semibold px-1">Entradas do mês</h2>
          {!loading && incomes.length === 0 ? (
            <p className="text-sm text-muted px-1 mt-1">Nenhuma entrada. Toque em + Entrada ou diga no WhatsApp “recebi 1.200 do cliente”.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 mt-1">
              {incomes.map((i) => (
                <li key={i.id}>
                  <button onClick={() => setEditIncome(i)} className="w-full flex items-center gap-2 rounded-xl bg-surface border border-line p-3 text-left">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{i.description || "Entrada"}</div>
                      <div className="text-xs text-muted">{fmtDay(i.received_on)}</div>
                    </div>
                    <div className="font-semibold tabular-nums">{money(Number(i.amount))}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Sheet open={!!editExpense} onClose={() => setEditExpense(null)} title={editExpense === "new" ? "Novo gasto" : "Gasto"}>
        {editExpense && (
          <ExpenseForm key={editExpense === "new" ? "new" : editExpense.id} expense={editExpense === "new" ? null : editExpense}
            categories={cats.map((c) => c.name)} today={today}
            onDone={() => { setEditExpense(null); load(); }} />
        )}
      </Sheet>
      <Sheet open={!!editIncome} onClose={() => setEditIncome(null)} title={editIncome === "new" ? "Nova entrada" : "Entrada"}>
        {editIncome && (
          <IncomeForm key={editIncome === "new" ? "new" : editIncome.id} income={editIncome === "new" ? null : editIncome} today={today}
            onDone={() => { setEditIncome(null); load(); }} />
        )}
      </Sheet>
      <Sheet open={manageCats} onClose={() => setManageCats(false)} title="Categorias">
        {manageCats && <CategoryManager categories={cats} onChange={load} />}
      </Sheet>
    </div>
  );
}

function ExpenseForm({ expense, categories, today, onDone }: { expense: ExpenseRow | null; categories: string[]; today: string; onDone: () => void }) {
  const [amount, setAmount] = useState(expense ? String(expense.amount).replace(".", ",") : "");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [category, setCategory] = useState(expense?.category ?? "");
  const [day, setDay] = useState(expense?.spent_on ?? today);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => [...new Set([...categories, ...(expense ? [expense.category] : [])])].sort((a, b) => a.localeCompare(b, "pt-BR")), [categories, expense]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const value = parseAmount(amount);
    if (!value) return setError("Digite um valor, ex.: 52,90.");
    setBusy(true);
    const row = {
      amount: value, description: description.trim(), spent_on: day,
      category: canonicalCategory(category || description, categories, description), status: "confirmado" as const,
    };
    const sb = createClient();
    const { error: err } = expense ? await sb.from("expenses").update(row).eq("id", expense.id) : await sb.from("expenses").insert({ ...row, source: "app" });
    setBusy(false);
    if (err) return setError("Não foi possível salvar. Tente de novo.");
    onDone();
  }
  async function remove() {
    if (!expense || !confirm("Apagar este gasto?")) return;
    await createClient().from("expenses").delete().eq("id", expense.id);
    onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <Field label="Valor (R$)">
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus={!expense} className={`${fieldCls} text-lg tabular-nums`} />
      </Field>
      <Field label="Descrição">
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="Ex.: mercado do bairro" className={fieldCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldCls}>
            <option value="">Automática</option>
            {options.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Data">
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required className={fieldCls} />
        </Field>
      </div>
      {expense && <p className="text-xs text-muted">Registrado por {SOURCE[expense.source]}{expense.status === "pendente" ? " · ao salvar, fica confirmado" : ""}.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2 pt-1">
        {expense && <button type="button" onClick={remove} className="h-12 px-5 rounded-full text-danger font-semibold">Apagar</button>}
        <button disabled={busy} className="flex-1 h-12 rounded-full bg-accent text-on-accent font-semibold disabled:opacity-50">{expense?.status === "pendente" ? "Confirmar" : "Salvar"}</button>
      </div>
    </form>
  );
}

function IncomeForm({ income, today, onDone }: { income: IncomeRow | null; today: string; onDone: () => void }) {
  const [amount, setAmount] = useState(income ? String(income.amount).replace(".", ",") : "");
  const [description, setDescription] = useState(income?.description ?? "");
  const [day, setDay] = useState(income?.received_on ?? today);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const value = parseAmount(amount);
    if (!value) return setError("Digite um valor, ex.: 1.500,00.");
    const row = { amount: value, description: description.trim(), received_on: day };
    const sb = createClient();
    const { error: err } = income ? await sb.from("incomes").update(row).eq("id", income.id) : await sb.from("incomes").insert(row);
    if (err) return setError("Não foi possível salvar. Tente de novo.");
    onDone();
  }
  async function remove() {
    if (!income || !confirm("Apagar esta entrada?")) return;
    await createClient().from("incomes").delete().eq("id", income.id);
    onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <Field label="Valor (R$)">
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus={!income} className={`${fieldCls} text-lg tabular-nums`} />
      </Field>
      <Field label="Descrição">
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="Ex.: pagamento recebido" className={fieldCls} />
      </Field>
      <Field label="Data">
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required className={fieldCls} />
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2 pt-1">
        {income && <button type="button" onClick={remove} className="h-12 px-5 rounded-full text-danger font-semibold">Apagar</button>}
        <button className="flex-1 h-12 rounded-full bg-accent text-on-accent font-semibold">Salvar</button>
      </div>
    </form>
  );
}

/** Add, rename or join categories. Joining moves every spend to the other category. */
function CategoryManager({ categories, onChange }: { categories: CategoryRow[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [merge, setMerge] = useState<{ from: string; into: string } | null>(null);
  const [msg, setMsg] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim().slice(0, 40);
    if (!n) return;
    if (categories.some((c) => c.name.toLowerCase() === n.toLowerCase())) return setMsg("Essa categoria já existe.");
    await createClient().from("finance_categories").insert({ name: n });
    setName(""); setMsg(""); onChange();
  }
  async function join() {
    if (!merge || !merge.into || merge.into === merge.from) return;
    const sb = createClient();
    await sb.from("expenses").update({ category: merge.into }).eq("category", merge.from);
    await sb.from("finance_categories").delete().eq("name", merge.from);
    setMsg(`"${merge.from}" foi unida a "${merge.into}".`);
    setMerge(null); onChange();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex gap-2">
        <label className="sr-only" htmlFor="newcat">Nova categoria</label>
        <input id="newcat" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Nova categoria" className={fieldCls} />
        <button className="h-12 px-5 rounded-full bg-accent text-on-accent font-semibold shrink-0">Criar</button>
      </form>
      {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
      <p className="text-xs text-muted">Categorias parecidas (ex.: Uber, 99 e táxi) já entram juntas em Transporte. Para juntar duas categorias suas, toque em Unir.</p>
      <ul className="flex flex-col gap-1.5">
        {categories.map((c) => (
          <li key={c.id} className="rounded-xl border border-line p-2.5">
            <div className="flex items-center gap-2">
              <span aria-hidden>{c.emoji}</span>
              <span className="flex-1">{c.name}</span>
              <button onClick={() => setMerge(merge?.from === c.name ? null : { from: c.name, into: "" })} className="text-sm text-accent font-medium h-10 px-2">Unir</button>
            </div>
            {merge?.from === c.name && (
              <div className="flex gap-2 mt-2">
                <label className="sr-only" htmlFor={`into-${c.id}`}>Unir com</label>
                <select id={`into-${c.id}`} value={merge.into} onChange={(e) => setMerge({ from: c.name, into: e.target.value })} className={fieldCls}>
                  <option value="">Unir com…</option>
                  {categories.filter((o) => o.name !== c.name).map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                </select>
                <button onClick={join} disabled={!merge.into} className="h-12 px-4 rounded-full bg-accent text-on-accent font-semibold disabled:opacity-40 shrink-0">Unir</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
