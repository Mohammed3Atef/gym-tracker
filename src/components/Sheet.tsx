import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Bottom sheet / modal. Slides up from the bottom for thumb-friendly forms.
 * Rendered through a portal to <body> so it pins to the viewport even when an
 * ancestor establishes a containing block (e.g. a transformed page wrapper).
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm anim-fade" onClick={onClose} />
      <div className="relative max-h-[88%] w-full max-w-md overflow-y-auto rounded-t-sheet border-t border-line bg-[#0c0c0c] px-5 pb-8 pt-2 shadow-deep [animation:sheetRise_0.35s_var(--ease-card)] motion-reduce:animate-none">
        <div className="mx-auto mb-4 mt-2 h-1 w-10 rounded-full bg-white/20" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="h2">{title}</h2>
            <button type="button" onClick={onClose} className="icon-btn h-9 w-9" aria-label="close">
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
