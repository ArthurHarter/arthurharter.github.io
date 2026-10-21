/* Guia Elétrica Fácil — interface e efeitos visuais (JS puro, sem dependências) */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hover = window.matchMedia('(hover: hover)').matches;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* destinos do menu mobile (iguais em todas as páginas) */
  var MENU = [
    ['Início', '/index.html'], ['Bitola de fios', '/bitola-de-fios.html'], ['Disjuntores', '/disjuntores.html'],
    ['Consumo elétrico', '/consumo-eletrico.html'], ['Calculadoras', '/calculadoras.html'],
    ['Carregador de carro elétrico', '/carregador-veiculo-eletrico.html'], ['Notícias', '/blog.html'],
    ['E-books', '/ebooks.html'], ['Sobre', '/sobre.html'], ['Contato', '/contato.html']
  ];

  ready(function () {
    var header = document.querySelector('header');
    var main = document.querySelector('main');
    var path = location.pathname.replace(/\/$/, '/index.html') || '/index.html';
    if (!/\.\w+$/.test(path)) path += '.html';
    var i;

    /* ---------- Estrutura e acessibilidade (sempre ativas) ---------- */

    /* link "pular para o conteúdo" */
    if (main) {
      if (!main.id) main.id = 'conteudo';
      var skip = el('a', 'efx-skip', { href: '#' + main.id });
      skip.textContent = 'Pular para o conteúdo';
      document.body.insertBefore(skip, document.body.firstChild);
    }

    /* página atual marcada no menu do topo */
    Array.prototype.forEach.call(document.querySelectorAll('header nav a'), function (a) {
      var u; try { u = new URL(a.getAttribute('href'), location.href); } catch (e) { return; }
      if (u.pathname === path && !u.hash) { a.classList.add('current'); a.setAttribute('aria-current', 'page'); }
    });

    /* menu mobile (hambúrguer) */
    if (header) {
      var inner = header.querySelector('.header-inner') || header;
      var btn = el('button', 'efx-burger', { type: 'button', 'aria-label': 'Abrir menu', 'aria-expanded': 'false', 'aria-controls': 'efx-menu' });
      btn.appendChild(el('span'));
      var menu = el('nav', 'efx-menu', { id: 'efx-menu', 'aria-label': 'Menu principal' });
      MENU.forEach(function (m) {
        var a = el('a', '', { href: m[1] });
        a.textContent = m[0];
        if (m[1] === path) a.setAttribute('aria-current', 'page');
        menu.appendChild(a);
      });
      inner.appendChild(btn);
      header.appendChild(menu);
      var setOpen = function (open) {
        if (open) document.documentElement.style.setProperty('--efx-h', header.offsetHeight + 'px');
        header.classList.toggle('efx-open', open);
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
        document.documentElement.classList.toggle('efx-lock', open);
      };
      btn.addEventListener('click', function () { setOpen(!header.classList.contains('efx-open')); });
      menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && header.classList.contains('efx-open')) { setOpen(false); btn.focus(); } });
      window.addEventListener('resize', function () { if (window.innerWidth > 768) setOpen(false); });
    }

    /* resultados das calculadoras anunciados por leitores de tela */
    var rp = document.querySelectorAll('.result-panel');
    for (i = 0; i < rp.length; i++) rp[i].setAttribute('aria-live', 'polite');

    /* botão voltar ao topo */
    var top = el('button', 'efx-top', { type: 'button', 'aria-label': 'Voltar ao topo' });
    top.textContent = '↑';
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
    document.body.appendChild(top);

    /* barra de progresso de leitura (só com movimento permitido) */
    var bar = null;
    if (!reduce) {
      bar = el('div', 'efx-bar', { 'aria-hidden': 'true' });
      document.body.appendChild(bar);
    }

    /* um único listener de scroll */
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var h = document.documentElement, st = h.scrollTop, max = h.scrollHeight - h.clientHeight;
        if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, st / max) : 0) + ')';
        if (header) header.classList.toggle('efx-stuck', st > 8);
        top.classList.toggle('on', st > 700);
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (reduce) return;

    /* ---------- Efeitos de movimento ---------- */

    /* entrada suave ao rolar */
    var SEL = '.card,.hub-card,.tip,.stat,.next-card,.step,.affiliate-banner,.ebook-banner,' +
              '.warn-box,.info-box,.full-table,.section-tag,.section-tag+h2,.efx-stage,.efx-related,.efx-quick-grid a';
    var items = document.querySelectorAll(SEL);

    function countUp(n) {
      var m = /^(\d+)(\D*)$/.exec(n.textContent.trim());
      if (!m) return;
      var end = parseInt(m[1], 10), suffix = m[2], t0 = null;
      (function step(t) {
        if (t0 === null) t0 = t;
        var p = Math.min(1, (t - t0) / 900);
        n.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suffix;
        if (p < 1) requestAnimationFrame(step);
      })(performance.now());
    }
    function reveal(e, instant) {
      if (instant) e.classList.add('rv-now');
      e.classList.add('rv-in');
      var n = e.classList.contains('stat-num') ? e : e.querySelector('.stat-num');
      if (n && !instant && !n.dataset.done) { n.dataset.done = '1'; countUp(n); }
    }

    if (!('IntersectionObserver' in window)) return;
    document.documentElement.classList.add('js');

    /* Revela ao entrar na tela, em qualquer direção, e reinicia ao sair:
       a animação toca de novo quando o usuário volta (rolando para baixo ou para cima). */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var t = e.target;
        if (e.isIntersecting) {
          /* entrou por cima (rolando para cima) → desliza de cima para baixo */
          var fromTop = e.boundingClientRect.top < (window.innerHeight || 800) * .3 && lastY < prevY;
          t.classList.toggle('rv-up', fromTop);
          if (!t.classList.contains('rv-in')) reveal(t, false);
        } else {
          /* saiu da tela: volta ao estado inicial para poder animar outra vez */
          t.classList.remove('rv-in', 'rv-now', 'rv-up');
        }
      });
    }, { rootMargin: '-4% 0px -8% 0px', threshold: 0.05 });

    var lastY = window.pageYOffset, prevY = lastY;
    window.addEventListener('scroll', function () { prevY = lastY; lastY = window.pageYOffset; }, { passive: true });

    var seen = new Map();
    Array.prototype.forEach.call(items, function (e) {
      var p = e.parentNode, k = seen.get(p) || 0;
      seen.set(p, k + 1);
      e.style.setProperty('--d', Math.min(k, 6) * 70 + 'ms');
      e.classList.add('rv');
      io.observe(e);
    });

    /* brilho que segue o mouse nos cards */
    if (hover) {
      document.addEventListener('pointermove', function (e) {
        var c = e.target.closest && e.target.closest('.card,.hub-card,.tip,.next-card');
        if (!c) return;
        var r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }, { passive: true });

      /* hero: cartão inclina em 3D e botões "puxam" o cursor */
      var hv = document.querySelector('.hero-visual');
      if (hv) {
        hv.addEventListener('pointermove', function (e) {
          var r = hv.getBoundingClientRect();
          hv.style.setProperty('--ry', (((e.clientX - r.left) / r.width - .5) * 8).toFixed(2) + 'deg');
          hv.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - .5) * 8).toFixed(2) + 'deg');
        });
        hv.addEventListener('pointerleave', function () { hv.style.removeProperty('--rx'); hv.style.removeProperty('--ry'); });
      }
      Array.prototype.forEach.call(document.querySelectorAll('.hero-cta'), function (b) {
        b.addEventListener('pointermove', function (e) {
          var r = b.getBoundingClientRect();
          b.style.setProperty('--tx', (((e.clientX - r.left) / r.width - .5) * 8).toFixed(1) + 'px');
          b.style.setProperty('--ty', (((e.clientY - r.top) / r.height - .5) * 6).toFixed(1) + 'px');
        });
        b.addEventListener('pointerleave', function () { b.style.removeProperty('--tx'); b.style.removeProperty('--ty'); });
      });
    }

    /* calculadoras: faísca quando o resultado muda */
    var rv = document.querySelector('.result-value');
    var panel = document.querySelector('.result-panel:not(.empty-state)');
    if (rv && panel && 'MutationObserver' in window) {
      var tmr;
      new MutationObserver(function () {
        panel.classList.remove('efx-spark');
        void panel.offsetWidth;
        panel.classList.add('efx-spark');
        clearTimeout(tmr);
        tmr = setTimeout(function () { panel.classList.remove('efx-spark'); }, 800);
      }).observe(rv, { childList: true, characterData: true, subtree: true });
    }
  });
})();
