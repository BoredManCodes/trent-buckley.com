/* trent-buckley.com - terminal mini-arcade
 * Each game registers itself onto window.Games. The terminal's `play` command
 * spins up an overlay host, hands the game a container + close callback, and
 * the game wires its own controls. Esc / clicking the [X] always exits.
 */
(() => {
  "use strict";

  const Games = (window.Games = {
    list: [],
    byId: {},
  });

  function register(game) {
    Games.list.push(game);
    Games.byId[game.id] = game;
  }

  // ---------- Overlay host ----------
  function makeOverlay(title, subtitle) {
    const overlay = document.createElement("div");
    overlay.className = "game-overlay";
    overlay.innerHTML = `
      <div class="game-frame">
        <header class="game-header">
          <span class="game-title">[ ${title} ]</span>
          <span class="game-subtitle">${subtitle || ""}</span>
          <button class="game-close" aria-label="Close game">[ esc to quit ]</button>
        </header>
        <div class="game-body"></div>
        <footer class="game-footer"></footer>
      </div>
    `;
    document.body.appendChild(overlay);

    const body = overlay.querySelector(".game-body");
    const footer = overlay.querySelector(".game-footer");
    const closeBtn = overlay.querySelector(".game-close");

    let onClose = () => {};
    let closed = false;

    function close() {
      if (closed) return;
      closed = true;
      try { onClose(); } catch (e) { /* swallow - we're tearing down */ }
      overlay.remove();
      window.removeEventListener("keydown", escHandler, true);
    }

    function escHandler(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", escHandler, true);
    closeBtn.addEventListener("click", close);

    return {
      overlay,
      body,
      footer,
      close,
      setOnClose: (fn) => { onClose = fn; },
      setFooter: (html) => { footer.innerHTML = html; },
    };
  }

  Games.launch = function launch(id) {
    const game = Games.byId[id];
    if (!game) return false;
    const host = makeOverlay(game.title, game.subtitle || "");
    try {
      game.start(host);
    } catch (err) {
      host.body.textContent = "error starting game: " + (err && err.message);
      console.error(err);
    }
    return true;
  };

  // ---------- Helpers ----------
  function getAccent() {
    return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#4afa7b";
  }
  function getFg() {
    return getComputedStyle(document.documentElement).getPropertyValue("--fg").trim() || "#c8ffd6";
  }
  function getFgDim() {
    return getComputedStyle(document.documentElement).getPropertyValue("--fg-dim").trim() || "#79c393";
  }

  function fitCanvas(body, canvas, ratio = 4 / 3) {
    function resize() {
      const rect = body.getBoundingClientRect();
      let w = rect.width;
      let h = rect.height;
      const wantsW = h * ratio;
      if (wantsW <= w) { w = wantsW; } else { h = w / ratio; }
      canvas.style.width = Math.floor(w) + "px";
      canvas.style.height = Math.floor(h) + "px";
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(body);
    return () => ro.disconnect();
  }

  // ============================================================
  // ASTEROIDS
  // ============================================================
  register({
    id: "asteroids",
    title: "ASTEROIDS",
    subtitle: "←/→ rotate · ↑ thrust · Space fire · H hyperspace · P pause",
    start(host) {
      const W = 800, H = 600;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      canvas.tabIndex = 0;
      host.body.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      const stopFit = fitCanvas(host.body, canvas, W / H);

      const keys = Object.create(null);
      const onKeyDown = (e) => {
        const k = e.key.toLowerCase();
        keys[k] = true;
        if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
        if (k === "p") state.paused = !state.paused;
        if (k === "h" && !state.paused && state.ship.alive) hyperspace();
        if (k === "r" && state.gameOver) reset();
        if (k === " " && state.ship.alive && !state.paused) shoot();
      };
      const onKeyUp = (e) => { keys[e.key.toLowerCase()] = false; };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);

      const state = {
        ship: null,
        bullets: [],
        asteroids: [],
        particles: [],
        score: 0,
        lives: 3,
        wave: 1,
        paused: false,
        gameOver: false,
        hyperspaceCooldown: 0,
        respawnTimer: 0,
      };

      function newShip() {
        return {
          x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2,
          alive: true, invincible: 120,
        };
      }

      function spawnAsteroids(n) {
        const list = [];
        for (let i = 0; i < n; i++) {
          let x, y;
          do {
            x = Math.random() * W; y = Math.random() * H;
          } while (Math.hypot(x - W/2, y - H/2) < 150);
          list.push(makeAsteroid(x, y, 3));
        }
        return list;
      }

      function makeAsteroid(x, y, size) {
        const speed = (Math.random() * 0.6 + 0.4) * (4 - size) * 0.6;
        const a = Math.random() * Math.PI * 2;
        const radius = size === 3 ? 48 : size === 2 ? 26 : 14;
        const verts = 10 + Math.floor(Math.random() * 4);
        const shape = [];
        for (let i = 0; i < verts; i++) {
          const ang = (i / verts) * Math.PI * 2;
          const r = radius * (0.7 + Math.random() * 0.5);
          shape.push([Math.cos(ang) * r, Math.sin(ang) * r]);
        }
        return {
          x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          size, radius, shape, rot: 0, vrot: (Math.random() - 0.5) * 0.02,
        };
      }

      function shoot() {
        if (state.bullets.length >= 5) return;
        const s = state.ship;
        state.bullets.push({
          x: s.x + Math.cos(s.a) * 14,
          y: s.y + Math.sin(s.a) * 14,
          vx: s.vx + Math.cos(s.a) * 7,
          vy: s.vy + Math.sin(s.a) * 7,
          life: 60,
        });
      }

      function hyperspace() {
        if (state.hyperspaceCooldown > 0) return;
        state.ship.x = Math.random() * W;
        state.ship.y = Math.random() * H;
        state.ship.vx = state.ship.vy = 0;
        state.hyperspaceCooldown = 180;
      }

      function explode(x, y, n = 16, color) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = Math.random() * 3 + 0.5;
          state.particles.push({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 30 + Math.random() * 20, color: color || getAccent(),
          });
        }
      }

      function wrap(o) {
        if (o.x < 0) o.x += W; if (o.x > W) o.x -= W;
        if (o.y < 0) o.y += H; if (o.y > H) o.y -= H;
      }

      function reset() {
        state.ship = newShip();
        state.bullets = [];
        state.particles = [];
        state.asteroids = spawnAsteroids(4);
        state.score = 0;
        state.lives = 3;
        state.wave = 1;
        state.gameOver = false;
        state.respawnTimer = 0;
      }

      reset();

      function update() {
        if (state.paused || state.gameOver) return;

        if (state.hyperspaceCooldown > 0) state.hyperspaceCooldown--;

        const s = state.ship;
        if (s.alive) {
          if (keys["arrowleft"] || keys["a"]) s.a -= 0.07;
          if (keys["arrowright"] || keys["d"]) s.a += 0.07;
          if (keys["arrowup"] || keys["w"]) {
            s.vx += Math.cos(s.a) * 0.12;
            s.vy += Math.sin(s.a) * 0.12;
            // exhaust particle
            if (Math.random() < 0.6) {
              const ea = s.a + Math.PI + (Math.random() - 0.5) * 0.6;
              state.particles.push({
                x: s.x + Math.cos(s.a + Math.PI) * 12,
                y: s.y + Math.sin(s.a + Math.PI) * 12,
                vx: s.vx + Math.cos(ea) * 2,
                vy: s.vy + Math.sin(ea) * 2,
                life: 18, color: getFgDim(),
              });
            }
          }
          s.vx *= 0.992; s.vy *= 0.992;
          s.x += s.vx; s.y += s.vy;
          wrap(s);
          if (s.invincible > 0) s.invincible--;
        } else {
          state.respawnTimer--;
          if (state.respawnTimer <= 0 && state.lives > 0) {
            state.ship = newShip();
          } else if (state.respawnTimer <= 0 && state.lives <= 0) {
            state.gameOver = true;
          }
        }

        for (const b of state.bullets) {
          b.x += b.vx; b.y += b.vy; b.life--;
          wrap(b);
        }
        state.bullets = state.bullets.filter((b) => b.life > 0);

        for (const a of state.asteroids) {
          a.x += a.vx; a.y += a.vy; a.rot += a.vrot;
          wrap(a);
        }

        for (const p of state.particles) {
          p.x += p.vx; p.y += p.vy; p.life--;
        }
        state.particles = state.particles.filter((p) => p.life > 0);

        // bullet vs asteroid
        for (let i = state.bullets.length - 1; i >= 0; i--) {
          const b = state.bullets[i];
          for (let j = state.asteroids.length - 1; j >= 0; j--) {
            const a = state.asteroids[j];
            if (Math.hypot(a.x - b.x, a.y - b.y) < a.radius) {
              state.bullets.splice(i, 1);
              state.asteroids.splice(j, 1);
              explode(a.x, a.y, 10);
              state.score += a.size === 3 ? 20 : a.size === 2 ? 50 : 100;
              if (a.size > 1) {
                for (let k = 0; k < 2; k++) {
                  state.asteroids.push(makeAsteroid(a.x, a.y, a.size - 1));
                }
              }
              break;
            }
          }
        }

        // ship vs asteroid
        if (s.alive && s.invincible <= 0) {
          for (const a of state.asteroids) {
            if (Math.hypot(a.x - s.x, a.y - s.y) < a.radius + 8) {
              s.alive = false;
              state.lives--;
              state.respawnTimer = 90;
              explode(s.x, s.y, 30, getAccent());
              break;
            }
          }
        }

        // next wave
        if (state.asteroids.length === 0) {
          state.wave++;
          state.asteroids = spawnAsteroids(Math.min(3 + state.wave, 10));
        }
      }

      function draw() {
        ctx.fillStyle = "rgba(2, 4, 3, 0.35)";
        ctx.fillRect(0, 0, W, H);

        const accent = getAccent();
        const fg = getFg();

        ctx.lineWidth = 1.5;

        // asteroids
        ctx.strokeStyle = fg;
        for (const a of state.asteroids) {
          ctx.save();
          ctx.translate(a.x, a.y);
          ctx.rotate(a.rot);
          ctx.beginPath();
          a.shape.forEach(([x, y], i) => {
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        // bullets
        ctx.fillStyle = accent;
        for (const b of state.bullets) {
          ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
        }

        // particles
        for (const p of state.particles) {
          ctx.globalAlpha = Math.max(0, p.life / 50);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        }
        ctx.globalAlpha = 1;

        // ship
        const s = state.ship;
        if (s.alive) {
          if (s.invincible > 0 && Math.floor(s.invincible / 4) % 2 === 0) {
            // blink
          } else {
            ctx.strokeStyle = accent;
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.a);
            ctx.beginPath();
            ctx.moveTo(14, 0);
            ctx.lineTo(-10, 8);
            ctx.lineTo(-6, 0);
            ctx.lineTo(-10, -8);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
          }
        }

        // HUD
        ctx.fillStyle = accent;
        ctx.font = "16px JetBrains Mono, monospace";
        ctx.textAlign = "left";
        ctx.fillText(`SCORE ${state.score}`, 16, 24);
        ctx.fillText(`WAVE ${state.wave}`, 16, 44);
        ctx.textAlign = "right";
        let livesStr = "";
        for (let i = 0; i < state.lives; i++) livesStr += "▲ ";
        ctx.fillText(livesStr.trim() || "—", W - 16, 24);

        if (state.paused) banner("PAUSED", "press P to resume");
        if (state.gameOver) banner("GAME OVER", `final score ${state.score} · press R to restart`);
      }

      function banner(big, small) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, H/2 - 60, W, 120);
        ctx.fillStyle = getAccent();
        ctx.font = "bold 36px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText(big, W/2, H/2 - 4);
        ctx.font = "16px JetBrains Mono, monospace";
        ctx.fillStyle = getFg();
        ctx.fillText(small, W/2, H/2 + 24);
      }

      let raf = 0;
      function loop() {
        update();
        draw();
        raf = requestAnimationFrame(loop);
      }
      loop();

      host.setOnClose(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        stopFit();
      });
      canvas.focus();
    },
  });

  // ============================================================
  // SNAKE
  // ============================================================
  register({
    id: "snake",
    title: "SNAKE",
    subtitle: "Arrows / WASD · P pause · R restart",
    start(host) {
      const COLS = 28, ROWS = 21, CELL = 22;
      const W = COLS * CELL, H = ROWS * CELL;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      host.body.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      const stopFit = fitCanvas(host.body, canvas, W / H);

      const state = { snake: [], dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 },
        food: null, score: 0, best: +localStorage.getItem("tb.snake.best") || 0,
        paused: false, gameOver: false, tick: 0, speed: 8 };

      function placeFood() {
        while (true) {
          const f = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
          if (!state.snake.some((s) => s.x === f.x && s.y === f.y)) return f;
        }
      }

      function reset() {
        state.snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
        state.dir = { x: 1, y: 0 }; state.nextDir = { x: 1, y: 0 };
        state.food = placeFood(); state.score = 0;
        state.gameOver = false; state.tick = 0; state.speed = 8;
      }
      reset();

      const onKey = (e) => {
        const k = e.key.toLowerCase();
        if (["arrowup", "w"].includes(k) && state.dir.y !== 1) state.nextDir = { x: 0, y: -1 };
        else if (["arrowdown", "s"].includes(k) && state.dir.y !== -1) state.nextDir = { x: 0, y: 1 };
        else if (["arrowleft", "a"].includes(k) && state.dir.x !== 1) state.nextDir = { x: -1, y: 0 };
        else if (["arrowright", "d"].includes(k) && state.dir.x !== -1) state.nextDir = { x: 1, y: 0 };
        else if (k === "p") state.paused = !state.paused;
        else if (k === "r" && state.gameOver) reset();
        if (["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)) e.preventDefault();
      };
      window.addEventListener("keydown", onKey);

      function step() {
        if (state.paused || state.gameOver) return;
        state.dir = state.nextDir;
        const head = { x: state.snake[0].x + state.dir.x, y: state.snake[0].y + state.dir.y };
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
            state.snake.some((s) => s.x === head.x && s.y === head.y)) {
          state.gameOver = true;
          if (state.score > state.best) {
            state.best = state.score;
            localStorage.setItem("tb.snake.best", state.best);
          }
          return;
        }
        state.snake.unshift(head);
        if (head.x === state.food.x && head.y === state.food.y) {
          state.score++;
          if (state.score % 5 === 0 && state.speed < 18) state.speed++;
          state.food = placeFood();
        } else {
          state.snake.pop();
        }
      }

      function draw() {
        ctx.fillStyle = "#020403";
        ctx.fillRect(0, 0, W, H);
        // grid
        ctx.strokeStyle = "rgba(74,250,123,0.06)";
        ctx.lineWidth = 1;
        for (let x = 0; x <= COLS; x++) {
          ctx.beginPath(); ctx.moveTo(x*CELL, 0); ctx.lineTo(x*CELL, H); ctx.stroke();
        }
        for (let y = 0; y <= ROWS; y++) {
          ctx.beginPath(); ctx.moveTo(0, y*CELL); ctx.lineTo(W, y*CELL); ctx.stroke();
        }
        // food
        ctx.fillStyle = getAccent();
        const f = state.food;
        ctx.fillRect(f.x*CELL + 4, f.y*CELL + 4, CELL - 8, CELL - 8);
        // snake
        state.snake.forEach((s, i) => {
          ctx.fillStyle = i === 0 ? getAccent() : getFgDim();
          ctx.fillRect(s.x*CELL + 2, s.y*CELL + 2, CELL - 4, CELL - 4);
        });
        // HUD
        ctx.fillStyle = getAccent();
        ctx.font = "16px JetBrains Mono, monospace";
        ctx.textAlign = "left";
        ctx.fillText(`SCORE ${state.score}`, 10, 22);
        ctx.textAlign = "right";
        ctx.fillText(`BEST ${state.best}`, W - 10, 22);
        if (state.paused) drawCenter("PAUSED");
        if (state.gameOver) drawCenter("GAME OVER", "press R to restart");
      }
      function drawCenter(big, small) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, H/2 - 50, W, 100);
        ctx.fillStyle = getAccent();
        ctx.font = "bold 32px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText(big, W/2, H/2);
        if (small) {
          ctx.font = "14px JetBrains Mono, monospace";
          ctx.fillStyle = getFg();
          ctx.fillText(small, W/2, H/2 + 24);
        }
      }

      let raf = 0;
      function loop() {
        state.tick++;
        if (state.tick % Math.max(1, Math.floor(60 / state.speed)) === 0) step();
        draw();
        raf = requestAnimationFrame(loop);
      }
      loop();

      host.setOnClose(() => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey); stopFit(); });
    },
  });

  // ============================================================
  // TETRIS
  // ============================================================
  register({
    id: "tetris",
    title: "TETRIS",
    subtitle: "← → move · ↓ soft drop · ↑/X rotate · Z rotate ccw · Space hard drop · P pause",
    start(host) {
      const COLS = 10, ROWS = 20, CELL = 26;
      const W = COLS * CELL + 180, H = ROWS * CELL;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      host.body.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      const stopFit = fitCanvas(host.body, canvas, W / H);

      const SHAPES = {
        I: [[1,1,1,1]],
        O: [[1,1],[1,1]],
        T: [[0,1,0],[1,1,1]],
        S: [[0,1,1],[1,1,0]],
        Z: [[1,1,0],[0,1,1]],
        L: [[0,0,1],[1,1,1]],
        J: [[1,0,0],[1,1,1]],
      };
      const COLORS = { I:"#7be7ff", O:"#ffe066", T:"#c792ea", S:"#9ce37d", Z:"#ff7a90", L:"#ffae57", J:"#7aa2f7" };

      const state = {
        grid: Array.from({length: ROWS}, () => Array(COLS).fill(0)),
        piece: null, next: null, score: 0, lines: 0, level: 1,
        dropTimer: 0, paused: false, over: false,
      };

      function newPiece(type) {
        type = type || "IOTSZLJ"[Math.floor(Math.random() * 7)];
        const shape = SHAPES[type].map((r) => r.slice());
        return { type, shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0 };
      }

      state.piece = newPiece();
      state.next = newPiece();

      function rotate(shape, ccw) {
        const r = shape.length, c = shape[0].length;
        const out = Array.from({length: c}, () => Array(r).fill(0));
        for (let y = 0; y < r; y++) for (let x = 0; x < c; x++) {
          if (ccw) out[c - 1 - x][y] = shape[y][x];
          else out[x][r - 1 - y] = shape[y][x];
        }
        return out;
      }

      function collides(piece, dx, dy, shape) {
        shape = shape || piece.shape;
        for (let y = 0; y < shape.length; y++) for (let x = 0; x < shape[0].length; x++) {
          if (!shape[y][x]) continue;
          const nx = piece.x + x + dx, ny = piece.y + y + dy;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && state.grid[ny][nx]) return true;
        }
        return false;
      }

      function lock() {
        const p = state.piece;
        for (let y = 0; y < p.shape.length; y++) for (let x = 0; x < p.shape[0].length; x++) {
          if (p.shape[y][x] && p.y + y >= 0) state.grid[p.y + y][p.x + x] = p.type;
        }
        // clear lines
        let cleared = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
          if (state.grid[y].every(Boolean)) {
            state.grid.splice(y, 1);
            state.grid.unshift(Array(COLS).fill(0));
            cleared++;
            y++;
          }
        }
        if (cleared) {
          state.lines += cleared;
          state.score += [0, 100, 300, 500, 800][cleared] * state.level;
          state.level = 1 + Math.floor(state.lines / 10);
        }
        state.piece = state.next;
        state.next = newPiece();
        if (collides(state.piece, 0, 0)) state.over = true;
      }

      function hardDrop() {
        while (!collides(state.piece, 0, 1)) state.piece.y++;
        lock();
      }

      const onKey = (e) => {
        if (state.over) {
          if (e.key.toLowerCase() === "r") { restart(); }
          return;
        }
        if (state.paused && e.key.toLowerCase() !== "p") return;
        const k = e.key.toLowerCase();
        const p = state.piece;
        if (["arrowleft","a"].includes(k)) { if (!collides(p,-1,0)) p.x--; e.preventDefault(); }
        else if (["arrowright","d"].includes(k)) { if (!collides(p,1,0)) p.x++; e.preventDefault(); }
        else if (["arrowdown","s"].includes(k)) { if (!collides(p,0,1)) { p.y++; state.score++; } e.preventDefault(); }
        else if (["arrowup","x"].includes(k)) { const ns = rotate(p.shape, false); if (!collides(p,0,0,ns)) p.shape = ns; e.preventDefault(); }
        else if (k === "z") { const ns = rotate(p.shape, true); if (!collides(p,0,0,ns)) p.shape = ns; e.preventDefault(); }
        else if (k === " ") { hardDrop(); e.preventDefault(); }
        else if (k === "p") state.paused = !state.paused;
      };
      window.addEventListener("keydown", onKey);

      function restart() {
        state.grid = Array.from({length: ROWS}, () => Array(COLS).fill(0));
        state.piece = newPiece(); state.next = newPiece();
        state.score = 0; state.lines = 0; state.level = 1;
        state.over = false;
      }

      function drawCell(x, y, type, ghost) {
        const c = COLORS[type] || "#fff";
        ctx.fillStyle = ghost ? "rgba(255,255,255,0.08)" : c;
        ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
        if (!ghost) {
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, 3);
        }
      }

      function draw() {
        ctx.fillStyle = "#020403";
        ctx.fillRect(0, 0, W, H);
        // playfield border
        ctx.strokeStyle = "rgba(74,250,123,0.25)";
        ctx.strokeRect(0, 0, COLS*CELL, ROWS*CELL);
        // grid blocks
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          if (state.grid[y][x]) drawCell(x, y, state.grid[y][x]);
        }
        // ghost
        if (!state.over) {
          let gy = 0;
          while (!collides(state.piece, 0, gy + 1)) gy++;
          const p = state.piece;
          for (let y = 0; y < p.shape.length; y++) for (let x = 0; x < p.shape[0].length; x++) {
            if (p.shape[y][x]) drawCell(p.x + x, p.y + y + gy, p.type, true);
          }
          // active piece
          for (let y = 0; y < p.shape.length; y++) for (let x = 0; x < p.shape[0].length; x++) {
            if (p.shape[y][x]) drawCell(p.x + x, p.y + y, p.type);
          }
        }
        // sidebar
        const sx = COLS*CELL + 16;
        ctx.fillStyle = getAccent();
        ctx.font = "16px JetBrains Mono, monospace";
        ctx.textAlign = "left";
        ctx.fillText("SCORE", sx, 20);
        ctx.fillStyle = getFg();
        ctx.fillText(String(state.score), sx, 40);
        ctx.fillStyle = getAccent();
        ctx.fillText("LINES", sx, 70);
        ctx.fillStyle = getFg();
        ctx.fillText(String(state.lines), sx, 90);
        ctx.fillStyle = getAccent();
        ctx.fillText("LEVEL", sx, 120);
        ctx.fillStyle = getFg();
        ctx.fillText(String(state.level), sx, 140);
        ctx.fillStyle = getAccent();
        ctx.fillText("NEXT", sx, 180);
        const np = state.next;
        for (let y = 0; y < np.shape.length; y++) for (let x = 0; x < np.shape[0].length; x++) {
          if (np.shape[y][x]) {
            ctx.fillStyle = COLORS[np.type];
            ctx.fillRect(sx + x*18, 200 + y*18, 16, 16);
          }
        }
        if (state.paused) {
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(0, H/2 - 30, COLS*CELL, 60);
          ctx.fillStyle = getAccent();
          ctx.font = "bold 28px JetBrains Mono, monospace";
          ctx.textAlign = "center";
          ctx.fillText("PAUSED", COLS*CELL/2, H/2 + 8);
        }
        if (state.over) {
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillRect(0, H/2 - 50, COLS*CELL, 100);
          ctx.fillStyle = getAccent();
          ctx.font = "bold 28px JetBrains Mono, monospace";
          ctx.textAlign = "center";
          ctx.fillText("GAME OVER", COLS*CELL/2, H/2 - 8);
          ctx.font = "14px JetBrains Mono, monospace";
          ctx.fillStyle = getFg();
          ctx.fillText("press R to restart", COLS*CELL/2, H/2 + 18);
        }
      }

      let raf = 0, last = performance.now();
      function loop(t) {
        const dt = t - last; last = t;
        if (!state.paused && !state.over) {
          state.dropTimer += dt;
          const interval = Math.max(80, 600 - (state.level - 1) * 50);
          while (state.dropTimer >= interval) {
            state.dropTimer -= interval;
            if (!collides(state.piece, 0, 1)) state.piece.y++;
            else lock();
          }
        }
        draw();
        raf = requestAnimationFrame(loop);
      }
      raf = requestAnimationFrame(loop);

      host.setOnClose(() => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey); stopFit(); });
    },
  });

  // ============================================================
  // 2048
  // ============================================================
  register({
    id: "2048",
    title: "2048",
    subtitle: "Arrows / WASD to slide · R restart",
    start(host) {
      const wrap = document.createElement("div");
      wrap.className = "g2048";
      host.body.appendChild(wrap);

      const state = { grid: null, score: 0, best: +localStorage.getItem("tb.2048.best") || 0, won: false, over: false };

      function empty() { return Array.from({length: 4}, () => Array(4).fill(0)); }
      function reset() {
        state.grid = empty(); state.score = 0; state.won = false; state.over = false;
        addTile(); addTile(); render();
      }
      function addTile() {
        const empties = [];
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!state.grid[y][x]) empties.push([x,y]);
        if (!empties.length) return;
        const [x,y] = empties[Math.floor(Math.random() * empties.length)];
        state.grid[y][x] = Math.random() < 0.9 ? 2 : 4;
      }
      function slide(row) {
        const arr = row.filter(Boolean);
        for (let i = 0; i < arr.length - 1; i++) {
          if (arr[i] === arr[i+1]) {
            arr[i] *= 2; state.score += arr[i];
            if (arr[i] === 2048) state.won = true;
            arr.splice(i+1, 1);
          }
        }
        while (arr.length < 4) arr.push(0);
        return arr;
      }
      function move(dir) {
        const before = JSON.stringify(state.grid);
        if (dir === "left") {
          state.grid = state.grid.map(slide);
        } else if (dir === "right") {
          state.grid = state.grid.map((r) => slide(r.slice().reverse()).reverse());
        } else if (dir === "up") {
          for (let x = 0; x < 4; x++) {
            const col = [state.grid[0][x], state.grid[1][x], state.grid[2][x], state.grid[3][x]];
            const slid = slide(col);
            for (let y = 0; y < 4; y++) state.grid[y][x] = slid[y];
          }
        } else if (dir === "down") {
          for (let x = 0; x < 4; x++) {
            const col = [state.grid[3][x], state.grid[2][x], state.grid[1][x], state.grid[0][x]];
            const slid = slide(col);
            for (let y = 0; y < 4; y++) state.grid[3-y][x] = slid[y];
          }
        }
        if (JSON.stringify(state.grid) !== before) {
          addTile();
          if (state.score > state.best) {
            state.best = state.score;
            localStorage.setItem("tb.2048.best", state.best);
          }
          checkOver();
          render();
        }
      }
      function checkOver() {
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
          if (!state.grid[y][x]) return;
          if (x < 3 && state.grid[y][x] === state.grid[y][x+1]) return;
          if (y < 3 && state.grid[y][x] === state.grid[y+1][x]) return;
        }
        state.over = true;
      }
      function render() {
        const tileColor = (v) => {
          const map = {
            0: "#0d1110", 2: "#1a3326", 4: "#22513a", 8: "#2d6e4d", 16: "#3a8f5f",
            32: "#4ab070", 64: "#5cd182", 128: "#7be29c", 256: "#9bf0b3", 512: "#bff8cd",
            1024: "#ddf9e2", 2048: "#ffe18a"
          };
          return map[v] || "#ffd166";
        };
        wrap.innerHTML = `
          <div class="g2048-hud">
            <div><span>SCORE</span><b>${state.score}</b></div>
            <div><span>BEST</span><b>${state.best}</b></div>
            <button class="g2048-restart">RESTART</button>
          </div>
          <div class="g2048-board"></div>
          ${state.won ? `<div class="g2048-toast">YOU MADE 2048! keep going for a higher score</div>` : ""}
          ${state.over ? `<div class="g2048-toast over">GAME OVER · press R to restart</div>` : ""}
        `;
        const board = wrap.querySelector(".g2048-board");
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
          const v = state.grid[y][x];
          const cell = document.createElement("div");
          cell.className = "g2048-cell";
          cell.style.background = tileColor(v);
          cell.style.color = v >= 64 ? "#02110a" : "#c8ffd6";
          cell.textContent = v ? v : "";
          if (v >= 1024) cell.classList.add("small");
          board.appendChild(cell);
        }
        wrap.querySelector(".g2048-restart").addEventListener("click", reset);
      }
      const onKey = (e) => {
        const k = e.key.toLowerCase();
        if (state.over && k === "r") { reset(); return; }
        if (["arrowleft","a"].includes(k)) { move("left"); e.preventDefault(); }
        else if (["arrowright","d"].includes(k)) { move("right"); e.preventDefault(); }
        else if (["arrowup","w"].includes(k)) { move("up"); e.preventDefault(); }
        else if (["arrowdown","s"].includes(k)) { move("down"); e.preventDefault(); }
        else if (k === "r") { reset(); }
      };
      window.addEventListener("keydown", onKey);
      reset();

      host.setOnClose(() => { window.removeEventListener("keydown", onKey); });
    },
  });

  // ============================================================
  // PONG
  // ============================================================
  register({
    id: "pong",
    title: "PONG",
    subtitle: "↑/↓ or W/S · first to 11 wins · P pause · R restart",
    start(host) {
      const W = 800, H = 500;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      host.body.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      const stopFit = fitCanvas(host.body, canvas, W / H);

      const state = {
        p: { x: 20, y: H/2 - 40, w: 10, h: 80, vy: 0, score: 0 },
        ai: { x: W - 30, y: H/2 - 40, w: 10, h: 80, vy: 0, score: 0 },
        ball: null, paused: false, over: null,
      };
      function resetBall(toLeft) {
        state.ball = {
          x: W/2, y: H/2, r: 7,
          vx: (toLeft ? -1 : 1) * 5, vy: (Math.random() - 0.5) * 6,
        };
      }
      function reset() {
        state.p.score = 0; state.ai.score = 0; state.over = null;
        resetBall(Math.random() < 0.5);
      }
      reset();

      const keys = Object.create(null);
      const onKD = (e) => {
        keys[e.key.toLowerCase()] = true;
        if (["arrowup","arrowdown"," "].includes(e.key.toLowerCase())) e.preventDefault();
        if (e.key.toLowerCase() === "p") state.paused = !state.paused;
        if (e.key.toLowerCase() === "r") reset();
      };
      const onKU = (e) => { keys[e.key.toLowerCase()] = false; };
      window.addEventListener("keydown", onKD);
      window.addEventListener("keyup", onKU);

      function update() {
        if (state.paused || state.over) return;
        const speed = 7;
        if (keys["arrowup"] || keys["w"]) state.p.y -= speed;
        if (keys["arrowdown"] || keys["s"]) state.p.y += speed;
        state.p.y = Math.max(0, Math.min(H - state.p.h, state.p.y));
        // AI: track the ball with a max speed
        const aiCenter = state.ai.y + state.ai.h/2;
        const target = state.ball.y;
        const aiSpeed = 5.2;
        if (Math.abs(target - aiCenter) > aiSpeed) state.ai.y += Math.sign(target - aiCenter) * aiSpeed;
        state.ai.y = Math.max(0, Math.min(H - state.ai.h, state.ai.y));
        // ball
        const b = state.ball;
        b.x += b.vx; b.y += b.vy;
        if (b.y < b.r) { b.y = b.r; b.vy *= -1; }
        if (b.y > H - b.r) { b.y = H - b.r; b.vy *= -1; }
        // collide paddles
        function hits(p) {
          return b.x - b.r < p.x + p.w && b.x + b.r > p.x &&
                 b.y > p.y && b.y < p.y + p.h;
        }
        if (hits(state.p) && b.vx < 0) {
          b.vx = Math.abs(b.vx) + 0.4;
          b.vy += ((b.y - (state.p.y + state.p.h/2)) / (state.p.h/2)) * 3;
        }
        if (hits(state.ai) && b.vx > 0) {
          b.vx = -Math.abs(b.vx) - 0.4;
          b.vy += ((b.y - (state.ai.y + state.ai.h/2)) / (state.ai.h/2)) * 3;
        }
        if (b.x < -20) { state.ai.score++; resetBall(false); }
        else if (b.x > W + 20) { state.p.score++; resetBall(true); }
        if (state.p.score >= 11) state.over = "YOU WIN";
        else if (state.ai.score >= 11) state.over = "CPU WINS";
      }

      function draw() {
        ctx.fillStyle = "#020403";
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(74,250,123,0.25)";
        ctx.setLineDash([8, 12]);
        ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = getAccent();
        ctx.fillRect(state.p.x, state.p.y, state.p.w, state.p.h);
        ctx.fillRect(state.ai.x, state.ai.y, state.ai.w, state.ai.h);
        ctx.beginPath(); ctx.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI*2); ctx.fill();
        ctx.font = "bold 36px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(state.p.score), W/2 - 60, 50);
        ctx.fillText(String(state.ai.score), W/2 + 60, 50);
        if (state.paused) {
          ctx.font = "bold 28px JetBrains Mono, monospace";
          ctx.fillText("PAUSED", W/2, H/2);
        }
        if (state.over) {
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(0, H/2 - 50, W, 100);
          ctx.fillStyle = getAccent();
          ctx.font = "bold 36px JetBrains Mono, monospace";
          ctx.fillText(state.over, W/2, H/2 + 4);
          ctx.font = "14px JetBrains Mono, monospace";
          ctx.fillStyle = getFg();
          ctx.fillText("press R for rematch", W/2, H/2 + 30);
        }
      }

      let raf = 0;
      function loop() { update(); draw(); raf = requestAnimationFrame(loop); }
      loop();

      host.setOnClose(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKD);
        window.removeEventListener("keyup", onKU);
        stopFit();
      });
    },
  });

  // ============================================================
  // CHESS (2-player local)
  // ============================================================
  register({
    id: "chess",
    title: "CHESS",
    subtitle: "click piece then destination · plays vs Stockfish or 2-player local",
    start(host) {
      const wrap = document.createElement("div");
      wrap.className = "chess-wrap";
      wrap.innerHTML = `
        <div class="chess-side">
          <div class="chess-status"></div>
          <div class="chess-engine">
            <div class="chess-engine-row">
              <label>opponent</label>
              <div class="chess-seg" data-seg="ai">
                <button data-val="off" class="active">2-player</button>
                <button data-val="b">vs AI (you=W)</button>
                <button data-val="w">vs AI (you=B)</button>
              </div>
            </div>
            <div class="chess-engine-row">
              <label>skill <span class="chess-skill-val">10</span></label>
              <input type="range" class="chess-skill" min="0" max="20" value="10" />
            </div>
            <div class="chess-engine-status">engine: idle</div>
          </div>
          <div class="chess-history"></div>
          <div class="chess-controls">
            <button data-act="restart">restart</button>
            <button data-act="undo">undo</button>
            <button data-act="flip">flip board</button>
          </div>
          <div class="chess-help">
            <div>Includes: castling, en passant, promotion (auto-Queen).</div>
            <div>Stockfish loads from CDN on first AI move (~3s, one-time).</div>
          </div>
        </div>
        <div class="chess-board" tabindex="0"></div>
      `;
      host.body.appendChild(wrap);

      const board = wrap.querySelector(".chess-board");
      const statusEl = wrap.querySelector(".chess-status");
      const historyEl = wrap.querySelector(".chess-history");
      const engineStatusEl = wrap.querySelector(".chess-engine-status");
      const skillEl = wrap.querySelector(".chess-skill");
      const skillValEl = wrap.querySelector(".chess-skill-val");
      const aiSegEl = wrap.querySelector('.chess-seg[data-seg="ai"]');

      // Board state: 8x8, board[0] = rank 8 (black back rank)
      // pieces: "wK","wQ","wR","wB","wN","wP", and "b..." equivalents
      const GLYPH = { wK:"♔", wQ:"♕", wR:"♖", wB:"♗", wN:"♘", wP:"♙",
                       bK:"♚", bQ:"♛", bR:"♜", bB:"♝", bN:"♞", bP:"♟" };

      const state = {
        grid: null,
        turn: "w",
        selected: null,
        legalForSelected: [],
        history: [], // {from, to, captured, fenLike, san, prevState}
        flipped: false,
        castling: { wK: true, wQ: true, bK: true, bQ: true }, // K-side / Q-side
        enPassant: null, // square like {x,y}
        halfmove: 0, fullmove: 1,
        result: null,
        ai: { color: "off", skill: 10, status: "idle", thinking: false, moveSeq: 0 },
      };

      // Stockfish worker — lazily created on first AI move. Loaded via a Blob shim
      // so cross-origin worker loading works on static hosts.
      let engine = null;
      const ENGINE_URL = "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js";
      function ensureEngine() {
        if (engine) return engine;
        try {
          const blobURL = URL.createObjectURL(new Blob(
            [`importScripts(${JSON.stringify(ENGINE_URL)});`],
            { type: "application/javascript" }
          ));
          const w = new Worker(blobURL);
          engine = { worker: w, ready: false, pendingResolve: null };
          state.ai.status = "loading";
          updateEngineStatus();
          w.onmessage = (ev) => {
            const line = typeof ev.data === "string" ? ev.data : (ev.data && ev.data.data) || "";
            if (!line) return;
            if (line === "uciok") {
              w.postMessage("isready");
            } else if (line === "readyok") {
              if (!engine.ready) {
                engine.ready = true;
                state.ai.status = "ready";
                updateEngineStatus();
                if (state.ai.color !== "off" && state.turn === state.ai.color && !state.result) requestAIMove();
              }
            } else if (line.startsWith("bestmove")) {
              const parts = line.split(/\s+/);
              const uci = parts[1];
              if (engine.pendingResolve) {
                const r = engine.pendingResolve;
                engine.pendingResolve = null;
                r(uci);
              }
            }
          };
          w.onerror = () => {
            state.ai.status = "error";
            engine = null;
            updateEngineStatus();
          };
          w.postMessage("uci");
          return engine;
        } catch (e) {
          state.ai.status = "error";
          updateEngineStatus();
          return null;
        }
      }

      function updateEngineStatus() {
        const map = {
          idle: "engine: idle",
          loading: "engine: loading…",
          ready: "engine: ready",
          thinking: "engine: thinking…",
          error: "engine: failed to load",
        };
        engineStatusEl.textContent = map[state.ai.status] || state.ai.status;
        engineStatusEl.classList.toggle("err", state.ai.status === "error");
      }

      function buildFEN() {
        const rows = [];
        for (let y = 0; y < 8; y++) {
          let r = "", empty = 0;
          for (let x = 0; x < 8; x++) {
            const p = state.grid[y][x];
            if (!p) { empty++; continue; }
            if (empty) { r += empty; empty = 0; }
            let c = p[1];
            r += p[0] === "w" ? c : c.toLowerCase();
          }
          if (empty) r += empty;
          rows.push(r);
        }
        let castle = "";
        if (state.castling.wK) castle += "K";
        if (state.castling.wQ) castle += "Q";
        if (state.castling.bK) castle += "k";
        if (state.castling.bQ) castle += "q";
        if (!castle) castle = "-";
        const ep = state.enPassant ? squareName(state.enPassant.x, state.enPassant.y) : "-";
        return `${rows.join("/")} ${state.turn} ${castle} ${ep} ${state.halfmove} ${state.fullmove}`;
      }

      function uciToCoords(uci) {
        const fx = "abcdefgh".indexOf(uci[0]);
        const fy = 8 - parseInt(uci[1], 10);
        const tx = "abcdefgh".indexOf(uci[2]);
        const ty = 8 - parseInt(uci[3], 10);
        return { fx, fy, tx, ty };
      }

      function applyUCIMove(uci) {
        const { fx, fy, tx, ty } = uciToCoords(uci);
        const moves = legalMoves(fx, fy);
        const m = moves.find((m) => m.x === tx && m.y === ty);
        if (!m) {
          // Engine returned a move that isn't legal under our rules — bail safely.
          state.ai.status = "ready";
          updateEngineStatus();
          return;
        }
        applyMove(fx, fy, m);
      }

      function requestAIMove() {
        if (state.result) return;
        if (state.ai.color === "off" || state.turn !== state.ai.color) return;
        const eng = ensureEngine();
        if (!eng) return;
        if (!eng.ready || state.ai.thinking) return;
        state.ai.thinking = true;
        state.ai.status = "thinking";
        updateEngineStatus();
        const seq = ++state.ai.moveSeq;
        const fen = buildFEN();
        const skill = state.ai.skill;
        // Movetime scales with skill so weak settings respond fast.
        const moveTime = 200 + skill * 60;
        eng.worker.postMessage("ucinewgame");
        eng.worker.postMessage(`setoption name Skill Level value ${skill}`);
        eng.worker.postMessage(`position fen ${fen}`);
        const p = new Promise((resolve) => { eng.pendingResolve = resolve; });
        eng.worker.postMessage(`go movetime ${moveTime}`);
        p.then((uci) => {
          // Stale response (user undid / restarted / changed sides) — drop it.
          if (seq !== state.ai.moveSeq) {
            state.ai.thinking = false;
            state.ai.status = eng.ready ? "ready" : state.ai.status;
            updateEngineStatus();
            return;
          }
          if (uci && uci !== "(none)") applyUCIMove(uci);
          state.ai.thinking = false;
          state.ai.status = eng.ready ? "ready" : state.ai.status;
          updateEngineStatus();
        });
      }

      function invalidateAI() {
        // Bumps the seq so any in-flight engine result is discarded, and clears flags.
        state.ai.moveSeq++;
        state.ai.thinking = false;
        if (engine && engine.ready) state.ai.status = "ready";
        updateEngineStatus();
      }

      function reset() {
        state.grid = [
          ["bR","bN","bB","bQ","bK","bB","bN","bR"],
          ["bP","bP","bP","bP","bP","bP","bP","bP"],
          [null,null,null,null,null,null,null,null],
          [null,null,null,null,null,null,null,null],
          [null,null,null,null,null,null,null,null],
          [null,null,null,null,null,null,null,null],
          ["wP","wP","wP","wP","wP","wP","wP","wP"],
          ["wR","wN","wB","wQ","wK","wB","wN","wR"],
        ];
        state.turn = "w"; state.selected = null; state.legalForSelected = [];
        state.history = [];
        state.castling = { wK:true,wQ:true,bK:true,bQ:true };
        state.enPassant = null; state.halfmove = 0; state.fullmove = 1;
        state.result = null;
        render();
      }

      function inside(x,y) { return x>=0 && x<8 && y>=0 && y<8; }
      function pieceAt(x,y) { return state.grid[y][x]; }
      function colorOf(p) { return p ? p[0] : null; }
      function clone(g) { return g.map(r => r.slice()); }

      function pseudoMoves(grid, x, y, ep, castling) {
        const p = grid[y][x]; if (!p) return [];
        const c = p[0], t = p[1];
        const enemy = c === "w" ? "b" : "w";
        const moves = [];
        const push = (nx, ny, opts={}) => {
          if (!inside(nx,ny)) return false;
          const target = grid[ny][nx];
          if (target && target[0] === c) return false;
          moves.push({ x: nx, y: ny, capture: !!target, ...opts });
          return !target;
        };
        const slide = (dx,dy) => {
          let nx=x+dx, ny=y+dy;
          while (inside(nx,ny)) {
            const t2 = grid[ny][nx];
            if (!t2) moves.push({x:nx,y:ny});
            else { if (t2[0] !== c) moves.push({x:nx,y:ny,capture:true}); break; }
            nx+=dx; ny+=dy;
          }
        };
        if (t === "P") {
          const dir = c === "w" ? -1 : 1;
          const startRank = c === "w" ? 6 : 1;
          if (inside(x, y+dir) && !grid[y+dir][x]) {
            moves.push({x, y: y+dir, promote: (y+dir === 0 || y+dir === 7)});
            if (y === startRank && !grid[y+2*dir][x]) {
              moves.push({x, y: y+2*dir, double: true});
            }
          }
          for (const dx of [-1,1]) {
            const nx = x+dx, ny = y+dir;
            if (!inside(nx,ny)) continue;
            const t2 = grid[ny][nx];
            if (t2 && t2[0] === enemy) {
              moves.push({x:nx,y:ny,capture:true,promote:(ny===0||ny===7)});
            } else if (ep && ep.x === nx && ep.y === ny) {
              moves.push({x:nx,y:ny,capture:true,enPassant:true});
            }
          }
        } else if (t === "N") {
          for (const [dx,dy] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]) push(x+dx,y+dy);
        } else if (t === "B") {
          slide(1,1); slide(1,-1); slide(-1,1); slide(-1,-1);
        } else if (t === "R") {
          slide(1,0); slide(-1,0); slide(0,1); slide(0,-1);
        } else if (t === "Q") {
          slide(1,0); slide(-1,0); slide(0,1); slide(0,-1);
          slide(1,1); slide(1,-1); slide(-1,1); slide(-1,-1);
        } else if (t === "K") {
          for (const dx of [-1,0,1]) for (const dy of [-1,0,1]) {
            if (!dx && !dy) continue;
            push(x+dx, y+dy);
          }
          // castling
          const homeY = c === "w" ? 7 : 0;
          if (y === homeY && x === 4) {
            const ck = c === "w" ? castling.wK : castling.bK;
            const cq = c === "w" ? castling.wQ : castling.bQ;
            if (ck && !grid[homeY][5] && !grid[homeY][6] && grid[homeY][7] === c+"R") {
              moves.push({x:6,y:homeY,castle:"K"});
            }
            if (cq && !grid[homeY][1] && !grid[homeY][2] && !grid[homeY][3] && grid[homeY][0] === c+"R") {
              moves.push({x:2,y:homeY,castle:"Q"});
            }
          }
        }
        return moves;
      }

      function squareAttacked(grid, x, y, byColor) {
        // If any pseudo-move (ignoring castling, ignoring own-king-in-check rule) of byColor lands on (x,y), it's attacked.
        // Special: pawn attacks are diagonal regardless of pawn move forwards.
        for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) {
          const p = grid[yy][xx]; if (!p || p[0] !== byColor) continue;
          if (p[1] === "P") {
            const dir = byColor === "w" ? -1 : 1;
            for (const dx of [-1,1]) {
              if (xx+dx === x && yy+dir === y) return true;
            }
          } else {
            const ms = pseudoMoves(grid, xx, yy, null, {wK:false,wQ:false,bK:false,bQ:false});
            for (const m of ms) if (m.x === x && m.y === y) return true;
          }
        }
        return false;
      }

      function findKing(grid, c) {
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
          if (grid[y][x] === c+"K") return {x,y};
        }
        return null;
      }

      function inCheck(grid, c) {
        const k = findKing(grid, c);
        if (!k) return false;
        return squareAttacked(grid, k.x, k.y, c === "w" ? "b" : "w");
      }

      function legalMoves(x, y) {
        const p = state.grid[y][x]; if (!p || p[0] !== state.turn) return [];
        const candidates = pseudoMoves(state.grid, x, y, state.enPassant, state.castling);
        const legal = [];
        for (const m of candidates) {
          // For castling, also require: not currently in check, and the squares the king passes through aren't attacked.
          if (m.castle) {
            if (inCheck(state.grid, p[0])) continue;
            const homeY = p[0] === "w" ? 7 : 0;
            const enemyC = p[0] === "w" ? "b" : "w";
            const passSquares = m.castle === "K" ? [{x:5,y:homeY},{x:6,y:homeY}] : [{x:3,y:homeY},{x:2,y:homeY}];
            let ok = true;
            for (const sq of passSquares) {
              if (squareAttacked(state.grid, sq.x, sq.y, enemyC)) { ok = false; break; }
            }
            if (!ok) continue;
          }
          // simulate and ensure own king not in check
          const g2 = clone(state.grid);
          g2[y][x] = null;
          if (m.enPassant) g2[y][m.x] = null; // captured pawn behind
          if (m.castle) {
            const homeY = p[0] === "w" ? 7 : 0;
            if (m.castle === "K") { g2[homeY][6] = p; g2[homeY][5] = p[0]+"R"; g2[homeY][7] = null; }
            else { g2[homeY][2] = p; g2[homeY][3] = p[0]+"R"; g2[homeY][0] = null; }
          } else {
            g2[m.y][m.x] = m.promote ? p[0]+"Q" : p;
          }
          if (!inCheck(g2, p[0])) legal.push(m);
        }
        return legal;
      }

      function allLegal(color) {
        const out = [];
        const savedTurn = state.turn;
        state.turn = color;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
          const p = state.grid[y][x];
          if (p && p[0] === color) {
            const ms = legalMoves(x, y);
            for (const m of ms) out.push({from:{x,y}, to: m, piece: p});
          }
        }
        state.turn = savedTurn;
        return out;
      }

      function fileLetter(x) { return "abcdefgh"[x]; }
      function rankNumber(y) { return 8 - y; }
      function squareName(x,y) { return fileLetter(x) + rankNumber(y); }

      function makeSAN(fromX, fromY, m, piece, capturedBefore) {
        if (m.castle) return m.castle === "K" ? "O-O" : "O-O-O";
        const t = piece[1];
        let s = "";
        if (t !== "P") s += t;
        if (m.capture || m.enPassant) {
          if (t === "P") s += fileLetter(fromX);
          s += "x";
        }
        s += squareName(m.x, m.y);
        if (m.promote) s += "=Q";
        return s;
      }

      function applyMove(fromX, fromY, m) {
        const piece = state.grid[fromY][fromX];
        const capturedBefore = state.grid[m.y][m.x];
        const prev = JSON.parse(JSON.stringify({
          grid: state.grid, turn: state.turn, castling: state.castling,
          enPassant: state.enPassant, halfmove: state.halfmove, fullmove: state.fullmove,
        }));

        // execute
        state.grid[fromY][fromX] = null;
        if (m.enPassant) state.grid[fromY][m.x] = null;
        if (m.castle) {
          const homeY = piece[0] === "w" ? 7 : 0;
          if (m.castle === "K") {
            state.grid[homeY][6] = piece;
            state.grid[homeY][5] = piece[0]+"R";
            state.grid[homeY][7] = null;
          } else {
            state.grid[homeY][2] = piece;
            state.grid[homeY][3] = piece[0]+"R";
            state.grid[homeY][0] = null;
          }
        } else {
          state.grid[m.y][m.x] = m.promote ? piece[0]+"Q" : piece;
        }

        // castling rights
        if (piece[1] === "K") {
          if (piece[0] === "w") { state.castling.wK = false; state.castling.wQ = false; }
          else { state.castling.bK = false; state.castling.bQ = false; }
        }
        if (piece[1] === "R") {
          if (fromY === 7 && fromX === 0) state.castling.wQ = false;
          if (fromY === 7 && fromX === 7) state.castling.wK = false;
          if (fromY === 0 && fromX === 0) state.castling.bQ = false;
          if (fromY === 0 && fromX === 7) state.castling.bK = false;
        }
        if (capturedBefore && capturedBefore[1] === "R") {
          if (m.y === 7 && m.x === 0) state.castling.wQ = false;
          if (m.y === 7 && m.x === 7) state.castling.wK = false;
          if (m.y === 0 && m.x === 0) state.castling.bQ = false;
          if (m.y === 0 && m.x === 7) state.castling.bK = false;
        }

        // en passant target
        if (m.double) {
          state.enPassant = { x: fromX, y: (fromY + m.y) / 2 };
        } else {
          state.enPassant = null;
        }

        // clocks
        if (piece[1] === "P" || m.capture || m.enPassant) state.halfmove = 0;
        else state.halfmove++;
        if (state.turn === "b") state.fullmove++;

        // SAN
        let san = makeSAN(fromX, fromY, m, piece, capturedBefore);

        // switch turn
        state.turn = state.turn === "w" ? "b" : "w";

        // check / mate
        const opponent = state.turn;
        const oppMoves = allLegal(opponent);
        if (inCheck(state.grid, opponent)) {
          if (!oppMoves.length) { san += "#"; state.result = `${piece[0] === "w" ? "WHITE" : "BLACK"} wins by checkmate`; }
          else san += "+";
        } else if (!oppMoves.length) {
          state.result = "draw by stalemate";
        }

        state.history.push({ san, prev, color: piece[0], num: prev.fullmove });
        render();
        // Hand off to engine if it's AI's turn now.
        if (!state.result && state.ai.color !== "off" && state.turn === state.ai.color) {
          requestAIMove();
        }
      }

      function undo() {
        if (!state.history.length) return;
        invalidateAI();
        // If playing vs AI, undo two plies (the AI reply + the human move) so the
        // human is on move again. Falls back to one ply when it's not enough.
        const plies = (state.ai.color !== "off" && state.history.length >= 2) ? 2 : 1;
        for (let i = 0; i < plies; i++) {
          const last = state.history.pop();
          if (!last) break;
          const p = last.prev;
          state.grid = p.grid;
          state.turn = p.turn;
          state.castling = p.castling;
          state.enPassant = p.enPassant;
          state.halfmove = p.halfmove;
          state.fullmove = p.fullmove;
        }
        state.selected = null; state.legalForSelected = [];
        state.result = null;
        render();
      }

      function onSquareClick(x, y) {
        if (state.result) return;
        // Block clicks while the engine is thinking, or when it's the AI's turn.
        if (state.ai.thinking) return;
        if (state.ai.color !== "off" && state.turn === state.ai.color) return;
        const p = state.grid[y][x];
        if (state.selected) {
          const move = state.legalForSelected.find((m) => m.x === x && m.y === y);
          if (move) {
            applyMove(state.selected.x, state.selected.y, move);
            state.selected = null;
            state.legalForSelected = [];
            return;
          }
          if (p && p[0] === state.turn) {
            state.selected = { x, y };
            state.legalForSelected = legalMoves(x, y);
            render();
            return;
          }
          state.selected = null;
          state.legalForSelected = [];
          render();
          return;
        }
        if (p && p[0] === state.turn) {
          state.selected = { x, y };
          state.legalForSelected = legalMoves(x, y);
          render();
        }
      }

      function render() {
        board.innerHTML = "";
        const order = [...Array(8).keys()];
        const ys = state.flipped ? order.slice().reverse() : order;
        const xs = state.flipped ? order.slice().reverse() : order;
        for (const y of ys) {
          for (const x of xs) {
            const sq = document.createElement("button");
            const light = (x + y) % 2 === 0;
            sq.className = `chess-sq ${light ? "light" : "dark"}`;
            sq.setAttribute("data-sq", squareName(x,y));
            const piece = state.grid[y][x];
            if (piece) {
              const span = document.createElement("span");
              span.className = `chess-piece ${piece[0]}`;
              span.textContent = GLYPH[piece];
              sq.appendChild(span);
            }
            if (state.selected && state.selected.x === x && state.selected.y === y) {
              sq.classList.add("selected");
            }
            if (state.legalForSelected.some((m) => m.x === x && m.y === y)) {
              sq.classList.add(piece ? "capture" : "legal");
            }
            sq.addEventListener("click", () => onSquareClick(x, y));
            board.appendChild(sq);
          }
        }
        const turnLabel = state.turn === "w" ? "WHITE" : "BLACK";
        let line = `${turnLabel} to move`;
        if (state.result) line = state.result;
        else if (inCheck(state.grid, state.turn)) line += " · CHECK";
        statusEl.textContent = line;

        // history paired
        const lines = [];
        for (let i = 0; i < state.history.length; i += 2) {
          const w = state.history[i], b = state.history[i+1];
          const num = (w.color === "w") ? w.num : (i ? state.history[i-1].num + 1 : 1);
          lines.push(`${String(num).padStart(2,' ')}. ${w.san.padEnd(7)}${b ? b.san : ""}`);
        }
        historyEl.textContent = lines.join("\n");
      }

      function restartGame() {
        invalidateAI();
        reset();
        // If AI plays white, start it thinking immediately.
        if (state.ai.color === "w") requestAIMove();
      }

      wrap.querySelector('[data-act="restart"]').addEventListener("click", restartGame);
      wrap.querySelector('[data-act="undo"]').addEventListener("click", undo);
      wrap.querySelector('[data-act="flip"]').addEventListener("click", () => { state.flipped = !state.flipped; render(); });

      // AI side selector (segmented control)
      function setAIColor(val) {
        if (state.ai.color === val) return;
        state.ai.color = val;
        invalidateAI();
        for (const b of aiSegEl.querySelectorAll("button")) {
          b.classList.toggle("active", b.getAttribute("data-val") === val);
        }
        // Auto-flip board so the human's pieces are at the bottom.
        if (val === "w") state.flipped = true;        // human plays black
        else if (val === "b") state.flipped = false;  // human plays white
        if (val !== "off") ensureEngine();
        render();
        if (val !== "off" && state.turn === val && !state.result) requestAIMove();
      }
      aiSegEl.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-val]");
        if (btn) setAIColor(btn.getAttribute("data-val"));
      });

      skillEl.addEventListener("input", () => {
        state.ai.skill = +skillEl.value;
        skillValEl.textContent = skillEl.value;
      });

      const onKey = (e) => {
        if (e.key.toLowerCase() === "r") restartGame();
        if (e.key.toLowerCase() === "u") undo();
      };
      window.addEventListener("keydown", onKey);

      reset();
      updateEngineStatus();

      host.setOnClose(() => {
        window.removeEventListener("keydown", onKey);
        if (engine && engine.worker) {
          try { engine.worker.terminate(); } catch (e) { /* ignore */ }
          engine = null;
        }
      });
    },
  });

  // ============================================================
  // SPACE INVADERS
  // ============================================================
  register({
    id: "invaders",
    title: "SPACE INVADERS",
    subtitle: "←/→ move · Space fire · P pause · R restart",
    start(host) {
      const W = 800, H = 600;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      host.body.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      const stopFit = fitCanvas(host.body, canvas, W / H);

      // 11x5 invader grid, 3 rows of types (top=small, middle=medium, bottom=large)
      const COLS = 11, ROWS = 5;
      const INV_W = 32, INV_H = 22, INV_GAP_X = 18, INV_GAP_Y = 14;

      // 11x8 bitmap sprites per invader type, two animation frames each
      const SPRITES = {
        // small (squid)
        s: [
          ["00011000","00111100","01111110","11011011","11111111","00100100","01011010","10100101"],
          ["00011000","00111100","01111110","11011011","11111111","01011010","10000001","01000010"],
        ],
        // medium (crab)
        m: [
          ["00100100","00100100","01111110","11011011","11111111","10111101","10100101","00011000"],
          ["00100100","10100101","11111111","11011011","11111111","01111110","00100100","01000010"],
        ],
        // large (octopus)
        l: [
          ["00111100","11111111","11111111","11011011","11111111","00100100","01011010","10100101"],
          ["00111100","11111111","11111111","11011011","11111111","01011010","10100101","01000010"],
        ],
      };
      const ROW_TYPE = ["s","m","m","l","l"];
      const ROW_POINTS = [30, 20, 20, 10, 10];

      const state = {
        player: { x: W/2, y: H - 50, w: 38, h: 18, cooldown: 0 },
        bullets: [],
        bombs: [],
        invaders: [],
        invDir: 1, invStepTimer: 0, invStepInterval: 28, invFrame: 0,
        ufo: null, ufoTimer: 600 + Math.random() * 600,
        bunkers: [],
        score: 0, lives: 3, wave: 1,
        paused: false, over: false, won: false,
        flash: 0, particles: [],
      };

      function spawnInvaders(wave) {
        const list = [];
        const startY = 80 + Math.min(wave - 1, 4) * 16;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            list.push({
              x: 80 + c * (INV_W + INV_GAP_X),
              y: startY + r * (INV_H + INV_GAP_Y),
              type: ROW_TYPE[r], points: ROW_POINTS[r], alive: true, row: r, col: c,
            });
          }
        }
        return list;
      }

      function makeBunker(x) {
        // 22x16 cells, simple arch shape; each cell is 4x4 px
        const grid = [];
        const cw = 22, ch = 16;
        for (let y = 0; y < ch; y++) {
          const row = [];
          for (let xx = 0; xx < cw; xx++) {
            let solid = 1;
            // arch cutout at bottom-center
            if (y >= 10 && xx >= 7 && xx <= 14) solid = 0;
            // round top corners
            if (y < 2 && (xx < 2 || xx > cw - 3)) solid = 0;
            row.push(solid);
          }
          grid.push(row);
        }
        return { x, y: H - 130, cw, ch, cell: 4, grid };
      }

      function reset() {
        state.player.x = W/2; state.player.y = H - 50; state.player.cooldown = 0;
        state.bullets = []; state.bombs = []; state.particles = [];
        state.invaders = spawnInvaders(state.wave);
        state.invDir = 1; state.invStepTimer = 0; state.invStepInterval = 28;
        state.ufo = null; state.ufoTimer = 600 + Math.random() * 600;
        state.bunkers = [makeBunker(120), makeBunker(310), makeBunker(500), makeBunker(680)];
        state.over = false; state.won = false;
      }

      function fullReset() {
        state.score = 0; state.lives = 3; state.wave = 1;
        reset();
      }
      fullReset();

      const keys = Object.create(null);
      const onKD = (e) => {
        const k = e.key.toLowerCase();
        keys[k] = true;
        if ([" ", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
        if (k === "p") state.paused = !state.paused;
        if (k === "r" && (state.over || state.won)) fullReset();
        if (k === " " && !state.over && !state.won && !state.paused) shoot();
      };
      const onKU = (e) => { keys[e.key.toLowerCase()] = false; };
      window.addEventListener("keydown", onKD);
      window.addEventListener("keyup", onKU);

      function shoot() {
        if (state.player.cooldown > 0) return;
        if (state.bullets.length >= 2) return; // classic single-shot feel
        state.bullets.push({ x: state.player.x, y: state.player.y - 12, vy: -8 });
        state.player.cooldown = 14;
      }

      function explodeAt(x, y, n, color) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = Math.random() * 2.5 + 0.5;
          state.particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 24 + Math.random()*16, color });
        }
      }

      function drawSprite(x, y, sprite, color, scale = 3) {
        ctx.fillStyle = color;
        for (let yy = 0; yy < sprite.length; yy++) {
          const row = sprite[yy];
          for (let xx = 0; xx < row.length; xx++) {
            if (row[xx] === "1") ctx.fillRect(x + xx*scale, y + yy*scale, scale, scale);
          }
        }
      }

      function aliveInvaders() { return state.invaders.filter(i => i.alive); }

      function update() {
        if (state.paused || state.over || state.won) return;

        // player
        const speed = 5;
        if (keys["arrowleft"] || keys["a"]) state.player.x -= speed;
        if (keys["arrowright"] || keys["d"]) state.player.x += speed;
        state.player.x = Math.max(state.player.w/2, Math.min(W - state.player.w/2, state.player.x));
        if (state.player.cooldown > 0) state.player.cooldown--;

        // bullets
        for (const b of state.bullets) b.y += b.vy;
        state.bullets = state.bullets.filter(b => b.y > -20);
        // bombs
        for (const b of state.bombs) b.y += b.vy;
        state.bombs = state.bombs.filter(b => b.y < H + 20);

        // invader step (speeds up as fewer remain)
        state.invStepTimer++;
        const remaining = aliveInvaders().length;
        const totalCount = COLS * ROWS;
        const interval = Math.max(4, Math.floor(state.invStepInterval * (remaining / totalCount) + 4));
        if (state.invStepTimer >= interval) {
          state.invStepTimer = 0;
          state.invFrame ^= 1;
          // determine if any alive invader hits the wall
          const alive = aliveInvaders();
          let drop = false;
          for (const inv of alive) {
            if (state.invDir > 0 && inv.x + INV_W >= W - 30) { drop = true; break; }
            if (state.invDir < 0 && inv.x <= 30) { drop = true; break; }
          }
          for (const inv of alive) {
            if (drop) inv.y += 14;
            else inv.x += state.invDir * 12;
          }
          if (drop) state.invDir *= -1;
        }

        // invader shooting: lowest invader in a random column shoots
        if (Math.random() < 0.025 && aliveInvaders().length) {
          const cols = {};
          for (const inv of aliveInvaders()) {
            if (!cols[inv.col] || inv.y > cols[inv.col].y) cols[inv.col] = inv;
          }
          const shooters = Object.values(cols);
          const s = shooters[Math.floor(Math.random() * shooters.length)];
          state.bombs.push({ x: s.x + INV_W/2, y: s.y + INV_H, vy: 4 });
        }

        // UFO
        state.ufoTimer--;
        if (!state.ufo && state.ufoTimer <= 0) {
          const fromLeft = Math.random() < 0.5;
          state.ufo = { x: fromLeft ? -50 : W + 50, y: 40, vx: fromLeft ? 2.5 : -2.5,
                        points: [50, 100, 150, 300][Math.floor(Math.random() * 4)] };
        }
        if (state.ufo) {
          state.ufo.x += state.ufo.vx;
          if (state.ufo.x < -60 || state.ufo.x > W + 60) {
            state.ufo = null;
            state.ufoTimer = 800 + Math.random() * 700;
          }
        }

        // bullet vs invader
        for (let i = state.bullets.length - 1; i >= 0; i--) {
          const b = state.bullets[i];
          for (const inv of state.invaders) {
            if (!inv.alive) continue;
            if (b.x >= inv.x && b.x <= inv.x + INV_W && b.y >= inv.y && b.y <= inv.y + INV_H) {
              inv.alive = false;
              state.bullets.splice(i, 1);
              state.score += inv.points;
              explodeAt(inv.x + INV_W/2, inv.y + INV_H/2, 8, "#9ce37d");
              break;
            }
          }
        }
        // bullet vs UFO
        if (state.ufo) {
          for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            if (b.x > state.ufo.x - 18 && b.x < state.ufo.x + 18 && b.y > state.ufo.y - 8 && b.y < state.ufo.y + 12) {
              state.score += state.ufo.points;
              explodeAt(state.ufo.x, state.ufo.y, 16, "#ff7a90");
              state.ufo = null;
              state.ufoTimer = 800 + Math.random() * 700;
              state.bullets.splice(i, 1);
              break;
            }
          }
        }

        // bullet/bomb vs bunker
        function chipBunker(b, projX, projY) {
          const localX = projX - b.x;
          const localY = projY - b.y;
          const cx = Math.floor(localX / b.cell);
          const cy = Math.floor(localY / b.cell);
          if (cx < 0 || cx >= b.cw || cy < 0 || cy >= b.ch) return false;
          if (!b.grid[cy][cx]) return false;
          // chip out a small radius
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            if (dx*dx + dy*dy > 4) continue;
            const nx = cx + dx, ny = cy + dy;
            if (nx>=0&&nx<b.cw&&ny>=0&&ny<b.ch) b.grid[ny][nx] = 0;
          }
          return true;
        }
        for (let i = state.bullets.length - 1; i >= 0; i--) {
          const p = state.bullets[i];
          for (const bk of state.bunkers) {
            if (p.x >= bk.x && p.x <= bk.x + bk.cw*bk.cell &&
                p.y >= bk.y && p.y <= bk.y + bk.ch*bk.cell) {
              if (chipBunker(bk, p.x, p.y)) { state.bullets.splice(i, 1); break; }
            }
          }
        }
        for (let i = state.bombs.length - 1; i >= 0; i--) {
          const p = state.bombs[i];
          for (const bk of state.bunkers) {
            if (p.x >= bk.x && p.x <= bk.x + bk.cw*bk.cell &&
                p.y >= bk.y && p.y <= bk.y + bk.ch*bk.cell) {
              if (chipBunker(bk, p.x, p.y)) { state.bombs.splice(i, 1); break; }
            }
          }
        }

        // bomb vs player
        for (let i = state.bombs.length - 1; i >= 0; i--) {
          const b = state.bombs[i];
          if (b.x > state.player.x - state.player.w/2 && b.x < state.player.x + state.player.w/2 &&
              b.y > state.player.y - state.player.h/2 && b.y < state.player.y + state.player.h/2) {
            state.bombs.splice(i, 1);
            state.lives--;
            state.flash = 30;
            explodeAt(state.player.x, state.player.y, 24, "#4afa7b");
            if (state.lives <= 0) state.over = true;
            break;
          }
        }

        // invader reaches player line
        for (const inv of aliveInvaders()) {
          if (inv.y + INV_H >= state.player.y - 8) {
            state.over = true; state.flash = 60;
            break;
          }
        }

        // wave clear
        if (aliveInvaders().length === 0 && !state.over) {
          state.wave++;
          state.bullets = []; state.bombs = [];
          state.invaders = spawnInvaders(state.wave);
          state.invDir = 1; state.invStepTimer = 0;
          state.invStepInterval = Math.max(10, state.invStepInterval - 4);
        }

        // particles
        for (const p of state.particles) { p.x += p.vx; p.y += p.vy; p.life--; }
        state.particles = state.particles.filter(p => p.life > 0);
        if (state.flash > 0) state.flash--;
      }

      function draw() {
        ctx.fillStyle = "#020403";
        ctx.fillRect(0, 0, W, H);

        // ground line
        ctx.strokeStyle = getAccent();
        ctx.beginPath(); ctx.moveTo(20, H - 24); ctx.lineTo(W - 20, H - 24); ctx.stroke();

        // bunkers
        ctx.fillStyle = "#4afa7b";
        for (const bk of state.bunkers) {
          for (let y = 0; y < bk.ch; y++) for (let x = 0; x < bk.cw; x++) {
            if (bk.grid[y][x]) ctx.fillRect(bk.x + x*bk.cell, bk.y + y*bk.cell, bk.cell, bk.cell);
          }
        }

        // invaders
        for (const inv of state.invaders) {
          if (!inv.alive) continue;
          const sprite = SPRITES[inv.type][state.invFrame];
          const color = inv.type === "s" ? "#ff7a90" : inv.type === "m" ? "#ffe066" : "#9ce37d";
          drawSprite(inv.x, inv.y, sprite, color, 3);
        }

        // ufo
        if (state.ufo) {
          ctx.fillStyle = "#ff7a90";
          ctx.fillRect(state.ufo.x - 16, state.ufo.y - 4, 32, 8);
          ctx.fillRect(state.ufo.x - 8, state.ufo.y - 8, 16, 4);
        }

        // player
        ctx.fillStyle = "#4afa7b";
        const p = state.player;
        ctx.fillRect(p.x - p.w/2, p.y - 4, p.w, 8);
        ctx.fillRect(p.x - 3, p.y - 12, 6, 8);

        // bullets
        ctx.fillStyle = "#fff";
        for (const b of state.bullets) ctx.fillRect(b.x - 1, b.y - 6, 2, 10);
        // bombs
        ctx.fillStyle = "#ff7a90";
        for (const b of state.bombs) ctx.fillRect(b.x - 1.5, b.y - 4, 3, 8);

        // particles
        for (const pt of state.particles) {
          ctx.globalAlpha = Math.max(0, pt.life / 40);
          ctx.fillStyle = pt.color;
          ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
        }
        ctx.globalAlpha = 1;

        // HUD
        ctx.fillStyle = getAccent();
        ctx.font = "16px JetBrains Mono, monospace";
        ctx.textAlign = "left";
        ctx.fillText(`SCORE ${state.score}`, 16, 22);
        ctx.fillText(`WAVE ${state.wave}`, 16, 42);
        ctx.textAlign = "right";
        let livesStr = "";
        for (let i = 0; i < state.lives; i++) livesStr += "▲ ";
        ctx.fillText(livesStr.trim() || "—", W - 16, 22);

        if (state.flash > 0) {
          ctx.fillStyle = `rgba(255,107,122,${state.flash / 60 * 0.25})`;
          ctx.fillRect(0, 0, W, H);
        }

        if (state.paused) banner("PAUSED", "press P to resume");
        if (state.over) banner("GAME OVER", `final score ${state.score} · press R to restart`);
      }

      function banner(big, small) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, H/2 - 60, W, 120);
        ctx.fillStyle = getAccent();
        ctx.font = "bold 36px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText(big, W/2, H/2 - 4);
        ctx.font = "16px JetBrains Mono, monospace";
        ctx.fillStyle = getFg();
        ctx.fillText(small, W/2, H/2 + 24);
      }

      let raf = 0;
      function loop() { update(); draw(); raf = requestAnimationFrame(loop); }
      loop();

      host.setOnClose(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKD);
        window.removeEventListener("keyup", onKU);
        stopFit();
      });
    },
  });

  // ============================================================
  // MINESWEEPER (bonus — reads well as a console game)
  // ============================================================
  register({
    id: "mines",
    title: "MINESWEEPER",
    subtitle: "left-click reveal · right-click flag · R restart",
    start(host) {
      const COLS = 16, ROWS = 16, MINES = 40;
      const wrap = document.createElement("div");
      wrap.className = "ms-wrap";
      wrap.innerHTML = `
        <div class="ms-hud">
          <span class="ms-mines"></span>
          <button class="ms-restart">restart</button>
          <span class="ms-time">0</span>
        </div>
        <div class="ms-board"></div>
      `;
      host.body.appendChild(wrap);
      const boardEl = wrap.querySelector(".ms-board");
      const minesEl = wrap.querySelector(".ms-mines");
      const timeEl = wrap.querySelector(".ms-time");
      boardEl.style.gridTemplateColumns = `repeat(${COLS}, 26px)`;

      const state = { grid: null, revealed: null, flagged: null, started: false, over: false, won: false, t0: 0, flags: 0 };

      function reset() {
        state.grid = Array.from({length:ROWS}, () => Array(COLS).fill(0));
        state.revealed = Array.from({length:ROWS}, () => Array(COLS).fill(false));
        state.flagged = Array.from({length:ROWS}, () => Array(COLS).fill(false));
        state.started = false; state.over = false; state.won = false; state.flags = 0;
        render();
      }

      function plant(safeX, safeY) {
        let placed = 0;
        while (placed < MINES) {
          const x = Math.floor(Math.random() * COLS);
          const y = Math.floor(Math.random() * ROWS);
          if (state.grid[y][x] === -1) continue;
          if (Math.abs(x - safeX) <= 1 && Math.abs(y - safeY) <= 1) continue;
          state.grid[y][x] = -1; placed++;
        }
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          if (state.grid[y][x] === -1) continue;
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x+dx, ny = y+dy;
            if (nx>=0&&nx<COLS&&ny>=0&&ny<ROWS && state.grid[ny][nx] === -1) n++;
          }
          state.grid[y][x] = n;
        }
        state.started = true; state.t0 = performance.now();
      }

      function reveal(x, y) {
        if (state.over || state.flagged[y][x] || state.revealed[y][x]) return;
        state.revealed[y][x] = true;
        if (state.grid[y][x] === -1) { state.over = true; return; }
        if (state.grid[y][x] === 0) {
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x+dx, ny = y+dy;
            if (nx>=0&&nx<COLS&&ny>=0&&ny<ROWS) reveal(nx, ny);
          }
        }
      }

      function checkWin() {
        let unrev = 0;
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          if (!state.revealed[y][x]) unrev++;
        }
        if (unrev === MINES) state.won = true;
      }

      function onClick(x, y, ev) {
        if (state.over || state.won) return;
        if (ev.button === 2 || ev.shiftKey) {
          if (!state.revealed[y][x]) {
            state.flagged[y][x] = !state.flagged[y][x];
            state.flags += state.flagged[y][x] ? 1 : -1;
          }
        } else {
          if (!state.started) plant(x, y);
          reveal(x, y);
          checkWin();
        }
        render();
      }

      function render() {
        boardEl.innerHTML = "";
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          const cell = document.createElement("button");
          cell.className = "ms-cell";
          if (state.revealed[y][x]) {
            cell.classList.add("rev");
            const v = state.grid[y][x];
            if (v === -1) cell.textContent = "✸";
            else if (v > 0) {
              cell.textContent = v;
              cell.classList.add(`n${v}`);
            }
          } else if (state.flagged[y][x]) {
            cell.textContent = "⚑";
            cell.classList.add("flag");
          }
          if (state.over && state.grid[y][x] === -1) {
            cell.classList.add("rev"); cell.textContent = "✸";
          }
          cell.addEventListener("mousedown", (ev) => { ev.preventDefault(); onClick(x, y, ev); });
          cell.addEventListener("contextmenu", (e) => e.preventDefault());
          boardEl.appendChild(cell);
        }
        minesEl.textContent = `MINES ${MINES - state.flags}`;
        if (state.over) timeEl.textContent = "BOOM";
        else if (state.won) timeEl.textContent = "CLEARED";
        else if (state.started) timeEl.textContent = Math.floor((performance.now() - state.t0)/1000) + "s";
        else timeEl.textContent = "0";
      }

      wrap.querySelector(".ms-restart").addEventListener("click", reset);
      const onKey = (e) => { if (e.key.toLowerCase() === "r") reset(); };
      window.addEventListener("keydown", onKey);
      reset();
      let timer = setInterval(() => { if (state.started && !state.over && !state.won) render(); }, 500);

      host.setOnClose(() => { clearInterval(timer); window.removeEventListener("keydown", onKey); });
    },
  });
})();
