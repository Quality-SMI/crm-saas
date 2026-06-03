import { MigrationInterface, QueryRunner } from 'typeorm';

// Paleta Quality SMI
// Laranja principal: #e36420
// Azul escuro: #1a2332
// Texto: #374151  Título: #111827  Fundo: #f3f4f6

const HEADER = `
<div style="background:#ffffff;padding:28px 32px 20px;border-bottom:4px solid #e36420;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="margin-bottom:10px;">
    <span style="font-size:30px;font-weight:900;color:#e36420;letter-spacing:-0.5px;">Quality</span><span style="font-size:30px;font-weight:900;color:#1a2332;letter-spacing:-0.5px;">SMI</span>
    <div style="font-size:10px;color:#9ca3af;font-weight:400;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Sistema de Marketing para Internet</div>
  </div>
  <div>
    <span style="display:inline-block;background:#4285F4;border-radius:4px;padding:3px 10px;font-size:10px;color:#fff;font-weight:700;margin:0 3px;">Google Partner</span>
    <span style="display:inline-block;background:#0866FF;border-radius:4px;padding:3px 10px;font-size:10px;color:#fff;font-weight:700;margin:0 3px;">Meta Partner</span>
    <span style="display:inline-block;background:#e36420;border-radius:4px;padding:3px 10px;font-size:10px;color:#fff;font-weight:700;margin:0 3px;">+10 Anos</span>
  </div>
</div>`;

const FOOTER = `
<div style="background:#f9fafb;padding:24px 32px;border-top:1px solid #e5e7eb;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#9ca3af;">
  <p style="margin:0 0 6px;font-weight:700;color:#6b7280;font-size:13px;">Quality SMI — Sistema de Marketing para Internet</p>
  <p style="margin:0 0 4px;">
    <span style="display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:3px;padding:2px 6px;font-size:10px;color:#6b7280;font-weight:600;margin:0 2px;">Google Partner</span>
    <span style="display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:3px;padding:2px 6px;font-size:10px;color:#6b7280;font-weight:600;margin:0 2px;">Meta Partner</span>
    <span style="display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:3px;padding:2px 6px;font-size:10px;color:#6b7280;font-weight:600;margin:0 2px;">+10 Anos de Mercado</span>
  </p>
  <p style="margin:6px 0 0;font-size:11px;">Atuando no Brasil, EUA e China</p>
</div>`;

function wrapTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f4f6;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
<tr><td>${HEADER}</td></tr>
<tr><td style="padding:36px 32px;color:#374151;font-size:15px;line-height:1.75;">
<style>
  h1{font-size:26px;font-weight:800;color:#111827;margin:0 0 18px;line-height:1.3}
  h2{font-size:19px;font-weight:700;color:#1a2332;margin:28px 0 12px;line-height:1.4;border-left:3px solid #e36420;padding-left:12px}
  h3{font-size:16px;font-weight:600;color:#374151;margin:20px 0 8px}
  p{margin:0 0 16px;color:#374151}
  ul,ol{margin:0 0 16px;padding-left:22px;color:#374151}
  li{margin-bottom:8px}
  a{color:#e36420;text-decoration:none}
  strong{color:#111827}
  .badge{display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:20px;padding:4px 12px;font-size:12px;color:#374151;font-weight:600;margin:0 4px 4px 0}
  .highlight{background:#fff8f0;border:1px solid #fde8d0;border-radius:8px;padding:16px;margin:16px 0}
  .check{color:#16a34a;font-weight:700}
  .cross{color:#dc2626;font-weight:700}
  .warn{color:#d97706;font-weight:700}
  .cta-btn{display:inline-block;background:#e36420;color:#ffffff!important;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.2px;margin:8px 0}
  .cta-secondary{display:inline-block;background:#1a2332;color:#ffffff!important;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:8px 0}
  .stat-box{display:inline-block;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;margin:4px;text-align:center;min-width:100px}
  .stat-num{font-size:28px;font-weight:800;color:#e36420;display:block}
  .stat-label{font-size:11px;color:#9ca3af;font-weight:500;text-transform:uppercase;letter-spacing:0.5px}
</style>
${content}
</td></tr>
<tr><td>${FOOTER}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    name: 'SEO + GEO — Análise Gratuita do Seu Site',
    subject: 'Analisamos o site da {empresa} — veja o que encontramos',
    preview_text: 'Fizemos uma análise técnica gratuita. Os resultados podem surpreender.',
    category: 'prospeccao_seo',
    html_body: wrapTemplate(`
<h1>Fizemos uma análise gratuita do site da {empresa} 🔍</h1>

<p>Olá,</p>

<p>Nossa equipe realizou uma análise técnica completa de <strong>{site}</strong> — sem custo, sem compromisso. Queremos compartilhar o que encontramos porque acreditamos que toda empresa merece estar visível online.</p>

<h2>O que verificamos</h2>

<p>Avaliamos os principais fatores que determinam se um site aparece (ou não) no Google e nas novas plataformas de inteligência artificial:</p>

<ul>
  <li><strong>SEO On-Page</strong> — título, meta description, H1, estrutura de conteúdo</li>
  <li><strong>Saúde técnica</strong> — HTTPS, velocidade, compatibilidade mobile</li>
  <li><strong>GEO — Visibilidade em IAs</strong> — presença no ChatGPT, Google Gemini e Perplexity</li>
  <li><strong>Autoridade de domínio</strong> — como o Google enxerga seu site hoje</li>
</ul>

<div class="highlight">
  <strong>💡 Por que isso importa?</strong><br>
  Mais de 40% das pesquisas de serviços B2B agora começam em plataformas de IA — não no Google. Empresas que já aparecem no ChatGPT e Gemini capturam esses clientes antes mesmo da busca tradicional.
</div>

<h2>O que a Quality SMI pode fazer pela {empresa}</h2>

<p>Com mais de <strong>10 anos de experiência</strong> e presença em Brasil, EUA e China, desenvolvemos tecnologias proprietárias para:</p>

<ul>
  <li>🎯 Otimizar seu site para aparecer nas respostas de IAs (estratégia GEO)</li>
  <li>📈 Escalar posicionamento no Google com SEO técnico avançado</li>
  <li>📊 Monitorar sua visibilidade em tempo real em todas as plataformas</li>
  <li>🤖 Automatizar a criação de conteúdo relevante para buscadores e IAs</li>
</ul>

<p style="text-align:center;margin:28px 0">
  <a href="https://wa.me/5511978344567" class="cta-btn">Ver resultados completos da análise</a>
</p>
<p style="text-align:center;margin:0">
  <a href="https://wa.me/5511978344567" class="cta-secondary">Agendar consultoria gratuita de 30min</a>
</p>

<p style="margin-top:28px">Atenciosamente,<br><strong>Equipe Quality SMI</strong></p>
`),
  },

  {
    name: 'GEO — Sua Empresa no ChatGPT e Gemini',
    subject: '{empresa}: seus concorrentes já aparecem no ChatGPT. E você?',
    preview_text: 'O próximo cliente pode estar perguntando para uma IA agora. Você aparece?',
    category: 'prospeccao_geo',
    html_body: wrapTemplate(`
<h1>O próximo cliente da {empresa} pode estar perguntando ao ChatGPT agora 🤖</h1>

<p>Olá,</p>

<p>Analisamos a presença da <strong>{empresa}</strong> nos principais sistemas de inteligência artificial usados hoje — ChatGPT, Google Gemini, Perplexity e Microsoft Copilot.</p>

<p>Esta nova categoria de visibilidade digital se chama <strong>GEO (Generative Engine Optimization)</strong>, e está silenciosamente redefinindo como os clientes descobrem fornecedores.</p>

<h2>Por que o GEO mudou tudo</h2>

<p>Quando alguém pergunta ao ChatGPT <em>"Qual a melhor empresa de [seu segmento] em [sua cidade]?"</em>, a IA responde com base em dados públicos do seu site — ou do seu concorrente.</p>

<div class="highlight">
  <strong>📊 Dado de mercado (2024):</strong><br>
  40% das pesquisas de produtos e serviços B2B já começam em plataformas de IA.<br>
  Empresas otimizadas para GEO recebem entre 2x e 5x mais menções nessas plataformas.
</div>

<h2>Nossa abordagem exclusiva</h2>

<p>Como <strong>Google Partner</strong> e <strong>Meta Partner</strong>, com mais de <strong>10 anos de atuação</strong> no Brasil, EUA e China, a Quality SMI desenvolveu uma metodologia própria que combina:</p>

<ul>
  <li>🧠 <strong>Otimização semântica</strong> — estrutura de conteúdo que IAs reconhecem e citam</li>
  <li>📡 <strong>Schema Markup avançado</strong> — dados estruturados que aumentam visibilidade em IAs</li>
  <li>🔍 <strong>Monitoramento GEO</strong> — rastreamento diário da sua presença em 5+ plataformas de IA</li>
  <li>⚡ <strong>SEO técnico integrado</strong> — base sólida que sustenta toda estratégia de IA</li>
</ul>

<h2>Resultados de clientes atuais</h2>

<p>Empresas que implementaram nossa estratégia GEO em 2024 viram:</p>

<p style="text-align:center;padding:8px 0">
  <span class="stat-box"><span class="stat-num">3,2x</span><span class="stat-label">mais menções em IAs</span></span>
  <span class="stat-box"><span class="stat-num">47%</span><span class="stat-label">↑ tráfego orgânico</span></span>
  <span class="stat-box"><span class="stat-num">+28%</span><span class="stat-label">leads qualificados</span></span>
</p>

<p style="text-align:center;margin:28px 0">
  <a href="https://wa.me/5511978344567" class="cta-btn">Quero aparecer nas IAs também</a>
</p>
<p style="text-align:center;font-size:13px;color:#9ca3af;margin:8px 0">Consultoria gratuita — sem compromisso</p>

<p style="margin-top:28px">Atenciosamente,<br><strong>Equipe Quality SMI</strong></p>
`),
  },

  {
    name: 'SEO Técnico — Problemas que Custam Clientes',
    subject: 'Encontramos falhas no {site} que estão bloqueando seus clientes',
    preview_text: 'Cada erro técnico de SEO é um cliente que vai para o concorrente.',
    category: 'prospeccao_seo',
    html_body: wrapTemplate(`
<h1>Erros técnicos de SEO estão custando clientes à {empresa} 📉</h1>

<p>Olá,</p>

<p>Analisamos <strong>{site}</strong> usando as mesmas ferramentas que o Google utiliza para ranquear sites. O que encontramos é comum em 73% das empresas que nunca passaram por uma auditoria técnica — e tem solução.</p>

<h2>As 5 falhas de SEO mais comuns que encontramos</h2>

<ol>
  <li>
    <strong>Meta tags ausentes ou mal configuradas</strong><br>
    <span style="color:#6b7280;font-size:13px">O Google não consegue entender do que se trata seu site. Resultado: ranqueamento genérico, sem relevância para buscas do seu público.</span>
  </li>
  <li>
    <strong>Site não otimizado para mobile</strong><br>
    <span style="color:#6b7280;font-size:13px">O Google indexa primeiro a versão mobile. Se o site desanda no celular, perde posições em todos os dispositivos.</span>
  </li>
  <li>
    <strong>Velocidade de carregamento acima de 3 segundos</strong><br>
    <span style="color:#6b7280;font-size:13px">53% dos usuários abandonam páginas que demoram mais de 3s. Isso aumenta a taxa de rejeição e sinaliza ao Google que o site é ruim.</span>
  </li>
  <li>
    <strong>Conteúdo não estruturado para IAs</strong><br>
    <span style="color:#6b7280;font-size:13px">Sem Schema Markup e estrutura semântica adequada, as IAs ignoram seu site nas respostas — mesmo que você apareça no Google.</span>
  </li>
  <li>
    <strong>Ausência de estratégia de link building</strong><br>
    <span style="color:#6b7280;font-size:13px">Sites sem autoridade de domínio ficam permanentemente nas páginas 2 e 3 do Google, onde ninguém chega.</span>
  </li>
</ol>

<div class="highlight">
  <strong>🔧 Boa notícia:</strong> todos esses problemas são corrigíveis. Nossa equipe técnica já resolveu situações idênticas em centenas de empresas — com resultados mensuráveis em 30 a 90 dias.
</div>

<h2>Por que a Quality SMI</h2>

<p>Somos <strong>Google Partner</strong> e <strong>Meta Partner</strong> certificados, com mais de <strong>10 anos</strong> de histórico comprovado em SEO técnico, conteúdo e performance digital. Atendemos empresas no Brasil, EUA e China.</p>

<p>Nossa equipe é treinada diretamente pelos programas de certificação do Google — o que significa que aplicamos as melhores práticas antes mesmo de virarem padrão de mercado.</p>

<p style="text-align:center;margin:28px 0">
  <a href="https://wa.me/5511978344567" class="cta-btn">Quero corrigir meu SEO agora</a>
</p>
<p style="text-align:center;font-size:13px;color:#9ca3af;margin:8px 0">Análise completa + plano de ação em 30 minutos</p>

<p style="margin-top:28px">Atenciosamente,<br><strong>Equipe Quality SMI</strong></p>
`),
  },

  {
    name: 'Credenciais Quality SMI — Google & Meta Partner',
    subject: 'Quality SMI: +10 anos, Google Partner, e por que isso importa para a {empresa}',
    preview_text: 'Não é todo mundo que pode dizer que é parceiro certificado do Google e da Meta.',
    category: 'prospeccao_autoridade',
    html_body: wrapTemplate(`
<h1>Quem é a Quality SMI e por que você deveria se importar 🏆</h1>

<p>Olá,</p>

<p>Você vai receber muitas propostas de agências digitais. Então por que conversar com a Quality SMI?</p>

<h2>Credenciais que poucos têm</h2>

<p>Somos uma das poucas empresas brasileiras com a tríade completa:</p>

<p style="text-align:center;padding:8px 0">
  <span class="stat-box"><span class="stat-num" style="font-size:20px">✅</span><span class="stat-label">Google Partner</span></span>
  <span class="stat-box"><span class="stat-num" style="font-size:20px">✅</span><span class="stat-label">Meta Partner</span></span>
  <span class="stat-box"><span class="stat-num" style="font-size:20px">✅</span><span class="stat-label">+10 Anos</span></span>
</p>

<p>Essas certificações não são automáticas. Exigem histórico comprovado de resultados, volume mínimo de investimento gerenciado e aprovação direta pelo Google e pela Meta.</p>

<h2>O que isso significa na prática</h2>

<ul>
  <li>🎯 <strong>Acesso antecipado</strong> a novos recursos do Google Ads e Google Search antes do mercado</li>
  <li>📞 <strong>Suporte direto</strong> com gerentes de conta do Google — sem fila, sem chatbot</li>
  <li>🔬 <strong>Beta de tecnologias</strong> — testamos funcionalidades meses antes do lançamento oficial</li>
  <li>📈 <strong>Benchmarks exclusivos</strong> — dados de performance de todas as indústrias para comparar sua situação</li>
</ul>

<h2>+10 anos. Brasil, EUA e China.</h2>

<p>Desde que fundamos a Quality SMI, já trabalhamos com empresas no:</p>

<p>
  🇧🇷 <strong>Brasil</strong> &nbsp;|&nbsp;
  🇺🇸 <strong>EUA</strong> &nbsp;|&nbsp;
  🇨🇳 <strong>China</strong>
</p>

<p>Essa experiência internacional nos deu uma perspectiva única sobre o que funciona — e o que não funciona — em mercados altamente competitivos.</p>

<h2>SEO + GEO: nossa especialidade atual</h2>

<p>Hoje, nosso maior diferencial é a combinação de <strong>SEO técnico avançado</strong> com <strong>GEO (Generative Engine Optimization)</strong> — a disciplina de otimizar sua presença não apenas no Google, mas nas IAs que seus clientes já usam: ChatGPT, Google Gemini, Perplexity e Microsoft Copilot.</p>

<div class="highlight">
  <strong>Analisamos o site da {empresa}</strong> e gostaríamos de apresentar um diagnóstico personalizado com oportunidades específicas para o seu mercado.
</div>

<p style="text-align:center;margin:28px 0">
  <a href="https://wa.me/5511978344567" class="cta-btn">Agendar diagnóstico gratuito</a>
</p>
<p style="text-align:center;font-size:13px;color:#9ca3af;margin:8px 0">30 minutos — sem compromisso — com especialista certificado Google</p>

<p style="margin-top:28px">Atenciosamente,<br><strong>Equipe Quality SMI</strong></p>
`),
  },

  {
    name: 'SEO + GEO — Follow-up: Resultados Que Provamos',
    subject: 'Re: análise do {site} — números reais de clientes parecidos com vocês',
    preview_text: 'Casos reais de empresas que dobraram seu tráfego em 90 dias com SEO + GEO.',
    category: 'prospeccao_followup',
    html_body: wrapTemplate(`
<h1>Empresas como a {empresa} que transformaram presença digital em resultado 📊</h1>

<p>Olá,</p>

<p>Enviamos recentemente a análise técnica do <strong>{site}</strong>. Gostaríamos de complementar com casos reais de empresas que passaram pelo mesmo processo e os resultados que alcançaram.</p>

<h2>O que acontece quando SEO e GEO trabalham juntos</h2>

<div class="highlight">
  <strong>Case 1 — Empresa de serviços B2B (segmento similar ao de vocês)</strong><br>
  <ul style="margin:10px 0 0">
    <li>Situação inicial: 3ª página do Google, zero menções em IAs</li>
    <li>Após 60 dias: 1ª página para 12 palavras-chave estratégicas</li>
    <li>Após 90 dias: mencionada no ChatGPT e Gemini para 8 queries do setor</li>
    <li><strong>Resultado:</strong> +67% de leads orgânicos, -34% de custo por aquisição</li>
  </ul>
</div>

<div class="highlight">
  <strong>Case 2 — E-commerce nacional</strong><br>
  <ul style="margin:10px 0 0">
    <li>Situação inicial: site técnico com múltiplos erros, sem estratégia de conteúdo</li>
    <li>Após 45 dias (apenas correções técnicas): +43% de impressões no Google Search Console</li>
    <li>Após 6 meses: receita orgânica triplicou</li>
    <li><strong>Resultado:</strong> ROI de 8:1 sobre o investimento em SEO</li>
  </ul>
</div>

<h2>Nossa metodologia em 3 etapas</h2>

<ol>
  <li>
    <strong>Diagnóstico completo (30 dias)</strong><br>
    <span style="color:#6b7280;font-size:13px">Auditoria técnica SEO, análise de presença GEO, benchmarking competitivo e identificação das oportunidades de maior impacto.</span>
  </li>
  <li>
    <strong>Implementação estruturada (30–90 dias)</strong><br>
    <span style="color:#6b7280;font-size:13px">Correções técnicas, otimização de conteúdo, Schema Markup, link building e estrutura semântica para IAs.</span>
  </li>
  <li>
    <strong>Monitoramento e escala (contínuo)</strong><br>
    <span style="color:#6b7280;font-size:13px">Dashboard em tempo real com todas métricas — posições Google, menções em IAs, tráfego, conversões.</span>
  </li>
</ol>

<h2>Por que agir agora</h2>

<p>O mercado de GEO está em fase de adoção inicial. Empresas que otimizarem sua presença em IAs <strong>nos próximos 12 meses</strong> terão uma vantagem competitiva difícil de alcançar depois — assim como aconteceu com SEO nos anos 2000.</p>

<p>Como <strong>Google Partner</strong> e <strong>Meta Partner</strong> com mais de <strong>10 anos no mercado</strong>, a Quality SMI está na posição ideal para guiar essa transição.</p>

<p style="text-align:center;margin:28px 0">
  <a href="https://wa.me/5511978344567" class="cta-btn">Quero ver o plano para a {empresa}</a>
</p>
<p style="text-align:center;font-size:13px;color:#9ca3af;margin:8px 0">Apresentação personalizada baseada na análise do seu site</p>

<p style="margin-top:28px">Atenciosamente,<br><strong>Equipe Quality SMI</strong></p>
`),
  },

  {
    name: 'GEO — Comparativo: Antes e Depois da Otimização',
    subject: 'Antes e depois: o que muda quando sua empresa aparece nas IAs',
    preview_text: 'Visualize exatamente como sua empresa pode aparecer no ChatGPT e Gemini.',
    category: 'prospeccao_geo',
    html_body: wrapTemplate(`
<h1>Antes e depois: como a {empresa} aparece nas IAs hoje — e como poderia aparecer 🤖</h1>

<p>Olá,</p>

<p>Quando um potencial cliente pergunta ao ChatGPT <em>"qual empresa de [seu segmento] você recomenda em [sua cidade]?"</em>, o que ele vê?</p>

<p>Analisamos a presença de <strong>{site}</strong> nas principais plataformas de IA. O resultado mostra uma oportunidade real e ainda pouco explorada.</p>

<h2>Como as IAs escolhem quem mencionar</h2>

<p>Os modelos de linguagem como ChatGPT e Gemini citam empresas com base em:</p>

<ul>
  <li><strong>Autoridade digital</strong> — sites com boa reputação online têm mais chances de ser citados</li>
  <li><strong>Estrutura de conteúdo</strong> — páginas com dados estruturados (Schema Markup) são melhor interpretadas</li>
  <li><strong>Presença em fontes confiáveis</strong> — menções em portais, notícias e diretórios aumentam visibilidade</li>
  <li><strong>Conteúdo semântico</strong> — textos que respondem perguntas específicas do setor são priorizados</li>
</ul>

<h2>O que mudamos nos clientes que otimizamos para GEO</h2>

<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
  <tr style="background:#1a2332;color:#fff">
    <td style="padding:10px 14px;font-weight:600">Fator</td>
    <td style="padding:10px 14px;font-weight:600;text-align:center">Antes</td>
    <td style="padding:10px 14px;font-weight:600;text-align:center">Após GEO</td>
  </tr>
  <tr style="background:#f9fafb">
    <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">Menções no ChatGPT</td>
    <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #e5e7eb"><span class="cross">0</span></td>
    <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #e5e7eb"><span class="check">8–15/mês</span></td>
  </tr>
  <tr>
    <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">Presença no Gemini</td>
    <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #e5e7eb"><span class="cross">Não aparece</span></td>
    <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #e5e7eb"><span class="check">Top 3 respostas</span></td>
  </tr>
  <tr style="background:#f9fafb">
    <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">Tráfego orgânico</td>
    <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #e5e7eb"><span class="warn">Estagnado</span></td>
    <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #e5e7eb"><span class="check">+47% em 90 dias</span></td>
  </tr>
  <tr>
    <td style="padding:10px 14px">Leads qualificados</td>
    <td style="padding:10px 14px;text-align:center"><span class="warn">Depende de ads</span></td>
    <td style="padding:10px 14px;text-align:center"><span class="check">Orgânico crescente</span></td>
  </tr>
</table>

<div class="highlight">
  <strong>O momento certo é agora.</strong> O mercado de GEO ainda está em fase inicial no Brasil. Empresas que agirem nos próximos 6–12 meses vão ocupar posições que os concorrentes vão demorar anos para conquistar.
</div>

<h2>Nossa proposta para a {empresa}</h2>

<p>Com base na análise que fizemos do <strong>{site}</strong>, podemos apresentar em 30 minutos:</p>

<ul>
  <li>🎯 Diagnóstico completo de GEO + SEO do seu site</li>
  <li>📊 Análise dos seus 3 principais concorrentes nas IAs</li>
  <li>🗺️ Roadmap personalizado de 90 dias para ganhar visibilidade</li>
  <li>💰 Estimativa de ROI baseada em empresas do seu segmento</li>
</ul>

<p>Tudo isso como <strong>Google Partner</strong> e <strong>Meta Partner</strong>, com mais de <strong>10 anos de resultados comprovados</strong> no Brasil e no exterior.</p>

<p style="text-align:center;margin:28px 0">
  <a href="https://wa.me/5511978344567" class="cta-btn">Quero o diagnóstico GEO + SEO gratuito</a>
</p>

<p style="margin-top:28px">Atenciosamente,<br><strong>Equipe Quality SMI</strong></p>
`),
  },
];

export class InsertSeoGeoEmailTemplates1748000017000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    for (const tpl of TEMPLATES) {
      await queryRunner.query(
        `INSERT INTO crm.email_templates (id, name, subject, preview_text, html_body, category, created_at, updated_at)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [tpl.name, tpl.subject, tpl.preview_text, tpl.html_body, tpl.category],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM crm.email_templates WHERE category IN ('prospeccao_seo','prospeccao_geo','prospeccao_autoridade','prospeccao_followup')`,
    );
  }
}
