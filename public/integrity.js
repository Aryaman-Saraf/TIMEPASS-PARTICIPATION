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

    // 2. Initialize MediaPipe Vision if camera enabled
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

  /**
   * Attaches an existing desktop screen stream and wires up anti-tamper monitoring.
   * @param {MediaStream} stream
   * @returns {boolean}
   */
  attachScreenStream(stream) {
    if (!stream) return false;
    this.screenStream = stream;
    const track = this.screenStream.getVideoTracks ? this.screenStream.getVideoTracks()[0] : null;
    if (track) {
      this.screenShareActive = true;
      const settings = track.getSettings ? track.getSettings() : {};
      const surface = settings.displaySurface || 'monitor';

      // Anomaly: Candidate clicked "Stop sharing" on the floating Chrome bar
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
    return false;
  }

  /**
   * Prompts candidate for desktop screen sharing and monitors anti-tampering.
   * @returns {Promise<boolean>}
   */
  async startScreenShare() {
    if (this.screenStream) {
      return true;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      });
      return this.attachScreenStream(stream);
    } catch (err) {
      console.warn('[Candor Screen] Screen share declined or failed', err);
      const now = Date.now();
      this._pushEvent('WINDOW_BLUR', now - (this.startTime || now), now - 1000, 1000, {
        reason: 'Desktop screen sharing declined by candidate',
      });
      return false;
    }
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

  /**
   * Stop monitoring, flush any in-progress episodes, remove listeners, and return summary payload.
   * @returns {{ totalMs: number, visionAvailable: boolean, screenShareActive: boolean, events: Array }}
   */
  stop() {
    this.running = false;

    if (this.rafId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Stop active screen share tracks
    if (this.screenStream) {
      try {
        this.screenStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      this.screenStream = null;
    }

    // Remove window & document event listeners
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

    // Flush any pending active episodes upon session stop
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

    // Clear canvas
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

  // -------------------------------------------------------------
  // Internal Event & State Handlers
  // -------------------------------------------------------------

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
    // If document is already marked hidden, tab switch takes precedence
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
    // Intercept F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
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

  // -------------------------------------------------------------
  // Vision Loop & Landmark Processing
  // -------------------------------------------------------------

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
          } catch (e) {
            // Ignore intermittent single-frame pipeline glitches
          }
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

    // 1. Multiple faces check
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

    // 2. Face missing check
    if (faceCount === 0) {
      // Pause/cancel look-away while face is missing to prevent false double-counting
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

    // 3. Head pose tracking on primary face (Face 0)
    const landmarks = faces[0];
    const pose = this._calculatePose(landmarks);

    // Initial 2-second calibration baseline
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

    // 4. Eye-Gaze Deviation Detection (Secondary monitor / off-screen reading)
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

    // 5. Micro-motion liveness check (Anti-freeze / anti-photo spoof)
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
      // Real human webcams always have sensor micro-noise (var > 0)
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
    // Nose tip (1), Cheeks (234 left, 454 right), Forehead (10), Chin (152)
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

    // Draw in mirrored space to match candidate video mirroring
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

    // HUD Corner brackets around face
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 2.5;
    const len = Math.min(boxW, boxH) * 0.2;

    // Top-left
    this.ctx.beginPath();
    this.ctx.moveTo(boxX, boxY + len);
    this.ctx.lineTo(boxX, boxY);
    this.ctx.lineTo(boxX + len, boxY);
    this.ctx.stroke();

    // Top-right
    this.ctx.beginPath();
    this.ctx.moveTo(boxX + boxW - len, boxY);
    this.ctx.lineTo(boxX + boxW, boxY);
    this.ctx.lineTo(boxX + boxW, boxY + len);
    this.ctx.stroke();

    // Bottom-left
    this.ctx.beginPath();
    this.ctx.moveTo(boxX, boxY + boxH - len);
    this.ctx.lineTo(boxX, boxY + boxH);
    this.ctx.lineTo(boxX + len, boxY + boxH);
    this.ctx.stroke();

    // Bottom-right
    this.ctx.beginPath();
    this.ctx.moveTo(boxX + boxW - len, boxY + boxH);
    this.ctx.lineTo(boxX + boxW, boxY + boxH);
    this.ctx.lineTo(boxX + boxW, boxY + boxH - len);
    this.ctx.stroke();

    // Gaze direction vector from nose tip
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

      // Dot at nose
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

// -------------------------------------------------------------
// Recruiter Report UI Renderer (renderIntegrity)
// -------------------------------------------------------------

/**
 * Renders the Integrity & Attention Analysis section on recruiter report page.
 * @param {HTMLElement} el - Container element (e.g. document.getElementById('integrity'))
 * @param {Object} integrity - IntegrityReport object from server
 * @param {Array} turns - Array of interview turns from session
 */
export function renderIntegrity(el, integrity = {}, turns = []) {
  if (!el) return;

  const data = integrity || {};
  const stats = data.stats || {
    totalMs: 0,
    lookAwayMs: 0,
    lookAwayCount: 0,
    faceMissingMs: 0,
    multiFaceCount: 0,
    tabHiddenCount: 0,
    tabHiddenMs: 0,
    blurCount: 0,
    onScreenPct: 100,
  };

  const events = Array.isArray(data.events) ? data.events : [];
  const riskLevel = (data.riskLevel || 'low').toLowerCase();
  const score = Number.isFinite(data.score) ? data.score : 100;
  const visionAvailable = data.visionAvailable !== false;

  const riskBadgeClass =
    riskLevel === 'high' ? 'risk-pill-high' :
    riskLevel === 'medium' ? 'risk-pill-medium' :
    'risk-pill-low';

  const riskLabel =
    riskLevel === 'high' ? 'High Risk' :
    riskLevel === 'medium' ? 'Medium Risk' :
    'Low Risk';

  // Helper to find the active question and whether the event occurred during candidate answering
  function getTurnContext(event) {
    const eventTime = event.at ? new Date(event.at).getTime() : 0;
    if (!eventTime || !Array.isArray(turns) || turns.length === 0) {
      return { qText: 'Session Active', duringAnswer: false };
    }

    // Find the latest AI turn before or at event time
    let activeAiTurn = null;
    let activeAiTurnIndex = -1;
    let nextCandidateTurn = null;

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      const turnTime = turn.t || 0;
      if (turn.role === 'ai' && turnTime <= eventTime) {
        activeAiTurn = turn;
        activeAiTurnIndex = i;
        // Check if there is a corresponding candidate response turn
        const next = turns[i + 1];
        if (next && next.role === 'candidate' && (next.t || 0) >= eventTime) {
          nextCandidateTurn = next;
        }
      }
    }

    if (!activeAiTurn) {
      return { qText: 'Opening / Pre-question', turnIndex: -1, duringAnswer: false };
    }

    const qNum = (activeAiTurn.qIndex !== undefined ? activeAiTurn.qIndex + 1 : '?');
    const comp = activeAiTurn.competency || activeAiTurn.kind || 'General';
    return {
      qText: `Q${qNum} · ${comp}`,
      turnIndex: activeAiTurnIndex,
      duringAnswer: !!nextCandidateTurn,
    };
  }

  // Generate audit rows
  const eventRowsHtml = events.length === 0
    ? `<tr><td colspan="6" class="integrity-empty-row">✨ No attention anomalies or tab switches were logged. Excellent candidate focus throughout.</td></tr>`
    : events.map(e => {
        const ctx = getTurnContext(e);
        const sevClass =
          e.severity === 'high' ? 'sev-pill-high' :
          e.severity === 'warn' ? 'sev-pill-warn' :
          'sev-pill-info';

        const typeBadge =
          e.type === 'TAB_HIDDEN' ? `<span class="event-tag tag-tab">🗂️ Tab Switch</span>` :
          e.type === 'WINDOW_BLUR' ? `<span class="event-tag tag-blur">🪟 Window Blur</span>` :
          e.type === 'LOOK_AWAY' ? `<span class="event-tag tag-look">👀 Look Away</span>` :
          e.type === 'FACE_MISSING' ? `<span class="event-tag tag-missing">👤 Face Missing</span>` :
          `<span class="event-tag tag-multi">👥 Multiple Faces</span>`;

        let detailText = '';
        if (e.detail) {
          if (e.detail.count) detailText = `${e.detail.count} faces detected`;
          else if (Number.isFinite(e.detail.yaw) || Number.isFinite(e.detail.pitch)) {
            const y = e.detail.yaw !== undefined ? `${e.detail.yaw > 0 ? '+' : ''}${e.detail.yaw}°` : '0°';
            const p = e.detail.pitch !== undefined ? `${e.detail.pitch > 0 ? '+' : ''}${e.detail.pitch}°` : '0°';
            detailText = `Yaw: ${y}, Pitch: ${p}`;
          } else if (e.detail.reason) {
            detailText = e.detail.reason;
          }
        }

        const duringAnswerBadge = ctx.duringAnswer
          ? `<span class="during-answer-pill" title="Event occurred while candidate was formulating or speaking their answer">⚡ During Answer</span>`
          : '';

        const contextHtml = ctx.turnIndex >= 0
          ? `<a href="#turn-${ctx.turnIndex}" class="q-context-link" title="Jump to transcript question">${esc(ctx.qText)}</a>`
          : `<span class="q-context">${esc(ctx.qText)}</span>`;

        return `
          <tr>
            <td class="font-mono">${esc(formatOffset(e.t))}</td>
            <td>${typeBadge}</td>
            <td class="font-mono">${esc(formatDuration(e.durationMs))}</td>
            <td><span class="sev-pill ${sevClass}">${esc((e.severity || 'info').toUpperCase())}</span></td>
            <td>
              ${contextHtml}
              ${duringAnswerBadge}
            </td>
            <td class="text-muted text-sm">${esc(detailText || '—')}</td>
          </tr>
        `;
      }).join('');

  // Ensure scoped CSS styles are present
  if (typeof document !== 'undefined' && !document.getElementById('candor-integrity-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'candor-integrity-styles';
    styleEl.textContent = `
      .integrity-card {
        background: var(--surface, #1e222b);
        border: 1px solid var(--border, #2d3343);
        border-radius: 12px;
        padding: 1.5rem;
        margin: 1.5rem 0;
        color: var(--text, #e2e8f0);
      }
      .integrity-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
        margin-bottom: 1.25rem;
      }
      .integrity-title-group h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #fff;
      }
      .integrity-subtitle {
        margin: 0.25rem 0 0;
        font-size: 0.85rem;
        color: #94a3b8;
      }
      .integrity-score-group {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .integrity-risk-badge {
        padding: 0.35rem 0.85rem;
        border-radius: 9999px;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .risk-pill-low {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      .risk-pill-medium {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.3);
      }
      .risk-pill-high {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }
      .integrity-score-pill {
        font-size: 1rem;
        font-weight: 700;
        background: #0f172a;
        padding: 0.35rem 0.85rem;
        border-radius: 8px;
        border: 1px solid #334155;
        color: #f8fafc;
      }
      .integrity-ethics-banner {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.25);
        border-radius: 8px;
        padding: 0.85rem 1rem;
        margin-bottom: 1.25rem;
        font-size: 0.85rem;
        line-height: 1.45;
        color: #cbd5e1;
      }
      .integrity-notice-banner {
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.25);
        border-radius: 8px;
        padding: 0.75rem 1rem;
        margin-bottom: 1.25rem;
        font-size: 0.85rem;
        color: #fcd34d;
      }
      .integrity-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .stat-tile {
        background: #111827;
        border: 1px solid #1f2937;
        border-radius: 8px;
        padding: 1rem;
      }
      .stat-tile-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        margin-bottom: 0.4rem;
      }
      .stat-tile-value {
        font-size: 1.75rem;
        font-weight: 700;
        color: #f8fafc;
        line-height: 1.1;
        margin-bottom: 0.35rem;
      }
      .stat-tile-sub {
        font-size: 0.75rem;
        color: #64748b;
      }
      .text-green { color: #34d399; }
      .text-amber { color: #fbbf24; }
      .text-red { color: #f87171; }
      .text-muted { color: #64748b; }
      .integrity-table-container {
        overflow-x: auto;
      }
      .integrity-table-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
      }
      .integrity-table-header h4 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #e2e8f0;
      }
      .integrity-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }
      .integrity-table th, .integrity-table td {
        padding: 0.75rem;
        text-align: left;
        border-bottom: 1px solid #1f2937;
      }
      .integrity-table th {
        color: #94a3b8;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: #111827;
      }
      .event-tag {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.2rem 0.55rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 500;
      }
      .tag-tab { background: #3730a3; color: #c7d2fe; }
      .tag-blur { background: #1e3a5f; color: #93c5fd; }
      .tag-look { background: #78350f; color: #fde68a; }
      .tag-missing { background: #4c1d95; color: #ddd6fe; }
      .tag-multi { background: #831843; color: #fbcfe8; }
      .sev-pill {
        padding: 0.15rem 0.45rem;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 600;
      }
      .sev-pill-info { background: #1e293b; color: #94a3b8; }
      .sev-pill-warn { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
      .sev-pill-high { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
      .during-answer-pill {
        margin-left: 0.5rem;
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.3);
        padding: 0.15rem 0.45rem;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 600;
      }
      .q-context-link {
        color: var(--accent, #6c8cff);
        text-decoration: none;
        font-weight: 500;
      }
      .q-context-link:hover {
        text-decoration: underline;
      }
      .integrity-screen-badge {
        padding: 0.35rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        background: rgba(108, 140, 255, 0.15);
        color: #93c5fd;
        border: 1px solid rgba(108, 140, 255, 0.3);
      }
      .font-mono { font-family: monospace; }
      .integrity-empty-row {
        text-align: center;
        color: #94a3b8;
        padding: 2rem !important;
      }
    `;
    document.head.appendChild(styleEl);
  }

  const hasScreenShare = data.screenShareActive || stats.screenShareActive || events.some(e => String(e.detail?.reason || '').toLowerCase().includes('screen share'));

  el.innerHTML = `
    <div class="integrity-card">
      <div class="integrity-header">
        <div class="integrity-title-group">
          <h3>👁️ Interview Attention &amp; Integrity Dossier</h3>
          <p class="integrity-subtitle">Real-time on-device posture, gaze, and application focus telemetry</p>
        </div>
        <div class="integrity-score-group">
          ${hasScreenShare ? '<span class="integrity-screen-badge">🖥️ Desktop Screen Monitored</span>' : ''}
          <span class="integrity-risk-badge ${riskBadgeClass}">${esc(riskLabel)}</span>
          <span class="integrity-score-pill">${esc(score)} / 100</span>
        </div>
      </div>

      <!-- Ethical Notice Banner -->
      <div class="integrity-ethics-banner">
        <span class="ethics-icon">⚖️</span>
        <div class="ethics-text">
          <strong>Decision-Support Context, Not Proof:</strong>
          Candidate attention telemetry provides objective environmental observations for human recruiters.
          To guarantee fairness and eliminate disability/hardware bias, <em>this telemetry is never factored into the AI hire score</em>.
        </div>
      </div>

      ${
        !visionAvailable
          ? `<div class="integrity-notice-banner">
               📷 <strong>Camera Disabled / Vision Unavailable:</strong> Camera was not available; only tab switching and window focus were monitored.
             </div>`
          : ''
      }

      <!-- 4 Core Metric Tiles -->
      <div class="integrity-stats-grid">
        <div class="stat-tile">
          <div class="stat-tile-label">Integrity Confidence</div>
          <div class="stat-tile-value ${visionAvailable ? (stats.onScreenPct >= 90 ? 'text-green' : stats.onScreenPct >= 70 ? 'text-amber' : 'text-red') : 'text-muted'}">
            ${visionAvailable ? esc(stats.onScreenPct) + '%' : 'n/a'}
          </div>
          <div class="stat-tile-sub">${visionAvailable ? 'Active on-screen focus' : 'Vision tracking disabled'}</div>
        </div>

        <div class="stat-tile">
          <div class="stat-tile-label">Look-Aways</div>
          <div class="stat-tile-value">${esc(stats.lookAwayCount)}</div>
          <div class="stat-tile-sub">${esc(formatDuration(stats.lookAwayMs))} total duration</div>
        </div>

        <div class="stat-tile">
          <div class="stat-tile-label">Tab Switches</div>
          <div class="stat-tile-value ${stats.tabHiddenCount > 0 ? 'text-amber' : ''}">
            ${esc(stats.tabHiddenCount)}
          </div>
          <div class="stat-tile-sub">${esc(formatDuration(stats.tabHiddenMs))} background time</div>
        </div>

        <div class="stat-tile">
          <div class="stat-tile-label">Multiple Faces</div>
          <div class="stat-tile-value ${stats.multiFaceCount > 0 ? 'text-red' : ''}">
            ${esc(stats.multiFaceCount)}
          </div>
          <div class="stat-tile-sub">Secondary presence detected</div>
        </div>
      </div>

      <!-- Audit Event Log Table -->
      <div class="integrity-table-container">
        <div class="integrity-table-header">
          <h4>Timestamped Telemetry Log (${events.length} episode${events.length === 1 ? '' : 's'})</h4>
          <span class="text-xs text-muted">Client-side verified</span>
        </div>
        <table class="integrity-table">
          <thead>
            <tr>
              <th>Offset</th>
              <th>Telemetry Event</th>
              <th>Duration</th>
              <th>Severity</th>
              <th>Context</th>
              <th>Observation Details</th>
            </tr>
          </thead>
          <tbody>
            ${eventRowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
