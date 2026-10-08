import { h, type FunctionalComponent } from '@stencil/core';
import { Icon } from './icon';
import { TriangleAlert } from 'lucide';

/** Loading keeps the final geometry (principle 34): skeleton rows where the data will be. */
export const LoadingState: FunctionalComponent<{ rows?: number; label?: string }> = ({
  rows = 0,
  label = 'Executing VertiPaq DAX query...',
}) => (
  <div class="u-state u-state--loading" role="status" aria-live="polite">
    {Array.from({ length: rows }, (_, i) => (
      <span key={i} class="u-skeleton u-state__row" style={{ opacity: String(1 - i * 0.12) }} />
    ))}
    <span class="u-state__spinner">
      <span class="u-spin u-state__dot" aria-hidden="true" />
      {label}
    </span>
  </div>
);

export const EmptyState: FunctionalComponent<{ message?: string }> = ({ message }) => (
  <div class="u-state u-state--empty">{message || 'No data for the current selection.'}</div>
);

/** `key` lets it sit in a list of siblings (an error above the last good data). */
export const ErrorNote: FunctionalComponent<{ message: string; key?: string }> = ({ message }) => (
  <div class="u-state u-state--error">
    <Icon node={TriangleAlert} size={16} />
    <span>{message}</span>
  </div>
);
