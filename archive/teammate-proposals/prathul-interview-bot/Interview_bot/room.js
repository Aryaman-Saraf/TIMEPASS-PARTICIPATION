import { IntegrityMonitor } from './integrity.js';

const video = document.getElementById('cam');
const canvas = document.getElementById('overlay');
const hud = document.getElementById('hud');
const transcript = document.getElementById('transcript');
const backupInput = document.getElementById('backup-input');
const aiOrb = document.getElementById('ai-orb');
const aiStatusText = document.getElementById('ai-status-text');
const actionBadge = document.getElementById('action-badge');
const actionDesc = document.getElementById('action-desc');
const audioWaveCanvas = document.getElementById('audio-wave');

let monitor;
let recognition;
let isAIThinking = false;
let audioCtx;
let analyser;
let micStream;

// Audio Sound Effects Synthesizer for System Feedback
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
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
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
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        }
    } catch (e) {
        console.warn("Audio Sound Cue Error:", e);
    }
}

// Speak System Feedback Aloud
window.speakSystemAudioFeedback = function(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    window.speechSynthesis.speak(utt);
};

// AI Response Set (Dynamic Adaptive Flow)
const MOCK_AI_RESPONSES = [
    {
        text: "Certainly. For a large application, I used memoization with useMemo and code splitting to optimize performance.",
        aiReply: "That's a solid technique. Could you explain how you measured the performance gain before and after code splitting?",
        badge: "✨ Follow-up Question",
        desc: "Based on candidate's mention of code splitting, probing for quantitative metrics and profiling tools used (e.g. Lighthouse, Web Vitals)."
    },
    {
        text: "We monitored Core Web Vitals and reduced LCP from 3.8s to 1.4s using lazy loading.",
        aiReply: "Impressive improvement! Let me transition to System Design now. How would you design a real-time collaborative editor?",
        badge: "→ Next Topic (System Design)",
        desc: "Candidate demonstrated strong optimization depth. Moving to architectural design and WebSockets handling."
    },
    {
        text: "I would use Operational Transformation or CRDTs over WebSockets for conflict resolution.",
        aiReply: "Excellent response. That covers all my primary technical checkpoints. Do you have any questions about our engineering culture?",
        badge: "✓ Wrap-up Session",
        desc: "Candidate completed technical evaluation criteria with high relevancy scores."
    }
];

let turnIndex = 0;

async function initRoom() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        video.srcObject = stream;
        micStream = stream;

        // Initialize Integrity Monitor
        monitor = new IntegrityMonitor(video, canvas, hud);
        monitor.start();

        // Setup Audio Analyzer Waveform
        setupAudioAnalyzer(stream);

        // Start Speech Recognition Engine
        initSpeechEngine();

        // Initial Audio Greeting
        speakAIResponse("Hello Sarah! Welcome to your technical interview. Can you elaborate on how you handled performance issues in React?");

    } catch (err) {
        console.error("Room init error:", err);
        transcript.innerHTML += `<div class="chat-bubble ai" style="border-left-color: var(--danger)">
            <strong style="color:var(--danger)">Audio/Camera Access Warning:</strong> Unable to access devices. Using manual text entry mode.
        </div>`;
    }
}

// Audio Visualizer Waveform Animation
function setupAudioAnalyzer(stream) {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
            const barWidth = (audioWaveCanvas.width / bufferLength) * 1.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * audioWaveCanvas.height * 0.8;
                ctx.fillStyle = isAIThinking ? '#06b6d4' : '#3b82f6';
                ctx.fillRect(x, audioWaveCanvas.height - barHeight, barWidth - 2, barHeight);
                x += barWidth;
            }
        }
        drawWave();
    } catch (e) {
        console.warn("Audio visualizer unavailable:", e);
    }
}

// Speech Recognition (Audio Input)
function initSpeechEngine() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    let silenceTimer;

    recognition.onstart = () => {
        playSoundCue('mic_start');
    };

    recognition.onresult = (event) => {
        clearTimeout(silenceTimer);
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            else interimTranscript += event.results[i][0].transcript;
        }

        if (interimTranscript && !isAIThinking) {
            backupInput.value = interimTranscript;
            aiStatusText.innerText = "Text: Candidate Speaking...";
        }

        if (finalTranscript && !isAIThinking) {
            backupInput.value = '';
            processCandidateAudioInput(finalTranscript);
        } else {
            silenceTimer = setTimeout(() => {
                if (interimTranscript && !isAIThinking && interimTranscript.trim().length > 3) {
                    backupInput.value = '';
                    processCandidateAudioInput(interimTranscript);
                }
            }, 2500); // 2.5s Silence Endpointing
        }
    };

    recognition.onerror = (e) => console.log('Speech recognition event:', e);
    recognition.start();
}

// Process Candidate Audio Response
function processCandidateAudioInput(text) {
    if (isAIThinking || !text.trim()) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append to scrolling transcript
    transcript.innerHTML += `
        <div class="chat-bubble user">
            <div class="chat-meta">
                <strong>Sarah Jenkins (You)</strong>
                <span>${timeStr}</span>
            </div>
            ${text}
        </div>
    `;
    transcript.scrollTop = transcript.scrollHeight;

    isAIThinking = true;
    aiOrb.classList.remove('speaking');
    aiStatusText.innerText = "Text: AI Assistant | Reasoning & Formulating Question...";
    playSoundCue('think');

    if (recognition) recognition.stop();

    // AI Adaptive Generation Delay
    setTimeout(() => {
        const currentData = MOCK_AI_RESPONSES[Math.min(turnIndex, MOCK_AI_RESPONSES.length - 1)];
        turnIndex++;

        // Update Dynamic Action Card
        actionBadge.innerHTML = `<span>✨</span> <span>${currentData.badge}</span>`;
        actionDesc.innerText = currentData.desc;

        // Speak & Display AI Output
        speakAIResponse(currentData.aiReply);

    }, 1400);
}

// Speak AI Response (Audio Output + Orb Animation)
function speakAIResponse(text) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    transcript.innerHTML += `
        <div class="chat-bubble ai">
            <div class="chat-meta">
                <strong>Candor AI</strong>
                <span>${timeStr}</span>
            </div>
            ${text}
        </div>
    `;
    transcript.scrollTop = transcript.scrollHeight;

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;

        utterance.onstart = () => {
            aiOrb.classList.add('speaking');
            aiStatusText.innerText = "Text: AI Assistant | Speaking...";
        };

        utterance.onend = () => {
            aiOrb.classList.remove('speaking');
            aiStatusText.innerText = "Text: AI Assistant | Active Listening...";
            isAIThinking = false;
            if (recognition) {
                try { recognition.start(); } catch (e) {}
            }
        };

        window.speechSynthesis.speak(utterance);
    } else {
        isAIThinking = false;
        aiStatusText.innerText = "Text: AI Assistant | Active Listening...";
    }
}

// Global Controls
window.sendManual = function () {
    const val = backupInput.value.trim();
    if (val) processCandidateAudioInput(val);
};

window.toggleAudioMute = function () {
    if (!micStream) return;
    const audioTrack = micStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const btnLabel = document.getElementById('mute-label');
        btnLabel.innerText = audioTrack.enabled ? 'Mute Audio' : 'Unmute Audio';
        speakSystemAudioFeedback(audioTrack.enabled ? 'Microphone unmuted.' : 'Microphone muted.');
    }
};

window.toggleAudioFeedbackPrompt = function () {
    speakSystemAudioFeedback("Candor Audio Engine is active. Both voice input and synthetic voice feedback are fully synchronized.");
};

window.openAISettings = function () {
    speakSystemAudioFeedback("Opening AI model configuration. Foundational Model is tuned for zero bias evaluation.");
};

window.speakHelp = function () {
    speakSystemAudioFeedback("Speak naturally into your microphone. The AI will listen to your answer and automatically ask relevant follow-up questions.");
};

window.endInterview = function () {
    playSoundCue('warning');
    if (recognition) recognition.stop();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    speakSystemAudioFeedback("Interview session completed. Generating Candidate Evidence Dossier.");

    setTimeout(() => {
        window.location.href = 'report.html';
    }, 1200);
};

initRoom();
