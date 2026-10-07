import { h, type FunctionalComponent } from '@stencil/core';
import type { IconNode } from '../utils/icons';

interface IconProps {
  node: IconNode;
  size?: number;
  /** better-ui: 1.5 beside regular text, 2 beside semibold. */
  strokeWidth?: number;
  class?: string;
}

/** A lucide icon drawn with `currentColor`: one SVG, recoloured per state by CSS. Decorative. */
export const Icon: FunctionalComponent<IconProps> = ({ node, size = 16, strokeWidth = 2, class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {node.map(([tag, attrs]) => h(tag, { ...attrs }))}
  </svg>
);
