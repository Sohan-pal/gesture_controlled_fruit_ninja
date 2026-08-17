# Gesture-Controlled Fruit Ninja 🍉🍎🍊🍋💣

A browser-based Fruit Ninja clone controlled entirely by hand gestures via your webcam. No mouse, no keyboard, and zero backend required. Your index finger becomes the blade!

![Gesture Controlled Fruit Ninja](https://img.shields.io/badge/Control-Webcam%20Hand%20Gesture-00f3ff)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Build](https://img.shields.io/badge/Build-Client--Side%20Static-ff007f)

---

## ✨ Features

- **Real-Time Hand Tracking**: Powered by Google MediaPipe Tasks Vision (Hand Landmarker) running fully client-side on WebAssembly with GPU acceleration.
- **Ultra-Smooth Blade Controls**: Features dynamic Exponential Moving Average (EMA) smoothing and sub-frame trajectory interpolation for responsive 60 FPS swipe tracking.
- **Fruit Physics & Slicing**: Parabolic fruit launch trajectories, realistic line-segment collision detection, and emoji splitting animations.
- **Juice Effects & Screen Shake**: Vibrant juice particle bursts, persistent background splatters, screen shake, and bomb explosion flashes.
- **Hand Start Gate & Countdown**: Interactive hand detection start gate ("Show your hand to camera") with a 3... 2... 1... GO! countdown overlay.
- **100% Static & Offline Ready**: All WASM assets and AI models are bundled locally — no external CDN dependencies or server costs.

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Hand Tracking** | MediaPipe Tasks Vision — Hand Landmarker (WASM / WebGL) |
| **Rendering Engine** | HTML5 2D Canvas & Vanilla JavaScript (ES Modules) |
| **UI Styling** | Vanilla CSS3 (Glassmorphism & Neon Design System) |
| **Server / Hosting** | Static file hosting (GitHub Pages, Vercel, Netlify) |

---

## 🚀 Quick Start (Run Locally)

### 1. Clone the repository
```bash
git clone https://github.com/Sohan-pal/gesture_controlled_fruit_ninja.git
cd gesture_controlled_fruit_ninja
```

### 2. Start a local HTTP server
Since the app uses ES Modules and webcam APIs, run a local web server:

**Using Python (built-in):**
```bash
python3 -m http.server 3000
```

**Or using Node.js / npx:**
```bash
npx serve .
```

### 3. Open in Browser
Navigate to `http://localhost:3000` in any modern web browser (Chrome, Brave, Edge, Safari). Grant webcam permission when prompted.

---

## 🎮 How to Play

1. **Get Ready**: Raise your hand in front of your camera when prompted.
2. **Countdown**: Hold your position during the `3... 2... 1... GO!` countdown.
3. **Slice Fruit**: Fast-swipe your index finger across launching fruits (🍉 🍎 🍊 🍋) to slice them for points.
4. **Avoid Bombs**: Slicing a black bomb (💣) results in instant Game Over!
5. **Lives System**: Missing unsliced fruit costs 1 of your 3 lives (`❤️ ❤️ ❤️`).
6. **Play Again**: Hover your fingertip over the **"Play Again"** button or click it to restart.

---

## 🌐 Deploy to GitHub Pages

To host this live for free on GitHub Pages:
1. Go to your repository on GitHub: `https://github.com/Sohan-pal/gesture_controlled_fruit_ninja`
2. Open **Settings** -> **Pages**.
3. Under **Branch**, select `main` and `/ (root)`, then click **Save**.
4. Your site will be live at `https://Sohan-pal.github.io/gesture_controlled_fruit_ninja/` in 1-2 minutes!

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
