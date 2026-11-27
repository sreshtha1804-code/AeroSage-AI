import express from 'express';
import {
  buildFallbackReply,
  buildSystemInstruction,
  FALLBACK_NOTES,
  validateReply,
} from '../domain/assistant.js';
import {
  MAX_MESSAGE_LENGTH,
  sanitizeContext,
  sanitizeHistory,
  sanitizeProfile,
} from '../utils/validation.js';

/**
 * POST /api/chat
 * Replies are always labelled: `source: "gemini"` for model output, `source: "fallback"` for
 * rule-based guidance. A fallback is never presented as AI-generated.
 *
 * @param {object} deps
 * @param {ReturnType<import('../services/gemini.js').createGeminiClient> | null} deps.gemini null when no key is configured
 */
export function createChatRouter({ gemini, limiter, logger }) {
  const router = express.Router();

  router.post('/', limiter, async (req, res) => {
    const { message, history, context, profile } = req.body || {};
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Please enter a message.' });
    }

    const userMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);
    const safeContext = sanitizeContext(context);
    const fallback = (reason) => ({
      text: buildFallbackReply(safeContext),
      ai: false,
      source: 'fallback',
      note: FALLBACK_NOTES[reason],
    });

    if (!gemini) {
      logger.error('[Gemini] GEMINI_API_KEY is not configured.');
      return res.json(fallback('not_configured'));
    }

    const result = await gemini.generate({
      systemInstruction: buildSystemInstruction(safeContext, sanitizeProfile(profile)),
      contents: [...sanitizeHistory(history), { role: 'user', parts: [{ text: userMessage }] }],
    });
    if (!result.ok) {
      return res.json(fallback(result.reason));
    }

    const { text, truncated } = validateReply(result.text, { alreadyTruncated: result.truncated });
    return res.json({ text, ai: true, source: 'gemini', truncated });
  });

  return router;
}
