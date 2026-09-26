// api/index.js — Vercel Serverless Entrypoint for Candor API
import { handleRequest, load } from '../server.js';

let initialized = false;

export default async function handler(req, res) {
  if (!initialized) {
    try {
      await load();
    } catch (e) {
      console.warn('[Vercel Serverless] DB init warning:', e.message);
    }
    initialized = true;
  }
  return handleRequest(req, res);
}
