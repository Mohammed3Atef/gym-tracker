import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Bottom sheet / modal. Slides up from the bottom for thumb-friendly forms. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-xl2 bg-surface-card p-4 pb-8 shadow-2xl animate-[slideUp_0.2s_ease]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-600" />
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          <button type="button" onClick={onClose} className="icon-btn h-9 w-9" aria-label="close">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
