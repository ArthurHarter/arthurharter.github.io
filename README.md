# eletrica-facil

⚡ Site de tabelas técnicas de elétrica residencial — bitola de fios, disjuntores, consumo de eletrodomésticos e guias práticos baseados na NBR 5410.

Publicado em <https://guiaeletricafacil.com.br> (GitHub Pages, site estático).

## Estrutura

| Arquivo | Função |
| --- | --- |
| `*.html` | Páginas do site (CSS específico de cada página fica inline) |
| `efeitos.css` | Camada visual compartilhada: acabamento, menu mobile, animações de entrada, efeitos de energia |
| `efeitos.js` | Interface compartilhada: menu mobile, link "pular para o conteúdo", voltar ao topo, barra de progresso, animações |
| `efeitos3d.js` | Carro elétrico 3D (canvas, sem bibliotecas) e fagulhas do hero — só carrega em `index.html` e `carregador-veiculo-eletrico.html` |
| `404.html` | Página de erro personalizada |
| `site.webmanifest` | Metadados do site para celulares |
| `og-image.png` | Imagem de compartilhamento (WhatsApp, redes sociais, Google Discover) |
| `sitemap.xml`, `robots.txt`, `ads.txt` | SEO e anúncios |

## Observações

- Ao alterar `efeitos.css`, `efeitos.js` ou `efeitos3d.js`, aumente o número em `?v=` nos links das páginas para o navegador não usar a versão antiga em cache.
- Os efeitos respeitam `prefers-reduced-motion` (quem desativa animações no aparelho não vê movimento).
- Novas páginas devem ter o par de links `efeitos.css` / `efeitos.js` antes de `</head>` e entrar no `sitemap.xml`.
