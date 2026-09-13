(() => {
  'use strict';

  const cvs = document.getElementById('c');
  const ctx = cvs.getContext('2d');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');
  const scoreFinal = document.getElementById('score-final');
  const subEl = document.getElementById('sub');

  // Fixed logical resolution; scaled up to fit the real screen.
  const W = 360, H = 600;
  let scale = 1, offX = 0, offY = 0;

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    scale = Math.min(vw / W, vh / H);
    cvs.width = Math.round(W * scale * devicePixelRatio);
    cvs.height = Math.round(H * scale * devicePixelRatio);
    cvs.style.width = Math.round(W * scale) + 'px';
    cvs.style.height = Math.round(H * scale) + 'px';
    ctx.setTransform(scale * devicePixelRatio, 0, 0, scale * devicePixelRatio, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const r = cvs.getBoundingClientRect();
    offX = r.left; offY = r.top;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 150));

  // ---- state ----
  const INV_ROWS = 4, INV_COLS = 6;
  const INV_W = 26, INV_H = 18, GAP_X = 22, GAP_Y = 26;
  const PLAYER_W = 30, PLAYER_H = 14, PLAYER_Y = H - 58;

  let player, bullets, enemyBullets, invaders, particles;
  let dir, stepDown, invSpeed, score, lives, running, gameOver, animId;
  let fireCooldown, tickAcc, invTimer, wave, shakeT;

  const keys = { left: false, right: false, fire: false };

  function makeInvaders() {
    const list = [];
    const totalW = INV_COLS * GAP_X - (GAP_X - INV_W);
    const startX = (W - totalW) / 2;
    const startY = 62;
    for (let r = 0; r < INV_ROWS; r++) {
      for (let c = 0; c < INV_COLS; c++) {
        list.push({
          x: startX + c * GAP_X,
          y: startY + r * GAP_Y,
          w: INV_W, h: INV_H,
          alive: true,
          type: r === 0 ? 2 : (r < 2 ? 1 : 0),
          bob: Math.random() * Math.PI * 2
        });
      }
    }
    return list;
  }

  function reset(full) {
    if (full) { score = 0; lives = 3; wave = 1; }
    player = { x: (W - PLAYER_W) / 2, y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H };
    bullets = []; enemyBullets = []; particles = [];
    invaders = makeInvaders();
    dir = 1;
    stepDown = 0;
    invSpeed = 0.30 + (wave - 1) * 0.07;
    invTimer = 0;
    shakeT = 0;
    fireCooldown = 0;
    tickAcc = 0;
    gameOver = false;
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = 'SCORE ' + score;
    livesEl.textContent = '♥'.repeat(Math.max(0, lives)) || '—';
  }

  // ---- audio (tiny WebAudio blips, no assets) ----
  let actx = null;
  function beep(freq, dur, type, vol) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.value = vol == null ? 0.05 : vol;
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) { /* audio is optional */ }
  }

  function spawnParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 2.4,
        vy: (Math.random() - 0.5) * 2.4,
        life: 1, color
      });
    }
  }

  // ---- input ----
  function moveTo(clientX) {
    if (!running) return;
    const x = (clientX - offX) / scale;
    player.x = Math.max(4, Math.min(W - player.w - 4, x - player.w / 2));
  }

  let pointerActive = false, pointerStartY = 0, pointerStartX = 0, pointerMoved = false;

  function shoot() {
    if (!running || fireCooldown > 0) return;
    if (bullets.length >= 2) return;
    bullets.push({ x: player.x + player.w / 2, y: player.y - 4, vy: -7 });
    fireCooldown = 0.18;
    beep(760, 0.06, 'square', 0.04);
  }

  cvs.addEventListener('pointerdown', (e) => {
    if (!running) return;
    e.preventDefault();
    cvs.setPointerCapture(e.pointerId);
    pointerActive = true;
    pointerMoved = false;
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    moveTo(e.clientX);
  }, { passive: false });

  cvs.addEventListener('pointermove', (e) => {
    if (!pointerActive || !running) return;
    e.preventDefault();
    if (Math.abs(e.clientX - pointerStartX) > 6 || Math.abs(e.clientY - pointerStartY) > 6) {
      pointerMoved = true;
    }
    moveTo(e.clientX);
  }, { passive: false });

  const endPointer = (e) => {
    if (!pointerActive) return;
    pointerActive = false;
    // A tap (no drag) fires.
    if (!pointerMoved && running) shoot();
  };
  cvs.addEventListener('pointerup', endPointer);
  cvs.addEventListener('pointercancel', () => { pointerActive = false; });

  // On-screen buttons: hold to move/fire.
  function bindHold(el, key) {
    const on = (e) => { e.preventDefault(); keys[key] = true; };
    const off = (e) => { e.preventDefault(); keys[key] = false; };
    el.addEventListener('pointerdown', on, { passive: false });
    el.addEventListener('pointerup', off, { passive: false });
    el.addEventListener('pointerleave', off, { passive: false });
    el.addEventListener('pointercancel', off, { passive: false });
  }
  bindHold(document.getElementById('btn-left'), 'left');
  bindHold(document.getElementById('btn-right'), 'right');
  bindHold(document.getElementById('btn-fire'), 'fire');

  // Keyboard for desktop testing.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { keys.fire = true; e.preventDefault(); }
    if (e.key === 'Enter' && !running) startGame();
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') keys.fire = false;
  });

  // ---- update ----
  function aliveInvaders() {
    return invaders.filter(i => i.alive);
  }

  function update(dt) {
    if (!running) return;

    if (fireCooldown > 0) fireCooldown -= dt;
    if (shakeT > 0) shakeT -= dt;

    // player movement
    const spd = 260 * dt;
    if (keys.left) player.x -= spd;
    if (keys.right) player.x += spd;
    if (keys.fire) shoot();
    player.x = Math.max(4, Math.min(W - player.w - 4, player.x));

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y += b.vy * dt * 60;
      if (b.y < -10) bullets.splice(i, 1);
    }
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.y += b.vy * dt * 60;
      if (b.y > H + 10) enemyBullets.splice(i, 1);
    }

    // invader block movement: step horizontally, drop on edge, speed up as they die
    const alive = aliveInvaders();
    const remaining = alive.length;
    const total = INV_ROWS * INV_COLS;
    const speedMul = 1 + (1 - remaining / total) * 2.6;

    invTimer += dt * invSpeed * speedMul * 60;
    if (invTimer >= 12) {
      invTimer = 0;
      let hitEdge = false;
      for (const inv of alive) {
        if ((dir > 0 && inv.x + inv.w + 6 > W) || (dir < 0 && inv.x - 6 < 0)) { hitEdge = true; break; }
      }
      if (hitEdge) {
        dir *= -1;
        for (const inv of alive) inv.y += 8;
        beep(180, 0.05, 'sawtooth', 0.03);
      } else {
        for (const inv of alive) inv.x += 6 * dir;
      }
    }

    for (const inv of alive) inv.bob += dt * 4;

    // invader firing
    if (alive.length && Math.random() < dt * (0.35 + wave * 0.12)) {
      const shooter = alive[Math.floor(Math.random() * alive.length)];
      enemyBullets.push({ x: shooter.x + shooter.w / 2, y: shooter.y + shooter.h, vy: 3.1 + wave * 0.25 });
    }

    // bullet vs invader
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      let hit = false;
      for (const inv of alive) {
        if (b.x > inv.x && b.x < inv.x + inv.w && b.y > inv.y && b.y < inv.y + inv.h) {
          inv.alive = false;
          hit = true;
          const pts = inv.type === 2 ? 30 : (inv.type === 1 ? 20 : 10);
          score += pts;
          spawnParticles(inv.x + inv.w / 2, inv.y + inv.h / 2, '#5ef2a0', 8);
          beep(420 - inv.type * 60, 0.08, 'square', 0.05);
          updateHud();
          break;
        }
      }
      if (hit) bullets.splice(bi, 1);
    }

    // enemy bullet vs player
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (b.x > player.x && b.x < player.x + player.w && b.y > player.y && b.y < player.y + player.h) {
        enemyBullets.splice(i, 1);
        loseLife();
        return;
      }
    }

    // invaders reach the player line -> game over
    for (const inv of alive) {
      if (inv.y + inv.h >= player.y - 2) { endGame(); return; }
    }

    // wave cleared
    if (remaining === 0) {
      wave++;
      beep(880, 0.12, 'triangle', 0.06);
      const carryScore = score, carryLives = lives;
      reset(false);
      score = carryScore; lives = carryLives;
      updateHud();
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= dt * 1.8;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function loseLife() {
    lives--;
    updateHud();
    shakeT = 0.35;
    spawnParticles(player.x + player.w / 2, player.y, '#ff5c7a', 14);
    beep(140, 0.25, 'sawtooth', 0.07);
    if (lives <= 0) { endGame(); return; }
    // brief invulnerability: clear the field of enemy shots
    enemyBullets.length = 0;
    player.x = (W - player.w) / 2;
  }

  function endGame() {
    running = false;
    gameOver = true;
    beep(90, 0.5, 'sawtooth', 0.08);
    scoreFinal.textContent = 'SCORE ' + score + '  ·  WAVE ' + wave;
    subEl.innerHTML = 'DRAG or TAP ◀ ▶ to move<br>TAP ▲ (or just tap the sky) to fire<br>Clear the invaders before they land';
    startBtn.textContent = 'PLAY AGAIN';
    overlay.classList.remove('hidden');
  }

  // ---- draw ----
  function drawInvader(x, y, w, h, type, alive) {
    const col = type === 2 ? '#ff7ab8' : (type === 1 ? '#ffd166' : '#5ef2a0');
    ctx.fillStyle = col;
    // Simple pixel-art invader built from rectangles.
    const u = w / 11;
    const px = (c, r) => ctx.fillRect(Math.round(x + c * u), Math.round(y + r * (h / 7)), u + 1, h / 7 + 1);
    // body
    px(2, 1); px(3, 1); px(4, 1); px(5, 1); px(6, 1); px(7, 1); px(8, 1);
    px(1, 2); px(2, 2); px(3, 2); px(4, 2); px(5, 2); px(6, 2); px(7, 2); px(8, 2); px(9, 2);
    px(0, 3); px(2, 3); px(3, 3); px(4, 3); px(5, 3); px(6, 3); px(7, 3); px(9, 3);
    px(0, 4); px(2, 4); px(3, 4); px(4, 4); px(5, 4); px(6, 4); px(7, 4); px(9, 4);
    px(2, 5); px(3, 5); px(7, 5); px(8, 5);
    // animated legs
    const alt = alive ? Math.floor(Date.now() / 320) % 2 : 0;
    if (alt === 0) { px(1, 6); px(4, 6); px(6, 6); px(9, 6); }
    else { px(2, 6); px(4, 6); px(6, 6); px(8, 6); }
  }

  function drawPlayer() {
    ctx.fillStyle = '#4fc3ff';
    const x = Math.round(player.x), y = Math.round(player.y);
    ctx.fillRect(x + 12, y, 6, 4);
    ctx.fillRect(x + 8, y + 4, 14, 4);
    ctx.fillRect(x, y + 8, 30, 6);
    ctx.fillStyle = '#bde9ff';
    ctx.fillRect(x + 13, y + 1, 4, 2);
  }

  function render() {
    ctx.save();
    if (shakeT > 0) {
      ctx.translate((Math.random() - 0.5) * 5 * shakeT * 3, (Math.random() - 0.5) * 5 * shakeT * 3);
    }

    // stars
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97 % W), sy = (i * 53 % H);
      ctx.fillRect(sx, sy, 1.4, 1.4);
    }

    // ground line
    ctx.fillStyle = 'rgba(94,242,160,.35)';
    ctx.fillRect(0, player.y + player.h + 6, W, 1);

    // invaders
    for (const inv of invaders) {
      if (!inv.alive) continue;
      drawInvader(inv.x, inv.y, inv.w, inv.h, inv.type, true);
    }

    // bullets
    ctx.fillStyle = '#eaffff';
    for (const b of bullets) ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 7, 2.5, 9);
    ctx.fillStyle = '#ff7ab8';
    for (const b of enemyBullets) ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y), 2.5, 9);

    drawPlayer();

    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2.5, 2.5);
    }
    ctx.globalAlpha = 1;

    // wave banner
    if (running) {
      ctx.fillStyle = 'rgba(232,240,255,.35)';
      ctx.font = '10px ui-monospace,monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WAVE ' + wave, W / 2, 22);
    }

    ctx.restore();
  }

  // ---- loop ----
  let last = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    update(dt);
    render();
    animId = requestAnimationFrame(loop);
  }

  function startGame() {
    overlay.classList.add('hidden');
    reset(true);
    running = true;
    if (!animId) animId = requestAnimationFrame(loop);
  }

  startBtn.addEventListener('click', (e) => { e.preventDefault(); startGame(); });

  // prevent iOS scroll/zoom gestures from fighting the game
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => { if (e.target.closest('canvas')) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault());

  resize();
  reset(true);
  running = false;
  render();
})();
