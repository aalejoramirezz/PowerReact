import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLatestRef } from '../../hooks/useLatestRef';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * Side sheet for secondary tools (DAX Inspector). Portalled to <body> because the report plane's
 * backdrop-filter would trap a fixed layer inside it. Full screen on phones, 560 px from sm up.
 * Esc or a click on the backdrop closes it; focus moves in on open and back to the opener on close.
 */
export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, children }) => {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useLatestRef(onClose); // callers pass inline arrows; the effect must not re-run for them

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, [open, onCloseRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="u-anim-fade fixed inset-0 z-50 flex justify-end bg-u-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="u-anim-slide-in flex h-full w-full flex-col border-l border-u-panel-border bg-u-panel-solid text-u-text sm:w-[560px]"
        style={{ boxShadow: 'var(--u-modal-shadow)' }}
      >
        <header className="flex items-center justify-between border-b border-u-panel-border px-5 py-3">
          <h2 id={titleId} className="font-display text-[15px] font-semibold text-u-title">
            {title}
          </h2>
          <button ref={closeRef} type="button" className="u-icon-btn" aria-label={`Close ${title}`} onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </section>
    </div>,
    document.body
  );
};
