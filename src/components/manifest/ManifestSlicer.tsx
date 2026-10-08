import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { DataPointValue } from '@powerreact/udp-powerbi-visuals';
import type { SlicerOption } from '../../lib/manifest/mapRows';
import { Popover } from '../ui/Popover';
import { Tab, Tabs } from '../ui/primitives';
import { cx } from '../ui/cx';

export type SlicerMode = 'auto' | 'buttons' | 'dropdown';

interface ManifestSlicerProps {
  /** What it filters ("Group"): the control's accessible name and the dropdown's caption. */
  label: string;
  options: SlicerOption[];
  /** The current selection (empty: everything). */
  selected: DataPointValue[];
  mode: SlicerMode;
  multiple: boolean;
  allLabel: string;
  onChange: (values: DataPointValue[], labels: string[]) => void;
  loading?: boolean;
  error?: string;
  testId: string;
  className?: string;
}

/** Above this many options (or with long labels) `auto` becomes a dropdown. */
const MAX_BUTTONS = 6;
const SEARCH_FROM = 8;

const valueOf = (o: SlicerOption): DataPointValue => o.raw ?? o.id;
const same = (a: DataPointValue, b: DataPointValue) => String(a) === String(b);
const count = new Intl.NumberFormat();

/**
 * A manifest slicer: a control of the container, not a visual (in UDP it maps to UdpDropdown /
 * UdpTablist). Up to six short options are framed buttons ("All" first, toggles with
 * aria-pressed); more become a dropdown with native checkboxes (radios when single-select) and a
 * search box. It reports the full new selection; the store turns it into one slicer filter.
 */
export const ManifestSlicer: React.FC<ManifestSlicerProps> = ({
  label,
  options,
  selected,
  mode,
  multiple,
  allLabel,
  onChange,
  loading,
  error,
  testId,
  className,
}) => {
  const isSelected = (o: SlicerOption) => selected.some((v) => same(v, valueOf(o)));
  const emit = (next: SlicerOption[]) => onChange(next.map(valueOf), next.map((o) => o.label));
  const toggle = (o: SlicerOption) => {
    if (!multiple) return emit(isSelected(o) ? [] : [o]);
    emit(isSelected(o) ? options.filter((x) => isSelected(x) && x !== o) : [...options.filter(isSelected), o]);
  };
  const short = options.length <= MAX_BUTTONS && options.reduce((n, o) => n + o.label.length, 0) <= 60;
  const buttons = mode === 'buttons' || (mode === 'auto' && short);

  if (error) return <p className={cx('text-[11.5px] text-u-bad-text', className)}>{error}</p>;
  if (loading && options.length === 0) return <div className={cx('u-skeleton h-8 w-40', className)} aria-label={`Loading ${label}`} />;

  if (buttons) {
    return (
      <Tabs label={label} className={cx('flex-wrap', className)}>
        <Tab active={selected.length === 0} onClick={() => emit([])} data-testid={`${testId}-all`}>
          {allLabel}
        </Tab>
        {options.map((o) => (
          <Tab key={o.id} active={isSelected(o)} onClick={() => toggle(o)} data-testid={`${testId}-option-${o.id}`}>
            {o.label}
          </Tab>
        ))}
      </Tabs>
    );
  }
  return (
    <SlicerDropdown
      label={label}
      options={options}
      isSelected={isSelected}
      selectedCount={options.filter(isSelected).length}
      multiple={multiple}
      allLabel={allLabel}
      toggle={toggle}
      clear={() => emit([])}
      testId={testId}
      className={className}
    />
  );
};

const SlicerDropdown: React.FC<{
  label: string;
  options: SlicerOption[];
  isSelected: (o: SlicerOption) => boolean;
  selectedCount: number;
  multiple: boolean;
  allLabel: string;
  toggle: (o: SlicerOption) => void;
  clear: () => void;
  testId: string;
  className?: string;
}> = ({ label, options, isSelected, selectedCount, multiple, allLabel, toggle, clear, testId, className }) => {
  const [query, setQuery] = useState('');
  const name = useId();
  const chosen = options.filter(isSelected);
  const summary = selectedCount === 0 ? allLabel : selectedCount === 1 ? (chosen[0]?.label ?? allLabel) : `${selectedCount} selected`;
  const shown = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options;

  return (
    <div className={className} data-testid={testId}>
      <Popover
        label={`${label}: ${summary}`}
        triggerClassName="u-input inline-flex max-w-full cursor-pointer items-center gap-2"
        trigger={
          <>
            <span className="text-u-label">{label}</span>
            <span className="truncate font-semibold text-u-title">{summary}</span>
            <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
          </>
        }
      >
        {() => (
          <div className="flex w-64 max-w-[calc(100vw-48px)] flex-col gap-2">
            {options.length >= SEARCH_FROM && (
              <input
                type="search"
                className="u-input w-full"
                placeholder="Search"
                aria-label={`Search ${label}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}
            <fieldset className="m-0 max-h-64 overflow-y-auto border-0 p-0">
              <legend className="sr-only">{label}</legend>
              {shown.map((o) => (
                <label
                  key={o.id}
                  className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[12.5px] text-u-text hover:bg-u-row-hover"
                  data-testid={`${testId}-option-${o.id}`}
                >
                  <input
                    type={multiple ? 'checkbox' : 'radio'}
                    name={name}
                    checked={isSelected(o)}
                    onChange={() => toggle(o)}
                    className="accent-(--u-interaction)"
                  />
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.count !== null && <span className="u-num text-[11px] text-u-label">{count.format(o.count)}</span>}
                </label>
              ))}
              {shown.length === 0 && <p className="px-2 py-1 text-[12px] text-u-label">No match for “{query}”.</p>}
            </fieldset>
            <button type="button" className="u-btn-ghost self-start" disabled={selectedCount === 0} onClick={clear} data-testid={`${testId}-clear`}>
              Clear
            </button>
          </div>
        )}
      </Popover>
    </div>
  );
};
