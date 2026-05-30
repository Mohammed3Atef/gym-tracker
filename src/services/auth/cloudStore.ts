import { create } from 'zustand';
import { cloudAvailable } from '@/data/dataSource';

interface CloudUser {
  uid: string;
  email: string | null;
}

interface CloudState {
  available: boolean;
  user: CloudUser | null;
  syncing: boolean;
  lastSync: number | null;
  error: string | null;
  init: () => void;
  signIn: (email: string, password: string, create?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

export const useCloud = create<CloudState>((set, get) => ({
  available: cloudAvailable(),
  user: null,
  syncing: false,
  lastSync: null,
  error: null,

  init() {
    if (!cloudAvailable()) return;
    // Subscribe to auth changes and auto-sync on sign-in / reconnect.
    void import('@/services/auth/firebaseAuth').then(({ firebaseAuth }) => {
      firebaseAuth.onChange((u) => {
        set({ user: u ? { uid: u.uid, email: u.email } : null });
        if (u) void get().syncNow();
      });
    });
    // Auto-sync: on reconnect, on app foreground, and periodically.
    window.addEventListener('online', () => void get().syncNow());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void get().syncNow();
    });
    setInterval(() => void get().syncNow(), 120_000);
  },

  async signIn(email, password, create) {
    set({ error: null });
    try {
      const { firebaseAuth } = await import('@/services/auth/firebaseAuth');
      const user = create
        ? await firebaseAuth.signUp(email, password)
        : await firebaseAuth.signIn(email, password);
      set({ user: { uid: user.uid, email: user.email } });
      await get().syncNow();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Sign-in failed' });
    }
  },

  async signOut() {
    const { firebaseAuth } = await import('@/services/auth/firebaseAuth');
    await firebaseAuth.signOutUser();
    set({ user: null });
  },

  async syncNow() {
    const { user } = get();
    if (!user || get().syncing) return;
    set({ syncing: true });
    try {
      const { SyncEngine } = await import('@/data/sync/SyncEngine');
      await new SyncEngine(user.uid).sync();
      set({ lastSync: Date.now() });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Sync failed' });
    } finally {
      set({ syncing: false });
    }
  },
}));
