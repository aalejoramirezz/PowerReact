import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  Key,
  Layers,
  Lock,
} from 'lucide-react';

export const CredentialsHealthComponent: React.FC = () => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [configStatus, setConfigStatus] = useState<any>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setConfigStatus(data))
      .catch(() => {});
  }, []);

  const runAuthTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/auth/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: 'Network error communicating with local test server',
        details: err.message,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Service Principal & Entra ID Diagnostics</h2>
                <p className="text-xs text-slate-400">
                  Verify tokens, API permissions, and access for Power BI Embedded and Fabric Data Agents.
                </p>
              </div>
            </div>

            <button
              onClick={runAuthTest}
              disabled={testing}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing Tokens...' : 'Test Entra ID Authentication'}</span>
            </button>
          </div>

          {/* Test Result Banner */}
          {testResult && (
            <div
              className={`mt-6 p-4 rounded-xl border text-sm ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                  : 'bg-red-950/40 border-red-800/60 text-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-2 flex-1">
                  <div className="font-semibold">
                    {testResult.success ? 'Authentication Succeeded' : 'Authentication Failed'}
                  </div>
                  <p className="text-xs">{testResult.message || testResult.error}</p>

                  {testResult.success && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      <div className="bg-black/30 p-2.5 rounded-lg border border-emerald-900/40 font-mono text-xs">
                        <div className="text-[11px] text-emerald-400 font-semibold mb-1">Power BI Scope Token:</div>
                        <div className="text-slate-300 truncate">{testResult.powerBiTokenPreview}</div>
                      </div>
                      <div className="bg-black/30 p-2.5 rounded-lg border border-emerald-900/40 font-mono text-xs">
                        <div className="text-[11px] text-indigo-400 font-semibold mb-1">Fabric Scope Token:</div>
                        <div className="text-slate-300 truncate">{testResult.fabricTokenPreview}</div>
                      </div>
                    </div>
                  )}

                  {testResult.details && (
                    <pre className="text-xs font-mono bg-black/40 p-2 rounded max-h-36 overflow-auto">
                      {JSON.stringify(testResult.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-400" />
              <span>Loaded Service Principal Configuration</span>
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Tenant ID:</label>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300 font-mono text-xs">
                  {configStatus?.tenantId || 'Loaded from .env'}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Application ID (Client ID):</label>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300 font-mono text-xs">
                  {configStatus?.clientId || '••••••••-••••-••••-••••-••••••••••••'}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Application Secret:</label>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300 flex items-center justify-between font-mono text-xs">
                  <span>••••••••••••••••••••••••••••••••</span>
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Unity Domain Gateway:</label>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300 text-xs">
                  {configStatus?.unityDomain || 'https://gateway.unitystage.net'}
                </div>
              </div>
            </div>
          </div>

          {/* Architecture & Checklist */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Architecture & Tenant Setup Checklist</span>
            </h3>

            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-100">Service Principal Client Credentials:</span>
                  <p className="text-slate-400 mt-0.5">
                    Authenticates non-interactively using OAuth 2.0 client credentials against Microsoft Entra ID.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-100">Power BI Embed Token (App-Owns-Data):</span>
                  <p className="text-slate-400 mt-0.5">
                    Backend calls Power BI REST API <code>GenerateToken</code> to create secure scoped embed tokens for end users.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-100">Fabric Data Agent Integration:</span>
                  <p className="text-slate-400 mt-0.5">
                    Uses Fabric Bearer token (<code>api.fabric.microsoft.com</code>) to query published Data Agents via MCP.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-100">Workspace Membership:</span>
                  <p className="text-slate-400 mt-0.5">
                    Service Principal must be added as <strong>Member</strong> or <strong>Contributor</strong> in each Fabric/PBI workspace.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
