import { create } from 'zustand';
import { cloudAvailable } from '@/data/dataSource';

interface CloudUser {
  uid: string;
  email: string | null;
}

export type CloudStatus = 'local' | 'signedIn' | 'syncing' | 'synced' | 'error';

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
  wipeCloud: () => Promise<void>;
}

/** Derive the badge status from the current cloud state. */
export function cloudStatus(s: Pick<CloudState, 'available' | 'user' | 'syncing' | 'lastSync' | 'error'>): CloudStatus {
  if (s.user && s.error) return 'error';
  if (!s.available || !s.user) return 'local';
  if (s.syncing) return 'syncing';
  if (s.lastSync) return 'synced';
  return 'signedIn';
}

export const useCloud = create<CloudState>((set, get) => ({
  available: cloudAvailable(),
  user: null,
  syncing: false,
  lastSync: null,
  error: null,

  init() {
    if (!cloudAvailable()) {
      console.info('[firebase] not configured — running local-only');
      return;
    }
    console.info('[firebase] configured — attaching auth listener');
    // Subscribe to auth changes and auto-sync on sign-in / reconnect.
    void import('@/services/auth/firebaseAuth').then(({ firebaseAuth }) => {
      firebaseAuth.onChange((u) => {
        console.info('[firebase] auth state:', u ? `signed in (${u.uid})` : 'signed out');
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
      console.info(`[firebase] ${create ? 'signing up' : 'signing in'} ${email}`);
      const { firebaseAuth } = await import('@/services/auth/firebaseAuth');
      const user = create
        ? await firebaseAuth.signUp(email, password)
        : await firebaseAuth.signIn(email, password);
      console.info('[firebase] signed in as', user.uid);
      set({ user: { uid: user.uid, email: user.email } });
      await get().syncNow();
    } catch (e) {
      console.error('[firebase] sign-in failed:', e);
      set({ error: e instanceof Error ? e.message : 'Sign-in failed' });
    }
  },

  async signOut() {
    const { firebaseAuth } = await import('@/services/auth/firebaseAuth');
    await firebaseAuth.signOutUser();
    console.info('[firebase] signed out');
    set({ user: null, lastSync: null });
  },

  async syncNow() {
    const { user } = get();
    if (!user || get().syncing) return;
    set({ syncing: true, error: null });
    try {
      const { SyncEngine } = await import('@/data/sync/SyncEngine');
      const result = await new SyncEngine(user.uid).sync();
      console.info(`[sync] done · pushed ${result.pushed}, pulled ${result.pulled} → users/${user.uid}`);
      set({ lastSync: Date.now() });
    } catch (e) {
      console.error('[sync] failed:', e);
      set({ error: e instanceof Error ? e.message : 'Sync failed' });
    } finally {
      set({ syncing: false });
    }
  },

  async wipeCloud() {
    const { user } = get();
    if (!user) return;
    const { SyncEngine } = await import('@/data/sync/SyncEngine');
    await new SyncEngine(user.uid).wipeCloud();
  },
}));
