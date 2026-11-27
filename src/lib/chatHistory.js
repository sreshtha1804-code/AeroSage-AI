/** Only genuine Gemini replies are sent back as context; fallback and error bubbles are not. */
export const toHistory = (messages) =>
  messages
    .filter((message) => message.role === 'user' || message.source === 'gemini')
    .map((message) => ({ role: message.role === 'user' ? 'user' : 'model', text: message.text }));

/** Normalise a server reply into a chat message, labelling where it came from. */
export const toAssistantMessage = (reply) => ({
  role: 'ai',
  text: reply.text,
  source: reply.source ?? (reply.ai ? 'gemini' : 'fallback'),
  note: reply.note,
});
