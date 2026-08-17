// Gesture-Controlled Fruit Ninja (Fixed Sliced Fruit Removal Bug)
import { initHandTracking, detectHands, drawBladeTrails, handTrails } from "./handTracking.js";
import { EffectsManager } from "./effects.js";

export const SWIPE_SPEED_THRESHOLD = 2.0; 
const GESTURE_HITBOX_PADDING = 25;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const video = document.getElementById("webcam");

const gameOverScreen = document.getElementById("gameOverScreen");
const finalScoreElement = document.getElementById("finalScore");
const restartBtn = document.getElementById("restartBtn");

let statusText = "Requesting webcam & loading hand tracking model...";
let isTrackingInitialized = false;

const effects = new EffectsManager();

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Initialize Hand Tracking
initHandTracking(video)
  .then(() => {
    isTrackingInitialized = true;
    statusText = "";
  })
  .catch((err) => {
    console.error("[Game] Hand tracking init error:", err);
    statusText = `Error: ${err.message || "Could not initialize hand tracking"}`;
  });

// --- GAME STATE MACHINE ---
let gameState = "WAITING_FOR_HAND";
let score = 0;
let lives = 3;
let lastLifeLostTime = 0;

let countdownValue = 3;
let countdownTimer = 0;
let instructionAlpha = 1.0;

let fruits = [];
let fruitHalves = [];
let missIndicators = [];

let spawnTimer = 0;
let nextSpawnInterval = 100;

// --- FRUIT & BOMB DEFINITIONS ---
const FRUIT_TYPES = [
  { name: "Watermelon", emoji: "🍉", color: "#2e7d32", radius: 46 },
  { name: "Apple",      emoji: "🍎", color: "#d32f2f", radius: 42 },
  { name: "Orange",     emoji: "🍊", color: "#f57c00", radius: 44 },
  { name: "Lemon",      emoji: "🍋", color: "#fbc02d", radius: 38 }
];

class Fruit {
  constructor(canvasWidth, canvasHeight) {
    const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
    this.name = type.name;
    this.emoji = type.emoji;
    this.color = type.color;
    this.radius = type.radius;

    this.x = canvasWidth * 0.2 + Math.random() * (canvasWidth * 0.6);
    this.y = canvasHeight + this.radius + 20;

    const centerX = canvasWidth / 2;
    const direction = (centerX - this.x) / (canvasWidth / 2);
    this.vx = direction * (1.2 + Math.random() * 2.0) + (Math.random() * 2 - 1);

    const baseSpeed = Math.sqrt(canvasHeight) * 0.52;
    this.vy = -(baseSpeed + Math.random() * 3.5);

    this.gravity = 0.28;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.06;

    this.isSliced = false;
    this.isBomb = false;
    this.hasScoredMiss = false;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.rotation += this.rotationSpeed;
  }

  draw(ctx) {
    if (this.isSliced) return; // Guard: Never draw sliced fruit

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.font = `${Math.round(this.radius * 1.85)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 18;
    ctx.fillText(this.emoji, 0, 0);

    ctx.restore();
  }
}

class Bomb {
  constructor(canvasWidth, canvasHeight) {
    this.radius = 45;
    this.x = canvasWidth * 0.25 + Math.random() * (canvasWidth * 0.5);
    this.y = canvasHeight + this.radius + 20;

    const centerX = canvasWidth / 2;
    const direction = (centerX - this.x) / (canvasWidth / 2);
    this.vx = direction * (1 + Math.random() * 2);

    const baseSpeed = Math.sqrt(canvasHeight) * 0.50;
    this.vy = -(baseSpeed + Math.random() * 3);

    this.gravity = 0.28;
    this.rotation = 0;
    this.rotationSpeed = (Math.random() - 0.5) * 0.05;

    this.isSliced = false;
    this.isBomb = true;
    this.hasScoredMiss = false;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.rotation += this.rotationSpeed;
  }

  draw(ctx) {
    if (this.isSliced) return; // Guard: Never draw sliced bomb

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.font = `${Math.round(this.radius * 1.85)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#ff0044";
    ctx.shadowBlur = 24;
    ctx.fillText("💣", 0, 0);

    ctx.restore();
  }
}

class FruitHalf {
  constructor(fruit, isLeftHalf) {
    this.emoji = fruit.emoji;
    this.color = fruit.color;
    this.radius = fruit.radius;
    this.x = fruit.x;
    this.y = fruit.y;

    this.isLeft = isLeftHalf;
    this.vx = fruit.vx + (isLeftHalf ? -5.5 : 5.5);
    this.vy = fruit.vy - 2.0;
    this.gravity = 0.35;

    this.rotation = fruit.rotation;
    this.rotationSpeed = isLeftHalf ? -0.15 : 0.15;
    this.alpha = 1.0;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.rotation += this.rotationSpeed;
    this.alpha -= 0.016;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.beginPath();
    const clipWidth = this.radius * 2;
    if (this.isLeft) {
      ctx.rect(-clipWidth, -clipWidth, clipWidth, clipWidth * 2);
    } else {
      ctx.rect(0, -clipWidth, clipWidth, clipWidth * 2);
    }
    ctx.clip();

    ctx.font = `${Math.round(this.radius * 1.85)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fillText(this.emoji, 0, 0);

    ctx.restore();
  }
}

// --- COLLISION DETECTION ---
function lineSegmentIntersectsCircle(p1, p2, circle) {
  const effectiveRadius = circle.radius + GESTURE_HITBOX_PADDING;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const distSq = (circle.x - p1.x) ** 2 + (circle.y - p1.y) ** 2;
    return distSq <= effectiveRadius ** 2;
  }

  let t = ((circle.x - p1.x) * dx + (circle.y - p1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = p1.x + t * dx;
  const closestY = p1.y + t * dy;

  const distSq = (circle.x - closestX) ** 2 + (circle.y - closestY) ** 2;
  return distSq <= effectiveRadius ** 2;
}

// --- SPAWNER LOGIC ---
function spawnWave() {
  const count = Math.floor(Math.random() * 2) + 1;
  const spawnBomb = Math.random() < 0.18;

  let bombIndex = spawnBomb ? Math.floor(Math.random() * count) : -1;

  for (let i = 0; i < count; i++) {
    if (i === bombIndex) {
      fruits.push(new Bomb(canvas.width, canvas.height));
    } else {
      fruits.push(new Fruit(canvas.width, canvas.height));
    }
  }
}

// --- GESTURE SLICE DETECTION ---
function processSlicing() {
  for (let h = 0; h < handTrails.length; h++) {
    const trail = handTrails[h];
    if (trail.length < 2) continue;

    for (let i = 1; i < trail.length; i++) {
      const p1 = trail[i - 1];
      const p2 = trail[i];

      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (dist < SWIPE_SPEED_THRESHOLD) {
        continue;
      }

      for (let f = fruits.length - 1; f >= 0; f--) {
        const item = fruits[f];
        if (item.isSliced) continue;

        if (lineSegmentIntersectsCircle(p1, p2, item)) {
          item.isSliced = true;

          if (item.isBomb) {
            effects.triggerBombExplosion();
            triggerGameOver();
            return;
          } else {
            score += 1;
            effects.spawnJuiceBurst(item.x, item.y, item.color);
            fruitHalves.push(new FruitHalf(item, true));
            fruitHalves.push(new FruitHalf(item, false));

            // IMMEDIATELY remove original whole fruit from active fruits array
            fruits.splice(f, 1);
          }
        }
      }
    }
  }
}

// --- MISS INDICATORS ---
function addMissIndicator(x, y) {
  missIndicators.push({
    x: x,
    y: Math.min(y, canvas.height - 60),
    alpha: 1.0,
    scale: 1.5
  });
}

function updateAndDrawMissIndicators(ctx) {
  for (let i = missIndicators.length - 1; i >= 0; i--) {
    const m = missIndicators[i];
    m.y -= 1.2;
    m.alpha -= 0.02;
    m.scale = Math.max(1.0, m.scale - 0.02);

    if (m.alpha <= 0) {
      missIndicators.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = m.alpha;
    ctx.font = `bold ${Math.round(40 * m.scale)}px sans-serif`;
    ctx.fillStyle = "#ff0044";
    ctx.textAlign = "center";
    ctx.shadowColor = "#ff0044";
    ctx.shadowBlur = 15;
    ctx.fillText("❌", m.x, m.y);
    ctx.restore();
  }
}

// --- GAME OVER & RESTART ---
function triggerGameOver() {
  gameState = "GAMEOVER";
  finalScoreElement.textContent = score;
  gameOverScreen.classList.remove("hidden");
}

function restartGame() {
  gameState = "WAITING_FOR_HAND";
  score = 0;
  lives = 3;
  lastLifeLostTime = 0;
  instructionAlpha = 1.0;
  fruits = [];
  fruitHalves = [];
  missIndicators = [];
  spawnTimer = 0;
  handTrails[0].length = 0;
  handTrails[1].length = 0;
  gameOverScreen.classList.add("hidden");
}

restartBtn.addEventListener("click", restartGame);

function checkGameOverHover() {
  if (gameState !== "GAMEOVER") return;

  const btnRect = restartBtn.getBoundingClientRect();
  for (let h = 0; h < handTrails.length; h++) {
    const trail = handTrails[h];
    if (trail.length === 0) continue;
    const tip = trail[trail.length - 1];

    if (
      tip.x >= btnRect.left &&
      tip.x <= btnRect.right &&
      tip.y >= btnRect.top &&
      tip.y <= btnRect.bottom
    ) {
      restartGame();
      break;
    }
  }
}

// --- HUD RENDERER ---
function drawHUD(ctx) {
  ctx.save();

  // Score HUD
  ctx.font = "bold 28px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#00f3ff";
  ctx.shadowBlur = 10;
  ctx.fillText(`Score: ${score}`, 30, 50);

  // Lives HUD
  ctx.textAlign = "center";
  let livesText = "";
  for (let i = 0; i < 3; i++) {
    livesText += i < lives ? "❤️ " : "❌ ";
  }
  ctx.font = "26px sans-serif";
  ctx.fillText(livesText.trim(), canvas.width / 2, 50);

  // Mode Indicator
  ctx.textAlign = "right";
  ctx.font = "14px 'Segoe UI', sans-serif";
  ctx.fillStyle = "rgba(0, 243, 255, 0.8)";
  ctx.shadowBlur = 0;
  ctx.fillText("Gesture Control Active", canvas.width - 30, 45);

  ctx.restore();
}

// --- ON-SCREEN PROMPTS & COUNTDOWN ---
function drawWaitingForHand(ctx) {
  ctx.save();
  const pulse = Math.sin(performance.now() * 0.005) * 5;

  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(canvas.width / 2 - 240, canvas.height / 2 - 80 + pulse, 480, 140);
  ctx.strokeStyle = "rgba(0, 243, 255, 0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(canvas.width / 2 - 240, canvas.height / 2 - 80 + pulse, 480, 140);

  ctx.textAlign = "center";
  ctx.font = "bold 26px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#00f3ff";
  ctx.shadowBlur = 12;
  ctx.fillText("🖐️ Show your hand to the camera", canvas.width / 2, canvas.height / 2 - 30 + pulse);

  ctx.font = "16px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#00f3ff";
  ctx.shadowBlur = 0;
  ctx.fillText("Raise your index finger to start!", canvas.width / 2, canvas.height / 2 + 20 + pulse);

  ctx.restore();
}

function drawCountdown(ctx) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const numText = countdownValue > 0 ? `${countdownValue}` : "GO!";
  const scale = 1 + (countdownTimer % 60) / 60;

  ctx.font = `900 ${Math.round(90 * scale)}px 'Segoe UI', sans-serif`;
  ctx.fillStyle = countdownValue > 0 ? "#00f3ff" : "#00ff66";
  ctx.shadowColor = countdownValue > 0 ? "#00f3ff" : "#00ff66";
  ctx.shadowBlur = 30;
  ctx.fillText(numText, canvas.width / 2, canvas.height / 2);

  ctx.restore();
}

function drawInstructionOverlay(ctx) {
  if (instructionAlpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = instructionAlpha;
  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(canvas.width / 2 - 250, 90, 500, 50);

  ctx.font = "bold 22px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#00f3ff";
  ctx.shadowColor = "#00f3ff";
  ctx.shadowBlur = 15;
  ctx.fillText("✨ Swipe your finger fast to slice fruit! ✨", canvas.width / 2, 123);

  ctx.restore();
}

// --- MAIN GAME LOOP ---
function gameLoop() {
  effects.update();

  ctx.save();
  effects.applyScreenShake(ctx);

  // 1. Clear background
  ctx.fillStyle = "#0f0f13";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Render mirrored webcam background feed if active
  if (video.readyState >= 2) {
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.fillStyle = "rgba(15, 15, 19, 0.45)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 3. Draw Background Juice Splatters
  effects.drawSplatters(ctx);

  // 4. Run Hand Tracking Detection
  if (isTrackingInitialized) {
    detectHands(canvas);
  }

  // 5. Game State Machine Logic
  const hasHandDetected = handTrails[0].length > 0 || handTrails[1].length > 0;

  if (gameState === "WAITING_FOR_HAND") {
    drawWaitingForHand(ctx);
    drawBladeTrails(ctx);

    if (hasHandDetected) {
      gameState = "COUNTDOWN";
      countdownValue = 3;
      countdownTimer = 180; // 3 seconds @ 60fps
    }
  } 
  else if (gameState === "COUNTDOWN") {
    drawCountdown(ctx);
    drawBladeTrails(ctx);

    countdownTimer--;
    if (countdownTimer % 60 === 0 && countdownValue > 0) {
      countdownValue--;
    }

    if (countdownTimer <= 0) {
      gameState = "PLAYING";
      instructionAlpha = 1.0;
      spawnTimer = 0;
    }
  } 
  else if (gameState === "PLAYING") {
    // Spawner
    spawnTimer++;
    if (spawnTimer >= nextSpawnInterval) {
      spawnWave();
      spawnTimer = 0;
      nextSpawnInterval = Math.floor(Math.random() * 40) + 90;
    }

    const nowTime = performance.now();

    // Update & Draw Active Whole Fruits / Bombs
    for (let i = fruits.length - 1; i >= 0; i--) {
      const item = fruits[i];

      // GUARD: Immediately skip and remove sliced fruit
      if (item.isSliced) {
        fruits.splice(i, 1);
        continue;
      }

      item.update();
      item.draw(ctx);

      // Check missed fruit
      if (!item.hasScoredMiss && item.y > canvas.height + item.radius + 10 && item.vy > 0) {
        item.hasScoredMiss = true;
        if (!item.isBomb) {
          if (nowTime - lastLifeLostTime > 1000) {
            lives--;
            lastLifeLostTime = nowTime;
            addMissIndicator(item.x, item.y);

            if (lives <= 0) {
              triggerGameOver();
            }
          }
        }
      }

      if (item.y > canvas.height + 100 && item.vy > 0) {
        fruits.splice(i, 1);
      }
    }

    // Update & Draw Sliced Fruit Halves
    for (let i = fruitHalves.length - 1; i >= 0; i--) {
      const half = fruitHalves[i];
      half.update();
      half.draw(ctx);

      if (half.alpha <= 0 || half.y > canvas.height + 100) {
        fruitHalves.splice(i, 1);
      }
    }

    effects.drawParticles(ctx);
    updateAndDrawMissIndicators(ctx);
    processSlicing();
    drawBladeTrails(ctx);
    drawHUD(ctx);

    // Fade out instruction overlay banner
    if (instructionAlpha > 0) {
      instructionAlpha -= 0.005;
      drawInstructionOverlay(ctx);
    }
  } 
  else if (gameState === "GAMEOVER") {
    effects.drawParticles(ctx);
    drawBladeTrails(ctx);
    checkGameOverHover();
  }

  // Draw Bomb Explosion Flash
  effects.drawFlash(ctx, canvas.width, canvas.height);

  ctx.restore();

  // Status overlay if initializing or error
  if (statusText) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(20, 20, 580, 55);
    ctx.font = "16px 'Segoe UI', sans-serif";
    ctx.fillStyle = statusText.startsWith("Error") ? "#ff4444" : "#00f3ff";
    ctx.fillText(statusText, 35, 53);
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
