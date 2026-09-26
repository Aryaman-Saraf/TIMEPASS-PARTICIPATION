# AI-Powered Interview Platform Architecture

## System Architecture Diagram

```mermaid
flowchart TD
    %% Define Styles
    classDef client fill:#e1f5fe,stroke:#03a9f4,stroke-width:2px;
    classDef backend fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px;
    classDef ai fill:#e8f5e9,stroke:#4caf50,stroke-width:2px;
    classDef monitor fill:#ffebee,stroke:#f44336,stroke-width:2px;
    classDef storage fill:#fff8e1,stroke:#ffc107,stroke-width:2px;
    classDef training fill:#e0f7fa,stroke:#00bcd4,stroke-width:2px;

    subgraph ClientTier [Client Application (Browser-Based)]
        UI[Web App UI]
        AV[Camera & Mic]
        ScreenCapture[Screen Share]
        Edge[Edge Client Pre-processing]
    end
    class ClientTier client

    subgraph CDN [CDN & Global Edge]
        LB[Global Load Balancer]
    end

    subgraph Gateway [API & Streaming Gateway]
        WSS[WebRTC Media Server Cluster]
        REST[API Gateway]
        EventBus[[Message Broker / Kafka]]
    end

    subgraph CoreServices [Core Microservices]
        IMS[Interview Orchestrator]
        PRS[Profile Engine & PII Redactor]
        Report[Reporting Service]
    end
    class CoreServices backend

    subgraph AITier [AI Inference Engine]
        ASR[ASR Cluster]
        FM[Foundational LLM Agent]
        TTS[TTS Cluster]
        Eval[Candidate Evaluator]
    end
    class AITier ai

    subgraph Surveillance [Integrity Engine]
        Vision[Computer Vision: Gaze/Face]
        AudioMon[Audio Anomaly]
        ScreenMon[Screen OCR]
    end
    class Surveillance monitor

    subgraph TrainingPipeline [Training & Bias Mitigation]
        DataLake[(Anonymized Data Lake)]
        FineTune[Model Fine-Tuning Pipeline]
        BiasAudit[Continuous Bias Auditing]
    end
    class TrainingPipeline training

    subgraph DataTier [Data Layer]
        RDB[(Relational DB)]
        VDB[(Vector DB)]
        Blob[(Object Storage)]
    end
    class DataTier storage

    %% Connections
    UI & AV & ScreenCapture --> Edge
    Edge <--> LB
    LB <--> WSS
    LB <--> REST

    REST <--> IMS
    REST <--> PRS

    %% Async Streaming via Event Bus for Scalability
    WSS --> EventBus
    EventBus --> ASR
    EventBus --> Vision
    EventBus --> AudioMon
    EventBus --> ScreenMon

    %% Real-time Interview Loop
    ASR --> FM
    FM --> TTS
    TTS --> WSS
    
    IMS <--> FM
    Vision & AudioMon & ScreenMon -.->|Events| IMS

    %% Data flow
    PRS <--> VDB
    IMS --> Blob & RDB
    IMS --> Eval
    Eval --> Report

    %% Training flow
    RDB & Blob -.->|ETL| DataLake
    DataLake --> FineTune
    FineTune --> BiasAudit
    BiasAudit -->|Aligned Weights| FM
    PRS -.->|Anonymized Prompts| FM
```

---

## 1. Scalability and Ease of Use Improvements

To ensure the system can handle thousands of concurrent interviews smoothly while remaining frictionless for candidates:

*   **Browser-Based Client & Edge Processing:** Candidates do not need to download software. The platform runs entirely in standard browsers using WebRTC. Simple pre-processing (like basic lighting checks and background noise cancellation) is handled client-side (Edge) to reduce backend load.
*   **Event-Driven Architecture (Kafka):** Heavy streams of audio and video frames are decoupled using a message broker (like Apache Kafka or Google Cloud Pub/Sub). This allows the ASR, TTS, and Surveillance modules to scale horizontally and independently based on traffic spikes.
*   **Microservices & Auto-scaling:** The core components are containerized (e.g., using Kubernetes) allowing the Interview Orchestrator to scale up automatically during high recruitment seasons.

---

## 2. Continuous Training and Bias Mitigation

To ensure the AI evaluates candidates fairly, free from human prejudices, the architecture introduces a dedicated **Training & Bias Mitigation Pipeline**.

### A. Firm-Specific Data Ingestion
*   **Anonymized Data Lake:** Past interview transcripts, rubrics, and successful hire data from the firm are stripped of Personally Identifiable Information (PII) and stored in a secure Data Lake.
*   **Continuous Fine-Tuning:** The foundational model is periodically fine-tuned on this historical data. This aligns the AI’s questioning style and evaluation rubrics specifically with the firm’s unique culture and technical standards.

### B. Anti-Bias & Fairness Mechanisms
*   **Pre-Processing (PII Redaction):** Before the LLM even sees a candidate's resume, the **Profile Engine** actively scrubs it of names, gender identifiers, age, race, and location. The AI evaluates purely on skills and experience.
*   **Reinforcement Learning from Human Feedback (RLHF):** Human auditors occasionally review AI scoring. If the AI exhibits bias, human corrections are fed back into the model to penalize biased reasoning.
*   **Continuous Bias Auditing (Red-Teaming):** The `BiasAudit` module automatically runs adversarial simulations against the model daily. It feeds the model identical transcripts that only vary by implied demographic pronouns to ensure the final scores remain statistically identical. If a disparity is detected, the model's update is blocked until corrected.

---

## 3. Core Architecture Components

### A. Core Backend Services
*   **Profile Engine & PII Redactor:** Ingests the candidate's resume, strips PII to prevent bias, and extracts key skills into a **Vector DB** to guide the interview.
*   **Interview Orchestrator:** Manages the state of the interview and routes data streams asynchronously.

### B. AI Inference Engine
*   **ASR & TTS Clusters:** Highly scalable Speech-to-Text and Text-to-Speech clusters handling the real-time conversation.
*   **Foundational LLM Agent:** The core intelligence, fine-tuned on firm data and heavily guarded against bias, driving the interview questions.
*   **Evaluation Engine:** Processes the transcript post-interview to generate a structured, objective report scoring the candidate on predefined technical and communication rubrics.

---

## 4. Integrity & Surveillance Engine (Proctoring)

### A. Gaze and Facial Tracking (Vision)
*   Uses scalable computer vision models to track head pose and pupil direction, flagging if a candidate repeatedly looks off-screen.
*   Continuously verifies that only one face is in the frame.

### B. Audio Anomaly Detection (Audio)
*   Flags whispering, secondary voices, or unnatural acoustic events like rapid typing during non-coding portions.

### C. Active Screen Monitoring (Screen Share)
*   **Application Detection:** Analyzes the screen to detect unauthorized applications (e.g., ChatGPT, Claude, external IDEs).
*   **Optical Character Recognition (OCR):** Detects if the candidate is copy-pasting interview prompts into other windows.
