import 'dotenv/config';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

/**
 * Extracts plain text from an uploaded file buffer or raw text string.
 * Supports PDF (.pdf), Word (.docx), plain text (.txt), and Photos (.jpg, .jpeg, .png, .webp).
 */
export async function extractText({ file, rawText, originalName }) {
  let extractedText = '';

  if (file && file.buffer) {
    const ext = path.extname(file.originalname || originalName || '').toLowerCase();
    const isImage = 
      ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) || 
      (file.mimetype && file.mimetype.startsWith('image/'));

    if (ext === '.pdf') {
      const pdfData = await pdfParse(file.buffer);
      extractedText = pdfData.text || '';
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      extractedText = result.value || '';
    } else if (ext === '.txt') {
      extractedText = file.buffer.toString('utf-8');
    } else if (isImage) {
      // Use Gemini Vision to transcribe the photo of study notes / exam questions
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const mimeType = file.mimetype || (ext === '.png' ? 'image/png' : 'image/jpeg');

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
        contents: [
          {
            inlineData: {
              mimeType,
              data: file.buffer.toString('base64')
            }
          },
          'You are an OCR and academic study assistant. Transcribe all readable handwritten or printed text, study notes, formulas, questions, options, and explanations from this image accurately and comprehensively. Preserve structure and content faithfully.'
        ]
      });

      extractedText = response.text || '';
    } else {
      // Fallback attempt text decoding
      extractedText = file.buffer.toString('utf-8');
    }
  } else if (typeof rawText === 'string') {
    extractedText = rawText;
  }

  // Normalize whitespace and strip invisible non-printable control characters
  const cleanedText = extractedText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();

  // Calculate statistics
  const characterCount = cleanedText.length;
  // Split on any whitespace sequence to count words accurately
  const words = cleanedText.length > 0 ? cleanedText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  // Validation Guardrails:
  // Reject notes with fewer than 40 characters
  if (characterCount < 40) {
    throw new Error(
      `Extracted content is too short (${characterCount} characters). Notes or document images must contain at least 40 characters for AI question generation.`
    );
  }

  // Reject notes greater than 25,000 words
  if (wordCount > 25000) {
    throw new Error(
      `Note content is too large (${wordCount.toLocaleString()} words). Maximum supported limit is 25,000 words.`
    );
  }

  // Generate SHA-256 fingerprint hash of the normalized content
  const contentHash = crypto
    .createHash('sha256')
    .update(cleanedText, 'utf-8')
    .digest('hex');

  return {
    cleanedText,
    characterCount,
    wordCount,
    contentHash
  };
}
