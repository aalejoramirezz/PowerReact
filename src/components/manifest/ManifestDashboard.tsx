import type React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { keyLabel } from '../../lib/manifest/mapRows';
import type { Manifest } from '../../lib/manifest/schema';
import { selectCrossFilters, useFilterStore } from '../../store/filters';
import { ReportTemplate } from '../template/ReportTemplate';
import { RemovableChip } from '../ui/primitives';
import { ManifestFilterBar } from './ManifestFilterBar';
import { ManifestVisual, type DataSourceMode } from './ManifestVisual';
import './manifest.css';

interface ManifestDashboardProps {
  manifest: Manifest;
  source: DataSourceMode;
  /** Header actions (the preview's Upload / Schema buttons). */
  actions?: React.ReactNode;
  /** Controls at the start of the toolbar (manifest picker, Live / Sample). */
  controls?: React.ReactNode;
}

/**
 * Renders a validated manifest: the Univerus template (eyebrow + title from the manifest), the active
 * selections as removable chips with Reset all (a slicer's filter is not repeated: its control
 * shows it), and every visual on the 12-column grid. All data
 * logic lives here and in ManifestVisual; the elements only receive props and emit events.
 */
export const ManifestDashboard: React.FC<ManifestDashboardProps> = ({ manifest, source, actions, controls }) => {
  const filters = useFilterStore(selectCrossFilters(manifest.id));
  const selections = filters.filter((f) => f.origin === 'select');
  const { clearCrossFilter, clearDashboard } = useFilterStore(
    useShallow((s) => ({ clearCrossFilter: s.clearCrossFilter, clearDashboard: s.clearDashboard }))
  );

  return (
    <ReportTemplate
      eyebrow={manifest.eyebrow ?? 'Manifest'}
      title={manifest.title}
      actions={actions}
      toolbar={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {controls}
          <ManifestFilterBar manifest={manifest} source={source} />
          {filters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" data-testid="manifest-filters">
              {selections.map((f) => (
                <RemovableChip
                  key={f.field}
                  label={keyLabel(f.field)}
                  value={(f.labels ?? f.values.map(String)).join(', ')}
                  onRemove={() => clearCrossFilter(manifest.id, f.field, 'select')}
                  removeLabel={`Remove the ${keyLabel(f.field)} filter`}
                />
              ))}
              <button
                type="button"
                onClick={() => clearDashboard(manifest.id)}
                className="cursor-pointer px-1 text-[11.5px] font-semibold text-u-bad-text underline underline-offset-2"
              >
                Reset all
              </button>
            </div>
          )}
        </div>
      }
    >
      <div
        className="u-mgrid"
        style={{ '--u-mgrid-row': `${manifest.layout.rowMinHeight}px` } as React.CSSProperties}
        data-testid="manifest-grid"
        data-source={source}
      >
        {manifest.visuals.map((visual, index) => (
          <ManifestVisual key={visual.id} manifest={manifest} visual={visual} index={index} source={source} />
        ))}
      </div>
    </ReportTemplate>
  );
};
