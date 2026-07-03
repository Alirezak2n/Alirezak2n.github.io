/* Portfolio background engine — one particle system, eight section-specific topologies. */
class PortfolioSite {
  componentDidMount() {
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mobile = window.innerWidth < 820;
    this.canvas = document.getElementById('net');
    this.ctx = this.canvas.getContext('2d');
    this.mouse = { x: -9999, y: -9999, active: false };

    this.topo = 'hero';
    this.heroVar = 'net';
    this.morph = 1;
    this.helix = 0; this.helixTarget = 0; this.tp = 0;
    this.expP = 0; this.expPTarget = 0;
    this.intensity = 1; this.intensityTarget = 1;
    this.palette = ['#3b82f6', '#22d3ee', '#8b5cf6'];
    this.sprites = this.palette.map(c => this.makeSprite(c));
    this.rnaSprite = this.makeSprite('#34d399');
    this.whiteSprite = this.makeSprite('#dfe9ff');
    this.topoIntensity = { hero: 1.0, genai: 1.0, research: 0.42, experience: 0.7, projects: 0.8, modeling: 0.7, games: 0.7, contact: 0.45 };
    this.labels = {
      hero: ['00 / 07', 'Neural core', 'One system, reshaping itself as you scroll.'],
      genai: ['01 / 07', 'Agent loop', 'Requests out, responses back: tools and memory in orbit.'],
      research: ['02 / 07', 'Double helix', 'The biology beat: DNA transcribing to RNA.'],
      experience: ['03 / 07', 'Career spine', 'Thirteen years, five roles, lit as you read.'],
      projects: ['04 / 07', 'Constellations', 'Six shipped projects. Hover a card to find its stars.'],
      modeling: ['05 / 07', 'Wireframe sphere', 'A rotating sphere, modeled from points.'],
      games: ['06 / 07', 'Invaders', 'A formation under fire. Some of them respawn.'],
      contact: ['07 / 07', 'Beacon', 'Signal out. Say hello.'],
    };

    this.pulses = [];
    this.agentPulses = [];
    this.ripples = []; this.lastRipple = 0;
    this.rings = []; this.lastRing = 0;
    this.bullets = []; this.booms = [];
    this.expSparks = [];
    this.shoot = null; this.nextShoot = 2;
    this.rnaParticles = [];
    this.projHover = -1;
    this.netWaveT0 = 0;

    this.applyLayout();
    this.buildNodes();
    this.buildTargets();
    this.setupObservers();
    this.setupCounts();
    this.setupProjectHover();

    this._onResize = () => { this.mobile = window.innerWidth < 820; this.applyLayout(); this.resizeCanvas(); this.buildTargets(); };
    this._onScroll = () => this.onScroll();
    this._onMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
      this.mouse.active = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    };
    this._onLeave = () => { this.mouse.active = false; };
    window.addEventListener('resize', this._onResize);
    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('mousemove', this._onMove, { passive: true });
    window.addEventListener('mouseout', this._onLeave);
    this.onScroll();

    if (this.reduced) {
      this.revealAll();
      this.draw(0.001);
    } else {
      this.t0 = performance.now();
      this.loop = (now) => { this.draw((now - this.t0) / 1000); this._raf = requestAnimationFrame(this.loop); };
      this._raf = requestAnimationFrame(this.loop);
    }
  }

  componentWillUnmount() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('mouseout', this._onLeave);
    if (this._io) this._io.disconnect();
    if (this._secIo) this._secIo.disconnect();
  }

  applyLayout() {
    const canvas = this.canvas, ui = document.getElementById('panelUI'), main = document.getElementById('content');
    if (this.mobile) {
      canvas.style.width = '100vw';
      ui.style.display = 'none';
      main.style.marginLeft = '0';
      main.style.background = 'rgba(5,6,12,0.66)';
      main.style.maxWidth = 'none';
      main.style.backdropFilter = 'blur(2px)';
    } else {
      canvas.style.width = '46vw';
      ui.style.display = 'flex';
      main.style.marginLeft = '44vw';
      main.style.background = 'transparent';
      main.style.maxWidth = '760px';
      main.style.backdropFilter = 'none';
    }
    this.resizeCanvas();
  }

  makeSprite(color) {
    const s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, color); grd.addColorStop(0.25, color); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); g.fill();
    return c;
  }

  resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.cw = r.width; this.ch = r.height;
    this.canvas.width = this.cw * dpr; this.canvas.height = this.ch * dpr;
    this.dpr = dpr; this._bg = null;
  }

  sr(i, k) { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); }

  buildNodes() {
    const n = this.mobile ? 46 : 90;
    this.N = n;
    this.nodes = [];
    const gr = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y3 = 1 - (i / (n - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - y3 * y3));
      const th = gr * i;
      this.nodes.push({
        x: this.cw / 2, y: this.ch / 2,
        ph: this.sr(i, 9) * Math.PI * 2,
        sp: 0.5 + this.sr(i, 10) * 1.3,
        amp: 3 + this.sr(i, 11) * 6,
        col: i % 3,
        depth: 0.4 + this.sr(i, 12) * 0.6,
      });
    }
    this._mdepth = new Float32Array(n);
    this.hitUntil = new Float32Array(n); // games: node destroyed until t
    this.buildShapes();
    this.pulses = [];
  }

  /* 3D point sets for the modeling turntable: sphere, cube, torus knot. */
  buildShapes() {
    const N = this.N, TAU = Math.PI * 2;
    const sphere = [], cube = [], knot = [];
    const gr = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y3 = 1 - (i / (N - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - y3 * y3));
      sphere.push([Math.cos(gr * i) * rad, y3, Math.sin(gr * i) * rad]);
    }
    const C = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
    const E = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    const per = N / 12;
    for (let i = 0; i < N; i++) {
      const e = Math.min(11, Math.floor(i / per));
      const f = (i - e * per) / per;
      const a = C[E[e][0]], b = C[E[e][1]];
      cube.push([(a[0] + (b[0] - a[0]) * f) * 0.62, (a[1] + (b[1] - a[1]) * f) * 0.62, (a[2] + (b[2] - a[2]) * f) * 0.62]);
    }
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const p = 2, q = 3;
      const r = Math.cos(q * a) + 2;
      knot.push([r * Math.cos(p * a) / 3.2, r * Math.sin(p * a) / 3.2, -Math.sin(q * a) / 1.6]);
    }
    this.shapes = [cube, sphere, knot];
  }

  buildTargets() {
    const N = this.N, W = this.cw, H = this.ch, rr = Math.min(W, H);
    const T = {}, E = {}, M = {};
    const TAU = Math.PI * 2;
    const push = (name, fn) => { T[name] = []; for (let i = 0; i < N; i++) { const p = fn(i); T[name].push({ x: p[0] * W, y: p[1] * H }); } };

    /* ---- hero A: layered feedforward network ---- */
    {
      const weights = [0.16, 0.22, 0.24, 0.22, 0.16];
      const layerOf = [], counts = [], starts = [];
      let acc = 0;
      for (let L = 0; L < 5; L++) { const c = L === 4 ? N - acc : Math.round(N * weights[L]); counts.push(c); starts.push(acc); acc += c; }
      T.hero_net = []; const layerIdx = [];
      for (let L = 0, i = 0; L < 5; L++) {
        for (let k = 0; k < counts[L]; k++, i++) {
          layerIdx[i] = L;
          const x = 0.13 + L * 0.185;
          const pad = 0.14 + Math.abs(L - 2) * 0.05;
          const y = pad + (k + 0.5) / counts[L] * (0.9 - 2 * pad) + (this.sr(i, 21) - 0.5) * 0.03;
          T.hero_net.push({ x: x * W, y: y * H });
        }
      }
      const edges = [];
      for (let L = 0; L < 4; L++) {
        for (let k = 0; k < counts[L]; k++) {
          const i = starts[L] + k;
          const links = 2 + (this.sr(i, 22) < 0.4 ? 1 : 0);
          for (let m = 0; m < links; m++) {
            const frac = (k + 0.5) / counts[L];
            let j = Math.floor(frac * counts[L + 1] + (this.sr(i, 23 + m) - 0.5) * 3.4);
            j = Math.max(0, Math.min(counts[L + 1] - 1, j));
            edges.push({ a: i, b: starts[L + 1] + j, L, p: this.sr(i, 26 + m) < 0.62 });
          }
        }
      }
      E.hero_net = edges;
      M.hero_net = { layerIdx };
    }

    /* ---- hero B: organic core with ripples ---- */
    push('hero_pulse', i => { const a = this.sr(i, 1) * TAU, r = Math.pow(this.sr(i, 2), 0.7) * 0.32; return [0.5 + Math.cos(a) * r * 0.82, 0.42 + Math.sin(a) * r]; });

    /* ---- hero C: orbital rings (static base; animated in draw) ---- */
    M.hero_orbit = [];
    T.hero_orbit = [];
    for (let i = 0; i < N; i++) {
      let ring, slot, count;
      if (i < N * 0.12) { ring = -1; slot = i; count = Math.floor(N * 0.12); }
      else if (i < N * 0.36) { ring = 0; slot = i - Math.floor(N * 0.12); count = Math.floor(N * 0.24); }
      else if (i < N * 0.66) { ring = 1; slot = i - Math.floor(N * 0.36); count = Math.floor(N * 0.30); }
      else { ring = 2; slot = i - Math.floor(N * 0.66); count = N - Math.floor(N * 0.66); }
      M.hero_orbit.push({ ring, a0: (slot / Math.max(1, count)) * TAU + this.sr(i, 27) * 0.3, rj: this.sr(i, 28) });
      T.hero_orbit.push({ x: 0.5 * W, y: 0.44 * H });
    }

    /* ---- genai: hub + tool orbit + memory ring + satellites ---- */
    {
      const memN = this.mobile ? 8 : 12;
      const meta = [];
      for (let i = 0; i < N; i++) {
        if (i === 0) meta.push({ kind: 'hub' });
        else if (i <= 5) meta.push({ kind: 'tool', k: i - 1 });
        else if (i <= 5 + memN) meta.push({ kind: 'mem', k: i - 6, of: memN });
        else meta.push({ kind: 'sat', tool: (i - 6 - memN) % 5, a0: this.sr(i, 3) * TAU, r: 0.045 + this.sr(i, 4) * 0.06, sp: 0.5 + this.sr(i, 5) * 0.8 });
      }
      const edges = [{ a: 0, b: 1, k: 'spoke' }, { a: 0, b: 2, k: 'spoke' }, { a: 0, b: 3, k: 'spoke' }, { a: 0, b: 4, k: 'spoke' }, { a: 0, b: 5, k: 'spoke' }];
      for (let i = 0; i < N; i++) if (meta[i].kind === 'sat') edges.push({ a: 1 + meta[i].tool, b: i, k: 'sat' });
      for (let j = 0; j < memN; j++) edges.push({ a: 6 + j, b: 6 + ((j + 1) % memN), k: 'mem' });
      for (let j = 0; j < memN; j += 3) edges.push({ a: 0, b: 6 + j, k: 'memlink' });
      E.genai = edges; M.genai = meta;
      T.genai = []; for (let i = 0; i < N; i++) T.genai.push({ x: 0.5 * W, y: 0.44 * H });
    }

    /* ---- research: tight blob behind the helix ---- */
    push('research', i => { const a = this.sr(i, 1) * TAU, r = Math.pow(this.sr(i, 2), 0.7) * 0.24; return [0.5 + Math.cos(a) * r * 0.8, 0.5 + Math.sin(a) * r]; });

    /* ---- experience: vertical spine + milestone branches ---- */
    {
      const S = this.mobile ? 18 : 30;
      const path = f => [0.5 + Math.sin(f * 5.0) * 0.045, 0.10 + f * 0.80];
      T.experience = [];
      const mChain = [0, 1, 2, 3, 4].map(k => Math.round(k * (S - 1) / 4));
      const branchOf = [];
      for (let i = 0; i < N; i++) {
        if (i < S) {
          const p = path(i / (S - 1));
          T.experience.push({ x: p[0] * W, y: p[1] * H });
          branchOf.push(null);
        } else {
          const m = (i - S) % 5, j = Math.floor((i - S) / 5);
          const bp = Math.ceil((N - S) / 5);
          const mp = path(mChain[m] / (S - 1));
          const side = m % 2 === 0 ? 1 : -1;
          const ang = (side > 0 ? 0 : Math.PI) + ((j % bp) - (bp - 1) / 2) * (1.9 / Math.max(1, bp - 1)) * side;
          const r = (0.08 + (j % 3) * 0.045 + this.sr(i, 6) * 0.025) * rr;
          T.experience.push({ x: mp[0] * W + Math.cos(ang) * r, y: mp[1] * H + Math.sin(ang) * r * 0.9 });
          branchOf.push({ m, j });
        }
      }
      const edges = [];
      for (let i = 0; i < S - 1; i++) edges.push({ a: i, b: i + 1, k: 'spine' });
      for (let i = S; i < N; i++) edges.push({ a: mChain[branchOf[i].m], b: i, k: 'branch' });
      E.experience = edges;
      M.experience = { S, mChain, branchOf, path };
    }

    /* ---- projects: six constellations + background stars ---- */
    {
      const patterns = [
        [[0,.45],[.22,.14],[.5,0],[.78,.2],[1,.5],[.72,.72],[.4,.62]],
        [[0,.1],[.3,.02],[.62,.12],[.9,0],[1,.4],[.7,.6],[.35,.5]],
        [[.5,0],[.2,.3],[0,.7],[.45,.55],[.9,.68],[.7,.28]],
        [[0,0],[.35,.18],[.7,.05],[1,.3],[.8,.65],[.45,.8]],
        [[.1,.8],[0,.4],[.25,.1],[.6,0],[.95,.15],[.85,.55],[.55,.65]],
        [[0,.55],[.3,.7],[.6,.55],[.9,.7],[.75,.2],[.4,.05]],
      ];
      const chains = [
        [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0]],
        [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,1]],
        [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[1,3]],
        [[0,1],[1,2],[2,3],[3,4],[4,5],[5,1]],
        [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0]],
        [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]],
      ];
      const cardCount = document.querySelectorAll('#projects [data-card]').length || 6;
      const C = Math.max(1, cardCount);
      const R = Math.ceil(C / 2);
      const cells = [];
      for (let c = 0; c < C; c++) {
        const col = c % 2, row = Math.floor(c / 2);
        const y = R === 1 ? 0.5 : 0.14 + (row / (R - 1)) * 0.66 + col * 0.05;
        cells.push([col === 0 ? 0.27 : 0.72, y]);
      }
      const scale = Math.min(0.15 * rr, (0.62 / R) * rr);
      T.projects = []; const cOf = []; const edges = [];
      let i = 0;
      const starIdx = [];
      for (let c = 0; c < C; c++) {
        starIdx.push([]);
        const pat = patterns[c % 6];
        for (let s = 0; s < pat.length && i < N - 6; s++, i++) {
          const p = pat[s];
          T.projects.push({ x: cells[c][0] * W + (p[0] - 0.5) * scale, y: cells[c][1] * H + (p[1] - 0.5) * scale });
          cOf.push(c); starIdx[c].push(i);
        }
      }
      for (let c = 0; c < C; c++) for (const [a, b] of chains[c % 6]) {
        if (starIdx[c][a] != null && starIdx[c][b] != null) edges.push({ a: starIdx[c][a], b: starIdx[c][b], c });
      }
      for (; i < N; i++) {
        T.projects.push({ x: this.sr(i, 7) * W, y: (0.04 + this.sr(i, 8) * 0.92) * H });
        cOf.push(-1);
      }
      E.projects = edges;
      M.projects = { cOf };
    }

    /* ---- modeling handled in 3D ---- */
    push('modeling', i => { const a = this.sr(i, 1) * TAU, r = Math.pow(this.sr(i, 2), 0.7) * 0.22; return [0.5 + Math.cos(a) * r * 0.8, 0.5 + Math.sin(a) * r]; });

    /* ---- games: invader formation ---- */
    {
      const gcols = this.mobile ? 6 : 8; const grows = Math.ceil(N / gcols);
      T.games = []; const grid = [];
      for (let i = 0; i < N; i++) {
        const c = i % gcols, row = Math.floor(i / gcols);
        T.games.push({ x: (0.16 + (c / (gcols - 1)) * 0.68) * W, y: (0.10 + (row / (grows - 1 || 1)) * 0.48) * H });
        grid.push({ c, row });
      }
      M.games = { grid };
    }

    /* ---- contact: calm core ---- */
    push('contact', i => { const a = this.sr(i, 1) * TAU, r = Math.pow(this.sr(i, 2), 0.8) * 0.16; return [0.5 + Math.cos(a) * r * 0.85, 0.5 + Math.sin(a) * r]; });

    this.targets = T; this.edges = E; this.meta = M;
  }

  onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    const bar = document.getElementById('progbar');
    if (bar) bar.style.width = (p * 100).toFixed(2) + '%';
    const vh = window.innerHeight;

    const res = document.getElementById('research');
    if (res) {
      const r = res.getBoundingClientRect();
      const prog = (vh * 0.5 - r.top) / (r.height || 1);
      let env = 0;
      if (prog > 0.04 && prog < 0.96) env = Math.sin(Math.PI * ((prog - 0.04) / 0.92));
      this.helixTarget = Math.max(0, Math.min(1, env * 1.25));
      this.tp = Math.max(0, Math.min(1, (prog - 0.28) / 0.4));
    }
    const exp = document.getElementById('experience');
    if (exp) {
      const r = exp.getBoundingClientRect();
      const prog = (vh * 0.6 - r.top) / (r.height || 1);
      this.expPTarget = Math.max(0, Math.min(1, (prog - 0.1) / 0.75));
    }
  }

  setTopo(name) {
    if (this.topo === name) return;
    this.topo = name;
    this.morph = 0;
    this.intensityTarget = this.topoIntensity[name] ?? 0.6;
    const L = this.labels[name];
    if (L) {
      const idx = document.getElementById('panelIdx'), lab = document.getElementById('panelLabel'), sub = document.getElementById('panelSub');
      if (idx) idx.textContent = L[0];
      if (lab) { lab.textContent = L[1]; lab.classList.remove('swap'); void lab.offsetWidth; lab.classList.add('swap'); }
      if (sub) { sub.textContent = L[2]; sub.classList.remove('swap'); void sub.offsetWidth; sub.classList.add('swap'); }
    }
    const row = document.getElementById('heroVarRow');
    if (row) row.remove();
    document.querySelectorAll('[data-dot]').forEach(d => {
      d.classList.toggle('active', d.getAttribute('data-dot') === name);
    });
  }

  setupProjectHover() {
    const cards = document.querySelectorAll('#projects [data-card]');
    cards.forEach((el, i) => {
      el.addEventListener('mouseenter', () => { this.projHover = i; });
      el.addEventListener('mouseleave', () => { if (this.projHover === i) this.projHover = -1; });
    });
  }

  setupObservers() {
    this._io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target; const d = parseInt(el.getAttribute('data-delay') || '0', 10);
          el.style.transitionDelay = d + 'ms'; el.style.opacity = '1'; el.style.transform = 'translateY(0)';
          this._io.unobserve(el);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('[data-reveal]').forEach(el => this._io.observe(el));

    this._secIo = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { const id = e.target.getAttribute('data-section'); if (id) this.setTopo(id); } });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-section]').forEach(s => this._secIo.observe(s));
  }

  revealAll() { document.querySelectorAll('[data-reveal]').forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; }); }

  setupCounts() {
    const els = document.querySelectorAll('[data-count]');
    if (this.reduced) { els.forEach(el => { el.textContent = (+el.getAttribute('data-count')).toLocaleString() + (el.getAttribute('data-suffix') || ''); }); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target; const target = +el.getAttribute('data-count'); const suffix = el.getAttribute('data-suffix') || '';
        const dur = 1100, t0 = performance.now();
        const step = (now) => { const k = Math.min(1, (now - t0) / dur); const e2 = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(target * e2).toLocaleString() + (k >= 1 ? suffix : ''); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step); io.unobserve(el);
      });
    }, { threshold: 0.6 });
    els.forEach(el => io.observe(el));
  }

  draw(t) {
    const ctx = this.ctx, W = this.cw, H = this.ch;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    if (!this._bg) {
      const g = ctx.createRadialGradient(W * 0.5, H * 0.34, 0, W * 0.5, H * 0.4, Math.max(W, H) * 0.95);
      g.addColorStop(0, '#0a1024'); g.addColorStop(0.55, '#070a16'); g.addColorStop(1, '#05060c');
      this._bg = g;
    }
    ctx.fillStyle = this._bg; ctx.fillRect(0, 0, W, H);

    this.helix += (this.helixTarget - this.helix) * 0.07;
    this.intensity += (this.intensityTarget - this.intensity) * 0.045;
    this.expP += (this.expPTarget - this.expP) * 0.08;
    this.morph += (1 - this.morph) * 0.05;
    const netAlpha = (1 - Math.min(1, this.helix * 1.2)) * (this.mobile ? 0.6 : 1);

    ctx.globalCompositeOperation = 'lighter';
    if (netAlpha > 0.02) this.drawNetwork(t, netAlpha);
    if (this.topo === 'games' && !this.reduced && netAlpha > 0.02) this.drawGames(t, netAlpha);
    if (this.helix > 0.02) this.drawHelix(t, Math.min(1, this.helix * 1.2) * (this.mobile ? 0.72 : 1));

    ctx.globalCompositeOperation = 'source-over';
    const x0 = W * 0.6;
    const fg = ctx.createLinearGradient(x0, 0, W, 0);
    fg.addColorStop(0, 'rgba(5,6,12,0)');
    fg.addColorStop(1, 'rgba(5,6,12,1)');
    ctx.fillStyle = fg;
    ctx.fillRect(x0, 0, W - x0, H);
  }

  drawNetwork(t, alpha) {
    const ctx = this.ctx, nodes = this.nodes, N = this.N, W = this.cw, H = this.ch;
    const rr = Math.min(W, H);
    const topo = this.topo;
    const key = topo === 'hero' ? 'hero_' + this.heroVar : topo;
    const tgt = this.targets[key] || this.targets.hero_pulse;
    const inten = this.intensity;
    const morphE = this.morph * this.morph * (3 - 2 * this.morph);
    const isModel = topo === 'modeling';
    const lerp = 0.09;
    const TAU = Math.PI * 2;

    /* modeling: shape morph + rotation setup */
    let cosY, sinY, cosX, sinX, R3, cx3, cy3, fov, shapeA, shapeB, shapeK;
    if (isModel) {
      const rotY = this.reduced ? 0.7 : t * 0.45;
      const rotX = 0.42 + Math.sin((this.reduced ? 0 : t) * 0.25) * 0.32;
      cosY = Math.cos(rotY); sinY = Math.sin(rotY); cosX = Math.cos(rotX); sinX = Math.sin(rotX);
      R3 = rr * 0.36; cx3 = W * 0.5; cy3 = H * 0.5; fov = 2.4;
      shapeA = this.shapes[1]; shapeB = this.shapes[1];
      shapeK = 0;
    }

    /* genai geometry */
    const gHub = { x: W * 0.5, y: H * 0.44 };
    const gToolR = rr * 0.26, gMemR = rr * 0.42;

    /* games sway */
    const sway = topo === 'games' && !this.reduced ? Math.sin(t * 0.55) * W * 0.03 : 0;

    const meta = this.meta;
    const px = new Float32Array(N), py = new Float32Array(N), glow = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      const nd = nodes[i];
      let txv, tyv;
      if (isModel) {
        const a = shapeA[i], b = shapeB[i];
        const p0 = a[0] + (b[0] - a[0]) * shapeK, p1 = a[1] + (b[1] - a[1]) * shapeK, p2 = a[2] + (b[2] - a[2]) * shapeK;
        const x1 = p0 * cosY + p2 * sinY;
        const z1 = -p0 * sinY + p2 * cosY;
        const y1 = p1 * cosX - z1 * sinX;
        const z2 = p1 * sinX + z1 * cosX;
        const sc = fov / (fov + z2);
        txv = cx3 + x1 * sc * R3; tyv = cy3 + y1 * sc * R3;
        this._mdepth[i] = sc;
      } else if (topo === 'genai') {
        const m = meta.genai[i];
        const tt = this.reduced ? 0 : t;
        if (m.kind === 'hub') { txv = gHub.x; tyv = gHub.y + Math.sin(tt * 0.9) * 5; }
        else if (m.kind === 'tool') {
          const a = m.k * TAU / 5 - Math.PI / 2 + tt * 0.13;
          txv = gHub.x + Math.cos(a) * gToolR; tyv = gHub.y + Math.sin(a) * gToolR * 0.88;
        } else if (m.kind === 'mem') {
          const a = m.k * TAU / m.of - tt * 0.07;
          txv = gHub.x + Math.cos(a) * gMemR; tyv = gHub.y + Math.sin(a) * gMemR * 0.92;
        } else {
          const a = m.tool * TAU / 5 - Math.PI / 2 + tt * 0.13;
          const hx = gHub.x + Math.cos(a) * gToolR, hy = gHub.y + Math.sin(a) * gToolR * 0.88;
          const sa = m.a0 + tt * m.sp;
          txv = hx + Math.cos(sa) * m.r * rr; tyv = hy + Math.sin(sa) * m.r * rr;
        }
      } else if (key === 'hero_orbit') {
        const m = meta.hero_orbit[i];
        const tt = this.reduced ? 0 : t;
        const cx = W * 0.5, cy = H * 0.44;
        if (m.ring === -1) {
          const a = m.a0 + tt * 0.4, r = (0.02 + m.rj * 0.06) * rr;
          txv = cx + Math.cos(a) * r; tyv = cy + Math.sin(a) * r;
        } else {
          const speeds = [0.26, -0.17, 0.11];
          const radii = [0.17, 0.29, 0.42];
          const squash = [0.55, 0.72, 0.5];
          const tilt = [0.3, -0.2, 0.12];
          const a = m.a0 + tt * speeds[m.ring];
          const r = radii[m.ring] * rr * (1 + (m.rj - 0.5) * 0.05);
          const ex = Math.cos(a) * r, ey = Math.sin(a) * r * squash[m.ring];
          const ct = Math.cos(tilt[m.ring]), st = Math.sin(tilt[m.ring]);
          txv = cx + ex * ct - ey * st; tyv = cy + ex * st + ey * ct;
        }
      } else if (topo === 'games') {
        txv = tgt[i].x + sway * (1 + meta.games.grid[i].row * 0.12);
        tyv = tgt[i].y;
      } else {
        txv = tgt[i].x; tyv = tgt[i].y;
      }
      nd.x += (txv - nd.x) * lerp; nd.y += (tyv - nd.y) * lerp;
      const ampScale = (isModel || topo === 'genai' || key === 'hero_orbit') ? 0.25 : (key === 'hero_net' ? 0.5 : (topo === 'projects' ? 0.35 : 1));
      const amp = nd.amp * ampScale;
      let dx = nd.x + (this.reduced ? 0 : Math.sin(t * nd.sp + nd.ph) * amp);
      let dy = nd.y + (this.reduced ? 0 : Math.cos(t * nd.sp * 0.9 + nd.ph) * amp);
      let g = 0;
      if (this.mouse.active) {
        const mdx = this.mouse.x - dx, mdy = this.mouse.y - dy; const d2 = mdx * mdx + mdy * mdy, Rr = 140;
        if (d2 < Rr * Rr) { const f = 1 - Math.sqrt(d2) / Rr; dx += mdx * 0.06 * f; dy += mdy * 0.06 * f; g = f; }
      }
      px[i] = dx; py[i] = dy; glow[i] = g;
    }
    this._px = px; this._py = py;

    /* ---- per-mode ambient glow sources ---- */

    // hero_net: forward-pass wave
    let waveSeg = -1;
    if (key === 'hero_net' && !this.reduced) {
      const cyc = t % 3.0;
      if (cyc < 1.7) waveSeg = (cyc / 1.7) * 4;
      if (waveSeg >= 0) {
        const li = meta.hero_net.layerIdx;
        for (let i = 0; i < N; i++) {
          const d = Math.abs(waveSeg - li[i]);
          if (d < 0.55) glow[i] = Math.max(glow[i], (1 - d / 0.55) * 0.9);
        }
      }
    }

    // hero_pulse: expanding ripples
    if (key === 'hero_pulse' && !this.reduced) {
      if (t - this.lastRipple > 1.9) {
        const src = Math.floor(this.sr(Math.floor(t * 10), 30) * N);
        this.ripples.push({ x: px[src], y: py[src], t0: t });
        this.lastRipple = t;
      }
      const maxR = rr * 0.62;
      for (let k = this.ripples.length - 1; k >= 0; k--) {
        const rp = this.ripples[k];
        const r = (t - rp.t0) * 150;
        if (r > maxR) { this.ripples.splice(k, 1); continue; }
        const fade = 1 - r / maxR;
        for (let i = 0; i < N; i++) {
          const d = Math.hypot(px[i] - rp.x, py[i] - rp.y);
          const dd = Math.abs(d - r);
          if (dd < 38) glow[i] = Math.max(glow[i], (1 - dd / 38) * fade * 0.9);
        }
        ctx.strokeStyle = 'rgba(120,180,240,' + (0.16 * fade * alpha).toFixed(3) + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(rp.x, rp.y, r, 0, TAU); ctx.stroke();
      }
    } else if (key !== 'hero_pulse') { this.ripples.length = 0; }

    // contact: beacon rings
    if (topo === 'contact' && !this.reduced) {
      if (t - this.lastRing > 2.4) { this.rings.push({ t0: t }); this.lastRing = t; }
      const cx = W * 0.5, cy = H * 0.5, maxR = rr * 0.58;
      for (let k = this.rings.length - 1; k >= 0; k--) {
        const rg = this.rings[k];
        const r = (t - rg.t0) * rr * 0.14;
        if (r > maxR) { this.rings.splice(k, 1); continue; }
        const fade = Math.pow(1 - r / maxR, 1.4);
        ctx.strokeStyle = 'rgba(34,211,238,' + (0.3 * fade * alpha).toFixed(3) + ')';
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
        for (let i = 0; i < N; i++) {
          const dd = Math.abs(Math.hypot(px[i] - cx, py[i] - cy) - r);
          if (dd < 26) glow[i] = Math.max(glow[i], (1 - dd / 26) * fade);
        }
      }
    } else if (topo !== 'contact') { this.rings.length = 0; }

    // experience: scroll-driven lighting
    let expLit = null, expBead = null;
    if (topo === 'experience') {
      const me = meta.experience;
      expLit = new Float32Array(N);
      const p = this.expP;
      for (let i = 0; i < me.S; i++) {
        const f = i / (me.S - 1);
        expLit[i] = Math.max(0, Math.min(1, (p - f) * 22 + 1));
      }
      for (let i = me.S; i < N; i++) {
        const b = me.branchOf[i];
        const fm = me.mChain[b.m] / (me.S - 1);
        expLit[i] = Math.max(0, Math.min(1, (p - fm) * 14 - b.j * 0.3));
      }
      const bp = me.path(p);
      expBead = { x: bp[0] * W, y: bp[1] * H };
      for (let i = 0; i < N; i++) {
        const d = Math.hypot(px[i] - expBead.x, py[i] - expBead.y);
        if (d < 70) glow[i] = Math.max(glow[i], (1 - d / 70) * 0.8);
      }
    }

    // projects: twinkle + hover highlight
    let projTw = null;
    if (topo === 'projects') {
      const cOf = meta.projects.cOf;
      projTw = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const tw = 0.5 + 0.5 * Math.sin((this.reduced ? 0 : t) * 1.6 + nodes[i].ph * 3);
        projTw[i] = tw;
        if (cOf[i] >= 0 && cOf[i] === this.projHover) glow[i] = Math.max(glow[i], 0.85);
      }
    }

    /* ---- links ---- */
    const edges = this.edges[key];
    ctx.lineWidth = isModel ? 1.2 : 1;
    if (edges) {
      for (const e of edges) {
        const ax = px[e.a], ay = py[e.a], bx = px[e.b], by = py[e.b];
        let al = 0.3 * alpha * morphE, col = '90,150,230';
        if (key === 'hero_net') {
          al = 0.2 * alpha * morphE;
          if (waveSeg >= 0) {
            const d = waveSeg - e.L;
            if (d > 0 && d < 1) { al += 0.4 * Math.sin(Math.PI * d) * alpha; col = '110,200,250'; }
          }
        } else if (topo === 'genai') {
          if (e.k === 'spoke') { al = 0.34 * alpha * morphE; col = '110,190,245'; }
          else if (e.k === 'sat') { al = 0.16 * alpha * morphE; }
          else if (e.k === 'mem') { al = 0.26 * alpha * morphE; col = '160,130,245'; }
          else { al = 0.10 * alpha * morphE; col = '160,130,245'; }
        } else if (topo === 'experience') {
          const lit = Math.min(expLit[e.a], expLit[e.b]);
          if (e.k === 'spine') { al = (0.14 + lit * 0.5) * alpha * morphE; col = lit > 0.5 ? '80,225,240' : '90,150,230'; }
          else { al = (0.05 + lit * 0.34) * alpha * morphE; col = lit > 0.5 ? '80,225,240' : '90,150,230'; }
        } else if (topo === 'projects') {
          const hov = e.c === this.projHover;
          const pcols = ['110,170,246', '80,220,245', '170,140,250'];
          al = (hov ? 0.7 : 0.32) * alpha * morphE;
          col = hov ? '170,240,252' : pcols[e.c % 3];
        }
        if (al > 0.01) {
          ctx.strokeStyle = 'rgba(' + col + ',' + al.toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        }
      }
    } else {
      /* distance-based links (hero_pulse, hero_orbit, research, modeling, games, contact) */
      const linkDist = (this.mobile ? 105 : 130) * (0.7 + inten * 0.55) * (isModel ? 1.15 : 1);
      const gamesMode = topo === 'games';
      for (let i = 0; i < N; i++) {
        if (gamesMode && this.hitUntil[i] > t) continue;
        for (let j = i + 1; j < N; j++) {
          if (gamesMode && this.hitUntil[j] > t) continue;
          const dx = px[i] - px[j], dy = py[i] - py[j]; const d = Math.sqrt(dx * dx + dy * dy);
          if (d < linkDist) {
            let al = (1 - d / linkDist) * 0.5 * alpha * (0.45 + inten * 0.55) * morphE;
            if (isModel) al *= 0.5 * (this._mdepth[i] + this._mdepth[j]);
            ctx.strokeStyle = 'rgba(90,150,230,' + al.toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(px[i], py[i]); ctx.lineTo(px[j], py[j]); ctx.stroke();
            if (!this.reduced && !isModel && !gamesMode && Math.random() < 0.0007 * inten && this.pulses.length < 55) {
              this.pulses.push({ a: i, b: j, t: 0, sp: 0.012 + Math.random() * 0.02, col: Math.random() < 0.5 ? 1 : 2 });
            }
          }
        }
      }
    }

    /* ambient link pulses */
    for (let k = this.pulses.length - 1; k >= 0; k--) {
      const p = this.pulses[k]; p.t += p.sp;
      if (p.t >= 1 || p.a >= N || p.b >= N || edges) { this.pulses.splice(k, 1); continue; }
      const x = px[p.a] + (px[p.b] - px[p.a]) * p.t, y = py[p.a] + (py[p.b] - py[p.a]) * p.t; const s = 13;
      ctx.globalAlpha = alpha * Math.sin(Math.PI * p.t); ctx.drawImage(this.sprites[p.col], x - s / 2, y - s / 2, s, s); ctx.globalAlpha = 1;
    }

    /* hero_net: pulses riding edges of the active wave segment */
    if (key === 'hero_net' && waveSeg >= 0 && edges) {
      for (const e of edges) {
        if (!e.p) continue;
        const d = waveSeg - e.L;
        if (d > 0 && d < 1) {
          const x = px[e.a] + (px[e.b] - px[e.a]) * d, y = py[e.a] + (py[e.b] - py[e.a]) * d;
          const s = 11;
          ctx.globalAlpha = alpha * Math.sin(Math.PI * d) * 0.9;
          ctx.drawImage(this.sprites[1], x - s / 2, y - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
    }

    /* genai: request/response pulses cycling hub → tool → hub */
    if (topo === 'genai' && !this.reduced) {
      if (Math.random() < 0.025 && this.agentPulses.length < 8) {
        const tool = 1 + Math.floor(Math.random() * 5);
        this.agentPulses.push({ a: 0, b: tool, t: 0, sp: 0.016 + Math.random() * 0.012, col: 1, ret: true });
      }
      for (let k = this.agentPulses.length - 1; k >= 0; k--) {
        const p = this.agentPulses[k]; p.t += p.sp;
        if (p.t >= 1) {
          if (p.ret) this.agentPulses.push({ a: p.b, b: 0, t: 0, sp: p.sp * 0.9, col: 2, ret: false });
          this.agentPulses.splice(k, 1); continue;
        }
        const x = px[p.a] + (px[p.b] - px[p.a]) * p.t, y = py[p.a] + (py[p.b] - py[p.a]) * p.t;
        const s = 14;
        ctx.globalAlpha = alpha * Math.sin(Math.PI * p.t);
        ctx.drawImage(this.sprites[p.col], x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      /* two beads circulating the memory ring */
      const memN = this.mobile ? 8 : 12;
      for (let b = 0; b < 2; b++) {
        const a = (t * 0.22 + b * Math.PI) % TAU;
        const x = gHub.x + Math.cos(a) * gMemR, y = gHub.y + Math.sin(a) * gMemR * 0.92;
        const s = 10;
        ctx.globalAlpha = alpha * 0.8;
        ctx.drawImage(this.sprites[2], x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    }

    /* projects: shooting star */
    if (topo === 'projects' && !this.reduced) {
      if (!this.shoot && t > this.nextShoot) {
        const fromLeft = Math.random() < 0.5;
        this.shoot = {
          t0: t,
          x0: fromLeft ? -20 : W + 20,
          y0: H * (0.05 + Math.random() * 0.3),
          vx: (fromLeft ? 1 : -1) * (W * (0.9 + Math.random() * 0.5)),
          vy: H * (0.15 + Math.random() * 0.2),
        };
      }
      if (this.shoot) {
        const s = this.shoot, life = (t - s.t0) / 1.1;
        if (life > 1) { this.shoot = null; this.nextShoot = t + 3 + Math.random() * 5; }
        else {
          const x = s.x0 + s.vx * life, y = s.y0 + s.vy * life;
          const tx = x - s.vx * 0.09, ty = y - s.vy * 0.09;
          const a = alpha * Math.sin(Math.PI * life) * 0.8;
          const grd = ctx.createLinearGradient(x, y, tx, ty);
          grd.addColorStop(0, 'rgba(230,240,255,' + a.toFixed(3) + ')');
          grd.addColorStop(1, 'rgba(230,240,255,0)');
          ctx.strokeStyle = grd; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
          const ss = 9;
          ctx.globalAlpha = a;
          ctx.drawImage(this.whiteSprite, x - ss / 2, y - ss / 2, ss, ss);
          ctx.globalAlpha = 1;
        }
      }
    }

    /* ---- nodes ---- */
    for (let i = 0; i < N; i++) {
      const nd = nodes[i];
      let hidden = 0;
      if (topo === 'games') {
        const hu = this.hitUntil[i];
        if (hu > t) continue;
        if (hu > 0 && t - hu < 0.6) hidden = 1 - (t - hu) / 0.6;
      }
      const pulse = 0.5 + 0.5 * Math.sin(this.reduced ? 0 : (t * nd.sp + nd.ph));
      let base = 1.6 + nd.depth * 2.2;
      let sprite = this.sprites[nd.col];
      let a = alpha * (0.32 + pulse * 0.4 + glow[i] * 0.6) * (0.55 + this.intensity * 0.45);

      if (isModel) {
        base = 1.2 + this._mdepth[i] * 3.2;
        a *= (0.4 + this._mdepth[i] * 0.7);
      } else if (topo === 'genai') {
        const m = meta.genai[i];
        if (m.kind === 'hub') { base = 7.5; sprite = this.sprites[1]; a = alpha * (0.85 + pulse * 0.15); }
        else if (m.kind === 'tool') { base = 4.2; sprite = this.sprites[0]; a = alpha * (0.6 + pulse * 0.3 + glow[i] * 0.4); }
        else if (m.kind === 'mem') { base = 2.4; sprite = this.sprites[2]; }
        else base = 1.4 + nd.depth * 1.4;
      } else if (topo === 'experience') {
        const me = meta.experience;
        const lit = expLit[i];
        const isMile = i < me.S && me.mChain.includes(i);
        if (isMile) { base = 4.6; sprite = lit > 0.4 ? this.sprites[1] : this.sprites[0]; }
        else if (i < me.S) { base = 2.0; sprite = lit > 0.4 ? this.sprites[1] : this.sprites[0]; }
        else { base = 1.5 + nd.depth * 1.4; sprite = lit > 0.4 ? this.sprites[1] : this.sprites[2]; }
        a = alpha * (0.16 + lit * 0.6 + pulse * 0.14 + glow[i] * 0.5);
      } else if (topo === 'projects') {
        const c = meta.projects.cOf[i];
        const tw = projTw[i];
        if (c >= 0) {
          base = 2.8 + nd.depth * 1.6;
          sprite = this.sprites[c % 3];
          a = alpha * (0.6 + tw * 0.3 + glow[i] * 0.5);
          if (c === this.projHover) { base *= 1.3; a = Math.min(1, a * 1.3); }
        } else {
          base = 0.9 + nd.depth * 0.8;
          a = alpha * (0.1 + tw * 0.22);
        }
      } else if (key === 'hero_net') {
        const L = meta.hero_net.layerIdx[i];
        base = (L === 0 || L === 4) ? 2.8 : 2.0 + nd.depth * 1.2;
        sprite = this.sprites[L === 4 ? 1 : nd.col];
      } else if (topo === 'contact') {
        const breathe = 1 + 0.12 * Math.sin((this.reduced ? 0 : t) * 0.8);
        base *= breathe;
      }

      const r = base * (1 + pulse * 0.5) * (1 + glow[i] * 1.2); const size = r * 6;
      ctx.globalAlpha = Math.max(0, Math.min(1, a * (1 - hidden * 0) )) * (hidden > 0 ? (1 - hidden) : 1);
      ctx.drawImage(sprite, px[i] - size / 2, py[i] - size / 2, size, size);
    }
    ctx.globalAlpha = 1;

    /* experience: traveling "now" bead + sparks */
    if (topo === 'experience' && expBead && !this.reduced) {
      const beadPulse = 0.75 + 0.25 * Math.sin(t * 5);
      const bs = 26 * beadPulse;
      ctx.globalAlpha = alpha * 0.95;
      ctx.drawImage(this.sprites[1], expBead.x - bs / 2, expBead.y - bs / 2, bs, bs);
      ctx.globalAlpha = 1;
      if (Math.random() < 0.3 && this.expSparks.length < 30 && this.expP > 0.01 && this.expP < 0.99) {
        this.expSparks.push({ x: expBead.x, y: expBead.y, vx: (Math.random() - 0.5) * 1.6, vy: (Math.random() - 0.5) * 1.6, life: 1 });
      }
    }
    for (let k = this.expSparks.length - 1; k >= 0; k--) {
      const p = this.expSparks[k]; p.x += p.vx; p.y += p.vy; p.life -= 0.025;
      if (p.life <= 0 || topo !== 'experience') { this.expSparks.splice(k, 1); continue; }
      const ps = 4 + p.life * 5;
      ctx.globalAlpha = alpha * p.life * 0.8;
      ctx.drawImage(this.sprites[1], p.x - ps / 2, p.y - ps / 2, ps, ps);
    }
    ctx.globalAlpha = 1;
  }

  drawGames(t, alpha) {
    const ctx = this.ctx, W = this.cw, H = this.ch, N = this.N;
    const px = this._px, py = this._py;
    const shipX = W * (0.5 + 0.34 * Math.sin(t * 0.8));
    const shipY = H * 0.9;
    const ss = 30;
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.sprites[1], shipX - ss / 2, shipY - ss / 2, ss, ss);
    ctx.globalAlpha = 1;

    if (Math.random() < 0.14 && this.bullets.length < 40) {
      this.bullets.push({ x: shipX, y: shipY - 12, vy: -(4 + Math.random() * 3), col: Math.random() < 0.5 ? 1 : 2 });
    }
    for (let k = this.bullets.length - 1; k >= 0; k--) {
      const b = this.bullets[k];
      b.y += b.vy;
      if (b.y < -20) { this.bullets.splice(k, 1); continue; }
      /* collision with formation nodes */
      let hit = false;
      if (px) {
        for (let i = 0; i < N; i++) {
          if (this.hitUntil[i] > t - 0.6) continue;
          const dx = px[i] - b.x, dy = py[i] - b.y;
          if (dx * dx + dy * dy < 180) {
            this.hitUntil[i] = t + 1.8 + Math.random() * 1.6;
            for (let m = 0; m < 9; m++) {
              const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 2.4;
              this.booms.push({ x: px[i], y: py[i], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, col: Math.random() < 0.5 ? 1 : 2 });
            }
            hit = true; break;
          }
        }
      }
      if (hit) { this.bullets.splice(k, 1); continue; }
      ctx.strokeStyle = b.col === 1 ? 'rgba(34,211,238,' + (0.5 * alpha) + ')' : 'rgba(139,92,246,' + (0.5 * alpha) + ')';
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y + 16); ctx.stroke();
      const bs = 11; ctx.globalAlpha = alpha;
      ctx.drawImage(this.sprites[b.col], b.x - bs / 2, b.y - bs / 2, bs, bs);
      ctx.globalAlpha = 1;
    }

    /* explosion debris */
    for (let k = this.booms.length - 1; k >= 0; k--) {
      const p = this.booms[k];
      p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.life -= 0.028;
      if (p.life <= 0) { this.booms.splice(k, 1); continue; }
      const ps = 4 + p.life * 8;
      ctx.globalAlpha = alpha * p.life;
      ctx.drawImage(this.sprites[p.col], p.x - ps / 2, p.y - ps / 2, ps, ps);
    }
    ctx.globalAlpha = 1;
  }

  drawHelix(t, alpha) {
    const ctx = this.ctx, W = this.cw, H = this.ch;
    const cx = W / 2; const yTop = H * 0.12, yBot = H * 0.88;
    const A = Math.min(W * 0.34, 240) * (this.mobile ? 0.82 : 1);
    const turns = 3; const Nn = this.mobile ? 20 : 30; const spin = this.reduced ? 0.6 : t * 0.5; const TAU = Math.PI * 2;
    const sweepY = yTop + this.tp * (yBot - yTop);
    const mouse = this.mouse;

    const project = (f, s) => { const y = yTop + f * (yBot - yTop); const ang = f * turns * TAU + spin + s * Math.PI; return { x: cx + A * Math.cos(ang), y, ang }; };

    /* strands drawn per-segment so line weight & alpha follow depth */
    const segN = this.mobile ? 36 : 60;
    for (let s = 0; s < 2; s++) {
      const strandFade = s === 1 ? (1 - this.tp * 0.85) : 1;
      let prev = project(0, s);
      for (let i = 1; i <= segN; i++) {
        const f = i / segN;
        const p = project(f, s);
        const depth = (Math.sin((p.ang + prev.ang) / 2) + 1) / 2;
        ctx.strokeStyle = 'rgba(140,185,245,' + ((0.3 + depth * 0.5) * alpha * strandFade).toFixed(3) + ')';
        ctx.lineWidth = 1.4 + depth * 2.0;
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        prev = p;
      }
    }
    for (let i = 0; i < Nn; i++) {
      const f = i / (Nn - 1); const p0 = project(f, 0); const p1 = project(f, 1); const transcribed = p0.y < sweepY;
      const depth = (Math.sin(p0.ang) + 1) / 2;
      ctx.strokeStyle = transcribed ? 'rgba(120,240,190,' + ((0.3 + depth * 0.35) * alpha).toFixed(3) + ')' : 'rgba(160,130,245,' + ((0.3 + depth * 0.35) * alpha).toFixed(3) + ')';
      ctx.lineWidth = 1.4 + depth * 1.0; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    const dotPulse = 0.6 + 0.4 * Math.sin(this.reduced ? 0 : t * 2);
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < Nn; i++) {
        const f = i / (Nn - 1); const p = project(f, s); let x = p.x, y = p.y; const depth = (Math.sin(p.ang) + 1) / 2; const transcribed = y < sweepY; const fade = (s === 1 && transcribed) ? (1 - this.tp * 0.85) : 1;
        let g = 0;
        if (mouse.active) { const dx = mouse.x - x, dy = mouse.y - y; const d2 = dx * dx + dy * dy, Rr = 150; if (d2 < Rr * Rr) { const ff = 1 - Math.sqrt(d2) / Rr; x += dx * 0.16 * ff; y += dy * 0.16 * ff; g = ff; } }
        const size = (9 + depth * 15) * (0.9 + dotPulse * 0.3) * (1 + g * 0.9); const spr = transcribed ? this.rnaSprite : this.sprites[s === 0 ? 1 : 2];
        ctx.globalAlpha = alpha * (0.45 + depth * 0.6 + g * 0.7) * fade; ctx.drawImage(spr, x - size / 2, y - size / 2, size, size);
      }
    }

    if (!this.reduced && this.tp > 0.03 && this.tp < 0.98) {
      const beadPulse = 0.7 + 0.3 * Math.sin(t * 6);
      const bs = 30 * beadPulse;
      ctx.globalAlpha = alpha * 0.9;
      ctx.drawImage(this.rnaSprite, cx - bs / 2, sweepY - bs / 2, bs, bs);
      ctx.globalAlpha = 1;
      if (Math.random() < 0.55 && this.rnaParticles.length < 80) {
        this.rnaParticles.push({ x: cx + (Math.random() - 0.5) * A * 0.35, y: sweepY, vx: 0.6 + Math.random() * 1.6, vy: (Math.random() - 0.5) * 1.3, life: 1 });
      }
    }
    if (this.tp > 0.02 && this.tp < 0.99) { ctx.globalAlpha = alpha * 0.55; const grd = ctx.createLinearGradient(cx - A * 1.5, sweepY, cx + A * 1.5, sweepY); grd.addColorStop(0, 'rgba(52,211,153,0)'); grd.addColorStop(0.5, 'rgba(120,250,195,0.95)'); grd.addColorStop(1, 'rgba(52,211,153,0)'); ctx.fillStyle = grd; ctx.fillRect(cx - A * 1.5, sweepY - 1.4, A * 3, 2.8); }

    for (let k = this.rnaParticles.length - 1; k >= 0; k--) {
      const p = this.rnaParticles[k]; p.x += p.vx; p.y += p.vy; p.vy += 0.02; p.life -= 0.014;
      if (p.life <= 0) { this.rnaParticles.splice(k, 1); continue; }
      const ps = 5 + p.life * 6; ctx.globalAlpha = alpha * p.life * 0.9;
      ctx.drawImage(this.rnaSprite, p.x - ps / 2, p.y - ps / 2, ps, ps);
    }
    ctx.globalAlpha = 1;
  }

  renderVals() { return {}; }
}

document.addEventListener('DOMContentLoaded', () => {
  const site = new PortfolioSite();
  window.portfolioSite = site;
  site.componentDidMount();
});
