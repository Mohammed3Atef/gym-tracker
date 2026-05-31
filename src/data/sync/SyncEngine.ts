import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { ensureFirebase } from '@/data/adapters/firebase/firebase';
import { getDataSource } from '@/data/dataSource';
import type { Repository, SingletonRepository } from '@/data/repositories';
import type { AppSettings, UserProfile } from '@/types';
import { clearAllTombstones, clearTombstone, listTombstones } from './tombstones';

/**
 * Conflict-safe one-way-then-merge sync between the local store (source of
 * truth while offline) and Firestore. Strategy: last-write-wins by `updatedAt`.
 *
 *  push(): upload every locally-`dirty` record, then clear its dirty flag.
 *  pull(): download remote records and overwrite local ones that are older.
 *
 * Only runs when the user has opted into cloud sync and is signed in. Reads in
 * the app always come from the local store, so the UI is unaffected by sync.
 */

type Dirty = { id: string; updatedAt: number; dirty?: boolean };

/** Recursively drop `undefined` values — Firestore rejects them. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripUndefined(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

const COLLECTIONS = [
  'workoutLogs',
  'nutritionLogs',
  'cardioLogs',
  'weightLogs',
  'measurementLogs',
  'progressPhotos',
  'dailyChecklists',
  'videoAssets',
  'reminders',
] as const;

type CollName = (typeof COLLECTIONS)[number];

function repoFor(name: CollName): Repository<Dirty> {
  const ds = getDataSource() as unknown as Record<CollName, Repository<Dirty>>;
  return ds[name];
}

export class SyncEngine {
  constructor(private uid: string) {}

  private path(name: string): string {
    return `users/${this.uid}/${name}`;
  }

  async pushCollection(name: CollName): Promise<number> {
    const { db } = ensureFirebase();
    const repo = repoFor(name);
    const all = await repo.getAll();
    const dirty = all.filter((r) => r.dirty);
    for (const rec of dirty) {
      await setDoc(doc(db, this.path(name), rec.id), stripUndefined(rec) as Record<string, unknown>);
      await repo.put({ ...rec, dirty: false });
    }
    return dirty.length;
  }

  async pullCollection(name: CollName): Promise<number> {
    const { db } = ensureFirebase();
    const repo = repoFor(name);
    const snap = await getDocs(collection(db, this.path(name)));
    let pulled = 0;
    for (const d of snap.docs) {
      const remote = d.data() as Dirty;
      const local = await repo.get(remote.id);
      if (!local || remote.updatedAt > local.updatedAt) {
        await repo.put({ ...remote, dirty: false });
        pulled += 1;
      }
    }
    return pulled;
  }

  /** Sync the profile + settings singletons (last-write-wins by updatedAt). */
  private async syncSingleton<T extends { updatedAt: number }>(
    path: string,
    repo: SingletonRepository<T>,
  ): Promise<void> {
    const { db } = ensureFirebase();
    const ref = doc(db, path);
    const [local, remoteSnap] = await Promise.all([repo.get(), getDoc(ref)]);
    const remote = remoteSnap.exists() ? (remoteSnap.data() as T) : null;
    if (local && (!remote || local.updatedAt >= remote.updatedAt)) {
      await setDoc(ref, stripUndefined(local) as Record<string, unknown>);
    } else if (remote && (!local || remote.updatedAt > local.updatedAt)) {
      await repo.set(remote);
    }
  }

  /** Push queued local deletions to the cloud (so deleted records don't return). */
  async flushDeletions(): Promise<number> {
    const { db } = ensureFirebase();
    const tombs = await listTombstones();
    for (const t of tombs) {
      try {
        await deleteDoc(doc(db, `users/${this.uid}/${t.collection}/${t.id}`));
      } catch {
        /* ignore; will retry next sync */
      }
      await clearTombstone(t.collection, t.id);
    }
    return tombs.length;
  }

  /** Delete ALL of this user's cloud data (used by "reset all data"). */
  async wipeCloud(): Promise<void> {
    const { db } = ensureFirebase();
    for (const name of COLLECTIONS) {
      const snap = await getDocs(collection(db, `users/${this.uid}/${name}`));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }
    await deleteDoc(doc(db, `users/${this.uid}/profile/main`)).catch(() => undefined);
    await deleteDoc(doc(db, `users/${this.uid}/settings/app`)).catch(() => undefined);
    await clearAllTombstones();
  }

  /** Full bidirectional sync pass. */
  async sync(): Promise<{ pushed: number; pulled: number }> {
    if (!navigator.onLine) return { pushed: 0, pulled: 0 };
    const ds = getDataSource();
    // Deletions FIRST, so pulling can't re-add records we just deleted.
    await this.flushDeletions();
    await this.syncSingleton<UserProfile>(`users/${this.uid}/profile/main`, ds.profile);
    await this.syncSingleton<AppSettings>(`users/${this.uid}/settings/app`, ds.settings);
    let pushed = 0;
    let pulled = 0;
    for (const name of COLLECTIONS) {
      pulled += await this.pullCollection(name);
      pushed += await this.pushCollection(name);
    }
    return { pushed, pulled };
  }
}
