import { CONTROLLER } from "../legal";

export const metadata = { title: "Excluir conta · Aura Cronos - Assistente Pessoal" };

/** Public page for the Google Play "account deletion" URL: works without installing or signing in. */
export default function ExcluirConta() {
  const subject = encodeURIComponent("Excluir minha conta do Aura Cronos");
  const body = encodeURIComponent("Quero excluir minha conta do Aura Cronos e todos os meus dados.\n\nE-mail da conta: \n");
  return (
    <>
      <h1>Excluir sua conta do Aura Cronos</h1>
      <p className="text-muted">Aura Cronos - Assistente Pessoal, de {CONTROLLER.name}</p>

      <h2>Pelo app (na hora)</h2>
      <ul>
        <li>Abra o Aura Cronos e entre na sua conta.</li>
        <li>Toque em <b>Ajustes</b>, desça até <b>Conta</b> e toque em <b>Excluir minha conta</b>.</li>
        <li>Digite EXCLUIR e confirme.</li>
      </ul>
      <p><a href="/ajustes">Abrir Ajustes</a></p>

      <h2>Sem acesso ao app</h2>
      <p>
        Envie um e-mail para <a href={`mailto:${CONTROLLER.email}?subject=${subject}&body=${body}`}>{CONTROLLER.email}</a> a
        partir do e-mail da conta, pedindo a exclusão. Respondemos e excluímos em até 15 dias.
      </p>

      <h2>O que é apagado</h2>
      <p>
        Tudo de uma vez e para sempre: cadastro, compromissos, tarefas, notas, lembretes, memória do assistente, histórico
        de conversa (inclusive áudios e fotos enviados), conexão com o WhatsApp e com o Google Agenda.
      </p>
      <p>
        Só guardamos o que a lei obriga, como registros de pagamento (pelo prazo fiscal) e registros de acesso (6 meses,
        Marco Civil da Internet). Assinaturas feitas pela Play Store ou App Store precisam ser canceladas na própria loja.
      </p>
      <p>Contas sem uso por 60 dias também são excluídas automaticamente. Veja a <a href="/privacidade">Política de Privacidade</a>.</p>
    </>
  );
}
