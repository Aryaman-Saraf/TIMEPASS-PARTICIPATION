// public/report.js — Candor Recruiter Dashboard & Evidence Dossier Scorecard

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  if (!iso) return 'Recent';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '—';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

function recPill(rec) {
  const r = (rec || '').toLowerCase();
  if (r.includes('strong hire')) return `<span class="pill good">${esc(rec)}</span>`;
  if (r.includes('hire')) return `<span class="pill good">${esc(rec)}</span>`;
  if (r.includes('lean')) return `<span class="pill ok">${esc(rec)}</span>`;
  if (r.includes('no hire')) return `<span class="pill bad">${esc(rec)}</span>`;
  return `<span class="pill">${esc(rec || 'Pending')}</span>`;
}

function riskPill(risk) {
  const r = (risk || '').toLowerCase();
  if (r === 'low') return `<span class="pill good">Low Risk</span>`;
  if (r === 'medium') return `<span class="pill ok">Medium Risk</span>`;
  if (r === 'high') return `<span class="pill bad">High Risk</span>`;
  return `<span class="pill">${esc(risk || 'Unknown')}</span>`;
}

function formatDots(diff) {
  const d = Math.max(1, Math.min(5, Number(diff) || 3));
  return '●'.repeat(d) + '○'.repeat(5 - d);
}

function findTurnForEvent(turns, eventAt) {
  if (!turns || !turns.length || !eventAt) return { index: 0, text: 'Q1' };
  const eventTime = new Date(eventAt).getTime();
  let candidateIndex = 0;
  let qNum = 1;
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.role === 'ai') {
      if (turn.t <= eventTime) {
        candidateIndex = i;
        qNum = (turn.qIndex !== undefined ? turn.qIndex + 1 : qNum);
      }
    }
  }
  return { index: candidateIndex, label: `Q${qNum}` };
}

// Built-in fallback renderer if public/integrity.js is not yet available from T3
function renderIntegrityFallback(el, integrity, turns) {
  if (!integrity || !integrity.captured) {
    el.innerHTML = `
      <div class="card">
        <h3>Fair Integrity & Attention Monitoring</h3>
        <p class="muted">No integrity telemetry was captured for this session (monitoring was uninitialized or not started).</p>
      </div>
    `;
    return;
  }

  const stats = integrity.stats || {};
  const events = integrity.events || [];
  const visionAvail = integrity.visionAvailable;
  const onScreenPct = stats.onScreenPct !== undefined ? stats.onScreenPct : (visionAvail ? 100 : 'n/a');

  let rowsHtml = '';
  if (!events.length) {
    rowsHtml = `<tr><td colspan="5" class="muted" style="text-align:center; padding:12px;">Zero anomalous attention events logged. Continuous focus verified.</td></tr>`;
  } else {
    rowsHtml = events.map((ev) => {
      const turnMapping = findTurnForEvent(turns, ev.at);
      const sevClass = ev.severity === 'high' ? 'pill bad' : (ev.severity === 'warn' ? 'pill ok' : 'pill');
      const detailStr = ev.detail ? Object.entries(ev.detail).map(([k, v]) => `${k}: ${v}`).join(', ') : '—';
      return `
        <tr>
          <td>${formatDuration(ev.t)}</td>
          <td><b>${esc(ev.type)}</b></td>
          <td>${ev.durationMs ? `${(ev.durationMs / 1000).toFixed(1)}s` : '—'}</td>
          <td><span class="${sevClass}">${esc(ev.severity || 'info')}</span></td>
          <td><a href="#turn-${turnMapping.index}">${esc(turnMapping.label)}</a> ${detailStr ? `<span class="muted">(${esc(detailStr)})</span>` : ''}</td>
        </tr>
      `;
    }).join('');
  }

  el.innerHTML = `
    <div class="card" style="border-left: 4px solid var(--accent, #6c8cff);">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <h3 style="margin:0;">Fair Integrity & Attention Telemetry</h3>
        <div>
          ${riskPill(integrity.riskLevel)}
          <span class="muted" style="margin-left:8px; font-size:13px;">Index: <b>${integrity.score ?? '—'}/100</b></span>
        </div>
      </div>
      
      <p class="muted" style="font-size:13px; margin: 8px 0 16px;">
        ⚠️ <b>Recruiter Notice:</b> Attention signals are strictly advisory context for human reviewers and are <b>never factored into candidate technical or hiring scores</b>.
        ${!visionAvail ? '<br><em>Note: Camera was not available; only tab switching and window blur were monitored.</em>' : ''}
      </p>

      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-bottom:16px;">
        <div class="card tile" style="margin:0; text-align:center; padding:12px;">
          <span class="muted" style="font-size:12px;">Integrity Confidence</span>
          <b style="color:var(--accent, #6c8cff);">${onScreenPct !== 'n/a' ? onScreenPct + '%' : 'n/a'}</b>
        </div>
        <div class="card tile" style="margin:0; text-align:center; padding:12px;">
          <span class="muted" style="font-size:12px;">Look-Aways</span>
          <b>${stats.lookAwayCount ?? 0}</b>
        </div>
        <div class="card tile" style="margin:0; text-align:center; padding:12px;">
          <span class="muted" style="font-size:12px;">Tab Switches</span>
          <b>${stats.tabHiddenCount ?? 0}</b>
        </div>
        <div class="card tile" style="margin:0; text-align:center; padding:12px;">
          <span class="muted" style="font-size:12px;">Multiple Faces</span>
          <b>${stats.multiFaceCount ?? 0}</b>
        </div>
      </div>

      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Duration</th>
              <th>Severity</th>
              <th>During Question & Details</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Main View 1: Sessions List
async function renderSessionsList(app) {
  app.innerHTML = `
    <header style="margin-bottom: 24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h1 style="margin:0 0 6px 0; font-size:26px;">Candor Recruiter Portal</h1>
          <p class="muted" style="margin:0;">Structured, low-bias screening candidate dossiers with verified evidence.</p>
        </div>
        <div style="display:flex; gap:8px;">
          <a href="/" style="text-decoration:none;"><button style="background:var(--card); color:var(--text); border:1px solid var(--border);">+ New Interview</button></a>
          <button id="refreshBtn" style="background:var(--accent); color:#fff; border:none;">Refresh</button>
        </div>
      </div>
    </header>

    <div class="card" style="padding:0; overflow:hidden;">
      <div style="padding:14px 16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:600;">Candidate Evaluation Archives</span>
        <span class="muted" id="sessionCount">Loading…</span>
      </div>
      <div class="scroll">
        <table id="sessionsTable">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Role</th>
              <th>Interview Date</th>
              <th>Overall Score</th>
              <th>Advisory Recommendation</th>
              <th>Integrity Risk</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="7" class="muted" style="padding:24px; text-align:center;">Fetching completed sessions…</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('refreshBtn')?.addEventListener('click', () => renderSessionsList(app));

  try {
    const [sessionsRes, rankRes] = await Promise.all([
      fetch('/api/sessions').then(r => r.json()).catch(() => []),
      fetch('/api/recruiter/rankings').then(r => r.json()).catch(() => null)
    ]);
    const sessions = Array.isArray(sessionsRes) ? sessionsRes : [];
    
    // Render Ranking Metrics Tiles if rankings are available
    if (rankRes && rankRes.totalEvaluated > 0) {
      const stats = rankRes.stats || {};
      const metricsContainer = document.createElement('div');
      metricsContainer.className = 'grid';
      metricsContainer.style.marginBottom = '20px';
      metricsContainer.innerHTML = `
        <div class="card tile" style="margin:0; text-align:center; padding:16px;">
          <span class="muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Evaluated Candidates</span>
          <b style="color:var(--accent);">${rankRes.totalEvaluated}</b>
          <span class="muted" style="font-size:11px;">100% Calibrated</span>
        </div>
        <div class="card tile" style="margin:0; text-align:center; padding:16px;">
          <span class="muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Talent Pool Average</span>
          <b style="color:#22c55e;">${rankRes.averageScore}/100</b>
          <span class="muted" style="font-size:11px;">BARS Rubric Mean</span>
        </div>
        <div class="card tile" style="margin:0; text-align:center; padding:16px;">
          <span class="muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Strong Hire Ratio</span>
          <b style="color:#38bdf8;">${stats.strongHire || 0}</b>
          <span class="muted" style="font-size:11px;">${rankRes.totalEvaluated ? Math.round(((stats.strongHire || 0)/rankRes.totalEvaluated)*100) : 0}% of cohort</span>
        </div>
        <div class="card tile" style="margin:0; text-align:center; padding:16px;">
          <span class="muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Standard Hire Ratio</span>
          <b style="color:#a855f7;">${stats.hire || 0}</b>
          <span class="muted" style="font-size:11px;">${rankRes.totalEvaluated ? Math.round(((stats.hire || 0)/rankRes.totalEvaluated)*100) : 0}% of cohort</span>
        </div>
      `;
      const header = app.querySelector('header');
      if (header && header.nextSibling) {
        header.parentNode.insertBefore(metricsContainer, header.nextSibling);
      }
    }

    const countEl = document.getElementById('sessionCount');
    const tbody = document.querySelector('#sessionsTable tbody');

    if (!sessions || !sessions.length) {
      if (countEl) countEl.textContent = '0 sessions';
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="padding:32px; text-align:center;" class="muted">
              No sessions found yet.<br><br>
              <a href="?id=mock-session-001"><button style="background:var(--accent); color:#fff; border:none;">Explore Alex Chen Benchmark Showcase</button></a>
            </td>
          </tr>
        `;
      }
      return;
    }

    if (countEl) countEl.textContent = `${sessions.length} session${sessions.length === 1 ? '' : 's'}`;

    if (tbody) {
      tbody.innerHTML = sessions.map(s => `
        <tr>
          <td>
            <a href="?id=${encodeURIComponent(s.id)}" style="font-weight:600; text-decoration:none;">
              ${esc(s.candidateName || 'Anonymous Candidate')}
            </a>
          </td>
          <td>${esc(s.role || 'Software Engineer')}</td>
          <td class="muted">${formatDate(s.createdAt)}</td>
          <td>
            <b style="font-size:16px; color:var(--accent);">${s.overallScore !== undefined && s.overallScore !== null ? s.overallScore + '/100' : '—'}</b>
          </td>
          <td>${recPill(s.recommendation)}</td>
          <td>${riskPill(s.integrityRisk)}</td>
          <td style="text-align:right;">
            <a href="?id=${encodeURIComponent(s.id)}" style="text-decoration:none;">
              <button style="background:transparent; border:1px solid var(--accent); color:var(--accent); padding:4px 10px; font-size:13px;">View Dossier →</button>
            </a>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    const tbody = document.querySelector('#sessionsTable tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding:24px; text-align:center; color:#ff6b6b;">
            Failed to load sessions: ${esc(err.message)}
          </td>
        </tr>
      `;
    }
  }
}

// Main View 2: Detailed Candidate Scorecard & Evidence Dossier
async function renderCandidateReport(app, id) {
  app.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <a href="report.html" style="text-decoration:none; color:var(--muted); font-size:14px;">← Back to Sessions</a>
      <div style="display:flex; gap:8px;">
        <button onclick="window.print()" style="background:var(--card); color:var(--text); border:1px solid var(--border);">🖨️ Export PDF / Print</button>
      </div>
    </div>
    <div class="card" style="text-align:center; padding:32px;">
      <p class="muted">Loading Candidate Evidence Dossier…</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/session?id=${encodeURIComponent(id)}`);
    if (!res.ok) {
      if (res.status === 404) throw new Error('Session not found (404)');
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    const s = await res.json();
    const rep = s.report || {};
    const comm = rep.communication || { clarity: 3, structure: 3, conciseness: 3, note: '' };
    const integ = s.integrity || {};

    // 1. Evidence Dossier Index Calculations
    const technicalRelevancy = rep.overallScore !== undefined ? rep.overallScore : (s.overallScore || 0);
    const articulation = Math.round((((comm.clarity + comm.structure + comm.conciseness) / 3 - 1) / 4) * 100);
    const integrityConfidence = integ.stats?.onScreenPct !== undefined
      ? `${integ.stats.onScreenPct}%`
      : (integ.visionAvailable ? '100%' : 'n/a');

    const totalDuration = s.integrity?.stats?.totalMs || (s.turns && s.turns.length >= 2 ? (s.turns[s.turns.length - 1].t - s.turns[0].t) : 0);

    // 2. Adaptive Path Turns
    const aiTurns = (s.turns || []).filter(t => t.role === 'ai');
    const adaptivePathRows = aiTurns.map((turn, idx) => {
      // Find following candidate answer
      const turnIndexInAll = s.turns.indexOf(turn);
      const nextTurn = s.turns[turnIndexInAll + 1];
      const ansScore = nextTurn && nextTurn.score !== undefined ? nextTurn.score : '—';
      const ansText = nextTurn ? nextTurn.text : 'Awaiting response…';
      const kindLabel = {
        'main': '★ Main Question',
        'probe': '↻ Adaptive Probe',
        'advance': '→ Next Question',
        'wrap_up': '✓ Wrap-Up'
      }[turn.kind] || (idx === 0 ? '★ Opening Question' : '→ Question');

      const badgeColor = turn.kind === 'probe' ? '#c084fc' : (turn.kind === 'wrap_up' ? '#34d399' : 'var(--accent)');

      return `
        <div style="border-left: 3px solid ${badgeColor}; padding-left:14px; margin-bottom:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <span class="pill" style="background:${badgeColor}22; color:${badgeColor}; border:1px solid ${badgeColor}44; font-size:12px;">
                ${esc(kindLabel)}
              </span>
              <span style="font-weight:600; margin-left:8px;">${esc(turn.competency || 'Evaluation')}</span>
            </div>
            <div style="font-size:13px;" class="muted">
              Difficulty: <span style="color:var(--text);">${formatDots(turn.difficulty)}</span>
              ${ansScore !== '—' ? `&nbsp;·&nbsp; Answer Score: <b style="color:var(--text);">${ansScore}/5</b>` : ''}
            </div>
          </div>
          
          <div style="margin: 8px 0 6px 0; font-size:14px; color:var(--text);">
            <b>Ava:</b> "${esc(turn.text)}"
          </div>

          ${nextTurn ? `
            <div style="font-size:13px; color:var(--muted); background:rgba(0,0,0,0.15); padding:8px 10px; border-radius:6px;">
              <b>Candidate:</b> "${esc(ansText.length > 220 ? ansText.slice(0, 220) + '…' : ansText)}"
              ${nextTurn.note ? `<div style="margin-top:4px; font-style:italic; color:#a5b4fc;">Reasoning: ${esc(nextTurn.note)}</div>` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // 3. Competencies Bars & Evidence Quotes
    const competenciesHtml = (rep.competencies || []).map(c => {
      const pct = Math.round((c.score / 5) * 100);
      const quotesHtml = (c.evidence || []).map(q => `<blockquote>"${esc(q)}"</blockquote>`).join('');
      return `
        <div style="margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
            <div>
              <span style="font-weight:600; font-size:15px;">${esc(c.name)}</span>
              <span class="muted" style="font-size:12px; margin-left:6px;">(Target: 1–5 BARS)</span>
            </div>
            <span style="font-weight:700; font-size:16px; color:var(--accent);">${c.score}/5</span>
          </div>
          <div class="bar" style="margin-bottom:8px;"><i style="width:${pct}%;"></i></div>
          <p style="margin:4px 0 8px 0; font-size:13px; color:var(--text);">${esc(c.rationale)}</p>
          ${quotesHtml ? `
            <div style="margin-top:6px;">
              <span class="muted" style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Verbatim Transcript Evidence:</span>
              ${quotesHtml}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // 4. STAR Breakdown Matrix
    const starRows = (rep.star || []).map(item => `
      <tr>
        <td style="font-weight:500;">${esc(item.question)}</td>
        <td style="text-align:center;">${item.situation ? '✅' : '⚪'}</td>
        <td style="text-align:center;">${item.task ? '✅' : '⚪'}</td>
        <td style="text-align:center;">${item.action ? '✅' : '⚪'}</td>
        <td style="text-align:center;">${item.result ? '✅' : '⚪'}</td>
        <td class="muted" style="font-size:13px;">${esc(item.note || '—')}</td>
      </tr>
    `).join('');

    // 5. Strengths & Gaps
    const strengthsHtml = (rep.strengths || []).map(st => `<li style="margin-bottom:6px;">${esc(st)}</li>`).join('');
    const gapsHtml = (rep.gaps || []).map(gap => `<li style="margin-bottom:6px;">${esc(gap)}</li>`).join('');

    // 6. Coaching & Candidate Feedback
    const coachingHtml = (rep.coaching || []).map(tip => `<li style="margin-bottom:6px;">${esc(tip)}</li>`).join('');
    const nextStepsHtml = (rep.nextSteps || []).map(step => `<li style="margin-bottom:6px;">${esc(step)}</li>`).join('');

    // 7. Full Chronological Transcript
    const transcriptHtml = (s.turns || []).map((t, idx) => `
      <div id="turn-${idx}" style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="font-weight:600; color:${t.role === 'ai' ? 'var(--accent)' : '#a7f3d0'}; font-size:13px;">
            ${t.role === 'ai' ? 'Ava (AI Interviewer)' : esc(s.candidateName || 'Candidate')}
          </span>
          <span class="muted" style="font-size:11px;">${formatDuration(t.t - (s.turns[0]?.t || t.t))}</span>
        </div>
        <div style="font-size:14px; line-height:1.5;">${esc(t.text)}</div>
      </div>
    `).join('');

    // Assemble Full DOM
    app.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
        <a href="report.html" style="text-decoration:none; color:var(--muted); font-size:14px;">← Back to All Sessions</a>
        <div style="display:flex; gap:8px;">
          <button onclick="window.print()" style="background:var(--card); color:var(--text); border:1px solid var(--border);">🖨️ Export PDF / Print</button>
        </div>
      </div>

      <!-- Header Card with Ring & Recommendation -->
      <div class="card" style="padding:24px; margin-top:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:20px;">
          <div style="flex:1; min-width:280px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
              <h1 style="margin:0; font-size:28px;">${esc(s.candidateName || 'Candidate Evaluation')}</h1>
              ${s.profile?.seniority ? `<span class="pill" style="font-size:12px; text-transform:capitalize;">${esc(s.profile.seniority)}</span>` : ''}
            </div>
            <div style="font-size:17px; color:var(--accent); font-weight:500; margin-bottom:8px;">${esc(s.role || 'Target Role')}</div>
            <div class="muted" style="font-size:13px;">
              Conducted on ${formatDate(s.createdAt)} &nbsp;·&nbsp; Total Duration: ${formatDuration(totalDuration)}
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:20px;">
            <div class="ring" style="--v:${technicalRelevancy};">
              ${technicalRelevancy}
            </div>
            <div>
              <div style="margin-bottom:4px;">${recPill(rep.recommendation || s.recommendation)}</div>
              <div class="muted" style="font-size:11px; max-width:180px;">
                Advisory, a human makes the final call
              </div>
            </div>
          </div>
        </div>

        ${s.profile?.summary ? `
          <div style="margin-top:18px; padding-top:16px; border-top:1px solid var(--border); font-size:14px; color:var(--muted);">
            <b>Profile Synopsis:</b> ${esc(s.profile.summary)}
          </div>
        ` : ''}
      </div>

      <!-- Evidence Dossier Header (3 Quantitative Index Tiles) -->
      <div class="card" style="padding:20px;">
        <h3 style="margin:0 0 14px 0; font-size:17px;">Explainable Evidence Dossier</h3>
        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
          <div class="card tile" style="margin:0; padding:16px; text-align:center;">
            <span class="muted" style="font-size:13px;">Technical Relevancy</span>
            <b style="color:var(--accent);">${technicalRelevancy}<span style="font-size:16px; font-weight:normal;">/100</span></b>
            <span class="muted" style="font-size:12px; margin-top:4px; display:block;">Weighted BARS domain competency score</span>
          </div>

          <div class="card tile" style="margin:0; padding:16px; text-align:center;">
            <span class="muted" style="font-size:13px;">Articulation & Delivery</span>
            <b style="color:#38bdf8;">${articulation}%</b>
            <span class="muted" style="font-size:12px; margin-top:4px; display:block;">Clarity (${comm.clarity}/5), Structure (${comm.structure}/5), Conciseness (${comm.conciseness}/5)</span>
          </div>

          <div class="card tile" style="margin:0; padding:16px; text-align:center;">
            <span class="muted" style="font-size:13px;">Integrity Confidence</span>
            <b style="color:#34d399;">${integrityConfidence}</b>
            <span class="muted" style="font-size:12px; margin-top:4px; display:block;">On-device visual attention stability</span>
          </div>
        </div>
      </div>

      <!-- Executive Summary -->
      ${rep.summary ? `
        <div class="card">
          <h3 style="margin:0 0 8px 0; font-size:16px;">Executive Evaluation Summary</h3>
          <p style="margin:0; font-size:14px; line-height:1.6; color:var(--text);">${esc(rep.summary)}</p>
        </div>
      ` : ''}

      <!-- Adaptive Path Section (Innovation Pillar) -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <h3 style="margin:0; font-size:16px;">Real-Time Adaptive Interview Path</h3>
            <p class="muted" style="margin:4px 0 0 0; font-size:12px;">Visualizing why Ava pivoted between follow-up probes and progressive difficulty.</p>
          </div>
          <span class="pill" style="background:var(--card); border:1px solid var(--border); font-size:12px;">${aiTurns.length} Turns</span>
        </div>
        <div style="margin-top:16px;">
          ${adaptivePathRows || '<p class="muted">No adaptive dialogue history recorded.</p>'}
        </div>
      </div>

      <!-- BARS Competency Breakdown -->
      <div class="card">
        <h3 style="margin:0 0 16px 0; font-size:16px;">Behaviorally Anchored Rating Scales (BARS)</h3>
        ${competenciesHtml || '<p class="muted">No competency breakdown available.</p>'}
      </div>

      <!-- Strengths and Gaps Side-by-Side -->
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
        <div class="card" style="border-top: 3px solid #34d399; margin:0;">
          <h3 style="margin:0 0 12px 0; font-size:15px; color:#34d399;">Key Demonstrated Strengths</h3>
          <ul style="margin:0; padding-left:18px; font-size:14px; line-height:1.5;">
            ${strengthsHtml || '<li class="muted">None documented</li>'}
          </ul>
        </div>
        <div class="card" style="border-top: 3px solid #f87171; margin:0;">
          <h3 style="margin:0 0 12px 0; font-size:15px; color:#f87171;">Observed Gaps & Growth Areas</h3>
          <ul style="margin:0; padding-left:18px; font-size:14px; line-height:1.5;">
            ${gapsHtml || '<li class="muted">None documented</li>'}
          </ul>
        </div>
      </div>

      <!-- STAR Answer Structural Analysis -->
      <div class="card">
        <h3 style="margin:0 0 12px 0; font-size:16px;">STAR Answer Structural Analysis</h3>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Question Focus</th>
                <th style="text-align:center; width:65px;">Situation</th>
                <th style="text-align:center; width:65px;">Task</th>
                <th style="text-align:center; width:65px;">Action</th>
                <th style="text-align:center; width:65px;">Result</th>
                <th>Observation Note</th>
              </tr>
            </thead>
            <tbody>
              ${starRows || '<tr><td colspan="6" class="muted" style="text-align:center;">No STAR assessments recorded.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Integrity Section (Container for T3 or Fallback) -->
      <div id="integrityMount"></div>

      <!-- Coaching & Next Steps -->
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
        <div class="card" style="margin:0;">
          <h3 style="margin:0 0 10px 0; font-size:15px;">Candidate Growth Coaching</h3>
          <ul style="margin:0; padding-left:18px; font-size:13px; line-height:1.5;">
            ${coachingHtml || '<li class="muted">No coaching tips provided</li>'}
          </ul>
        </div>
        <div class="card" style="margin:0;">
          <h3 style="margin:0 0 10px 0; font-size:15px;">Recommended Next Steps</h3>
          <ul style="margin:0; padding-left:18px; font-size:13px; line-height:1.5;">
            ${nextStepsHtml || '<li class="muted">No next steps defined</li>'}
          </ul>
        </div>
      </div>

      <!-- Collapsible Full Chronological Transcript -->
      <div class="card">
        <details>
          <summary style="font-weight:600; cursor:pointer; font-size:15px;">
            Full Verbatim Interview Transcript (${(s.turns || []).length} utterances)
          </summary>
          <div style="margin-top:14px; max-height:480px; overflow-y:auto; padding-right:8px;">
            ${transcriptHtml}
          </div>
        </details>
      </div>
    `;

    // 8. Mount Integrity Section dynamically
    const integrityMount = document.getElementById('integrityMount');
    if (integrityMount) {
      try {
        const integrityMod = await import('./integrity.js');
        if (typeof integrityMod.renderIntegrity === 'function') {
          integrityMod.renderIntegrity(integrityMount, s.integrity, s.turns);
        } else {
          renderIntegrityFallback(integrityMount, s.integrity, s.turns);
        }
      } catch {
        // Fallback gracefully if integrity.js is absent or threw
        renderIntegrityFallback(integrityMount, s.integrity, s.turns);
      }
    }

  } catch (err) {
    app.innerHTML = `
      <div style="margin-bottom:16px;">
        <a href="report.html" style="text-decoration:none; color:var(--muted); font-size:14px;">← Back to Sessions</a>
      </div>
      <div class="card" style="text-align:center; padding:32px; border-color:#ff6b6b;">
        <h2 style="color:#ff6b6b; margin-top:0;">Failed to Load Dossier</h2>
        <p class="muted">${esc(err.message)}</p>
        <a href="report.html"><button style="margin-top:12px; background:var(--accent); color:#fff; border:none;">Return to Directory</button></a>
      </div>
    `;
  }
}

// Router init
document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (!app) return;
  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  if (id) {
    renderCandidateReport(app, id);
  } else {
    renderSessionsList(app);
  }
});
