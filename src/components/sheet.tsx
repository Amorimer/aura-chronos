"use client";

import { useEffect, useRef } from "react";
import { IconX } from "./icons";

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-label={title}
      className="m-0 mt-auto sm:m-auto w-full max-w-xl max-h-[92dvh] bg-transparent p-0 backdrop:bg-black/40 text-ink">
      {open && (
        <div className="bg-surface rounded-t-3xl sm:rounded-3xl border border-line flex flex-col max-h-[92dvh]">
          <div className="flex items-center justify-between px-5 h-14 border-b border-line shrink-0">
            <h2 className="font-semibold text-[17px]">{title}</h2>
            <button onClick={onClose} aria-label="Fechar" className="w-10 h-10 -mr-2 grid place-items-center rounded-full text-muted"><IconX /></button>
          </div>
          <div className="overflow-y-auto px-5 py-4 pb-[calc(16px+env(safe-area-inset-bottom))]">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export const fieldCls = "h-12 px-3.5 rounded-xl bg-bg border border-line-input w-full";
export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`flex flex-col gap-1.5 text-sm font-medium ${className}`}>{label}{children}</label>;
}
