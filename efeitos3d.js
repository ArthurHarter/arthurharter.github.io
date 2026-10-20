/* Guia Elétrica Fácil — carro elétrico 3D + fagulhas de energia (canvas puro, sem bibliotecas) */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- utilitários ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hermite(pts) { /* curva suave y(x) por pontos de controle */
    var n = pts.length, m = [], i;
    for (i = 0; i < n; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      m[i] = (b[1] - a[1]) / ((b[0] - a[0]) || 1);
    }
    return function (x) {
      if (x <= pts[0][0]) return pts[0][1];
      if (x >= pts[n - 1][0]) return pts[n - 1][1];
      var k = 0; while (x > pts[k + 1][0]) k++;
      var x0 = pts[k][0], h = pts[k + 1][0] - x0, t = (x - x0) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * pts[k][1] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * pts[k + 1][1] + (t3 - t2) * h * m[k + 1];
    };
  }

  /* ---------- perfil do carro (sedã elétrico fastback, estilo "coupé") ---------- */
  var LEN = 2.3;
  var yTop = hermite([[-2.3, .86], [-2.15, 1], [-1.9, 1.06], [-1.6, 1.15], [-1.2, 1.31], [-.7, 1.4], [-.2, 1.42], [.25, 1.37], [.7, 1.08], [1, .94], [1.5, .85], [1.95, .75], [2.2, .62], [2.3, .5]]);
  var yBelt = hermite([[-2.3, .62], [-2, .84], [-1, .92], [.3, .9], [1.2, .84], [2, .7], [2.3, .54]]);
  var yBot = hermite([[-2.3, .5], [-2.1, .34], [-1.8, .3], [1.8, .3], [2.1, .34], [2.3, .46]]);
  function wB(x) { var u = Math.min(1, Math.abs(x) / LEN), e = x > 0 ? 2.6 : 3.4; return .93 * (x > 0 ? .975 : 1) * Math.pow(Math.max(0, 1 - Math.pow(u, e)), 1 / e); }

  function ring(x) { /* meia seção transversal (de baixo até o centro do teto) como [z,y] */
    var yt = yTop(x), ybl = Math.min(yBelt(x), yt - .02), yb = Math.min(yBot(x), ybl - .1), wb = wB(x);
    var g = clamp((yt - ybl) / .3, 0, 1), wg = wb * (.8 - .05 * clamp((-x - .4) / 1.4, 0, 1)), d = yt - ybl;
    function L(a, b, t) { return a + (b - a) * t; }
    var p = [[wb * .8, yb], [wb * .96, yb + .06], [wb, yb + (ybl - yb) * .42], [wb * .995, ybl - (ybl - yb) * .12], [wb * .985, ybl],
      [L(wb * .93, wg, g), ybl + d * .1], [L(wb * .82, wg * .95, g), ybl + d * .52], [L(wb * .55, wg * .78, g), ybl + d * .9], [0, yt]];
    var o = [p[0]], i;
    for (i = 0; i < p.length - 1; i++) { /* suaviza os cantos */
      o.push([.75 * p[i][0] + .25 * p[i + 1][0], .75 * p[i][1] + .25 * p[i + 1][1]]);
      o.push([.25 * p[i][0] + .75 * p[i + 1][0], .25 * p[i][1] + .75 * p[i + 1][1]]);
    }
    o.push(p[p.length - 1]);
    return o;
  }
  function zAt(x, y) { /* z da lateral do carro na altura y */
    var r = ring(x), i, a, b;
    for (i = 0; i < r.length - 1; i++) {
      a = r[i]; b = r[i + 1];
      if ((a[1] <= y && y <= b[1]) && b[1] > a[1]) return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
    }
    return r[r.length - 1][0];
  }

  /* ---------- malha ---------- */
  var PAINT = 0, GLASS = 1, TRIM = 2, TIRE = 3, RIMD = 4, SILVER = 5, LEDW = 6, LEDR = 7, WALL = 8, ARCH = 9, LEDY = 10;
  var P = [], F = [], WOBJ = 1;
  function V(x, y, z) { P.push(x, y, z); return P.length / 3 - 1; }
  function nrm(a, b, c, d) { /* normal pelas diagonais */
    var ux = P[c * 3] - P[a * 3], uy = P[c * 3 + 1] - P[a * 3 + 1], uz = P[c * 3 + 2] - P[a * 3 + 2];
    var vx = P[d * 3] - P[b * 3], vy = P[d * 3 + 1] - P[b * 3 + 1], vz = P[d * 3 + 2] - P[b * 3 + 2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return l < 1e-9 ? null : [nx / l, ny / l, nz / l];
  }
  function face(idx, n, m, k, pr, o) { F.push({ i: idx, n: n, m: m, k: k, pr: pr || 0, o: o || 0, z: 0 }); }

  /* carroceria */
  (function () {
    var N = 60, rows = [], i, k, m, R, xs = [], grid = {};
    for (i = 0; i <= N; i++) xs.push(-LEN * Math.cos(Math.PI * i / N));
    for (i = 0; i <= N; i++) { R = ring(xs[i]); rows.push({ r: R, ri: [], li: [] }); for (k = 0; k < R.length; k++) { rows[i].ri.push(V(xs[i], R[k][1], R[k][0])); rows[i].li.push(V(xs[i], R[k][1], -R[k][0])); } }
    m = rows[0].r.length;
    function mat(xc, t, gc) {
      if (t < .2) return TRIM;
      if (Math.abs(xc) > 1.95 && t < .42) return TRIM;
      if (gc > .45) {
        if (xc > .26 && xc < 1.02 && t > .56) return GLASS;
        if (t > .84 && xc > -1.3 && xc <= .3) return GLASS;
        if (t > .5 && t <= .84 && xc > -1.75 && xc <= .22 && !(xc > -.5 && xc < -.42)) return GLASS;
        if (xc <= -1.3 && xc > -2.05 && t > .5) return GLASS;
      }
      return PAINT;
    }
    for (i = 0; i < N; i++) {
      var xc = (xs[i] + xs[i + 1]) / 2, gc = clamp((yTop(xc) - Math.min(yBelt(xc), yTop(xc) - .02)) / .3, 0, 1);
      for (k = 0; k < m - 1; k++) {
        var a = rows[i].ri[k], b = rows[i + 1].ri[k], c = rows[i + 1].ri[k + 1], d = rows[i].ri[k + 1];
        var n = nrm(a, b, c, d), mt = mat(xc, (k + .5) / (m - 1), gc);
        if (!n) continue;
        face([a, b, c, d], n, mt, 0);
        face([rows[i].li[k], rows[i].li[k + 1], rows[i + 1].li[k + 1], rows[i + 1].li[k]], [n[0], n[1], -n[2]], mt, 0);
        grid[i + '_' + k] = [F.length - 2, F.length - 1];
      }
    }
    for (i = 0; i < N; i++) for (k = 0; k < m - 1; k++) {
      var cur = grid[i + '_' + k]; if (!cur) continue;
      var sx = 0, sy = 0, sz = 0, q, w2, nb, ii, kk;
      for (ii = -1; ii <= 1; ii++) for (kk = -1; kk <= 1; kk++) {
        nb = grid[(i + ii) + '_' + (k + kk)]; if (!nb) continue;
        w2 = (ii || kk) ? 1 : 2; q = F[nb[0]].n; sx += q[0] * w2; sy += q[1] * w2; sz += q[2] * w2;
      }
      var ln = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      F[cur[0]].ns = [sx / ln, sy / ln, sz / ln]; F[cur[1]].ns = [sx / ln, sy / ln, -sz / ln];
    }
  })();

  function poly3(pts, n, m, k, pr, o) { face(pts.map(function (p) { return V(p[0], p[1], p[2]); }), n, m, k, pr, o); }
  function circle(cx, cy, r, n, a0, a1) { var p = [], i; for (i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; }
  function prismZ(pl, z0, z1, m, k, pr, o) { /* perfil 2D (x,y) extrudado em z */
    var n = pl.length, i, s = z1 > z0 ? 1 : -1;
    poly3(pl.map(function (p) { return [p[0], p[1], z1]; }), [0, 0, s], m, k, pr, o);
    for (i = 0; i < n; i++) {
      var a = pl[i], b = pl[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      poly3([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], [dy / l * s, -dx / l * s, 0], m, k, pr, o);
    }
  }
  function boxF(x0, x1, y0, y1, z0, z1, m, k, o) { prismZ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, m, k, 0, o); }

  /* rodas, caixas de roda, retrovisores (um conjunto por lado) */
  var WHEELS = [1.42, -1.42];
  [1, -1].forEach(function (s) {
    var k = s > 0 ? 'L' : 'R';
    WHEELS.forEach(function (xw) {
      var yw = .39, zs = wB(xw), sg = function (v) { return s * v; };
      poly3(circle(xw, yw, .5, 18, 0, Math.PI).map(function (p) { return [p[0], p[1], sg(zs + .012)]; }), [0, 0, s], ARCH, k, 0);
      var tire = circle(xw, yw, .39, 18, 0, Math.PI * 2).slice(0, 18);
      prismZ(tire, sg(zs - .14), sg(zs + .05), TIRE, k, 1);
      var zo = zs + .052;
      poly3(circle(xw, yw, .29, 18, 0, Math.PI * 2).slice(0, 18).map(function (p) { return [p[0], p[1], sg(zo)]; }), [0, 0, s], SILVER, k, 2);
      poly3(circle(xw, yw, .258, 18, 0, Math.PI * 2).slice(0, 18).map(function (p) { return [p[0], p[1], sg(zo + .003)]; }), [0, 0, s], RIMD, k, 3);
      for (var q = 0; q < 5; q++) {
        var a = q * 1.2566 + .3, w = .11, r0 = .06, r1 = .258;
        poly3([[a - w, r0], [a - w * .45, r1], [a + w * .45, r1], [a + w, r0]].map(function (p) { return [xw + p[1] * Math.cos(p[0]), yw + p[1] * Math.sin(p[0]), sg(zo + .006)]; }), [0, 0, s], SILVER, k, 4);
      }
      poly3(circle(xw, yw, .055, 10, 0, Math.PI * 2).slice(0, 10).map(function (p) { return [p[0], p[1], sg(zo + .009)]; }), [0, 0, s], TRIM, k, 5);
    });
    boxF(.52, .74, .94, 1.03, s * .7, s * .98, PAINT, 0);
  });
  /* porta de carga (parte traseira do lado L) */
  var PORT = [-1.7, .86, wB(-1.7) * .985 + .012];
  poly3([[PORT[0] - .09, PORT[1] - .06, PORT[2]], [PORT[0] + .09, PORT[1] - .06, PORT[2]], [PORT[0] + .09, PORT[1] + .06, PORT[2]], [PORT[0] - .09, PORT[1] + .06, PORT[2]]], [0, 0, 1], TRIM, 'L', 6);
  poly3([[PORT[0] - .03, PORT[1] - .02, PORT[2] + .003], [PORT[0] + .03, PORT[1] - .02, PORT[2] + .003], [PORT[0] + .03, PORT[1] + .02, PORT[2] + .003], [PORT[0] - .03, PORT[1] + .02, PORT[2] + .003]], [0, 0, 1], LEDY, 'L', 7);

  /* wallbox */
  var WB = [-1.7, 1.85];
  boxF(WB[0] - .17, WB[0] + .17, 0, 1.18, WB[1], WB[1] + .2, WALL, 0, WOBJ);
  boxF(WB[0] - .1, WB[0] + .1, .74, .9, WB[1] - .012, WB[1], LEDY, 0, WOBJ);
  boxF(WB[0] - .2, WB[0] + .2, 0, .05, WB[1] - .03, WB[1] + .23, WALL, 0, WOBJ);
  var CABLE = [], ci;
  for (ci = 0; ci <= 12; ci++) { var tt = ci / 12; CABLE.push([WB[0] + (PORT[0] - WB[0]) * tt, .6 - Math.sin(tt * 3.14) * .34 + tt * .26, WB[1] - .01 + (PORT[2] - WB[1] + .01) * tt]); }

  /* luzes (curvas coladas na superfície) */
  function curveOn(xs, ys, side) { var o = [], i; for (i = 0; i < xs.length; i++) o.push([xs[i], ys[i], side * zAt(xs[i], ys[i])]); return o; }
  function seq(a, b, n) { var o = [], i; for (i = 0; i <= n; i++) o.push(a + (b - a) * i / n); return o; }
  var LIGHTS = [];
  (function () {
    var tx = seq(-1.9, -2.285, 14), ty = tx.map(function () { return .75; });
    var tr = curveOn(tx, ty, 1), tl = curveOn(tx, ty, -1);
    LIGHTS.push({ pts: tl.concat(tr.slice().reverse()), c: [255, 40, 70], w: 2.6 });
    [1, -1].forEach(function (s) {
      var hx = seq(2.24, 1.62, 10), hy = hx.map(function (x, i) { return .6 + (.74 - .6) * i / 10; });
      LIGHTS.push({ pts: curveOn(hx, hy, s), c: [235, 245, 255], w: 2.2 });
      var fx = seq(2.14, 1.82, 5), fy = fx.map(function () { return .5; });
      LIGHTS.push({ pts: curveOn(fx, fy, s), c: [200, 225, 255], w: 1.3 });
    });
    [1, -1].forEach(function (s) { /* linha de caráter na cintura */
      var bx = seq(-1.85, 1.9, 24), by = bx.map(function (x) { return Math.min(yBelt(x), yTop(x) - .02) + .005; });
      LIGHTS.push({ pts: curveOn(bx, by, s), c: [255, 255, 255], w: 1, a: .22, e: 0, side: s > 0 ? 'L' : 'R' });
      [.52, -.46, -1.32].forEach(function (x) { /* frestas das portas */
        var r = ring(x), pts = [], i;
        for (i = 3; i <= 9; i++) pts.push([x, r[i][1], s * r[i][0] * 1.0]);
        LIGHTS.push({ pts: pts, c: [0, 0, 0], w: 1, a: .5, e: 0, side: s > 0 ? 'L' : 'R' });
      });
    });
  })();

  var PAINTS = { azul: [26, 104, 214], branco: [232, 234, 240], preto: [30, 31, 36], amarelo: [245, 197, 24], vermelho: [205, 28, 48] };
  var L1 = (function () { var v = [-.4, .8, -.55], l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
  var L2 = [.7, .15, -.7];
  var NV = P.length / 3, SX = new Float32Array(NV), SY = new Float32Array(NV), VX = new Float32Array(NV), VY = new Float32Array(NV), VZ = new Float32Array(NV);
  var VIS = [];

  function shade(m, nx, ny, nz, cx, cy, cz, pa) {
    var d = Math.max(0, nx * L1[0] + ny * L1[1] + nz * L1[2]), d2 = Math.max(0, nx * L2[0] + ny * L2[1] + nz * L2[2]);
    var il = 1 / Math.sqrt(cx * cx + cy * cy + cz * cz), vx = -cx * il, vy = -cy * il, vz = -cz * il;
    var ndv = Math.max(0, nx * vx + ny * vy + nz * vz);
    var hx = L1[0] + vx, hy = L1[1] + vy, hz = L1[2] + vz, hl = 1 / Math.sqrt(hx * hx + hy * hy + hz * hz);
    var sp = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) * hl), m === GLASS ? 40 : 50);
    var fr = Math.pow(1 - ndv, 3), env = .5 + .5 * ny, r, g, b, k;
    switch (m) {
      case PAINT: k = (.17 + .8 * d + .2 * d2) * (.72 + .28 * env); r = pa[0] * k + sp * 210 + fr * 45; g = pa[1] * k + sp * 210 + fr * 50; b = pa[2] * k + sp * 210 + fr * 70; break;
      case GLASS: r = 10 + env * 26 + sp * 110 + fr * 55; g = 16 + env * 38 + sp * 120 + fr * 70; b = 28 + env * 62 + sp * 140 + fr * 90; break;
      case TRIM: k = .55 + .7 * d; r = 24 * k + sp * 40; g = 25 * k + sp * 40; b = 29 * k + sp * 44; break;
      case TIRE: k = .5 + .8 * d; r = 19 * k; g = 19 * k; b = 21 * k; break;
      case RIMD: k = .5 + .8 * d; r = 40 * k + sp * 60; g = 42 * k + sp * 60; b = 50 * k + sp * 70; break;
      case SILVER: k = .5 + .65 * d; r = 188 * k + sp * 100; g = 192 * k + sp * 100; b = 202 * k + sp * 100; break;
      case WALL: k = .55 + .7 * d; r = 46 * k + sp * 50; g = 48 * k + sp * 50; b = 54 * k + sp * 55; break;
      case ARCH: r = 6; g = 6; b = 8; break;
      default: r = 255; g = 240; b = 170;
    }
    return 'rgb(' + (r > 255 ? 255 : r | 0) + ',' + (g > 255 ? 255 : g | 0) + ',' + (b > 255 ? 255 : b | 0) + ')';
  }

  /* ---------- renderização ---------- */
  function render(ctx, w, h, yaw, t, paint) {
    var pa = PAINTS[paint] || PAINTS.azul;
    var pitch = .22, cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var D = 12.8, f = w * 1.78, ox = w / 2, oy = h * .57, YC = .66, XC = 0, i, j, k, n;

    for (i = 0; i < NV; i++) {
      var x = P[i * 3] - XC, y = P[i * 3 + 1] - YC, z = P[i * 3 + 2];
      var x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw, y2 = y * cp + z1 * sp, z2 = -y * sp + z1 * cp, Z = z2 + D;
      VX[i] = x1; VY[i] = y2; VZ[i] = Z; SX[i] = ox + f * x1 / Z; SY[i] = oy - f * y2 / Z;
    }
    function tr(p) {
      var x = p[0] - XC, y = p[1] - YC, z = p[2];
      var x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw, y2 = y * cp + z1 * sp, z2 = -y * sp + z1 * cp, Z = z2 + D;
      return [ox + f * x1 / Z, oy - f * y2 / Z, Z, x1, y2];
    }
    function rn(a, b, c) { var x1 = a * cyw + c * syw, z1 = -a * syw + c * cyw; return [x1, b * cp + z1 * sp, -b * sp + z1 * cp]; }

    ctx.clearRect(0, 0, w, h);

    /* chão: brilho, sombra e anéis de carga */
    var g0 = tr([0, 0, 0]), pulse = (t * .5) % 1, gr = ctx.createRadialGradient(g0[0], g0[1], 0, g0[0], g0[1], w * .5);
    gr.addColorStop(0, 'rgba(245,197,24,.20)'); gr.addColorStop(1, 'rgba(245,197,24,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    function ringG(r, a) {
      ctx.beginPath();
      for (var s = 0; s <= 56; s++) { var p = tr([r * Math.cos(s / 56 * 6.2832), 0, r * .62 * Math.sin(s / 56 * 6.2832)]); if (s) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
      ctx.strokeStyle = 'rgba(245,197,24,' + a + ')'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    ringG(3.3, .15); ringG(2.4 + pulse * 1.9, (1 - pulse) * .3);
    ctx.save(); ctx.translate(g0[0], g0[1]); ctx.scale(1, .34);
    var sh = ctx.createRadialGradient(0, 0, 0, 0, 0, f * 2.5 / D);
    sh.addColorStop(0, 'rgba(0,0,0,.75)'); sh.addColorStop(.6, 'rgba(0,0,0,.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, f * 2.5 / D, 0, 6.2832); ctx.fill(); ctx.restore();

    /* grupos de lados visíveis */
    var GN = { L: [[0, 0, 1], [0, .7, .93]], R: [[0, 0, -1], [0, .7, -.93]] }, gv = {}, q, r2, pc;
    for (q in GN) { r2 = rn(GN[q][0][0], GN[q][0][1], GN[q][0][2]); pc = tr(GN[q][1]); gv[q] = r2[0] * pc[3] + r2[1] * pc[4] + r2[2] * pc[2] < 0; }

    /* faces visíveis */
    var lists = [[], [], []], fc, cx, cy, cz, nv, ix;
    for (i = 0; i < F.length; i++) {
      fc = F[i];
      if (fc.k && !gv[fc.k]) continue;
      ix = fc.i; cx = cy = cz = 0;
      for (j = 0; j < ix.length; j++) { cx += VX[ix[j]]; cy += VY[ix[j]]; cz += VZ[ix[j]]; }
      cx /= ix.length; cy /= ix.length; cz /= ix.length;
      nv = rn(fc.n[0], fc.n[1], fc.n[2]);
      if (nv[0] * cx + nv[1] * cy + nv[2] * cz > 0) continue;
      fc.z = cz - fc.pr * .5; fc.cx = cx; fc.cy = cy; fc.cz = cz; fc.nv = fc.ns ? rn(fc.ns[0], fc.ns[1], fc.ns[2]) : nv;
      lists[fc.o ? 2 : fc.k ? 1 : 0].push(fc);
    }
    for (i = 0; i < 3; i++) lists[i].sort(function (a, b) { return b.z - a.z; });

    function paintList(list) {
      for (var a = 0; a < list.length; a++) {
        var f2 = list[a], idx = f2.i, col, body = f2.m <= TRIM && !f2.k;
        col = shade(f2.m, f2.nv[0], f2.nv[1], f2.nv[2], f2.cx, f2.cy, f2.cz, pa);
        ctx.beginPath(); ctx.moveTo(SX[idx[0]], SY[idx[0]]);
        for (var m2 = 1; m2 < idx.length; m2++) ctx.lineTo(SX[idx[m2]], SY[idx[m2]]);
        ctx.closePath();
        ctx.fillStyle = col;
        if (f2.m === LEDY) { ctx.shadowColor = 'rgba(255,225,100,.9)'; ctx.shadowBlur = 8 + 5 * Math.sin(t * 5); }
        ctx.fill(); ctx.shadowBlur = 0;
        if (body) { ctx.strokeStyle = col; ctx.lineWidth = .8; ctx.stroke(); }
        else { ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = .5; ctx.stroke(); }
      }
    }
    var cab = CABLE.map(tr);
    function drawCable() {
      ctx.beginPath();
      for (var a = 0; a < cab.length; a++) { if (a) ctx.lineTo(cab[a][0], cab[a][1]); else ctx.moveTo(cab[a][0], cab[a][1]); }
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = '#0c0c0e'; ctx.lineWidth = 3.8; ctx.stroke();
      ctx.strokeStyle = 'rgba(245,197,24,.75)'; ctx.lineWidth = 1; ctx.stroke();
    }
    var wbFar = tr([WB[0], .6, WB[1] + .1])[2] > tr([0, .7, 0])[2];
    if (wbFar) { paintList(lists[2]); drawCable(); paintList(lists[0]); paintList(lists[1]); }
    else { paintList(lists[0]); paintList(lists[1]); drawCable(); paintList(lists[2]); }

    /* luzes e linhas de caráter: só os pontos virados para a câmera */
    function pvis(p) {
      var v = tr(p), e = rn(p[0] / 5.3, (p[1] - .66) / .8, p[2] / .87);
      return e[0] * v[3] + e[1] * v[4] + e[2] * v[2] < 0 ? v : null;
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (i = 0; i < LIGHTS.length; i++) {
      var lt = LIGHTS[i], run = [], pp, flush = function () {
        if (run.length > 1) {
          ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]);
          for (var a = 1; a < run.length; a++) ctx.lineTo(run[a][0], run[a][1]);
          if (lt.a) { ctx.strokeStyle = 'rgba(' + lt.c.join(',') + ',' + lt.a + ')'; ctx.lineWidth = lt.w; ctx.stroke(); }
          else {
            ctx.shadowColor = 'rgba(' + lt.c.join(',') + ',.95)'; ctx.shadowBlur = 9;
            ctx.strokeStyle = 'rgba(' + lt.c.join(',') + ',.95)'; ctx.lineWidth = lt.w; ctx.stroke(); ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = lt.w * .35; ctx.stroke();
          }
        }
        run = [];
      };
      if (lt.side && !gv[lt.side]) continue;
      for (j = 0; j < lt.pts.length; j++) { pp = pvis(lt.pts[j]); if (pp) run.push(pp); else flush(); }
      flush();
    }

    /* faísca na porta de carga */
    if (gv.L) {
      var pp2 = tr(PORT), fl = .55 + .45 * Math.sin(t * 9) * Math.sin(t * 4.3);
      var sg = ctx.createRadialGradient(pp2[0], pp2[1], 0, pp2[0], pp2[1], 18);
      sg.addColorStop(0, 'rgba(255,240,170,' + (.7 * fl) + ')'); sg.addColorStop(1, 'rgba(245,197,24,0)');
      ctx.fillStyle = sg; ctx.fillRect(pp2[0] - 18, pp2[1] - 18, 36, 36);
    }
  }

  /* ---------- visualizador (arrastar para girar + cores) ---------- */
  function viewer(cv) {
    var ctx = cv.getContext('2d'), yaw = .62, vel = reduce ? 0 : .32, drag = false, lx = 0, run = false, vis = true, last = 0, t0 = performance.now();
    var cw = 520, ch = 300, paint = cv.getAttribute('data-cor') || 'azul';
    function size() {
      var r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      cw = r.width || 520; ch = r.height || 300;
      cv.width = Math.round(cw * d); cv.height = Math.round(ch * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      draw();
    }
    function draw(now) { render(ctx, cw, ch, yaw, ((now || performance.now()) - t0) / 1000, paint); }
    function loop(now) {
      if (!run) return;
      var dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!drag) yaw += vel * dt;
      draw(now);
      requestAnimationFrame(loop);
    }
    function start() { if (reduce || run || !vis || document.hidden) return; run = true; last = performance.now(); requestAnimationFrame(loop); }
    function stop() { run = false; }
    cv.addEventListener('pointerdown', function (e) { drag = true; lx = e.clientX; cv.parentNode.classList.add('efx-used'); cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) return;
      yaw += (e.clientX - lx) * .012; lx = e.clientX;
      if (reduce) draw();
    });
    function up() { drag = false; cv.style.cursor = 'grab'; }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.style.cursor = 'grab';

    var box = document.createElement('div'); box.className = 'efx-cores'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Cor do carro');
    Object.keys(PAINTS).forEach(function (nm) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Cor ' + nm); b.title = nm.charAt(0).toUpperCase() + nm.slice(1);
      b.style.setProperty('--c', 'rgb(' + PAINTS[nm].join(',') + ')'); if (nm === paint) b.className = 'on';
      b.addEventListener('click', function () {
        paint = nm; Array.prototype.forEach.call(box.children, function (x) { x.className = ''; }); b.className = 'on';
        if (!run) draw();
      });
      box.appendChild(b);
    });
    cv.parentNode.appendChild(box);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { vis = en[0].isIntersecting; if (vis) { start(); } else { stop(); } }).observe(cv);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    window.addEventListener('resize', size);
    size(); start();
  }

  /* ---------- Fagulhas: rede de energia no fundo do hero ---------- */
  function plasma(host) {
    var cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    cv.className = 'efx-plasma'; cv.setAttribute('aria-hidden', 'true');
    host.insertBefore(cv, host.firstChild);
    var W = 0, H = 0, P = [], run = false, vis = true, arc = null, nextArc = 1500, last = 0;
    function size() {
      var r = host.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
      var n = W < 700 ? 14 : 30; P = [];
      for (var i = 0; i < n; i++) P.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .18, vy: -.05 - Math.random() * .16, r: .8 + Math.random() * 1.4 });
      draw(0);
    }
    function bolt(a, b) {
      var pts = [[a.x, a.y]], seg = 7, i, dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      for (i = 1; i < seg; i++) pts.push([a.x + dx * i / seg - dy / len * (Math.random() - .5) * 26, a.y + dy * i / seg + dx / len * (Math.random() - .5) * 26]);
      pts.push([b.x, b.y]); return pts;
    }
    function draw(dt) {
      var i, j, a, b, d;
      ctx.clearRect(0, 0, W, H);
      for (i = 0; i < P.length; i++) {
        a = P[i]; a.x += a.vx * dt * .06; a.y += a.vy * dt * .06;
        if (a.y < -10) { a.y = H + 10; a.x = Math.random() * W; }
        if (a.x < -10) a.x = W + 10; if (a.x > W + 10) a.x = -10;
        for (j = i + 1; j < P.length; j++) {
          b = P[j]; d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) { ctx.strokeStyle = 'rgba(245,197,24,' + (1 - d / 130) * .16 + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        ctx.fillStyle = 'rgba(245,197,24,.55)'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
      }
      if (arc) {
        ctx.strokeStyle = 'rgba(255,236,150,' + Math.max(0, arc.life / 180) * .65 + ')'; ctx.lineWidth = 1.4;
        ctx.shadowColor = 'rgba(245,197,24,.9)'; ctx.shadowBlur = 8; ctx.beginPath();
        arc.p.forEach(function (q, n) { n ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
        ctx.stroke(); ctx.shadowBlur = 0; arc.life -= dt; if (arc.life <= 0) arc = null;
      }
    }
    function loop(now) {
      if (!run) return;
      var dt = Math.min(50, now - last); last = now;
      nextArc -= dt;
      if (nextArc <= 0 && !arc && P.length > 3) { arc = { p: bolt(P[(Math.random() * P.length) | 0], P[(Math.random() * P.length) | 0]), life: 180 }; nextArc = 2500 + Math.random() * 3500; }
      draw(dt); requestAnimationFrame(loop);
    }
    function start() { if (reduce || run || !vis || document.hidden) return; run = true; last = performance.now(); requestAnimationFrame(loop); }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { vis = en[0].isIntersecting; if (vis) start(); else run = false; }).observe(host);
    document.addEventListener('visibilitychange', function () { if (document.hidden) run = false; else start(); });
    window.addEventListener('resize', size);
    size(); start();
  }

  window.EFX3D = { render: render };

  function init() {
    var cs = document.querySelectorAll('canvas[data-efx3d]');
    for (var i = 0; i < cs.length; i++) viewer(cs[i]);
    var hero = document.querySelector('.hero');
    if (hero && !reduce) plasma(hero);
  }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
