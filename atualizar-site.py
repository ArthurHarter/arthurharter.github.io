"""Atualiza carimbo editorial, dados estruturados (schema.org) e sitemap.xml de todas as páginas.

Uso, na raiz do projeto:
    python3 atualizar-site.py pagina-alterada.html outra.html
As páginas informadas recebem a data de hoje; as demais mantêm a data que já tinham.
"""
import datetime, glob, json, os, re, sys

BASE = 'https://guiaeletricafacil.com.br/'
AUTOR = 'Arthur Barbosa Harter'
NBR = 'ABNT NBR 5410:2004, Versão Corrigida:2008 (edição vigente)'
IGNORAR = {'404.html', 'googleaaee2b92365fe048.html'}
SEM_SCHEMA = {'privacidade.html', 'contato.html', 'ofertas.html', 'index.html'}
REFS = {
    'calculadora-resistores.html': 'eletrônica básica (lei de Ohm, associação de resistores)',
    'calculadora-codigo-cores-resistores.html': 'código de cores conforme IEC 60062',
    'calculadora-capacitores.html': 'eletrônica básica (associação de capacitores e reatância)',
    'carregador-veiculo-eletrico.html': NBR + ' e ABNT NBR 17019:2022',
    'energia-solar.html': NBR + ' e ABNT NBR 16690:2019',
    'calculadora-lampadas.html': NBR + ' e ABNT NBR ISO/CIE 8995-1:2013',
    'tomadas-padrao.html': NBR + ' e ABNT NBR 9050:2015 (Emenda 1:2020)',
    'blog.html': 'fontes indicadas em cada notícia',
    'calculadora-consumo.html': 'tarifas homologadas pela ANEEL',
    'consumo-eletrico.html': 'tarifas homologadas pela ANEEL e potências típicas de fabricantes',
}
MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']


def datas_da_pagina(s, lastmod):
    achadas = [lastmod] if lastmod else []
    achadas += re.findall(r'<time datetime="(\d{4}-\d{2}-\d{2})"', s)
    achadas += ['%s-%s-%s' % (a, m, d) for d, m, a in re.findall(r'Atualizado em: (\d\d)/(\d\d)/(\d{4})', s)]
    return max(achadas) if achadas else '2026-10-23'


def main(alteradas):
    hoje = datetime.date.today().isoformat()
    sm = open('sitemap.xml', encoding='utf-8').read() if os.path.exists('sitemap.xml') else ''
    antigos = dict(re.findall(r'<loc>' + re.escape(BASE) + r'([^<]*)</loc><lastmod>([^<]+)', sm))
    urls = []
    for f in sorted(glob.glob('*.html')):
        if f in IGNORAR:
            continue
        s = open(f, encoding='utf-8').read()
        chave = '' if f == 'index.html' else f
        data = hoje if f in alteradas else datas_da_pagina(s, antigos.get(chave))
        d = datetime.date.fromisoformat(data)
        br = d.strftime('%d/%m/%Y')

        # hero "Última revisão" e carimbo no rodapé com a mesma data
        s = re.sub(r'<time datetime="\d{4}-\d{2}-\d{2}">[^<]*</time>',
                   '<time datetime="%s">%d de %s de %d</time>' % (data, d.day, MESES[d.month - 1], d.year), s)
        if f not in ('index.html', 'sobre.html', 'privacidade.html', 'contato.html', 'ofertas.html'):
            carimbo = ('<!-- editorial-stamp --><aside class="carimbo" style="max-width:1100px;margin:28px auto;padding:14px 24px;'
                       'border-left:3px solid var(--yellow,#e8bc39);font-size:.85rem;color:var(--muted,#999)">'
                       'Atualizado em: %s · Autor: %s · Referência: %s · '
                       '<a href="/sobre.html#metodologia">Metodologia e registro de revisões</a></aside>') % (br, AUTOR, REFS.get(f, NBR))
            if '<!-- editorial-stamp -->' in s:
                s = re.sub(r'<!-- editorial-stamp --><aside[^>]*>.*?</aside>', carimbo, s, count=1, flags=re.S)
            else:
                s = s.replace('</main>', carimbo + '</main>', 1)

        # schema.org: um Article (ou WebApplication nas calculadoras) por página, com autor e data
        s = re.sub(r'<script type="application/ld\+json">[^<]*"@type": ?"(Article|WebApplication)".*?</script>\n?', '', s, flags=re.S)
        if f not in SEM_SCHEMA:
            titulo = re.search(r'<title>(.*?)</title>', s, re.S).group(1).split(' — ')[0].strip()
            desc = re.search(r'<meta name="description" content="([^"]*)"', s)
            autor = {'@type': 'Person', 'name': AUTOR, 'url': BASE + 'sobre.html'}
            editora = {'@type': 'Organization', 'name': 'Guia Elétrica Fácil', 'url': BASE,
                       'logo': {'@type': 'ImageObject', 'url': BASE + 'logo-192.png'}}
            if f.startswith(('calculadora-', 'conversor-')):
                ld = {'@context': 'https://schema.org', '@type': 'WebApplication', 'name': titulo, 'url': BASE + f,
                      'applicationCategory': 'UtilitiesApplication', 'operatingSystem': 'Qualquer (navegador)',
                      'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'BRL'},
                      'inLanguage': 'pt-BR', 'dateModified': data, 'author': autor, 'publisher': editora}
            else:
                ld = {'@context': 'https://schema.org', '@type': 'Article', 'headline': titulo[:110],
                      'mainEntityOfPage': BASE + f, 'inLanguage': 'pt-BR', 'dateModified': data,
                      'author': autor, 'publisher': editora, 'image': BASE + 'og-image.png'}
            if desc:
                ld['description'] = desc.group(1)
            ld['citation'] = REFS.get(f, NBR)
            s = s.replace('</head>', '<script type="application/ld+json">%s</script>\n</head>' % json.dumps(ld, ensure_ascii=False), 1)
        open(f, 'w', encoding='utf-8').write(s)
        urls.append((BASE + chave, data))

    corpo = '\n'.join('  <url><loc>%s</loc><lastmod>%s</lastmod></url>' % u for u in urls)
    open('sitemap.xml', 'w', encoding='utf-8').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s\n</urlset>\n' % corpo)
    print('%d páginas atualizadas; %d com a data de hoje.' % (len(urls), len([u for u in urls if u[1] == hoje])))


if __name__ == '__main__':
    main(set(sys.argv[1:]))
