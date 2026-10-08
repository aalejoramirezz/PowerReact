import { h, type FunctionalComponent } from '@stencil/core';

/** Thin progress meter (track + gradient fill), value 0..1. Decorative unless it has a label. */
export const MiniMeter: FunctionalComponent<{ value: number; label?: string; class?: string }> = ({ value, label, class: className }) => {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <span
      class={`u-mini-meter${className ? ` ${className}` : ''}`}
      role={label ? 'meter' : undefined}
      aria-label={label}
      aria-valuemin={label ? '0' : undefined}
      aria-valuemax={label ? '100' : undefined}
      aria-valuenow={label ? String(Math.round(pct)) : undefined}
      aria-hidden={label ? undefined : 'true'}
    >
      <i style={{ width: `${pct}%` }} />
    </span>
  );
};
