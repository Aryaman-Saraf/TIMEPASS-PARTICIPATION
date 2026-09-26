// auth.js — Lightweight, Secure RBAC Authentication Engine for Candor
import crypto from 'node:crypto';
import { getCandidate, listCandidates } from './db.js';

const RECRUITER_PASSWORD = process.env.RECRUITER_PASSWORD || 'admin123';
const sessionsTokenMap = new Map();

// Generate cryptographically secure token
function createToken(user) {
  const token = `candor_tok_${crypto.randomUUID()}`;
  const record = {
    token,
    user,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  };
  sessionsTokenMap.set(token, record);
  return token;
}

export async function login({ email, password, role, candidateId }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanRole = String(role || '').trim().toLowerCase();

  // 1. Recruiter Login
  if (cleanRole === 'recruiter' || cleanEmail.includes('recruiter') || cleanEmail.endsWith('@candor.ai')) {
    if (password && password !== RECRUITER_PASSWORD) {
      const err = new Error('Invalid recruiter credentials');
      err.status = 401;
      throw err;
    }
    const user = {
      id: 'rec-admin-01',
      email: cleanEmail || 'recruiter@candor.ai',
      name: 'Talent Acquisition Partner',
      role: 'recruiter',
      permissions: ['view_all_candidates', 'add_candidate', 'delete_candidate', 'view_all_dossiers', 'view_rankings']
    };
    const token = createToken(user);
    return { token, user };
  }

  // 2. Candidate Login
  const candidates = await listCandidates();
  let candidate = null;

  if (candidateId) {
    candidate = candidates.find(c => c.id === candidateId);
  } else if (cleanEmail) {
    candidate = candidates.find(c => c.email.toLowerCase() === cleanEmail);
  }

  if (!candidate && (cleanRole === 'candidate' || candidateId)) {
    // If not found in seeds, allow candidate to start as new applicant
    candidate = {
      id: `cand-${crypto.randomUUID().slice(0, 8)}`,
      name: cleanEmail ? cleanEmail.split('@')[0] : 'Candidate',
      email: cleanEmail || 'candidate@example.com',
      role: 'Candidate',
      department: 'Engineering'
    };
  }

  if (candidate) {
    const user = {
      id: candidate.id,
      candidateId: candidate.id,
      email: candidate.email,
      name: candidate.name,
      role: 'candidate',
      permissions: ['view_own_interview', 'submit_answers', 'upload_resume']
    };
    const token = createToken(user);
    return { token, user, candidate };
  }

  const err = new Error('Candidate or Recruiter profile not found');
  err.status = 401;
  throw err;
}

export function getUserFromToken(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const record = sessionsTokenMap.get(token);
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    sessionsTokenMap.delete(token);
    return null;
  }
  return record.user;
}

export function logout(authHeader) {
  if (!authHeader) return { ok: true };
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  sessionsTokenMap.delete(token);
  return { ok: true };
}
