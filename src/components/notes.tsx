"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NoteRow } from "@/lib/types";
import { fieldCls, Sheet } from "./sheet";
import { IconPlus, IconSearch } from "./icons";

export function Notes() {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<NoteRow | "new" | null>(null);
  // Typed but not saved: closing the sheet would lose it, so ask first.
  const dirty = useRef(false);
  function close() {
    if (dirty.current && !confirm("Descartar o que você escreveu?")) return;
    dirty.current = false;
    setOpen(null);
  }

  const load = useCallback(async () => {
    const { data } = await createClient().from("notes").select("*").order("updated_at", { ascending: false }).limit(200);
    setNotes((data as NoteRow[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("n");
    if (id) createClient().from("notes").select("*").eq("id", id).single().then(({ data }) => data && setOpen(data as NoteRow));
  }, []);

  const term = q.trim().toLowerCase();
  const shown = term ? notes.filter((n) => (n.title + " " + n.body).toLowerCase().includes(term)) : notes;

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur pt-safe">
        <div className="h-14 px-5 flex items-center"><h1 className="text-[17px] font-semibold">Notas</h1></div>
        <div className="px-4 pb-3 relative">
          <IconSearch size={18} className="absolute left-8 top-3.5 text-muted" />
          <label className="sr-only" htmlFor="q">Buscar notas</label>
          <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="w-full h-12 pl-11 pr-4 rounded-2xl bg-surface border border-line-input" />
        </div>
      </header>
      <div className="px-4 pb-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-surface-2 animate-pulse" />)}</div>
        ) : shown.length === 0 ? (
          <div className="text-center py-14">
            <p className="font-medium">{term ? "Nada encontrado" : "Nenhuma nota ainda"}</p>
            {!term && <p className="text-sm text-muted mt-1">Diga ao assistente “anota: a senha do wi-fi do escritório é…” ou toque em +.</p>}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {shown.map((n) => (
              <li key={n.id}>
                <button onClick={() => setOpen(n)} className="w-full h-32 text-left rounded-2xl bg-surface border border-line p-3.5 overflow-hidden">
                  {n.title && <div className="font-semibold text-sm truncate">{n.title}</div>}
                  <div className="text-sm text-muted mt-1 line-clamp-4 whitespace-pre-wrap">{n.body}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button onClick={() => setOpen("new")} aria-label="Nova nota"
        className="fixed right-5 bottom-[calc(80px+env(safe-area-inset-bottom))] z-20 w-14 h-14 rounded-full bg-accent text-on-accent shadow-lg grid place-items-center"><IconPlus size={26} /></button>
      <Sheet open={!!open} onClose={close} title={open === "new" ? "Nova nota" : "Nota"}>
        {open && <NoteForm key={open === "new" ? "new" : open.id} note={open === "new" ? null : open} onDirty={() => { dirty.current = true; }} onDone={() => { dirty.current = false; setOpen(null); load(); if (window.location.search) window.history.replaceState(null, "", "/notas"); }} />}
      </Sheet>
    </div>
  );
}

function NoteForm({ note, onDone, onDirty }: { note: NoteRow | null; onDone: () => void; onDirty: () => void }) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() && !body.trim()) return onDone();
    setBusy(true);
    const sb = createClient();
    if (note) await sb.from("notes").update({ title, body }).eq("id", note.id);
    else await sb.from("notes").insert({ title, body });
    setBusy(false);
    onDone();
  }
  async function remove() {
    if (!note || !confirm("Excluir esta nota?")) return;
    await createClient().from("notes").delete().eq("id", note.id);
    onDone();
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <label className="sr-only" htmlFor="nt">Título</label>
      <input id="nt" value={title} onChange={(e) => { setTitle(e.target.value); onDirty(); }} placeholder="Título" className={`${fieldCls} font-semibold`} />
      <label className="sr-only" htmlFor="nb">Conteúdo</label>
      <textarea id="nb" value={body} onChange={(e) => { setBody(e.target.value); onDirty(); }} rows={10} placeholder="Escreva aqui…" className={`${fieldCls} h-auto py-3 leading-6`} autoFocus={!note} />
      <div className="flex gap-3 pt-1">
        {note && <button type="button" onClick={remove} className="h-12 px-5 rounded-full border border-line text-danger font-semibold">Excluir</button>}
        <button disabled={busy} className="flex-1 h-12 rounded-full bg-accent text-on-accent font-semibold disabled:opacity-60">{busy ? "Salvando…" : "Salvar"}</button>
      </div>
    </form>
  );
}
