import { useState, useEffect } from 'react';
import { UnityAssetsHeader } from './components/UnityAssetsHeader';
import { UnityAssetsSidebar } from './components/UnityAssetsSidebar';
import { PowerBIEmbedComponent } from './components/PowerBIEmbed';
import { SemanticModelVisuals } from './components/SemanticModelVisuals';
import { AgenticChatPanel } from './components/AgenticChatPanel';

export function App() {
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [activeMenuItem, setActiveMenuItem] = useState<string>('Report');
  const [status, setStatus] = useState<{ configured: boolean; tenantId: string; clientId: string | null } | null>(null);

  // Default to Asset Valuation Register
  const [selectedReport] = useState<{ workspaceId: string; reportId: string }>({
    workspaceId: 'ef45c53d-42d4-48c6-be79-380b8d890c80',
    reportId: '0e0f7bd6-1bfe-4920-af44-6fcd4fb66a8e',
  });

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch((err) => console.error('Health fetch failed:', err));
  }, []);

  const isSemanticVisualsActive =
    activeMenuItem === 'Asset Management' || activeMenuItem === 'Semantic Visuals';

  return (
    <div className="h-screen w-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans overflow-hidden">
      {/* 1. Exact Unity Assets Top Header with Chat with Data toggle & View Mode Switcher */}
      <UnityAssetsHeader
        isChatOpen={isChatOpen}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        status={status}
        activeMenuItem={activeMenuItem}
        onSelectMenuItem={(item) => setActiveMenuItem(item)}
      />

      {/* 2. Main Body: Left Sidebar + Center Content + Right Copilot Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Exact Unity Assets Left Menu */}
        <UnityAssetsSidebar
          activeItem={activeMenuItem}
          onSelectItem={(item) => setActiveMenuItem(item)}
        />

        {/* Center Canvas: Native React Semantic Visuals or Power BI Embedded Report */}
        <main className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 h-full min-w-0 flex flex-col bg-white">
            {isSemanticVisualsActive ? (
              <SemanticModelVisuals />
            ) : (
              <PowerBIEmbedComponent initialReport={selectedReport} />
            )}
          </div>

          {/* Right Copilot Drawer: Fabric Data Agent Chat with Data */}
          {isChatOpen && (
            <div className="w-[380px] lg:w-[420px] h-full shrink-0 border-l border-slate-200 shadow-2xl z-20 animate-in slide-in-from-right duration-200">
              <AgenticChatPanel
                onClose={() => setIsChatOpen(false)}
                workspaceId="ef45c53d-42d4-48c6-be79-380b8d890c80"
                agentId="783d6c28-09b3-45c3-9350-adf609ac110e"
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
