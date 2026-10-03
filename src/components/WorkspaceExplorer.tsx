import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  FileSpreadsheet,
  Database,
  Bot,
  Layers,
  ArrowRight,
  RefreshCw,
  Search,
  ChevronRight,
  Server,
} from 'lucide-react';
import type { FabricWorkspace, FabricItem } from '../types';

interface WorkspaceExplorerProps {
  onSelectReport: (workspaceId: string, reportId: string) => void;
  onSelectAgent: (workspaceId: string, agentId: string) => void;
}

export const WorkspaceExplorerComponent: React.FC<WorkspaceExplorerProps> = ({
  onSelectReport,
  onSelectAgent,
}) => {
  const [workspaces, setWorkspaces] = useState<FabricWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [items, setItems] = useState<FabricItem[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState<boolean>(false);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Load workspaces on mount
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    setLoadingWorkspaces(true);
    try {
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      if (data.success && data.workspaces) {
        setWorkspaces(data.workspaces);
        if (data.workspaces.length > 0 && !selectedWorkspace) {
          setSelectedWorkspace(data.workspaces[0].id);
          fetchItems(data.workspaces[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const fetchItems = async (wsId: string) => {
    setSelectedWorkspace(wsId);
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/workspaces/${wsId}/items`);
      const data = await res.json();
      if (data.success && data.items) {
        setItems(data.items);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.displayName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.id.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesType = typeFilter === 'ALL' || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'Report':
      case 'PaginatedReport':
        return <FileSpreadsheet className="w-4 h-4 text-blue-400" />;
      case 'DataAgent':
        return <Bot className="w-4 h-4 text-indigo-400" />;
      case 'Lakehouse':
      case 'Warehouse':
      case 'SQLDatabase':
      case 'SQLEndpoint':
        return <Database className="w-4 h-4 text-emerald-400" />;
      case 'SemanticModel':
        return <Layers className="w-4 h-4 text-purple-400" />;
      default:
        return <Server className="w-4 h-4 text-slate-400" />;
    }
  };

  const itemTypes = Array.from(new Set(items.map((i) => i.type)));

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Workspaces Sidebar */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-sm text-slate-200">Fabric Workspaces</span>
          </div>
          <button
            onClick={fetchWorkspaces}
            disabled={loadingWorkspaces}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition disabled:opacity-50"
            title="Refresh Workspaces"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingWorkspaces ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {workspaces.map((ws) => {
            const isSelected = selectedWorkspace === ws.id;
            return (
              <button
                key={ws.id}
                onClick={() => fetchItems(ws.id)}
                className={`w-full text-left p-3 rounded-xl transition flex flex-col border ${
                  isSelected
                    ? 'bg-blue-600/20 border-blue-500/50 text-white shadow-sm'
                    : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-semibold truncate">{ws.displayName}</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-400' : 'text-slate-600'}`} />
                </div>
                <span className="text-[10px] font-mono text-slate-500 mt-1 truncate">{ws.id}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Items Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search reports or items..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                typeFilter === 'ALL'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({items.length})
            </button>
            {itemTypes.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  typeFilter === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loadingItems ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-2" />
              <p className="text-xs">Loading items from workspace...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-xs">
              No items matching filter in this workspace.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredItems.map((item) => {
                const isReport = item.type === 'Report' || item.type === 'PaginatedReport';
                const isAgent = item.type === 'DataAgent';

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-slate-800 shrink-0">{getItemIcon(item.type)}</div>
                          <div>
                            <h4 className="text-xs font-semibold text-slate-200 line-clamp-1">{item.displayName}</h4>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                              {item.type}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] font-mono text-slate-500 truncate mb-4">ID: {item.id}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      {isReport && selectedWorkspace && (
                        <button
                          onClick={() => onSelectReport(selectedWorkspace, item.id)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <span>Embed Report</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isAgent && selectedWorkspace && (
                        <button
                          onClick={() => onSelectAgent(selectedWorkspace, item.id)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <span>Chat with Agent</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {!isReport && !isAgent && (
                        <span className="text-[11px] text-slate-500">Fabric Artifact</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
