/**
 * Candor AI - Screen 3 (Pre-Device Hardware Calibration) Module
 * Handles webcam stream, microphone Web Audio API visualizer, speaker synthesis test,
 * device selection dropdowns, and session initialization via POST /api/start-interview.
 */

let mediaStream = null;
let audioContext = null;
let analyserNode = null;
let animFrameId = null;

// Hardware status flags
const hardwareState = {
  camera: false,
  mic: false,
  speech: false
};

export async function initPreflight() {
  const cameraSelect = document.getElementById('camera-select');
  const micSelect = document.getElementById('mic-select');
  const audioOutSelect = document.getElementById('audio-out-select');

  const testSpeakerBtn = document.getElementById('btn-test-speaker');
  const enterRoomBtn = document.getElementById('btn-enter-room');

  // Check browser Speech AI support upfront
  checkSpeechSupport();

  // Request initial media devices and setup feeds
  await startMediaDevices();

  // Enumerate hardware devices and populate select dropdowns
  await populateDeviceDropdowns();

  // Device Change Handlers
  if (cameraSelect) {
    cameraSelect.addEventListener('change', () => switchDevice());
  }

  if (micSelect) {
    micSelect.addEventListener('change', () => switchDevice());
  }

  if (audioOutSelect && 'setSinkId' in HTMLAudioElement.prototype) {
    audioOutSelect.addEventListener('change', async (e) => {
      const videoEl = document.getElementById('preview-video');
      if (videoEl && e.target.value) {
        try {
          await videoEl.setSinkId(e.target.value);
        } catch (err) {
          console.warn('Could not set audio sink ID:', err);
        }
      }
    });
  }

  // Speaker Test Button
  if (testSpeakerBtn) {
    testSpeakerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      runSpeakerAudioCheck();
    });
  }

  // Enter Live Room Action Button
  if (enterRoomBtn) {
    enterRoomBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await launchInterviewSession(enterRoomBtn);
    });
  }

  // API Health check
  checkApiHealth();
}

/**
 * Request getUserMedia stream and initialize video + Web Audio meter
 */
async function startMediaDevices(videoDeviceId = null, audioDeviceId = null) {
  const videoEl = document.getElementById('preview-video');
  const videoPlaceholder = document.getElementById('video-placeholder');

  const constraints = {
    video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
    audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true
  };

  // Stop previous stream if active
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

    if (videoEl) {
      videoEl.srcObject = mediaStream;
      videoEl.style.display = 'block';
      if (videoPlaceholder) videoPlaceholder.style.display = 'none';
    }

    hardwareState.camera = true;
    updateStatusChip('chip-camera', 'chip-success', '📷 Camera: Active');

    // Setup Web Audio API volume meter
    setupAudioAnalyser(mediaStream);

  } catch (err) {
    console.warn('getUserMedia error:', err);
    hardwareState.camera = false;
    hardwareState.mic = false;

    if (videoEl) videoEl.style.display = 'none';
    if (videoPlaceholder) videoPlaceholder.style.display = 'flex';

    updateStatusChip('chip-camera', 'chip-warning', '📷 Camera: Denied/Off');
    updateStatusChip('chip-mic', 'chip-warning', '🎙️ Mic: Denied/Off');
  }
}

/**
 * Enumerate available input/output devices for dropdowns
 */
async function populateDeviceDropdowns() {
  const cameraSelect = document.getElementById('camera-select');
  const micSelect = document.getElementById('mic-select');
  const audioOutSelect = document.getElementById('audio-out-select');

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();

    if (cameraSelect) {
      cameraSelect.innerHTML = '';
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      if (videoDevices.length === 0) {
        cameraSelect.innerHTML = '<option value="">No Camera Found</option>';
      } else {
        videoDevices.forEach((device, index) => {
          const opt = document.createElement('option');
          opt.value = device.deviceId;
          opt.textContent = device.label || `Camera ${index + 1}`;
          cameraSelect.appendChild(opt);
        });
      }
    }

    if (micSelect) {
      micSelect.innerHTML = '';
      const audioDevices = devices.filter((d) => d.kind === 'audioinput');
      if (audioDevices.length === 0) {
        micSelect.innerHTML = '<option value="">No Microphone Found</option>';
      } else {
        audioDevices.forEach((device, index) => {
          const opt = document.createElement('option');
          opt.value = device.deviceId;
          opt.textContent = device.label || `Microphone ${index + 1}`;
          micSelect.appendChild(opt);
        });
      }
    }

    if (audioOutSelect) {
      audioOutSelect.innerHTML = '';
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');
      if (audioOutputs.length === 0) {
        audioOutSelect.innerHTML = '<option value="">Default System Speakers</option>';
      } else {
        audioOutputs.forEach((device, index) => {
          const opt = document.createElement('option');
          opt.value = device.deviceId;
          opt.textContent = device.label || `Speaker ${index + 1}`;
          audioOutSelect.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.warn('enumerateDevices error:', err);
  }
}

/**
 * Switch devices based on dropdown selection
 */
async function switchDevice() {
  const cameraSelect = document.getElementById('camera-select');
  const micSelect = document.getElementById('mic-select');

  const videoId = cameraSelect ? cameraSelect.value : null;
  const audioId = micSelect ? micSelect.value : null;

  await startMediaDevices(videoId, audioId);
}

/**
 * Setup Web Audio API volume meter for real-time mic bar animation
 */
function setupAudioAnalyser(stream) {
  const audioTrack = stream.getAudioTracks()[0];
  if (!audioTrack) {
    updateStatusChip('chip-mic', 'chip-warning', '🎙️ Mic: No Audio');
    return;
  }

  try {
    if (audioContext) {
      audioContext.close();
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
    const sourceNode = audioContext.createMediaStreamSource(stream);
    analyserNode = audioContext.createAnalyser();

    analyserNode.fftSize = 256;
    sourceNode.connect(analyserNode);

    hardwareState.mic = true;
    updateStatusChip('chip-mic', 'chip-success', '🎙️ Mic: Connected');

    updateVolumeMeter();

  } catch (err) {
    console.warn('AudioContext setup failed:', err);
    updateStatusChip('chip-mic', 'chip-warning', '🎙️ Mic: Error');
  }
}

/**
 * RAF loop calculating mic RMS volume level and updating UI bar
 */
function updateVolumeMeter() {
  if (!analyserNode) return;

  const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
  analyserNode.getByteFrequencyData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  const average = sum / dataArray.length;
  const volumePct = Math.min(100, Math.round((average / 128) * 100));

  const volumeFill = document.getElementById('volume-level-bar');
  const volumeText = document.getElementById('volume-text');

  if (volumeFill) {
    volumeFill.style.width = `${volumePct}%`;
  }
  if (volumeText) {
    volumeText.textContent = `${volumePct}%`;
  }

  animFrameId = requestAnimationFrame(updateVolumeMeter);
}

/**
 * Check browser SpeechRecognition API support
 */
function checkSpeechSupport() {
  const hasSpeech = ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
  hardwareState.speech = hasSpeech;

  if (hasSpeech) {
    updateStatusChip('chip-speech', 'chip-success', '🗣️ Speech AI: Ready');
  } else {
    updateStatusChip('chip-speech', 'chip-warning', '🗣️ Speech AI: Typed Mode');
  }
}

/**
 * Update UI status chip style and label
 */
function updateStatusChip(elementId, stateClass, textContent) {
  const chip = document.getElementById(elementId);
  if (!chip) return;

  chip.className = `status-chip ${stateClass}`;
  chip.innerHTML = `<span>${textContent}</span>`;
}

/**
 * Run speaker audio test playing chime tone and TTS phrase
 */
function runSpeakerAudioCheck() {
  const statusEl = document.getElementById('speaker-test-status');
  if (statusEl) statusEl.textContent = '🔊 Playing test chime & voice...';

  // Play synthetic Web Audio chime tone
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5 tone
    osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.3); // E5 tone

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);

  } catch (err) {
    console.warn('Audio tone test error:', err);
  }

  // Synthesize Speech Utterance
  if ('speechSynthesis' in window) {
    const phrase = new SpeechSynthesisUtterance("Hardware audio check complete. Your speakers and speech synthesis are working properly.");
    phrase.rate = 1.0;
    phrase.pitch = 1.0;
    phrase.onend = () => {
      if (statusEl) statusEl.textContent = '✓ Audio & Voice Test Passed!';
    };
    window.speechSynthesis.speak(phrase);
  } else {
    if (statusEl) statusEl.textContent = '✓ Tone Check Passed!';
  }
}

/**
 * Start Interview Session via POST /api/start-interview and navigate to room.html
 */
async function launchInterviewSession(buttonEl) {
  let candidate = null;
  try {
    const stored = localStorage.getItem('candor_current_candidate');
    if (stored) candidate = JSON.parse(stored);
  } catch (err) {
    console.warn('Failed reading candidate state:', err);
  }

  if (!candidate) {
    candidate = {
      name: 'Sarah Jenkins',
      role: 'Senior Frontend Engineer',
      jobDescription: 'Expertise in modern JavaScript, Web Audio API, and UI design.',
      resumeText: 'Sarah Jenkins - Senior Frontend Architect with 6+ years experience.',
      questionCount: 4
    };
  }

  // Set loading state on button
  buttonEl.disabled = true;
  buttonEl.innerHTML = `
    <span class="status-dot" style="background: #fff;"></span>
    Creating AI Interview Session...
  `;

  try {
    const res = await fetch('/api/start-interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateName: candidate.name,
        role: candidate.role,
        jobDescription: candidate.jobDescription,
        resumeText: candidate.resumeText,
        questionCount: 4
      })
    });

    if (res.ok) {
      const session = await res.json();
      // Store session details in localStorage for room initialization
      localStorage.setItem('candor_active_session', JSON.stringify(session));
      window.location.href = `room.html?id=${session.id}`;
      return;
    }
  } catch (err) {
    console.warn('API start-interview failed, falling back to client mode:', err);
  }

  // Fallback redirect if API unreachable
  window.location.href = 'room.html?id=demo-session';
}

/**
 * API Health Check helper
 */
async function checkApiHealth() {
  const statusChip = document.getElementById('api-health-chip');
  if (!statusChip) return;

  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      statusChip.innerHTML = `<span class="status-dot"></span> Server API Online (${data.llm || 'Live'})`;
    } else {
      statusChip.innerHTML = `<span class="status-dot" style="background-color: var(--warning);"></span> Server API Offline`;
    }
  } catch (err) {
    statusChip.innerHTML = `<span class="status-dot" style="background-color: var(--warning);"></span> Offline Engine Mode`;
  }
}

document.addEventListener('DOMContentLoaded', initPreflight);
