import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../types';
import { buildHistory, WELCOME_MESSAGE_ID } from './chatHistory';

const msg = (id: string, role: ChatMessage['role'], content: string, error = false): ChatMessage => ({
  id,
  role,
  content,
  timestamp: '10:00',
  error,
});

describe('buildHistory', () => {
  it('drops the welcome message, errors and the question that failed', () => {
    const history = buildHistory([
      msg(WELCOME_MESSAGE_ID, 'assistant', 'Hello!'),
      msg('1', 'user', 'Total assets?'),
      msg('2', 'assistant', '10,000'),
      msg('3', 'user', 'By class?'),
      msg('4', 'assistant', 'Connection error', true),
      msg('5', 'system', 'note'),
    ]);
    expect(history).toEqual([
      { role: 'user', content: 'Total assets?' },
      { role: 'assistant', content: '10,000' },
    ]);
  });

  it('keeps only the most recent turns', () => {
    const many = Array.from({ length: 10 }, (_, i) => msg(String(i), i % 2 ? 'assistant' : 'user', `m${i}`));
    expect(buildHistory(many).map((t) => t.content)).toEqual(['m4', 'm5', 'm6', 'm7', 'm8', 'm9']);
  });
});
