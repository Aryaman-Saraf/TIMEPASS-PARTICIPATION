/**
 * Candor AI Interview Platform - Live Adaptive Screening Room Controller
 * Unifies Prathul's candidate audio/visual UI, Aryaman's §4 adaptive API engine,
 * and Suryansh's on-device MediaPipe integrity monitor.
 */

import { IntegrityMonitor } from './integrity.js';

// DOM References
const videoEl = document.getElementById('cam');
const canvasEl = document.getElementById('overlay');
const audioWaveCanvas = document.getElementById('audio-wave');
const transcriptBox = document.getElementById('transcript');
const backupInput = document.getElementById('backup-input');
const sendBtn = document.getElementById('send-btn');
const aiOrb = document.getElementById('ai-orb');
const aiStatusText = document.getElementById('ai-status-text');
const actionBadge = document.getElementById('action-badge');
const actionBadgeText = document.getElementById('action-badge-text');
const actionDesc = document.getElementById('action-desc');
const muteBtn = document.getElementById('mute-btn');
const muteLabel = document.getElementById('mute-label');
const screenShareBtn = document.getElementById('screen-share-btn');
const repeatQuestionBtn = document.getElementById('repeat-question-btn');
const helpBtn = document.getElementById('help-btn');
const restartMicBtn = document.getElementById('restart-mic-btn');
const endInterviewBtn = document.getElementById('end-interview-btn');
const evaluationModal = document.getElementById('evaluation-modal');
const roomTimer = document.getElementById('room-timer');

const navCandidateName = document.getElementById('nav-candidate-name');
const navCandidateRole = document.getElementById('nav-candidate-role');
const plateCandidateName = document.getElementById('plate-candidate-name');
const micStatusLabel = document.getElementById('mic-status-label');

const hudVision = document.getElementById('hud-vision');
const hudFocus = document.getElementById('hud-focus');
const hudFaces = document.getElementById('hud-faces');
const hudOnscreen = document.getElementById('hud-onscreen');

// Global State
let sessionId = null;
let currentSession = null;
let monitor = null;
let micStream = null;
let audioCtx = null;
let analyser = null;
let recognition = null;
let isAIThinking = false;
let isAISpeaking = false;
let sessionStartTime = Date.now();
let timerInterval = null;
let lastAIQuestion = '';

// Sound Synthesizer for Audio Feedback
function playSoundCue(type) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'mic_start') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'think') {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'warning') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.setValueAtTime(200, now + 0.15);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    console.warn('Audio cue notice:', e);
  }
}

// Format time utility
function formatTimeNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
    const m = Math.floor(elapsedSec / 60);
    const s = elapsedSec % 60;
    if (roomTimer) {
      roomTimer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  }, 1000);
}

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------
async function initRoom() {
  startTimer();

  // 1. Resolve Session ID
  const urlParams = new URLSearchParams(window.location.search);
  sessionId = urlParams.get('id');

  if (!sessionId) {
    // If no ID in query, attempt to recover recent or create a default session
    try {
      const res = await fetch('/api/start-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName: 'Sarah Jenkins',
          role: 'Senior Frontend Engineer',
          questionCount: 4
        })
      });
      const data = await res.json();
      sessionId = data.id;
      window.history.replaceState({}, '', `room.html?id=${encodeURIComponent(sessionId)}`);
    } catch (e) {
      console.error('Session startup fallback error:', e);
    }
  }

  // 2. Fetch Session Data
  try {
    const res = await fetch(`/api/session?id=${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    currentSession = await res.json();

    if (navCandidateName) navCandidateName.textContent = currentSession.candidateName || 'Candidate';
    if (navCandidateRole) navCandidateRole.textContent = currentSession.role || 'Software Engineer';
    if (plateCandidateName) plateCandidateName.textContent = `${currentSession.candidateName || 'Candidate'} | Candidate`;

    // Render initial opening turn
    const firstTurn = currentSession.turns?.[0];
    if (firstTurn) {
      lastAIQuestion = firstTurn.text;
      transcriptBox.innerHTML = `
        <div class="chat-bubble ai">
          <div class="chat-meta">
            <strong>Candor AI</strong>
            <span>${formatTimeNow()}</span>
          </div>
          ${escapeHtml(firstTurn.text)}
        </div>
      `;
    }
  } catch (err) {
    console.error('Failed to load session details:', err);
  }

  // 3. Initialize Media Stream (Camera & Mic)
  let hasCamera = true;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    videoEl.srcObject = micStream;
    setupAudioWaveform(micStream);
  } catch (err) {
    console.warn('Webcam/Mic access denied or unavailable; switching to manual mode:', err);
    hasCamera = false;
    if (micStatusLabel) micStatusLabel.textContent = '⌨️ Manual Mode';
    appendChatBubble('system', 'Camera/Microphone access was unavailable. Manual typing mode is enabled.');
  }

  // 4. Initialize Suryansh's Integrity Monitor (T3)
  try {
    monitor = new IntegrityMonitor(videoEl, canvasEl, (hud) => {
      handleHudUpdate(hud);
    });
    await monitor.start(hasCamera, false);
  } catch (err) {
    console.warn('Integrity monitor initialization notice:', err);
  }

  // 5. Initialize Speech Recognition (T1)
  initSpeechEngine();

  // 6. Speak Opening AI Greeting Aloud
  if (lastAIQuestion) {
    speakAIResponse(lastAIQuestion);
  } else {
    const defaultGreeting = `Hello ${currentSession?.candidateName || 'there'}! Welcome to your technical interview for the ${currentSession?.role || 'engineering'} position. Can you tell me about your background and a challenging technical project you recently delivered?`;
    lastAIQuestion = defaultGreeting;
    speakAIResponse(defaultGreeting);
  }
}

// -------------------------------------------------------------
// Real-time Attention HUD Updates (Suryansh's Engine)
// -------------------------------------------------------------
function handleHudUpdate(hud) {
  if (!hud) return;

  // Vision Status
  if (hudVision) {
    if (hud.vision === 'on') {
      hudVision.className = 'risk-badge hud-badge-ok';
      hudVision.textContent = '👁️ Vision: Active (GPU)';
    } else if (hud.vision === 'loading') {
      hudVision.className = 'risk-badge hud-badge-warn';
      hudVision.textContent = '👁️ Vision: Loading MediaPipe…';
    } else {
      hudVision.className = 'risk-badge hud-badge-danger';
      hudVision.textContent = '👁️ Vision: Fallback Mode';
    }
  }

  // Focus Status
  if (hudFocus) {
    if (hud.focus === 'away') {
      hudFocus.className = 'risk-badge hud-badge-warn';
      hudFocus.textContent = '👀 Focus: Looking Away';
    } else {
      hudFocus.className = 'risk-badge hud-badge-ok';
      hudFocus.textContent = '🎯 Focus: Centered';
    }
  }

  // Face Count
  if (hudFaces) {
    if (hud.faces >= 2) {
      hudFaces.className = 'risk-badge hud-badge-danger';
      hudFaces.textContent = `👥 ${hud.faces} Faces Detected`;
    } else if (hud.faces === 0) {
      hudFaces.className = 'risk-badge hud-badge-warn';
      hudFaces.textContent = '👤 Face Missing';
    } else {
      hudFaces.className = 'risk-badge hud-badge-ok';
      hudFaces.textContent = '👤 1 Face Verified';
    }
  }

  // On-Screen Percentage
  if (hudOnscreen && hud.stats) {
    const pct = hud.stats.onScreenPct ?? 100;
    hudOnscreen.className = pct >= 80 ? 'risk-badge hud-badge-ok' : pct >= 60 ? 'risk-badge hud-badge-warn' : 'risk-badge hud-badge-danger';
    hudOnscreen.textContent = `${pct}% On-Screen`;
  }
}

// -------------------------------------------------------------
// Audio Visualizer Waveform Animation (Web Audio API)
// -------------------------------------------------------------
function setupAudioWaveform(stream) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 64;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const ctx = audioWaveCanvas.getContext('2d');

    function drawWave() {
      requestAnimationFrame(drawWave);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, audioWaveCanvas.width, audioWaveCanvas.height);
      const barWidth = (audioWaveCanvas.width / bufferLength) * 1.4;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * audioWaveCanvas.height * 0.85;
        ctx.fillStyle = isAISpeaking ? '#06b6d4' : isAIThinking ? '#a855f7' : '#3b82f6';
        ctx.fillRect(x, audioWaveCanvas.height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }
    }
    drawWave();
  } catch (e) {
    console.warn('Audio visualizer setup notice:', e);
  }
}

// -------------------------------------------------------------
// Speech-to-Text Recognition (Candidate Voice Input)
// -------------------------------------------------------------
function initSpeechEngine() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('SpeechRecognition API not available in this browser');
    return;
  }

  try {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let silenceTimer = null;

    recognition.onstart = () => {
      playSoundCue('mic_start');
      if (micStatusLabel) micStatusLabel.textContent = '🎙️ Mic Active (Listening)';
    };

    recognition.onresult = (event) => {
      if (isAIThinking || isAISpeaking) return;

      clearTimeout(silenceTimer);
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        else interimTranscript += event.results[i][0].transcript;
      }

      if (interimTranscript && !isAIThinking) {
        backupInput.value = interimTranscript;
        aiStatusText.textContent = 'Text: Candidate Speaking…';
      }

      if (finalTranscript && !isAIThinking) {
        backupInput.value = '';
        processCandidateAnswer(finalTranscript);
      } else {
        silenceTimer = setTimeout(() => {
          if (interimTranscript && !isAIThinking && interimTranscript.trim().length > 3) {
            backupInput.value = '';
            processCandidateAnswer(interimTranscript);
          }
        }, 2200); // 2.2s silence detection threshold
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') {
        console.warn('Speech recognition notice:', e.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if candidate should be listening and not in thinking/speaking state
      if (!isAIThinking && !isAISpeaking) {
        try { recognition.start(); } catch (_) {}
      }
    };

    recognition.start();
  } catch (err) {
    console.warn('Could not start speech recognition:', err);
  }
}

// -------------------------------------------------------------
// Core Turn Engine: POST /api/chat-turn (Aryaman's Adaptive Backend)
// -------------------------------------------------------------
async function processCandidateAnswer(text) {
  const cleanAnswer = (text || '').trim();
  if (isAIThinking || !cleanAnswer) return;

  // Append user message to transcript
  appendChatBubble('user', cleanAnswer);

  // Transition AI state to reasoning
  isAIThinking = true;
  aiOrb.className = 'ai-orb';
  aiOrb.style.background = 'radial-gradient(circle at 35% 35%, #c084fc, #9333ea 50%, #6b21a8 100%)';
  aiStatusText.textContent = 'AI Assistant | Reasoning & Formulating Question…';
  playSoundCue('think');

  // Pause speech recognition while thinking
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
  }

  try {
    const res = await fetch('/api/chat-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        answer: cleanAnswer
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    lastAIQuestion = data.reply;

    // Update Dynamic AI Action / Reasoning Card
    if (data.progress) {
      updateActionCard(data.progress);
    }

    // Speak and display AI response
    speakAIResponse(data.reply, () => {
      isAIThinking = false;
      aiOrb.style.background = '';
      aiStatusText.textContent = 'AI Assistant | Active Listening…';

      if (data.done) {
        // Complete interview lifecycle
        setTimeout(() => {
          handleEndInterview();
        }, 1500);
      } else {
        // Resume listening
        if (recognition) {
          try { recognition.start(); } catch (_) {}
        }
      }
    });

  } catch (err) {
    console.error('Chat turn processing error:', err);
    isAIThinking = false;
    aiOrb.style.background = '';
    aiStatusText.textContent = 'AI Assistant | Ready';
    appendChatBubble('system', `Error contacting AI brain: ${err.message}. You can continue typing.`);
    if (recognition) {
      try { recognition.start(); } catch (_) {}
    }
  }
}

// -------------------------------------------------------------
// Update Dynamic AI Action Reasoning Card
// -------------------------------------------------------------
function updateActionCard(progress) {
  if (!progress) return;

  const action = progress.action || 'advance';
  const difficulty = progress.difficulty || 3;
  const competency = progress.competency || 'General Competency';
  const questionNum = progress.question || 1;
  const total = progress.total || 4;

  if (action === 'probe') {
    actionBadgeText.textContent = '✨ Follow-up Probe (STAR Evidence)';
    actionDesc.textContent = `Probing candidate on ${competency}. Seeking deeper behavioral context and metrics. Difficulty calibrated to ${difficulty}/5.`;
    actionBadge.className = 'ai-action-badge';
  } else if (action === 'advance') {
    actionBadgeText.textContent = `→ Next Competency (${competency})`;
    actionDesc.textContent = `Progressing to Question ${questionNum} of ${total}. Assessing ${competency} with difficulty level ${difficulty}/5.`;
    actionBadge.className = 'ai-action-badge';
  } else if (action === 'wrap_up') {
    actionBadgeText.textContent = '✓ Technical Screening Complete';
    actionDesc.textContent = 'All core competency rubrics completed. Preparing final summary and candidate closing remarks.';
    actionBadge.className = 'ai-action-badge';
  }
}

// -------------------------------------------------------------
// Text-to-Speech Output (Ava Voice Engine)
// -------------------------------------------------------------
function speakAIResponse(text, onComplete) {
  appendChatBubble('ai', text);

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;

    utterance.onstart = () => {
      isAISpeaking = true;
      aiOrb.className = 'ai-orb speaking';
      aiStatusText.textContent = 'AI Assistant | Speaking…';
    };

    utterance.onend = () => {
      isAISpeaking = false;
      aiOrb.className = 'ai-orb';
      aiStatusText.textContent = 'AI Assistant | Active Listening…';
      if (typeof onComplete === 'function') onComplete();
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      isAISpeaking = false;
      aiOrb.className = 'ai-orb';
      if (typeof onComplete === 'function') onComplete();
    };

    window.speechSynthesis.speak(utterance);
  } else {
    if (typeof onComplete === 'function') onComplete();
  }
}

// -------------------------------------------------------------
// Transcript DOM Helper
// -------------------------------------------------------------
function appendChatBubble(sender, text) {
  const timeStr = formatTimeNow();
  const div = document.createElement('div');

  if (sender === 'user') {
    const candidateName = currentSession?.candidateName || 'Sarah Jenkins';
    div.className = 'chat-bubble user';
    div.innerHTML = `
      <div class="chat-meta">
        <strong>${escapeHtml(candidateName)} (You)</strong>
        <span>${timeStr}</span>
      </div>
      <div>${escapeHtml(text)}</div>
    `;
  } else if (sender === 'ai') {
    div.className = 'chat-bubble ai';
    div.innerHTML = `
      <div class="chat-meta">
        <strong>Candor AI</strong>
        <span>${timeStr}</span>
      </div>
      <div>${escapeHtml(text)}</div>
    `;
  } else {
    div.className = 'chat-bubble ai';
    div.style.borderLeftColor = 'var(--warning)';
    div.innerHTML = `
      <div class="chat-meta" style="color:var(--warning)">
        <strong>System Notice</strong>
        <span>${timeStr}</span>
      </div>
      <div>${escapeHtml(text)}</div>
    `;
  }

  transcriptBox.appendChild(div);
  transcriptBox.scrollTop = transcriptBox.scrollHeight;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// -------------------------------------------------------------
// Final Evaluation & Recruiter Dossier Transition
// -------------------------------------------------------------
async function handleEndInterview() {
  playSoundCue('warning');
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  // Show evaluation modal
  if (evaluationModal) evaluationModal.style.display = 'flex';

  // Stop Integrity Monitor and gather verified payload
  let integrityPayload = { totalMs: 1, visionAvailable: false, events: [] };
  if (monitor && typeof monitor.stop === 'function') {
    try {
      integrityPayload = monitor.stop();
    } catch (e) {
      console.warn('Error reading integrity payload:', e);
    }
  }

  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        integrity: integrityPayload
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    // Stop all media tracks
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
    }

    // Hide evaluation loader and show requested candidate completion screen
    if (evaluationModal) evaluationModal.style.display = 'none';
    const compEl = document.getElementById('completion-screen');
    const recLink = document.getElementById('completion-recruiter-link');
    if (recLink) recLink.href = `report.html?id=${encodeURIComponent(sessionId)}`;
    if (compEl) {
      compEl.style.display = 'flex';
    } else {
      alert('Interview done. Results will be with you soon.');
      window.location.href = 'index.html';
    }

  } catch (err) {
    console.error('Failed to evaluate session:', err);
    if (evaluationModal) evaluationModal.style.display = 'none';
    const compEl = document.getElementById('completion-screen');
    const recLink = document.getElementById('completion-recruiter-link');
    if (recLink) recLink.href = `report.html?id=${encodeURIComponent(sessionId)}`;
    if (compEl) {
      compEl.style.display = 'flex';
    } else {
      alert('Interview done. Results will be with you soon.');
      window.location.href = 'index.html';
    }
  }
}

// -------------------------------------------------------------
// Event Listeners & UI Controls
// -------------------------------------------------------------
sendBtn.addEventListener('click', () => {
  const val = backupInput.value.trim();
  if (val) {
    backupInput.value = '';
    processCandidateAnswer(val);
  }
});

backupInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const val = backupInput.value.trim();
    if (val) {
      backupInput.value = '';
      processCandidateAnswer(val);
    }
  }
});

muteBtn.addEventListener('click', () => {
  if (!micStream) return;
  const audioTrack = micStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    muteLabel.textContent = audioTrack.enabled ? 'Mute Audio' : 'Unmute Audio';
    if (micStatusLabel) {
      micStatusLabel.textContent = audioTrack.enabled ? '🎙️ Mic Active' : '🔇 Mic Muted';
    }
  }
});

screenShareBtn.addEventListener('click', async () => {
  if (monitor && typeof monitor.start === 'function') {
    try {
      await monitor.start(true, true);
      screenShareBtn.innerHTML = '🖥️ <span>Screen Active</span>';
      screenShareBtn.classList.add('active');
    } catch (e) {
      console.warn('Screen share cancelled or failed:', e);
    }
  }
});

repeatQuestionBtn.addEventListener('click', () => {
  if (lastAIQuestion && !isAIThinking) {
    speakAIResponse(lastAIQuestion);
  }
});

helpBtn.addEventListener('click', () => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance('Speak clearly into your microphone to answer Ava’s questions. Ava adaptively probes your answers and advances through technical competencies.');
    utt.rate = 1.05;
    window.speechSynthesis.speak(utt);
  }
});

restartMicBtn.addEventListener('click', () => {
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
    setTimeout(() => {
      try { recognition.start(); } catch (_) {}
    }, 200);
  }
});

endInterviewBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to end this interview and generate your Evidence Dossier?')) {
    handleEndInterview();
  }
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initRoom);
