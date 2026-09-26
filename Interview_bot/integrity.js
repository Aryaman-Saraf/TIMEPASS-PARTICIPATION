import { FilesetResolver, FaceLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs';

export class IntegrityMonitor {
    constructor(video, canvas, hudContainer) {
        this.video = video;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.hud = hudContainer;
        this.events = [];
        this.isTabHidden = false;
        this.lastAudioAlertTime = 0;
        
        document.addEventListener('visibilitychange', () => {
            this.isTabHidden = document.hidden;
            if (this.isTabHidden) {
                this.logEvent('TAB_HIDDEN', 'Candidate switched tabs');
                this.triggerAudioWarning("Tab hidden warning. Please remain on the interview room tab.");
                this.updateHUD();
            } else {
                this.updateHUD();
            }
        });
    }

    triggerAudioWarning(message) {
        const now = Date.now();
        if (now - this.lastAudioAlertTime < 5000) return; // Cooldown 5s to avoid sound spam
        this.lastAudioAlertTime = now;

        // Sound Tone Warning
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(250, audioCtx.currentTime);
            osc.frequency.setValueAtTime(180, audioCtx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } catch(e) {}

        // Spoken Audio Alert
        if ('speechSynthesis' in window && message) {
            const utt = new SpeechSynthesisUtterance(message);
            utt.rate = 1.1;
            window.speechSynthesis.speak(utt);
        }
    }

    logEvent(type, reason) {
        console.warn(`Integrity Alert: ${type} - ${reason}`);
        this.events.push({ type, time: new Date().toLocaleTimeString(), reason });
        localStorage.setItem('candor_events', JSON.stringify(this.events));
    }

    updateHUD(faceCount = 1, isLookingAway = false) {
        this.hud.innerHTML = '';
        if (this.isTabHidden) {
            this.hud.innerHTML += `<div class="chip chip-danger">⚠️ Tab Hidden!</div>`;
        }
        if (faceCount === 0) {
            this.hud.innerHTML += `<div class="chip chip-danger">👤 Face Missing</div>`;
        } else if (faceCount > 1) {
            this.hud.innerHTML += `<div class="chip chip-danger">👥 Multiple Faces Detected (${faceCount})</div>`;
        }
        if (isLookingAway) {
            this.hud.innerHTML += `<div class="chip chip-warning">👀 Eyes Darting / Off-Screen</div>`;
        }
    }

    async start() {
        try {
            const fileset = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
            this.lm = await FaceLandmarker.createFromOptions(fileset, {
                baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate: 'GPU' },
                runningMode: 'VIDEO', 
                numFaces: 2,
                outputFaceBlendshapes: true
            });
            console.log("MediaPipe FaceLandmarker Loaded");
            localStorage.removeItem('candor_events');
            this.loop();
        } catch (e) {
            console.error("Vision unavailable", e);
            this.hud.innerHTML = `<div class="chip chip-warning">Vision API Unavailable</div>`;
        }
    }

    loop() {
        if (!this.video.videoWidth) {
            requestAnimationFrame(() => this.loop());
            return;
        }
        
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        const results = this.lm.detectForVideo(this.video, performance.now());
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        let faceCount = results.faceLandmarks ? results.faceLandmarks.length : 0;
        let isLookingAway = false;

        // Interactive High-Tech Cyan/Blue Face Mesh Overlay
        if (faceCount > 0) {
            for (const landmarks of results.faceLandmarks) {
                this.ctx.fillStyle = 'rgba(6, 182, 212, 0.6)'; // Cyan mesh dots
                for (const pt of landmarks) {
                    this.ctx.beginPath();
                    this.ctx.arc(pt.x * this.canvas.width, pt.y * this.canvas.height, 1, 0, 2 * Math.PI);
                    this.ctx.fill();
                }
            }
        }

        // Eye Gaze Tracking via Blendshapes
        if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
            const shapes = results.faceBlendshapes[0].categories;
            const lookOutLeft = shapes.find(s => s.categoryName === 'eyeLookOutLeft')?.score || 0;
            const lookInLeft = shapes.find(s => s.categoryName === 'eyeLookInLeft')?.score || 0;
            const lookUpLeft = shapes.find(s => s.categoryName === 'eyeLookUpLeft')?.score || 0;

            if (lookOutLeft > 0.6 || lookInLeft > 0.6 || lookUpLeft > 0.6) {
                isLookingAway = true;
                if (Math.random() < 0.03) {
                    this.logEvent('EYE_GAZE_AWAY', 'Candidate looking away from screen');
                    this.triggerAudioWarning("Please maintain eye contact with the interview screen.");
                }
            }
        }

        if (faceCount > 1) {
            if (Math.random() < 0.04) {
                this.logEvent('MULTIPLE_FACES', `Detected ${faceCount} people in frame`);
                this.triggerAudioWarning("Multiple people detected in interview frame.");
            }
        } else if (faceCount === 0) {
            if (Math.random() < 0.04) {
                this.logEvent('FACE_MISSING', 'Candidate left camera frame');
                this.triggerAudioWarning("Camera vision lost. Please return to the frame.");
            }
        }

        this.updateHUD(faceCount, isLookingAway);
        requestAnimationFrame(() => this.loop());
    }
}
