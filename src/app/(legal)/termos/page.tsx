import { CONTROLLER, TERMS_VERSION } from "../legal";

export const metadata = { title: "Termos de Uso · Aura Cronos - Assistente Pessoal" };

export default function Termos() {
  return (
    <>
      <h1>Termos de Uso</h1>
      <p className="text-muted">Aura Cronos - Assistente Pessoal · versão {TERMS_VERSION}</p>

      <h2>1. O serviço</h2>
      <p>
        O Aura Cronos, oferecido por {CONTROLLER.name} (CNPJ {CONTROLLER.cnpj}), organiza seus compromissos, tarefas,
        notas e lembretes e avisa você pelo WhatsApp e por notificações. O assistente usa inteligência artificial e pode
        errar: confira datas e horários importantes.
      </p>

      <h2>2. Conta</h2>
      <p>
        A conta é pessoal, para maiores de 18 anos, criada com um e-mail Gmail. Você é responsável por manter seu
        acesso seguro e pelas informações que cadastra.
      </p>

      <h2>3. Teste grátis</h2>
      <ul>
        <li>Toda conta nova tem 14 dias grátis, com todos os recursos.</li>
        <li>Do 15º ao 20º dia sem assinatura, você recebe um aviso por dia com a contagem regressiva de quantos dias faltam para o acesso ser interrompido.</li>
        <li>No 20º dia sem assinatura, o WhatsApp e o Google Agenda são desconectados automaticamente e os lembretes param.</li>
        <li>Depois de 60 dias sem uso da plataforma, a conta e os dados são apagados automaticamente.</li>
      </ul>

      <h2>4. Assinatura e cobrança</h2>
      <ul>
        <li>Plano único de R$ 20,00 por mês, com todos os recursos incluídos.</li>
        <li>Ao assinar, a cobrança é recorrente: todo mês o valor é cobrado automaticamente no cartão de crédito cadastrado, até você cancelar.</li>
        <li>Se você assinar pelo Google Play ou pela App Store, a cobrança e o cancelamento seguem as regras da loja.</li>
        <li>Você pode cancelar a qualquer momento em Ajustes, sem multa. O acesso continua até o fim do mês já pago.</li>
        <li>Pelo direito de arrependimento (art. 49 do Código de Defesa do Consumidor), você pode desistir em até 7 dias após a primeira cobrança e receber o valor de volta.</li>
        <li>Se uma cobrança falhar, avisamos e tentamos de novo; sem pagamento, a conta volta ao estado do item 3 (integrações desconectadas e, após 60 dias sem uso, dados apagados).</li>
        <li>Mudanças de preço são avisadas com pelo menos 30 dias de antecedência.</li>
      </ul>

      <h2>5. Uso aceitável</h2>
      <p>
        Não use o Aura Cronos para enviar spam, conteúdo ilegal ou para acessar contas de outras pessoas. Podemos
        suspender contas que violem estes termos.
      </p>

      <h2>6. WhatsApp e Google Agenda</h2>
      <p>
        Pelo WhatsApp você recebe os lembretes que ativou e pode falar com o assistente sobre sua agenda, tarefas, notas
        e lembretes. Para parar os lembretes, mande PARAR; para desconectar, use Ajustes. A conexão com o Google Agenda
        lê e altera apenas as agendas que você escolher, e pode ser desfeita a qualquer momento.
      </p>

      <h2>7. Responsabilidade</h2>
      <p>
        Fazemos o possível para que os lembretes cheguem no horário, mas dependemos de serviços de terceiros (WhatsApp,
        Google, operadoras). Não respondemos por perdas causadas por falhas desses serviços ou por informações
        cadastradas de forma errada.
      </p>

      <h2>8. Privacidade</h2>
      <p>
        O tratamento dos seus dados segue a <a href="/privacidade">Política de Privacidade</a> e a LGPD.
      </p>

      <h2>9. Foro e contato</h2>
      <p>
        Estes termos seguem as leis do Brasil. Dúvidas: <a href={`mailto:${CONTROLLER.email}`}>{CONTROLLER.email}</a>.
      </p>
    </>
  );
}
