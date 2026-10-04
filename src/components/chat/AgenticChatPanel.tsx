import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bot, Check, Copy, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { ApiError, postJson } from '../../api/http';
import type { ChatMessage } from '../../types';
import { cx } from '../ui/cx';
import { StatusChip } from '../ui/primitives';
import { buildHistory, WELCOME_MESSAGE_ID } from './chatHistory';
import { MarkdownMessage } from './MarkdownMessage';

interface AgenticChatPanelProps {
  onClose: () => void;
  workspaceId?: string;
  agentId?: string;
}

interface DataAgentResponse {
  success: true;
  endpointUsed: string;
  data?: {
    response?: string;
    result?: { content?: Array<{ type: string; text?: string }> };
  };
}

const QUICK_PROMPTS = [
  'What is the total asset count in the model?',
  'Which asset class has the highest depreciable cost?',
  'What is the total Fair Value and Fair Value Uplift?',
];

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

let messageSeq = 0;
const newMessageId = () => `msg-${Date.now()}-${messageSeq++}`;

const welcomeMessage = (): ChatMessage => ({
  id: WELCOME_MESSAGE_ID,
  role: 'assistant',
  content:
    '👋 **Hello!** I am your **Fabric Data Agent**, connected in real time to your asset valuation data via Direct Lake.\n\nYou can ask me any question about the **Asset Valuation Register** data shown on your screen:',
  timestamp: now(),
});

function answerText(response: DataAgentResponse): string {
  if (response.data?.response) return response.data.response;
  const texts = (response.data?.result?.content ?? [])
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text);
  return texts.length > 0 ? texts.join('\n\n') : '_The Data Agent returned an empty answer._';
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    return `⚠️ **Data Agent Error:** ${error.message}${error.hint ? `\n\n${error.hint}` : ''}`;
  }
  return `❌ **Connection error:** ${error instanceof Error ? error.message : 'Network request failed'}`;
}

export const AgenticChatPanel: React.FC<AgenticChatPanelProps> = ({
  onClose,
  workspaceId = 'ef45c53d-42d4-48c6-be79-380b8d890c80',
  agentId = '783d6c28-09b3-45c3-9350-adf609ac110e',
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage()]);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Drop any in-flight answer when the panel goes away
  useEffect(() => () => requestRef.current?.abort(), []);

  const handleSend = async (questionToSend?: string) => {
    const text = (questionToSend ?? prompt).trim();
    if (!text || loading) return;

    const history = buildHistory(messages);
    setMessages((prev) => [...prev, { id: newMessageId(), role: 'user', content: text, timestamp: now() }]);
    if (!questionToSend) setPrompt('');
    setLoading(true);

    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const response = await postJson<DataAgentResponse>(
        '/api/fabric/data-agent/query',
        { workspaceId, agentId, prompt: text, history },
        controller.signal
      );
      setMessages((prev) => [
        ...prev,
        { id: newMessageId(), role: 'assistant', content: answerText(response), timestamp: now(), data: response.data },
      ]);
    } catch (err) {
      if (controller.signal.aborted) return;
      setMessages((prev) => [
        ...prev,
        { id: newMessageId(), role: 'assistant', content: errorText(err), timestamp: now(), error: true },
      ]);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  };

  const handleReset = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(false);
    setMessages([welcomeMessage()]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      className="relative flex h-full w-full flex-col border-l border-u-panel-border bg-u-panel-bg text-u-text backdrop-blur-xl"
      style={{ boxShadow: 'var(--u-panel-shadow)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-u-panel-border p-3.5">
        <div className="flex items-center space-x-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-u-mark-bg text-u-mark-fg">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-display text-[13px] font-semibold text-u-title">Chat with Data</h2>
              <StatusChip tone="ok" className="!h-5 !text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-u-ok" aria-hidden="true" />
                Direct Lake Live
              </StatusChip>
            </div>
            <p className="mt-0.5 text-[10px] text-u-label">Asset Intelligence Copilot</p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button type="button" onClick={handleReset} title="Reset conversation" className="u-icon-btn">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onClose} title="Close Copilot" className="u-icon-btn">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="no-scrollbar flex items-center space-x-2 overflow-x-auto border-b border-u-panel-border px-3.5 py-2">
        <span className="flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-u-interaction">
          <Sparkles className="h-3 w-3" /> Prompts:
        </span>
        {QUICK_PROMPTS.map((qp) => (
          <button
            type="button"
            key={qp}
            onClick={() => void handleSend(qp)}
            disabled={loading}
            className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-u-ghost-border bg-u-ghost-bg px-2.5 py-1 text-[11px] text-u-text-soft transition-colors hover:border-u-interaction hover:text-u-interaction disabled:opacity-50"
          >
            <span>{qp}</span>
            <ArrowRight className="h-2.5 w-2.5 opacity-60" />
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3.5 overflow-y-auto p-3.5">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div key={m.id} className={cx('u-anim-fade flex items-start gap-2', isUser ? 'justify-end' : 'justify-start')}>
              {!isUser && (
                <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-u-mark-bg text-u-mark-fg">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}

              <div
                className={cx(
                  'max-w-[85%] rounded-xl p-2.5 text-xs leading-relaxed',
                  isUser
                    ? 'rounded-br-[4px] bg-u-bubble-user-bg text-u-bubble-user-text'
                    : m.error
                      ? 'rounded-bl-[4px] border border-u-bad/30 bg-u-bad-bg text-u-bad-text'
                      : 'rounded-bl-[4px] border border-u-bubble-bot-border bg-u-bubble-bot-bg text-u-text'
                )}
              >
                {isUser ? <div className="whitespace-pre-wrap">{m.content}</div> : <MarkdownMessage content={m.content} />}

                <div className={cx('mt-1.5 flex items-center justify-between text-[10px]', isUser ? 'opacity-75' : 'text-u-label')}>
                  <span>{m.timestamp}</span>
                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(m.content, m.id)}
                      className="ml-2 cursor-pointer p-1 transition-colors hover:text-u-interaction"
                      title="Copy response"
                    >
                      {copiedId === m.id ? <Check className="h-3 w-3 text-u-ok-text" /> : <Copy className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start justify-start gap-2" role="status" aria-live="polite">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-u-mark-bg text-u-mark-fg">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center space-x-2 rounded-xl rounded-bl-[4px] border border-u-bubble-bot-border bg-u-bubble-bot-bg p-2.5 text-xs">
              <span className="u-spin inline-block h-3 w-3 rounded-full border-2 border-u-track border-t-u-primary" />
              <span className="text-[11px] text-u-label">Querying Fabric Direct Lake via AI...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-u-panel-border p-3">
        <div className="relative rounded-xl border border-u-input-border bg-u-input-bg transition-[border-color,box-shadow] focus-within:border-u-focus focus-within:shadow-[var(--u-focus-ring)]">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the asset data... (Press Enter to send)"
            aria-label="Ask the Data Agent"
            rows={2}
            className="w-full resize-none bg-transparent p-2.5 pr-10 text-xs text-u-title placeholder:text-u-label focus:outline-none"
          />

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!prompt.trim() || loading}
            aria-label="Send question"
            className={cx(
              'absolute bottom-2 right-2 rounded-lg p-1.5 transition-colors',
              prompt.trim() && !loading ? 'cursor-pointer bg-u-btn-bg text-u-btn-text' : 'cursor-not-allowed text-u-label'
            )}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-u-label">Powered by Microsoft Fabric Data Agent • Service Principal</p>
      </div>
    </div>
  );
};
