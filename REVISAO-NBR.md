# Revisão dos valores — ABNT NBR 5410:2004 (2ª ed.), Versão Corrigida:2008

Fonte única: **Tabela 36** — capacidades de condução de corrente (A), cobre, isolação PVC, 70 °C, ambiente 30 °C, **método B1**, colunas de 2 e 3 condutores carregados. Valores lidos do PDF enviado (Versão Corrigida de 17.03.2008).

Texto citado no site: “Valores conforme ABNT NBR 5410:2004, Versão Corrigida:2008, Tabela 36 (método B1, PVC, 2 condutores carregados).”

## 1. Capacidade de condução (Iz) — tabelas e scripts do site

| Arquivo / tabela | Seção | Valor antes | Valor conforme a norma | Origem | Situação |
|---|---|---|---|---|---|
| bitola-de-fios.html — tabela principal | 1,5 | 17,5 / 15,5 | 17,5 / 15,5 | Tabela 36, B1 | OK |
|  | 2,5 | 24 / 21 | 24 / 21 | Tabela 36, B1 | OK |
|  | 4 | 32 / 28 | 32 / 28 | Tabela 36, B1 | OK |
|  | 6 | 41 / 36 | 41 / 36 | Tabela 36, B1 | OK |
|  | 10 | 57 / 50 | 57 / 50 | Tabela 36, B1 | OK |
|  | 16 | 76 / 68 | 76 / 68 | Tabela 36, B1 | OK |
|  | 25 | 101 / 89 | 101 / 89 | Tabela 36, B1 | OK |
|  | 35 | 125 / **111** | 125 / **110** | Tabela 36, B1 | **Corrigido** (3 condutores: 111 → 110) |
|  | 50 | 151 / 134 | 151 / 134 | Tabela 36, B1 | OK |
| calculadora-bitola-cabo.html — vetor `c2`/`c3` | 1,5 a 95 | conforme o site | idem Tabela 36 | Tabela 36, B1 | 35 mm², 3 cond.: 111 → 110 (corrigido); demais OK |
| calculadora-disjuntor.html — vetor `iz` | 1,5 a 95 | conforme o site | idem Tabela 36 (2 cond.) | Tabela 36, B1 | OK (11 valores conferidos) |
| fio-e-disjuntor-ar-condicionado-12000-btu.html — `tab` | 1,5 a 95 | conforme o site | idem Tabela 36 (2 cond.) | Tabela 36, B1 | OK |
| fio-e-disjuntor-chuveiro-5500w.html — `tab` | 1,5 a 95 | conforme o site | idem Tabela 36 (2 cond.) | Tabela 36, B1 | OK |
| index.html — mini-tabela de bitolas | 1,5 | 15 A | 17,5 A (2 cond.) | Tabela 36, B1 | **Corrigido** |
|  | 2,5 | 21 A | 24 A (2 cond.) | Tabela 36, B1 | **Corrigido** |
|  | 4 | 32 A | 32 A | Tabela 36, B1 | OK |
|  | 6 | 41 A | 41 A | Tabela 36, B1 | OK |
|  | 10 | 50 A | 57 A (2 cond.) | Tabela 36, B1 | **Corrigido** |

Observação: as colunas de “Pot. 127 V / 220 V” da bitola-de-fios.html usam a coluna de 2 condutores (ex.: 125 A × 127 V = 15.875 W); conferido.

## 2. Tabelas de disjuntor — regra Ib ≤ In ≤ Iz

Iz = Tabela 36, B1, 2 condutores, da seção de fio indicada em cada linha. Páginas conferidas: index, disjuntores, ar-condicionado, chuveiro-eletrico, carregador-veiculo-eletrico, energia-solar, torneira-eletrica, fio-e-disjuntor-chuveiro-5500w.

**Linhas que violam a regra: nenhuma.**

Casos-limite (In = Iz; a regra permite a igualdade, mas sem folga):

| Página | Ib (A) | In (A) | Fio | Iz (A) |
|---|---|---|---|---|
| index.html — chuveiro 6.000 W | 27 | 32 | 4 mm² | 32 |
| disjuntores.html — chuveiro | 25 | 32 | 4 mm² | 32 |
| chuveiro-eletrico.html | 25 | 32 | 4 mm² | 32 |
| torneira-eletrica.html | 25,2 / 25 | 32 | 4 mm² | 32 |

Nota: a conferência só usa a Tabela 36. Fatores de correção (agrupamento, temperatura) e as demais condições de proteção contra sobrecarga da norma não foram avaliados.

## 3. Correntes dos equipamentos (220 V)

Conferido potência ÷ 220 V em index.html e disjuntores.html: todas as linhas batem (arredondamento de até 0,2 A, ex.: 6.000 W → 27,3 A mostrado como 27 A; 4.000 W → 18,2 A mostrado como 18 A).

## 4. Texto sobre tensão

O pedido sugeria “em 127 V as correntes são aproximadamente o dobro”. A razão exata é 220 ÷ 127 ≈ **1,73**, e as tabelas do site mostram isso (chuveiro 5.500 W: 25 A em 220 V, 43,3 A em 127 V). O texto publicado diz “cerca de 1,7 vez maiores”.

---

## Atualização de 27/10/2026

Base: arquivos do zip de 23/10 (já com a revisão acima) + `carregador-veiculo-eletrico.html` do commit de 26/10 (conteúdo mais novo). O site publicado ainda estava na versão anterior a 23/10.

**Conferido de novo contra o PDF (Tabela 36, B1, cobre, PVC):** vetores de `calculadora-bitola-cabo`, `calculadora-disjuntor`, `fio-e-disjuntor-chuveiro-5500w`, `fio-e-disjuntor-ar-condicionado-12000-btu` e a tabela de `bitola-de-fios`: 0 divergências.

**Corrigido**
- `carregador-veiculo-eletrico.html`: 22 kW trifásico, 40 A tripolar com 6 mm² violava Ib ≤ In ≤ Iz (Iz = 36 A com 3 condutores carregados); passou para **10 mm²** (Iz = 50 A). Nota "a conferir" trocada pela citação da NBR 5410:2004, Versão Corrigida:2008.
- `index.html`: rótulos da mini-tabela (6 mm² e 10 mm² não são "Ar-cond." nem "Trifásico"); alternador 127 V / 220 V na tabela de disjuntores (valores de 127 V calculados por Ib ≤ In ≤ Iz e nunca abaixo dos de 220 V); observação sobre o chuveiro de 6.000 W (4 mm², In = Iz = 32 A, sem folga); aviso de que a NBR 5410:2004 é a edição vigente e está em revisão; CTA do checklist grátis e do e-book; rodapé (checklist saiu de "Calculadoras", entrou "Lâmpadas").
- `<meta name="keywords">` removida de 13 páginas.
- Datas e `sitemap.xml` (home e carregador) atualizados para 27/10/2026.

**Não feito (pendente)**
- Home com 4 caminhos (Calcule/Aprenda/Consulte/Dimensione) e as 3 páginas SEO (dimensionar circuito residencial, dividir circuitos, quadro de distribuição): não existem no repositório.
- Texto de autoria/credenciais na página Sobre (depende de informação sua).

---

## Atualização de 27/10/2026 (parte 2): home com 4 caminhos e 3 páginas novas

**Novas páginas** (modelo das páginas "fio e disjuntor", com calculadora própria, FAQ, JSON-LD e carimbo editorial):
- `dimensionar-circuito-residencial.html`: 5 passos (Ib ≤ In ≤ Iz), Tabelas 36/40/42/47, queda de tensão 4% (6.2.7), 2 exemplos resolvidos e calculadora.
- `dividir-circuitos-residencial.html`: 4.2.5 e 9.5.2/9.5.3 (iluminação × tomadas, TUE > 10 A, cozinha/área de serviço, exceção de 16 A), exemplo de casa com 2 dormitórios e calculadora de carga mínima por cômodo.
- `quadro-de-distribuicao-residencial.html`: 6.5.4 (reserva, Tabela 59, identificação, advertência), 5.1.3.2.2 (DR), 5.4.2.1.1 (DPS), 9.5.4 e calculadora de posições.

**Home:** seção "Escolha o seu caminho" (Calcule / Aprenda / Consulte / Dimensione), links no rodapé ("Tabelas e guias"), "Veja também" em `disjuntores`, `bitola-de-fios` e `tomadas-padrao`, e as 3 URLs no `sitemap.xml`.

**Verificação:** todos os números das páginas novas foram conferidos no PDF da NBR 5410:2004 (Versão Corrigida 2008); as calculadoras foram testadas contra os exemplos; 0 links internos quebrados.

**Para decidir depois:** `calculadora-queda-tensao.html` e `como-calcular-queda-de-tensao.html` usam ρ = 0,0172 Ω·mm²/m (cobre a 20 °C). Com o cabo em carga (70 °C) a resistência é cerca de 20% maior, então a queda real fica ~20% acima do que o site mostra. As páginas novas usam o mesmo valor, por consistência, e avisam sobre a margem.

---

## Atualização de 28/10/2026: ajustes visuais

- `index.html`: removida a seção "Para ir além" (card do e-book com a capa); fica o banner "Quer dimensionar do zero" com checklist e e-book, agora com botões alinhados e do mesmo tamanho. Nota do cartão do topo (tabela bitola × corrente) reescrita: menor, discreta e dentro do cartão. Ícones nos 4 cartões "Escolha o seu caminho".
- `efeitos.css` / `efeitos.js` (v8): cartões dos caminhos com inclinação 3D, brilho que segue o mouse, filete que acende e setas que deslizam; links direcionais em grade com reflexo, barra lateral e seta em círculo; fundo de energia (partículas ligadas por fios e faísca ocasional, o mesmo do topo) em todas as seções de todas as páginas, que sobe de baixo ao entrar na tela e é liberado ao sair; filete de luz entre seções.
- O fundo de energia respeita "reduzir movimento", não é impresso e só roda nas seções visíveis (pausa com a aba oculta; canvas liberado ao sair da tela).
- Todas as páginas passaram a carregar `efeitos.css?v=8`, `efeitos.js?v=8` e `efeitos3d.js?v=8` para os navegadores baixarem a versão nova.
