"""Diagramas interativos do site (SVG dentro da página, sem arquivos externos).

Cada diagrama é injetado entre os marcadores <!--dx:nome--> e <!--/dx:nome--> das páginas listadas em PAGINAS.
Uso, na raiz do projeto:  python3 gerar-diagramas.py
"""
import glob, json, re

Y, T, M, R, BL, G, BX, LN = '#F5C518', '#F0EDE6', '#888', '#E5484D', '#4EA8DE', '#3CB371', '#1E1E1E', '#3A3A3A'


def txt(x, y, s, cor=T, tam=13, peso=400, ancora='middle', cls='dx-lbl'):
    c = f' class="{cls}"' if cls else ''
    return f'<text{c} x="{x}" y="{y}" fill="{cor}" font-size="{tam}" font-weight="{peso}" text-anchor="{ancora}">{s}</text>'


def hit(d, w=20):
    """Área de toque invisível ao redor de linhas finas (bom para celular)."""
    return f'<path d="{d}" stroke="transparent" stroke-width="{w}" fill="none" pointer-events="stroke"/>'


def parte(k, conteudo, dx=0, dy=0):
    return f'<g class="dx-p" data-k="{k}" style="--x:{dx}px;--y:{dy}px">{conteudo}</g>'


def modulo(x, y, w, h, rotulo, borda=LN, extra=''):
    """Dispositivo DIN visto de frente: corpo, alavanca e texto."""
    alav = ''.join(f'<rect x="{x + i * 30 + 9}" y="{y + 22}" width="12" height="24" rx="3" fill="#3A3A3A" stroke="{M}"/>' for i in range(w // 30))
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="{BX}" stroke="{borda}" stroke-width="1.5"/>{alav}'
            f'<text x="{x + w / 2}" y="{y + h - 10}" fill="{T}" font-size="11" font-weight="700" text-anchor="middle">{rotulo}</text>{extra}')


# ---------------------------------------------------------------- 1. Quadro de distribuição
def quadro():
    p = []
    p.append(parte('caixa', f'<rect x="260" y="110" width="400" height="390" rx="12" fill="#191919" stroke="{LN}" stroke-width="2"/>'
                   + txt(460, 135, 'QUADRO', M, 11, 700, cls='')))
    p.append(parte('trilho', ''.join(f'<rect x="275" y="{yy}" width="370" height="14" rx="2" fill="#2A2A2A" stroke="#444"/>' for yy in (203, 333))))
    p.append(parte('geral', modulo(290, 170, 60, 80, 'GERAL', Y) + txt(320, 275, 'Disjuntor geral', Y, 13, 700), -230, 0))
    p.append(parte('dps', modulo(365, 170, 30, 80, 'DPS', LN, f'<circle cx="380" cy="182" r="4" fill="{G}"/>')
                   + txt(405, 215, 'DPS', Y, 13, 700, 'start'), 0, -150))
    p.append(parte('dr', modulo(410, 170, 60, 80, 'DR 30mA', BL, f'<circle cx="460" cy="182" r="6" fill="{Y}"/><text x="460" y="186" font-size="8" font-weight="700" text-anchor="middle" fill="#111">T</text>')
                   + txt(440, 275, 'DR 30 mA', Y, 13, 700), 310, 0))
    disj = ''.join(modulo(290 + i * 35, 300, 30, 80, a) for i, a in enumerate(['10A', '20A', '20A', '16A'])) + modulo(430, 300, 60, 80, '32A')
    p.append(parte('disjuntores', disj + txt(390, 405, 'Disjuntores dos circuitos', Y, 13, 700), 410, 20))
    bar = lambda x, w, cor, nome: (f'<rect x="{x}" y="440" width="{w}" height="18" rx="3" fill="{cor}" fill-opacity=".25" stroke="{cor}"/>'
                                   + ''.join(f'<circle cx="{x + 14 + i * 22}" cy="449" r="4" fill="{cor}"/>' for i in range(w // 22))
                                   + txt(x + w / 2, 480, nome, cor, 12, 700))
    p.append(parte('neutro', bar(290, 150, BL, 'Barramento de neutro'), -250, 30))
    p.append(parte('terra', bar(470, 170, G, 'Barramento de terra'), 220, 30))
    dados = {
        'caixa': ('Quadro de distribuição', 'Reúne a proteção de todos os circuitos. Deve ficar em local de fácil acesso, com identificação de cada circuito, advertência e espaço de reserva para circuitos futuros (NBR 5410, 6.5.4 e Tabela 59).'),
        'trilho': ('Trilho DIN', 'Perfil metálico padronizado de 35 mm onde os dispositivos são encaixados. Cada polo de disjuntor ocupa um módulo de cerca de 18 mm; conte os módulos ao escolher o tamanho do quadro.'),
        'geral': ('Disjuntor geral', 'Protege o alimentador que vem do medidor e desliga a casa inteira. Seu valor depende do cálculo de demanda e das regras da distribuidora de energia.'),
        'dps': ('DPS — dispositivo de proteção contra surtos', 'Desvia para o terra as sobretensões causadas por raios e manobras na rede, protegendo os aparelhos. Fica ligado entre os condutores vivos e o barramento de terra. A NBR 5410 diz quando é exigido no item 5.4.2.1.1.'),
        'dr': ('DR de 30 mA', 'Compara a corrente que vai pela fase com a que volta pelo neutro. Se a diferença passa de 30 mA (uma fuga para a terra, por exemplo pelo corpo de uma pessoa), desliga em fração de segundo. O botão T testa o mecanismo: aperte uma vez por mês.'),
        'disjuntores': ('Disjuntores dos circuitos', 'Um por circuito, escolhido pela regra Ib ≤ In ≤ Iz. Protegem o fio contra sobrecarga e curto-circuito. Circuitos de 220 V entre duas fases, como o do chuveiro, usam disjuntor bipolar.'),
        'neutro': ('Barramento de neutro', 'Recebe todos os condutores neutros (azul-claro). Dentro da instalação, neutro e terra ficam separados: nunca ligue um neutro no barramento de terra.'),
        'terra': ('Barramento de terra (PE)', 'Recebe os condutores de proteção (verde-amarelo) de todos os circuitos e o DPS, e se liga ao eletrodo de aterramento. Todo circuito deve ter condutor de proteção.'),
    }
    return dict(titulo='Quadro de distribuição por dentro', vb='0 0 920 540', svg=''.join(p), dados=dados, explode=True,
                legenda='Esquema didático de um quadro residencial. Clique em cada peça; use Desmontar para separar as partes.')


# ---------------------------------------------------------------- 2. Anatomia do disjuntor
def disjuntor():
    p = []
    p.append(parte('carcaca', f'<rect x="360" y="85" width="200" height="420" rx="18" fill="#1B1B1B" stroke="{M}" stroke-width="2"/>'
                   + txt(460, 525, 'Carcaça', Y, 13, 700)))
    p.append(parte('alavanca', f'<rect x="432" y="40" width="56" height="60" rx="8" fill="#2E2E2E" stroke="{Y}" stroke-width="2"/>'
                   f'<text x="460" y="66" fill="{Y}" font-size="11" font-weight="700" text-anchor="middle">ON</text>' + txt(510, 70, 'Alavanca', Y, 13, 700, 'start'), 0, -30))
    borne = lambda y: (f'<rect x="395" y="{y}" width="130" height="34" rx="5" fill="#2A2A2A" stroke="{LN}"/>'
                       f'<circle cx="460" cy="{y + 17}" r="11" fill="#555" stroke="{T}"/><path d="M452 {y + 17} H468" stroke="{T}" stroke-width="2"/>')
    p.append(parte('bornes', borne(105) + txt(535, 127, 'Borne de entrada', Y, 12, 700, 'start'), 250, -15))
    p.append(parte('bornes', borne(455) + txt(535, 477, 'Borne de saída', Y, 12, 700, 'start'), 250, 15))
    p.append(parte('mecanismo', f'<circle cx="455" cy="175" r="16" fill="none" stroke="{T}" stroke-width="2"/><circle cx="455" cy="175" r="4" fill="{T}"/>'
                   f'<path d="M455 175 L500 200 M455 175 L420 205 M500 200 L510 230" stroke="{T}" stroke-width="2.5" fill="none"/>'
                   f'<path d="M500 150 q8 6 0 12 q-8 6 0 12 q8 6 0 12" stroke="{M}" stroke-width="2" fill="none"/>' + txt(395, 160, 'Mecanismo', Y, 13, 700, 'end'), -250, -20))
    p.append(parte('contatos', f'<rect x="380" y="300" width="40" height="28" rx="4" fill="#B87333"/><path d="M470 215 L425 302" stroke="#B87333" stroke-width="7" stroke-linecap="round"/>'
                   f'<circle cx="425" cy="302" r="7" fill="#D08A3C"/>' + txt(372, 318, 'Contatos', Y, 13, 700, 'end'), -230, 10))
    bob = ''.join(f'<path d="M478 {222 + i * 9} H532" stroke="#D08A3C" stroke-width="3"/>' for i in range(8))
    p.append(parte('bobina', f'<rect x="474" y="214" width="62" height="80" rx="6" fill="#262626" stroke="{LN}"/>{bob}<rect x="500" y="205" width="10" height="98" fill="#777"/>'
                   + txt(545, 258, 'Bobina', Y, 13, 700, 'start'), 250, 0))
    p.append(parte('bimetal', f'<path d="M488 335 Q500 385 488 435" stroke="#C9A227" stroke-width="7" fill="none"/><path d="M497 335 Q509 385 497 435" stroke="#8FA9C4" stroke-width="7" fill="none"/>'
                   + txt(520, 390, 'Bimetal', Y, 13, 700, 'start'), 250, 30))
    plac = ''.join(f'<path d="M378 {352 + i * 10} H442" stroke="#9A9A9A" stroke-width="3"/>' for i in range(8))
    p.append(parte('camara', f'<rect x="372" y="344" width="76" height="86" rx="5" fill="#222" stroke="{LN}"/>{plac}' + txt(364, 392, 'Câmara de extinção', Y, 13, 700, 'end'), -230, 40))
    dados = {
        'carcaca': ('Carcaça isolante', 'Corpo de material isolante e resistente ao calor que envolve as partes energizadas. Nela vêm gravadas a corrente nominal (In), a curva (B, C ou D) e a capacidade de interrupção em kA.'),
        'alavanca': ('Alavanca de manobra', 'Liga e desliga o circuito manualmente. Depois de um disparo ela vai para a posição desligada: descubra a causa da sobrecarga ou do curto antes de religar.'),
        'bornes': ('Bornes de entrada e saída', 'Terminais onde os fios são presos. Aperto fraco aquece e é uma das causas mais comuns de fio derretido; aperte com o torque indicado pelo fabricante.'),
        'mecanismo': ('Mecanismo de disparo', 'Uma trava segura os contatos fechados contra uma mola. Quando o bimetal ou a bobina empurram a trava, a mola abre os contatos de uma vez, mesmo que alguém segure a alavanca.'),
        'contatos': ('Contatos fixo e móvel', 'Por onde passa a corrente. Ao abrir com carga forma-se um arco elétrico entre eles, que é empurrado para a câmara de extinção.'),
        'bobina': ('Bobina — disparo magnético (curto-circuito)', 'Na corrente de curto o campo magnético da bobina puxa um êmbolo e abre o disjuntor em milésimos de segundo. A curva define a partir de quando: B de 3 a 5 vezes In, C de 5 a 10 vezes, D de 10 a 20 vezes.'),
        'bimetal': ('Lâmina bimetálica — disparo térmico (sobrecarga)', 'Dois metais que dilatam de forma diferente. Com sobrecarga a lâmina aquece, curva e aciona o disparo depois de algum tempo: quanto maior a sobrecarga, mais rápido. É o que impede o fio de aquecer além do limite.'),
        'camara': ('Câmara de extinção do arco', 'Placas metálicas que dividem, alongam e resfriam o arco até ele se apagar. A capacidade de interrupção (por exemplo 3 kA ou 6 kA) diz qual corrente de curto o disjuntor consegue cortar com segurança.'),
    }
    return dict(titulo='Anatomia de um disjuntor termomagnético', vb='0 0 920 545', svg=''.join(p), dados=dados, explode=True,
                legenda='Corte esquemático, fora de escala. Clique em cada peça; use Desmontar para separar as partes.')


# ---------------------------------------------------------------- 3. Anatomia do cabo
def cabo():
    p = []
    fios = lambda y: ''.join(f'<path d="M560 {y + 8 + i * 4} C590 {y + 6 + i * 4} 610 {y + 10 + i * 4} 640 {y + 8 + i * 4}" stroke="#D08A3C" stroke-width="2.4" fill="none"/>' for i in range(8))
    p.append(txt(120, 70, 'Cabo flexível 450/750 V — o “fio” comum de casa', T, 14, 700, 'start', cls=''))
    p.append(parte('isolacao', f'<rect x="150" y="90" width="410" height="44" rx="22" fill="{R}"/>' + txt(355, 160, 'Isolação de PVC', Y, 13, 700), -70, 0))
    p.append(parte('cobre', fios(90) + f'<ellipse cx="640" cy="112" rx="5" ry="16" fill="#B87333"/>' + txt(600, 160, 'Condutor de cobre', Y, 13, 700), 90, 0))
    p.append(txt(120, 215, 'Cabo 0,6/1 kV — com cobertura', T, 14, 700, 'start', cls=''))
    p.append(parte('cobertura', f'<rect x="150" y="234" width="270" height="56" rx="28" fill="#2B2B2B" stroke="#555"/>' + txt(285, 316, 'Cobertura', Y, 13, 700), -110, 0))
    p.append(parte('isolacao', f'<rect x="400" y="240" width="160" height="44" rx="22" fill="{BL}"/>' + txt(480, 316, 'Isolação', Y, 13, 700), -20, 0))
    p.append(parte('cobre', fios(240) + f'<ellipse cx="640" cy="262" rx="5" ry="16" fill="#B87333"/>' + txt(600, 316, 'Condutor', Y, 13, 700), 90, 0))
    dados = {
        'cobre': ('Condutor de cobre', 'Nos cabos flexíveis é formado por muitos fios finos, o que facilita a passagem no eletroduto. A seção (1,5; 2,5; 4; 6 mm²…) é a área de cobre e define quanta corrente o cabo conduz (NBR 5410, Tabela 36).'),
        'isolacao': ('Isolação', 'Camada que isola o cobre. A de PVC suporta 70 °C em uso contínuo — por isso a Tabela 36 parte de 70 °C. A cor identifica a função: neutro azul-claro, proteção verde-amarelo ou verde e fases nas demais cores (NBR 5410, 6.1.5.3).'),
        'cobertura': ('Cobertura', 'Camada externa dos cabos 0,6/1 kV que protege a isolação contra umidade e danos mecânicos. Por ter isolação e cobertura, esse cabo pode ser usado em eletroduto enterrado, onde o condutor só isolado (750 V) não é admitido.'),
    }
    return dict(titulo='Anatomia do cabo elétrico', vb='0 0 820 340', svg=''.join(p), dados=dados, explode=True,
                legenda='Clique em cada camada; use Desmontar para separar o condutor, a isolação e a cobertura.')


# ---------------------------------------------------------------- 4. Ligação do chuveiro
def chuveiro():
    p = []
    p.append(f'<rect x="30" y="40" width="250" height="250" rx="10" fill="#1A1A1A" stroke="{LN}"/>' + txt(155, 64, 'QUADRO', M, 11, 700, cls=''))
    p.append(parte('dr', f'<rect x="70" y="84" width="170" height="54" rx="8" fill="{BX}" stroke="{BL}"/>' + txt(155, 108, 'DR 30 mA', T, 14, 700, cls='') + txt(155, 126, 'bipolar', M, 11, cls='')))
    p.append(f'<path d="M155 138 V158" stroke="{Y}" stroke-width="3"/>')
    p.append(parte('disjuntor', f'<rect x="70" y="158" width="170" height="54" rx="8" fill="{BX}" stroke="{Y}"/>' + txt(155, 182, 'Disjuntor 32 A', T, 14, 700, cls='') + txt(155, 200, 'bipolar, curva C', M, 11, cls='')))
    p.append(parte('barramento', f'<rect x="60" y="250" width="190" height="18" rx="4" fill="{G}" fill-opacity=".2" stroke="{G}"/>' + txt(155, 263, 'barramento de terra', G, 11, 700, cls='')))
    p.append(parte('fases', hit('M240 176 H560 M240 196 H560') + f'<path d="M240 176 H560" stroke="{R}" stroke-width="5"/><path d="M240 196 H560" stroke="{T}" stroke-width="5"/>'
                   + txt(400, 166, 'fase 1 · 4 mm²', '#B8B4AC', 12, cls='') + txt(400, 216, 'fase 2 · 4 mm²', '#B8B4AC', 12, cls='')))
    p.append(parte('terra', hit('M250 259 H430 V226 H560') + f'<path d="M250 259 H430 V226 H560" stroke="{G}" stroke-width="5" fill="none"/><path d="M250 259 H430 V226 H560" stroke="{Y}" stroke-width="5" stroke-dasharray="6 10" fill="none"/>'
                   + txt(330, 280, 'terra (PE) · 4 mm²', '#B8B4AC', 12, cls='')))
    p.append(parte('conector', f'<rect x="548" y="168" width="22" height="66" rx="4" fill="#444" stroke="{T}"/>' + txt(559, 252, 'conector', M, 11, cls='')))
    p.append(parte('chuveiro', f'<rect x="580" y="140" width="190" height="110" rx="14" fill="{BX}" stroke="{LN}"/>' + txt(675, 182, 'Chuveiro', T, 15, 700, cls='')
                   + txt(675, 204, '5500 W · 220 V · 25 A', M, 12, cls='') + ''.join(f'<circle cx="{625 + i * 20}" cy="226" r="3" fill="{BL}"/>' for i in range(5))))
    dados = {
        'dr': ('DR de 30 mA', 'Obrigatório em circuitos de banheiro (NBR 5410, 5.1.3.2.2). Se desarmar ao ligar o chuveiro, o problema costuma ser chuveiro com resistência exposta ou fuga no aparelho: troque por modelo com resistência blindada, nunca retire o DR.'),
        'disjuntor': ('Disjuntor bipolar de 32 A', 'Em 220 V entre fases, o disjuntor precisa desligar as duas fases. Para 5500 W (25 A) com fio de 4 mm² (Iz = 32 A), 25 A ou 32 A atendem Ib ≤ In ≤ Iz; 40 A deixaria o fio desprotegido.'),
        'barramento': ('Barramento de terra', 'Ponto de ligação de todos os condutores de proteção, conectado ao eletrodo de aterramento.'),
        'fases': ('Duas fases de 4 mm²', 'Em rede 127/220 V, o chuveiro de 220 V é ligado em duas fases e não usa neutro. Em rede 220/380 V, o 220 V é fase + neutro (azul-claro) e o disjuntor pode ser unipolar na fase.'),
        'terra': ('Condutor de proteção (terra)', 'Liga a carcaça do chuveiro ao aterramento. Se houver fuga para a carcaça, a corrente escoa por ele em vez de passar por quem encostar; essa corrente que não volta pelos condutores vivos é o que faz o DR desligar. Mesma seção das fases até 16 mm² (Tabela 58).'),
        'conector': ('Conexão', 'Use conector adequado à corrente, sem emenda com fita. Mau contato aquece e é a causa mais comum de fio derretido no chuveiro.'),
        'chuveiro': ('Chuveiro em circuito exclusivo', 'Corrente acima de 10 A exige circuito independente (NBR 5410, item 9.5.3.1). Fio e disjuntor dependem da potência: veja a tabela por potência.'),
    }
    return dict(titulo='Ligação do chuveiro em 220 V', vb='0 0 800 300', svg=''.join(p), dados=dados, explode=False,
                legenda='Exemplo com 5500 W. Clique em cada parte do circuito para ver a função.')


# ---------------------------------------------------------------- 5. Volumes do banheiro
def banheiro():
    p = [f'<rect x="40" y="30" width="440" height="290" fill="none" stroke="#5A5A5A" stroke-width="6"/>']
    p.append(parte('v2', f'<rect x="46" y="36" width="220" height="200" fill="{Y}" fill-opacity=".12" stroke="{Y}" stroke-dasharray="8 6" stroke-width="2"/>'
                   + txt(221, 190, 'volume 2', Y, 12, 700, cls='') + txt(221, 206, 'até 60 cm', Y, 11, cls='')))
    p.append(parte('v01', f'<rect x="46" y="36" width="130" height="110" fill="{R}" fill-opacity=".25" stroke="{R}" stroke-width="2"/>'
                   f'<circle cx="111" cy="80" r="16" fill="none" stroke="{BL}" stroke-width="2"/><circle cx="111" cy="80" r="3" fill="{BL}"/>'
                   + txt(111, 132, 'volumes 0 e 1', R, 12, 700, cls='')))
    p.append(f'<path d="M176 256 H266 M176 250 V262 M266 250 V262" stroke="{M}"/>' + txt(221, 276, '0,60 m', '#B8B4AC', 12, cls=''))
    p.append(parte('lavatorio', f'<rect x="340" y="235" width="120" height="70" rx="6" fill="{BX}" stroke="{LN}"/>' + txt(400, 275, 'Lavatório', T, 12, cls='')))
    p.append(parte('tomada', f'<rect x="433" y="196" width="24" height="24" rx="4" fill="{G}"/>' + txt(445, 213, 'T', '#141414', 12, 700, cls='')))
    p.append(parte('dr', f'<rect x="530" y="60" width="250" height="60" rx="8" fill="{BX}" stroke="{BL}"/>' + txt(655, 86, 'Circuitos do banheiro', T, 13, 700, cls='') + txt(655, 105, 'DR 30 mA obrigatório', BL, 12, 700, cls='')))
    p.append(txt(655, 170, 'Clique nas áreas da planta', M, 12, cls=''))
    dados = {
        'v01': ('Volumes 0 e 1: área do box ou da banheira', 'O volume 0 é o interior da banheira ou do piso do box; o volume 1 fica acima dele. Não se admitem tomadas nesses volumes (NBR 5410, seção 9.1).'),
        'v2': ('Volume 2: faixa de 60 cm em volta', 'Estende-se 0,60 m além do volume 1. A norma restringe tomadas e interruptores aqui; na prática, mantenha-os fora dessa faixa.'),
        'tomada': ('Tomada junto ao lavatório', 'A NBR 5410 pede pelo menos uma tomada no banheiro, junto ao lavatório (9.5.2.2.1), fora dos volumes 0, 1 e 2 e protegida por DR de 30 mA.'),
        'lavatorio': ('Lavatório', 'Fora dos volumes do box. É o lugar indicado para a tomada do banheiro (secador, barbeador).'),
        'dr': ('DR de 30 mA', 'Todos os circuitos que atendem pontos no banheiro precisam de DR de até 30 mA (item 5.1.3.2.2 a).'),
    }
    return dict(titulo='Volumes do banheiro (vista de cima)', vb='0 0 800 340', svg=''.join(p), dados=dados, explode=False,
                legenda='Simplificado, sem as alturas dos volumes. Clique em cada área.')


# ---------------------------------------------------------------- 6. Ib ≤ In ≤ Iz
def ibiniz():
    x = lambda a: 60 + a * 17
    eixo = f'<line x1="{x(0)}" y1="190" x2="{x(40)}" y2="190" stroke="{LN}" stroke-width="2"/>' + ''.join(
        f'<line x1="{x(a)}" y1="184" x2="{x(a)}" y2="196" stroke="{LN}"/>' + txt(x(a), 214, f'{a} A', M, 12, cls='') for a in (0, 10, 20, 40))
    p = [eixo]
    p.append(parte('faixa', f'<rect x="{x(25)}" y="140" width="{x(32) - x(25)}" height="36" rx="6" fill="{Y}" fill-opacity=".18" stroke="{Y}"/>' + txt((x(25) + x(32)) / 2, 236, 'faixa para In', Y, 12, 700, cls='')))
    p.append(parte('ib', hit(f'M{x(25)} 100 V190') + f'<line x1="{x(25)}" y1="100" x2="{x(25)}" y2="190" stroke="{T}" stroke-width="3"/><circle cx="{x(25)}" cy="190" r="7" fill="{T}"/>' + txt(x(25), 90, 'Ib = 25 A', T, 14, 700, cls='')))
    p.append(parte('iz', hit(f'M{x(32)} 100 V190') + f'<line x1="{x(32)}" y1="100" x2="{x(32)}" y2="190" stroke="{G}" stroke-width="3"/><circle cx="{x(32)}" cy="190" r="7" fill="{G}"/>' + txt(x(32), 90, 'Iz = 32 A', G, 14, 700, cls='')))
    p.append(parte('proibido', hit(f'M{x(40)} 130 V190') + f'<line x1="{x(40)}" y1="130" x2="{x(40)}" y2="190" stroke="{R}" stroke-width="3" stroke-dasharray="5 4"/><circle cx="{x(40)}" cy="190" r="7" fill="{R}"/>' + txt(x(40) - 8, 122, '40 A: proibido', R, 13, 700, 'end', cls='')))
    dados = {
        'ib': ('Ib — corrente de projeto', 'O que o circuito realmente consome: 5500 W ÷ 220 V = 25 A. O disjuntor nunca pode ser menor que isso, ou desarmaria com o chuveiro funcionando normalmente.'),
        'iz': ('Iz — capacidade do fio', 'O fio de 4 mm² conduz 32 A na condição de referência (Tabela 36, B1). Com agrupamento ou calor esse valor cai e precisa ser corrigido.'),
        'faixa': ('Faixa permitida para o disjuntor (In)', 'Entre 25 A e 32 A: os valores comerciais 25 A e 32 A atendem Ib ≤ In ≤ Iz (NBR 5410, item 5.3.4).'),
        'proibido': ('Disjuntor de 40 A: proibido com 4 mm²', 'In maior que Iz deixa o fio aquecer além do limite sem que o disjuntor desarme. Se o disjuntor de 32 A desarma, a solução é investigar a causa ou trocar o fio, nunca subir o disjuntor.'),
    }
    return dict(titulo='Ib ≤ In ≤ Iz — chuveiro de 5500 W em 220 V, fio de 4 mm²', vb='0 0 800 250', svg=''.join(p), dados=dados, explode=False,
                legenda='Clique em cada marca da escala.')


DIAGRAMAS = {'quadro': quadro, 'disjuntor': disjuntor, 'cabo': cabo, 'ligacao-chuveiro': chuveiro, 'banheiro': banheiro, 'ib-in-iz': ibiniz}


def html(nome):
    d = DIAGRAMAS[nome]()
    dados = {k: {'t': t, 'd': s} for k, (t, s) in d['dados'].items()}
    botao = '<button type="button" class="dx-toggle" aria-pressed="false">Desmontar</button>' if d['explode'] else ''
    desc = ' '.join(f"{t}: {s}" for t, s in d['dados'].values())
    return (f'<figure class="dx{"" if d["explode"] else " dx-static"}" id="dx-{nome}">'
            f'<div class="dx-bar"><div><strong>{d["titulo"]}</strong><div class="dx-hint">Clique ou toque numa peça para ver o que ela faz.</div></div>{botao}</div>'
            f'<svg viewBox="{d["vb"]}" role="group" aria-label="{d["titulo"]}"><desc>{desc}</desc>{d["svg"]}</svg>'
            f'<div class="dx-info" aria-live="polite"><h4>{list(d["dados"].values())[0][0]}</h4><p>{list(d["dados"].values())[0][1]}</p></div>'
            f'<figcaption>{d["legenda"]} Diagrama do Guia Elétrica Fácil.</figcaption>'
            f'<script type="application/json" class="dx-data">{json.dumps(dados, ensure_ascii=False)}</script></figure>')


def main():
    prontos = {n: html(n) for n in DIAGRAMAS}
    total = 0
    for f in sorted(glob.glob('*.html')):
        s = open(f, encoding='utf-8').read()
        novo = re.sub(r'<!--dx:([\w-]+)-->.*?<!--/dx:\1-->', lambda m: f'<!--dx:{m.group(1)}-->{prontos[m.group(1)]}<!--/dx:{m.group(1)}-->', s, flags=re.S)
        if novo != s:
            open(f, 'w', encoding='utf-8').write(novo)
            total += 1
    print(f'{total} páginas com diagramas atualizados.')


if __name__ == '__main__':
    main()
