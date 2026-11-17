/* Testes dos cálculos e da coerência dos valores da NBR 5410 no site.
   Rodar na raiz do projeto: node nbr5410.test.js */
const fs = require('fs'), path = require('path'), assert = require('assert');
const N = require('./nbr5410.js');
const raiz = __dirname;
let ok = 0;
function t(nome, fn) { fn(); ok++; console.log('ok -', nome); }
const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

t('corrente: chuveiro 5.500 W em 220 V = 25 A', () => assert(perto(N.corrente(5500, 220), 25)));
t('corrente trifásica: 10 kW em 380 V = 15,19 A', () => assert(perto(N.corrente(10000, 380, { trifasico: true }), 15.19)));
t('chuveiro 5.500 W/220 V: 25 A, 4 mm²', () => { const r = N.dimensionar(25, { tipo: 'forca' }); assert.strictEqual(r.in, 25); assert.strictEqual(r.cabo.secao, 4); });
t('chuveiro 5.500 W/127 V: 50 A, 10 mm²', () => { const r = N.dimensionar(N.corrente(5500, 127), { tipo: 'forca' }); assert.strictEqual(r.in, 50); assert.strictEqual(r.cabo.secao, 10); });
t('seção mínima de força: 10 A pede 2,5 mm², não 1,5', () => assert.strictEqual(N.escolherSecao(10, { tipo: 'forca' }).secao, 2.5));
t('iluminação 10 A: 1,5 mm²', () => assert.strictEqual(N.escolherSecao(10, { tipo: 'iluminacao' }).secao, 1.5));
t('agrupamento 3 circuitos: 20 A pede 4 mm² (24 × 0,70 = 16,8 A)', () => assert.strictEqual(N.escolherSecao(20, { circuitos: 3 }).secao, 4));
t('temperatura 40 °C: 2,5 mm² vale 20,88 A', () => assert(perto(N.escolherSecao(20, { temperatura: 40 }).iz, 20.88)));
t('3 condutores carregados: 35 mm² = 110 A', () => assert.strictEqual(N.TABELA36_B1[7][2], 110));
t('ρ do cobre a 70 °C ≈ 0,0206', () => assert(perto(N.resistividade('cobre', 70), 0.0206, 0.0002)));
t('queda: 25 A, 20 m, 4 mm², 220 V, 70 °C ≈ 2,34 %', () => assert(perto(N.quedaTensao({ corrente: 25, comprimento: 20, secao: 4, tensao: 220 }).pct, 2.34)));
t('queda aumenta a seção quando passa de 4 %', () => { const r = N.dimensionar(20, { tipo: 'forca', comprimento: 60, tensao: 127 }); assert(r.cabo.secao > 2.5 && r.queda.pct <= 4); });

// Coerência: vetores de Iz copiados em páginas antigas precisam bater com a Tabela 36 deste arquivo.
const iz2 = new Map(N.TABELA36_B1.map(l => [l[0], l[1]]));
t('páginas: pares [seção, Iz] iguais à Tabela 36', () => {
  const erros = [];
  for (const f of fs.readdirSync(raiz).filter(f => f.endsWith('.html'))) {
    const s = fs.readFileSync(path.join(raiz, f), 'utf8');
    for (const m of s.matchAll(/\[\s*(1\.5|2\.5|4|6|10|16|25|35|50|70|95)\s*,\s*(\d+(?:\.\d+)?)\s*\]/g)) {
      if (iz2.get(+m[1]) !== +m[2]) erros.push(`${f}: [${m[1]}, ${m[2]}]`);
    }
    for (const m of s.matchAll(/\{\s*secao:\s*([\d.]+)\s*,\s*(?:iz|c2):\s*([\d.]+)/g)) {
      if (iz2.get(+m[1]) !== +m[2]) erros.push(`${f}: secao ${m[1]} → ${m[2]}`);
    }
  }
  assert.deepStrictEqual(erros, []);
});
console.log(`\n${ok} testes passaram.`);
