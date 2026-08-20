// Stage 5.1: Juice Effects (Particles, Splatters, Screen Shake)

export class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = Math.random() * 4 + 3;

    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.gravity = 0.3;
    this.alpha = 1.0;
    this.decay = Math.random() * 0.025 + 0.02;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.fill();
    ctx.restore();
  }
}

export class JuiceSplatter {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = Math.random() * 18 + 14;
    this.alpha = 0.6;
    this.decay = 0.008; // Fades out slowly over ~2 seconds
  }

  update() {
    this.alpha -= this.decay;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }
}

export class EffectsManager {
  constructor() {
    this.particles = [];
    this.splatters = [];
    this.shakeIntensity = 0;
    this.flashAlpha = 0;
  }

  spawnJuiceBurst(x, y, fruitColor) {
    // 1. Spawn particles
    const particleCount = 18;
    for (let i = 0; i < particleCount; i++) {
      const pColor = i % 3 === 0 ? "#ffffff" : fruitColor;
      this.particles.push(new Particle(x, y, pColor));
    }

    // 2. Spawn background splatter
    this.splatters.push(new JuiceSplatter(x, y, fruitColor));
    if (this.splatters.length > 20) {
      this.splatters.shift();
    }
  }

  triggerBombExplosion() {
    this.shakeIntensity = 30; // Intense screen shake
    this.flashAlpha = 0.8;    // Red/white explosion flash
  }

  update() {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update();
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update splatters
    for (let i = this.splatters.length - 1; i >= 0; i--) {
      const s = this.splatters[i];
      s.update();
      if (s.alpha <= 0) {
        this.splatters.splice(i, 1);
      }
    }

    // Decay screen shake & flash
    if (this.shakeIntensity > 0) {
      this.shakeIntensity *= 0.85;
      if (this.shakeIntensity < 0.5) this.shakeIntensity = 0;
    }

    if (this.flashAlpha > 0) {
      this.flashAlpha -= 0.05;
      if (this.flashAlpha < 0) this.flashAlpha = 0;
    }
  }

  applyScreenShake(ctx) {
    if (this.shakeIntensity > 0) {
      const dx = (Math.random() - 0.5) * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(dx, dy);
    }
  }

  drawSplatters(ctx) {
    for (const s of this.splatters) {
      s.draw(ctx);
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      p.draw(ctx);
    }
  }

  drawFlash(ctx, canvasWidth, canvasHeight) {
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = "#ff0044";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.restore();
    }
  }
}
