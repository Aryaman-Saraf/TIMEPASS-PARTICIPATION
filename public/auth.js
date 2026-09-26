/**
 * Candor AI - Screen 1 (Auth / Entry Gateway) Module
 * Handles dual portal role selection, candidate profile presets, and navigation.
 */

export const PRESET_CANDIDATES = [
  {
    id: 'cand-001',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@example.com',
    role: 'Senior Frontend Engineer',
    department: 'Core Product',
    jobDescription: 'Expertise in modern JavaScript, Web Audio API, responsive UI design, performance optimization, and Web Speech integration.',
    resumeText: 'Sarah Jenkins - Senior Frontend Architect with 6+ years experience in React, vanilla ES modules, Web APIs, and real-time dashboard UI development.'
  },
  {
    id: 'cand-002',
    name: 'Alex Chen',
    email: 'alex.chen@example.com',
    role: 'Senior Backend Engineer',
    department: 'Infrastructure',
    jobDescription: 'Deep knowledge of Node.js asynchronous I/O, REST API design, streaming data pipelines, LLM integration, and system reliability.',
    resumeText: 'Alex Chen - Staff Backend Engineer specializing in high-throughput microservices, Node.js HTTP servers, distributed caching, and LLM integrations.'
  },
  {
    id: 'cand-003',
    name: 'Jordan Lee',
    email: 'jordan.lee@example.com',
    role: 'Fullstack AI Architect',
    department: 'Platform & AI',
    jobDescription: 'End-to-end fullstack capability, LLM prompt engineering, evaluation metrics, voice AI pipelines, and client-side computer vision.',
    resumeText: 'Jordan Lee - Fullstack AI Lead with 5 years experience deploying client-side browser vision models, Node.js backends, and speech synthesis systems.'
  }
];

// Current active candidate state
let selectedCandidate = { ...PRESET_CANDIDATES[0] };

/**
 * Initialize Screen 1 interactive listeners and state
 */
export function initAuthScreen() {
  const nameInput = document.getElementById('candidate-name');
  const emailInput = document.getElementById('candidate-email');
  const roleInput = document.getElementById('candidate-role');

  const presetChips = document.querySelectorAll('.preset-chip');
  const candidateBtn = document.getElementById('btn-candidate-proceed');
  const recruiterBtn = document.getElementById('btn-recruiter-proceed');

  // Populate default inputs with Preset 1 (Sarah Jenkins)
  populateCandidateForm(selectedCandidate);

  // Preset Selection Handlers
  presetChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const presetId = chip.dataset.presetId;
      const preset = PRESET_CANDIDATES.find((c) => c.id === presetId);
      if (preset) {
        selectedCandidate = { ...preset };
        
        // Update active class
        presetChips.forEach((c) => c.classList.remove('selected'));
        chip.classList.add('selected');

        // Populate form inputs
        populateCandidateForm(selectedCandidate);
      }
    });
  });

  // Input Field Listeners for Custom Entries
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      selectedCandidate.name = e.target.value.trim() || 'Anonymous Candidate';
      deselectPresetsIfCustom(nameInput.value, selectedCandidate.id);
    });
  }

  if (emailInput) {
    emailInput.addEventListener('input', (e) => {
      selectedCandidate.email = e.target.value.trim() || 'candidate@candor.ai';
    });
  }

  if (roleInput) {
    roleInput.addEventListener('input', (e) => {
      selectedCandidate.role = e.target.value.trim() || 'Software Engineer';
    });
  }

  // Candidate Proceed Action
  if (candidateBtn) {
    candidateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      saveCandidateStateAndProceed();
    });
  }

  // Recruiter Proceed Action
  if (recruiterBtn) {
    recruiterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'recruiter-portal.html';
    });
  }

  // Check API Health
  checkApiHealth();
}

/**
 * Helper to populate text inputs from selected candidate profile
 */
function populateCandidateForm(candidate) {
  const nameInput = document.getElementById('candidate-name');
  const emailInput = document.getElementById('candidate-email');
  const roleInput = document.getElementById('candidate-role');

  if (nameInput) nameInput.value = candidate.name;
  if (emailInput) emailInput.value = candidate.email;
  if (roleInput) roleInput.value = candidate.role;
}

/**
 * Deselect preset pills if user types a custom name that doesn't match current preset
 */
function deselectPresetsIfCustom(typedName, currentPresetId) {
  const matchingPreset = PRESET_CANDIDATES.find((c) => c.id === currentPresetId);
  if (matchingPreset && typedName !== matchingPreset.name) {
    document.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('selected'));
    // Generate a new custom ID
    selectedCandidate.id = `cand-custom-${Date.now()}`;
  }
}

/**
 * Save current candidate info to localStorage & navigate to Candidate Dashboard (Screen 2)
 */
function saveCandidateStateAndProceed() {
  const nameInput = document.getElementById('candidate-name');
  const emailInput = document.getElementById('candidate-email');
  const roleInput = document.getElementById('candidate-role');

  const finalName = nameInput?.value.trim() || selectedCandidate.name || 'Candidate';
  const finalEmail = emailInput?.value.trim() || selectedCandidate.email || 'candidate@candor.ai';
  const finalRole = roleInput?.value.trim() || selectedCandidate.role || 'Software Engineer';

  const candidateData = {
    ...selectedCandidate,
    name: finalName,
    email: finalEmail,
    role: finalRole,
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem('candor_current_candidate', JSON.stringify(candidateData));
  window.location.href = 'candidate-dashboard.html';
}

/**
 * Fetch server health status to update status badge
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
    // Offline mode fallback
    statusChip.innerHTML = `<span class="status-dot" style="background-color: var(--warning);"></span> Offline Engine Mode`;
  }
}

// Auto-initialize when loaded as module
document.addEventListener('DOMContentLoaded', initAuthScreen);
