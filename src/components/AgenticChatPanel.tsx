import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, X, RotateCcw, Copy, Check, ArrowRight } from 'lucide-react';
import type { ChatMessage } from '../types';

interface AgenticChatPanelProps {
  onClose: () => void;
  workspaceId?: string;
  agentId?: string;
}

export const AgenticChatPanel: React.FC<AgenticChatPanelProps> = ({
  onClose,
  workspaceId = 'ef45c53d-42d4-48c6-be79-380b8d890c80',
  agentId = '783d6c28-09b3-45c3-9350-adf609ac110e',
}) => {
  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '👋 **Hello!** I am your **Fabric Data Agent**, connected in real time to your asset valuation data via Direct Lake.\n\nYou can ask me any question about the **Asset Valuation Register** data shown on your screen:',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const quickPrompts = [
    'What is the total asset count in the model?',
    'Which asset class has the highest depreciable cost?',
    'What is the total Fair Value and Fair Value Uplift?',
    'Which assets have a purchase cost over $1,000,000?',
    'Give me a breakdown of the FLEET asset class',
  ];

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (questionToSend?: string) => {
    const text = (questionToSend || prompt).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!questionToSend) setPrompt('');
    setLoading(true);

    try {
      const res = await fetch('/api/fabric/data-agent/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          agentId,
          prompt: text,
          history: messages.slice(-4).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      let assistantText = '';
      if (data.data?.response) {
        assistantText = data.data.response;
      } else if (data.data?.result?.content) {
        const texts = data.data.result.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text);
        assistantText = texts.join('\n\n');
      } else if (data.error) {
        assistantText = `⚠️ **Data Agent Error:**\n${data.error}`;
      } else {
        assistantText = JSON.stringify(data, null, 2);
      }

      const botMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: assistantText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        data: data.data,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `❌ **Connection error:** ${err.message || 'Network request failed'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 border-l border-slate-700/60 text-slate-100 shadow-2xl relative">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-950/70 backdrop-blur flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 p-[1px] shadow-md shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-semibold text-xs text-slate-100">Chat with Data</h2>
              <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Direct Lake Live</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Asset Intelligence Copilot</p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setMessages(messages.slice(0, 1))}
            title="Reset conversation"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Close Copilot"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-3.5 py-2 bg-slate-950/30 border-b border-slate-800/80 overflow-x-auto no-scrollbar flex items-center space-x-2">
        <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Prompts:
        </span>
        {quickPrompts.slice(0, 3).map((qp, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(qp)}
            disabled={loading}
            className="text-[11px] px-2.5 py-1 bg-slate-800/80 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 rounded-full border border-slate-700/60 hover:border-indigo-500/40 whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>{qp}</span>
            <ArrowRight className="w-2.5 h-2.5 opacity-60" />
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-6 h-6 rounded-md bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-xl p-2.5 text-xs leading-relaxed shadow-sm ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-br-xs'
                    : 'bg-slate-800/95 text-slate-200 border border-slate-700/60 rounded-bl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>

                <div
                  className={`mt-1.5 flex items-center justify-between text-[10px] ${
                    isUser ? 'text-blue-200/70' : 'text-slate-400'
                  }`}
                >
                  <span>{m.timestamp}</span>
                  {!isUser && (
                    <button
                      onClick={() => copyToClipboard(m.content, m.id)}
                      className="p-1 hover:text-slate-200 transition-colors ml-2 cursor-pointer"
                      title="Copy response"
                    >
                      {copiedId === m.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-2 justify-start">
            <div className="w-6 h-6 rounded-md bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
            </div>
            <div className="bg-slate-800/95 border border-slate-700/60 rounded-xl rounded-bl-xs p-2.5 text-xs text-slate-300 flex items-center space-x-2">
              <div className="flex space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]"></span>
              </div>
              <span className="text-[11px] text-slate-400">Querying Fabric Direct Lake via AI...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/90">
        <div className="relative rounded-xl bg-slate-900 border border-slate-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the asset data... (Press Enter to send)"
            rows={2}
            className="w-full bg-transparent p-2.5 pr-10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none"
          />

          <button
            onClick={() => handleSend()}
            disabled={!prompt.trim() || loading}
            className={`absolute right-2 bottom-2 p-1.5 rounded-lg transition-all cursor-pointer ${
              prompt.trim() && !loading
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-slate-500 text-center mt-1.5">
          Powered by Microsoft Fabric Data Agent • Service Principal
        </p>
      </div>
    </div>
  );
};
