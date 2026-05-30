import { create } from 'zustand';

/**
 * In-app confirm/alert dialogs (replacing window.confirm / window.alert).
 * Call `confirm(...)` / `alert(...)` and await the user's choice; the
 * <DialogHost> rendered at the app root displays the popup.
 */
interface DialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface DialogState extends DialogOptions {
  open: boolean;
  isAlert: boolean;
  resolve: ((ok: boolean) => void) | null;
  confirm: (opts: DialogOptions) => Promise<boolean>;
  alert: (opts: DialogOptions) => Promise<void>;
  respond: (ok: boolean) => void;
}

export const useDialog = create<DialogState>((set, get) => ({
  open: false,
  isAlert: false,
  title: '',
  resolve: null,

  confirm(opts) {
    return new Promise<boolean>((resolve) => {
      set({ open: true, isAlert: false, resolve, ...opts });
    });
  },

  alert(opts) {
    return new Promise<void>((resolve) => {
      set({ open: true, isAlert: true, resolve: () => resolve(), ...opts });
    });
  },

  respond(ok) {
    const { resolve } = get();
    resolve?.(ok);
    set({ open: false, resolve: null });
  },
}));

export const confirmDialog = (opts: DialogOptions) => useDialog.getState().confirm(opts);
export const alertDialog = (opts: DialogOptions) => useDialog.getState().alert(opts);
