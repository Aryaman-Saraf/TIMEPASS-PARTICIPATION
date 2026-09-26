# Deep Dive: Understanding the AI Interview Platform Architecture
*A zero-to-hero guide by your Senior AI Engineer.*

Welcome! If you are looking at the architecture graph and feeling overwhelmed, don't worry. We are going to break down every single box, line, and concept from the ground up. 

Think of this system like an extremely efficient, highly secure **Virtual Restaurant**:
*   The **Browser (Client)** is the dining table where the candidate sits.
*   The **Gateway & Kafka** are the waiters running back and forth with orders.
*   The **AI Engine** is the Master Chef cooking up the questions.
*   The **Surveillance Engine** is the security guard making sure no one is cheating.
*   The **Orchestrator** is the Restaurant Manager making sure everything runs smoothly.

Let's look at how we build this restaurant.

---

## 1. The Client Tier: Where the Candidate Sits

**What it is:** The software the candidate actually interacts with. We are building this as a **Web App** (using frameworks like React or Vue.js), meaning the candidate just clicks a link in Google Chrome or Safari. No downloads required.

**The Tech inside:**
*   **WebRTC (Web Real-Time Communication):** This is the magic technology that allows browsers to send video and audio directly to our servers with almost zero delay (latency). If you've used Google Meet or Zoom in a browser, you've used WebRTC. 
    *   *How it works:* Unlike downloading a file where you want every piece of data perfectly in order (TCP protocol), WebRTC streams data fast (UDP protocol). If a single frame of video drops, it just skips it and plays the next one, ensuring the conversation doesn't lag.
*   **Screen Share API:** Modern browsers have built-in tools that ask the user, "Can this website see your screen?" We use this to capture their desktop.
*   **Edge Pre-processing:** Before sending heavy video to our servers, we write tiny bits of code that run on the user's laptop (the "Edge") to compress the video or filter out background fan noise.

---

## 2. The Gateway & Kafka: The Traffic Cops

When the candidate speaks, their video and audio leave their laptop and travel across the internet. We need systems to catch this data and route it.

**The Tech inside:**
*   **Global Load Balancer:** Imagine 1,000 candidates clicking the interview link at exactly 9:00 AM. If they all hit one server, it crashes. A Load Balancer is a bouncer at the front door that says, "You go to Server A, you go to Server B," spreading the work out evenly.
*   **API Gateway (REST):** This handles standard requests like "Log me in" or "Fetch my profile." 
*   **WebRTC Media Server:** This specifically catches the continuous waterfall of video/audio streams.
*   **Kafka (The Message Broker / Event Bus):** 
    *   *The Problem:* If the Media server tries to send video to the AI, the Audio analyzer, and the Vision analyzer all at once, it will freeze.
    *   *The Solution:* Kafka. Kafka is like a high-speed post office conveyor belt. The Media Server drops the audio/video chunks onto the belt. The ASR (Speech-to-text), the Vision AI, and the Audio AI independently reach onto the belt and grab copies of the data whenever they are ready. This makes the system **asynchronous and scalable**.

---

## 3. Core Services: The Managers

These are the standard "backend" computer programs (often written in Node.js, Python, or Go) that enforce the rules of the app.

**The Tech inside:**
*   **Interview Orchestrator:** This is a state machine. It keeps track of time ("The interview has been going for 15 minutes, time to move to technical questions"). It tells the AI when to speak and when to listen.
*   **Profile Engine & PII Redactor:** 
    *   *How it works:* When a resume is uploaded (a PDF), this module uses NLP (Natural Language Processing) to read the text.
    *   *Redaction:* It uses rules and AI to find things like "John Smith", "Female", "Stanford University", or "Age: 25" and replaces them with `[CANDIDATE_NAME]`, `[GENDER_REMOVED]`. This ensures the AI Chef never knows the demographics of the person, destroying bias at the root.

---

## 4. The AI Inference Engine: The Brain

This is the core of the product. How does a computer have a conversation?

### A. ASR (Automatic Speech Recognition)
*   *What it is:* Turns the candidate's spoken audio into written text. (e.g., OpenAI's Whisper model).
*   *How it works:* It takes the audio wave, turns it into a picture of sound (a spectrogram), and a neural network recognizes patterns in the picture to output words like "I know React."

### B. The Foundational LLM (Large Language Model)
*   *What it is:* Think of ChatGPT, Gemini, or Claude. It's a massive neural network trained on the entire internet.
*   *How it works:* It doesn't actually "think". It is the world's most advanced autocomplete. If you give it a **Prompt** (context), it predicts the most logical next words.
*   *How we use it:* We give it a hidden "System Prompt" before the interview starts: *"You are a strict but friendly Senior Engineer at Google. The candidate's resume says they know Python. Ask them a question about Python lists."* 
    When the ASR feeds the candidate's answer to the LLM, the LLM predicts the best follow-up question.

### C. TTS (Text-to-Speech)
*   *What it is:* Turns the LLM's written question back into a human voice (e.g., using models like ElevenLabs or Google TTS).
*   *How it works:* It uses deep learning to synthesize phonemes (the sounds of letters) and adds natural inflections, pauses, and breaths so it doesn't sound like a robot.

---

## 5. Integrity & Surveillance Engine: The Proctors

While the candidate is talking to the AI, we are secretly analyzing their video and screen streams.

### A. Computer Vision (Gaze & Face)
*   *How it works:* We use models like **MediaPipe**. It takes a single frame of video and draws an invisible 3D mesh over the candidate's face. By calculating the angle of the eyes on this mesh, the math can tell us exactly where the candidate is looking. If the math says "Pupils are looking 45 degrees to the left for 30 seconds," we flag it as suspicious.

### B. Audio Anomaly (Voice Biometrics)
*   *How it works:* **Speaker Diarization**. The AI maps the unique frequencies of the candidate's voice (their voiceprint). If a second voiceprint is detected (someone whispering answers in the background), the system flags it.

### C. Screen OCR (Optical Character Recognition)
*   *How it works:* We take screenshots of the candidate's shared screen. We pass it through an OCR engine (like Tesseract), which identifies letters in the image. If the text reads "chatgpt.com", we know they are cheating.

---

## 6. Training & Bias Mitigation: The Quality Control

We can't just trust a base LLM right out of the box. We have to train it.

*   **Embeddings & Vector Databases:** A normal database (Relational DB/SQL) stores things in tables (Row 1: John, Age 30). A **Vector DB** stores concepts as numbers in space. If the resume says "Next.js", the Vector DB knows it is mathematically close to "React". This allows the AI to understand the *meaning* of the resume, not just the keywords.
*   **Fine-Tuning:** A base LLM knows everything from Shakespeare to quantum physics. We give it thousands of examples of *our* company's past successful interviews. By slightly adjusting the "weights" (the math parameters) in the neural network, the AI becomes a specialized recruiter for *our* company.
*   **Continuous Bias Auditing:** Every night, we have a script (an automated robot) that fakes an interview with the AI. It gives the AI an identical transcript, but changes the name from "John" to "Mary". If the AI gives John a score of 90 and Mary a score of 80, the Auditor sounds an alarm, and the engineers have to fix the math to ensure fairness.

---

## 7. Putting it all together (A Single Interaction)

Here is how all these pieces play together in 2 seconds of real time:

1.  Candidate says, *"I used Kubernetes to scale our servers."*
2.  The **Client** captures the audio and uses **WebRTC** to send it to the **Gateway**.
3.  The Gateway puts the audio onto the **Kafka Event Bus**.
4.  The **ASR** picks it off Kafka, turns it into the text string: `"I used Kubernetes to scale our servers"`, and sends it to the **Orchestrator**.
5.  The Orchestrator packages this text, along with the candidate's anonymized resume from the **Profile Engine**, and sends it to the **Foundational LLM**.
6.  The **LLM** reads the context and generates: *"That's great. Can you explain how you managed pod autoscaling?"*
7.  The **TTS** turns that text into an audio file.
8.  The audio file travels back down through the **Gateway** via **WebRTC** to the **Client** speakers.
9.  *Meanwhile*, the **Vision AI** analyzed the candidate's face during this 2-second window and told the Orchestrator, *"No cheating detected."*

Everything happens so fast that the candidate just feels like they are talking to a human on a video call.
