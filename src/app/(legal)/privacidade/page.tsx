import { CONTROLLER, PRIVACY_VERSION } from "../legal";

export const metadata = { title: "Política de Privacidade · Aura Cronos - Assistente Pessoal" };

export default function Privacidade() {
  return (
    <>
      <h1>Política de Privacidade</h1>
      <p className="text-muted">Aura Cronos - Assistente Pessoal · versão {PRIVACY_VERSION}</p>

      <p>
        Esta política explica como o Aura Cronos trata os seus dados pessoais, de acordo com a Lei Geral de Proteção de
        Dados (Lei nº 13.709/2018, LGPD). Ao criar sua conta, você declara que leu e concorda com ela e com os{" "}
        <a href="/termos">Termos de Uso</a>.
      </p>

      <h2>1. Quem é o controlador</h2>
      <p>
        {CONTROLLER.name}, inscrita no CNPJ {CONTROLLER.cnpj}, é a controladora dos dados tratados no Aura Cronos.
        Encarregado pelo tratamento de dados (art. 41 da LGPD): {CONTROLLER.dpo}, e-mail{" "}
        <a href={`mailto:${CONTROLLER.email}`}>{CONTROLLER.email}</a>.
      </p>

      <h2>2. Quais dados coletamos</h2>
      <ul>
        <li><b>Cadastro:</b> nome, e-mail (Gmail) e senha (guardada só de forma criptografada).</li>
        <li><b>WhatsApp:</b> número de telefone, se você conectar, e as mensagens, áudios, fotos e PDFs que você enviar ao Aura.</li>
        <li><b>Agenda e organização:</b> compromissos, tarefas, notas e lembretes que você cria, e as preferências que você pede para o assistente lembrar.</li>
        <li><b>Google Agenda:</b> se você conectar, os eventos das agendas que você escolher e os tokens de acesso (criptografados).</li>
        <li><b>Pagamento:</b> se você assinar, nome, CPF e dados de cobrança, tratados pelo provedor de pagamento. O Aura Cronos não guarda o número do seu cartão.</li>
        <li><b>Uso técnico:</b> registros de acesso (data, hora, endereço IP), dados do aparelho para notificações e registros de erro, guardados pelo prazo exigido no Marco Civil da Internet.</li>
      </ul>

      <h2>3. Para que usamos e com qual base legal</h2>
      <ul>
        <li><b>Prestar o serviço</b> (cadastrar, lembrar, resumir, sincronizar com o Google Agenda e responder pelo WhatsApp): execução do contrato (art. 7º, V).</li>
        <li><b>Cobrar a assinatura e emitir nota fiscal:</b> execução do contrato e cumprimento de obrigação legal (art. 7º, II e V).</li>
        <li><b>Segurança, prevenção a fraudes e registros de acesso:</b> obrigação legal (Marco Civil da Internet, art. 15) e legítimo interesse (art. 7º, IX).</li>
        <li><b>Melhorar o produto</b> com estatísticas agregadas, sem identificar você: legítimo interesse.</li>
        <li><b>Mensagens que não sejam do serviço</b> (novidades, ofertas): só com o seu consentimento, que pode ser retirado a qualquer momento (art. 7º, I).</li>
      </ul>
      <p>Não vendemos seus dados e não os usamos para publicidade.</p>

      <h2>4. Inteligência artificial</h2>
      <p>
        Para entender o que você escreve, fala ou fotografa, o conteúdo é processado por um modelo de inteligência
        artificial (Google Gemini). Usamos a modalidade da API em que o Google não usa os dados para treinar modelos.
        A IA só cria, altera ou apaga itens da sua agenda a seu pedido, e ações de apagar pelo WhatsApp pedem confirmação.
      </p>

      <h2>5. Com quem compartilhamos</h2>
      <p>Só com os operadores necessários para o serviço funcionar, que tratam os dados conforme nossas instruções:</p>
      <ul>
        <li>Supabase (banco de dados e login);</li>
        <li>Vercel (hospedagem);</li>
        <li>Google (Gemini e Google Agenda, este se você conectar);</li>
        <li>Meta (WhatsApp Business), se você conectar o WhatsApp;</li>
        <li>Asaas (pagamentos e nota fiscal), se você assinar;</li>
        <li>serviços de envio de e-mail e de registro de erros, para códigos de acesso e para corrigir falhas.</li>
      </ul>
      <p>Também podemos compartilhar dados quando a lei ou uma ordem judicial exigir.</p>

      <h2>6. Transferência internacional</h2>
      <p>
        Alguns desses operadores guardam dados fora do Brasil (por exemplo, nos Estados Unidos). Essa transferência
        acontece com as garantias previstas no art. 33 da LGPD, como cláusulas contratuais de proteção de dados.
      </p>

      <h2>7. Por quanto tempo guardamos</h2>
      <ul>
        <li><b>Áudios, fotos e PDFs</b> enviados ao assistente: só processados, não ficam guardados. No histórico fica apenas a indicação “[áudio enviado]” ou “[imagem enviada]”.</li>
        <li><b>Agenda, tarefas, notas e histórico de conversa:</b> enquanto a conta existir.</li>
        <li><b>Cópia dos eventos do Google Agenda:</b> só de 1 dia atrás até 90 dias à frente, renovada pela sincronização.</li>
        <li><b>Dados de cobrança e notas fiscais:</b> pelo prazo exigido pela legislação fiscal (até 5 anos).</li>
        <li><b>Registros de acesso:</b> 6 meses (Marco Civil da Internet).</li>
      </ul>
      <p>Ao excluir a conta, apagamos os dados que não precisamos guardar por lei.</p>

      <h2>8. Seus direitos (art. 18 da LGPD)</h2>
      <p>Você pode, a qualquer momento:</p>
      <ul>
        <li>confirmar se tratamos seus dados e acessá-los;</li>
        <li>corrigir dados incompletos ou desatualizados;</li>
        <li>pedir anonimização, bloqueio ou eliminação de dados desnecessários;</li>
        <li>pedir a portabilidade dos seus dados;</li>
        <li>excluir sua conta e seus dados (em Ajustes ou pelo e-mail abaixo);</li>
        <li>saber com quem compartilhamos seus dados;</li>
        <li>retirar o consentimento, quando ele for a base do tratamento;</li>
        <li>desconectar o WhatsApp e o Google Agenda em Ajustes.</li>
      </ul>
      <p>
        Para exercer seus direitos, escreva para <a href={`mailto:${CONTROLLER.email}`}>{CONTROLLER.email}</a>.
        Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>9. Segurança</h2>
      <p>
        Usamos conexão criptografada (HTTPS), senhas e tokens guardados de forma criptografada, regras que impedem um
        usuário de ver dados de outro e códigos de acesso de uso único. Se acontecer um incidente de segurança que
        possa causar risco ou dano relevante, avisaremos você e a ANPD.
      </p>

      <h2>10. Cookies</h2>
      <p>Usamos apenas cookies essenciais, para manter você conectado. Não usamos cookies de publicidade.</p>

      <h2>11. Menores de idade</h2>
      <p>O Aura Cronos é destinado a maiores de 18 anos.</p>

      <h2>12. Mudanças nesta política</h2>
      <p>
        Se esta política mudar de forma relevante, avisaremos no app e pedimos um novo aceite. A versão em vigor é a
        indicada no topo desta página.
      </p>
    </>
  );
}
