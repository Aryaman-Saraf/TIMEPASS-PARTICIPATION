# AI Interview Platform - Refined Implementation Blueprint (preadme.md)

*v2.0 - Edge-Case & Resiliency Refined*

After a rigorous evaluation of the initial architecture, several edge cases and potential points of failure were identified (e.g., candidate internet dropping, AI APIs timing out, background noise ruining transcription, Kafka failing). 

This refined directory structure introduces **Circuit Breakers**, **Session Recovery**, **Fallback Agents**, and **Pre-Flight Checks** to ensure the system is bulletproof.

---

## 📁 Directory Structure Overview (Refined)

```text
ai-interview-platform/
├── frontend/               # The Candidate's Web Browser App
├── gateway/                # The Traffic Cops (WebRTC & API)
├── core-services/          # The Managers (Orchestrator & Profiles)
├── ai-engine/              # The Brains (ASR, LLM, TTS)
├── surveillance/           # The Proctors (Vision, Audio, Screen)
├── training/               # The Quality Control (Anti-Bias)
├── infrastructure/         # DevOps & Failover Systems
└── preadme.md              # Master Blueprint
```

---

## 1. 📁 `frontend/` (Client Application)
*Focus: Graceful degradation and hardware validation.*

*   **`src/components/InterviewRoom.jsx`**: The main UI container.
*   **`src/components/TextFallbackChat.jsx`**: **[NEW]** Activates automatically if the candidate's microphone fails entirely, allowing the interview to continue via text.
*   **`src/hooks/useWebRTC.js`**: Handles media streaming.
*   **`src/hooks/useReconnection.js`**: **[NEW]** Edge Case: If the candidate's WiFi drops for 10 seconds, this hook masks the drop with a "Reconnecting..." UI and seamlessly re-establishes the UDP stream without resetting the interview.
*   **`src/utils/pre_flight_checks.js`**: **[NEW]** Runs before the interview starts. Tests bandwidth, mic clarity, and lighting. If it fails, it guides the candidate to fix it *before* the AI starts.

---

## 2. 📁 `gateway/` (API & Streaming Gateway)
*Focus: Traffic routing and message broker resiliency.*

*   **`src/rest_api.js`**: Handles standard HTTP requests.
*   **`src/webrtc_server.js`**: Terminates WebRTC connections.
*   **`src/kafka_producer.js`**: Pushes streams to Kafka.
*   **`src/dead_letter_queue.js`**: **[NEW]** Edge Case: If Kafka goes down or a message is corrupted, this catches the failed data packets and writes them to a backup Redis cache so no interview data is lost.

---

## 3. 📁 `core-services/` (The Managers)
*Focus: State preservation and perfect anonymization.*

*   **`orchestrator/state_machine.py`**: Manages the interview phases.
*   **`orchestrator/session_recovery.py`**: **[NEW]** If a candidate's laptop dies and they log back in 5 minutes later, this pulls the exact state from the database and resumes the AI's thought process right where it left off.
*   **`profile_engine/resume_parser.py`**: Extracts text from PDFs.
*   **`profile_engine/pii_redactor.py`**: Uses NLP to strip demographics.
*   **`profile_engine/anonymization_validator.py`**: **[NEW]** Edge Case: What if the primary redactor misses a gendered pronoun? This acts as a secondary, strict regex/NLP pass to guarantee 100% PII removal before it hits the LLM.

---

## 4. 📁 `ai-engine/` (The Brain)
*Focus: Handling AI hallucinations, API timeouts, and bad audio.*

*   **`asr/whisper_worker.py`**: Audio to text.
*   **`asr/confidence_scorer.py`**: **[NEW]** Edge Case: A dog barks loudly, and the ASR outputs gibberish. This script checks the transcription confidence. If it's below 60%, it intercepts the text and tells the Orchestrator to make the AI say, *"I'm sorry, there was some background noise. Could you repeat that?"* instead of hallucinating a response.
*   **`llm/prompt_builder.py`**: Constructs context for the LLM.
*   **`llm/foundational_client.py`**: Calls the primary AI model (e.g., Gemini).
*   **`llm/circuit_breaker.py`**: **[NEW]** Edge Case: The primary API (Gemini/OpenAI) goes down globally or times out. This script detects the timeout (e.g., > 3 seconds) and immediately cuts the connection to prevent the candidate from sitting in awkward silence.
*   **`llm/fallback_agent.py`**: **[NEW]** Triggered by the Circuit Breaker. A smaller, locally hosted model (like Llama 3 8B) that takes over seamlessly if the main cloud API fails, ensuring the interview finishes.

---

## 5. 📁 `surveillance/` (Integrity Engine)
*Focus: False positive prevention.*

*   **`vision/gaze_tracker.py`**: Tracks eye movement.
*   **`vision/lighting_validator.py`**: **[NEW]** Edge Case: The candidate's room gets dark, causing the Gaze Tracker to output false "cheating" flags because it can't see their eyes. This script pauses integrity scoring if lighting is too poor and politely asks the candidate to turn on a light.
*   **`audio/diarization.py`**: Multi-speaker detection.
*   **`screen/ocr_scanner.py`**: Checks screen for unauthorized text.

---

## 6. 📁 `training/` (Continuous Training & Anti-Bias)
*Focus: Long-term model alignment.*

*   **`fine_tuning/trainer.py`**: Runs RLHF.
*   **`bias_audit/red_teamer.py`**: Automated demographic bias testing.

---

## 7. 📁 `infrastructure/` (DevOps & Failover)
*Focus: High Availability (HA).*

*   **`docker-compose.yml`**: Local orchestration.
*   **`k8s/deployment.yaml`**: Primary cloud deployment.
*   **`k8s/failover_cluster.yaml`**: **[NEW]** A secondary Kubernetes cluster in a completely different geographic region. If Region A goes offline (e.g., AWS us-east-1 goes down), DNS automatically routes new candidates to Region B.
*   **`redis_state_cache/`**: **[NEW]** Extremely fast, in-memory backup storage. If the primary PostgreSQL database crashes, the active interview states are preserved here so live interviews don't drop.
