# Guia Elétrica Fácil

Tabelas, calculadoras e guias de elétrica residencial com base na ABNT NBR 5410:2004, Versão Corrigida:2008.
Publicado em <https://guiaeletricafacil.com.br> (GitHub Pages, site estático).

## Estrutura

| Arquivo | Função |
| --- | --- |
| `*.html` | Páginas do site (CSS específico de cada página fica inline) |
| `nbr5410.js` | **Fonte única** dos dados da norma (Tabelas 36, 40, 42 e 47, disjuntores, resistividade) e dos cálculos usados pelas calculadoras |
| `testes/nbr5410.test.js` | Testes dos cálculos e da coerência dos valores da Tabela 36 em todas as páginas |
| `ferramentas/atualizar-site.py` | Atualiza carimbo editorial, schema.org e `sitemap.xml` |
| `ferramentas/gerar-aparelhos.js` | Gera as páginas `fio-e-disjuntor-*.html` e o índice por aparelho a partir de `nbr5410.js` (para incluir um aparelho, acrescente uma linha em `APARELHOS`) |
| `projeto-casa.js` | Ferramenta Projeto elétrico da casa (cargas, circuitos, DR, fases, quadro, materiais) |
| `diagramas/` | Diagramas próprios em SVG |
| `efeitos.css` / `efeitos.js` | Visual compartilhado: menu mobile, animações, fundo de energia no topo, estilo dos textos das calculadoras |
| `fontes/` | Fontes Syne e DM Sans hospedadas no próprio site |
| `config-site.js` | Tarifa de referência, autor e contato |

## Rotina ao alterar o site

1. Valor da norma mudou? Altere só em `nbr5410.js`, rode `node ferramentas/gerar-aparelhos.js` e `node testes/nbr5410.test.js`. O teste falha se alguma página tiver um valor diferente.
2. Depois de editar páginas, rode `python3 ferramentas/atualizar-site.py pagina1.html pagina2.html` (as páginas alteradas recebem a data de hoje no carimbo, no schema e no sitemap).
3. Ao alterar `efeitos.css`, `efeitos.js` ou `nbr5410.js`, aumente o `?v=` nos links das páginas.
4. Página nova: copie uma página parecida, mantenha os links de `efeitos.css`/`efeitos.js`/`fontes.css` e rode o passo 2.

## Regras editoriais

- "Obrigatório" só aparece junto com o item da norma. Sem item, é "recomendado" ou "prática usual".
- Toda página cita a edição da norma usada.
- Revisor técnico (engenheiro eletricista com CREA): em contratação. Não informar revisor até estar formalizado.
- Registro público das revisões: seção "Registro de revisões" em `sobre.html`.
