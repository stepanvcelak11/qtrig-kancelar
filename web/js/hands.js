// Sledování ruky přes MediaPipe Hand Landmarker (WASM + GPU) nad videem zadní kamery.
// Vrací polohu špičky ukazováčku na obrazovce, sevření (pinch) a natočení špetky.
//
// Sevření: vzdálenost palec–ukazováček přepočtená měřítkem ruky
// (zápěstí → kořen prostředníčku ≈ 9,5 cm) < 3 cm, uvolnění > 4,5 cm (hystereze).

const BASE = new URL('../vendor/mediapipe/', import.meta.url).href;

export class HandTracker {
  constructor(video, onResult) {
    this.video = video;
    this.onResult = onResult;
    this.running = false;
    this.pinching = false;
    this.lastVideoTime = -1;
    this.smooth = null;
  }

  async start() {
    if (!this.landmarker) {
      const { FilesetResolver, HandLandmarker } = await import('../vendor/mediapipe/vision_bundle.mjs');
      const fileset = await FilesetResolver.forVisionTasks(BASE.replace(/\/$/, ''));
      const make = (delegate) => HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: BASE + 'hand_landmarker.task', delegate },
        runningMode: 'VIDEO', numHands: 1,
        minHandDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      try { this.landmarker = await make('GPU'); } catch { this.landmarker = await make('CPU'); }
    }
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    this.onResult(null);
  }

  /** Převod normalizovaných souřadnic videa na body obrazovky (video s object-fit: cover). */
  toScreen(p) {
    const v = this.video;
    const W = window.innerWidth, H = window.innerHeight;
    const vw = v.videoWidth || W, vh = v.videoHeight || H;
    const s = Math.max(W / vw, H / vh);
    return { x: p.x * vw * s - (vw * s - W) / 2, y: p.y * vh * s - (vh * s - H) / 2 };
  }

  loop = () => {
    if (!this.running) return;
    const v = this.video;
    if (v.readyState >= 2 && v.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = v.currentTime;
      const res = this.landmarker.detectForVideo(v, performance.now());
      const lm = res.landmarks?.[0];
      if (lm) {
        const tip = this.toScreen(lm[8]), thumb = this.toScreen(lm[4]);
        const wrist = this.toScreen(lm[0]), mcp = this.toScreen(lm[9]);
        const palm = Math.hypot(wrist.x - mcp.x, wrist.y - mcp.y);
        const pinch = palm > 8 ? (Math.hypot(tip.x - thumb.x, tip.y - thumb.y) / palm) * 0.095 : 1;
        if (this.pinching ? pinch > 0.045 : pinch < 0.03) this.pinching = !this.pinching;
        // Jednoduché vyhlazení (exponenciální) proti chvění.
        const a = 0.55;
        this.smooth = this.smooth ? { x: this.smooth.x + (tip.x - this.smooth.x) * a, y: this.smooth.y + (tip.y - this.smooth.y) * a } : tip;
        this.onResult({
          x: this.smooth.x, y: this.smooth.y, thumb, pinching: this.pinching, pinch,
          roll: Math.atan2(tip.y - thumb.y, tip.x - thumb.x),
        });
      } else {
        this.smooth = null;
        if (this.pinching) this.pinching = false;
        this.onResult(null);
      }
    }
    requestAnimationFrame(this.loop);
  };
}
