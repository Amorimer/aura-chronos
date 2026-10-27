"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type DeleteState } from "@/app/(app)/ajustes/actions";
import { fieldCls, Sheet } from "./sheet";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {});
  const [typed, setTyped] = useState("");
  return (
    <>
      <button onClick={() => setOpen(true)} className="self-start text-sm font-semibold text-danger">Excluir minha conta</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Excluir minha conta">
        <form action={action} className="flex flex-col gap-4">
          <p className="text-[15px] leading-6">
            Isso apaga para sempre sua conta e todos os seus dados: compromissos, tarefas, notas, lembretes, conversas
            com o assistente e a conexão com o WhatsApp. Não dá para desfazer.
          </p>
          <p className="text-sm text-muted">
            Se você assinou pela Play Store ou App Store, cancele a assinatura na loja também.
          </p>
          <label className="flex flex-col gap-1.5 text-sm">
            <span>Para confirmar, digite <strong>EXCLUIR</strong></span>
            <input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" className={fieldCls} />
          </label>
          {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
          <button disabled={pending || typed.trim().toUpperCase() !== "EXCLUIR"}
            className="h-12 rounded-full bg-danger text-bg font-semibold disabled:opacity-40">
            {pending ? "Excluindo…" : "Excluir conta e dados"}
          </button>
        </form>
      </Sheet>
    </>
  );
}
