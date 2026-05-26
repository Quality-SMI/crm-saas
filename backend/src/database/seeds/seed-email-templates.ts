import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: 'crm',
  entities: [path.resolve(__dirname, '../../**/*.entity{.ts,.js}')],
  synchronize: false,
});

const templates = [
  {
    name: 'Newsletter Mensal',
    subject: '📰 Novidades de [Mês] — Fique por dentro',
    preview_text:
      'Confira as principais novidades e dicas do mês para o seu negócio.',
    category: 'newsletter',
    html_body: `<h1>Novidades do Mês</h1>
<p>Olá! Chegou mais uma edição da nossa newsletter com as principais atualizações, tendências e dicas para impulsionar o seu negócio no mundo digital.</p>

<hr />

<h2>🔍 SEO em Alta</h2>
<p>O Google continua atualizando seus algoritmos com foco em <strong>experiência do usuário</strong> e <strong>conteúdo de qualidade</strong>. Alguns pontos de atenção este mês:</p>
<ul>
  <li>Core Web Vitals seguem sendo fator de ranqueamento</li>
  <li>E-E-A-T (Expertise, Experience, Authoritativeness, Trustworthiness) mais relevante</li>
  <li>Busca por voz e IA ganhando espaço nas SERPs</li>
</ul>

<h2>📈 Resultados que Importam</h2>
<p>Nossos clientes estão alcançando resultados expressivos com estratégias de marketing digital bem estruturadas. Entre em contato para saber como podemos ajudar o seu negócio a crescer também.</p>

<h2>💡 Dica do Mês</h2>
<blockquote>Revise regularmente as suas palavras-chave e compare com o volume de busca atual. O comportamento do consumidor muda, e sua estratégia deve acompanhar.</blockquote>

<hr />

<p>Até a próxima edição! Se tiver dúvidas ou quiser conversar sobre estratégias para o seu negócio, responda este e-mail.</p>
<p><strong>Equipe Quality SMI</strong></p>`,
  },

  {
    name: 'Apresentação de Serviços',
    subject:
      'Como a Quality SMI pode transformar a presença digital do seu negócio',
    preview_text:
      'Conheça nossas soluções em SEO, marketing de conteúdo e visibilidade digital.',
    category: 'apresentacao',
    html_body: `<h1>Transforme a presença digital do seu negócio</h1>
<p>Olá! Somos a <strong>Quality SMI</strong>, especialistas em marketing digital com foco em resultados mensuráveis. Gostaríamos de apresentar como podemos ajudar o seu negócio a crescer de forma sustentável na internet.</p>

<h2>🚀 Nossos Serviços</h2>

<h3>SEO — Posicionamento Orgânico</h3>
<p>Colocamos seu site nas primeiras posições do Google para as palavras-chave que seus clientes realmente buscam. Mais visibilidade, mais visitas, mais vendas — sem depender só de anúncios pagos.</p>

<h3>Marketing de Conteúdo</h3>
<p>Criamos conteúdo estratégico que educa, engaja e converte. Artigos de blog, páginas otimizadas e materiais que posicionam sua marca como referência no segmento.</p>

<h3>IA Visibility</h3>
<p>Monitoramos como sua empresa é citada em ferramentas de inteligência artificial como ChatGPT, Gemini e Perplexity — um diferencial competitivo cada vez mais importante.</p>

<hr />

<h2>Por que escolher a Quality SMI?</h2>
<ul>
  <li>✅ Resultados comprovados com clientes de diversos segmentos</li>
  <li>✅ Relatórios mensais transparentes e detalhados</li>
  <li>✅ Equipe especializada e dedicada ao seu crescimento</li>
  <li>✅ Estratégias personalizadas para o seu negócio</li>
</ul>

<p>Que tal agendarmos uma <strong>conversa sem compromisso</strong> para entender os seus objetivos e mostrar como podemos ajudar?</p>
<p>Responda este e-mail ou entre em contato pelo WhatsApp. Ficamos à disposição!</p>
<p><strong>Equipe Quality SMI</strong></p>`,
  },

  {
    name: 'Boas-vindas ao Cliente',
    subject: 'Bem-vindo à Quality SMI — próximos passos',
    preview_text:
      'Estamos muito felizes em ter você como cliente. Veja o que acontece agora.',
    category: 'transacional',
    html_body: `<h1>Bem-vindo à Quality SMI! 🎉</h1>
<p>Ficamos muito felizes em ter você como cliente. A partir de agora, nossa equipe está totalmente dedicada ao crescimento da presença digital do seu negócio.</p>

<h2>O que acontece agora?</h2>
<ol>
  <li><strong>Kickoff estratégico</strong> — Nossa equipe entrará em contato em até 24 horas para agendar a reunião inicial e alinhar objetivos.</li>
  <li><strong>Auditoria completa</strong> — Faremos uma análise aprofundada do seu site, palavras-chave e concorrência.</li>
  <li><strong>Plano de ação</strong> — Com base na auditoria, elaboraremos um plano personalizado com metas claras.</li>
  <li><strong>Execução e acompanhamento</strong> — Começamos a implementação e você recebe relatórios mensais de progresso.</li>
</ol>

<h2>Seu contato na Quality SMI</h2>
<p>Você terá um gerente de conta dedicado que será seu ponto de contato para dúvidas, atualizações e estratégia. Apresentaremos nossa equipe na reunião de kickoff.</p>

<blockquote>Nosso compromisso é com resultados reais e transparência total. Você sempre saberá o que está sendo feito e por quê.</blockquote>

<p>Se tiver qualquer dúvida antes da reunião, responda este e-mail. Estamos à disposição!</p>
<p><strong>Equipe Quality SMI</strong></p>`,
  },

  {
    name: 'Reengajamento de Leads',
    subject: 'Ainda pensa em crescer no digital? Temos algo para você',
    preview_text:
      'Conversamos um tempo atrás — gostaríamos de retomar o contato com uma proposta especial.',
    category: 'reengajamento',
    html_body: `<h1>Ainda está buscando crescer no digital?</h1>
<p>Olá! Lembro que conversamos há algum tempo sobre as possibilidades de marketing digital para o seu negócio. Entendemos que o momento pode não ter sido o ideal, mas gostaríamos de retomar o contato.</p>

<h2>O que mudou desde então?</h2>
<p>O marketing digital evoluiu muito e as oportunidades para negócios que investem em presença online são maiores do que nunca:</p>
<ul>
  <li>SEO orgânico continua sendo o canal com melhor ROI a longo prazo</li>
  <li>A IA está transformando como as pessoas buscam informações — e as marcas precisam estar presentes</li>
  <li>Empresas que apostaram em conteúdo estão colhendo resultados expressivos</li>
</ul>

<h2>Uma proposta especial para você</h2>
<p>Para retomarmos nossa conversa, gostaríamos de oferecer uma <strong>auditoria de SEO gratuita</strong> do seu site — sem compromisso. Você verá exatamente onde estão as oportunidades de crescimento.</p>

<p>Basta responder este e-mail com "quero a auditoria" e nossa equipe entrará em contato para agendar.</p>

<blockquote>Às vezes, o melhor momento para plantar era ontem. O segundo melhor momento é agora.</blockquote>

<p>Aguardamos seu retorno!</p>
<p><strong>Equipe Quality SMI</strong></p>`,
  },

  {
    name: 'Relatório de Resultados',
    subject: '📊 Relatório de Performance — [Mês/Ano]',
    preview_text:
      'Confira os resultados alcançados este mês e o que planejamos para o próximo período.',
    category: 'relatorio',
    html_body: `<h1>Relatório de Performance — [Mês/Ano]</h1>
<p>Olá! Chegou o momento de compartilhar os resultados do mês e o planejamento para o próximo período. Como sempre, nosso compromisso é com a transparência total.</p>

<h2>📈 Destaques do Mês</h2>
<ul>
  <li><strong>Visitas orgânicas:</strong> [número] (+[%] em relação ao mês anterior)</li>
  <li><strong>Palavras-chave no Top 10:</strong> [número] (+[número] novas posições)</li>
  <li><strong>Leads gerados:</strong> [número]</li>
  <li><strong>Taxa de conversão:</strong> [%]</li>
</ul>

<h2>🎯 Principais Conquistas</h2>
<p>Este mês conseguimos resultados importantes que merecem destaque:</p>
<ol>
  <li>[Conquista 1 — ex: "Palavra-chave X entrou no Top 3"]</li>
  <li>[Conquista 2 — ex: "Página Y atingiu recorde de visitas"]</li>
  <li>[Conquista 3 — ex: "Novo artigo gerou X leads"]</li>
</ol>

<h2>🔄 O que está em andamento</h2>
<p>Para o próximo mês, nosso foco será:</p>
<ul>
  <li>[Ação 1]</li>
  <li>[Ação 2]</li>
  <li>[Ação 3]</li>
</ul>

<hr />

<p>O relatório completo com todos os dados detalhados está disponível em nossa plataforma. Qualquer dúvida, estamos à disposição para uma call de alinhamento.</p>
<p><strong>Equipe Quality SMI</strong></p>`,
  },

  {
    name: 'Promoção / Oferta Especial',
    subject: '⚡ Oferta especial por tempo limitado — não perca!',
    preview_text:
      'Preparamos uma condição exclusiva para você iniciar sua jornada no marketing digital.',
    category: 'promocao',
    html_body: `<h1>Oferta especial por tempo limitado ⚡</h1>
<p>Preparamos uma condição exclusiva para você dar o próximo passo no marketing digital do seu negócio. Essa oportunidade é válida somente até o final deste mês.</p>

<h2>O que está incluso</h2>
<ul>
  <li>✅ Auditoria completa de SEO (valor: R$ 800)</li>
  <li>✅ Diagnóstico de palavras-chave com maior potencial</li>
  <li>✅ Análise dos top 3 concorrentes</li>
  <li>✅ Plano de ação personalizado para os próximos 90 dias</li>
  <li>✅ Reunião de apresentação dos resultados</li>
</ul>

<h2>Condição especial</h2>
<blockquote>Para novos clientes que fecharem até o final do mês, <strong>isentamos a taxa de setup</strong> e iniciamos em até 5 dias úteis.</blockquote>

<p>Esta oferta é válida enquanto temos vagas disponíveis em nossa agenda. Nossa equipe é pequena e dedicada, por isso limitamos o número de novos clientes por mês.</p>

<h2>Como aproveitar</h2>
<p>Responda este e-mail com a palavra <strong>"QUERO"</strong> e um de nossos consultores entrará em contato em até 2 horas úteis para explicar todos os detalhes.</p>

<p>Não perca essa oportunidade de transformar a presença digital do seu negócio!</p>
<p><strong>Equipe Quality SMI</strong></p>`,
  },
];

async function seedEmailTemplates() {
  await dataSource.initialize();
  console.log('🌱 Inserindo templates de email...\n');

  let inserted = 0;
  let skipped = 0;

  for (const t of templates) {
    const existing = await dataSource.query(
      `SELECT id FROM crm.email_templates WHERE name = $1 AND deleted_at IS NULL`,
      [t.name],
    );

    if (existing.length) {
      console.log(`  ⏭  Já existe: ${t.name}`);
      skipped++;
      continue;
    }

    await dataSource.query(
      `INSERT INTO crm.email_templates (name, subject, preview_text, html_body, category)
       VALUES ($1, $2, $3, $4, $5)`,
      [t.name, t.subject, t.preview_text, t.html_body, t.category],
    );
    console.log(`  ✓ Criado: ${t.name} [${t.category}]`);
    inserted++;
  }

  console.log(
    `\n✅ Concluído! ${inserted} templates inseridos, ${skipped} já existiam.`,
  );
  await dataSource.destroy();
}

seedEmailTemplates().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
