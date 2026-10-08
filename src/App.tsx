import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { getJson } from './api/http';
import { AgenticChatPanel } from './components/chat/AgenticChatPanel';
import { PowerBIEmbedComponent } from './components/embed/PowerBIEmbed';
import { UnityAssetsHeader } from './components/layout/UnityAssetsHeader';
import { UnityAssetsSidebar } from './components/layout/UnityAssetsSidebar';
import { SemanticModelVisuals } from './components/visuals/SemanticModelVisuals';
import { Gallery } from './pages/Gallery';
import { ManifestPreview } from './pages/ManifestPreview';
import { ROUTES, viewFromPath, type ViewId } from './routes';
import type { HealthStatus } from './types';

const paneClass = (visible: boolean) => (visible ? 'flex-1 flex flex-col min-h-0' : 'hidden');

export function App() {
  const { pathname } = useLocation();
  const activeView = viewFromPath(pathname);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatMounted, setIsChatMounted] = useState(false);
  // Below lg the sidebar is a drawer, opened from the header's menu button
  const [isNavOpen, setIsNavOpen] = useState(false);

  // Views mount on first visit and then stay mounted (hidden) so switching keeps
  // the embedded report, query cache subscriptions and local UI state alive.
  const [visitedViews, setVisitedViews] = useState<ReadonlySet<ViewId>>(
    () => new Set(activeView ? [activeView] : [])
  );
  if (activeView && !visitedViews.has(activeView)) {
    setVisitedViews(new Set(visitedViews).add(activeView));
  }

  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => getJson<HealthStatus>('/api/health', signal),
    staleTime: Infinity,
  });

  const toggleChat = () => {
    setIsChatOpen((open) => !open);
    setIsChatMounted(true);
  };

  return (
    // dvh: the mobile browser chrome must not push the report below the fold
    <div className="h-dvh w-full bg-u-canvas text-u-text flex flex-col font-sans overflow-hidden">
      <UnityAssetsHeader
        isChatOpen={isChatOpen}
        onToggleChat={toggleChat}
        status={health.data ?? null}
        activeView={activeView}
        navOpen={isNavOpen}
        onOpenNav={() => setIsNavOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <UnityAssetsSidebar mobileOpen={isNavOpen} onClose={() => setIsNavOpen(false)} />

        <main className="flex-1 flex overflow-hidden relative">
          <Routes>
            <Route path={`${ROUTES.visuals}/*`} element={null} />
            <Route path={`${ROUTES.report}/*`} element={null} />
            <Route path={`${ROUTES.gallery}/*`} element={null} />
            <Route path={`${ROUTES.manifestPreview}/*`} element={null} />
            <Route path="*" element={<Navigate to={ROUTES.report} replace />} />
          </Routes>

          <div className="flex-1 h-full min-w-0 flex flex-col">
            {visitedViews.has('visuals') && (
              <div className={paneClass(activeView === 'visuals')}>
                <SemanticModelVisuals active={activeView === 'visuals'} />
              </div>
            )}
            {visitedViews.has('report') && (
              <div className={paneClass(activeView === 'report')}>
                <PowerBIEmbedComponent />
              </div>
            )}
            {activeView === 'gallery' && (
              <div className={paneClass(true)}>
                <Gallery />
              </div>
            )}
            {visitedViews.has('manifestPreview') && (
              <div className={paneClass(activeView === 'manifestPreview')}>
                <ManifestPreview />
              </div>
            )}
          </div>

          {/* Right Copilot Drawer: kept mounted once opened so the conversation survives closing.
              Below lg it is a full-screen sheet over a solid canvas (the panel itself is translucent). */}
          {isChatMounted && (
            <div
              className={
                isChatOpen
                  ? 'u-anim-slide-in h-full shrink-0 border-l border-u-panel-border z-20 lg:w-[420px] max-lg:fixed max-lg:inset-0 max-lg:z-50 max-lg:w-full max-lg:border-l-0 max-lg:bg-u-canvas'
                  : 'hidden'
              }
              data-testid="chat-drawer"
            >
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
