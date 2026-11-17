/* Gera as páginas "Qual fio e disjuntor para <aparelho>" a partir dos dados abaixo e de nbr5410.js.
   Uso, na raiz do projeto:  node gerar-aparelhos.js
   Depois rode:              python3 atualizar-site.py <páginas geradas>  */
const fs = require('fs');
const N = require('./nbr5410.js');
const BASE = 'https://guiaeletricafacil.com.br/';
const MODELO = 'diferenca-tug-tue.html';

const APARELHOS = [
  { slug: 'chuveiro-6800w', nome: 'chuveiro de 6800 W', curto: 'Chuveiro 6800 W', p: 6800, v: [220], tipo: 'chuveiro' },
  { slug: 'chuveiro-7500w', nome: 'chuveiro de 7500 W', curto: 'Chuveiro 7500 W', p: 7500, v: [220], tipo: 'chuveiro' },
  { slug: 'chuveiro-7800w', nome: 'chuveiro de 7800 W', curto: 'Chuveiro 7800 W', p: 7800, v: [220], tipo: 'chuveiro' },
  { slug: 'ar-condicionado-9000-btu', nome: 'ar-condicionado de 9000 BTUs', curto: 'Ar-condicionado 9000 BTUs', p: 1000, v: [220, 127], tipo: 'ar', faixa: '850 a 1.000 W' },
  { slug: 'ar-condicionado-18000-btu', nome: 'ar-condicionado de 18000 BTUs', curto: 'Ar-condicionado 18000 BTUs', p: 1800, v: [220], tipo: 'ar', faixa: '1.600 a 1.900 W' },
  { slug: 'ar-condicionado-24000-btu', nome: 'ar-condicionado de 24000 BTUs', curto: 'Ar-condicionado 24000 BTUs', p: 2400, v: [220], tipo: 'ar', faixa: '2.200 a 2.600 W' },
  { slug: 'cooktop-inducao', nome: 'cooktop de indução de 4 bocas', curto: 'Cooktop de indução', p: 7200, v: [220], tipo: 'cooktop', faixa: '6.500 a 7.400 W' },
  { slug: 'forno-eletrico-embutir', nome: 'forno elétrico de embutir', curto: 'Forno elétrico de embutir', p: 3300, v: [220, 127], tipo: 'forno', faixa: '1.800 a 3.600 W' },
  { slug: 'micro-ondas', nome: 'micro-ondas', curto: 'Micro-ondas', p: 1400, v: [127, 220], tipo: 'microondas', faixa: '1.200 a 1.600 W (consumo, não a potência de cozimento)' },
  { slug: 'lava-loucas', nome: 'lava-louças', curto: 'Lava-louças', p: 1800, v: [127, 220], tipo: 'lavaloucas', faixa: '1.200 a 2.000 W' },
  { slug: 'air-fryer', nome: 'air fryer', curto: 'Air fryer', p: 1500, v: [127, 220], tipo: 'airfryer', faixa: '1.200 a 1.800 W' },
];

const CUIDADOS = {
  chuveiro: [
    ['Circuito exclusivo', 'O chuveiro tem corrente acima de 10 A e precisa de circuito só para ele (NBR 5410, item 9.5.3.1).'],
    ['DR de 30 mA obrigatório', 'Circuitos de banheiro exigem DR (item 5.1.3.2.2). Se o DR desarma ao ligar o chuveiro, troque por um modelo com resistência blindada; não retire o DR.'],
    ['Disjuntor bipolar em 220 V entre fases', 'Quando o 220 V vem de duas fases, o disjuntor deve desligar as duas.'],
    ['Conexão sem emenda de fita', 'Use conector apropriado para a corrente. Emenda mal feita é a causa mais comum de fio derretido no chuveiro.'],
  ],
  ar: [
    ['Use a etiqueta, não os BTUs', 'BTU mede capacidade de refrigeração. Para o fio vale a corrente nominal ou máxima da etiqueta da unidade externa.'],
    ['Disjuntor do manual, curva C', 'O compressor tem corrente de partida alta. Use o valor do manual, desde que não passe da capacidade do fio.'],
    ['Circuito próprio e terra', 'Os fabricantes pedem circuito próprio; a NBR 5410 o exige quando a corrente nominal passa de 10 A (item 9.5.3.1). Sempre com condutor de proteção.'],
  ],
  cooktop: [
    ['Ligação direta ou tomada adequada', 'Com mais de 30 A, o cooktop costuma ser ligado direto, sem plugue. Siga o manual.'],
    ['Circuito exclusivo', 'Corrente muito acima de 10 A: circuito só para o cooktop, com terra.'],
    ['DR de 30 mA', 'A cozinha exige DR nos seus circuitos (item 5.1.3.2.2). Prefira DR tipo A por causa da eletrônica de potência.'],
  ],
  forno: [
    ['Confira a potência na etiqueta', 'Fornos de embutir variam muito. Fornos com função micro-ondas ou grill somam potências.'],
    ['Circuito exclusivo acima de 10 A', 'Em 127 V quase todo forno passa de 10 A e precisa de circuito próprio.'],
    ['DR de 30 mA', 'Obrigatório nos circuitos da cozinha (item 5.1.3.2.2).'],
  ],
  microondas: [
    ['A potência da caixa é a de cozimento', 'Um micro-ondas "de 900 W" consome cerca de 1.400 W da rede. Use o consumo da etiqueta traseira.'],
    ['Tomada de 20 A em 127 V', 'Acima de 10 A o aparelho vem com plugue de 20 A (pino mais grosso), que só entra em tomada de 20 A.'],
    ['DR de 30 mA', 'Obrigatório nos circuitos de tomadas da cozinha.'],
  ],
  lavaloucas: [
    ['Ponto de água e tomada separados', 'A tomada deve ficar fora do alcance de respingos e vazamentos, normalmente no armário ao lado.'],
    ['Circuito próprio quando passa de 10 A', 'Em 127 V a corrente costuma passar de 10 A: circuito independente.'],
    ['DR de 30 mA', 'Obrigatório nos circuitos da cozinha.'],
  ],
  airfryer: [
    ['Plugue de 20 A', 'Acima de 1.270 W em 127 V a corrente passa de 10 A e o aparelho vem com plugue de 20 A. Não use adaptador para tomada de 10 A.'],
    ['Não divida com outro aparelho forte', 'Air fryer e micro-ondas no mesmo circuito de 127 V somam mais de 20 A e derrubam o disjuntor.'],
    ['Nada de benjamim ou extensão fina', 'Extensões comuns aguentam 10 A. A air fryer vai direto na tomada de 20 A.'],
  ],
};

const FAQ = {
  chuveiro: p => [
    [`Posso ligar chuveiro de ${p} W em 127 V?`, 'Chuveiros dessa potência são fabricados para 220 V. Em 127 V a corrente passaria de 50 A, com fio e disjuntor muito maiores.'],
    ['Por que o fio esquenta mesmo com o disjuntor certo?', 'Quase sempre é mau contato na emenda ou no borne do chuveiro. Troque a conexão; não aumente o disjuntor.'],
  ],
  ar: () => [
    ['Inverter muda o fio?', 'Não. O Inverter consome menos em média, mas o fio é dimensionado pela corrente máxima da etiqueta.'],
    ['Posso ligar na tomada da parede?', 'Só se for uma tomada de uso específico, em circuito exclusivo e com capacidade para a corrente do aparelho.'],
  ],
  cooktop: () => [
    ['Cooktop de indução precisa de 220 V?', 'Os modelos de 4 bocas são quase todos 220 V. Em 127 V a corrente passaria de 55 A.'],
    ['Posso usar o fio do antigo fogão?', 'Só se a seção atender a corrente do cooktop. Fogão a gás usa só uma tomada simples, com fio de 2,5 mm².'],
  ],
  forno: () => [['Forno e cooktop podem dividir o circuito?', 'Não. Cada um passa de 10 A e precisa de circuito próprio.']],
  microondas: () => [['Micro-ondas precisa de circuito exclusivo?', 'Em 127 V, sim, porque passa de 10 A. Em 220 V pode ficar num circuito de tomadas da cozinha, se a soma das cargas couber.']],
  lavaloucas: () => [['Lava-louças pode ficar na tomada da pia?', 'Pode, se o circuito for dimensionado para ela e a tomada for de 20 A quando a corrente passar de 10 A.']],
  airfryer: () => [['Por que a air fryer desarma o disjuntor?', 'Ela soma corrente com outros aparelhos do mesmo circuito. Ligue em tomada de circuito com folga ou crie um circuito para a bancada.']],
};

const br = (n, d = 1) => n.toFixed(d).replace('.', ',').replace(/,0+$/, '');
const mil = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const lmax = (ib, s, v) => Math.floor(0.04 * v * s / (2 * N.resistividade('cobre', 70) * ib));

function calcular(a, v) {
  const ib = N.corrente(a.p, v);
  const base = N.dimensionar(ib, { tipo: 'forca' });
  const agrup = [2, 3].map(c => N.dimensionar(ib, { tipo: 'forca', circuitos: c }));
  return { v, ib, base, agrup };
}

function corpo(a) {
  const r = a.v.map(v => calcular(a, v));
  const ar = a.tipo === 'ar';
  const principal = r[0];
  const resumo = r.map(x => `Em <strong>${x.v} V</strong> (${br(x.ib)} A): fio de <strong>${br(x.base.cabo.secao)} mm²</strong> e disjuntor ${ar ? `indicado no manual, curva C (até <strong>${br(x.base.cabo.iz, 0)} A</strong> com esse fio)` : `de <strong>${x.base.in} A</strong>`}${x.ib > 10 ? ', em circuito exclusivo' : ''}.`).join(' ');
  const faixa = a.faixa ? ` Potência elétrica típica: ${a.faixa}; usamos ${mil(a.p)} W.` : '';
  const linhas = r.map(x => `          <tr><td class="highlight" data-label="Tensão">${x.v} V</td><td data-label="Corrente">${br(x.ib)} A</td><td data-label="Fio mínimo">${br(x.base.cabo.secao)} mm²</td><td data-label="Disjuntor">${x.base.in} A</td><td data-label="Conferência">${br(x.ib)} ≤ ${x.base.in} ≤ ${br(x.base.cabo.iz)} A</td></tr>`).join('\n');
  const agrupL = r.map(x => `          <tr><td class="highlight" data-label="Tensão">${x.v} V</td><td data-label="Sozinho">${br(x.base.cabo.secao)} mm²</td><td data-label="2 circuitos">${br(x.agrup[0].cabo.secao)} mm²</td><td data-label="3 circuitos">${br(x.agrup[1].cabo.secao)} mm²</td></tr>`).join('\n');
  const distL = r.map(x => {
    const s = x.base.cabo.secao, i = N.TABELA36_B1.findIndex(l => l[0] === s), s2 = N.TABELA36_B1[i + 1][0];
    return `          <tr><td class="highlight" data-label="Tensão">${x.v} V</td><td data-label="Fio">${br(s)} mm²: até ${lmax(x.ib, s, x.v)} m</td><td data-label="Fio maior">${br(s2)} mm²: até ${lmax(x.ib, s2, x.v)} m</td></tr>`;
  }).join('\n');
  const notaAr = ar ? `\n      <div class="info-box"><h4>Disjuntor do ar-condicionado</h4><p>O cálculo direto dá ${principal.base.in} A, mas o compressor tem corrente de partida alta. Use o disjuntor indicado no manual (curva C). Com fio de ${br(principal.base.cabo.secao)} mm², qualquer disjuntor até ${br(principal.base.cabo.iz, 0)} A continua protegendo o fio. Se o manual pedir mais que isso, suba o fio.</p></div>` : '';
  const folga = principal.base.cabo.iz - principal.base.in < 1 && !ar ? `\n      <div class="warn-box"><h4>Sem folga</h4><p>Em ${principal.v} V o disjuntor de ${principal.base.in} A fica igual à capacidade do fio de ${br(principal.base.cabo.secao)} mm². Se o circuito passar junto com outros, em local quente ou for longo, use ${br(principal.agrup[0].cabo.secao)} mm².</p></div>` : '';
  const cuid = CUIDADOS[a.tipo].map(c => `        <div class="step"><h4>${c[0]}</h4><p>${c[1]}</p></div>`).join('\n');
  return `  <section>
    <div class="section-inner">
      <div class="answer">
        <h2>Resposta rápida</h2>
        <p>${resumo} Acima de 10 A a NBR 5410 pede circuito independente (item 9.5.3.1); sempre com fio terra.${faixa} Confira a corrente na etiqueta do seu aparelho.</p>
      </div>
    </div>
  </section>
  <section>
    <div class="section-inner">
      <h2>Fio e disjuntor para ${a.nome}</h2>
      <p class="section-note">Cobre, isolação PVC, eletroduto embutido em alvenaria (B1), 30 °C, circuito sozinho no eletroduto. ${N.EDICAO}, Tabelas 36 e 47.</p>
      <table class="full-table">
        <thead><tr><th>Tensão</th><th>Corrente</th><th>Fio mínimo</th><th>Disjuntor mínimo</th><th>Ib ≤ In ≤ Iz</th></tr></thead>
        <tbody>
${linhas}
        </tbody>
      </table>${notaAr}${folga}
      <h2 style="margin-top:40px">Se passar junto com outros circuitos</h2>
      <p class="section-note">Cabos agrupados no mesmo eletroduto conduzem menos corrente (Tabela 42: 0,80 para 2 circuitos, 0,70 para 3). Fio mínimo em cada caso:</p>
      <table class="full-table">
        <thead><tr><th>Tensão</th><th>Sozinho</th><th>2 circuitos</th><th>3 circuitos</th></tr></thead>
        <tbody>
${agrupL}
        </tbody>
      </table>
      <h2 style="margin-top:40px">Distância máxima do quadro</h2>
      <p class="section-note">Até onde a queda de tensão fica em 4% (item 6.2.7), com o cobre a 70 °C. Distância só de ida.</p>
      <table class="full-table">
        <thead><tr><th>Tensão</th><th>Fio mínimo</th><th>Um número acima</th></tr></thead>
        <tbody>
${distL}
        </tbody>
      </table>
    </div>
  </section>
  <section style="background:var(--surface)">
    <div class="section-inner">
      <h2>Calcule pela etiqueta</h2>
      <p class="section-note">Já vem com ${mil(a.p)} W em ${principal.v} V. Troque pela potência elétrica da etiqueta.</p>
      <div class="calc-mini" style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">
        <label style="display:flex;flex-direction:column;gap:6px;font-size:13px">Potência (W)<input id="ap" type="number" min="0" value="${a.p}" style="padding:10px;border-radius:6px;border:1px solid var(--border);background:var(--dark);color:var(--text);width:140px"></label>
        <label style="display:flex;flex-direction:column;gap:6px;font-size:13px">Tensão<select id="av" style="padding:10px;border-radius:6px;border:1px solid var(--border);background:var(--dark);color:var(--text)"><option value="127"${principal.v === 127 ? ' selected' : ''}>127 V</option><option value="220"${principal.v === 220 ? ' selected' : ''}>220 V</option></select></label>
        <label style="display:flex;flex-direction:column;gap:6px;font-size:13px">Circuitos no eletroduto<select id="ac" style="padding:10px;border-radius:6px;border:1px solid var(--border);background:var(--dark);color:var(--text)"><option>1</option><option>2</option><option>3</option></select></label>
      </div>
      <p id="ao" style="margin-top:16px;line-height:1.8" aria-live="polite"></p>
      <p style="font-size:13px;color:var(--muted)">Mais opções na <a href="/calculadora-disjuntor.html" style="color:var(--yellow)">calculadora de disjuntor</a> e na <a href="/calculadora-bitola-cabo.html" style="color:var(--yellow)">calculadora de bitola</a>.</p>
    </div>
  </section>
  <section>
    <div class="section-inner">
      <h2>Cuidados na instalação</h2>
${a.tipo === 'chuveiro' ? '<!--dx:ligacao-chuveiro--><!--/dx:ligacao-chuveiro-->\n' : ''}      <div class="steps">
${cuid}
      </div>
    </div>
  </section>
`;
}

const SCRIPT = `<script src="/nbr5410.js?v=1"></script>
<script>
(function(){
  var f=function(n){return String(Math.round(n*10)/10).replace('.',',');};
  function calc(){
    var p=parseFloat(document.getElementById('ap').value), v=parseFloat(document.getElementById('av').value), c=parseInt(document.getElementById('ac').value,10), o=document.getElementById('ao');
    if(!(p>0)){o.textContent='Informe a potência em watts.';return;}
    var ib=NBR5410.corrente(p,v), r=NBR5410.dimensionar(ib,{tipo:'forca',circuitos:c});
    if(!r||!r.cabo){o.textContent='Corrente acima do alcance desta ferramenta. Procure um profissional habilitado.';return;}
    o.innerHTML='Corrente: <strong>'+f(ib)+' A</strong> · Disjuntor mínimo: <strong>'+r.in+' A</strong> · Fio: <strong>'+f(r.cabo.secao)+' mm²</strong> (Iz '+f(r.cabo.iz)+' A)';
  }
  ['ap','av','ac'].forEach(function(id){document.getElementById(id).addEventListener('input',calc);});
  calc();
})();
</script>
`;

function montar({ slug, titulo, desc, crumb, h1, sub, corpoHtml, ld, script = '' }) {
  const m = fs.readFileSync(MODELO, 'utf8');
  let head = m.slice(0, m.indexOf('</head>'));
  const oldT = 'Diferença entre TUG e TUE nas Tomadas — Guia Elétrica Fácil';
  const oldD = head.match(/<meta name="description" content="([^"]*)"/)[1];
  head = head.split(oldT).join(titulo).split(oldD).join(desc).split(BASE + 'diferenca-tug-tue.html').join(BASE + slug)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '');
  head += ld.map(x => `<script type="application/ld+json">${JSON.stringify(x)}</script>\n`).join('');
  const meio = m.slice(m.indexOf('</head>'), m.indexOf('<main id="conteudo">'));
  const fim = m.slice(m.indexOf('</main>')).replace('</body>', script + '</body>');
  const main = `<main id="conteudo">
  <div class="page-hero">
    <p class="breadcrumb"><a href="/index.html">Início</a> → ${crumb}</p>
    <h1>${h1}</h1>
    <p class="page-sub">${sub}</p>
    <p style="font-size:13px;color:#888;margin-top:14px">Última revisão: <time datetime="2026-11-17">17 de novembro de 2026</time> · <a href="/sobre.html#metodologia" style="color:var(--yellow)">Como elaboramos este conteúdo</a></p>
  </div>
${corpoHtml}<!-- editorial-stamp --><aside></aside>`;
  fs.writeFileSync(slug, head + meio + main + fim);
}

const migalha = (itens) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [['Início', BASE]].concat(itens).map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) });

function pagina(a) {
  const slug = `fio-e-disjuntor-${a.slug}.html`;
  const r = a.v.map(v => calcular(a, v));
  const faq = FAQ[a.tipo](mil(a.p));
  const faqHtml = `  <section>\n    <div class="section-inner">\n      <h2>Perguntas frequentes</h2>\n${faq.map(([q, t]) => `      <div class="info-box" style="margin-top:12px"><h4>${q}</h4><p>${t}</p></div>`).join('\n')}\n      <p class="section-note" style="margin-top:24px">Outros aparelhos: <a href="/fio-e-disjuntor-por-aparelho.html" style="color:var(--yellow)">tabela de fio e disjuntor por aparelho</a>.</p>\n    </div>\n  </section>\n`;
  montar({
    slug,
    titulo: `Qual fio e disjuntor para ${a.nome}? — Guia Elétrica Fácil`,
    desc: `Fio e disjuntor para ${a.nome}: ` + r.map(x => `${x.v} V, ${br(x.ib)} A, ${br(x.base.cabo.secao)} mm² e ${x.base.in} A`).join('; ') + '. Com agrupamento, distância máxima e cuidados de instalação.',
    crumb: `<a href="/fio-e-disjuntor-por-aparelho.html">Por aparelho</a> → ${a.curto}`,
    h1: `Qual fio e disjuntor para <em>${a.nome}</em>?`,
    sub: 'Resposta direta pela NBR 5410, com o efeito do agrupamento de circuitos e a distância máxima até o quadro.',
    corpoHtml: corpo(a) + faqHtml,
    ld: [migalha([['Fio e disjuntor por aparelho', BASE + 'fio-e-disjuntor-por-aparelho.html'], [a.curto, BASE + slug]]),
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, t]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: t } })) }],
    script: SCRIPT,
  });
  return { slug, a, r };
}

// Página índice com todos os aparelhos (os existentes e os gerados)
function indice(geradas) {
  const extras = [
    ['fio-e-disjuntor-chuveiro-5500w.html', 'Chuveiro 5500 W', 5500, 220],
    ['fio-e-disjuntor-ar-condicionado-12000-btu.html', 'Ar-condicionado 12000 BTUs', 1200, 220, 'ar'],
    ['torneira-eletrica.html', 'Torneira elétrica 5500 W', 5500, 220],
    ['carregador-veiculo-eletrico.html', 'Carregador de carro elétrico 7,4 kW', 7400, 220],
  ];
  const itens = extras.concat(geradas.map(g => [g.slug, g.a.curto, g.a.p, g.a.v[0], g.a.tipo]))
    .map(([href, nome, p, v, tipo]) => { const ib = N.corrente(p, v), d = N.dimensionar(ib, { tipo: 'forca' }); return { href, nome, p, v, ib, d, tipo }; })
    .sort((x, y) => x.ib - y.ib);
  const rows = itens.map(i => `          <tr><td class="highlight" data-label="Aparelho"><a href="/${i.href}" style="color:var(--yellow)">${i.nome}</a></td><td data-label="Tensão">${i.v} V</td><td data-label="Corrente">${br(i.ib)} A</td><td data-label="Fio">${br(i.d.cabo.secao)} mm²</td><td data-label="Disjuntor">${i.tipo === 'ar' ? 'do manual, curva C (até ' + br(i.d.cabo.iz, 0) + ' A)' : i.d.in + ' A'}</td></tr>`).join('\n');
  return `  <section>
    <div class="section-inner">
      <div class="answer"><h2>Como ler a tabela</h2><p>Valores mínimos para o aparelho sozinho no circuito, com cobre, PVC, eletroduto embutido e 30 °C (${N.EDICAO}). Aparelhos acima de 10 A precisam de circuito exclusivo. Clique no aparelho para ver 127 V, agrupamento, distância máxima e cuidados.</p></div>
      <table class="full-table" style="margin-top:28px">
        <thead><tr><th>Aparelho</th><th>Tensão</th><th>Corrente</th><th>Fio mínimo</th><th>Disjuntor mínimo</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>
      <p class="section-note" style="margin-top:16px">Potências típicas. A corrente certa está na etiqueta do aparelho. Para outro valor, use a <a href="/calculadora-disjuntor.html" style="color:var(--yellow)">calculadora de disjuntor</a>.</p>
    </div>
  </section>
`;
}

const geradas = APARELHOS.map(pagina);
montar({
  slug: 'fio-e-disjuntor-por-aparelho.html',
  titulo: 'Fio e disjuntor por aparelho: tabela completa — Guia Elétrica Fácil',
  desc: 'Tabela de fio e disjuntor para chuveiro, ar-condicionado, cooktop de indução, forno, micro-ondas, air fryer, lava-louças e carregador, pela NBR 5410.',
  crumb: 'Fio e disjuntor por aparelho',
  h1: 'Fio e disjuntor <em>por aparelho</em>',
  sub: 'Corrente, fio mínimo e disjuntor dos aparelhos mais comuns da casa, em ordem de corrente.',
  corpoHtml: indice(geradas),
  ld: [migalha([['Fio e disjuntor por aparelho', BASE + 'fio-e-disjuntor-por-aparelho.html']])],
});
console.log(['fio-e-disjuntor-por-aparelho.html'].concat(geradas.map(g => g.slug)).join(' '));
