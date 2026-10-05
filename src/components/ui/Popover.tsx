import React, { useEffect, useId, useRef, useState } from 'react';
import { cx } from './cx';

interface PopoverProps {
  /** Accessible name of the trigger and the panel. */
  label: string;
  /** Trigger content (icon + optional text). */
  trigger: React.ReactNode;
  triggerClassName?: string;
  title?: string;
  /** Panel content; `close` lets an action dismiss the popover. */
  children: (close: () => void) => React.ReactNode;
  className?: string;
}

/**
 * Small anchored panel for secondary information (context on demand). It scales in from its
 * trigger (origin-aware, emil-design-eng), closes on Esc or an outside click and returns focus to
 * the trigger. Rendered in place: the report header already paints above the data area.
 */
export const Popover: React.FC<PopoverProps> = ({ label, trigger, triggerClassName, title, children, className }) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    panelRef.current?.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  // Called from the panel's content (rendered during render), so it finds the trigger by id, not by ref
  const close = () => {
    setOpen(false);
    document.getElementById(triggerId)?.focus();
  };

  return (
    // Below sm the root is static, so the panel spans the nearest positioned ancestor (the report header)
    <div ref={rootRef} className="relative max-sm:static">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={triggerClassName}
        title={title}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          className={cx(
            'u-anim-pop absolute right-0 top-full z-30 mt-2 w-[320px] max-w-[calc(100vw-32px)] max-sm:inset-x-4 max-sm:w-auto rounded-xl border border-u-panel-border bg-u-panel-solid p-4 text-left text-u-text',
            className
          )}
          style={{ boxShadow: 'var(--u-panel-shadow)', transformOrigin: 'top right' }}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
};
