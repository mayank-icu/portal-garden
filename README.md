# Portal Garden

An interactive 3D web experience built with Three.js and Vite. It starts as a camera pass-through with an enchanted portal doorway, and stepping through drops you into a quiet 360° blooming garden with falling petals, interactive fireflies, lanterns, background music, and a note at the end.

Originally crafted as a personal interactive gift.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Testing on Mobile

Camera and gyro orientation sensors require a secure context (HTTPS) on mobile devices unless running on `localhost`.

### Option A: Free Cloudflare tunnel (simplest for iOS & Android)
```bash
npx cloudflared tunnel --url http://localhost:5173
```
Open the generated `https://*.trycloudflare.com` link on your phone.

### Option B: USB debugging (Android)
```bash
adb reverse tcp:5173 tcp:5173
adb shell am start -a android.intent.action.VIEW -d "http://localhost:5173/?debug=1"
```
Because `localhost` is treated as a secure origin, camera and motion work without needing HTTPS.

---

## Customizing

All names, text prompts, palette colors, audio, and the final letter live in one place:

Edit [`src/config.js`](src/config.js):

```javascript
export default {
  herName: 'Yue',
  fromName: 'Mayank',
  // ... customized message, colors, and audio
};
```

---

## Helpful URL Flags

- `?debug=1` — displays live FPS counter, sensor readouts, and state machine state
- `?world=1` — skips camera and portal transition directly into the garden scene

---

## Stack

- [Three.js](https://threejs.org/) (WebGL scenes, particles, audio, and shaders)
- [Vite](https://vitejs.dev/) (bundler and dev server)
