import { HandLandmarker, FilesetResolver } from "../vendor/mediapipe/vision_bundle.mjs";

let handLandmarker = null;
let videoElement = null;
let lastVideoTime = -1;
let latestResults = null;
let isReady = false;

const MAX_TRAIL_LENGTH = 16;
export const handTrails = [
  [], // Hand 0 points [{x, y}]
  []  // Hand 1 points [{x, y}]
];

// Smooth EMA state per hand
const smoothedPos = [
  { x: null, y: null },
  { x: null, y: null }
];

export async function initHandTracking(video) {
  videoElement = video;

  console.log("[HandTracking] Requesting 60fps camera stream...");
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { 
      width: { ideal: 640 }, 
      height: { ideal: 480 },
      frameRate: { ideal: 60, min: 30 },
      facingMode: "user" 
    }
  });
  videoElement.srcObject = stream;
  await new Promise((resolve) => {
    videoElement.onloadedmetadata = () => {
      videoElement.play();
      resolve();
    };
  });

  const vision = await FilesetResolver.forVisionTasks("../vendor/mediapipe");

  console.log("[HandTracking] Initializing HandLandmarker model...");
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "../vendor/mediapipe/hand_landmarker.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.25,
    minHandPresenceConfidence: 0.25,
    minTrackingConfidence: 0.25
  });

  isReady = true;
  console.log("[HandTracking] HandLandmarker ready!");
}

export function detectHands(canvas) {
  if (!isReady || !handLandmarker || !videoElement) return null;

  if (videoElement.currentTime !== lastVideoTime && videoElement.readyState >= 2) {
    lastVideoTime = videoElement.currentTime;

    try {
      latestResults = handLandmarker.detectForVideo(videoElement, performance.now());
    } catch (err) {
      console.warn("[HandTracking] Frame detection error:", err);
      return latestResults;
    }

    if (latestResults && latestResults.landmarks) {
      const activeHandCount = latestResults.landmarks.length;

      for (let h = 0; h < 2; h++) {
        if (h < activeHandCount) {
          const landmarks = latestResults.landmarks[h];
          const indexFingertip = landmarks[8]; // Landmark 8 = Index fingertip

          if (indexFingertip) {
            // Mirror X coordinate for natural user movement
            const rawX = (1 - indexFingertip.x) * canvas.width;
            const rawY = indexFingertip.y * canvas.height;

            // Dynamic EMA Filter
            const sm = smoothedPos[h];
            if (sm.x === null) {
              sm.x = rawX;
              sm.y = rawY;
            } else {
              const delta = Math.hypot(rawX - sm.x, rawY - sm.y);
              const alpha = delta > 30 ? 0.92 : (delta > 10 ? 0.72 : 0.55);
              sm.x += (rawX - sm.x) * alpha;
              sm.y += (rawY - sm.y) * alpha;
            }

            const targetX = sm.x;
            const targetY = sm.y;

            const trail = handTrails[h];
            if (trail.length > 0) {
              const lastPt = trail[trail.length - 1];
              const dist = Math.hypot(targetX - lastPt.x, targetY - lastPt.y);

              if (dist > 18) {
                const steps = Math.min(5, Math.floor(dist / 12));
                for (let s = 1; s <= steps; s++) {
                  const interpX = lastPt.x + (targetX - lastPt.x) * (s / steps);
                  const interpY = lastPt.y + (targetY - lastPt.y) * (s / steps);
                  trail.push({ x: interpX, y: interpY });
                }
              } else {
                trail.push({ x: targetX, y: targetY });
              }
            } else {
              trail.push({ x: targetX, y: targetY });
            }

            while (trail.length > MAX_TRAIL_LENGTH) {
              trail.shift();
            }
          }
        } else {
          smoothedPos[h].x = null;
          smoothedPos[h].y = null;
          if (handTrails[h].length > 0) {
            handTrails[h].shift();
          }
        }
      }
    }
  }

  return latestResults;
}

export function drawBladeTrails(ctx) {
  for (let h = 0; h < handTrails.length; h++) {
    const points = handTrails[h];
    if (points.length === 0) continue;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const len = points.length;

    // 1. Draw glowing blade streak line segments
    if (len >= 2) {
      for (let i = 1; i < len; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];

        const progress = i / (len - 1);
        const alpha = 0.2 + progress * 0.8;
        const lineWidth = 4 + progress * 14;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);

        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = h === 0 
          ? `rgba(0, 243, 255, ${alpha})`   // Hand 0: Neon Cyan
          : `rgba(255, 0, 127, ${alpha})`;  // Hand 1: Neon Pink

        ctx.shadowColor = h === 0 ? "#00f3ff" : "#ff007f";
        ctx.shadowBlur = 18 * progress + 6;

        ctx.stroke();
      }
    }

    // 2. ALWAYS draw visible glowing blade tip target indicator at current fingertip position
    const tip = points[len - 1];
    
    // Core white dot
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = h === 0 ? "#00f3ff" : "#ff007f";
    ctx.shadowBlur = 22;
    ctx.fill();

    // Outer pulsing target ring
    const pulseRadius = 16 + Math.sin(performance.now() * 0.008) * 3;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, pulseRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = h === 0 ? "rgba(0, 243, 255, 0.9)" : "rgba(255, 0, 127, 0.9)";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 14;
    ctx.stroke();

    ctx.restore();
  }
}
