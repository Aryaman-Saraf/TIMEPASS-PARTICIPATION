// resumeParser.js — Zero-dependency Resume Extraction & PII Redaction Engine
import zlib from 'node:zlib';
import { redactPII } from './engine.js';

/**
 * Extracts plain text from an uncompressed or FlateDecode compressed PDF buffer
 */
export function extractTextFromPDF(buffer) {
  let fullText = '';
  const str = buffer.toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = streamRegex.exec(str)) !== null) {
    const rawStream = Buffer.from(match[1], 'latin1');
    let decompressed;
    try {
      decompressed = zlib.inflateSync(rawStream);
    } catch {
      try {
        decompressed = zlib.inflateRawSync(rawStream);
      } catch {
        decompressed = rawStream; // Not compressed
      }
    }

    const content = decompressed.toString('latin1');
    // Match text operations: (text) Tj and [(t) (e) (x) (t)] TJ
    const textMatches = content.match(/\((.*?)\)\s*Tj|\[(.*?)\]\s*TJ/g);
    if (textMatches) {
      for (const tm of textMatches) {
        // Extract string within parentheses
        const inner = tm.match(/\((.*?)\)/g);
        if (inner) {
          const line = inner.map(s => s.slice(1, -1)).join(' ');
          fullText += line + ' ';
        }
      }
    }
  }

  // Clean up any remaining non-printable PDF artifacts
  const clean = fullText.replace(/\\([()\\])/g, '$1')
                        .replace(/[^\x20-\x7E\t\n\r]/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
  return clean || str.slice(0, 1000).replace(/[^\x20-\x7E\t\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Parse an incoming resume payload (raw text, file buffer, or base64)
 */
export function parseResumePayload({ text, base64, filename, candidateName }) {
  let rawText = '';

  if (base64) {
    const buffer = Buffer.from(base64, 'base64');
    const isPDF = (filename && filename.toLowerCase().endsWith('.pdf')) || buffer.slice(0, 4).toString() === '%PDF';
    if (isPDF) {
      rawText = extractTextFromPDF(buffer);
    } else {
      rawText = buffer.toString('utf8');
    }
  } else if (text) {
    rawText = String(text);
  }

  // Normalize whitespace
  const cleaned = rawText.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean).length;

  // Run privacy redaction
  const sanitized = redactPII(cleaned, candidateName);

  return {
    rawText: cleaned,
    sanitizedText: sanitized,
    wordCount: words,
    characterCount: cleaned.length,
    preview: cleaned.slice(0, 300)
  };
}
