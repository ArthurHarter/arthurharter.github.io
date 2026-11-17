/* Guia Elétrica Fácil — dados e cálculos de referência da ABNT NBR 5410:2004, Versão Corrigida:2008.
   Fonte única: todas as calculadoras leem daqui. Ao corrigir um valor, rode `node nbr5410.test.js`. */
(function (root) {
  'use strict';

  var EDICAO = 'ABNT NBR 5410:2004, Versão Corrigida:2008';

  // Tabela 36 — cobre, isolação PVC (70 °C), ambiente 30 °C, método de referência B1.
  // [seção mm², Iz com 2 condutores carregados (A), Iz com 3 condutores carregados (A)]
  var TABELA36_B1 = [
    [1.5, 17.5, 15.5], [2.5, 24, 21], [4, 32, 28], [6, 41, 36], [10, 57, 50], [16, 76, 68],
    [25, 101, 89], [35, 125, 110], [50, 151, 134], [70, 192, 171], [95, 232, 207]
  ];

  // Tabela 40 — fator de correção de temperatura ambiente, isolação PVC (linhas não subterrâneas).
  var FATOR_TEMPERATURA_PVC = { 10: 1.22, 15: 1.17, 20: 1.12, 25: 1.06, 30: 1, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71, 55: 0.61, 60: 0.5 };

  // Tabela 42 — fator de agrupamento, condutores em feixe (ao ar livre ou em eletroduto), item 1. Índice = nº de circuitos.
  var FATOR_AGRUPAMENTO = [null, 1, 0.8, 0.7, 0.65, 0.6, 0.57, 0.54, 0.52, 0.5];

  // Tabela 47 — seção mínima de condutores de cobre em instalações fixas com cabos isolados.
  var SECAO_MINIMA = { iluminacao: 1.5, forca: 2.5 };

  var DISJUNTORES = [6, 10, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125];

  // Resistividade (Ω·mm²/m) a 20 °C e coeficiente de temperatura (1/°C).
  var MATERIAL = { cobre: { rho20: 0.017241, alfa: 0.00393 }, aluminio: { rho20: 0.028264, alfa: 0.00403 } };

  function resistividade(material, tempC) {
    var m = MATERIAL[material] || MATERIAL.cobre;
    return m.rho20 * (1 + m.alfa * ((tempC === undefined ? 70 : tempC) - 20));
  }

  function corrente(potenciaW, tensaoV, opc) {
    opc = opc || {};
    var fp = opc.fp || 1;
    return opc.trifasico ? potenciaW / (Math.sqrt(3) * tensaoV * fp) : potenciaW / (tensaoV * fp);
  }

  /* Escolhe a menor seção que atende Iz corrigido ≥ alvo e a seção mínima do tipo de circuito.
     opc: { condutores: 2|3, temperatura: °C, circuitos: n, tipo: 'forca'|'iluminacao' } */
  function escolherSecao(alvoA, opc) {
    opc = opc || {};
    var col = opc.condutores === 3 ? 2 : 1;
    var ft = FATOR_TEMPERATURA_PVC[opc.temperatura === undefined ? 30 : opc.temperatura];
    var fa = FATOR_AGRUPAMENTO[opc.circuitos || 1];
    var smin = SECAO_MINIMA[opc.tipo] || 0;
    if (!ft || !fa) return null;
    for (var i = 0; i < TABELA36_B1.length; i++) {
      var l = TABELA36_B1[i], iz = l[col] * ft * fa;
      if (l[0] >= smin && iz >= alvoA) return { secao: l[0], izTabela: l[col], iz: iz, ft: ft, fa: fa, porMinimo: i > 0 && l[0] === smin && TABELA36_B1[i - 1][col] * ft * fa >= alvoA };
    }
    return null;
  }

  // Menor disjuntor comercial com In ≥ Ib.
  function escolherDisjuntor(ibA) {
    for (var i = 0; i < DISJUNTORES.length; i++) if (DISJUNTORES[i] >= ibA) return DISJUNTORES[i];
    return null;
  }

  /* Dimensiona um circuito: Ib ≤ In ≤ Iz, seção mínima e, se houver comprimento, queda ≤ limite. */
  function dimensionar(ibA, opc) {
    opc = opc || {};
    var inn = escolherDisjuntor(ibA);
    if (!inn) return null;
    var cabo = escolherSecao(inn, opc);
    if (!cabo) return { ib: ibA, in: inn, cabo: null };
    var res = { ib: ibA, in: inn, cabo: cabo, secaoPorCorrente: cabo.secao };
    if (opc.comprimento > 0 && opc.tensao > 0) {
      var lim = opc.limiteQueda || 4, idx = indice(cabo.secao);
      res.queda = quedaTensao({ corrente: ibA, comprimento: opc.comprimento, secao: cabo.secao, tensao: opc.tensao, trifasico: opc.trifasico });
      while (res.queda.pct > lim && idx < TABELA36_B1.length - 1) {
        idx++;
        res.queda = quedaTensao({ corrente: ibA, comprimento: opc.comprimento, secao: TABELA36_B1[idx][0], tensao: opc.tensao, trifasico: opc.trifasico });
      }
      if (TABELA36_B1[idx][0] !== cabo.secao) {
        var col = opc.condutores === 3 ? 2 : 1;
        res.cabo = { secao: TABELA36_B1[idx][0], izTabela: TABELA36_B1[idx][col], iz: TABELA36_B1[idx][col] * cabo.ft * cabo.fa, ft: cabo.ft, fa: cabo.fa };
      }
    }
    return res;
  }

  function indice(secao) {
    for (var i = 0; i < TABELA36_B1.length; i++) if (TABELA36_B1[i][0] === secao) return i;
    return -1;
  }

  /* Queda de tensão em circuito monofásico/bifásico (2 condutores) ou trifásico equilibrado, cos φ = 1.
     p: { corrente, comprimento (m, só ida), secao (mm²), tensao (V), trifasico, material, temperatura (°C, padrão 70) } */
  function quedaTensao(p) {
    var rho = resistividade(p.material || 'cobre', p.temperatura);
    var k = p.trifasico ? Math.sqrt(3) : 2;
    var v = k * rho * p.comprimento * p.corrente / p.secao;
    return { volts: v, pct: v / p.tensao * 100, rho: rho, k: k };
  }

  var API = {
    EDICAO: EDICAO, TABELA36_B1: TABELA36_B1, FATOR_TEMPERATURA_PVC: FATOR_TEMPERATURA_PVC,
    FATOR_AGRUPAMENTO: FATOR_AGRUPAMENTO, SECAO_MINIMA: SECAO_MINIMA, DISJUNTORES: DISJUNTORES,
    resistividade: resistividade, corrente: corrente, escolherSecao: escolherSecao,
    escolherDisjuntor: escolherDisjuntor, dimensionar: dimensionar, quedaTensao: quedaTensao
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.NBR5410 = Object.freeze(API);
})(this);
