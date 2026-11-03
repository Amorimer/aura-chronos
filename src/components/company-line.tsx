import { CONTROLLER } from "@/app/(legal)/legal";

/** Shows who is behind the brand. WhatsApp checks this link between "Aura Cronos" and the verified business. */
export function CompanyLine({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted leading-5 ${className}`}>
      Aura Cronos por {CONTROLLER.name} · CNPJ {CONTROLLER.cnpj}
      <br />
      <a href="/termos" className="underline">Termos</a> · <a href="/privacidade" className="underline">Privacidade</a> · <a href="/excluir-conta" className="underline">Excluir conta</a>
    </p>
  );
}
