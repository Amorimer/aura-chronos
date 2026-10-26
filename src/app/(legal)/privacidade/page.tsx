export const metadata = { title: "Política de Privacidade · Aura Cronos" };

export default function Privacidade() {
  return (
    <>
      <h1>Política de Privacidade</h1>
      <p className="text-muted">Aura Cronos · Assistente Pessoal. Atualizada em 25 de outubro de 2026.</p>

      <h2>O que coletamos</h2>
      <ul>
        <li>Conta: e-mail e nome de exibição.</li>
        <li>Conteúdo que você cria: mensagens ao assistente, eventos, tarefas, notas e lembretes.</li>
        <li>Notificações: a inscrição de push do seu navegador e, se você conectar, o número do seu WhatsApp.</li>
      </ul>

      <h2>Para que usamos</h2>
      <p>Somente para fazer o app funcionar: organizar sua agenda, interpretar seus pedidos e enviar os lembretes que você ativou. Não vendemos dados nem usamos para publicidade.</p>

      <h2>WhatsApp</h2>
      <p>A conexão é opcional e individual. Você envia um código ao nosso número e passamos a mandar seus lembretes por lá. As mensagens, áudios e imagens que você manda para o nosso número são tratados como pedidos ao assistente, do mesmo jeito que no app, e ficam no histórico da sua conta. Para parar, mande PARAR no WhatsApp ou toque em Desconectar em Ajustes; o número é apagado da sua conta.</p>

      <h2>Quem processa os dados</h2>
      <ul>
        <li>Supabase: banco de dados e login.</li>
        <li>Vercel: hospedagem.</li>
        <li>Google (Gemini API): interpretação das mensagens enviadas ao assistente.</li>
        <li>Meta (WhatsApp Cloud API): envio de mensagens, se você conectar o WhatsApp.</li>
      </ul>

      <h2>Seus direitos</h2>
      <p>Você pode acessar, corrigir ou excluir seus dados a qualquer momento. Para excluir a conta e todos os dados, escreva para <a href="mailto:amorimer.designer@gmail.com">amorimer.designer@gmail.com</a>.</p>
    </>
  );
}
