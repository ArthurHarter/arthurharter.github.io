/* Guia Elétrica Fácil — cenas 3D em canvas puro (sem bibliotecas) — v12:
   carro elétrico + wallbox (2 versões), disjuntor, lâmpada LED e painel solar.
   Renderizador próprio com z-buffer e sombreamento por pixel. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= utilitários ================= */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return a + (b - a) * t; }
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

  /* ================= malha ================= */
  function Mesh() { this.p = []; this.n = []; this.uv = []; this.ax = []; this.au = []; this.t = []; this.tm = []; this.ctr = null; }
  /* v(): se nx,ny,nz forem omitidos a normal é calculada (suave) a partir das faces */
  Mesh.prototype.v = function (x, y, z, u, v, ax, nx, ny, nz) {
    var i = this.p.length / 3, auto = nx === undefined;
    this.p.push(x, y, z); this.n.push(nx || 0, ny || 0, nz || 0); this.uv.push(u || 0, v || 0); this.ax.push(ax || 0); this.au.push(auto ? 1 : 0);
    return i;
  };
  Mesh.prototype.tri = function (a, b, c, m, g) {
    var P = this.p, c0 = this.ctr;
    if (c0) { /* orienta a face para fora (em relação ao centro da peça) */
      var ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
      var vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      var cx = (P[a * 3] + P[b * 3] + P[c * 3]) / 3 - c0[0], cy = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3 - c0[1], cz = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3 - c0[2];
      if (nx * cx + ny * cy + nz * cz < 0) { var tt = b; b = c; c = tt; }
    }
    this.t.push(a, b, c); this.tm.push(m, g || 0);
  };
  Mesh.prototype.quad = function (a, b, c, d, m, g) { this.tri(a, b, c, m, g); this.tri(a, c, d, m, g); };
  Mesh.prototype.finish = function () {
    var P = this.p, N = this.n, T = this.t, i, nv = P.length / 3;
    for (i = 0; i < T.length; i += 3) {
      var a = T[i], b = T[i + 1], c = T[i + 2];
      var ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
      var vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (this.au[a]) { N[a * 3] += nx; N[a * 3 + 1] += ny; N[a * 3 + 2] += nz; }
      if (this.au[b]) { N[b * 3] += nx; N[b * 3 + 1] += ny; N[b * 3 + 2] += nz; }
      if (this.au[c]) { N[c * 3] += nx; N[c * 3 + 1] += ny; N[c * 3 + 2] += nz; }
    }
    for (i = 0; i < nv; i++) {
      var l = Math.sqrt(N[i * 3] * N[i * 3] + N[i * 3 + 1] * N[i * 3 + 1] + N[i * 3 + 2] * N[i * 3 + 2]) || 1;
      N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l;
    }
    this.P = new Float32Array(P); this.N = new Float32Array(N); this.UV = new Float32Array(this.uv); this.AX = new Float32Array(this.ax);
    this.T = new Int32Array(T); this.TM = new Int16Array(this.tm);
    this.P0 = new Float32Array(P); this.N0 = new Float32Array(N); /* cópias p/ partes animadas */
    this.nv = nv; this.nt = T.length / 3;
    return this;
  };
  /* grade (nu × nv) de vértices; f(i,j) devolve [x,y,z,u,v,aux]; wrap fecha a direção j */
  Mesh.prototype.grid = function (nu, nv, f, m, g, wrap) {
    var ids = [], i, j, r, base;
    for (i = 0; i < nu; i++) { ids[i] = []; for (j = 0; j < nv; j++) { r = f(i, j); ids[i][j] = this.v(r[0], r[1], r[2], r[3], r[4], r[5]); } }
    for (i = 0; i < nu - 1; i++) for (j = 0; j < (wrap ? nv : nv - 1); j++) {
      var j2 = (j + 1) % nv; this.quad(ids[i][j], ids[i + 1][j], ids[i + 1][j2], ids[i][j2], m, g);
    }
    return ids;
  };

  /* caixa de cantos arredondados (normais exatas): r = raio do canto */
  Mesh.prototype.roundBox = function (cx, cy, cz, hx, hy, hz, r, seg, m, g) {
    var self = this, h = [hx, hy, hz], i, j, s, ax;
    r = Math.min(r, hx, hy, hz) * .999;
    var tk = []; for (i = 0; i <= seg; i++) tk.push(Math.sin(Math.PI / 2 * (i / seg * 2 - 1)));
    for (ax = 0; ax < 3; ax++) for (s = -1; s <= 1; s += 2) {
      var a1 = (ax + 1) % 3, a2 = (ax + 2) % 3, ids = [];
      for (i = 0; i <= seg; i++) { ids[i] = []; for (j = 0; j <= seg; j++) {
        var q = [0, 0, 0]; q[ax] = s; q[a1] = tk[i]; q[a2] = tk[j];
        var p0 = [q[0] * h[0], q[1] * h[1], q[2] * h[2]], d = [0, 0, 0], l = 0, k, pos = [0, 0, 0];
        for (k = 0; k < 3; k++) { var inn = clamp(p0[k], -(h[k] - r), h[k] - r); d[k] = p0[k] - inn; pos[k] = inn; l += d[k] * d[k]; }
        l = Math.sqrt(l) || 1;
        var nx = d[0] / l, ny = d[1] / l, nz = d[2] / l;
        ids[i][j] = self.v(cx + pos[0] + nx * r, cy + pos[1] + ny * r, cz + pos[2] + nz * r, 0, 0, 0, nx, ny, nz);
      } }
      for (i = 0; i < seg; i++) for (j = 0; j < seg; j++) {
        var A = ids[i][j], B = ids[i + 1][j], C = ids[i + 1][j + 1], D = ids[i][j + 1];
        /* orientação coerente com a normal do vértice */
        var P = self.p, ux = P[B * 3] - P[A * 3], uy = P[B * 3 + 1] - P[A * 3 + 1], uz = P[B * 3 + 2] - P[A * 3 + 2];
        var vx = P[D * 3] - P[A * 3], vy = P[D * 3 + 1] - P[A * 3 + 1], vz = P[D * 3 + 2] - P[A * 3 + 2];
        var fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
        if (fx * self.n[A * 3] + fy * self.n[A * 3 + 1] + fz * self.n[A * 3 + 2] < 0) { self.quad(A, D, C, B, m, g); } else self.quad(A, B, C, D, m, g);
      }
    }
  };
  /* sólido de revolução. prof = [[raio, altura],...]. eixo 'y' (padrão) ou 'z' (rodas) */
  Mesh.prototype.lathe = function (cx, cy, cz, prof, seg, m, g, axis, ax) {
    var self = this, saved = this.ctr;
    this.ctr = null;
    var ids = this.grid(prof.length, seg, function (i, j) {
      var a = j / seg * Math.PI * 2, r = prof[i][0], h = prof[i][1], c = Math.cos(a), s = Math.sin(a);
      return axis === 'z' ? [cx + r * c, cy + r * s, cz + h, a / 6.2832, i / (prof.length - 1), ax] : [cx + r * c, cy + h, cz + r * s, a / 6.2832, i / (prof.length - 1), ax];
    }, m, g, true);
    /* orienta as faces para fora usando a normal do eixo */
    this.ctr = saved; return ids;
  };
  /* tubo ao longo de uma polilinha */
  Mesh.prototype.tube = function (pts, rad, sides, m, g) {
    var n = pts.length, fr = [], i, prev = [0, 1, 0];
    var self = this;
    return this.grid(n, sides, function (i, j) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      var tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2], tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      var ux = 0, uy = 1, uz = 0; if (Math.abs(ty) > .9) { ux = 1; uy = 0; }
      var sx = uy * tz - uz * ty, sy = uz * tx - ux * tz, sz = ux * ty - uy * tx, sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1; sx /= sl; sy /= sl; sz /= sl;
      var qx = ty * sz - tz * sy, qy = tz * sx - tx * sz, qz = tx * sy - ty * sx;
      var ang = j / sides * 6.2832, c = Math.cos(ang) * rad, s = Math.sin(ang) * rad;
      return [pts[i][0] + sx * c + qx * s, pts[i][1] + sy * c + qy * s, pts[i][2] + sz * c + qz * s, i / (n - 1), j / sides, 0];
    }, m, g, true);
  };

  /* ================= materiais ================= */
  var M = { PAINT: 0, GLASS: 1, TRIM: 2, TIRE: 3, RIM: 4, ARCH: 5, WALL: 6, LED: 7, PLASTIC: 8, LEVER: 9, LABEL: 10, METAL: 11, BULB: 12, PV: 13, ALU: 14, CABLE: 15, BASE: 16, UNDER: 17 };

  /* ================= ambiente e luzes (espaço "mundo") ================= */
  var ER = 0, EG = 0, EB = 0;
  var SBX = [-.55, 0, -.83], SBL = Math.sqrt(SBX[0] * SBX[0] + SBX[2] * SBX[2]); SBX[0] /= SBL; SBX[2] /= SBL;
  function env(rx, ry, rz) {
    var r, g, b, t;
    if (ry >= 0) {
      t = sstep(0, .9, ry);
      r = mix(.50, .07, t); g = mix(.53, .09, t); b = mix(.60, .15, t);
      /* faixa de luz (softbox longo) e luminária no topo */
      var a = rx * SBX[0] + rz * SBX[2];
      var strip = sstep(.13, .05, Math.abs(ry - .34)) * sstep(.2, .65, a);
      var strip2 = sstep(.09, .03, Math.abs(ry - .62)) * sstep(.55, .9, -a) * .6;
      var top = sstep(.80, .93, ry) * .85;
      var warm = sstep(.72, .94, rx * .86 + ry * .2 + rz * .47) * .9;
      var l = strip * .95 + strip2 + top;
      r += l + warm * .95; g += l + warm * .72; b += l * 1.02 + warm * .14;
      r += sstep(.05, 0, ry) * .12; g += sstep(.05, 0, ry) * .12; b += sstep(.05, 0, ry) * .12; /* linha do horizonte */
    } else {
      t = sstep(0, -.7, ry);
      r = mix(.17, .035, t); g = mix(.145, .03, t); b = mix(.08, .02, t); /* chão com brilho quente */
    }
    ER = r; EG = g; EB = b;
  }
  /* luz principal (cima/esquerda/frente), preenchimento e contraluz — em espaço mundo */
  var LW = [[-.45, .78, .42], [.62, .22, -.55], [.1, .35, -.9]];
  (function () { for (var i = 0; i < 3; i++) { var l = Math.sqrt(LW[i][0] * LW[i][0] + LW[i][1] * LW[i][1] + LW[i][2] * LW[i][2]); LW[i][0] /= l; LW[i][1] /= l; LW[i][2] /= l; } })();
  var SUNW = [-.45, .78, .42]; /* o painel solar anima esta luz */

  /* uniformes mutáveis (cor do carro, lâmpada acesa etc.) */
  var U = { paint: [26, 104, 214], glow: 0, lever: 1, t: 0, tex: null, texW: 0, texH: 0 };
  var PAINTS = { azul: [24, 98, 210], branco: [232, 234, 240], preto: [26, 27, 32], amarelo: [245, 197, 24], vermelho: [200, 24, 44] };

  /* ================= rasterizador (buffer de visibilidade) ================= */
  function makeBuf(w, h) {
    var n = w * h;
    return { w: w, h: h, z: new Float32Array(n), tri: new Int32Array(n), bu: new Float32Array(n), bv: new Float32Array(n),
      cv: null, ctx: null, img: null, u32: null };
  }
  function ensureBuf(st, w, h) {
    var b = st.buf;
    if (b && b.w === w && b.h === h) return b;
    b = st.buf = makeBuf(w, h);
    b.cv = document.createElement('canvas'); b.cv.width = w; b.cv.height = h; b.ctx = b.cv.getContext('2d');
    b.img = b.ctx.createImageData(w, h); b.u32 = new Uint32Array(b.img.data.buffer);
    b.gw = 48; b.gh = Math.max(8, Math.round(48 * h / w)); b.gl = new Float32Array(b.gw * b.gh * 4);
    return b;
  }

  /* ================= sombreamento por pixel ================= */
  var cr = 0, cg = 0, cb = 0, ca = 255;
  var WC = null; /* centros das rodas: [[x,y,z],...] (cena do carro) */
  var LO = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; /* luzes em espaço do objeto */
  var CAMX = 0, CAMY = 0, CAMZ = 0, CYAW = 1, SYAW = 0;
  var EMI = 0, EMR = 0, EMG = 0, EMB = 0;
  var LEDC = [[255, 206, 70], [90, 235, 150], [255, 62, 84], [226, 240, 255], [255, 120, 60]];

  /* iluminação genérica: base (0..1), kd difuso, kr reflexo de ambiente, ks brilho, pw: 0 = largo, 1 = fino */
  var NX = 0, NY = 0, NZ = 0, VX = 0, VY = 0, VZ = 0;
  function light(r, g, b, kd, kr, ks, sharp, metal) {
    var ndv = NX * VX + NY * VY + NZ * VZ; if (ndv < 0) ndv = 0;
    var d1 = NX * LO[0][0] + NY * LO[0][1] + NZ * LO[0][2], d2 = NX * LO[1][0] + NY * LO[1][1] + NZ * LO[1][2], d3 = NX * LO[2][0] + NY * LO[2][1] + NZ * LO[2][2];
    if (d1 < 0) d1 = 0; if (d2 < 0) d2 = 0; if (d3 < 0) d3 = 0;
    var amb = .16 + .22 * (.5 + .5 * (NY * CYAW0)); /* céu/chão */
    var df = (amb + d1 * .85 + d2 * .22 + d3 * .3) * kd;
    /* brilho: Blinn-Phong com potências fixas por multiplicação (sem Math.pow) */
    var hx = LO[0][0] + VX, hy = LO[0][1] + VY, hz = LO[0][2] + VZ, hl = 1 / (Math.sqrt(hx * hx + hy * hy + hz * hz) || 1);
    var nh = (NX * hx + NY * hy + NZ * hz) * hl; if (nh < 0) nh = 0;
    var s2 = nh * nh, s4 = s2 * s2, s8 = s4 * s4, s16 = s8 * s8, s32 = s16 * s16, s64 = s32 * s32;
    var sp = (sharp ? s64 * s32 : s16 * s8) * ks + s8 * ks * .18;
    var f1 = 1 - ndv, f2 = f1 * f1, fr = f2 * f2 * f1; /* Fresnel^5 */
    var rr = kr * (.25 + .75 * fr);
    /* vetor refletido → mundo → ambiente */
    var k2 = 2 * ndv, rx = k2 * NX - VX, ry = k2 * NY - VY, rz = k2 * NZ - VZ;
    var wx = rx * CYAW + rz * SYAW, wz = -rx * SYAW + rz * CYAW;
    env(wx, ry, wz);
    var rgbm = metal ? 1 : 0;
    var spc = sp * (1 + fr * 2);
    cr = r * df * (1 - rr * .6) + ER * rr * (rgbm ? r * 1.5 : 1) + spc;
    cg = g * df * (1 - rr * .6) + EG * rr * (rgbm ? g * 1.5 : 1) + spc;
    cb = b * df * (1 - rr * .6) + EB * rr * (rgbm ? b * 1.5 : 1) + spc;
  }
  var CYAW0 = 1; /* inclinação "para cima" do objeto (sempre ny) */

  /* zonas da carroceria do carro (u = x ao longo do carro, v = parâmetro do perfil: 0 fundo → 1 centro do teto) */
  var VB = 5 / 9;
  function carBody(px, py, pz, u, v, ax) {
    var az = Math.abs(pz), P = U.paint, i;
    var r = P[0] / 255, g = P[1] / 255, b = P[2] / 255;
    /* pilares: linhas inclinadas no espaço (u,v) */
    var xA = .78 - (v - .585) * 1.25, xC = -1.86 + (v - .585) * 1.05, pw = .035;
    var vhi = sstep(.575, .595, v), vsd = vhi * (1 - sstep(.80, .83, v)); /* vsd: só a janela lateral termina antes do teto */
    var wsh = sstep(xA + pw - .006, xA + pw + .006, u) * sstep(1.06, 1.045, u) * vhi;
    var sid = sstep(xC + pw - .006, xC + pw + .006, u) * sstep(xA - pw + .006, xA - pw - .006, u) * vsd * (1 - sstep(.05, .035, Math.abs(u + .47)));
    var rear = sstep(-2.12, -2.1, u) * sstep(xC + .03, xC + .016, u) * vhi;
    var roof = 0;
    var gl = Math.max(wsh, sid, rear, roof), V1 = U.variant === 1;
    if (u > 1.06 || u < -2.12) gl = 0;
    if (V1 && v > .9 && u > -1.62 && u < .5) gl = Math.max(gl, sstep(.905, .925, v) * sstep(-1.62, -1.55, u) * sstep(.5, .43, u));
    var sill = sstep(.55, .565, v) * (1 - sstep(.585, .6, v));
    var pill = vhi * (1 - sstep(.935, .95, v)) * (u > -2.12 && u < 1.06 ? 1 : 0);
    var trimM = Math.max(sill * .96, pill * .95 * (1 - gl));
    var rocker = V1 ? sstep(.31, .22, v) : sstep(.27, .2, v), under = sstep(.16, .08, v);
    /* para-choques escuros (entrada de ar na frente, difusor atrás) */
    var bf = sstep(1.96, 2.1, u) * sstep(.42, .36, v), br2 = sstep(-2.0, -2.14, u) * sstep(.4, .33, v);
    var bump = Math.max(bf, br2);
    /* frestas das portas e maçanetas */
    var sideF = sstep(.35, .7, az / .93) * sstep(.2, .28, v) * (1 - sstep(.53, .555, v));
    var seam = 0, xs = [.62, -.47, -1.38];
    for (i = 0; i < 3; i++) seam = Math.max(seam, sstep(.008, .002, Math.abs(u - xs[i])));
    seam *= sideF * .55;
    /* maçanetas embutidas: pastilha escura com filete de luz em cima */
    var hbx = Math.max(sstep(.085, .07, Math.abs(u - .08)), sstep(.085, .07, Math.abs(u + .9)));
    var hnd = hbx * sstep(.016, .01, Math.abs(v - .495)) * sideF;
    var hlt = hbx * sstep(.004, .0015, Math.abs(v - .519)) * sideF;
    var arch = sstep(.35, .7, ax);
    /* capô: junta lateral, junta dianteira e vinco central */
    var onHood = sstep(1.1, 1.14, u) * sstep(2.1, 2.04, u) * sstep(.6, .64, v);
    var hseam = sstep(.006, .0015, Math.abs(v - (.80 + (u - 1.1) * .03))) * onHood;
    var hfront = sstep(.01, .003, Math.abs(u - 2.0 - (v - .8) * .12)) * sstep(.62, .66, v) * sstep(.97, .93, v) * sstep(2.1, 2.0, u);
    var hmid = sstep(.03, .005, 1 - v) * onHood * .5;
    var hdk = Math.max(hseam, hfront) * .6;
    var crease = sstep(.014, .002, Math.abs(v - .445)) * sstep(-1.9, -1.7, u) * sstep(1.8, 1.6, u) * sideF * .25;
    /* faróis: caixa escura com faixa de LED; lanterna traseira em barra vermelha */
    var sideW = sstep(.14, .3, az);
    var fh = sstep(1.7, 1.8, u) * sstep(.405, .43, v) * sstep(.6, .57, v) * sideW * (1 - bump * .6);
    var fdrl = fh * sstep(.016, .004, Math.abs(v - .505 + (u - 1.74) * .05));
    /* painel frontal fechado (EV) + entrada de ar inferior com aletas */
    var nose = sstep(2.08, 2.14, u) * sstep(.435, .46, v) * sstep(.59, .565, v) * sstep(.5, .4, az) * (1 - fh);
    var slat = .5 + .5 * Math.sin(az * 95);
    var intake = bf * sstep(.26, .3, v) * sstep(.54, .5, az) * sstep(2.08, 2.13, u);
    /* lente do farol: refletor escuro + projetor */
    var ldx = (u - 1.93) / .07, ldz = (az - .6) / .09, ld = Math.sqrt(ldx * ldx + ldz * ldz);
    var lens = fh * sstep(1.1, .6, ld), bez = fh * sstep(1.5, 1.1, ld) * (1 - lens);
    var tl = sstep(-1.9, -1.97, u) * sstep(.42, .44, v) * sstep(.545, .52, v);
    /* versão 2 (home): barra de DRL contínua entre os faróis */
    var fbar = V1 ? sstep(1.9, 2.0, u) * sstep(.5, .36, az) * sstep(.011, .003, Math.abs(v - .505 - (u - 1.74) * .05)) * (1 - bump) : 0;
    var tbar = tl * sstep(.022, .007, Math.abs(v - .485));
    /* composição da cor-base */
    var br = r * (1 - seam), bg = g * (1 - seam), bb = b * (1 - seam), kr = .34, ks = 1;
    var q = 1 - hnd * .45; br *= q; bg *= q; bb *= q;
    q = rocker * .92; br = mix(br, .035, q); bg = mix(bg, .035, q); bb = mix(bb, .04, q);
    q = hnd * .85; br = mix(br, .02, q); bg = mix(bg, .022, q); bb = mix(bb, .028, q);
    q = hdk; br *= 1 - q; bg *= 1 - q; bb *= 1 - q;
    q = nose * .94; br = mix(br, .012, q); bg = mix(bg, .016, q); bb = mix(bb, .026, q);
    q = Math.max(trimM, bump * .9, fh * .93, tl * .9); br = mix(br, .016, q); bg = mix(bg, .018, q); bb = mix(bb, .022, q);
    kr = mix(kr, .3, q);
    br = mix(br, .008, gl); bg = mix(bg, .014, gl); bb = mix(bb, .026, gl);
    kr = mix(kr, .5, gl);
    q = Math.max(under, arch); br = mix(br, .012, q); bg = mix(bg, .012, q); bb = mix(bb, .014, q); kr = mix(kr, .08, q);
    var paintK = (1 - gl) * (1 - Math.max(q, rocker, bump)) ;
    var fl = hash2(Math.floor(u * 260), Math.floor(v * 260));
    var flake = paintK * (fl > .93 ? 1 : 0), op = paintK * (fl - .5) * .05; /* casca de laranja sutil */
    light(br * (1 + op), bg * (1 + op), bb * (1 + op), 1 - gl * .85, kr, ks * (1 + gl * 1.2), 1, 0);
    cr += flake * (V1 ? .022 : .05) * (.4 + cr); cg += flake * (V1 ? .022 : .05) * (.4 + cg); cb += flake * (V1 ? .022 : .05) * (.4 + cb);
    cr += hlt * .3 + hmid * .12; cg += hlt * .3 + hmid * .12; cb += hlt * .3 + hmid * .12;
    cr += intake * (1 - slat) * .06; cg += intake * (1 - slat) * .07; cb += intake * (1 - slat) * .09;
    cr += nose * .035; cg += nose * .045; cb += nose * .07;
    cr += bez * .1 + lens * .55; cg += bez * .11 + lens * .6; cb += bez * .12 + lens * .7;
    cr += crease * .2 * (1 - gl); cg += crease * .2 * (1 - gl); cb += crease * .2 * (1 - gl);
    /* emissivos (cores puras, somadas sobre base preta) */
    var core = fh * sstep(.62, .14, ld); /* projetor aceso: núcleo claro dentro da lente */
    cr += core * .85; cg += core * .9; cb += core;
    fdrl = Math.max(fdrl, fbar);
    cr += fdrl * 1.05 + tbar * 1.5; cg += fdrl * 1.08 + tbar * .1; cb += fdrl * 1.15 + tbar * .16;
    cr += tl * .1; cg += fh * .015; cb += fh * .03;
    if (tbar > .35 || fdrl > .35 || core > .4) { EMI = Math.max(tbar, fdrl, core * .8); if (tbar > Math.max(fdrl, core)) { EMR = 1; EMG = .15; EMB = .2; } else { EMR = .85; EMG = .93; EMB = 1; } }
  }


  /* ===== carroceria do esportivo elétrico (variante 2): cabine avançada, traseira larga, sem grade ===== */
  function carBodyS(px, py, pz, u, v, ax) {
    var az = Math.abs(pz), P = U.paint, i;
    var r = P[0] / 255, g = P[1] / 255, b = P[2] / 255;
    var pw = .03, vhi = sstep(.575, .595, v), vsd = vhi * (1 - sstep(.80, .83, v));
    var xA = 1.12 - (v - .585) * 1.7, xC = -1.2 + (v - .585) * 1.25;
    /* vidros: para-brisa, laterais e vidro traseiro */
    var wsh = sstep(xA + pw - .006, xA + pw + .006, u) * sstep(1.2, 1.185, u) * vhi * sstep(.97, .93, v);
    var sid = sstep(xC + pw - .006, xC + pw + .006, u) * sstep(xA - pw + .006, xA - pw - .006, u) * vsd;
    var rear = sstep(-1.82, -1.8, u) * sstep(xC - pw + .006, xC - pw - .006, u) * vhi * sstep(.9, .86, v);
    var gl = Math.max(wsh, sid, rear);
    if (u > 1.2 || u < -1.82) gl = 0;
    /* soleira e moldura do vidro */
    var sill = sstep(.55, .565, v) * (1 - sstep(.585, .6, v));
    var trimM = sill * .95;
    var rocker = sstep(.3, .22, v), under = sstep(.16, .08, v);
    var bf = sstep(1.98, 2.1, u) * sstep(.36, .3, v), br2 = sstep(-1.98, -2.12, u) * sstep(.44, .36, v);
    var bump = Math.max(bf, br2);
    /* portas: frestas e maçaneta embutida */
    var sideF = sstep(.35, .7, az / .95) * sstep(.2, .28, v) * (1 - sstep(.53, .555, v));
    var seam = Math.max(sstep(.008, .002, Math.abs(u - 1.0)), sstep(.008, .002, Math.abs(u + .3))) * sideF * .5;
    var hbx = sstep(.08, .065, Math.abs(u + .12)), hnd = hbx * sstep(.014, .008, Math.abs(v - .49)) * sideF;
    /* lâmina lateral de ar (entrada de refrigeração das baterias/motor) com aletas */
    var blade = sstep(-1.38, -1.3, u) * sstep(-.52, -.6, u) * sstep(.22, .27, v) * sstep(.545, .5, v) * sstep(.5, .75, az / .95);
    var bl = .5 + .5 * Math.sin(u * 80);
    /* capô: vinco central e junta */
    var onHood = sstep(1.22, 1.3, u) * sstep(2.1, 2.0, u) * sstep(.74, .8, v);
    var hseam = sstep(.006, .0015, Math.abs(v - .83)) * sstep(1.25, 1.35, u) * sstep(2.05, 1.95, u) * .5;
    /* tampa traseira com aletas aerodinâmicas */
    var deck = sstep(-1.78, -1.7, u) * sstep(-1.02, -1.1, u) * sstep(.86, .9, v);
    var lv = deck * (.5 + .5 * Math.sin(u * 62));
    /* faróis finos de LED, faixa de DRL azul-gelo e linha de luz contínua no focinho */
    var sideW = sstep(.2, .35, az);
    var fh = sstep(1.62, 1.72, u) * sstep(.435, .46, v) * sstep(.6, .575, v) * sideW * (1 - bump * .5);
    var fdrl = fh * sstep(.016, .004, Math.abs(v - .535 + (u - 1.9) * .06));
    var nline = sstep(2.0, 2.1, u) * sstep(.55, .4, az) * sstep(.008, .002, Math.abs(v - .52 - (u - 2.0) * .04)) * (1 - bump);
    var ldx = (u - 1.92) / .1, ldz = (az - .72) / .09, ld = Math.sqrt(ldx * ldx + ldz * ldz);
    var lens = fh * sstep(1.1, .6, ld), bez = fh * sstep(1.5, 1.1, ld) * (1 - lens), core = fh * sstep(.6, .15, ld);
    /* lanterna traseira: barra contínua + cantos */
    var tl = sstep(-1.92, -2.0, u) * sstep(.46, .48, v) * sstep(.58, .55, v);
    var tbar = tl * sstep(.02, .006, Math.abs(v - .52));
    var corner = sstep(-1.78, -1.9, u) * sstep(.52, .56, v) * sstep(.64, .6, v) * sstep(.55, .75, az / .95) * (1 - tl);
    /* composição */
    var br = r * (1 - seam), bg = g * (1 - seam), bb = b * (1 - seam), kr = .36, ks = 1.1;
    var q = hnd * .85; br = mix(br, .02, q); bg = mix(bg, .022, q); bb = mix(bb, .028, q);
    q = Math.max(rocker * .93, blade * .9, bump * .92, trimM, lv * .55, fh * .93, tl * .9, corner * .8, hseam * .5);
    br = mix(br, .016, q); bg = mix(bg, .018, q); bb = mix(bb, .022, q); kr = mix(kr, .3, q);
    br = mix(br, .007, gl); bg = mix(bg, .012, gl); bb = mix(bb, .024, gl); kr = mix(kr, .55, gl);
    q = under; br = mix(br, .012, q); bg = mix(bg, .012, q); bb = mix(bb, .014, q); kr = mix(kr, .08, q);
    var paintK = (1 - gl) * (1 - Math.max(q, rocker, bump, blade));
    var fl = hash2(Math.floor(u * 300), Math.floor(v * 300));
    var flake = paintK * (fl > .94 ? 1 : 0);
    light(br, bg, bb, 1 - gl * .85, kr, ks * (1 + gl * 1.3), 1, 0);
    cr += flake * .03 * (.4 + cr); cg += flake * .03 * (.4 + cg); cb += flake * .03 * (.4 + cb);
    var bs = blade * (1 - bl) * .06; cr += bs; cg += bs; cb += bs * 1.2;
    cr += bez * .1 + lens * .55; cg += bez * .11 + lens * .6; cb += bez * .12 + lens * .7;
    cr += core * .85; cg += core * .92; cb += core;
    var drl = Math.max(fdrl, nline);
    cr += drl * .85; cg += drl * 1.0; cb += drl * 1.2;
    cr += tbar * 1.5 + corner * .55; cg += tbar * .08 + corner * .02; cb += tbar * .14 + corner * .04;
    if (tbar > .35 || drl > .35 || core > .4) { EMI = Math.max(tbar, drl, core * .8); if (tbar > Math.max(drl, core)) { EMR = 1; EMG = .15; EMB = .2; } else { EMR = .8; EMG = .92; EMB = 1; } }
  }

  function wheelShade(m, g, px, py, pz) {
    var w = WC[g], dx = px - w[0], dy = py - w[1], rad = Math.sqrt(dx * dx + dy * dy);
    if (m === M.TIRE) {
      var tt = sstep(.26, .3, rad) * (1 - sstep(.335, .37, rad));
      light(.05 + tt * .012, .05 + tt * .012, .055 + tt * .012, 1, .05, .1, 0, 0);
      /* anel de ressalto na parede lateral */
      var ring = sstep(.006, .001, Math.abs(rad - .315)) * .35;
      cr += ring * .05; cg += ring * .05; cb += ring * .055;
      return;
    }
    /* RIM: raios em "Y" duplo, anel externo e cubo */
    var ang = Math.atan2(dy, dx) + U.t * 0, a5 = ang * (U.variant >= 1 ? 10 : 5) / 6.28319 + (U.variant >= 1 ? rad * 2.2 : 0), fa = a5 - Math.floor(a5) - .5;
    var wsp = U.variant >= 1 ? mix(.09, .14, sstep(.06, .24, rad)) : mix(.17, .27, sstep(.06, .24, rad));
    var spoke = sstep(wsp + .02, wsp - .02, Math.abs(fa)) * sstep(.045, .075, rad);
    var lip = sstep(.215, .225, rad);
    var cap = 1 - sstep(.045, .05, rad);
    var sol = Math.max(spoke, lip, cap);
    var k = sol > .5 ? 1 : 0;
    /* interior: disco de freio e sombra */
    var br = mix(.05, .66, sol), bgc = mix(.05, .68, sol), bbc = mix(.06, .72, sol);
    if (U.variant >= 1) { var lp = lip * (1 - cap), gr = mix(.13, .72, lp); br = mix(.05, gr, sol); bgc = mix(.05, gr * 1.02, sol); bbc = mix(.06, gr * 1.06, sol); }
    light(br, bgc, bbc, mix(.5, 1, sol), mix(.2, .9, sol), mix(.2, 1.1, sol), 0, 1);
    if (cap > .5) { cr *= .45; cg *= .45; cb *= .5; }
    if (U.variant === 2 && sol < .5) { /* pinça de freio atrás dos raios */
      var cang = Math.atan2(dy, dx), cal = sstep(.1, .13, rad) * sstep(.215, .19, rad) * sstep(.62, .5, Math.abs(cang - .9));
      if (cal > .5) { light(.78, .08, .06, 1, .3, .9, 1, 0); }
    }
  }

  function shade(m, g, px, py, pz, nx, ny, nz, u, v, ax) {
    /* vetores */
    var vx = CAMX - px, vy = CAMY - py, vz = CAMZ - pz, vl = 1 / (Math.sqrt(vx * vx + vy * vy + vz * vz) || 1);
    vx *= vl; vy *= vl; vz *= vl;
    var nl = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1); nx *= nl; ny *= nl; nz *= nl;
    if (nx * vx + ny * vy + nz * vz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    NX = nx; NY = ny; NZ = nz; VX = vx; VY = vy; VZ = vz; ca = 255; EMI = 0;
    var c;
    switch (m) {
      case M.PAINT: if (U.variant === 2) carBodyS(px, py, pz, u, v, ax); else carBody(px, py, pz, u, v, ax); break;
      case M.TIRE: case M.RIM: wheelShade(m, g, px, py, pz); break;
      case M.ARCH: light(.012, .012, .014, 1, .02, 0, 0, 0); break;
      case M.UNDER: light(.02, .02, .024, .6, .05, 0, 0, 0); break;
      case M.TRIM: light(.03, .03, .035, 1, .3, 1, 1, 0); break;
      case M.GLASS: light(.01, .018, .03, .3, .8, 1.6, 1, 0); break;
      case M.WALL: light(.86, .87, .9, 1, .14, .5, 0, 0); break;
      case M.BASE: light(.12, .125, .14, 1, .1, .3, 0, 0); break;
      case M.CABLE: light(.035, .035, .04, 1, .2, .7, 0, 0); break;
      case M.PLASTIC: light(.8, .81, .83, 1, .1, .35, 0, 0); break;
      case M.LEVER: light(.025, .025, .03, 1, .3, 1.2, 1, 0); break;
      case M.METAL: light(.62, .64, .68, .8, .75, 1.1, 1, 1); break;
      case M.ALU: light(.7, .72, .76, .8, .62, .9, 0, 1); break;
      case M.LED:
        c = g === 5 ? LEDC[U.on ? 1 : 2] : (LEDC[g] || LEDC[0]); var pl = g === 0 ? .78 + .22 * Math.sin(U.t * 5) : 1;
        EMI = pl; EMR = c[0] / 255; EMG = c[1] / 255; EMB = c[2] / 255;
        cr = c[0] / 255 * pl * 1.1; cg = c[1] / 255 * pl * 1.1; cb = c[2] / 255 * pl * 1.1; break;
      case M.LABEL: labelShade(g, u, v); break;
      case M.BULB: bulbShade(); break;
      case M.PV: pvShade(u, v); break;
      default: light(.5, .5, .5, 1, .2, .3, 0, 0);
    }
    /* curva de tom suave (ombro): realces não estouram em branco chapado */
    cr = shoulder(cr) * 255; cg = shoulder(cg) * 255; cb = shoulder(cb) * 255;
    if (cr > 255) cr = 255; if (cg > 255) cg = 255; if (cb > 255) cb = 255;
    if (cr < 0) cr = 0; if (cg < 0) cg = 0; if (cb < 0) cb = 0;
  }

  function shoulder(x) { return x < .72 ? x : .72 + .28 * (1 - Math.exp(-(x - .72) / .28)); }
  /* ruído barato e estável (hash) para flocos metálicos / casca de laranja */
  function hash2(x, y) { var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
  function labelShade(g, u, v) {
    var T = U.texs && U.texs[g];
    if (!T) { light(.95, .95, .95, 1, .05, .2, 0, 0); return; }
    var ix = clamp((u * T.w) | 0, 0, T.w - 1), iy = clamp(((1 - v) * T.h) | 0, 0, T.h - 1), o = (iy * T.w + ix) * 4;
    light(T.d[o] / 255, T.d[o + 1] / 255, T.d[o + 2] / 255, 1, .06, .25, 0, 0);
  }
  function bulbShade() {
    /* aceso: vidro leitoso com núcleo branco-quente e borda âmbar (volume), brilho especular mantido */
    var ndv = NX * VX + NY * VY + NZ * VZ, gl = U.glow;
    if (ndv < 0) ndv = 0;
    light(.78, .8, .82, 1, .28, .9, 1, 0);
    var k = ndv * ndv, k2 = k * k, top = NY > 0 ? NY * .1 : 0;
    var lr = mix(.9, 1, k) * (.86 + .22 * k2) + top, lg = mix(.5, .93, k) * (.84 + .22 * k2) + top, lb = mix(.1, .62, k2) * (.8 + .3 * k2) + top * .6;
    var sr = Math.max(0, cr - .5) * .35;
    cr = mix(cr, lr + sr, gl); cg = mix(cg, lg + sr, gl); cb = mix(cb, lb + sr, gl);
  }
  function pvShade(u, v) {
    /* u,v = coordenadas locais do painel (m): células 6 × 10 */
    var cw = 1.0 / 6, ch = 1.6 / 10, fu = (u + .5) / cw, fv = (v + .8) / ch;
    var cu = fu - Math.floor(fu), cv = fv - Math.floor(fv);
    var gap = Math.max(sstep(.04, .0, cu), sstep(.96, 1, cu), sstep(.03, .0, cv), sstep(.97, 1, cv));
    var bus = 0, k; for (k = 1; k <= 3; k++) bus = Math.max(bus, sstep(.012, .002, Math.abs(cu - k / 4)));
    var finger = sstep(.06, .0, Math.abs(((cv * 14) % 1) - .5) - .44) * .0;
    var tone = .06 + .05 * (.5 + .5 * Math.sin(Math.floor(fu) * 1.7 + Math.floor(fv) * 2.3));
    var r = mix(.025 + tone * .35, .78, gap * .85), g = mix(.05 + tone * .6, .8, gap * .85), b = mix(.13 + tone * 1.3, .82, gap * .85);
    r = mix(r, .72, bus * (1 - gap) * .6); g = mix(g, .74, bus * (1 - gap) * .6); b = mix(b, .78, bus * (1 - gap) * .6);
    light(r, g, b, .9, mix(.62, .25, gap), 1.4, 1, 0);
  }

  /* ================= renderização ================= */
  function renderScene(sc, st, ctx, cw, ch) {
    var mesh = sc.mesh, nv = mesh.nv, nt = mesh.nt;
    var rs = st.scale, rw = Math.max(32, Math.round(cw * rs)), rh = Math.max(32, Math.round(ch * rs));
    var b = ensureBuf(st, rw, rh);
    var yaw = st.yaw, pitch = sc.pitch, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var D = sc.dist, f = rw * sc.focal, ox = rw * (sc.cx === undefined ? .5 : sc.cx), oy = rh * sc.cy, T = sc.target, i;
    if (!st.SX || st.SX.length !== nv) { st.SX = new Float32Array(nv); st.SY = new Float32Array(nv); st.IW = new Float32Array(nv); }
    var SX = st.SX, SY = st.SY, IW = st.IW, P = mesh.P;
    for (i = 0; i < nv; i++) {
      var x = P[i * 3] - T[0], y = P[i * 3 + 1] - T[1], z = P[i * 3 + 2] - T[2];
      var x1 = x * cy + z * sy, z1 = -x * sy + z * cy, y2 = y * cp + z1 * sp, z2 = -y * sp + z1 * cp, Z = z2 + D;
      IW[i] = 1 / Z; SX[i] = ox + f * x1 / Z; SY[i] = oy - f * y2 / Z;
    }
    /* luzes e câmera no espaço do objeto */
    var Ls = sc.lights || LW;
    for (i = 0; i < 3; i++) { var a = Ls[i][0], c = Ls[i][2]; LO[i][0] = a * cy - c * sy; LO[i][1] = Ls[i][1]; LO[i][2] = a * sy + c * cy; }
    CAMX = T[0] + D * cp * sy; CAMY = T[1] + D * sp; CAMZ = T[2] - D * cp * cy; CYAW = cy; SYAW = sy;

    /* ---- passo 1: visibilidade ---- */
    var zb = b.z, tb = b.tri, bu = b.bu, bv = b.bv, n = rw * rh, TI = mesh.T;
    zb.fill(0); tb.fill(-1);
    for (i = 0; i < nt; i++) {
      var ia = TI[i * 3], ib = TI[i * 3 + 1], ic = TI[i * 3 + 2];
      var x0 = SX[ia], y0 = SY[ia], x1b = SX[ib], y1 = SY[ib], x2 = SX[ic], y2b = SY[ic];
      var area = (x1b - x0) * (y2b - y0) - (x2 - x0) * (y1 - y0);
      if (area > -1e-4 && area < 1e-4) continue;
      var minx = Math.floor(Math.min(x0, x1b, x2)), maxx = Math.ceil(Math.max(x0, x1b, x2)), miny = Math.floor(Math.min(y0, y1, y2b)), maxy = Math.ceil(Math.max(y0, y1, y2b));
      if (minx < 0) minx = 0; if (miny < 0) miny = 0; if (maxx > rw - 1) maxx = rw - 1; if (maxy > rh - 1) maxy = rh - 1;
      if (minx > maxx || miny > maxy) continue;
      var inv = 1 / area, a0 = (y1 - y2b) * inv, b0 = (x2 - x1b) * inv, c0 = (x1b * y2b - x2 * y1) * inv;
      var a1 = (y2b - y0) * inv, b1 = (x0 - x2) * inv, c1 = (x2 * y0 - x0 * y2b) * inv;
      var iw0 = IW[ia], iw1 = IW[ib], iw2 = IW[ic], py, px, rowo;
      for (py = miny; py <= maxy; py++) {
        var yc = py + .5, w0 = c0 + b0 * yc + a0 * (minx + .5), w1 = c1 + b1 * yc + a1 * (minx + .5);
        rowo = py * rw;
        for (px = minx; px <= maxx; px++, w0 += a0, w1 += a1) {
          if (w0 < -1e-5 || w1 < -1e-5) continue;
          var w2 = 1 - w0 - w1; if (w2 < -1e-5) continue;
          var iz = w0 * iw0 + w1 * iw1 + w2 * iw2, o = rowo + px;
          if (iz > zb[o]) { zb[o] = iz; tb[o] = i; bu[o] = w1; bv[o] = w2; }
        }
      }
    }

    /* ---- passo 2: sombreamento só dos pixels visíveis ---- */
    var N = mesh.N, UV = mesh.UV, AX = mesh.AX, TM = mesh.TM, u32 = b.u32, o2, idx;
    var yy, xx, gl = b.gl; gl.fill(0);
    for (o2 = 0; o2 < n; o2++) {
      var t = tb[o2];
      if (t < 0) { u32[o2] = 0; continue; }
      var ja = TI[t * 3], jb = TI[t * 3 + 1], jc = TI[t * 3 + 2];
      var s1 = bu[o2], s2 = bv[o2], s0 = 1 - s1 - s2, iz2 = zb[o2];
      var k0 = s0 * IW[ja] / iz2, k1 = s1 * IW[jb] / iz2, k2 = s2 * IW[jc] / iz2;
      var px2 = k0 * P[ja * 3] + k1 * P[jb * 3] + k2 * P[jc * 3], py2 = k0 * P[ja * 3 + 1] + k1 * P[jb * 3 + 1] + k2 * P[jc * 3 + 1], pz2 = k0 * P[ja * 3 + 2] + k1 * P[jb * 3 + 2] + k2 * P[jc * 3 + 2];
      var nx = k0 * N[ja * 3] + k1 * N[jb * 3] + k2 * N[jc * 3], ny = k0 * N[ja * 3 + 1] + k1 * N[jb * 3 + 1] + k2 * N[jc * 3 + 1], nz = k0 * N[ja * 3 + 2] + k1 * N[jb * 3 + 2] + k2 * N[jc * 3 + 2];
      var uu = k0 * UV[ja * 2] + k1 * UV[jb * 2] + k2 * UV[jc * 2], vv = k0 * UV[ja * 2 + 1] + k1 * UV[jb * 2 + 1] + k2 * UV[jc * 2 + 1];
      var axx = k0 * AX[ja] + k1 * AX[jb] + k2 * AX[jc];
      shade(TM[t * 2], TM[t * 2 + 1], px2, py2, pz2, nx, ny, nz, uu, vv, axx);
      u32[o2] = (255 << 24) | ((cb | 0) << 16) | ((cg | 0) << 8) | (cr | 0);
      if (EMI > .25) { /* acumula o brilho das luzes (bloom) numa grade grossa */
        yy = (o2 / rw) | 0; xx = o2 - yy * rw; var gc = (((yy * b.gh / rh) | 0) * b.gw + ((xx * b.gw / rw) | 0)) * 4;
        gl[gc] += EMR; gl[gc + 1] += EMG; gl[gc + 2] += EMB; gl[gc + 3] += EMI;
      }
    }
    /* suaviza a silhueta: pixels de borda ficam parcialmente transparentes */
    var e;
    for (yy = 1; yy < rh - 1; yy++) for (xx = 1; xx < rw - 1; xx++) {
      idx = yy * rw + xx;
      if (tb[idx] < 0) continue;
      e = (tb[idx - 1] < 0 ? 1 : 0) + (tb[idx + 1] < 0 ? 1 : 0) + (tb[idx - rw] < 0 ? 1 : 0) + (tb[idx + rw] < 0 ? 1 : 0);
      if (e) { var al = e > 2 ? 110 : e > 1 ? 170 : 215; u32[idx] = (u32[idx] & 0x00ffffff) | (al << 24); }
    }
    b.ctx.putImageData(b.img, 0, 0);
    return b;
  }

  /* ================= CENA: carro elétrico + wallbox ================= */
  var SC = {};
  var LEN = 2.3, WHX = [1.4, -1.4], WYC = .36, WZC = .775, ARCH_IN = .405, ARCH_OUT = .475, ARCH_Z = .6;
  var yTop = hermite([[-2.3, .93], [-2.22, 1.0], [-2.05, 1.05], [-1.75, 1.13], [-1.35, 1.28], [-.85, 1.39], [-.25, 1.435], [.25, 1.39], [.68, 1.19], [1.0, 1.0], [1.4, .91], [1.9, .84], [2.15, .76], [2.3, .64]]);
  var yBelt = hermite([[-2.3, .66], [-2, .85], [-1, .93], [.3, .92], [1.2, .87], [2, .78], [2.3, .64]]);
  var yBot = hermite([[-2.3, .38], [-2.15, .27], [-1.8, .22], [1.8, .22], [2.15, .26], [2.3, .34]]);
  function wB(x) { var u = Math.min(1, Math.abs(x) / LEN), e = x > 0 ? 7 : 6; return .95 * (1 - .05 * sstep(.2, 1, x / LEN)) * Math.pow(Math.max(0, 1 - Math.pow(u, e)), 1 / e); }
  function flare(x) { var a = (x - WHX[0]) / .5, b = (x - WHX[1]) / .5; return Math.exp(-a * a) + Math.exp(-b * b); } /* para-lamas mais largos sobre as rodas */

  function ringCtl(x) { /* perfil de meia seção transversal: 10 pontos de controle [z, y] */
    var yt = yTop(x), ybl = Math.min(yBelt(x), yt - .02), yb = Math.min(yBot(x), ybl - .1), wb = wB(x);
    var fl = flare(x) * .035; var g = clamp((yt - ybl) / .3, 0, 1), wg = wb * (.76 - .05 * clamp((-x - .4) / 1.4, 0, 1)), d = yt - ybl; wb += fl;
    return [[0, yb], [wb * .8, yb], [wb * .96, yb + .06], [wb, yb + (ybl - yb) * .42], [wb * .995, ybl - (ybl - yb) * .12], [wb * .985, ybl],
      [mix(wb * .93, wg, g), ybl + d * .1], [mix(wb * .82, wg * .95, g), ybl + d * .52], [mix(wb * .55, wg * .78, g), ybl + d * .9], [0, yt]];
  }
  function chaikin(pts, it) { /* suaviza o perfil mantendo as pontas */
    var s = pts.map(function (p, i) { return [p[0], p[1], i]; }), k, i;
    for (k = 0; k < it; k++) {
      var o = [s[0]];
      for (i = 0; i < s.length - 1; i++) {
        var a = s[i], b = s[i + 1];
        o.push([.75 * a[0] + .25 * b[0], .75 * a[1] + .25 * b[1], .75 * a[2] + .25 * b[2]], [.25 * a[0] + .75 * b[0], .25 * a[1] + .75 * b[1], .25 * a[2] + .75 * b[2]]);
      }
      o.push(s[s.length - 1]); s = o;
    }
    return s;
  }
  function archAt(x, y) { /* 0..1 dentro da cava da roda mais próxima */
    var best = 0;
    for (var k = 0; k < 2; k++) { var dx = x - WHX[k], dy = y - WYC, d = Math.sqrt(dx * dx + dy * dy); best = Math.max(best, 1 - sstep(ARCH_IN, ARCH_OUT, d)); }
    return best;
  }

  function buildCar() {
    var m = new Mesh(), NXR = 120, xs = [], i, k;
    for (i = 0; i <= NXR; i++) xs.push(-LEN * Math.cos(Math.PI * i / NXR));
    var rings = xs.map(function (x) { return chaikin(ringCtl(x), 2); });
    var np = rings[0].length, nloop = np * 2 - 2;
    m.grid(NXR + 1, nloop, function (i, j) {
      var side = 1, idx = j;
      if (j >= np) { side = -1; idx = nloop - j; }
      var q = rings[i][idx], x = xs[i], y = q[1], z = q[0], a = archAt(x, y);
      var zz = z > ARCH_Z ? ARCH_Z + (z - ARCH_Z) * (1 - a) : z;
      return [x, y, side * zz, x, q[2] / 9, a];
    }, M.PAINT, 0, true);
    /* Faróis frontais, lanternas traseiras, grade e pequenos sensores. */
    [-1, 1].forEach(function (side) {
      m.roundBox(2.12, .67, side*.39, .13, .065, .055, .025, 6, M.GLASS, 0);
      m.roundBox(2.205, .65, side*.39, .045, .035, .058, .016, 5, M.LED, 0);
      m.roundBox(-2.12, .68, side*.40, .11, .07, .045, .02, 5, M.LED, 0);
      m.roundBox(2.30, .47, side*.22, .018, .055, .12, .01, 3, M.TRIM, 0);
    });
    m.roundBox(2.305, .48, 0, .018, .075, .22, .012, 4, M.TRIM, 0);
    /* rodas */
    WC = [];
    [1, -1].forEach(function (s) {
      WHX.forEach(function (xw) {
        var gi = WC.length, cz = s * WZC; WC.push([xw, WYC, cz]);
        var tire = [[.25, -.115], [.3, -.125], [.335, -.12], [.357, -.085], [.362, -.035], [.362, .035], [.357, .085], [.335, .12], [.3, .125], [.25, .115]];
        m.lathe(xw, WYC, cz, tire, 40, M.TIRE, gi, 'z');
        m.lathe(xw, WYC, cz, [[.25, -.115], [.236, -.11], [.236, .11], [.25, .115]], 32, M.ARCH, gi, 'z');
        m.lathe(xw, WYC, cz, [[0, s * .085], [.05, s * .095], [.145, s * .1], [.236, s * .108]], 40, M.RIM, gi, 'z');
      });
    });
    /* retrovisores (lado L e R) */
    [1, -1].forEach(function (s) {
      m.roundBox(.72, .99, s * .93, .13, .05, .07, .045, 5, M.PAINT, 0);
      m.roundBox(.62, .9, s * .84, .03, .09, .03, .015, 3, M.TRIM, 0);
    });
    /* V9: acabamento adicional em três dimensões: emblema, maçanetas, frisos e refletores. */
    [1, -1].forEach(function (side) {
      [-.88, .56].forEach(function (x) {
        m.roundBox(x, 1.015, side * .955, .115, .015, .018, .012, 5, M.METAL, 0);
        m.roundBox(x + .06, 1.015, side * .977, .024, .013, .009, .006, 3, M.TRIM, 0);
      });
      m.roundBox(-1.67, .49, side * .94, .25, .022, .014, .012, 4, M.TRIM, 0);
      m.roundBox(1.66, .49, side * .94, .22, .026, .018, .013, 4, M.TRIM, 0);
      m.roundBox(-2.07, .81, side * .79, .055, .065, .018, .012, 4, M.LED, 0);
    });
    m.roundBox(2.17, .66, 0, .014, .045, .18, .012, 4, M.METAL, 0);
    m.roundBox(-2.17, .68, 0, .014, .038, .16, .012, 4, M.METAL, 0);
    /* porta de carga na lateral traseira (lado +z) */
    var px = -1.92, py = .83, pz = wB(px) * .985;
    m.roundBox(px, py, pz + .004, .065, .05, .012, .012, 4, M.TRIM, 0);
    m.roundBox(px, py, pz + .014, .035, .026, .006, .006, 3, M.LED, 0);
    /* wallbox: base, coluna, cabeça e LED */
    var wx = -2.35, wz = 1.85;
    m.roundBox(wx, .03, wz, .27, .03, .22, .02, 4, M.BASE, 0);
    m.roundBox(wx, .55, wz, .06, .55, .06, .03, 4, M.WALL, 0);
    m.roundBox(wx, 1.12, wz, .21, .3, .1, .07, 6, M.WALL, 0);
    m.roundBox(wx, 1.15, wz - .09, .15, .21, .02, .02, 4, M.TRIM, 0);
    m.roundBox(wx, 1.46, wz, .1, .018, .06, .012, 3, M.LED, 1);
    m.roundBox(wx, 1.2, wz - .108, .045, .055, .006, .006, 3, M.LED, 1);
    /* cabo: da cabeça até a porta (catenária) */
    var pts = [], A = [wx + .1, .86, wz - .02], B = [px - .02, py - .01, pz + .03];
    for (i = 0; i <= 22; i++) {
      var t = i / 22;
      pts.push([mix(A[0], B[0], t) + Math.sin(t * 3.14) * .22, mix(A[1], B[1], t) - Math.sin(t * 3.14) * .46 * (1 - t * .3), mix(A[2], B[2], t) + Math.sin(t * 3.14) * .1]);
    }
    m.tube(pts, .024, 9, M.CABLE, 0);
    m.roundBox(B[0], B[1], B[2] - .012, .045, .04, .045, .018, 4, M.CABLE, 0);
    return m.finish();
  }

  function groundCar(ctx, cw, ch, st, proj) {
    var g0 = proj(0, 0, 0), pulse = (st.t * .5) % 1, gr = ctx.createRadialGradient(g0[0], g0[1], 0, g0[0], g0[1], cw * .52);
    gr.addColorStop(0, 'rgba(245,197,24,.20)'); gr.addColorStop(1, 'rgba(245,197,24,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, ch);
    function ringG(r, a) {
      ctx.beginPath();
      for (var s = 0; s <= 56; s++) { var p = proj(r * Math.cos(s / 56 * 6.2832), 0, r * .62 * Math.sin(s / 56 * 6.2832)); if (s) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
      ctx.strokeStyle = 'rgba(245,197,24,' + a + ')'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    ringG(3.5, .14); ringG(2.6 + pulse * 1.9, (1 - pulse) * .28);
    /* sombra de contato: elipse projetada no chão */
    var e1 = proj(1, 0, 0), e2 = proj(0, 0, 1);
    ctx.save(); ctx.transform(e1[0] - g0[0], e1[1] - g0[1], e2[0] - g0[0], e2[1] - g0[1], g0[0], g0[1]);
    var sh = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    sh.addColorStop(0, 'rgba(0,0,0,.8)'); sh.addColorStop(.55, 'rgba(0,0,0,.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.scale(2.75, 1.25); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.2832); ctx.fill(); ctx.restore();
    /* sombra da wallbox */
    var w0 = proj(-2.35, 0, 1.85);
    ctx.save(); ctx.transform(e1[0] - g0[0], e1[1] - g0[1], e2[0] - g0[0], e2[1] - g0[1], w0[0], w0[1]);
    var s2 = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); s2.addColorStop(0, 'rgba(0,0,0,.6)'); s2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.scale(.55, .4); ctx.fillStyle = s2; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.2832); ctx.fill(); ctx.restore();
  }
  /* v12: versão da home (carro2) — pérola, teto panorâmico, rodas turbina de 10 raios, DRL contínuo */
  SC.carro = { build: buildCar, pitch: .2, dist: 12.8, focal: 1.78, cy: .6, target: [-.1, .66, .1], ground: groundCar, yaw0: 3.5, auto: .3, label: 'Carro elétrico em 3D carregando na wallbox' };
  /* ================= esportivo elétrico (carro2): modelo original, sem marca ================= */
  var SL = 2.25, SWH = [1.38, -1.32], SWZ = .8;
  var syTop = hermite([[-2.25, .6], [-2.15, .72], [-1.95, .84], [-1.5, .93], [-1.0, 1.0], [-.55, 1.07], [-.1, 1.115], [.3, 1.1], [.62, 1.04], [.95, .9], [1.25, .78], [1.6, .69], [2.0, .6], [2.25, .5]]);
  var syBelt = hermite([[-2.25, .6], [-1.9, .8], [-1.2, .82], [0, .8], [1.0, .74], [1.8, .64], [2.25, .5]]);
  var syBot = hermite([[-2.25, .3], [-2.1, .19], [-1.8, .14], [1.8, .14], [2.1, .17], [2.25, .26]]);
  function swB(x) { var u = Math.min(1, Math.abs(x) / SL), e = x > 0 ? 5 : 6; return .97 * (1 - .1 * sstep(.3, 1, x / SL)) * Math.pow(Math.max(0, 1 - Math.pow(u, e)), 1 / e); }
  function sflare(x) { var a = (x - SWH[0]) / .5, b = (x - SWH[1]) / .55; return Math.exp(-a * a) * .8 + Math.exp(-b * b) * 1.3; } /* ombros traseiros mais largos */
  function sRing(x) {
    var yt = syTop(x), ybl = Math.min(syBelt(x), yt - .02), yb = Math.min(syBot(x), ybl - .1), wb = swB(x);
    var g = clamp((yt - ybl) / .3, 0, 1), wg = wb * .68, d = yt - ybl; wb += sflare(x) * .03;
    return [[0, yb], [wb * .8, yb], [wb * .96, yb + .06], [wb, yb + (ybl - yb) * .42], [wb * .995, ybl - (ybl - yb) * .12], [wb * .985, ybl],
      [mix(wb * .93, wg, g), ybl + d * .1], [mix(wb * .82, wg * .95, g), ybl + d * .52], [mix(wb * .55, wg * .78, g), ybl + d * .9], [0, yt]];
  }
  function sArch(x, y) { var best = 0; for (var k = 0; k < 2; k++) { var dx = x - SWH[k], dy = y - WYC, d = Math.sqrt(dx * dx + dy * dy); best = Math.max(best, 1 - sstep(ARCH_IN, ARCH_OUT, d)); } return best; }
  function buildSport() {
    var m = new Mesh(), NXR = 130, xs = [], i;
    for (i = 0; i <= NXR; i++) xs.push(-SL * Math.cos(Math.PI * i / NXR));
    var rings = xs.map(function (x) { return chaikin(sRing(x), 2); });
    var np = rings[0].length, nloop = np * 2 - 2;
    m.grid(NXR + 1, nloop, function (i, j) {
      var side = 1, idx = j;
      if (j >= np) { side = -1; idx = nloop - j; }
      var q = rings[i][idx], x = xs[i], y = q[1], z = q[0], a = sArch(x, y);
      var zz = z > .62 ? .62 + (z - .62) * (1 - a) : z;
      return [x, y, side * zz, x, q[2] / 9, a];
    }, M.PAINT, 0, true);
    /* rodas: pneus mais largos atrás, aro turbina */
    WC = [];
    [1, -1].forEach(function (s) {
      SWH.forEach(function (xw, wi) {
        var gi = WC.length, cz = s * SWZ, k = wi === 1 ? 1.14 : 1;
        WC.push([xw, WYC, cz]);
        var tire = [[.25, -.115 * k], [.3, -.125 * k], [.335, -.12 * k], [.357, -.085 * k], [.362, -.035 * k], [.362, .035 * k], [.357, .085 * k], [.335, .12 * k], [.3, .125 * k], [.25, .115 * k]];
        m.lathe(xw, WYC, cz, tire, 44, M.TIRE, gi, 'z');
        m.lathe(xw, WYC, cz, [[.25, -.115 * k], [.236, -.11 * k], [.236, .11 * k], [.25, .115 * k]], 32, M.ARCH, gi, 'z');
        m.lathe(xw, WYC, cz, [[0, s * .085], [.05, s * .095], [.145, s * .1], [.236, s * .108]], 44, M.RIM, gi, 'z');
      });
    });
    /* retrovisores em carbono sobre hastes finas */
    [1, -1].forEach(function (s) {
      m.roundBox(.74, .9, s * 1.0, .1, .04, .06, .035, 5, M.TRIM, 0);
      m.roundBox(.82, .84, s * .93, .04, .06, .04, .02, 3, M.TRIM, 0);
      /* frisos de carbono nas soleiras e entradas do spoiler dianteiro */
      m.roundBox(.35, .17, s * .93, .75, .02, .02, .012, 3, M.TRIM, 0);
    });
    m.roundBox(2.1, .125, 0, .07, .012, .5, .01, 3, M.TRIM, 0);        /* splitter dianteiro */
    m.roundBox(-1.97, .875, 0, .1, .012, .66, .01, 3, M.TRIM, 0);    /* aerofólio/lip traseiro fixo */
    m.roundBox(-2.17, .2, 0, .06, .03, .42, .012, 3, M.TRIM, 0);    /* difusor traseiro */
    for (i = -3; i <= 3; i++) m.roundBox(-2.2, .2, i * .11, .05, .035, .007, .004, 2, M.TRIM, 0);
    /* porta de carga na lateral traseira (+z) */
    var px = -1.62, py = .8, pz = swB(px) * .985;
    m.roundBox(px, py, pz + .004, .065, .05, .012, .012, 4, M.TRIM, 0);
    m.roundBox(px, py, pz + .014, .035, .026, .006, .006, 3, M.LED, 0);
    /* wallbox, cabo catenária e plugue (mesmos da cena do sedã) */
    var wx = -2.5, wz = 1.85;
    m.roundBox(wx, .03, wz, .27, .03, .22, .02, 4, M.BASE, 0);
    m.roundBox(wx, .55, wz, .06, .55, .06, .03, 4, M.WALL, 0);
    m.roundBox(wx, 1.12, wz, .21, .3, .1, .07, 6, M.WALL, 0);
    m.roundBox(wx, 1.15, wz - .09, .15, .21, .02, .02, 4, M.TRIM, 0);
    m.roundBox(wx, 1.46, wz, .1, .018, .06, .012, 3, M.LED, 1);
    m.roundBox(wx, 1.2, wz - .108, .045, .055, .006, .006, 3, M.LED, 1);
    var pts = [], A = [wx + .1, .86, wz - .02], B = [px - .02, py - .01, pz + .03];
    for (i = 0; i <= 22; i++) {
      var t = i / 22;
      pts.push([mix(A[0], B[0], t) + Math.sin(t * 3.14) * .22, mix(A[1], B[1], t) - Math.sin(t * 3.14) * .46 * (1 - t * .3), mix(A[2], B[2], t) + Math.sin(t * 3.14) * .1]);
    }
    m.tube(pts, .024, 9, M.CABLE, 0);
    m.roundBox(B[0], B[1], B[2] - .012, .045, .04, .045, .018, 4, M.CABLE, 0);
    return m.finish();
  }
  var SPORT_PAINTS = [PAINTS.amarelo, PAINTS.branco, PAINTS.vermelho, PAINTS.azul, PAINTS.preto];
  SC.carro2 = {
    build: buildSport, variant: 2, pitch: .15, dist: 12.6, focal: 1.78, cy: .62, target: [-.2, .52, .1], ground: groundCar, yaw0: 2.5, auto: .2,
    paint: function (st) { return SPORT_PAINTS[(st.pi || 0) % SPORT_PAINTS.length]; },
    label: 'Esportivo elétrico em 3D carregando na wallbox',
    controls: function (wrap, st, api) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'efx-toggle'; b.setAttribute('aria-label', 'Trocar a cor do carro');
      b.textContent = 'Trocar cor';
      b.addEventListener('click', function (e) { e.stopPropagation(); st.pi = ((st.pi || 0) + 1) % SPORT_PAINTS.length; api.draw(); });
      b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      wrap.appendChild(b);
    }
  };


  /* ================= cenas extras: disjuntor, lâmpada LED, painel solar ================= */
  function norm3(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function face(m, P, n, mat, g, uv) { /* quadrilátero plano com normal explícita */
    var ids = [], k;
    for (k = 0; k < 4; k++) ids.push(m.v(P[k][0], P[k][1], P[k][2], uv ? uv[k][0] : 0, uv ? uv[k][1] : 0, 0, n[0], n[1], n[2]));
    m.quad(ids[0], ids[1], ids[2], ids[3], mat, g);
  }
  function softGround(rx, rz, cx, cz, warm) { /* sombra de contato + halo no chão */
    return function (ctx, cw, ch, st, proj) {
      var g0 = proj(cx || 0, 0, cz || 0), e1 = proj((cx || 0) + 1, 0, cz || 0), e2 = proj(cx || 0, 0, (cz || 0) + 1);
      var a = warm ? .1 + .3 * (st.g || 0) : .16, gr = ctx.createRadialGradient(g0[0], g0[1], 0, g0[0], g0[1], cw * .5);
      gr.addColorStop(0, 'rgba(245,197,24,' + a + ')'); gr.addColorStop(1, 'rgba(245,197,24,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, ch);
      ctx.save(); ctx.transform(e1[0] - g0[0], e1[1] - g0[1], e2[0] - g0[0], e2[1] - g0[1], g0[0], g0[1]);
      var sh = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); sh.addColorStop(0, 'rgba(0,0,0,.75)'); sh.addColorStop(.6, 'rgba(0,0,0,.4)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.scale(rx, rz); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.2832); ctx.fill(); ctx.restore();
    };
  }
  function toggleBtn(txtOn, txtOff, aria) { /* botão ligar/desligar sobre o palco */
    return function (wrap, st, api) {
      if (st.on === undefined) { st.on = true; st.lv = 1; st.g = 1; }
      var b = document.createElement('button'); b.type = 'button'; b.className = 'efx-toggle'; b.setAttribute('aria-label', aria);
      function lab() { b.textContent = st.on ? txtOn : txtOff; b.setAttribute('aria-pressed', String(!!st.on)); }
      b.addEventListener('click', function (e) { e.stopPropagation(); st.on = !st.on; lab(); api.draw(); });
      b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      lab(); wrap.appendChild(b); api.btn = b; api.lab = lab;
    };
  }
  function makeTex(a, b) {
    try {
      var c = document.createElement('canvas'); c.width = 128; c.height = 64; var x = c.getContext('2d');
      x.fillStyle = '#f1f1ee'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#c8321e'; x.fillRect(0, 0, 128, 6);
      x.fillStyle = '#141414'; x.font = '700 34px Arial,sans-serif'; x.textAlign = 'center'; x.fillText(a, 64, 40);
      x.font = '600 12px Arial,sans-serif'; x.fillText(b, 64, 58);
      return { w: 128, h: 64, d: x.getImageData(0, 0, 128, 64).data };
    } catch (e) { return null; }
  }

  /* ---- disjuntor (3 módulos em trilho DIN; o do meio liga/desliga) ---- */
  function buildBreaker() {
    var m = new Mesh(), xs = [-.36, 0, .36], i, k;
    /* trilho DIN com furos */
    m.roundBox(0, 0, .43, 1.0, .17, .03, .008, 3, M.ALU, 0);
    for (k = -4; k <= 4; k++) m.roundBox(k * .22, 0, .405, .055, .016, .01, .006, 2, M.BASE, 0);
    xs.forEach(function (x, n) {
      m.roundBox(x, 0, 0, .17, .88, .38, .03, 5, M.PLASTIC, 0);
      m.roundBox(x, .12, -.385, .145, .55, .018, .016, 4, M.WALL, 0);       /* painel frontal elevado */
      m.roundBox(x, .24, -.397, .08, .21, .008, .006, 3, M.BASE, 0); m.roundBox(x, .24, -.402, .066, .196, .008, .006, 3, M.METAL, 0); /* janela da alavanca */
      /* Bornes metálicos com parafuso e ranhura visíveis no topo e na base. */
      [-.69, .69].forEach(function (yy) {
        m.lathe(x, yy, -.405, [[.027, 0], [.027, .006], [.022, .01]], 20, M.METAL, 0, 'z');
        m.roundBox(x, yy, -.417, .015, .003, .002, .001, 2, M.BASE, 0);
      });
      [1, -1].forEach(function (s) { m.roundBox(x, s * .905, -.12, .085, .02, .075, .008, 3, M.METAL, 0); m.roundBox(x, s * .925, -.12, .04, .012, .04, .006, 2, M.BASE, 0); });
      face(m, [[x - .13, -.42, -.405], [x + .13, -.42, -.405], [x + .13, -.28, -.405], [x - .13, -.28, -.405]], [0, 0, -1], M.LABEL, n, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      if (n === 1) { m.roundBox(x, -.6, -.405, .045, .02, .008, .006, 3, M.LED, 5); }
    });
    sc_breaker.lev0 = m.p.length / 3;
    m.roundBox(0, .24, -.425, .05, .085, .04, .014, 4, M.LEVER, 0);
    sc_breaker.lev1 = m.p.length / 3;
    return m.finish();
  }
  var sc_breaker = SC.disjuntor = {
    build: buildBreaker, pitch: .12, dist: 7.6, focal: 1.78, cy: .52, target: [0, 0, 0], ground: null, yaw0: .35, auto: 0, limit: .95, scrollK: .35,
    label: 'Disjuntor em 3D: toque para ligar e desligar',
    init: function () { U.texs = [makeTex('C16', '16 A · 230 V'), makeTex('C32', '32 A · 230 V'), makeTex('C20', '20 A · 230 V')]; },
    frame: function (st) {
      if (st.on === undefined) { st.on = true; } if (st.lv === undefined) st.lv = st.on ? 1 : 0;
      st.lv += ((st.on ? 1 : 0) - st.lv) * (reduce ? 1 : .28); U.on = st.on;
      var M0 = sc_breaker.mesh, P = M0.P, P0 = M0.P0, dy = (st.lv - .5) * .2, a = sc_breaker.lev0, b = sc_breaker.lev1;
      for (var i = a; i < b; i++) P[i * 3 + 1] = P0[i * 3 + 1] + dy;
    },
    tap: function (st, api) { st.on = !st.on; if (api.lab) api.lab(); },
    controls: toggleBtn('Desligar', 'Ligar', 'Ligar ou desligar o disjuntor')
  };
  SC.disjuntor.ground = softGround(2.1, .7, 0, 0.1);

  /* ---- lâmpada LED E27 ---- */
  function buildBulb() {
    var m = new Mesh(), Y = 1.4;
    m.lathe(0, Y, 0, chaikin([[.29, 0], [.3, .1], [.4, .35], [.55, .7], [.63, 1.0], [.59, 1.35], [.47, 1.62], [.36, 1.8], [.22, 1.91], [.1, 1.955], [0, 1.97]], 3), 64, M.BULB, 0, 'y');
    m.lathe(0, Y, 0, [[.28, -.03], [.35, -.03], [.35, .08], [.3, .16]], 40, M.PLASTIC, 0, 'y');
    m.lathe(0, Y, 0, [[.29, -.03], [.3, -.07], [.255, -.11], [.3, -.17], [.255, -.21], [.3, -.27], [.255, -.31], [.3, -.37], [.255, -.41], [.3, -.47], [.26, -.51], [.3, -.55]], 40, M.METAL, 0, 'y');
    m.lathe(0, Y, 0, [[.3, -.55], [.41, -.58], [.42, -.64], [.42, -1.1], [.52, -1.16], [.52, -1.4], [0, -1.4]], 48, M.PLASTIC, 0, 'y');
    m.lathe(0, Y, 0, [[.4, -.6], [.4, -.7]], 40, M.BASE, 0, 'y');
    m.lathe(0, Y, 0, [[.305, -.13], [.31, -.145], [.305, -.16]], 48, M.METAL, 0, 'y');
    m.lathe(0, Y, 0, [[.305, -.29], [.31, -.305], [.305, -.32]], 48, M.METAL, 0, 'y');
    return m.finish();
  }
  SC.lampada = {
    build: buildBulb, pitch: .14, dist: 12, focal: 1.78, cy: .5, target: [0, 1.7, 0], yaw0: 0, auto: .25, scrollK: .6,
    label: 'Lâmpada LED em 3D: toque para acender e apagar',
    frame: function (st) {
      if (st.on === undefined) st.on = true; if (st.g === undefined) st.g = st.on ? 1 : 0;
      st.g += ((st.on ? 1 : 0) - st.g) * (reduce ? 1 : .18); U.glow = st.g;
    },
    ground: softGround(1.5, .55, 0, 0, true),
    overlay: function (ctx, cw, ch, st, proj) {
      if (st.g < .02) return;
      var p = proj(0, 2.6, 0), r = cw * .34, gr = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
      gr.addColorStop(0, 'rgba(255,214,120,' + (.42 * st.g) + ')'); gr.addColorStop(.45, 'rgba(255,190,80,' + (.14 * st.g) + ')'); gr.addColorStop(1, 'rgba(255,190,80,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, ch); ctx.restore();
    },
    tap: function (st, api) { st.on = !st.on; if (api.lab) api.lab(); },
    controls: toggleBtn('Apagar', 'Acender', 'Acender ou apagar a lâmpada')
  };

  /* ---- painel solar fotovoltaico: o sol se move e a luz muda ---- */
  var PVT = 32 * Math.PI / 180, PVS = Math.sin(PVT), PVC = Math.cos(PVT);
  function pvPt(u, v, h) { return [u, 1.15 + v * PVS + h * PVC, v * PVC - h * PVS]; }
  function buildPV() {
    var m = new Mesh(), n = [0, PVC, -PVS], d = [0, PVS, PVC];
    function pl(u0, u1, v0, v1, h, nn, mat, g, uv) { face(m, [pvPt(u0, v0, h), pvPt(u1, v0, h), pvPt(u1, v1, h), pvPt(u0, v1, h)], nn, mat, g, uv); }
    pl(-.5, .5, -.8, .8, 0, n, M.PV, 0, [[-.5, -.8], [.5, -.8], [.5, .8], [-.5, .8]]);
    /* As células, os barramentos e as divisões são desenhados no shader (pvShade) — sem tiras geométricas para não desalinhar nem causar z-fighting. */
    pl(-.54, -.5, -.84, .84, 0, n, M.ALU, 0); pl(.5, .54, -.84, .84, 0, n, M.ALU, 0);
    pl(-.5, .5, -.84, -.8, 0, n, M.ALU, 0); pl(-.5, .5, .8, .84, 0, n, M.ALU, 0);
    function edge(u0, v0, u1, v1, nn) { face(m, [pvPt(u0, v0, -.06), pvPt(u1, v1, -.06), pvPt(u1, v1, 0), pvPt(u0, v0, 0)], nn, M.ALU, 0); }
    edge(-.54, -.84, .54, -.84, [0, -PVS, -PVC]); edge(-.54, .84, .54, .84, d); edge(-.54, -.84, -.54, .84, [-1, 0, 0]); edge(.54, -.84, .54, .84, [1, 0, 0]);
    face(m, [pvPt(-.54, -.84, -.06), pvPt(.54, -.84, -.06), pvPt(.54, .84, -.06), pvPt(-.54, .84, -.06)], [-n[0], -n[1], -n[2]], M.BASE, 0);
    m.roundBox(0, .025, 0, .72, .025, .85, .02, 3, M.BASE, 0);
    [-.3, .3].forEach(function (x) {
      m.roundBox(x, .65, .3, .04, .617, .04, .014, 3, M.METAL, 0);
      m.roundBox(x, .35, -.65, .035, .32, .035, .014, 3, M.METAL, 0);
    });
    m.roundBox(0, .9, .3, .34, .03, .03, .01, 3, M.METAL, 0);
    return m.finish();
  }
  SC.painel = {
    build: buildPV, pitch: .2, dist: 7.8, focal: 1.78, cy: .55, target: [0, .85, 0], yaw0: .55, auto: .22, scrollK: .5,
    label: 'Painel solar em 3D sob o sol em movimento',
    ground: softGround(1.5, 1.1, 0, 0),
    frame: function (st) {
      var a = st.t * .5, L = norm3([Math.sin(a) * .8, .75, -.45 + Math.cos(a) * .2]);
      st.sun = a; PVSC.lights = [L, norm3([-.5, .25, .6]), norm3([.1, .35, .9])];
    },
    overlay: function (ctx, cw, ch, st) {
      var a = st.sun || 0, x = cw * (.5 + .34 * Math.sin(a)), y = ch * .13, r = 15, k;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var gr = ctx.createRadialGradient(x, y, 0, x, y, 60); gr.addColorStop(0, 'rgba(255,214,90,.55)'); gr.addColorStop(1, 'rgba(255,214,90,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - 60, y - 60, 120, 120); ctx.restore();
      ctx.fillStyle = '#F5C518'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(245,197,24,.8)'; ctx.lineWidth = 2;
      for (k = 0; k < 8; k++) { var q = k * .7854 + a; ctx.beginPath(); ctx.moveTo(x + Math.cos(q) * (r + 5), y + Math.sin(q) * (r + 5)); ctx.lineTo(x + Math.cos(q) * (r + 11), y + Math.sin(q) * (r + 11)); ctx.stroke(); }
      var inc = Math.max(0, 0 * a + (PVSC.lights ? PVSC.lights[0][1] * PVC - PVSC.lights[0][2] * PVS : 0)), pct = Math.round(Math.min(1, inc / .98) * 100);
      ctx.font = '600 12px Arial,sans-serif'; ctx.fillStyle = 'rgba(240,237,230,.85)'; ctx.textAlign = 'left'; ctx.fillText('Incidência do sol: ' + pct + '%', 12, 22);
    }
  };
  var PVSC = SC.painel;

  /* brilho (bloom) das luzes emissivas: soma de círculos suaves */
  function glowPass(ctx, cw, ch, b) {
    var gl = b.gl, gw = b.gw, gh = b.gh, sx = cw / gw, sy = ch / gh, i, n = gw * gh, rad = Math.max(sx, sy) * 2.6;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < n; i++) {
      var c = gl[i * 4 + 3]; if (c < 1.5) continue;
      var r = gl[i * 4] / c * 255, g = gl[i * 4 + 1] / c * 255, bl = gl[i * 4 + 2] / c * 255, a = Math.min(.5, .08 + c * .035);
      var x = ((i % gw) + .5) * sx, y = (((i / gw) | 0) + .5) * sy, gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (bl | 0) + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (bl | 0) + ',0)');
      ctx.fillStyle = gr; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    ctx.restore();
  }

  /* ================= visualizador (arrastar, inércia, rolagem, qualidade adaptativa) ================= */
  var REG = [];
  function viewer(cv) {
    var kind = cv.getAttribute('data-efx3d'), sc = SC[kind];
    if (!sc) return;
    var wrap = cv.parentNode, ctx = cv.getContext('2d');
    /* Evita interromper todo o script em ambientes sem Canvas 2D. */
    if (!ctx) { cv.setAttribute('data-efx3d-error', 'canvas-2d-unavailable'); return; }
    var st = { yaw: sc.yaw0 || 0, scale: 1, qual: 1, buf: null, t: 0 };
    var cw = 520, ch = 300, dpr = 1, drag = false, lx = 0, vel = sc.auto === undefined ? .3 : sc.auto, run = false, vis = true, last = 0, t0 = performance.now();
    var activePointer = null, inertia = 0, scrollY = 0, scrollT = 0, ema = 8, moved = 0, lastRender = 0, ready = false, spare = 0;
    var api = { cv: cv, st: st, sc: sc, draw: function () { draw(performance.now()); } };

    function ensure() {
      if (ready) return;
      if (!sc.mesh) { sc.mesh = sc.build(); sc.wc = WC; }
      if (sc.init && !sc.inited) { sc.inited = true; sc.init(); }
      ready = true;
    }
    function size() {
      var r = cv.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = r.width || 520; ch = r.height || 300;
      cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
      st.scale = Math.min(Math.max(dpr, 1.4), 1.75) * st.qual;
      ensure(); draw(performance.now());
    }
    function proj(x, y, z) {
      var T = sc.target, cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(sc.pitch), sp = Math.sin(sc.pitch);
      var xx = x - T[0], yy = y - T[1], zz = z - T[2], x1 = xx * cy + zz * sy, z1 = -xx * sy + zz * cy, y2 = yy * cp + z1 * sp, z2 = -yy * sp + z1 * cp, Z = z2 + sc.dist;
      return [cw * (sc.cx === undefined ? .5 : sc.cx) + cw * sc.focal * x1 / Z, ch * sc.cy - cw * sc.focal * y2 / Z];
    }
    api.proj = proj;
    function draw(now) {
      if (!ready) return;
      st.t = (now - t0) / 1000; U.t = st.t;
      var y0 = st.yaw; if (!reduce) st.yaw = y0 + scrollY * (sc.scrollK === undefined ? 1 : sc.scrollK);
      if (sc.frame) sc.frame(st);
      var ts = performance.now();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cw, ch);
      if (sc.ground) sc.ground(ctx, cw, ch, st, proj);
      if (sc.wc) WC = sc.wc; U.variant = sc.variant || 0; U.paint = sc.paint ? sc.paint(st) : (sc.paintColor || PAINTS.azul);
      var b = renderScene(sc, st, ctx, cw, ch);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(b.cv, 0, 0, cw, ch);
      glowPass(ctx, cw, ch, b);
      if (sc.overlay) sc.overlay(ctx, cw, ch, st, proj, b);
      st.yaw = y0;
      /* qualidade adaptativa: reduz a resolução interna se o aparelho estiver lento */
      var dt = performance.now() - ts; ema = ema * .88 + dt * .12;
      if (ema > 24 && st.qual > .5) { st.qual = Math.max(.5, st.qual - .12); st.scale = Math.min(Math.max(dpr, 1.4), 1.75) * st.qual; ema = 16; }
      else if (ema < 9 && st.qual < 1) { spare++; if (spare > 90) { spare = 0; st.qual = Math.min(1, st.qual + .06); st.scale = Math.min(Math.max(dpr, 1.4), 1.75) * st.qual; } }
    }
    function scrollTarget() {
      var r = cv.getBoundingClientRect(), vh = window.innerHeight || 800;
      return clamp(-((r.top + r.height / 2) / vh - .5) * 1.7, -1.1, 1.1);
    }
    function loop(now) {
      if (!run) return;
      requestAnimationFrame(loop);
      var dt = Math.min(.05, (now - last) / 1000);
      if (now - lastRender < 21 && !drag && Math.abs(inertia) < .02) return; /* ~45 quadros/s é suficiente */
      last = now; lastRender = now;
      if (!drag) {
        st.yaw = (st.yaw + (vel + inertia) * dt) % (Math.PI * 2); if (sc.limit) st.yaw = clamp(st.yaw, (sc.yaw0 || 0) - sc.limit, (sc.yaw0 || 0) + sc.limit);
        inertia *= Math.exp(-3.2 * dt);
        scrollT = scrollTarget(); scrollY += (scrollT - scrollY) * Math.min(1, dt * 5);
      }
      draw(now);
    }
    function start() { if (reduce || run || !vis || document.hidden || !ready) return; run = true; last = performance.now(); requestAnimationFrame(loop); }
    function stop() { run = false; }
    cv.style.touchAction = (sc === SC.carro || sc === SC.carro2) ? 'none' : 'pan-y'; cv.addEventListener('contextmenu', function(e) { if (drag) e.preventDefault(); });
    cv.addEventListener('pointerdown', function (e) { if (activePointer !== null || (e.pointerType === 'mouse' && e.button !== 0)) return; activePointer = e.pointerId; drag = true; lx = e.clientX; moved = 0; inertia = 0; wrap.classList.add('efx-used'); try { cv.setPointerCapture(e.pointerId); } catch (_) {} cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== activePointer) return;
      var dx = Math.max(-55, Math.min(55, e.clientX - lx)); lx = e.clientX; moved += Math.abs(dx);
      st.yaw = (st.yaw + dx * .012) % (Math.PI * 2); if (sc.limit) st.yaw = clamp(st.yaw, (sc.yaw0 || 0) - sc.limit, (sc.yaw0 || 0) + sc.limit); inertia = dx * .012 * 40; inertia = clamp(inertia, -5, 5);
      if (reduce || !run) draw(performance.now());
    });
    function up(e) { if (e && activePointer !== null && e.pointerId !== activePointer) return; var wasTap = drag && moved < 5 && (!e || e.type === 'pointerup'); var pointer = activePointer; activePointer = null; drag = false; if (pointer !== null && cv.hasPointerCapture && cv.hasPointerCapture(pointer)) { try { cv.releasePointerCapture(pointer); } catch (_) {} } if (wasTap && sc.tap) { sc.tap(st, api); if (!run) draw(performance.now()); } cv.style.cursor = 'grab'; }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
    cv.style.cursor = 'grab';
    cv.setAttribute('aria-label', (sc.label || cv.getAttribute('aria-label') || '3D') + '. Arraste para girar.');

    if (sc.controls) sc.controls(wrap, st, api);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { vis = en[0].isIntersecting; if (vis) { ensure(); start(); } else stop(); }, { rootMargin: '120px' }).observe(cv);
    } else { ensure(); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(size, 120); });
    size(); start();
    REG.push(api);
  }

  /* ================= Fagulhas: rede de energia no fundo do hero ================= */
  function plasma(host) {
    var cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    cv.className = 'efx-plasma'; cv.setAttribute('aria-hidden', 'true');
    host.insertBefore(cv, host.firstChild);
    var W = 0, H = 0, P = [], run = false, vis = true, arc = null, nextArc = 1500, last = 0, mx = 0, my = 0, tx = 0, ty = 0;
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
      var i, j, a, b, d, ax, ay, bx, by;
      mx += (tx - mx) * .06; my += (ty - my) * .06;
      ctx.clearRect(0, 0, W, H);
      for (i = 0; i < P.length; i++) {
        a = P[i]; a.x += a.vx * dt * .06; a.y += a.vy * dt * .06;
        if (a.y < -10) { a.y = H + 10; a.x = Math.random() * W; }
        if (a.x < -10) a.x = W + 10; if (a.x > W + 10) a.x = -10;
        ax = a.x + mx * a.r * 14; ay = a.y + my * a.r * 14; /* paralaxe: partículas maiores "mais perto" */
        for (j = i + 1; j < P.length; j++) {
          b = P[j]; d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) { bx = b.x + mx * b.r * 14; by = b.y + my * b.r * 14; ctx.strokeStyle = 'rgba(245,197,24,' + (1 - d / 130) * .16 + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
        }
        ctx.fillStyle = 'rgba(245,197,24,.55)'; ctx.beginPath(); ctx.arc(ax, ay, a.r, 0, 6.2832); ctx.fill();
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
    if (window.matchMedia('(hover: hover)').matches) {
      host.addEventListener('pointermove', function (e) { var r = host.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width - .5; ty = (e.clientY - r.top) / r.height - .5; });
      host.addEventListener('pointerleave', function () { tx = 0; ty = 0; });
    }
    window.addEventListener('resize', size);
    size(); start();
  }

  window.EFX3D = { scenes: SC, viewers: REG, set: function (i, o) { var v = REG[i]; if (!v) return; for (var k in o) v.st[k] = o[k]; v.draw(); } };

  function init() {
    var cs = document.querySelectorAll('canvas[data-efx3d]');
    for (var i = 0; i < cs.length; i++) viewer(cs[i]);
    var hero = document.querySelector('.hero');
    if (hero && !reduce) plasma(hero);
  }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
