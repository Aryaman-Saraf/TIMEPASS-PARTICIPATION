/**
 * Candor AI - Screen 5 (Post-Interview Completion Screen) Module
 */

export async function initCompletionScreen() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('id');

  let session = null;

  if (sessionId) {
    try {
      const res = await fetch(`/api/session?id=${sessionId}`);
      if (res.ok) {
        session = await res.json();
      }
    } catch (err) {
      console.warn('Could not fetch evaluated session from API:', err);
    }
  }

  if (!session) {
    try {
      const stored = localStorage.getItem('candor_evaluated_session');
      const parsed = stored && JSON.parse(stored);
      if (parsed && parsed.id === sessionId) session = parsed;
    } catch (e) {}
  }

  if (!session) {
    try {
      const storedCand = localStorage.getItem('candor_current_candidate');
      if (storedCand) {
        const cand = JSON.parse(storedCand);
        session = {
          id: `sess-${Date.now().toString().slice(-6)}`,
          candidateName: cand.name || 'Candidate',
          role: cand.role || 'Senior Frontend Engineer',
          createdAt: new Date().toISOString()
        };
      }
    } catch (e) {}
  }

  if (!session) session = { id: '', candidateName: 'Candidate', role: '', createdAt: new Date().toISOString() };

  // Populate UI Meta Elements
  const nameEl = document.getElementById('completion-candidate-name');
  const roleEl = document.getElementById('completion-role');
  const sessIdEl = document.getElementById('completion-session-id');
  const timeEl = document.getElementById('completion-timestamp');

  if (nameEl) nameEl.textContent = session.candidateName || 'Candidate';
  if (roleEl) roleEl.textContent = session.role || 'Senior Software Engineer';
  if (sessIdEl) sessIdEl.textContent = session.id || 'sess-default';
  if (timeEl) {
    const d = session.createdAt ? new Date(session.createdAt) : new Date();
    timeEl.textContent = d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Button Listeners
  const returnHomeBtn = document.getElementById('btn-return-home');
  const viewRecruiterBtn = document.getElementById('btn-view-recruiter');

  if (returnHomeBtn) {
    returnHomeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'index.html';
    });
  }

  if (viewRecruiterBtn) {
    viewRecruiterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetUrl = session.id ? `recruiter-portal.html?id=${session.id}` : 'recruiter-portal.html';
      window.location.href = targetUrl;
    });
  }

  // Check API Health
  checkApiHealth();
}

/**
 * Check API Health Status
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

document.addEventListener('DOMContentLoaded', initCompletionScreen);
