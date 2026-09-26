/**
 * Candor AI - Screen 4 (Live Interview Room) ES Module
 * Handles Ava's Voice TTS, STT Speech Loop, Web Audio Frequency Visualizer,
 * MediaPipe Attention HUD Integration, and Session Evaluation.
 */

import { IntegrityMonitor } from './integrity.js';

let activeSession = null;
let monitor = null;
let recognition = null;
let audioContext = null;
let analyserNode = null;
let waveRafId = null;

let isMuted = false;
let silenceTimer = null;
let timerInterval = null;
let startTimeEpoch = Date.now();
let isTurnBusy = false;
let currentInterimText = '';

export async function initRoom() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('id');

  // Load session from localStorage or fetch from API
  activeSession = await loadSession(sessionId);

  // Initialize UI Text
  updateSessionMetaUI(activeSession);

  // Start Camera & Audio Streams
  await initMediaStreams();

  // Initialize MediaPipe Attention Monitor (T3 Integration)
  initIntegrityMonitor();

  // Initialize Web Speech Recognition (STT)
  initSpeechRecognition();

  // Wire Button Event Listeners
  setupEventListeners();

  // Start Interview Timer
  startInterviewTimer();

  // Begin Spoken Opening Turn
  const openingText = (activeSession.turns && activeSession.turns.length > 0)
    ? activeSession.turns[0].text
    : `Hello ${activeSession.candidateName || 'Candidate'}! I'm Ava. Let's begin with your first technical question.`;

  // Append opening turn to transcript
  appendChatBubble('ai', 'Ava (AI Interviewer)', openingText);

  // Speak opening phrase
  say(openingText);

  // Check API Health
  checkApiHealth();
}

/**
 * Load or recover session object
 */
async function loadSession(sessionId) {
  if (sessionId) {
    try {
      const res = await fetch(`/api/session?id=${sessionId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Could not fetch session from API:', err);
    }
  }

  // Fallback to localStorage or default seed session
  try {
    const stored = localStorage.getItem('candor_active_session');
    if (stored) return JSON.parse(stored);
  } catch (e) {}

  return {
    id: `sess-${Date.now()}`,
    candidateName: 'Sarah Jenkins',
    role: 'Senior Frontend Engineer',
    questionCount: 4,
    cursor: 0,
    difficulty: 3,
    turns: []
  };
}

/**
 * Update Progress Bar and Role Headers
 */
function updateSessionMetaUI(session) {
  const progressPill = document.getElementById('room-progress-pill');
  if (progressPill) {
    const qNum = (session.cursor !== undefined ? session.cursor + 1 : 1);
    const total = session.questionCount || 4;
    const role = session.role || 'Senior Software Engineer';
    progressPill.textContent = `Q${qNum} of ${total} · ${role}`;
  }
}

/**
 * Request getUserMedia video + audio streams and setup Waveform Visualizer
 */
async function initMediaStreams() {
  const videoEl = document.getElementById('cam');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (videoEl) {
      videoEl.srcObject = stream;
    }
    setupAudioWaveform(stream);
  } catch (err) {
    console.warn('getUserMedia error in room:', err);
  }
}

/**
 * Instantiate Suryansh's IntegrityMonitor class and bind Attention HUD
 */
function initIntegrityMonitor() {
  const videoEl = document.getElementById('cam');
  const canvasEl = document.getElementById('overlay');

  monitor = new IntegrityMonitor(videoEl, canvasEl, (hud) => {
    updateHUD(hud);
  });

  // Start monitoring with camera
  monitor.start(true, false);
}

/**
 * Update Attention HUD Badges
 */
function updateHUD(hud) {
  const visionBadge = document.getElementById('hud-vision');
  const focusBadge = document.getElementById('hud-focus');
  const facesBadge = document.getElementById('hud-faces');
  const onScreenBadge = document.getElementById('hud-onscreen');

  if (visionBadge) {
    visionBadge.className = `hud-badge ${hud.vision === 'on' ? 'hud-ok' : 'hud-warn'}`;
    visionBadge.textContent = `👁️ Vision: ${hud.vision === 'on' ? 'Active' : 'Unavailable'}`;
  }

  if (focusBadge) {
    const isOk = hud.focus === 'ok';
    focusBadge.className = `hud-badge ${isOk ? 'hud-ok' : 'hud-warn'}`;
    focusBadge.textContent = `🎯 Focus: ${isOk ? 'Centered' : 'Looking Away'}`;
  }

  if (facesBadge) {
    const count = hud.faces;
    const isOk = count === 1;
    facesBadge.className = `hud-badge ${isOk ? 'hud-ok' : count === 0 ? 'hud-warn' : 'hud-danger'}`;
    facesBadge.textContent = `👤 ${count} Face${count === 1 ? '' : 's'} Verified`;
  }

  if (onScreenBadge && hud.stats) {
    const pct = hud.stats.onScreenPct || 100;
    const isOk = pct >= 85;
    onScreenBadge.className = `hud-badge ${isOk ? 'hud-ok' : 'hud-warn'}`;
    onScreenBadge.textContent = `📊 On-Screen: ${pct}%`;
  }
}

/**
 * Web Audio API Frequency Waveform Renderer
 */
function setupAudioWaveform(stream) {
  const waveCanvas = document.getElementById('audio-wave');
  if (!waveCanvas) return;
  const ctx = waveCanvas.getContext('2d');

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();
    const source = audioContext.createMediaStreamSource(stream);
    analyserNode = audioContext.createAnalyser();

    analyserNode.fftSize = 64;
    source.connect(analyserNode);

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function drawWave() {
      waveRafId = requestAnimationFrame(drawWave);
      analyserNode.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);

      const barWidth = (waveCanvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * waveCanvas.height;
        ctx.fillStyle = document.body.dataset.state === 'speaking' ? '#6c8cff' : '#10b981';
        ctx.fillRect(x, waveCanvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    }

    drawWave();
  } catch (err) {
    console.warn('Waveform setup error:', err);
  }
}

/**
 * Speech Recognition (STT) setup
 */
function initSpeechRecognition() {
  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionClass) {
    console.warn('SpeechRecognition API not available in browser');
    return;
  }

  recognition = new SpeechRecognitionClass();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }

    currentInterimText = final || interim;
    updateInterimBubble(currentInterimText);

    // Reset 2.5s silence endpointing timer
    if (silenceTimer) clearTimeout(silenceTimer);
    if (currentInterimText.trim().length > 3) {
      silenceTimer = setTimeout(() => {
        if (currentInterimText.trim() && !isTurnBusy) {
          submitCandidateTurn(currentInterimText);
        }
      }, 2500);
    }
  };

  recognition.onerror = (e) => {
    console.warn('Speech recognition error:', e.error);
  };
}

/**
 * Start STT listening loop
 */
function listen() {
  if (isMuted || isTurnBusy) return;
  document.body.dataset.state = 'listening';
  setOrbStatus('Ava is listening to your answer...');

  if (recognition) {
    try {
      recognition.start();
    } catch (e) {
      // Already running
    }
  }
}

/**
 * Ava Voice TTS Synthesizer
 */
function say(text) {
  if (!('speechSynthesis' in window)) {
    listen();
    return;
  }

  // Pause recognition while Ava speaks to avoid acoustic echo
  if (recognition) {
    try { recognition.stop(); } catch (e) {}
  }

  window.speechSynthesis.cancel();
  document.body.dataset.state = 'speaking';
  setOrbStatus('Ava is speaking...');

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  // Prefer Natural / Google Voices
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google')));
  if (preferred) utterance.voice = preferred;

  utterance.onend = () => {
    removeInterimBubble();
    listen();
  };

  utterance.onerror = () => {
    listen();
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Submit candidate turn to POST /api/chat-turn
 */
async function submitCandidateTurn(answerText) {
  if (isTurnBusy || !answerText.trim()) return;

  isTurnBusy = true;
  setButtonsState(false); // Busy lock

  if (silenceTimer) clearTimeout(silenceTimer);
  if (recognition) {
    try { recognition.stop(); } catch (e) {}
  }

  document.body.dataset.state = 'thinking';
  setOrbStatus('Ava is evaluating response & planning next probe...');

  // Replace interim bubble with final candidate bubble
  removeInterimBubble();
  appendChatBubble('candidate', 'Candidate', answerText);

  // Clear text input field
  const textInput = document.getElementById('candidate-text-input');
  if (textInput) textInput.value = '';

  try {
    const res = await fetch('/api/chat-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: activeSession.id,
        answer: answerText
      })
    });

    if (res.ok) {
      const data = await res.json();
      isTurnBusy = false;
      setButtonsState(true);

      // Update Reasoning Card & BARS Difficulty
      updateReasoningCard(data.progress);

      // Append Ava's AI reply
      appendChatBubble('ai', 'Ava (AI Interviewer)', data.reply);

      // Check if interview completed
      if (data.done) {
        finishInterview();
        return;
      }

      // Speak Ava's response
      say(data.reply);
      return;
    }
  } catch (err) {
    console.warn('Chat turn request failed:', err);
  }

  // Fallback if offline
  isTurnBusy = false;
  setButtonsState(true);
  const fallbackReply = "Thank you for that response. Can you tell me more about how you handled technical trade-offs?";
  appendChatBubble('ai', 'Ava (AI Interviewer)', fallbackReply);
  say(fallbackReply);
}

/**
 * End Interview Action & POST /api/evaluate Dispatch
 */
async function finishInterview() {
  document.body.dataset.state = 'thinking';
  setOrbStatus('Finalizing BARS assessment & Evidence Dossier...');

  // Stop monitor and gather integrity payload
  const integrityPayload = monitor ? monitor.stop() : { totalMs: Date.now() - startTimeEpoch, visionAvailable: false, events: [] };

  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: activeSession.id,
        integrity: integrityPayload
      })
    });

    if (res.ok) {
      const evaluatedSession = await res.json();
      localStorage.setItem('candor_evaluated_session', JSON.stringify(evaluatedSession));
      window.location.href = `completion.html?id=${evaluatedSession.id}`;
      return;
    }
  } catch (err) {
    console.warn('Evaluation failed:', err);
  }

  window.location.href = 'completion.html';
}

/**
 * UI Component Helpers
 */
function setOrbStatus(statusText) {
  const el = document.getElementById('orb-status-text');
  if (el) el.textContent = statusText;
}

function updateReasoningCard(progress) {
  if (!progress) return;
  const labelEl = document.getElementById('reasoning-action-label');
  const textEl = document.getElementById('reasoning-text-content');
  const diffDots = document.querySelectorAll('.diff-dot');

  const actionMap = {
    probe: '✨ Follow-up Probe:',
    advance: '→ Next Core Question:',
    wrap_up: '✓ Finalizing Interview:'
  };

  if (labelEl) labelEl.textContent = actionMap[progress.action] || '✨ AI Adaptive Reasoning:';
  if (textEl) textEl.textContent = `Targeting ${progress.competency || 'technical proficiency'} at BARS Level ${progress.difficulty || 3}.`;

  if (diffDots) {
    const diff = progress.difficulty || 3;
    diffDots.forEach((dot, index) => {
      if (index < diff) dot.classList.add('active');
      else dot.classList.remove('active');
    });
  }

  // Update Progress Pill Header
  const progressPill = document.getElementById('room-progress-pill');
  if (progressPill) {
    progressPill.textContent = `Q${progress.question || 1} of ${progress.total || 4} · ${progress.competency || 'Technical Architecture'}`;
  }
}

function appendChatBubble(role, senderName, text) {
  const transcript = document.getElementById('transcript');
  if (!transcript) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.innerHTML = `
    <div class="bubble-meta">
      <span>${senderName}</span>
      <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
    <div>${escapeHTML(text)}</div>
  `;
  transcript.appendChild(bubble);
  transcript.scrollTop = transcript.scrollHeight;
}

function updateInterimBubble(text) {
  const transcript = document.getElementById('transcript');
  if (!transcript) return;

  let interimEl = document.getElementById('interim-bubble');
  if (!interimEl) {
    interimEl = document.createElement('div');
    interimEl.id = 'interim-bubble';
    interimEl.className = 'chat-bubble interim';
    transcript.appendChild(interimEl);
  }

  interimEl.innerHTML = `
    <div class="bubble-meta">
      <span>Candidate (Speaking...)</span>
    </div>
    <div>${escapeHTML(text)}</div>
  `;
  transcript.scrollTop = transcript.scrollHeight;
}

function removeInterimBubble() {
  const interimEl = document.getElementById('interim-bubble');
  if (interimEl) interimEl.remove();
}

function setButtonsState(enabled) {
  const sendBtn = document.getElementById('btn-send-text');
  const doneBtn = document.getElementById('btn-done-speaking');
  const endBtn = document.getElementById('btn-end-interview');

  if (sendBtn) sendBtn.disabled = !enabled;
  if (doneBtn) doneBtn.disabled = !enabled;
  if (endBtn) endBtn.disabled = !enabled;
}

function setupEventListeners() {
  const muteBtn = document.getElementById('btn-mute-mic');
  const shareBtn = document.getElementById('btn-screenshare');
  const sendBtn = document.getElementById('btn-send-text');
  const doneBtn = document.getElementById('btn-done-speaking');
  const endBtn = document.getElementById('btn-end-interview');
  const textInput = document.getElementById('candidate-text-input');

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      muteBtn.classList.toggle('active', isMuted);
      muteBtn.textContent = isMuted ? '🔇 Unmute Mic' : '🎙️ Mute Mic';
      if (isMuted && recognition) {
        try { recognition.stop(); } catch (e) {}
      } else {
        listen();
      }
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      if (monitor) {
        const active = await monitor.startScreenShare();
        shareBtn.classList.toggle('active', active);
      }
    });
  }

  if (sendBtn && textInput) {
    sendBtn.addEventListener('click', () => {
      const text = textInput.value.trim();
      if (text) submitCandidateTurn(text);
    });

    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = textInput.value.trim();
        if (text) submitCandidateTurn(text);
      }
    });
  }

  if (doneBtn) {
    doneBtn.addEventListener('click', () => {
      if (currentInterimText.trim()) {
        submitCandidateTurn(currentInterimText);
      }
    });
  }

  if (endBtn) {
    endBtn.addEventListener('click', () => {
      finishInterview();
    });
  }
}

function startInterviewTimer() {
  const timerEl = document.getElementById('interview-timer');
  timerInterval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - startTimeEpoch) / 1000);
    const m = Math.floor(elapsedSec / 60);
    const s = elapsedSec % 60;
    if (timerEl) {
      timerEl.textContent = `⏱️ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  }, 1000);
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

document.addEventListener('DOMContentLoaded', initRoom);
