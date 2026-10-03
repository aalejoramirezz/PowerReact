import React from 'react';
import {
  Grid3X3,
  Settings,
  HelpCircle,
  Languages,
  Sparkles,
  Bot,
} from 'lucide-react';

interface UnityAssetsHeaderProps {
  isChatOpen: boolean;
  onToggleChat: () => void;
  status?: { configured: boolean; tenantId: string; clientId: string | null } | null;
  activeMenuItem?: string;
  onSelectMenuItem?: (item: string) => void;
}

export const UnityAssetsHeader: React.FC<UnityAssetsHeaderProps> = ({
  isChatOpen,
  onToggleChat,
  status,
  activeMenuItem = 'Report',
  onSelectMenuItem,
}) => {
  return (
    <header className="bg-[#243346] text-white h-12 px-4 flex items-center justify-between select-none shrink-0 border-b border-slate-700/40 z-30">
      {/* Left side: Waffle, Brand, Breadcrumb, and Mode Switcher */}
      <div className="flex items-center space-x-6">
        {/* Waffle and Brand */}
        <div className="flex items-center space-x-3">
          <button className="text-slate-300 hover:text-white p-1 rounded transition-colors cursor-pointer" title="App launcher">
            <Grid3X3 className="w-4 h-4" />
          </button>
          <span className="font-semibold text-sm tracking-tight text-white">Unity Assets</span>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-slate-300">
          <span className="hover:text-white transition-colors cursor-pointer">Home</span>
          <span className="text-slate-400">/</span>
          <span className="text-white font-medium">{activeMenuItem}</span>
        </div>

        {/* Quick View Mode Switcher (iFrame vs Native React DAX) */}
        {onSelectMenuItem && (
          <div className="hidden md:flex items-center bg-[#1b2635] p-0.5 rounded-lg border border-slate-600/70 text-xs">
            <button
              onClick={() => onSelectMenuItem('Report')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                activeMenuItem === 'Report'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Power BI Embed (iFrame)
            </button>
            <button
              onClick={() => onSelectMenuItem('Asset Management')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMenuItem === 'Asset Management' || activeMenuItem === 'Semantic Visuals'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-teal-400 hover:text-teal-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-pulse" />
              React Semantic Visuals
            </button>
          </div>
        )}
      </div>

      {/* Right side: Chat with Data Toggle & System Icons */}
      <div className="flex items-center space-x-3">
        {/* Chat with Data Toggle (HERO TOGGLE) */}
        <button
          onClick={onToggleChat}
          className={`flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer shadow-sm ${
            isChatOpen
              ? 'bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 text-white ring-1 ring-emerald-300 shadow-emerald-500/20'
              : 'bg-[#1b2635] hover:bg-[#2c3e53] text-slate-200 border border-slate-600/80 hover:border-indigo-400/80'
          }`}
          title="Toggle Data Agent Chat"
        >
          {isChatOpen ? (
            <Bot className="w-3.5 h-3.5 text-white" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          )}
          <span>{isChatOpen ? 'Chat with Data' : 'Chat with Data'}</span>
          <span
            className={`w-2 h-2 rounded-full ${
              isChatOpen ? 'bg-emerald-300 animate-ping' : 'bg-slate-400'
            }`}
          />
        </button>

        {/* Service Principal Status Pill */}
        {status?.configured && (
          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1b2635] border border-slate-600/70 text-[11px] text-slate-300"
            title={`Tenant: ${status.tenantId} | Client: ${status.clientId || 'Configured'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>SP Active</span>
          </div>
        )}

        {/* Divider */}
        <div className="h-4 w-[1px] bg-slate-600/60 mx-1"></div>

        {/* Settings */}
        <button className="text-slate-300 hover:text-white p-1.5 rounded transition-colors cursor-pointer" title="Settings">
          <Settings className="w-4 h-4" />
        </button>

        {/* Help */}
        <button className="text-slate-300 hover:text-white p-1.5 rounded transition-colors cursor-pointer" title="Help">
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Language */}
        <button className="text-slate-300 hover:text-white p-1.5 rounded transition-colors cursor-pointer" title="Language">
          <Languages className="w-4 h-4" />
        </button>

        {/* User Avatar */}
        <div
          className="w-7 h-7 rounded-full bg-[#5b63d3] text-white flex items-center justify-center text-xs font-semibold shadow-inner cursor-pointer"
          title="Alejandro (Admin)"
        >
          A
        </div>
      </div>
    </header>
  );
};
