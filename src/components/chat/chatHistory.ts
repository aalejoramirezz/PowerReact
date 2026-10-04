import type { ChatMessage } from '../../types';

export const WELCOME_MESSAGE_ID = 'welcome';

/** Last N exchanged turns are enough context for follow-ups without bloating the request. */
const MAX_HISTORY_TURNS = 6;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const isTurn = (m: ChatMessage): m is ChatMessage & { role: ChatTurn['role'] } =>
  m.role === 'user' || m.role === 'assistant';

/**
 * Real conversation turns only: no canned welcome, no error bubbles, and no question
 * whose answer failed (the agent never saw a reply to it).
 */
export function buildHistory(messages: ChatMessage[]): ChatTurn[] {
  return messages
    .filter((m, i) => {
      if (m.id === WELCOME_MESSAGE_ID || m.error) return false;
      return !(m.role === 'user' && messages[i + 1]?.error);
    })
    .filter(isTurn)
    .slice(-MAX_HISTORY_TURNS)
    .map(({ role, content }) => ({ role, content }));
}
