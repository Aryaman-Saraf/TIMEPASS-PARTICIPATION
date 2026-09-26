export function initCandidateDashboard() {
  let candidate = null;
  try {
    const stored = localStorage.getItem('candor_current_candidate');
    if (stored) candidate = JSON.parse(stored);
  } catch (err) { console.warn('Failed to parse candidate:', err); }

  if (!candidate) {
    candidate = {
      id: 'cand-001',
      name: 'Sarah Jenkins',
      email: 'sarah.jenkins@example.com',
      role: 'Senior Frontend Engineer',
      department: 'Core Product',
      jobDescription: 'Expertise in modern JavaScript, Web Audio API, responsive UI design, performance optimization, and Web Speech integration.',
      resumeText: 'Sarah Jenkins - Senior Frontend Architect with 6+ years experience in React, vanilla ES modules, Web APIs, and real-time dashboard UI development.'
    };
  }

  const nameEl = document.getElementById('dash-candidate-name');
  const emailEl = document.getElementById('dash-candidate-email');
  const avatarEl = document.getElementById('dash-candidate-avatar');
  if (nameEl) nameEl.textContent = candidate.name || 'Candidate';
  if (emailEl) emailEl.textContent = candidate.email || 'candidate@example.com';
  if (avatarEl) {
    avatarEl.textContent = (candidate.name || 'C').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  }

  const roleTitleEl = document.getElementById('dash-role-title');
  const jdTextEl = document.getElementById('dash-jd-text');
  if (roleTitleEl) roleTitleEl.textContent = candidate.role || 'Senior Software Engineer';
  if (jdTextEl) jdTextEl.textContent = candidate.jobDescription || 'Expertise in core architecture and engineering standards.';

  const resumeTextarea = document.getElementById('resume-text-input');
  const saveResumeBtn = document.getElementById('btn-save-resume');
  const saveNotice = document.getElementById('resume-save-notice');

  if (resumeTextarea) {
    resumeTextarea.value = candidate.resumeText || '';
    resumeTextarea.addEventListener('input', () => { candidate.resumeText = resumeTextarea.value; });
  }

  const dropZone = document.getElementById('resume-drop-zone');
  const fileInput = document.getElementById('resume-file-input');
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileRead(e.dataTransfer.files[0], resumeTextarea, candidate);
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleFileRead(e.target.files[0], resumeTextarea, candidate);
    });
  }

  if (saveResumeBtn) {
    saveResumeBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const updatedText = resumeTextarea ? resumeTextarea.value : candidate.resumeText;
      candidate.resumeText = updatedText;
      localStorage.setItem('candor_current_candidate', JSON.stringify(candidate));
      try {
        await fetch('/api/candidate/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidateId: candidate.id, resumeText: updatedText })
        });
      } catch (err) {}
      if (saveNotice) {
        saveNotice.style.display = 'inline-flex';
        setTimeout(() => { saveNotice.style.display = 'none'; }, 3000);
      }
    });
  }

  const proceedBtn = document.getElementById('btn-start-preflight');
  if (proceedBtn) {
    proceedBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.setItem('candor_current_candidate', JSON.stringify(candidate));
      window.location.href = 'preflight.html';
    });
  }

  checkApiHealth();
}

function handleFileRead(file, textareaEl, candidateRef) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    const text = evt.target.result;
    if (textareaEl) textareaEl.value = text;
    candidateRef.resumeText = text;
    localStorage.setItem('candor_current_candidate', JSON.stringify(candidateRef));
  };
  reader.readAsText(file);
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

document.addEventListener('DOMContentLoaded', initCandidateDashboard);
