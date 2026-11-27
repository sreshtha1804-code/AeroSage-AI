/** JSON 404 for unknown API paths (so a typo never receives the SPA shell). */
export const apiNotFound = (_req, res) => res.status(404).json({ error: 'Not found.' });

/**
 * Last-resort error handler. Responses never contain stack traces or internal messages;
 * the details go to the (redacting) logger only.
 */
export const createErrorHandler =
  (logger) =>
  // Express identifies error handlers by their four-argument signature.

  (err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body is not valid JSON.' });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large.' });
    }
    logger.error('[Unhandled]', { message: err?.message });
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  };
