import type React from 'react';

export const CURTAIN_KICKER = 'What it means';

export interface CurtainContent {
  /** One definition sentence: what the number means (≤ ~2 lines). */
  info?: string;
  /** How it is calculated, one line (measure or formula). */
  calc?: string;
}

interface InfoCurtainProps extends CurtainContent {
  id?: string;
  /**
   * undefined: hover/focus-driven (KPI cards; the host carries `u-curtain-host`).
   * boolean: controlled by an ⓘ button (chart cards); clicking the open curtain closes it.
   */
  open?: boolean;
  onClose?: () => void;
  /** Defaults to the host card's padding (inherit). */
  padding?: string;
}

/**
 * Port of Lens `univerus_html._curtain`: an opaque panel that drops from the top edge of the card
 * with an accent hem. Must be a direct child of the card (it inherits the card padding).
 */
export const InfoCurtain: React.FC<InfoCurtainProps> = ({ id, info, calc, open, onClose, padding }) => {
  if (!info && !calc) return null;
  const controlled = open !== undefined;

  return (
    <div
      id={id}
      className="u-curtain"
      style={padding ? { padding } : undefined}
      data-open={controlled ? String(open) : undefined}
      aria-hidden={controlled ? !open : true}
      onClick={controlled && open ? onClose : undefined}
    >
      <p className="u-curtain__kicker">{CURTAIN_KICKER}</p>
      {info && <p className="u-curtain__info">{info}</p>}
      {calc && (
        <p className="u-curtain__calc">
          <b aria-hidden="true">ƒ</b>
          {calc}
        </p>
      )}
    </div>
  );
};
