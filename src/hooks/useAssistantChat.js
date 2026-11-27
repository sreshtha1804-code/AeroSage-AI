import { useCallback, useRef, useState } from 'react';
import { errorMessage, sendChat } from '../lib/api.js';
import { toAssistantMessage, toHistory } from '../lib/chatHistory.js';

/**
 * Conversation state for the AI assistant. It lives above the chat page so the conversation
 * survives switching tabs. Replies keep their `source` ("gemini" | "fallback" | "error").
 */
export function useAssistantChat({ context, familyMembers }) {
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const send = useCallback(
    async (text) => {
      const message = text.trim();
      if (!message || inFlight.current || !context) {
        return;
      }
      inFlight.current = true;
      setBusy(true);
      const history = toHistory(messages);
      setMessages((current) => [...current, { role: 'user', text: message }]);
      try {
        const reply = await sendChat({ message, history, context, profile: familyMembers });
        setMessages((current) => [...current, toAssistantMessage(reply)]);
      } catch (error) {
        setMessages((current) => [
          ...current,
          { role: 'ai', text: errorMessage(error), source: 'error' },
        ]);
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [messages, context, familyMembers],
  );

  return { messages, busy, send };
}
