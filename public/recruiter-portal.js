/**
 * Candor AI - Screen 6 (Recruiter Pipeline & Evidence Dossier Portal) ES Module
 * Handles candidate roster management, BARS scorecards, and Integrity Dossier rendering.
 */

import { renderIntegrity } from './integrity.js';

let candidatesList = [];
let sessionsMap = new Map();

export async function initRecruiterPortal() {
  const urlParams = new URLSearchParams(window.location.search);
  const targetSessionId = urlParams.get('id');

  // Load Candidate Roster & Sessions
  await loadPipelineData();

  // Setup Event Listeners
  setupEventListeners();

  // If session ID specified in URL, jump directly to Dossier Detail View
  if (targetSessionId) {
    inspectDossier(targetSessionId);
  } else {
    renderPipelineRoster();
  }

  // Check API Health
  checkApiHealth();
}

/**
 * Fetch candidate roster and session evaluations
 */
async function loadPipelineData() {
  try {
    const res = await fetch('/api/candidates');
    if (res.ok) {
      candidatesList = await res.json();
    }
  } catch (err) {
    console.warn('Could not fetch candidates from API:', err);
  }

  try {
    const res = await fetch('/api/sessions');
    if (res.ok) {
      const sessionsArr = await res.json();
      sessionsArr.forEach((s) => {
        const key = (s.candidateName || '').toLowerCase();
        if (key && !sessionsMap.has(key)) sessionsMap.set(key, s);
      });
    }
  } catch (err) {
    console.warn('Could not fetch sessions from API:', err);
  }

}

/**
 * Render Pipeline Roster Table
 */
function renderPipelineRoster() {
  const tbody = document.getElementById('pipeline-tbody');
  const countBadge = document.getElementById('candidate-count-badge');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (countBadge) countBadge.textContent = `${candidatesList.length} Active Candidates`;

  candidatesList.forEach((cand) => {
    const session = sessionsMap.get((cand.name || '').toLowerCase()) || {};
    const score = cand.overallScore ?? session.overallScore ?? '—';
    const rec = cand.recommendation || session.recommendation || (cand.status === 'completed' ? 'Evaluated' : 'Pending');
    const risk = (cand.integrityRisk || session.integrityRisk || 'low').toLowerCase();

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong style="color: var(--text-heading); font-size: 0.95rem;">${escapeHTML(cand.name)}</strong>
      </td>
      <td>
        <span style="color: var(--muted);">${escapeHTML(cand.role)}</span>
      </td>
      <td>
        <span class="locked-chip" style="background: rgba(108,140,255,0.1); color: var(--accent);">
          ${cand.status === 'completed' ? '✓ Completed' : '⏳ Scheduled'}
        </span>
      </td>
      <td>
        <strong style="color: var(--accent); font-size: 1rem;">${cand.status === 'completed' ? `${score}%` : '—'}</strong>
      </td>
      <td>
        <span class="rec-pill ${getRecClass(rec)}">${escapeHTML(rec)}</span>
      </td>
      <td>
        <span class="status-chip ${getRiskClass(risk)}" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;">
          ${escapeHTML(risk.toUpperCase())}
        </span>
      </td>
      <td>
        <button class="btn btn-inspect" data-session-id="${session.id || cand.id}" style="width: auto; padding: 0.35rem 0.75rem; font-size: 0.8rem; background: rgba(108,140,255,0.15); color: var(--accent); border: 1px solid rgba(108,140,255,0.3);">
          Inspect Dossier ↗
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Attach inspect click handlers
  document.querySelectorAll('.btn-inspect').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.sessionId;
      inspectDossier(id);
    });
  });
}

/**
 * Inspect Evidence Dossier Detail View for specified Session ID
 */
async function inspectDossier(sessionId) {
  let session = null;

  try {
    const res = await fetch(`/api/session?id=${sessionId}`);
    if (res.ok) {
      session = await res.json();
    }
  } catch (err) {
    console.warn('Could not fetch session details:', err);
  }

  if (!session) {
    try {
      const stored = localStorage.getItem('candor_evaluated_session');
      const parsed = stored && JSON.parse(stored);
      if (parsed && parsed.id === sessionId) session = parsed;
    } catch (e) {}
  }

  if (!session || !session.report) {
    document.getElementById('view-pipeline-roster').style.display = 'none';
    document.getElementById('view-candidate-dossier').style.display = 'block';
    document.getElementById('dossier-name').textContent = session?.candidateName || 'No evaluated interview';
    document.getElementById('dossier-role').textContent = session
      ? 'Interview not finished yet — no scores until it is evaluated.'
      : 'This candidate has not completed an interview yet.';
    for (const id of ['tile-tech-score', 'tile-delivery-score', 'tile-integrity-score']) document.getElementById(id).textContent = '—';
    const pill = document.getElementById('dossier-rec-pill');
    if (pill) { pill.textContent = 'Pending'; pill.className = 'rec-pill'; }
    renderBARSSection([]);
    const ic = document.getElementById('integrity-audit-container');
    if (ic) ic.innerHTML = '';
    return;
  }

  // Switch View Modes
  document.getElementById('view-pipeline-roster').style.display = 'none';
  document.getElementById('view-candidate-dossier').style.display = 'block';

  // Populate Header Meta
  document.getElementById('dossier-name').textContent = session.candidateName || 'Candidate';
  document.getElementById('dossier-role').textContent = `${session.role || 'Software Engineer'} · Core Product`;

  const rec = session.report.recommendation || 'Pending';
  const recPill = document.getElementById('dossier-rec-pill');
  if (recPill) {
    recPill.textContent = rec;
    recPill.className = `rec-pill ${getRecClass(rec)}`;
    let full = document.getElementById('dossier-full-link');
    if (!full) {
      full = document.createElement('a');
      full.id = 'dossier-full-link';
      full.style.cssText = 'margin-left:0.75rem;font-size:0.85rem;color:var(--accent);';
      full.textContent = 'Full evidence dossier ↗';
      recPill.after(full);
    }
    full.href = `report.html?id=${encodeURIComponent(session.id)}`;
  }

  // Populate 3 Quantitative Index Tiles
  const techScore = session.report.overallScore ?? '—';
  const comm = session.report?.communication || {};
  const commVals = [comm.clarity, comm.structure, comm.conciseness].filter(Number.isFinite);
  const deliveryScore = commVals.length ? Math.round(commVals.reduce((a, b) => a + b, 0) / commVals.length * 20) : '—';
  const integrityScore = session.integrity?.captured ? (session.integrity.score ?? session.integrity.stats?.onScreenPct ?? '—') : '—';

  const pct = v => (typeof v === 'number' ? `${v}%` : '—');
  document.getElementById('tile-tech-score').textContent = pct(techScore);
  document.getElementById('tile-delivery-score').textContent = pct(deliveryScore);
  document.getElementById('tile-integrity-score').textContent = pct(integrityScore);

  // Render BARS Competency Scorecard
  renderBARSSection(session.report?.competencies || []);

  // Render Suryansh's Integrity Audit Dossier
  const integrityContainer = document.getElementById('integrity-audit-container');
  renderIntegrity(integrityContainer, session.integrity || {}, session.turns || []);
}

/**
 * Render BARS Competencies list with verbatim quotes
 */
function renderBARSSection(competencies) {
  const container = document.getElementById('bars-container');
  if (!container) return;

  container.innerHTML = '';

  if (!competencies || competencies.length === 0) {
    container.innerHTML = '<div style="color: var(--muted);">No BARS rubric data available for this candidate.</div>';
    return;
  }

  competencies.forEach((comp) => {
    const item = document.createElement('div');
    item.className = 'bars-item';

    const quoteHtml = (comp.evidence && comp.evidence.length > 0)
      ? `<div class="evidence-quote">${escapeHTML(comp.evidence[0])}</div>`
      : '';

    item.innerHTML = `
      <div class="bars-item-header">
        <span class="bars-name">${escapeHTML(comp.name)}</span>
        <span class="bars-score">BARS Level ${comp.score ?? '—'} / 5</span>
      </div>
      <div style="font-size: 0.85rem; color: var(--muted);">${escapeHTML(comp.rationale || '')}</div>
      ${quoteHtml}
    `;

    container.appendChild(item);
  });
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  const addModal = document.getElementById('add-candidate-modal');
  const openModalBtn = document.getElementById('btn-open-add-modal');
  const closeModalBtn = document.getElementById('btn-close-modal');
  const saveCandidateBtn = document.getElementById('btn-save-candidate');

  const backBtn = document.getElementById('btn-back-to-pipeline');
  const printBtn = document.getElementById('btn-print-dossier');

  if (openModalBtn && addModal) {
    openModalBtn.addEventListener('click', () => { addModal.style.display = 'flex'; });
  }

  if (closeModalBtn && addModal) {
    closeModalBtn.addEventListener('click', () => { addModal.style.display = 'none'; });
  }

  if (saveCandidateBtn) {
    saveCandidateBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('modal-cand-name');
      const roleInput = document.getElementById('modal-cand-role');
      const jdInput = document.getElementById('modal-cand-jd');

      const name = nameInput?.value.trim() || 'New Candidate';
      const role = roleInput?.value.trim() || 'Software Engineer';
      const jd = jdInput?.value.trim() || 'Key competencies';

      const newCand = {
        id: `cand-${Date.now().toString().slice(-4)}`,
        name,
        role,
        department: 'Engineering',
        jobDescription: jd,
        resumeText: `${name} resume text`,
        status: 'scheduled',
        recommendation: 'Pending',
        integrityRisk: 'none'
      };

      candidatesList.push(newCand);

      // Attempt POST /api/candidates
      try {
        await fetch('/api/candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newCand)
        });
      } catch (err) {}

      if (addModal) addModal.style.display = 'none';
      renderPipelineRoster();
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      document.getElementById('view-candidate-dossier').style.display = 'none';
      document.getElementById('view-pipeline-roster').style.display = 'block';
    });
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }
}

function getRecClass(rec) {
  const r = (rec || '').toLowerCase();
  if (r.includes('strong')) return 'rec-strong-hire';
  if (r.includes('hire')) return 'rec-hire';
  return 'rec-hold';
}

function getRiskClass(risk) {
  const r = (risk || '').toLowerCase();
  if (r === 'high') return 'chip-danger';
  if (r === 'medium' || r === 'med') return 'chip-warning';
  return 'chip-success';
}

function escapeHTML(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

document.addEventListener('DOMContentLoaded', initRecruiterPortal);
