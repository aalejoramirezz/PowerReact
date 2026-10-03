import React from 'react';
import { Sparkles, Bot, ShieldCheck, FolderTree, Database } from 'lucide-react';

interface NavbarProps {
  isAgenticMode: boolean;
  onToggleAgenticMode: () => void;
  onOpenExplorer: () => void;
  onOpenHealth: () => void;
  status: { configured: boolean; tenantId: string; clientId: string | null } | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAgenticMode,
  onToggleAgenticMode,
  onOpenExplorer,
  onOpenHealth,
  status,
}) => {
  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and report title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25">
              U
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base text-slate-100 tracking-tight">Univerus</span>
                <span className="bg-blue-500/10 text-blue-400 text-xs px-2 py-0.5 rounded-full font-medium border border-blue-500/20">
                  Asset Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Database className="w-3 h-3 text-emerald-400" />
                <span className="text-slate-300 font-medium">Asset Valuation Register</span>
                <span className="text-slate-500">•</span>
                <span className="text-emerald-400 font-medium">Direct Lake</span>
              </p>
            </div>
          </div>

          {/* Center: The HERO TOGGLE */}
          <div className="flex items-center">
            <button
              onClick={onToggleAgenticMode}
              className={`relative flex items-center gap-3 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-300 cursor-pointer shadow-lg ${
                isAgenticMode
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 text-white shadow-emerald-500/30 ring-2 ring-emerald-400/40 hover:brightness-110'
                  : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700 hover:border-indigo-500/50 shadow-slate-950/60'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                  isAgenticMode ? 'bg-white/20 text-white' : 'bg-indigo-500/20 text-indigo-400'
                }`}
              >
                {isAgenticMode ? (
                  <Bot className="w-4 h-4 animate-bounce" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </div>

              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span>{isAgenticMode ? 'Agentic Mode: ACTIVO' : 'Chatear con la Data'}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isAgenticMode ? 'bg-emerald-300 animate-ping' : 'bg-slate-500'
                    }`}
                  />
                </div>
                <div
                  className={`text-[10px] font-normal ${
                    isAgenticMode ? 'text-emerald-100/90' : 'text-slate-400'
                  }`}
                >
                  {isAgenticMode ? 'Fabric Data Agent listo' : 'Click para abrir Copilot'}
                </div>
              </div>
            </button>
          </div>

          {/* Right: SPN & Tools */}
          <div className="flex items-center space-x-2.5">
            {/* SPN status badge */}
            <div className="hidden md:flex items-center space-x-2 bg-slate-800/70 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300 font-medium">SPN:</span>
              <span className="text-slate-400 font-mono text-[11px]">{status?.clientId || 'Connected'}</span>
            </div>

            {/* Subtle Tools Menu */}
            <button
              onClick={onOpenExplorer}
              title="Explorador de Workspaces"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <FolderTree className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenHealth}
              title="Diagnóstico de Credenciales"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
