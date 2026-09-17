/**
 * Ring Escape Idle - Complete Game Engine
 * Pure Vanilla JS HTML5 Canvas Implementation
 */

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-container');

// HUD Elements
const coinsDisplay = document.getElementById('coins-display');
const cpsDisplay = document.getElementById('cps-display');
const stageDisplay = document.getElementById('stage-display');
const ringDisplay = document.getElementById('ring-display');
const btnAudio = document.getElementById('btn-audio');
const btnReset = document.getElementById('btn-reset');
const stageClearOverlay = document.getElementById('stage-clear-overlay');
const clearRewardDisplay = document.getElementById('clear-reward');

// Upgrade Buttons & Labels
const btnUpgradeDamage = document.getElementById('btn-upgrade-damage');
const lvlDamage = document.getElementById('lvl-damage');
const statDamage = document.getElementById('stat-damage');
const costDamage = document.getElementById('cost-damage');

const btnUpgradeIncome = document.getElementById('btn-upgrade-income');
const lvlIncome = document.getElementById('lvl-income');
const statIncome = document.getElementById('stat-income');
const costIncome = document.getElementById('cost-income');

const btnUpgradeSpeed = document.getElementById('btn-upgrade-speed');
const lvlSpeed = document.getElementById('lvl-speed');
const statSpeed = document.getElementById('stat-speed');
const costSpeed = document.getElementById('cost-speed');

const btnUpgradeBall = document.getElementById('btn-upgrade-ball');
const lvlBall = document.getElementById('lvl-ball');
const statBall = document.getElementById('stat-ball');
const costBall = document.getElementById('cost-ball');

let width = 0;
let height = 0;
let centerX = 0;
let centerY = 0;
let baseRadius = 0;

function resizeCanvas() {
    const rect = canvasContainer.getBoundingClientRect();
    width = rect.width;
    height = rect.height;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    centerX = width / 2;
    centerY = height / 2;
    baseRadius = Math.min(width, height) * 0.42;
}

window.addEventListener('resize', resizeCanvas);

// Global Game State
const state = {
    coins: 0,
    coinsEarnedThisSec: 0,
    cps: 0,
    stage: 1,
    activeRingIndex: 0,
    audioEnabled: true,
    upgrades: {
        damage: { level: 1, baseCost: 10, costMult: 1.15, inc: 1 },
        income: { level: 1, baseCost: 15, costMult: 1.15, inc: 0.25 },
        speed: { level: 1, baseCost: 25, costMult: 1.15, inc: 0.15 },
        balls: { level: 1, maxLevel: 5, baseCost: 100, costMult: 2.5, inc: 1 }
    }
};

// Physics Constants
const GRAVITY = 180;
const BASE_SPEED = 280;
const MIN_BALL_SPEED = 180;

// Web Audio API Synthesizer
class SoundFX {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playBounce(freq = 440) {
        if (!state.audioEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.5, this.ctx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.08);
        } catch (e) {}
    }

    playBreak() {
        if (!state.audioEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.15);

            gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.2);
        } catch (e) {}
    }

    playStageClear() {
        if (!state.audioEnabled) return;
        this.init();
        if (!this.ctx) return;

        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);

                gain.gain.setValueAtTime(0.2, this.ctx.currentTime + idx * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.08 + 0.25);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(this.ctx.currentTime + idx * 0.08);
                osc.stop(this.ctx.currentTime + idx * 0.08 + 0.25);
            } catch (e) {}
        });
    }

    playUpgrade() {
        if (!state.audioEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1);

            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.1);
        } catch (e) {}
    }
}

const sfx = new SoundFX();

// Color Palettes for Infinite Stages
const PALETTES = [
    { primary: '#00f0ff', secondary: '#00ff88' }, // Cyan & Green
    { primary: '#b026ff', secondary: '#ff2a6d' }, // Purple & Pink
    { primary: '#ffea00', secondary: '#ff7700' }, // Yellow & Orange
    { primary: '#ff2a6d', secondary: '#00f0ff' }, // Neon Red & Cyan
    { primary: '#00ff88', secondary: '#ffea00' }, // Neon Green & Yellow
    { primary: '#7928ca', secondary: '#ff0080' }  // Ultra Violet
];

// Ring Class
class Ring {
    constructor(radius, maxHp, color, rotationSpeed) {
        this.radius = radius;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.color = color;
        this.rotationSpeed = rotationSpeed;
        this.angle = Math.random() * Math.PI * 2;
        this.flashTimer = 0;
    }

    update(dt) {
        this.angle += this.rotationSpeed * dt;
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
        }
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        this.flashTimer = 0.08;
        return this.hp === 0;
    }

    draw(ctx, isCurrentTarget) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(this.angle);

        const hpRatio = this.hp / this.maxHp;
        const lineThickness = isCurrentTarget ? 6 : 4;

        if (isCurrentTarget) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.flashTimer > 0 ? 25 : 12;
        } else {
            ctx.shadowBlur = 0;
        }

        // Draw background base ring
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.lineWidth = lineThickness;
        ctx.strokeStyle = this.flashTimer > 0 ? '#ffffff' : `${this.color}33`;
        ctx.stroke();

        // Draw health arc
        if (hpRatio > 0) {
            const arcLength = Math.PI * 2 * hpRatio;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, -Math.PI / 2, -Math.PI / 2 + arcLength);
            ctx.lineWidth = lineThickness;
            ctx.strokeStyle = this.flashTimer > 0 ? '#ffffff' : this.color;
            ctx.stroke();
        }

        ctx.restore();
    }
}

// Particle Class for Ring Shatter
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = Math.random() * 3 + 1.5;
        const speed = Math.random() * 220 + 50;
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 1.5 + 0.8;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= this.decay * dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// Floating Combat Text Popups
class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.vy = -50;
        this.life = 0.8;
    }

    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.font = "bold 14px 'Orbitron', sans-serif";
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life / 0.8);
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// Ball Class
class Ball {
    constructor(x, y, radius = 7) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = (Math.random() - 0.5) * 200;
        this.vy = (Math.random() - 0.5) * 200 - 100;
        this.trail = [];
        this.maxTrailLength = 12;
        this.color = '#00f0ff';
    }

    update(dt) {
        this.vy += GRAVITY * dt;

        const speedMultiplier = 1 + (state.upgrades.speed.level - 1) * state.upgrades.speed.inc;
        const targetSpeed = BASE_SPEED * speedMultiplier;

        let speed = Math.hypot(this.vx, this.vy);
        if (speed < MIN_BALL_SPEED) {
            if (speed === 0) {
                this.vx = (Math.random() - 0.5) * MIN_BALL_SPEED;
                this.vy = MIN_BALL_SPEED;
                speed = MIN_BALL_SPEED;
            }
            const factor = MIN_BALL_SPEED / speed;
            this.vx *= factor;
            this.vy *= factor;
            speed = MIN_BALL_SPEED;
        }

        const lerpFactor = 0.05;
        const speedAdjust = targetSpeed / speed;
        this.vx = this.vx * (1 - lerpFactor) + (this.vx * speedAdjust) * lerpFactor;
        this.vy = this.vy * (1 - lerpFactor) + (this.vy * speedAdjust) * lerpFactor;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.trail.unshift({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrailLength) {
            this.trail.pop();
        }
    }

    applyImpulse(targetX, targetY, force = 350) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
            this.vx += (dx / dist) * force;
            this.vy += (dy / dist) * force;
        }
    }

    draw(ctx) {
        for (let i = 0; i < this.trail.length; i++) {
            const point = this.trail[i];
            const ratio = 1 - (i / this.trail.length);
            const r = this.radius * ratio;
            ctx.beginPath();
            ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 240, 255, ${ratio * 0.4})`;
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// Game Collections
let rings = [];
let balls = [];
let particles = [];
let floatingTexts = [];

resizeCanvas();

// Upgrade Cost Formulas
function getUpgradeCost(upgradeKey) {
    const up = state.upgrades[upgradeKey];
    return Math.round(up.baseCost * Math.pow(up.costMult, up.level - 1));
}

// Helper: Collision detection between ball and active concentric ring
function handleRingCollisions(ball) {
    if (state.activeRingIndex >= rings.length) return;

    const ring = rings[state.activeRingIndex];
    const dx = ball.x - centerX;
    const dy = ball.y - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist + ball.radius >= ring.radius) {
        const nx = dx / dist;
        const ny = dy / dist;

        ball.x = centerX + nx * (ring.radius - ball.radius);
        ball.y = centerY + ny * (ring.radius - ball.radius);

        const dot = ball.vx * nx + ball.vy * ny;
        if (dot > 0) {
            ball.vx = ball.vx - 2 * dot * nx;
            ball.vy = ball.vy - 2 * dot * ny;
        }

        const currentDamage = state.upgrades.damage.level * state.upgrades.damage.inc;
        const incomeMult = 1 + (state.upgrades.income.level - 1) * state.upgrades.income.inc;
        const coinsEarned = Math.round(currentDamage * incomeMult);

        state.coins += coinsEarned;
        state.coinsEarnedThisSec += coinsEarned;

        floatingTexts.push(new FloatingText(ball.x, ball.y, `+$${coinsEarned}`, '#ffea00'));
        sfx.playBounce(300 + state.activeRingIndex * 100);

        const destroyed = ring.takeDamage(currentDamage);

        if (destroyed) {
            sfx.playBreak();
            spawnShatterParticles(ring);

            const ringBonus = Math.round(ring.maxHp * incomeMult * 1.5);
            state.coins += ringBonus;
            state.coinsEarnedThisSec += ringBonus;
            floatingTexts.push(new FloatingText(centerX, centerY - ring.radius, `+${ringBonus} BONUS!`, '#00ff88'));

            state.activeRingIndex++;
            updateHUD();

            if (state.activeRingIndex >= rings.length) {
                onStageCleared();
            }
        }

        saveGame();
        updateUpgradePanel();
    }
}

function spawnShatterParticles(ring) {
    const numParticles = 36;
    for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2;
        const px = centerX + Math.cos(angle) * ring.radius;
        const py = centerY + Math.sin(angle) * ring.radius;
        particles.push(new Particle(px, py, ring.color));
    }
}

function onStageCleared() {
    sfx.playStageClear();

    const stageBonus = Math.round(100 * Math.pow(1.3, state.stage - 1));
    state.coins += stageBonus;
    state.coinsEarnedThisSec += stageBonus;

    clearRewardDisplay.textContent = `+$${stageBonus} Bônus de Fase!`;
    stageClearOverlay.classList.remove('hidden');

    setTimeout(() => {
        stageClearOverlay.classList.add('hidden');
        state.stage++;
        setupStage(state.stage);
        saveGame();
    }, 1200);
}

function setupStage(stageNum) {
    rings = [];
    state.activeRingIndex = 0;

    const numRings = Math.min(3 + Math.floor((stageNum - 1) / 2), 8);
    const palette = PALETTES[(stageNum - 1) % PALETTES.length];

    const baseHp = 10;
    const stageHp = Math.round(baseHp * Math.pow(1.28, stageNum - 1));

    const minRadius = 40;
    const step = (baseRadius - minRadius) / numRings;

    for (let i = 0; i < numRings; i++) {
        const radius = minRadius + (i + 1) * step;
        const ringHp = Math.round(stageHp * (1 + i * 0.4));
        const rotSpeed = (i % 2 === 0 ? 1 : -1) * (0.3 + Math.random() * 0.5);
        rings.push(new Ring(radius, ringHp, palette.primary, rotSpeed));
    }

    // Synchronize balls count with balls upgrade level
    const targetBallCount = state.upgrades.balls.level;
    while (balls.length < targetBallCount) {
        balls.push(new Ball(centerX, centerY - 15));
    }
    while (balls.length > targetBallCount) {
        balls.pop();
    }

    balls.forEach(ball => {
        ball.x = centerX;
        ball.y = centerY - 15;
        ball.vx = (Math.random() - 0.5) * 150;
        ball.vy = -100;
    });

    updateHUD();
    updateUpgradePanel();
}

function updateHUD() {
    coinsDisplay.textContent = `$${Math.floor(state.coins)}`;
    cpsDisplay.textContent = `+$${state.cps}/s`;
    stageDisplay.textContent = `Fase ${state.stage}`;

    if (rings.length > 0) {
        ringDisplay.textContent = `Anel ${Math.min(state.activeRingIndex + 1, rings.length)}/${rings.length}`;
    } else {
        ringDisplay.textContent = `Anel 0/0`;
    }
}

function updateUpgradePanel() {
    // Damage Upgrade
    const costDmg = getUpgradeCost('damage');
    const dmgVal = state.upgrades.damage.level * state.upgrades.damage.inc;
    lvlDamage.textContent = `Lvl ${state.upgrades.damage.level}`;
    statDamage.textContent = `Dano: ${dmgVal}`;
    costDamage.textContent = `$${costDmg}`;
    btnUpgradeDamage.disabled = state.coins < costDmg;

    // Income Upgrade
    const costInc = getUpgradeCost('income');
    const incVal = (1 + (state.upgrades.income.level - 1) * state.upgrades.income.inc).toFixed(2);
    lvlIncome.textContent = `Lvl ${state.upgrades.income.level}`;
    statIncome.textContent = `Mult: x${incVal}`;
    costIncome.textContent = `$${costInc}`;
    btnUpgradeIncome.disabled = state.coins < costInc;

    // Speed Upgrade
    const costSpd = getUpgradeCost('speed');
    const spdVal = Math.round((1 + (state.upgrades.speed.level - 1) * state.upgrades.speed.inc) * 100);
    lvlSpeed.textContent = `Lvl ${state.upgrades.speed.level}`;
    statSpeed.textContent = `Vel: ${spdVal}%`;
    costSpeed.textContent = `$${costSpd}`;
    btnUpgradeSpeed.disabled = state.coins < costSpd;

    // Ball Upgrade
    const ballUp = state.upgrades.balls;
    if (ballUp.level >= ballUp.maxLevel) {
        lvlBall.textContent = `${ballUp.maxLevel} / ${ballUp.maxLevel}`;
        statBall.textContent = `Máximo atingido`;
        costBall.textContent = `MAX`;
        btnUpgradeBall.disabled = true;
    } else {
        const costBll = getUpgradeCost('balls');
        lvlBall.textContent = `${ballUp.level} / ${ballUp.maxLevel}`;
        statBall.textContent = `+1 Bola na arena`;
        costBall.textContent = `$${costBll}`;
        btnUpgradeBall.disabled = state.coins < costBll;
    }
}

// Purchase Upgrade Function
function buyUpgrade(key) {
    const up = state.upgrades[key];
    if (up.maxLevel && up.level >= up.maxLevel) return;

    const cost = getUpgradeCost(key);
    if (state.coins >= cost) {
        state.coins -= cost;
        up.level++;
        sfx.playUpgrade();

        if (key === 'balls') {
            balls.push(new Ball(centerX, centerY - 15));
        }

        saveGame();
        updateHUD();
        updateUpgradePanel();
    }
}

// Attach Upgrade Button Events
btnUpgradeDamage.addEventListener('click', () => buyUpgrade('damage'));
btnUpgradeIncome.addEventListener('click', () => buyUpgrade('income'));
btnUpgradeSpeed.addEventListener('click', () => buyUpgrade('speed'));
btnUpgradeBall.addEventListener('click', () => buyUpgrade('balls'));

// Control buttons
btnAudio.addEventListener('click', () => {
    state.audioEnabled = !state.audioEnabled;
    btnAudio.textContent = state.audioEnabled ? '🔊' : '🔇';
    saveGame();
});

btnReset.addEventListener('click', () => {
    if (confirm('Deseja realmente reiniciar todo o seu progresso?')) {
        localStorage.removeItem('ring_escape_idle_save');
        location.reload();
    }
});

// LocalStorage Persistence
function saveGame() {
    const saveData = {
        coins: state.coins,
        stage: state.stage,
        audioEnabled: state.audioEnabled,
        upgrades: {
            damage: state.upgrades.damage.level,
            income: state.upgrades.income.level,
            speed: state.upgrades.speed.level,
            balls: state.upgrades.balls.level
        }
    };
    try {
        localStorage.setItem('ring_escape_idle_save', JSON.stringify(saveData));
    } catch (e) {}
}

function loadGame() {
    try {
        const raw = localStorage.getItem('ring_escape_idle_save');
        if (raw) {
            const data = JSON.parse(raw);
            if (typeof data.coins === 'number') state.coins = data.coins;
            if (typeof data.stage === 'number') state.stage = data.stage;
            if (typeof data.audioEnabled === 'boolean') {
                state.audioEnabled = data.audioEnabled;
                btnAudio.textContent = state.audioEnabled ? '🔊' : '🔇';
            }
            if (data.upgrades) {
                if (data.upgrades.damage) state.upgrades.damage.level = data.upgrades.damage;
                if (data.upgrades.income) state.upgrades.income.level = data.upgrades.income;
                if (data.upgrades.speed) state.upgrades.speed.level = data.upgrades.speed;
                if (data.upgrades.balls) state.upgrades.balls.level = data.upgrades.balls;
            }
        }
    } catch (e) {}
}

// Tap / Click handling
function handlePointerDown(e) {
    sfx.init();
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    balls.forEach(ball => {
        ball.applyImpulse(clickX, clickY);
    });
}

canvas.addEventListener('mousedown', handlePointerDown);
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
        handlePointerDown(e.touches[0]);
    }
}, { passive: true });

// CPS Timer
setInterval(() => {
    state.cps = state.coinsEarnedThisSec;
    state.coinsEarnedThisSec = 0;
    updateHUD();
}, 1000);

// Initialize Game State & Stage
loadGame();
setupStage(state.stage);

// Main Game Loop
let lastTime = performance.now();

function gameLoop(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    ctx.clearRect(0, 0, width, height);

    rings.forEach((ring, idx) => {
        ring.update(dt);
        if (idx >= state.activeRingIndex) {
            ring.draw(ctx, idx === state.activeRingIndex);
        }
    });

    balls.forEach(ball => {
        ball.update(dt);
        handleRingCollisions(ball);
        ball.draw(ctx);
    });

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update(dt);
        p.draw(ctx);
        if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.update(dt);
        ft.draw(ctx);
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    }

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
