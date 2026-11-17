/* Guia Elétrica Fácil — projeto elétrico residencial de referência (NBR 5410:2004, Versão Corrigida:2008).
   Previsão de cargas (9.5.2), divisão de circuitos (9.5.3), dimensionamento (nbr5410.js), DR (5.1.3.2.2),
   fases, quadro (Tabela 59) e materiais. Depende de /nbr5410.js. */
(function () {
  'use strict';
  var N = window.NBR5410;
  var $ = function (id) { return document.getElementById(id); };
  var CHAVE = 'gef-projeto-casa-v2';

  var TIPOS = {
    sala: { nome: 'Sala', molhado: false, dr: false },
    dormitorio: { nome: 'Dormitório', molhado: false, dr: false },
    cozinha: { nome: 'Cozinha / copa', molhado: true, dr: true, exclusivo: true },
    servico: { nome: 'Área de serviço / lavanderia', molhado: true, dr: true, exclusivo: true },
    banheiro: { nome: 'Banheiro', molhado: true, dr: true },
    varanda: { nome: 'Varanda', molhado: false, dr: false },
    garagem: { nome: 'Garagem', molhado: false, dr: true },
    externa: { nome: 'Área externa', molhado: false, dr: true },
    outro: { nome: 'Corredor, hall, escritório', molhado: false, dr: false }
  };
  // fn = tensão fase-neutro; ff = tensão entre fases disponível para TUE; fases = condutores fase
  var SISTEMAS = {
    mono127: { nome: 'Monofásico 127 V (fase + neutro)', fn: 127, ff: null, fases: ['A'] },
    bi127: { nome: 'Bifásico 127/220 V (2 fases + neutro)', fn: 127, ff: 220, fases: ['A', 'B'] },
    tri127: { nome: 'Trifásico 127/220 V', fn: 127, ff: 220, fases: ['A', 'B', 'C'] },
    mono220: { nome: 'Monofásico 220 V (rede 220/380 V)', fn: 220, ff: null, fases: ['A'] },
    tri220: { nome: 'Trifásico 220/380 V', fn: 220, ff: null, fases: ['A', 'B', 'C'] }
  };
  var EXEMPLO = {
    sistema: 'bi127', agrup: 2, limite: 15, comp: 12,
    comodos: [
      ['Sala', 'sala', 16, 16], ['Dormitório 1', 'dormitorio', 12, 14], ['Dormitório 2', 'dormitorio', 9, 12],
      ['Cozinha', 'cozinha', 9, 12], ['Área de serviço', 'servico', 4, 8], ['Banheiro', 'banheiro', 3.5, 7.6], ['Corredor', 'outro', 3, 8]
    ],
    equips: [['Chuveiro', 5500, 220, 10, 'm'], ['Ar-condicionado dormitório 1', 1200, 220, 14, 's'], ['Micro-ondas', 1400, 127, 12, 'm']]
  };

  var fmt = function (n, d) { return (d === undefined ? String(+n.toFixed(1)) : n.toFixed(d)).replace('.', ','); };
  var mil = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- previsão de cargas por cômodo (9.5.2) ---------- */
  function previsao(c) {
    var t = TIPOS[c.tipo], a = c.area, p = c.perim, n;
    var ilum = a <= 6 ? 100 : 100 + 60 * Math.floor((a - 6) / 4);
    if (c.tipo === 'banheiro') n = 1;
    else if (c.tipo === 'cozinha') n = Math.max(Math.ceil(p / 3.5 - 1e-9), 2);
    else if (c.tipo === 'servico') n = Math.max(Math.ceil(p / 3.5 - 1e-9), 1);
    else if (c.tipo === 'varanda' || c.tipo === 'externa') n = 1;
    else if (c.tipo === 'sala' || c.tipo === 'dormitorio') n = Math.max(Math.ceil(p / 5 - 1e-9), 1);
    else n = a <= 6 ? 1 : Math.ceil(p / 5 - 1e-9);
    var tug = t.molhado ? 600 * Math.min(n, 3) + 100 * Math.max(n - 3, 0) : 100 * n;
    return { ilum: ilum, n: n, tug: tug };
  }

  /* agrupa cargas em circuitos sem passar do limite de corrente */
  function agrupar(itens, v, limiteA) {
    var out = [], atual = null;
    itens.forEach(function (it) {
      if (!atual || (atual.va + it.va) / v > limiteA) { atual = { va: 0, partes: [], dr: false }; out.push(atual); }
      atual.va += it.va; atual.partes.push(it.nome); atual.dr = atual.dr || it.dr;
    });
    return out;
  }

  function calcular(d) {
    var sis = SISTEMAS[d.sistema], avisos = [];
    var prev = d.comodos.map(function (c) { var p = previsao(c); p.c = c; return p; });
    var circ = [];
    var add = function (o) { o.num = circ.length + 1; circ.push(o); };

    agrupar(prev.map(function (p) { return { nome: p.c.nome, va: p.ilum, dr: TIPOS[p.c.tipo].dr }; }), sis.fn, d.limite)
      .forEach(function (g) { add({ desc: 'Iluminação: ' + g.partes.join(', '), tipo: 'iluminacao', va: g.va, v: sis.fn, polos: 1, dr: g.dr, comp: d.comp }); });
    agrupar(prev.filter(function (p) { return TIPOS[p.c.tipo].exclusivo; }).map(function (p) { return { nome: p.c.nome + ' (' + p.n + ')', va: p.tug, dr: true }; }), sis.fn, d.limite)
      .forEach(function (g) { add({ desc: 'Tomadas: ' + g.partes.join(', '), tipo: 'forca', va: g.va, v: sis.fn, polos: 1, dr: true, comp: d.comp }); });
    agrupar(prev.filter(function (p) { return !TIPOS[p.c.tipo].exclusivo; }).map(function (p) { return { nome: p.c.nome + ' (' + p.n + ')', va: p.tug, dr: TIPOS[p.c.tipo].dr }; }), sis.fn, d.limite)
      .forEach(function (g) { add({ desc: 'Tomadas: ' + g.partes.join(', '), tipo: 'forca', va: g.va, v: sis.fn, polos: 1, dr: g.dr, comp: d.comp }); });
    d.equips.forEach(function (e) {
      var v = e.v, polos = 1;
      if (v !== sis.fn) {
        if (v === 220 && sis.ff === 220) polos = 2;
        else { avisos.push(e.nome + ': ' + v + ' V não existe neste fornecimento; calculado em ' + sis.fn + ' V.'); v = sis.fn; }
      }
      add({ desc: 'TUE: ' + e.nome, tipo: 'forca', va: e.p, v: v, polos: polos, dr: e.local === 'm', comp: e.comp || d.comp });
    });

    circ.forEach(function (c) {
      c.ib = c.va / c.v;
      c.r = N.dimensionar(c.ib, { tipo: c.tipo, circuitos: d.agrup, comprimento: c.comp, tensao: c.v });
      // circuitos de iluminação e tomadas: disjuntor mínimo usual de 10 A, se o fio permitir
      if (c.r && c.r.cabo && c.desc.indexOf('TUE') !== 0 && c.r.in < 10 && c.r.cabo.iz >= 10) c.r.in = 10;
      if (!c.r || !c.r.cabo) avisos.push('Circuito ' + c.num + ' (' + c.desc + '): corrente alta demais para esta ferramenta. Procure um engenheiro.');
      if (c.ib > 10 && c.desc.indexOf('TUE') === 0 && c.polos === 1 && sis.fn === 127 && c.va > 4000) avisos.push('Circuito ' + c.num + ': equipamento potente em 127 V; se possível, use 220 V.');
    });

    // balanceamento: maiores cargas primeiro, sempre na(s) fase(s) menos carregada(s)
    var carga = {}; sis.fases.forEach(function (f) { carga[f] = 0; });
    circ.slice().sort(function (a, b) { return b.va - a.va; }).forEach(function (c) {
      var ord = sis.fases.slice().sort(function (x, y) { return carga[x] - carga[y]; });
      c.fases = ord.slice(0, Math.min(c.polos, ord.length));
      c.fases.forEach(function (f) { carga[f] += c.va / c.fases.length; });
    });

    var n = circ.length, reserva = n <= 6 ? 2 : n <= 12 ? 3 : n <= 30 ? 4 : Math.ceil(0.15 * n - 1e-9);
    var polos = circ.reduce(function (s, c) { return s + c.polos; }, 0);
    var cabos = {}, disj = {};
    circ.forEach(function (c) {
      if (!c.r || !c.r.cabo) return;
      var s = c.r.cabo.secao, m = c.comp * 1.15;
      cabos[s] = cabos[s] || { fase: 0, neutro: 0, terra: 0 };
      cabos[s].fase += m * (c.polos === 2 ? 2 : 1);
      if (c.polos === 1) cabos[s].neutro += m;
      cabos[s].terra += m;
      var k = c.r.in + ' A ' + (c.polos === 2 ? 'bipolar' : 'unipolar');
      disj[k] = (disj[k] || 0) + 1;
    });
    var total = circ.reduce(function (s, c) { return s + c.va; }, 0);
    return { sis: sis, prev: prev, circ: circ, carga: carga, n: n, reserva: reserva, polos: polos, cabos: cabos, disj: disj, total: total, avisos: avisos };
  }

  /* ---------- interface ---------- */
  function linhaComodo(c) {
    var ops = Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '"' + (k === c[1] ? ' selected' : '') + '>' + TIPOS[k].nome + '</option>'; }).join('');
    return '<tr><td><input aria-label="Nome do cômodo" value="' + esc(c[0]) + '"></td><td><select aria-label="Tipo">' + ops + '</select></td>' +
      '<td><input aria-label="Área (m²)" type="number" min="0" step="0.1" value="' + c[2] + '"></td><td><input aria-label="Perímetro (m)" type="number" min="0" step="0.1" value="' + c[3] + '"></td>' +
      '<td><button type="button" class="proj-x" aria-label="Remover">×</button></td></tr>';
  }
  function linhaEquip(e) {
    return '<tr><td><input aria-label="Equipamento" value="' + esc(e[0]) + '"></td><td><input aria-label="Potência (W)" type="number" min="0" value="' + e[1] + '"></td>' +
      '<td><select aria-label="Tensão"><option' + (e[2] === 127 ? ' selected' : '') + '>127</option><option' + (e[2] === 220 ? ' selected' : '') + '>220</option></select></td>' +
      '<td><input aria-label="Distância ao quadro (m)" type="number" min="1" value="' + e[3] + '"></td>' +
      '<td><select aria-label="Local"><option value="s"' + (e[4] !== 'm' ? ' selected' : '') + '>Área seca</option><option value="m"' + (e[4] === 'm' ? ' selected' : '') + '>Banheiro, cozinha, serviço ou externa</option></select></td><td><button type="button" class="proj-x" aria-label="Remover">×</button></td></tr>';
  }
  function ler() {
    var num = function (el) { return parseFloat(el.value) || 0; };
    return {
      sistema: $('pSis').value, agrup: parseInt($('pAgr').value, 10), limite: num($('pLim')), comp: num($('pComp')) || 10,
      comodos: [].map.call($('pComodos').rows, function (r) { var i = r.querySelectorAll('input,select'); return { nome: i[0].value || 'Cômodo', tipo: i[1].value, area: num(i[2]), perim: num(i[3]) }; }).filter(function (c) { return c.area > 0 && c.perim > 0; }),
      equips: [].map.call($('pEquips').rows, function (r) { var i = r.querySelectorAll('input,select'); return { nome: i[0].value || 'Equipamento', p: num(i[1]), v: parseInt(i[2].value, 10), comp: num(i[3]), local: i[4].value }; }).filter(function (e) { return e.p > 0; })
    };
  }
  function guardar(d) {
    try { localStorage.setItem(CHAVE, JSON.stringify({ sistema: d.sistema, agrup: d.agrup, limite: d.limite, comp: d.comp,
      comodos: d.comodos.map(function (c) { return [c.nome, c.tipo, c.area, c.perim]; }), equips: d.equips.map(function (e) { return [e.nome, e.p, e.v, e.comp, e.local]; }) })); } catch (e) { /* armazenamento indisponível */ }
  }
  function carregar(d) {
    $('pSis').value = d.sistema; $('pAgr').value = d.agrup; $('pLim').value = d.limite; $('pComp').value = d.comp;
    $('pComodos').innerHTML = d.comodos.map(linhaComodo).join('');
    $('pEquips').innerHTML = d.equips.map(linhaEquip).join('');
  }

  function render() {
    var d = ler(); guardar(d);
    var o = $('pOut');
    if (!d.comodos.length) { o.innerHTML = '<p>Adicione pelo menos um cômodo com área e perímetro.</p>'; return; }
    var r = calcular(d);
    var h = '';
    if (r.avisos.length) h += '<div class="warn-box"><h4>Atenção</h4>' + r.avisos.map(function (a) { return '<p>' + esc(a) + '</p>'; }).join('') + '</div>';

    h += '<h3>1. Previsão de cargas (item 9.5.2)</h3><div class="proj-tab"><table class="full-table"><thead><tr><th>Cômodo</th><th>Iluminação</th><th>Tomadas (mín.)</th><th>Carga de tomadas</th></tr></thead><tbody>' +
      r.prev.map(function (p) { return '<tr><td>' + esc(p.c.nome) + '</td><td>' + p.ilum + ' VA</td><td>' + p.n + '</td><td>' + mil(p.tug) + ' VA</td></tr>'; }).join('') + '</tbody></table></div>';

    h += '<h3>2. Circuitos (item 9.5.3)</h3><p class="proj-nota">' + d.agrup + ' circuito(s) por eletroduto no pior trecho · cobre, PVC, B1, 30 °C · queda máx. 4% (6.2.7) · comprimento de ida.</p><div class="proj-tab"><table class="full-table"><thead><tr><th>Nº</th><th>Circuito</th><th>Carga</th><th>Tensão</th><th>Ib</th><th>Fio</th><th>Disjuntor</th><th>DR 30 mA</th><th>Fase</th><th>Queda</th></tr></thead><tbody>' +
      r.circ.map(function (c) {
        var ok = c.r && c.r.cabo;
        return '<tr><td>' + c.num + '</td><td>' + esc(c.desc) + '</td><td>' + mil(c.va) + ' VA</td><td>' + c.v + ' V</td><td>' + fmt(c.ib) + ' A</td>' +
          '<td>' + (ok ? fmt(c.r.cabo.secao) + ' mm²' + (c.r.cabo.secao > c.r.secaoPorCorrente ? ' <span title="aumentado pela queda de tensão">↑</span>' : '') : '—') + '</td>' +
          '<td>' + (ok ? c.r.in + ' A ' + (c.polos === 2 ? '2P' : '1P') + ' · ' + (c.tipo === 'iluminacao' ? 'B' : 'C') : '—') + '</td>' +
          '<td>' + (c.dr ? '<strong>Obrigatório</strong>' : 'Recomendado') + '</td><td>' + c.fases.join('+') + '</td><td>' + (ok && c.r.queda ? fmt(c.r.queda.pct) + '%' : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="proj-nota">↑ = seção aumentada por causa da queda de tensão. Curva: B para iluminação, C para tomadas e equipamentos. 1P/2P = unipolar/bipolar. Ar-condicionado e motores: use o disjuntor do manual, sem passar da capacidade do fio.</p>';

    var fases = Object.keys(r.carga);
    if (fases.length > 1) {
      var mx = Math.max.apply(null, fases.map(function (f) { return r.carga[f]; })), mn = Math.min.apply(null, fases.map(function (f) { return r.carga[f]; }));
      h += '<h3>3. Equilíbrio entre fases</h3><div class="proj-fases">' + fases.map(function (f) {
        return '<div><span>Fase ' + f + '</span><strong>' + mil(r.carga[f]) + ' VA</strong><i style="width:' + (100 * r.carga[f] / mx).toFixed(0) + '%"></i></div>'; }).join('') +
        '</div><p class="proj-nota">Diferença entre a fase mais e a menos carregada: ' + fmt(100 * (mx - mn) / mx, 0) + '%. Cargas 220 V entre fases dividem a potência entre as duas.</p>';
    }

    h += '<h3>' + (fases.length > 1 ? '4' : '3') + '. Quadro de distribuição</h3><ul class="proj-lista">' +
      '<li><strong>' + r.n + ' circuitos</strong> + reserva mínima de <strong>' + r.reserva + '</strong> (Tabela 59) → quadro para pelo menos <strong>' + (r.n + r.reserva) + ' circuitos</strong>, ocupando ' + r.polos + ' polos hoje.</li>' +
      '<li>Some o espaço do disjuntor geral, dos DRs e do DPS.</li>' +
      '<li><strong>DR de 30 mA</strong> obrigatório nos circuitos ' + r.circ.filter(function (c) { return c.dr; }).map(function (c) { return c.num; }).join(', ') + ' (item 5.1.3.2.2; em cozinha, serviço e garagem, pontos de iluminação a 2,50 m ou mais podem ficar fora). Um DR geral cobre todos; dividir em dois ou mais DRs evita que uma fuga desligue a casa inteira.</li>' +
      '<li><strong>DPS</strong> no quadro: veja quando é exigido no <a href="/quadro-de-distribuicao-residencial.html">guia do quadro</a> (item 5.4.2.1.1).</li></ul>';

    h += '<h3>' + (fases.length > 1 ? '5' : '4') + '. Lista de materiais (estimativa)</h3><div class="proj-cols"><div><h4>Disjuntores</h4><ul class="proj-lista">' +
      Object.keys(r.disj).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); }).map(function (k) { return '<li>' + r.disj[k] + ' × ' + k + '</li>'; }).join('') +
      '</ul></div><div><h4>Cabos (com 15% de sobra)</h4><ul class="proj-lista">' +
      Object.keys(r.cabos).sort(function (a, b) { return a - b; }).map(function (s) {
        var c = r.cabos[s];
        return '<li><strong>' + fmt(+s) + ' mm²</strong>: fase ' + Math.ceil(c.fase) + ' m' + (c.neutro ? ' · neutro (azul-claro) ' + Math.ceil(c.neutro) + ' m' : '') + ' · terra (verde-amarelo) ' + Math.ceil(c.terra) + ' m</li>'; }).join('') +
      '</ul></div></div>';

    h += '<div class="info-box"><h4>Potência instalada: ' + mil(r.total) + ' VA</h4><p>O disjuntor geral e o padrão de entrada dependem do cálculo de demanda e das regras da sua distribuidora de energia, que esta ferramenta não faz. Este resultado é um pré-projeto de referência: a execução precisa de profissional habilitado e, quando exigido, de ART.</p></div>';
    o.innerHTML = h;
  }

  function iniciar() {
    $('pSis').innerHTML = Object.keys(SISTEMAS).map(function (k) { return '<option value="' + k + '">' + SISTEMAS[k].nome + '</option>'; }).join('');
    var salvo = null;
    try { salvo = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { salvo = null; }
    carregar(salvo && salvo.comodos ? salvo : EXEMPLO);
    var form = $('pForm');
    form.addEventListener('input', render);
    form.addEventListener('change', render);
    form.addEventListener('click', function (e) {
      if (e.target.classList.contains('proj-x')) { e.target.closest('tr').remove(); render(); }
    });
    $('pAddC').addEventListener('click', function () { $('pComodos').insertAdjacentHTML('beforeend', linhaComodo(['Novo cômodo', 'dormitorio', 9, 12])); render(); });
    $('pAddE').addEventListener('click', function () { $('pEquips').insertAdjacentHTML('beforeend', linhaEquip(['Novo equipamento', 1500, 220, 10, 's'])); render(); });
    $('pEx').addEventListener('click', function () { carregar(EXEMPLO); render(); });
    $('pPrint').addEventListener('click', function () { window.print(); });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  window.GEFProjeto = { calcular: calcular, previsao: previsao };
})();
