const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('bestScore');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const startButton = document.getElementById('startButton');
const soundButton = document.getElementById('soundButton');
const musicButton = document.getElementById('musicButton');
const novaButton = document.getElementById('novaButton');
const canvasControls = document.querySelectorAll('[data-control]');
ctx.imageSmoothingEnabled = false;

const playerSprite = [
  '....C....',
  '...CCC...',
  '..CCCCC..',
  '.CCCCCCC.',
  'CCCCCCCCC',
  '..CCCCC..',
  '..B.C.B..',
  '.BBBBBBB.',
];

const state = {
  started: false,
  over: false,
  score: 0,
  bestScore: 0,
  lives: 3,
  level: 1,
  nextBossLevel: 5,
  boss: null,
  soundEnabled: true,
  musicEnabled: true,
  audioContext: null,
  musicBus: null,
  musicTimer: null,
  musicStep: 0,
  musicNextNoteTime: 0,
  lastTime: 0,
  spawnTimer: 0,
  powerupTimer: 0,
  stars: [],
  bullets: [],
  enemies: [],
  enemyBullets: [],
  powerUps: [],
  particles: [],
  novaBursts: [],
  novaCharges: 0,
  player: {
    x: canvas.width / 2,
    y: canvas.height - 50,
    width: 44,
    height: 28,
    speed: 440,
    fireCooldown: 0,
    shieldTimer: 0,
    rapidTimer: 0,
    weaponTimer: 0,
    weaponLevel: 1,
  },
};
const weaponLevelEl = document.getElementById('weaponLevel');

const keys = {
  left: false,
  right: false,
  shoot: false,
};
let touchPointerId = null;

const melody = [
  79, 0, 76, 79, 81, 0, 84, 81,
  79, 0, 76, 79, 74, 0, 76, 79,
  81, 0, 84, 81, 79, 0, 76, 79,
  74, 76, 79, 0, 76, 74, 72, 0,
];
const bassLine = [48, 45, 41, 43];
const harmonyLine = [67, 64, 60, 62];
const chordLine = [
  [60, 64, 67],
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
];
const musicStepDuration = 60 / 116 / 2;

function midiToFrequency(note) {
  return 440 * (2 ** ((note - 69) / 12));
}

function readBestScore() {
  try {
    return Number(localStorage.getItem('novaRunBestScore')) || 0;
  } catch (error) {
    return 0;
  }
}

function saveBestScore() {
  try {
    localStorage.setItem('novaRunBestScore', String(state.bestScore));
  } catch (error) {
    // Ignore storage failures in restricted browsers.
  }
}

function createStars() {
  state.stars = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: Math.random() * 2.2 + 0.8,
    speed: Math.random() * 28 + 16,
  }));
}

function resetGame() {
  startAudio();
  stopMusic();
  state.started = true;
  state.over = false;
  state.score = 0;
  state.level = 1;
  state.lives = 5;
  state.nextBossLevel = 5;
  state.boss = null;
  state.spawnTimer = 0.7;
  state.powerupTimer = 5.5;
  state.bullets = [];
  state.enemies = [];
  state.enemyBullets = [];
  state.powerUps = [];
  state.particles = [];
  state.novaBursts = [];
  state.novaCharges = 0;
  state.player.x = canvas.width / 2;
  state.player.y = canvas.height - 52;
  state.player.fireCooldown = 0;
  state.player.shieldTimer = 0;
  state.player.rapidTimer = 0;
  state.player.weaponTimer = 0;
  state.player.weaponLevel = 1;

  scoreEl.textContent = '0';
  livesEl.textContent = '5';
  levelEl.textContent = '1';
  updatePowerUpDisplay();
  updateNovaButton();
  startButton.textContent = 'Restart Run';
  startMusic();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function startAudio() {
  if ((!state.soundEnabled && !state.musicEnabled) || !window.AudioContext) {
    return;
  }

  if (!state.audioContext) {
    state.audioContext = new AudioContext();
  }

  if (state.audioContext.state === 'suspended') {
    state.audioContext.resume().catch((error) => {
      console.warn('Audio could not be resumed.', error);
    });
  }
}

function playMusicNote(frequency, startTime, duration, type, volume) {
  const oscillator = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(state.musicBus);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function scheduleMusic() {
  if (!state.audioContext || state.audioContext.state !== 'running') {
    return;
  }

  const scheduleUntil = state.audioContext.currentTime + 0.12;
  while (state.musicNextNoteTime < scheduleUntil) {
    const step = state.musicStep % melody.length;
    const note = melody[step];
    const bar = Math.floor(step / 8) % bassLine.length;

    if (note > 0) {
      playMusicNote(midiToFrequency(note), state.musicNextNoteTime, musicStepDuration * 0.82, 'triangle', 0.04);
      playMusicNote(midiToFrequency(note + 12), state.musicNextNoteTime, musicStepDuration * 0.52, 'sine', 0.009);
    }

    if (step % 4 === 0) {
      playMusicNote(midiToFrequency(bassLine[bar]), state.musicNextNoteTime, musicStepDuration * 1.5, 'triangle', 0.055);
    }

    if (step % 8 === 0) {
      chordLine[bar].forEach((chordNote, index) => {
        playMusicNote(
          midiToFrequency(chordNote),
          state.musicNextNoteTime + index * 0.018,
          musicStepDuration * 5.5,
          'sine',
          0.008,
        );
      });
    }

    if (step % 8 === 6) {
      playMusicNote(midiToFrequency(harmonyLine[bar]), state.musicNextNoteTime, musicStepDuration * 0.7, 'sine', 0.018);
    }

    state.musicNextNoteTime += musicStepDuration;
    state.musicStep += 1;
  }
}

function startMusic() {
  if (!state.musicEnabled || !state.started || !state.audioContext || state.musicTimer !== null) {
    return;
  }

  state.musicBus = state.audioContext.createGain();
  state.musicBus.connect(state.audioContext.destination);
  state.musicNextNoteTime = state.audioContext.currentTime + 0.05;
  scheduleMusic();
  state.musicTimer = window.setInterval(scheduleMusic, 25);
}

function stopMusic() {
  if (state.musicTimer !== null) {
    window.clearInterval(state.musicTimer);
    state.musicTimer = null;
  }

  if (state.musicBus) {
    state.musicBus.disconnect();
    state.musicBus = null;
  }

  state.musicStep = 0;
  state.musicNextNoteTime = 0;
}

function playSound(frequency, duration = 0.08, type = 'square', volume = 0.035) {
  if (!state.soundEnabled || !state.audioContext || state.audioContext.state !== 'running') {
    return;
  }

  const oscillator = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();
  const now = state.audioContext.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain);
  gain.connect(state.audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function addParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 180,
      vy: (Math.random() - 0.5) * 180,
      life: 0.5 + Math.random() * 0.6,
      radius: Math.random() * 3 + 1.5,
      color,
    });
  }
}

function fireBullet() {
  const fireRate = state.player.rapidTimer > 0 ? 0.09 : 0.2;
  const weaponLevel = state.player.weaponLevel;
  const bulletOffsets = weaponLevel === 1
    ? [0]
    : weaponLevel === 2
      ? [-12, 0, 12]
      : [-24, -12, 0, 12, 24];

  bulletOffsets.forEach((offset) => {
    state.bullets.push({
      x: state.player.x + offset,
      y: state.player.y - 22,
      width: weaponLevel === 3 && offset === 0 ? 14 : 10,
      height: 30,
      speed: 620,
      damage: 1,
      color: '#ffd166',
    });
  });
  state.player.fireCooldown = fireRate;
  playSound(720, 0.045, 'square', 0.018);
}

function spawnEnemy() {
  const roll = Math.random();
  let kind = 'drone';
  let width = 26;
  let height = 26;
  let health = 1;
  let speed = 82 + state.level * 10;

  if (roll > 0.9) {
    kind = 'tank';
    width = 42;
    height = 36;
    health = 2;
    speed = 60 + state.level * 8;
  } else if (roll > 0.65) {
    kind = 'zigzag';
    width = 28;
    height = 28;
    speed = 95 + state.level * 12;
  }

  const x = Math.random() * (canvas.width - width);

  state.enemies.push({
    kind,
    x,
    y: -height,
    width,
    height,
    speed,
    health,
    phase: Math.random() * Math.PI * 2,
  });
}

function spawnBoss() {
  const health = 28 + state.level * 3;
  state.boss = {
    x: (canvas.width - 180) / 2,
    y: 58,
    width: 180,
    height: 72,
    health,
    maxHealth: health,
    speed: 78 + state.level * 4,
    direction: 1,
    fireTimer: 1.2,
    attackPattern: 0,
  };
  addParticles(canvas.width / 2, 94, '#ff72bc', 36);
}

function spawnPowerUp() {
  const roll = Math.random();
  let type = 'shield';
  if (roll > 0.78 && state.novaCharges === 0) {
    type = 'nova';
  } else if (roll > 0.56) {
    type = 'rapid';
  } else if (roll > 0.58 && state.player.weaponLevel < 3) {
    type = 'weapon';
  } else if (roll > 0.32 && state.lives < 5) {
    type = 'repair';
  }

  state.powerUps.push({
    type,
    x: 30 + Math.random() * (canvas.width - 60),
    y: -16,
    radius: 12,
    speed: 140,
    spin: Math.random() * Math.PI,
  });
}

function updateStars(delta) {
  state.stars.forEach((star) => {
    star.y += star.speed * delta;
    if (star.y > canvas.height + 6) {
      star.y = -6;
      star.x = Math.random() * canvas.width;
    }
  });
}

function updatePlayer(delta) {
  const move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  state.player.x += move * state.player.speed * delta;
  state.player.x = clamp(state.player.x, state.player.width / 2, canvas.width - state.player.width / 2);

  if (keys.shoot && state.player.fireCooldown <= 0) {
    fireBullet();
  }

  state.player.fireCooldown = Math.max(0, state.player.fireCooldown - delta);
  state.player.shieldTimer = Math.max(0, state.player.shieldTimer - delta);
  state.player.rapidTimer = Math.max(0, state.player.rapidTimer - delta);
  state.player.weaponTimer = Math.max(0, state.player.weaponTimer - delta);
  if (state.player.weaponTimer === 0) {
    state.player.weaponLevel = 1;
  }
}

function updatePowerUpDisplay() {
  const activeEffects = [];

  if (state.player.weaponTimer > 0) {
    activeEffects.push(`WEAPON LV. ${state.player.weaponLevel} · ${Math.ceil(state.player.weaponTimer)}s`);
  } else {
    activeEffects.push(`WEAPON LV. ${state.player.weaponLevel}`);
  }

  if (state.player.shieldTimer > 0) {
    activeEffects.push(`SHIELD · ${Math.ceil(state.player.shieldTimer)}s`);
  }

  if (state.player.rapidTimer > 0) {
    activeEffects.push(`RAPID FIRE · ${Math.ceil(state.player.rapidTimer)}s`);
  }

  weaponLevelEl.textContent = activeEffects.join('\n');
}

function updateBullets(delta) {
  state.bullets.forEach((bullet) => {
    bullet.y -= bullet.speed * delta;
  });

  state.bullets = state.bullets.filter((bullet) => bullet.y + bullet.height > -10);
}

function updateEnemies(delta) {
  state.enemies.forEach((enemy) => {
    enemy.y += enemy.speed * delta;
    if (enemy.kind === 'zigzag') {
      enemy.x += Math.sin((enemy.y + enemy.phase) * 0.06) * 80 * delta;
      enemy.x = clamp(enemy.x, 0, canvas.width - enemy.width);
    }
  });

  state.enemies = state.enemies.filter((enemy) => enemy.y < canvas.height + enemy.height + 22);
}

function updateBoss(delta) {
  const boss = state.boss;
  if (!boss) {
    return;
  }

  boss.x += boss.speed * boss.direction * delta;
  if (boss.x <= 24 || boss.x + boss.width >= canvas.width - 24) {
    boss.direction *= -1;
    boss.x = clamp(boss.x, 24, canvas.width - boss.width - 24);
  }

  boss.fireTimer -= delta;
  if (boss.fireTimer <= 0) {
    const originX = boss.x + boss.width / 2;
    const originY = boss.y + boss.height - 2;

    if (boss.attackPattern % 2 === 0) {
      [-0.48, -0.24, 0, 0.24, 0.48].forEach((spread) => {
        state.enemyBullets.push({
          x: originX,
          y: originY,
          vx: spread * 250,
          vy: 220,
          radius: 7,
        });
      });
    } else {
      const aimAngle = Math.atan2(state.player.y - originY, state.player.x - originX);
      [-0.16, 0, 0.16].forEach((spread) => {
        const angle = aimAngle + spread;
        const speed = 285;
        state.enemyBullets.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 8,
        });
      });
    }

    boss.attackPattern += 1;
    boss.fireTimer = Math.max(0.9, 1.3 - state.level * 0.012);
  }
}

function updateEnemyBullets(delta) {
  state.enemyBullets.forEach((bullet) => {
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;
  });
  state.enemyBullets = state.enemyBullets.filter(
    (bullet) => bullet.y - bullet.radius < canvas.height + 10,
  );
}

function updatePowerUps(delta) {
  state.powerUps.forEach((powerUp) => {
    powerUp.y += powerUp.speed * delta;
    powerUp.spin += delta * 4;
  });

  state.powerUps = state.powerUps.filter((power) => power.y < canvas.height + 24);
}

function updateParticles(delta) {
  state.particles.forEach((particle) => {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.life -= delta;
  });

  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function updateNovaBursts(delta) {
  state.novaBursts.forEach((burst) => {
    burst.elapsed += delta;
  });
  state.novaBursts = state.novaBursts.filter((burst) => burst.elapsed < burst.duration);
}

function updateNovaButton() {
  novaButton.disabled = state.novaCharges === 0 || !state.started;
  novaButton.textContent = state.novaCharges > 0 ? `NOVA · ${state.novaCharges}` : 'NOVA';
  novaButton.setAttribute(
    'aria-label',
    state.novaCharges > 0 ? `Use Nova blast, ${state.novaCharges} charge` : 'Nova blast, no charges',
  );
}

function activateNova() {
  if (!state.started || state.novaCharges === 0) {
    return;
  }

  state.novaCharges -= 1;
  updateNovaButton();
  state.novaBursts.push({
    x: state.player.x,
    y: state.player.y,
    elapsed: 0,
    duration: 1.15,
  });

  state.enemies.forEach((enemy) => {
    addParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#ffb8ff', 14);
    state.score += enemy.kind === 'tank' ? 32 : enemy.kind === 'zigzag' ? 24 : 12;
  });
  state.enemies = [];
  state.enemyBullets = [];
  scoreEl.textContent = String(state.score);

  if (state.boss) {
    state.boss.health -= Math.ceil(state.boss.maxHealth * 0.35);
    if (state.boss.health <= 0) {
      addParticles(state.boss.x + state.boss.width / 2, state.boss.y + state.boss.height / 2, '#ff72bc', 48);
      state.score += 120 + state.level * 20;
      state.boss = null;
      scoreEl.textContent = String(state.score);
    }
  }

  addParticles(state.player.x, state.player.y, '#eab6ff', 72);
  playSound(880, 0.5, 'sawtooth', 0.06);
}

function hitPlayerDamage() {
  if (state.over) {
    return;
  }

  if (state.player.shieldTimer > 0) {
    state.player.shieldTimer = 0;
    addParticles(state.player.x, state.player.y, '#7cf1ff', 24);
    playSound(520, 0.16, 'sawtooth');
    return;
  }

  state.lives -= 1;
  playSound(150, 0.24, 'sawtooth');
  livesEl.textContent = String(state.lives);
  addParticles(state.player.x, state.player.y, '#ff8a8a', 28);

  if (state.lives <= 0) {
    state.over = true;
    state.started = false;
    updateNovaButton();
    stopMusic();
    state.bestScore = Math.max(state.bestScore, state.score);
    saveBestScore();
    bestScoreEl.textContent = String(state.bestScore);
    startButton.textContent = 'Play Again';
  }
}

function checkCollisions() {
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    const playerBox = {
      x: state.player.x - state.player.width / 2,
      y: state.player.y - state.player.height / 2,
      width: state.player.width,
      height: state.player.height,
    };

    const hitPlayer =
      enemy.x < playerBox.x + playerBox.width &&
      enemy.x + enemy.width > playerBox.x &&
      enemy.y < playerBox.y + playerBox.height &&
      enemy.y + enemy.height > playerBox.y;

    if (hitPlayer) {
      addParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#ff7b72', 18);
      state.enemies.splice(i, 1);
      hitPlayerDamage();
      continue;
    }

    if (enemy.y + enemy.height >= canvas.height) {
      addParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#ffa76b', 16);
      state.enemies.splice(i, 1);
      hitPlayerDamage();
      continue;
    }

    for (let j = state.bullets.length - 1; j >= 0; j -= 1) {
      const bullet = state.bullets[j];
      const bulletBox = {
        x: bullet.x - bullet.width / 2,
        y: bullet.y,
        width: bullet.width,
        height: bullet.height,
      };

      const hitBullet =
        enemy.x < bulletBox.x + bulletBox.width &&
        enemy.x + enemy.width > bulletBox.x &&
        enemy.y < bulletBox.y + bulletBox.height &&
        enemy.y + enemy.height > bulletBox.y;

      if (hitBullet) {
        state.bullets.splice(j, 1);
        enemy.health -= bullet.damage;
        addParticles(bullet.x, bullet.y, '#ffd166', 7);

        if (enemy.health <= 0) {
          state.enemies.splice(i, 1);
          state.score += enemy.kind === 'tank' ? 32 : enemy.kind === 'zigzag' ? 24 : 12;
          scoreEl.textContent = String(state.score);
          levelEl.textContent = String(1 + Math.floor(state.score / 120));
          addParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#9bf3ff', 20);
          playSound(300, 0.09, 'triangle', 0.025);
        }
        break;
      }
    }
  }

  const boss = state.boss;
  if (boss) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      const hitBoss =
        bullet.x > boss.x &&
        bullet.x < boss.x + boss.width &&
        bullet.y < boss.y + boss.height &&
        bullet.y + bullet.height > boss.y;

      if (!hitBoss) {
        continue;
      }

      state.bullets.splice(i, 1);
      boss.health -= bullet.damage;
      addParticles(bullet.x, bullet.y, '#ffd166', 5);

      if (boss.health <= 0) {
        addParticles(boss.x + boss.width / 2, boss.y + boss.height / 2, '#ff72bc', 48);
        state.score += 120 + state.level * 20;
        scoreEl.textContent = String(state.score);
        state.boss = null;
        playSound(220, 0.45, 'sawtooth', 0.05);
        break;
      }
    }
  }

  for (let i = state.powerUps.length - 1; i >= 0; i -= 1) {
    const powerUp = state.powerUps[i];
    const distanceX = Math.abs(powerUp.x - state.player.x);
    const distanceY = Math.abs(powerUp.y - state.player.y);
    const hitPower = distanceX < 22 && distanceY < 22;

    if (hitPower) {
      if (powerUp.type === 'shield') {
        state.player.shieldTimer = 7;
      } else if (powerUp.type === 'rapid') {
        state.player.rapidTimer = 6;
      } else if (powerUp.type === 'weapon') {
        state.player.weaponLevel = Math.min(3, state.player.weaponLevel + 1);
        state.player.weaponTimer = 12;
        addParticles(powerUp.x, powerUp.y, '#c6a1ff', 24);
      } else if (powerUp.type === 'nova') {
        state.novaCharges = Math.min(1, state.novaCharges + 1);
        addParticles(powerUp.x, powerUp.y, '#f2a6ff', 32);
        updateNovaButton();
      } else if (powerUp.type === 'repair') {
        state.lives = Math.min(5, state.lives + 1);
        livesEl.textContent = String(state.lives);
      }

      if (powerUp.type !== 'weapon' && powerUp.type !== 'nova') {
        addParticles(powerUp.x, powerUp.y, '#7bffb3', 18);
      }
      playSound(powerUp.type === 'weapon' ? 1040 : 880, 0.12, 'triangle');
      state.powerUps.splice(i, 1);
    }
  }

  updatePowerUpDisplay();

  for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.enemyBullets[i];
    const hitPlayer =
      Math.abs(bullet.x - state.player.x) < state.player.width / 2 + bullet.radius &&
      Math.abs(bullet.y - state.player.y) < state.player.height / 2 + bullet.radius;

    if (hitPlayer) {
      state.enemyBullets.splice(i, 1);
      hitPlayerDamage();
    }
  }
}

function update(delta) {
  if (!state.started || state.over) {
    return;
  }

  state.level = 1 + Math.floor(state.score / 120);
  levelEl.textContent = String(state.level);

  updateStars(delta);
  updatePlayer(delta);
  updateBullets(delta);
  updateEnemies(delta);
  updateBoss(delta);
  updateEnemyBullets(delta);
  updatePowerUps(delta);
  updateParticles(delta);
  updateNovaBursts(delta);
  checkCollisions();

  state.spawnTimer -= delta;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnTimer = Math.max(0.85, 1.65 - state.level * 0.045);
  }

  if (!state.boss && state.level >= state.nextBossLevel) {
    spawnBoss();
    state.nextBossLevel += 5;
  }

  state.powerupTimer -= delta;
  if (state.powerupTimer <= 0) {
    spawnPowerUp();
    state.powerupTimer = 6.5 + Math.random() * 2.5;
  }

  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    bestScoreEl.textContent = String(state.bestScore);
    saveBestScore();
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#080d22');
  sky.addColorStop(0.48, '#101632');
  sky.addColorStop(1, '#101d38');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const nebula = ctx.createRadialGradient(
    canvas.width * 0.72,
    canvas.height * 0.42,
    12,
    canvas.width * 0.72,
    canvas.height * 0.42,
    canvas.width * 0.62,
  );
  nebula.addColorStop(0, 'rgba(95, 88, 186, 0.2)');
  nebula.addColorStop(0.55, 'rgba(49, 96, 153, 0.08)');
  nebula.addColorStop(1, 'rgba(8, 13, 34, 0)');
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  state.stars.forEach((star) => {
    ctx.fillStyle = star.radius > 2 ? 'rgba(176, 230, 255, 0.95)' : 'rgba(230, 239, 255, 0.72)';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.save();
  ctx.strokeStyle = 'rgba(112, 183, 255, 0.075)';
  ctx.lineWidth = 1;
  const horizon = canvas.height * 0.58;
  for (let i = 0; i < 9; i += 1) {
    const y = horizon + i * i * 2.7;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  for (let i = -6; i <= 6; i += 1) {
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 + i * 12, horizon);
    ctx.lineTo(canvas.width / 2 + i * 94, canvas.height);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer() {
  const pixelSize = 4;
  const spriteWidth = playerSprite[0].length * pixelSize;
  const spriteHeight = playerSprite.length * pixelSize;
  const left = Math.round(state.player.x - spriteWidth / 2);
  const top = Math.round(state.player.y - spriteHeight / 2);
  const colors = {
    C: '#80f0ff',
    B: '#74a9ff',
  };

  ctx.save();
  ctx.shadowColor = '#54ddff';
  ctx.shadowBlur = 18;

  if (state.player.shieldTimer > 0) {
    const pulse = Math.sin(state.player.shieldTimer * 8) * 2;
    ctx.strokeStyle = 'rgba(124, 241, 255, 0.82)';
    ctx.fillStyle = 'rgba(80, 207, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(state.player.x, state.player.y, spriteWidth * 0.78 + pulse, spriteHeight * 0.9 + pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = '#ffb56b';
  ctx.beginPath();
  ctx.moveTo(state.player.x - 5, top + spriteHeight - 1);
  ctx.lineTo(state.player.x, top + spriteHeight + 10 + Math.sin(performance.now() / 70) * 2);
  ctx.lineTo(state.player.x + 5, top + spriteHeight - 1);
  ctx.closePath();
  ctx.fill();

  playerSprite.forEach((row, rowIndex) => {
    Array.from(row).forEach((pixel, columnIndex) => {
      if (pixel !== '.') {
        ctx.fillStyle = colors[pixel];
        ctx.fillRect(
          left + columnIndex * pixelSize,
          top + rowIndex * pixelSize,
          pixelSize,
          pixelSize,
        );
      }
    });
  });

  if (state.player.weaponLevel >= 2) {
    ctx.fillStyle = '#b7a0ff';
    ctx.fillRect(left - 4, top + 14, 7, 12);
    ctx.fillRect(left + spriteWidth - 3, top + 14, 7, 12);
    ctx.fillStyle = '#f2d9ff';
    ctx.fillRect(left - 2, top + 12, 3, 4);
    ctx.fillRect(left + spriteWidth - 1, top + 12, 3, 4);
  }

  if (state.player.weaponLevel >= 3) {
    ctx.fillStyle = '#ff9ce6';
    ctx.fillRect(left - 10, top + 21, 6, 9);
    ctx.fillRect(left + spriteWidth + 4, top + 21, 6, 9);
  }
  ctx.restore();
}

function drawBullets() {
  state.bullets.forEach((bullet) => {
    const glow = ctx.createLinearGradient(bullet.x, bullet.y, bullet.x, bullet.y + bullet.height);
    glow.addColorStop(0, '#fff3b0');
    glow.addColorStop(1, '#ff9e59');
    ctx.fillStyle = glow;
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 10;
    ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height);
  });
  ctx.shadowBlur = 0;
}

function drawEnemyBullets() {
  state.enemyBullets.forEach((bullet) => {
    ctx.fillStyle = '#ff72bc';
    ctx.shadowColor = '#ff4fa5';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;
}

function drawEnemies() {
  state.enemies.forEach((enemy) => {
    const cx = enemy.x + enemy.width / 2;
    const cy = enemy.y + enemy.height / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowBlur = 14;

    if (enemy.kind === 'tank') {
      ctx.fillStyle = '#ffad66';
      ctx.shadowColor = '#ff8b4d';
      ctx.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
      ctx.fillStyle = '#ffe3bf';
      ctx.fillRect(-enemy.width / 2 + 8, -enemy.height / 2 + 8, enemy.width - 16, 8);
    } else if (enemy.kind === 'zigzag') {
      ctx.fillStyle = '#ff5ca8';
      ctx.shadowColor = '#ff3c96';
      ctx.beginPath();
      ctx.moveTo(0, -enemy.height / 2);
      ctx.lineTo(enemy.width / 2, 0);
      ctx.lineTo(0, enemy.height / 2);
      ctx.lineTo(-enemy.width / 2, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#ff7b72';
      ctx.shadowColor = '#ff5b73';
      ctx.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
      ctx.fillStyle = '#ffd5d2';
      ctx.fillRect(-enemy.width / 2 + 5, -enemy.height / 2 + 6, enemy.width - 10, 7);
    }

    ctx.restore();
  });
}

function drawBoss() {
  const boss = state.boss;
  if (!boss) {
    return;
  }

  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.fillStyle = '#bd4d9b';
  ctx.shadowColor = '#ff55be';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(boss.width - 20, 0);
  ctx.lineTo(boss.width, boss.height * 0.65);
  ctx.lineTo(boss.width * 0.72, boss.height);
  ctx.lineTo(boss.width * 0.5, boss.height * 0.78);
  ctx.lineTo(boss.width * 0.28, boss.height);
  ctx.lineTo(0, boss.height * 0.65);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffe0f4';
  ctx.fillRect(boss.width * 0.25, boss.height * 0.34, boss.width * 0.5, 9);
  ctx.fillStyle = '#ff72bc';
  ctx.fillRect(boss.width * 0.43, boss.height * 0.27, boss.width * 0.14, 22);
  ctx.restore();

  const barWidth = 300;
  const barX = (canvas.width - barWidth) / 2;
  ctx.fillStyle = 'rgba(5, 10, 18, 0.8)';
  ctx.fillRect(barX - 2, 18, barWidth + 4, 24);
  ctx.fillStyle = '#382238';
  ctx.fillRect(barX, 20, barWidth, 20);
  ctx.save();
  ctx.shadowColor = '#ff72bc';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ff72bc';
  ctx.fillRect(barX, 20, barWidth * (boss.health / boss.maxHealth), 20);
  ctx.restore();
  ctx.fillStyle = '#fff2fa';
  ctx.textAlign = 'center';
  ctx.font = '700 13px Segoe UI';
  ctx.fillText('BOSS', canvas.width / 2, 35);
}

function drawPowerUps() {
  state.powerUps.forEach((powerUp) => {
    ctx.save();
    ctx.translate(powerUp.x, powerUp.y);
    ctx.rotate(powerUp.spin);

    if (powerUp.type === 'shield') {
      ctx.fillStyle = '#6fe7ff';
      ctx.beginPath();
      ctx.arc(0, 0, powerUp.radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (powerUp.type === 'rapid') {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-powerUp.radius, -4, powerUp.radius * 2, 8);
      ctx.fillRect(-4, -powerUp.radius, 8, powerUp.radius * 2);
    } else if (powerUp.type === 'weapon') {
      ctx.fillStyle = '#ad8aff';
      ctx.shadowColor = '#a77cff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, -powerUp.radius);
      ctx.lineTo(powerUp.radius, 0);
      ctx.lineTo(0, powerUp.radius);
      ctx.lineTo(-powerUp.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = '700 12px Segoe UI';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('W', 0, 1);
    } else if (powerUp.type === 'nova') {
      const pulse = 1 + Math.sin(performance.now() / 100) * 0.12;
      ctx.shadowColor = '#ff70e8';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#ff75dc';
      ctx.beginPath();
      ctx.arc(0, 0, powerUp.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = '900 13px Segoe UI';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', 0, 1);
    } else {
      ctx.fillStyle = '#7bffb3';
      ctx.beginPath();
      ctx.moveTo(0, -powerUp.radius);
      ctx.lineTo(powerUp.radius * 0.8, 0);
      ctx.lineTo(0, powerUp.radius);
      ctx.lineTo(-powerUp.radius * 0.8, 0);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  });
}

function drawNovaBursts() {
  state.novaBursts.forEach((burst) => {
    const progress = burst.elapsed / burst.duration;
    const maxRadius = Math.hypot(canvas.width, canvas.height);
    const radius = maxRadius * progress;
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    [1, 0.72, 0.42].forEach((scale, index) => {
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, radius * scale, 0, Math.PI * 2);
      ctx.strokeStyle = index === 0
        ? `rgba(255, 229, 255, ${alpha})`
        : `rgba(255, 105, 226, ${alpha * (0.85 - index * 0.18)})`;
      ctx.lineWidth = index === 0 ? 8 * alpha + 1 : 4 * alpha + 1;
      ctx.shadowColor = '#ff8af2';
      ctx.shadowBlur = 28 * alpha;
      ctx.stroke();
    });

    const flashAlpha = Math.max(0, 0.42 * (1 - progress * 5));
    ctx.fillStyle = `rgba(255, 220, 255, ${flashAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  });
}

function drawParticles() {
  state.particles.forEach((particle) => {
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawOverlay() {
  if (!state.started && !state.over) {
    ctx.fillStyle = 'rgba(5, 10, 18, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ebf6ff';
    ctx.font = '800 54px Segoe UI';
    ctx.fillText('NOVA RUN', canvas.width / 2, canvas.height / 2 - 30);
    ctx.font = '500 24px Segoe UI';
    ctx.fillText('Survive the asteroid wave', canvas.width / 2, canvas.height / 2 + 16);
    ctx.fillText('Move: A / D or ← / →  •  Shoot: Space', canvas.width / 2, canvas.height / 2 + 56);
    ctx.font = '600 16px Segoe UI';
    ctx.fillText(`BEST SCORE  ${state.bestScore}`, canvas.width / 2, canvas.height / 2 + 92);
  }

  if (state.over) {
    ctx.fillStyle = 'rgba(5, 10, 18, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5f8ff';
    ctx.font = '800 52px Segoe UI';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '600 24px Segoe UI';
    ctx.fillText(`Final Score: ${state.score}`, canvas.width / 2, canvas.height / 2 + 22);
    ctx.fillText(`Best Score: ${state.bestScore}`, canvas.width / 2, canvas.height / 2 + 58);
  }
}

function render() {
  drawBackground();
  drawPowerUps();
  drawBullets();
  drawEnemyBullets();
  drawEnemies();
  drawBoss();
  drawNovaBursts();
  drawPlayer();
  drawParticles();
  drawOverlay();
}

function gameLoop(timestamp) {
  const delta = Math.min((timestamp - state.lastTime) / 1000 || 0.016, 0.033);
  state.lastTime = timestamp;

  update(delta);
  render();
  requestAnimationFrame(gameLoop);
}

function handleKeyState(event, isPressed) {
  const code = event.code;

  if (code === 'ArrowLeft' || code === 'KeyA') {
    keys.left = isPressed;
  }

  if (code === 'ArrowRight' || code === 'KeyD') {
    keys.right = isPressed;
  }

  if (code === 'Space') {
    event.preventDefault();
    keys.shoot = isPressed;
  }
}

function setControl(control, isPressed) {
  if (control === 'left' || control === 'right' || control === 'shoot') {
    keys[control] = isPressed;
  }
}

function movePlayerToPointer(event) {
  const bounds = canvas.getBoundingClientRect();
  const scale = canvas.width / bounds.width;
  state.player.x = clamp(
    (event.clientX - bounds.left) * scale,
    state.player.width / 2,
    canvas.width - state.player.width / 2,
  );
}

state.bestScore = readBestScore();
bestScoreEl.textContent = String(state.bestScore);
createStars();

document.addEventListener('keydown', (event) => handleKeyState(event, true));
document.addEventListener('keyup', (event) => handleKeyState(event, false));
document.addEventListener('keydown', (event) => {
  if (event.code === 'KeyX' && !event.repeat) {
    activateNova();
  }
});
startButton.addEventListener('click', () => {
  resetGame();
});
novaButton.addEventListener('click', activateNova);

soundButton.addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  soundButton.textContent = `Sound: ${state.soundEnabled ? 'On' : 'Off'}`;
  soundButton.setAttribute('aria-pressed', String(state.soundEnabled));
  if (state.soundEnabled) {
    startAudio();
    playSound(660, 0.08, 'triangle');
  }
});

musicButton.addEventListener('click', () => {
  state.musicEnabled = !state.musicEnabled;
  musicButton.textContent = `Music: ${state.musicEnabled ? 'On' : 'Off'}`;
  musicButton.setAttribute('aria-pressed', String(state.musicEnabled));

  if (state.musicEnabled) {
    startAudio();
    startMusic();
  } else {
    stopMusic();
  }
});

canvasControls.forEach((button) => {
  const control = button.dataset.control;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setControl(control, true);
    if (control === 'shoot' && state.started && state.player.fireCooldown <= 0) {
      fireBullet();
    }
  });
  const release = () => setControl(control, false);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});

canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch' || !state.started || touchPointerId !== null) {
    return;
  }

  event.preventDefault();
  touchPointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  movePlayerToPointer(event);
  keys.shoot = true;
  if (state.player.fireCooldown <= 0) {
    fireBullet();
  }
});

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerId === touchPointerId && state.started) {
    event.preventDefault();
    movePlayerToPointer(event);
  }
});

function releaseCanvasTouch(event) {
  if (event.pointerId === touchPointerId) {
    touchPointerId = null;
    keys.shoot = false;
  }
}

canvas.addEventListener('pointerup', releaseCanvasTouch);
canvas.addEventListener('pointercancel', releaseCanvasTouch);
canvas.addEventListener('lostpointercapture', releaseCanvasTouch);

window.addEventListener('blur', () => {
  keys.left = false;
  keys.right = false;
  keys.shoot = false;
  touchPointerId = null;
});

requestAnimationFrame(gameLoop);
