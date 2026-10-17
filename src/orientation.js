import * as THREE from 'three';

const ZEE = new THREE.Vector3(0, 0, 1);
const EULER = new THREE.Euler();
const Q0 = new THREE.Quaternion();
const Q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90deg about X

const D2R = Math.PI / 180;

/**
 * Drives a three.js camera from device orientation, with slerp smoothing,
 * and touch-drag look-around (as the fallback, or as an added offset).
 */
export class OrientationControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.hasGyro = false;
    this.enabled = false;
    this.smoothing = 0.2; // 0..1, higher = snappier
    this.alphaOffset = 0;

    this.target = new THREE.Quaternion();
    this.current = new THREE.Quaternion();
    this.device = { alpha: 0, beta: 0, gamma: 0 };
    this.screenAngle = 0;
    this.gotEvent = false;
    this.first = true;

    // drag look
    this.yaw = 0;
    this.pitch = 0;
    this._dragging = false;
    this._lx = 0;
    this._ly = 0;
    this._yawQ = new THREE.Quaternion();
    this._pitchQ = new THREE.Quaternion();
    this._tmp = new THREE.Quaternion();

    this._onOrient = this._onOrient.bind(this);
    this._onScreen = this._onScreen.bind(this);
    this._down = this._down.bind(this);
    this._move = this._move.bind(this);
    this._up = this._up.bind(this);
    this._useAbsolute = false;
  }

  start() {
    this.enabled = true;
    this._onScreen();
    window.addEventListener('orientationchange', this._onScreen);
    window.addEventListener('resize', this._onScreen);
    // Prefer absolute (compass based) on Android when it delivers data
    window.addEventListener('deviceorientationabsolute', this._onOrient, true);
    window.addEventListener('deviceorientation', this._onOrient, true);
    this.dom.addEventListener('pointerdown', this._down);
    window.addEventListener('pointermove', this._move);
    window.addEventListener('pointerup', this._up);
    window.addEventListener('pointercancel', this._up);
  }

  stop() {
    this.enabled = false;
    window.removeEventListener('orientationchange', this._onScreen);
    window.removeEventListener('resize', this._onScreen);
    window.removeEventListener('deviceorientationabsolute', this._onOrient, true);
    window.removeEventListener('deviceorientation', this._onOrient, true);
    this.dom.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('pointercancel', this._up);
  }

  _onScreen() {
    const o = screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : window.orientation || 0;
    this.screenAngle = o * D2R;
  }

  _onOrient(e) {
    if (e.alpha === null || e.alpha === undefined || e.beta === null || e.beta === undefined) return;
    // If absolute events are flowing, ignore the relative stream so they do not fight
    if (e.type === 'deviceorientationabsolute') this._useAbsolute = true;
    else if (this._useAbsolute) return;
    this.gotEvent = true;
    this.hasGyro = true;
    this.device.alpha = e.alpha;
    this.device.beta = e.beta;
    this.device.gamma = e.gamma || 0;
  }

  _down(e) {
    this._dragging = true;
    this._lx = e.clientX;
    this._ly = e.clientY;
  }
  _move(e) {
    if (!this._dragging) return;
    const dx = e.clientX - this._lx;
    const dy = e.clientY - this._ly;
    this._lx = e.clientX;
    this._ly = e.clientY;
    const k = 0.005;
    this.yaw += dx * k;
    this.pitch += dy * k;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }
  _up() {
    this._dragging = false;
  }

  /** Call every frame. */
  update() {
    if (!this.enabled) return;

    if (this.hasGyro) {
      const a = (this.device.alpha + this.alphaOffset) * D2R;
      const b = this.device.beta * D2R;
      const g = this.device.gamma * D2R;
      EULER.set(b, a, -g, 'YXZ');
      this.target.setFromEuler(EULER);
      this.target.multiply(Q1);
      this.target.multiply(Q0.setFromAxisAngle(ZEE, -this.screenAngle));

      if (this.first) {
        this.current.copy(this.target);
        this.first = false;
      } else {
        this.current.slerp(this.target, this.smoothing);
      }

      // add a drag offset on top of the gyro (yaw around world Y)
      this._yawQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -this.yaw);
      this.camera.quaternion.copy(this._yawQ).multiply(this.current);
    } else {
      // pure drag mode
      EULER.set(-this.pitch, -this.yaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(EULER);
    }
  }

  /** Resolves true if the gyro delivers real data shortly after start. */
  waitForGyro(ms = 1200) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const tick = () => {
        if (this.gotEvent) return resolve(true);
        if (performance.now() - t0 > ms) return resolve(false);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }
}
