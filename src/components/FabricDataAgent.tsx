import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Code,
  Terminal,
  Copy,
  RefreshCw,
  ExternalLink,
  Layers,
  AlertTriangle,
  Check,
  Info,
  Workflow,
} from 'lucide-react';
import type { ChatMessage, FabricWorkspace } from '../types';

interface FabricDataAgentProps {
  initialAgent?: { workspaceId: string; agentId: string } | null;
}

export const FabricDataAgentComponent: React.FC<FabricDataAgentProps> = ({ initialAgent }) => {
  // Default to the requested Agent 1 - Power BI
  const [workspaceId, setWorkspaceId] = useState<string>('ef45c53d-42d4-48c6-be79-380b8d890c80');
  const [agentId, setAgentId] = useState<string>('783d6c28-09b3-45c3-9350-adf609ac110e');
  const [agentName, setAgentName] = useState<string>('Agent 1 - Power BI');
  const [copiedAppId, setCopiedAppId] = useState<boolean>(false);
  const [showArchInfo, setShowArchInfo] = useState<boolean>(false);

  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '👋 **Fabric Data Agent Headless Tester**\n\nLos **Fabric Data Agents** no disponen de un visor o iframe oficial para embeber UI (el portal bloquea iframes con `X-Frame-Options`). En su lugar, funcionan como **servicios API / MCP Headless**.\n\nEsta interfaz React interactúa directamente con el endpoint de Fabric a través del backend usando las credenciales de tu **Service Principal**.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const [selectedPayload, setSelectedPayload] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<FabricWorkspace[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Sync if initialAgent passed from explorer
  useEffect(() => {
    if (initialAgent) {
      setWorkspaceId(initialAgent.workspaceId);
      setAgentId(initialAgent.agentId);
    }
  }, [initialAgent]);

  // Presets
  const presets = [
    {
      name: 'Agent 1 - Power BI',
      workspaceId: 'ef45c53d-42d4-48c6-be79-380b8d890c80',
      agentId: '783d6c28-09b3-45c3-9350-adf609ac110e',
      portalUrl:
        'https://app.powerbi.com/groups/ef45c53d-42d4-48c6-be79-380b8d890c80/aiskills/783d6c28-09b3-45c3-9350-adf609ac110e?experience=power-bi',
    },
    {
      name: 'Sandbox for Brad (Demo)',
      workspaceId: '92344bf5-8207-449c-a718-002b0666968c',
      agentId: '',
      portalUrl: 'https://app.powerbi.com/groups/92344bf5-8207-449c-a718-002b0666968c',
    },
  ];

  // Quick prompt suggestions
  const samplePrompts = [
    'What are the key metrics and insights in this semantic model?',
    'Show total work orders by priority and status',
    'List top 5 accounts with high SLA breach count',
    'Generate DAX measure to calculate average resolution time',
  ];

  // Fetch workspaces
  useEffect(() => {
    fetch('/api/workspaces')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.workspaces) {
          setWorkspaces(data.workspaces);
        }
      })
      .catch((err) => console.error('Failed to load workspaces:', err));
  }, []);

  // Auto scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectPreset = (p: (typeof presets)[0]) => {
    setWorkspaceId(p.workspaceId);
    setAgentId(p.agentId);
    setAgentName(p.name);
  };

  const copyAppId = () => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.clientId) {
          navigator.clipboard.writeText(data.clientId);
        }
      })
      .catch(() => {});
    setCopiedAppId(true);
    setTimeout(() => setCopiedAppId(false), 2500);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || prompt;
    if (!text.trim()) return;

    if (!workspaceId.trim()) {
      alert('Please enter a Workspace ID first.');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setPrompt('');
    setLoading(true);

    try {
      const res = await fetch('/api/fabric/data-agent/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          agentId: agentId || 'demo-agent-test',
          prompt: text,
          history: messages.slice(-4).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorContent = `⚠️ **Fabric Data Agent Response (${res.status})**:\n\n${
          data.error || 'Request failed'
        }\n\n**Diagnóstico:** ${data.hint || 'Check if the agent is published and the SPN has permissions.'}\n\n\`\`\`json\n${JSON.stringify(
          data.details || {},
          null,
          2
        )}\n\`\`\``;

        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: errorContent,
          timestamp: new Date().toLocaleTimeString(),
          error: true,
          raw: data,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } else {
        const agentText =
          data.data?.response ||
          data.data?.content ||
          data.data?.answer ||
          data.data?.choices?.[0]?.message?.content ||
          JSON.stringify(data.data, null, 2);

        const replyMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: agentText,
          timestamp: new Date().toLocaleTimeString(),
          sqlQuery: data.data?.sql || data.data?.dax || data.data?.query,
          raw: data,
        };
        setMessages((prev) => [...prev, replyMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ **Network / Connection Error:** ${err.message}`,
        timestamp: new Date().toLocaleTimeString(),
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const portalUrl = `https://app.powerbi.com/groups/${workspaceId}/aiskills/${agentId}?experience=power-bi`;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Config Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 shrink-0">
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Top Row: Presets & Portal Link */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400 mr-2 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Presets:
              </span>
              {presets.map((p, idx) => {
                const isSelected = workspaceId === p.workspaceId && agentId === p.agentId;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectPreset(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Actions: Info toggle + Portal link */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowArchInfo(!showArchInfo)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 border ${
                  showArchInfo
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>¿Cómo funciona? (Headless vs Iframe)</span>
              </button>

              <a
                href={portalUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
                title="Abrir en Fabric Portal"
              >
                <span>Portal Fabric</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Form Inputs Row */}
          <div className="flex flex-col md:flex-row items-center gap-3 pt-1">
            {/* Workspace select / input */}
            <div className="flex-1 w-full">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-mono text-slate-400">Fabric Workspace ID:</label>
                {workspaces.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) setWorkspaceId(e.target.value);
                    }}
                    value={workspaces.some((w) => w.id === workspaceId) ? workspaceId : ''}
                    className="bg-slate-900 text-slate-300 text-[10px] font-mono rounded px-1.5 py-0.5 border border-slate-700 focus:outline-none"
                  >
                    <option value="">Quick pick from accessible workspaces...</option>
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.displayName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <input
                type="text"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                placeholder="e.g. ef45c53d-42d4-48c6-be79-380b8d890c80"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Agent / AI Skill ID input */}
            <div className="flex-1 w-full">
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Data Agent / AI Skill ID (GUID):
              </label>
              <input
                type="text"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="e.g. 783d6c28-09b3-45c3-9350-adf609ac110e"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Architecture Explainer Card (Toggleable) */}
          {showArchInfo && (
            <div className="bg-slate-950 border border-indigo-800/60 rounded-xl p-4 text-xs space-y-2.5 text-slate-300">
              <div className="flex items-center gap-2 font-semibold text-indigo-300">
                <Workflow className="w-4 h-4 text-indigo-400" />
                <span>Arquitectura Oficial de Fabric Data Agents (Headless / API-First)</span>
              </div>
              <p className="leading-relaxed text-slate-400">
                A diferencia de Power BI Reports (que tienen <code>powerbi-client</code> y generan Embed Tokens para iframes),{' '}
                <strong>Microsoft NO ofrece un componente de UI o iframe para embeber Data Agents</strong>. El portal de Power BI bloquea activamente los iframes mediante <code>X-Frame-Options: DENY</code>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-emerald-400 font-semibold mb-1">1. Frontend React (Esta App)</div>
                  <p className="text-slate-400 font-sans">El usuario escribe una pregunta de negocio en el chat.</p>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-blue-400 font-semibold mb-1">2. Backend Express (SPN)</div>
                  <p className="text-slate-400 font-sans">Obtiene token Entra ID Client Credentials de Univerus.</p>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-indigo-400 font-semibold mb-1">3. Fabric MCP/REST API</div>
                  <p className="text-slate-400 font-sans">Ejecuta el agente y devuelve respuesta + queries SQL/DAX.</p>
                </div>
              </div>
            </div>
          )}

          {/* Notice banner for SPN Workspace Access */}
          <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-indigo-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Para que el agente responda a la API: agrega el <strong>App ID</strong> como{' '}
                <strong>Member o Contributor</strong> en el workspace <code>{workspaceId}</code> y confirma que el agente esté <strong>Published</strong>.
              </span>
            </div>
            <button
              onClick={copyAppId}
              className="px-2.5 py-1 rounded-md bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-200 border border-indigo-700/60 font-mono text-[11px] transition flex items-center gap-1.5 shrink-0"
            >
              {copiedAppId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAppId ? 'Copied Client ID!' : 'Copy Client ID'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    m.error
                      ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                      : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 rounded-tr-sm'
                    : m.error
                    ? 'bg-slate-900 border border-amber-800/50 text-slate-200 rounded-tl-sm'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>

                {/* Show SQL/DAX query if returned */}
                {m.sqlQuery && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-mono flex items-center gap-1">
                        <Code className="w-3.5 h-3.5 text-indigo-400" /> Generated Query:
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(m.sqlQuery!)}
                        className="hover:text-white flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </button>
                    </div>
                    <pre className="p-2.5 rounded bg-black/50 font-mono text-xs text-indigo-200 overflow-x-auto">
                      {m.sqlQuery}
                    </pre>
                  </div>
                )}

                {/* Raw Inspector link */}
                {m.raw && (
                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{m.timestamp}</span>
                    <button
                      onClick={() => setSelectedPayload(m.raw)}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono hover:underline"
                    >
                      <Terminal className="w-3 h-3" />
                      <span>Inspect Payload</span>
                    </button>
                  </div>
                )}
              </div>

              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-md">
                  Me
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-4 text-xs text-slate-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span>Fabric Data Agent is processing your prompt with Service Principal...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>
      </div>

      {/* Suggested Prompts & Input Bar */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 shrink-0">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Quick Prompts Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mr-1 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" /> Prompts:
            </span>
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(p)}
                disabled={loading}
                className="shrink-0 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-indigo-950 hover:border-indigo-600 border border-slate-700 text-slate-300 text-[11px] transition"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Ask ${agentName} questions about your data, DAX, or reports...`}
              disabled={loading}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 shrink-0"
            >
              <span>Ask Agent</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Raw Payload Inspector Modal */}
      {selectedPayload && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>Fabric API Payload Inspector</span>
              </div>
              <button
                onClick={() => setSelectedPayload(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="p-4 overflow-auto font-mono text-xs text-slate-300">
              <pre>{JSON.stringify(selectedPayload, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
