/**
 * Candor AI Interview Platform — Integrity & Attention Monitoring Engine (T3)
 * Author: Suryansh (Teammate 3 - Integrity + QA)
 *
 * Responsibilities:
 * 1. IntegrityMonitor: Client-side on-device attention, gaze & tab tracking via MediaPipe.
 * 2. renderIntegrity: Recruiter report UI generator displaying the Explainable Evidence Dossier.
 *
 * Privacy & Ethics Commitment:
 * - 100% on-device vision processing; zero video or audio frames are ever streamed to servers.
 * - Integrity is advisory context for human review only and is NEVER factored into the AI hire score.
 */

export const CONFIG = {
  YAW_THRESHOLD_DEG: 25,
  PITCH_THRESHOLD_DEG: 20,
  LOOK_AWAY_MIN_MS: 1500,     // Ignore brief natural glances < 1.5s
  FACE_MISSING_MIN_MS: 1000,  // Require 1s absence before logging
  MULTI_FACE_MIN_MS: 1000,    // Require 1s second person before logging
  TAB_HIDDEN_MIN_MS: 300,     // Ignore micro OS glitches
  WINDOW_BLUR_MIN_MS: 500,    // Ignore momentary window focus changes
  CALIBRATION_SAMPLES: 25,    // ~1.5s baseline resting pose calibration
  FPS_INTERVAL_MS: 66,        // Target ~15 FPS to keep client CPU/GPU usage minimal
  EYE_LOOK_SIDE_THRESHOLD: 0.52, // Blendshape threshold for reading off secondary screens
  EYE_LOOK_DOWN_THRESHOLD: 0.58, // Blendshape threshold for looking down at desk/phone
  PASTE_CHAR_THRESHOLD: 25,      // Clipboard paste character threshold
};

// Safe HTML escaping for report rendering
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function formatDuration(ms) {
  const s = ((ms || 0) / 1000).toFixed(1);
  return `${s}s`;
}

function formatOffset(ms) {
  const totalSec = Math.floor((ms || 0) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Client-Side Attention & Integrity Monitor
 */
export class IntegrityMonitor {
  /**
   * @param {HTMLVideoElement} videoEl
   * @param {HTMLCanvasElement} canvasEl
   * @param {Function} onChange - Callback: hud => { vision, focus, faces, tab, lastEvent, stats }
   */
  constructor(videoEl, canvasEl, onChange) {
    this.video = videoEl || null;
    this.canvas = canvasEl || null;
    this.ctx = canvasEl?.getContext ? canvasEl.getContext('2d') : null;
    this.onChange = typeof onChange === 'function' ? onChange : () => {};

    this.events = [];
    this.running = false;
    this.startTime = null;
    this.visionAvailable = false;
    this.landmarker = null;
    this.rafId = null;
    this.lastLoopTime = 0;

    // Episode state tracking (only completed episodes >= threshold are emitted)
    this.tabHiddenStart = null;
    this.tabHiddenT = 0;

    this.blurStart = null;
    this.blurT = 0;

    this.lookAwayStart = null;
    this.lookAwayT = 0;
    this.activeMaxYaw = 0;
    this.activeMaxPitch = 0;

    this.faceMissingStart = null;
    this.faceMissingT = 0;

    this.multiFaceStart = null;
    this.multiFaceT = 0;
    this.activeMaxFaces = 0;

    // Adaptive calibration baseline (calibrates user's resting monitor position)
    this.calibrating = true;
    this.calibrationSamples = [];
    this.baselineYaw = 0;
    this.baselinePitch = 0;

    // Advanced anti-cheat tracking state
    this.activeGazeReason = '';
    this.noseHistory = [];
    this.staticFrameStart = null;
    this.screenStream = null;
    this.screenShareActive = false;

    // Event listener references for clean removal
    this._handleVisibility = this._onVisibilityChange.bind(this);
    this._handleBlur = this._onWindowBlur.bind(this);
    this._handleFocus = this._onWindowFocus.bind(this);
    this._handleKeyDown = this._onKeyDown.bind(this);
    this._handlePaste = this._onPaste.bind(this);
    this._handleContextMenu = this._onContextMenu.bind(this);
    this._handleFullscreen = this._onFullscreenChange.bind(this);
  }

  /**
   * Start monitoring. If hasCamera is true, initializes MediaPipe FaceLandmarker.
   * If hasCamera is false or fails, degrades gracefully to tab/window monitoring.
   * @param {boolean} hasCamera
   * @param {boolean} requestScreen - If true, requests full desktop screen sharing
   */
  async start(hasCamera = true, requestScreen = false) {
    this.startTime = Date.now();
    this.running = true;

    // 1. Attach document & window listeners
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._handleVisibility);
      document.addEventListener('paste', this._handlePaste);
      document.addEventListener('contextmenu', this._handleContextMenu);
      document.addEventListener('fullscreenchange', this._handleFullscreen);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this._handleBlur);
      window.addEventListener('focus', this._handleFocus);
      window.addEventListener('keydown', this._handleKeyDown);
    }

    // 2. Request desktop screen share if requested
    if (requestScreen) {
      await this.startScreenShare();
    }

    // 3. Initialize MediaPipe Vision if camera enabled
    if (hasCamera && this.video) {
      this.onChange({
        vision: 'loading',
        focus: 'ok',
        faces: 0,
        tab: 'visible',
        lastEvent: 'Initializing vision model…',
        stats: this._getLiveStats(),
      });

      try {
        const { FilesetResolver, FaceLandmarker } = await import(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs'
        );

        const fileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
        );

        // Attempt GPU first; fallback to CPU if unavailable
        try {
          this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numFaces: 2,
            outputFaceBlendshapes: true,
          });
        } catch (gpuErr) {
          console.warn('[Candor Vision] GPU delegate failed, falling back to CPU', gpuErr);
          this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numFaces: 2,
            outputFaceBlendshapes: true,
          });
        }

        this.visionAvailable = true;
        this._startVisionLoop();
      } catch (err) {
        console.warn('[Candor Vision] MediaPipe unavailable. Running in tab/blur mode only.', err);
        this.visionAvailable = false;
      }
    } else {
      this.visionAvailable = false;
    }

    this._emitHud(this.visionAvailable ? 'Monitoring active' : 'Tab/blur monitoring active');
    return this;
  }

  async startScreenShare() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      return false;
    }
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      });

      const track = this.screenStream.getVideoTracks()[0];
      if (track) {
        this.screenShareActive = true;
        const settings = track.getSettings ? track.getSettings() : {};
        const surface = settings.displaySurface || 'monitor';

        track.onended = () => {
          if (this.running) {
            const now = Date.now();
            this._pushEvent('TAB_HIDDEN', now - this.startTime, now - 3000, 3000, {
              reason: 'Desktop screen share terminated by candidate',
            });
            this.screenStream = null;
            this._emitHud('Screen sharing stopped!');
          }
        };

        this._emitHud(`Screen sharing active (${surface})`);
        return true;
      }
    } catch (err) {
      console.warn('[Candor Screen] Screen share declined or failed', err);
      const now = Date.now();
      this._pushEvent('WINDOW_BLUR', now - this.startTime, now - 1000, 1000, {
        reason: 'Desktop screen sharing declined by candidate',
      });
      return false;
    }
    return false;
  }

  _onFullscreenChange() {
    if (!this.running) return;
    if (typeof document !== 'undefined' && !document.fullscreenElement) {
      const now = Date.now();
      this._pushEvent('WINDOW_BLUR', now - this.startTime, now - 1500, 1500, {
        reason: 'Exited full-screen assessment confinement',
      });
      this._emitHud('Exited full-screen confinement');
    } else {
      this._emitHud('Full-screen active');
    }
  }

  stop() {
    this.running = false;

    if (this.rafId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.screenStream) {
      try {
        this.screenStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      this.screenStream = null;
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._handleVisibility);
      document.removeEventListener('paste', this._handlePaste);
      document.removeEventListener('contextmenu', this._handleContextMenu);
      document.removeEventListener('fullscreenchange', this._handleFullscreen);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('blur', this._handleBlur);
      window.removeEventListener('focus', this._handleFocus);
      window.removeEventListener('keydown', this._handleKeyDown);
    }

    const now = Date.now();
    if (this.tabHiddenStart) {
      const dur = now - this.tabHiddenStart;
      if (dur >= CONFIG.TAB_HIDDEN_MIN_MS) {
        this._pushEvent('TAB_HIDDEN', this.tabHiddenT, this.tabHiddenStart, dur, { reason: 'tab switched' });
      }
      this.tabHiddenStart = null;
    }

    if (this.blurStart) {
      const dur = now - this.blurStart;
      if (dur >= CONFIG.WINDOW_BLUR_MIN_MS) {
        this._pushEvent('WINDOW_BLUR', this.blurT, this.blurStart, dur, {});
      }
      this.blurStart = null;
    }

    if (this.lookAwayStart) {
      const dur = now - this.lookAwayStart;
      if (dur >= CONFIG.LOOK_AWAY_MIN_MS) {
        this._pushEvent('LOOK_AWAY', this.lookAwayT, this.lookAwayStart, dur, {
          yaw: Math.round(this.activeMaxYaw),
          pitch: Math.round(this.activeMaxPitch),
        });
      }
      this.lookAwayStart = null;
    }

    if (this.faceMissingStart) {
      const dur = now - this.faceMissingStart;
      if (dur >= CONFIG.FACE_MISSING_MIN_MS) {
        this._pushEvent('FACE_MISSING', this.faceMissingT, this.faceMissingStart, dur, { reason: 'no face in frame' });
      }
      this.faceMissingStart = null;
    }

    if (this.multiFaceStart) {
      const dur = now - this.multiFaceStart;
      if (dur >= CONFIG.MULTI_FACE_MIN_MS) {
        this._pushEvent('MULTIPLE_FACES', this.multiFaceT, this.multiFaceStart, dur, { count: this.activeMaxFaces || 2 });
      }
      this.multiFaceStart = null;
    }

    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    const totalMs = Math.max(1, now - (this.startTime || now));
    return {
      totalMs,
      visionAvailable: this.visionAvailable,
      screenShareActive: this.screenShareActive,
      events: [...this.events],
    };
  }

  _pushEvent(type, t, startEpochMs, durationMs, detail = {}) {
    const at = new Date(startEpochMs || Date.now()).toISOString();
    const event = {
      type,
      t: Math.max(0, Math.round(t)),
      at,
      durationMs: Math.max(1, Math.round(durationMs)),
      detail,
    };
    this.events.push(event);

    const label = type === 'LOOK_AWAY' ? `Looked away (${formatDuration(durationMs)})`
      : type === 'TAB_HIDDEN' ? `Tab hidden (${formatDuration(durationMs)})`
      : type === 'MULTIPLE_FACES' ? `Multiple faces (${formatDuration(durationMs)})`
      : type === 'FACE_MISSING' ? `Face missing (${formatDuration(durationMs)})`
      : `Window blurred (${formatDuration(durationMs)})`;

    this._emitHud(label);
  }

  _onVisibilityChange() {
    if (!this.running) return;
    const now = Date.now();
    if (document.hidden) {
      if (!this.tabHiddenStart) {
        this.tabHiddenStart = now;
        this.tabHiddenT = now - this.startTime;
        this._emitHud('Switched tab');
      }
    } else {
      if (this.tabHiddenStart) {
        const dur = now - this.tabHiddenStart;
        if (dur >= CONFIG.TAB_HIDDEN_MIN_MS) {
          this._pushEvent('TAB_HIDDEN', this.tabHiddenT, this.tabHiddenStart, dur, { reason: 'tab switched' });
        }
        this.tabHiddenStart = null;
        this._emitHud('Returned to tab');
      }
    }
  }

  _onWindowBlur() {
    if (!this.running) return;
    if (document.hidden) return;
    if (!this.blurStart) {
      const now = Date.now();
      this.blurStart = now;
      this.blurT = now - this.startTime;
    }
  }

  _onWindowFocus() {
    if (!this.running) return;
    if (this.blurStart) {
      const now = Date.now();
      const dur = now - this.blurStart;
      if (dur >= CONFIG.WINDOW_BLUR_MIN_MS) {
        this._pushEvent('WINDOW_BLUR', this.blurT, this.blurStart, dur, {});
      }
      this.blurStart = null;
      this._emitHud('Window focus restored');
    }
  }

  _onKeyDown(e) {
    if (!this.running) return;
    const isDevToolsKey =
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
      (e.ctrlKey && ['U', 'u'].includes(e.key));

    if (isDevToolsKey) {
      const now = Date.now();
      this._pushEvent('WINDOW_BLUR', now - this.startTime, now - 1500, 1500, {
        reason: `DevTools inspection shortcut attempted (${e.key})`,
      });
      this._emitHud('DevTools shortcut intercepted');
    }
  }

  _onPaste(e) {
    if (!this.running) return;
    const text = e.clipboardData ? e.clipboardData.getData('text') : '';
    if (text && text.length >= CONFIG.PASTE_CHAR_THRESHOLD) {
      const now = Date.now();
      this._pushEvent('WINDOW_BLUR', now - this.startTime, now - 1000, 1000, {
        reason: `Suspicious clipboard paste (${text.length} chars)`,
      });
      this._emitHud(`Paste detected (${text.length} chars)`);
    }
  }

  _onContextMenu() {
    if (!this.running) return;
    this._emitHud('Context menu opened');
  }

  _startVisionLoop() {
    const loop = () => {
      if (!this.running) return;
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());

      if (now - this.lastLoopTime >= CONFIG.FPS_INTERVAL_MS) {
        this.lastLoopTime = now;
        if (this.video && this.video.readyState >= 2 && !this.video.paused) {
          try {
            const results = this.landmarker.detectForVideo(this.video, now);
            this._processFrame(results);
            this._drawOverlay(results);
          } catch (e) {}
        }
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  _processFrame(results) {
    const now = Date.now();
    const faces = results?.faceLandmarks || [];
    const faceCount = faces.length;

    if (faceCount >= 2) {
      if (!this.multiFaceStart) {
        this.multiFaceStart = now;
        this.multiFaceT = now - this.startTime;
        this.activeMaxFaces = faceCount;
      } else {
        this.activeMaxFaces = Math.max(this.activeMaxFaces, faceCount);
      }
    } else if (this.multiFaceStart) {
      const dur = now - this.multiFaceStart;
      if (dur >= CONFIG.MULTI_FACE_MIN_MS) {
        this._pushEvent('MULTIPLE_FACES', this.multiFaceT, this.multiFaceStart, dur, { count: this.activeMaxFaces });
      }
      this.multiFaceStart = null;
      this.activeMaxFaces = 0;
    }

    if (faceCount === 0) {
      if (this.lookAwayStart) {
        this.lookAwayStart = null;
      }
      if (!this.faceMissingStart) {
        this.faceMissingStart = now;
        this.faceMissingT = now - this.startTime;
      }
      this._emitHud('No face detected');
      return;
    } else if (this.faceMissingStart) {
      const dur = now - this.faceMissingStart;
      if (dur >= CONFIG.FACE_MISSING_MIN_MS) {
        this._pushEvent('FACE_MISSING', this.faceMissingT, this.faceMissingStart, dur, { reason: 'no face in frame' });
      }
      this.faceMissingStart = null;
    }

    const landmarks = faces[0];
    const pose = this._calculatePose(landmarks);

    if (this.calibrating) {
      this.calibrationSamples.push(pose);
      if (this.calibrationSamples.length >= CONFIG.CALIBRATION_SAMPLES) {
        const sumYaw = this.calibrationSamples.reduce((a, b) => a + b.rawYaw, 0);
        const sumPitch = this.calibrationSamples.reduce((a, b) => a + b.rawPitch, 0);
        this.baselineYaw = sumYaw / this.calibrationSamples.length;
        this.baselinePitch = sumPitch / this.calibrationSamples.length;
        this.calibrating = false;
      }
    }

    const yaw = pose.rawYaw - this.baselineYaw;
    const pitch = pose.rawPitch - this.baselinePitch;

    let isEyeAway = false;
    let gazeDirection = '';
    const blendCategories = results?.faceBlendshapes?.[0]?.categories || [];
    if (blendCategories.length > 0) {
      const blendMap = new Map();
      for (let i = 0; i < blendCategories.length; i++) {
        blendMap.set(blendCategories[i].categoryName, blendCategories[i].score || 0);
      }
      const lookLeft = ((blendMap.get('eyeLookOutLeft') || 0) + (blendMap.get('eyeLookInRight') || 0)) / 2;
      const lookRight = ((blendMap.get('eyeLookInLeft') || 0) + (blendMap.get('eyeLookOutRight') || 0)) / 2;
      const lookDown = ((blendMap.get('eyeLookDownLeft') || 0) + (blendMap.get('eyeLookDownRight') || 0)) / 2;

      if (lookLeft > CONFIG.EYE_LOOK_SIDE_THRESHOLD) {
        isEyeAway = true;
        gazeDirection = 'left (secondary monitor)';
      } else if (lookRight > CONFIG.EYE_LOOK_SIDE_THRESHOLD) {
        isEyeAway = true;
        gazeDirection = 'right (secondary monitor)';
      } else if (lookDown > CONFIG.EYE_LOOK_DOWN_THRESHOLD) {
        isEyeAway = true;
        gazeDirection = 'downward (desk/phone)';
      }
    }

    const isHeadAway = Math.abs(yaw) > CONFIG.YAW_THRESHOLD_DEG || Math.abs(pitch) > CONFIG.PITCH_THRESHOLD_DEG;
    const isLookingAway = isHeadAway || isEyeAway;

    this.noseHistory.push({ x: pose.nose.x, y: pose.nose.y, t: now });
    if (this.noseHistory.length > 20) this.noseHistory.shift();
    if (this.noseHistory.length >= 20) {
      let varX = 0, varY = 0;
      const meanX = this.noseHistory.reduce((a, b) => a + b.x, 0) / 20;
      const meanY = this.noseHistory.reduce((a, b) => a + b.y, 0) / 20;
      for (const pt of this.noseHistory) {
        varX += (pt.x - meanX) ** 2;
        varY += (pt.y - meanY) ** 2;
      }
      if (varX + varY === 0) {
        if (!this.staticFrameStart) {
          this.staticFrameStart = now;
        } else if (now - this.staticFrameStart >= 6000) {
          this._pushEvent('FACE_MISSING', now - this.startTime, this.staticFrameStart, 6000, {
            reason: 'Static image or frozen video stream detected',
          });
          this.staticFrameStart = now;
        }
      } else {
        this.staticFrameStart = null;
      }
    }

    if (isLookingAway) {
      if (!this.lookAwayStart) {
        this.lookAwayStart = now;
        this.lookAwayT = now - this.startTime;
        this.activeMaxYaw = yaw;
        this.activeMaxPitch = pitch;
        this.activeGazeReason = isEyeAway && !isHeadAway
          ? `Sustained eye-gaze deviation (${gazeDirection})`
          : 'Head turned off-screen';
      } else {
        if (Math.abs(yaw) > Math.abs(this.activeMaxYaw)) this.activeMaxYaw = yaw;
        if (Math.abs(pitch) > Math.abs(this.activeMaxPitch)) this.activeMaxPitch = pitch;
      }
      this._emitHud(this.activeGazeReason || 'Looking away');
    } else if (this.lookAwayStart) {
      const dur = now - this.lookAwayStart;
      if (dur >= CONFIG.LOOK_AWAY_MIN_MS) {
        this._pushEvent('LOOK_AWAY', this.lookAwayT, this.lookAwayStart, dur, {
          yaw: Math.round(this.activeMaxYaw),
          pitch: Math.round(this.activeMaxPitch),
          reason: this.activeGazeReason || undefined,
        });
      }
      this.lookAwayStart = null;
      this.activeMaxYaw = 0;
      this.activeMaxPitch = 0;
      this.activeGazeReason = '';
      this._emitHud('Focused');
    } else {
      this._emitHud();
    }
  }

  _calculatePose(landmarks) {
    const nose = landmarks[1];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    const forehead = landmarks[10];
    const chin = landmarks[152];

    const midCheekX = (leftCheek.x + rightCheek.x) / 2;
    const cheekWidth = Math.abs(rightCheek.x - leftCheek.x);
    const yawRatio = cheekWidth > 0 ? (nose.x - midCheekX) / (cheekWidth / 2) : 0;
    const rawYaw = Math.asin(clamp(yawRatio, -1, 1)) * (180 / Math.PI);

    const midFaceY = (forehead.y + chin.y) / 2;
    const faceHeight = Math.abs(chin.y - forehead.y);
    const pitchRatio = faceHeight > 0 ? (nose.y - midFaceY) / (faceHeight / 2) : 0;
    const rawPitch = Math.asin(clamp(pitchRatio, -1, 1)) * (180 / Math.PI);

    return { rawYaw, rawPitch, nose };
  }

  _drawOverlay(results) {
    if (!this.ctx || !this.canvas || !this.video) return;

    const w = this.canvas.width = this.video.videoWidth || 640;
    const h = this.canvas.height = this.video.videoHeight || 480;

    this.ctx.clearRect(0, 0, w, h);

    const faces = results?.faceLandmarks || [];
    if (faces.length === 0) return;

    this.ctx.save();
    this.ctx.scale(-1, 1);
    this.ctx.translate(-w, 0);

    const landmarks = faces[0];
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const pt of landmarks) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    const padX = (maxX - minX) * 0.15;
    const padY = (maxY - minY) * 0.15;
    const boxX = clamp((minX - padX) * w, 0, w);
    const boxY = clamp((minY - padY) * h, 0, h);
    const boxW = clamp((maxX - minX + padX * 2) * w, 0, w - boxX);
    const boxH = clamp((maxY - minY + padY * 2) * h, 0, h - boxY);

    const isAway = !!this.lookAwayStart;
    const isMulti = faces.length >= 2;
    const strokeColor = isMulti ? '#ef4444' : isAway ? '#f59e0b' : '#10b981';

    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 2.5;
    const len = Math.min(boxW, boxH) * 0.2;

    this.ctx.beginPath();
    this.ctx.moveTo(boxX, boxY + len);
    this.ctx.lineTo(boxX, boxY);
    this.ctx.lineTo(boxX + len, boxY);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(boxX + boxW - len, boxY);
    this.ctx.lineTo(boxX + boxW, boxY);
    this.ctx.lineTo(boxX + boxW, boxY + len);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(boxX, boxY + boxH - len);
    this.ctx.lineTo(boxX, boxY + boxH);
    this.ctx.lineTo(boxX + len, boxY + boxH);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(boxX + boxW - len, boxY + boxH);
    this.ctx.lineTo(boxX + boxW, boxY + boxH);
    this.ctx.lineTo(boxX + boxW, boxY + boxH - len);
    this.ctx.stroke();

    const nose = landmarks[1];
    if (nose) {
      const pose = this._calculatePose(landmarks);
      const yaw = pose.rawYaw - this.baselineYaw;
      const pitch = pose.rawPitch - this.baselinePitch;

      const noseX = nose.x * w;
      const noseY = nose.y * h;
      const vectorLen = 45;
      const radYaw = (yaw * Math.PI) / 180;
      const radPitch = (pitch * Math.PI) / 180;

      const targetX = noseX + Math.sin(radYaw) * vectorLen;
      const targetY = noseY + Math.sin(radPitch) * vectorLen;

      this.ctx.beginPath();
      this.ctx.strokeStyle = isAway ? '#f59e0b' : '#10b98188';
      this.ctx.lineWidth = 2;
      this.ctx.moveTo(noseX, noseY);
      this.ctx.lineTo(targetX, targetY);
      this.ctx.stroke();

      this.ctx.fillStyle = strokeColor;
      this.ctx.beginPath();
      this.ctx.arc(noseX, noseY, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  _getLiveStats() {
    const totalMs = Math.max(1, Date.now() - (this.startTime || Date.now()));
    const lookAwayEvents = this.events.filter(e => e.type === 'LOOK_AWAY');
    const tabHiddenEvents = this.events.filter(e => e.type === 'TAB_HIDDEN');
    const multiFaceEvents = this.events.filter(e => e.type === 'MULTIPLE_FACES');
    const faceMissingEvents = this.events.filter(e => e.type === 'FACE_MISSING');

    const lookAwayMs = lookAwayEvents.reduce((a, b) => a + b.durationMs, 0);
    const tabHiddenMs = tabHiddenEvents.reduce((a, b) => a + b.durationMs, 0);
    const faceMissingMs = faceMissingEvents.reduce((a, b) => a + b.durationMs, 0);

    const onScreenPct = clamp(
      Math.round(100 * (1 - (lookAwayMs + tabHiddenMs + faceMissingMs) / totalMs)),
      0,
      100
    );

    return {
      onScreenPct,
      lookAwayCount: lookAwayEvents.length,
      tabHiddenCount: tabHiddenEvents.length,
      multiFaceCount: multiFaceEvents.length,
      lookAwayMs,
      tabHiddenMs,
      screenShareActive: !!this.screenStream,
    };
  }

  _emitHud(lastEvent = null) {
    const hudState = {
      vision: this.visionAvailable ? 'on' : 'unavailable',
      focus: this.lookAwayStart ? 'away' : 'ok',
      faces: this.multiFaceStart ? (this.activeMaxFaces || 2) : this.faceMissingStart ? 0 : 1,
      tab: this.tabHiddenStart ? 'hidden' : 'visible',
      screen: this.screenStream ? 'active' : 'off',
      lastEvent: lastEvent || (this.lookAwayStart ? 'Looking away' : this.tabHiddenStart ? 'Tab hidden' : 'All clear'),
      stats: this._getLiveStats(),
    };

    try {
      this.onChange(hudState);
    } catch (e) {
      console.error('[Candor HUD] Error in onChange handler', e);
    }
  }
}

export function renderIntegrity(el, integrity = {}, turns = []) {
  if (!el) return;
  const data = integrity || {};
  const stats = data.stats || {
    totalMs: 0, lookAwayMs: 0, lookAwayCount: 0, faceMissingMs: 0,
    multiFaceCount: 0, tabHiddenCount: 0, tabHiddenMs: 0, blurCount: 0, onScreenPct: 100
  };
  const events = Array.isArray(data.events) ? data.events : [];
  const riskLevel = (data.riskLevel || 'low').toLowerCase();
  const score = Number.isFinite(data.score) ? data.score : 100;
  const visionAvailable = data.visionAvailable !== false;

  const riskBadgeClass = riskLevel === 'high' ? 'risk-pill-high' : riskLevel === 'medium' ? 'risk-pill-medium' : 'risk-pill-low';
  const riskLabel = riskLevel === 'high' ? 'High Risk' : riskLevel === 'medium' ? 'Medium Risk' : 'Low Risk';

  el.innerHTML = `
    <div class="integrity-card">
      <div class="integrity-header">
        <h3>👁️ Interview Attention &amp; Integrity Dossier</h3>
        <span class="integrity-risk-badge ${riskBadgeClass}">${esc(riskLabel)} (${score}/100)</span>
      </div>
      <p style="font-size: 0.85rem; color: #94a3b8;">${events.length} telemetry episode(s) recorded during session.</p>
    </div>
  `;
}
