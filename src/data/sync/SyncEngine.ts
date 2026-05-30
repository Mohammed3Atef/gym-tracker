import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { ensureFirebase } from '@/data/adapters/firebase/firebase';
import { getDataSource } from '@/data/dataSource';
import type { Repository, SingletonRepository } from '@/data/repositories';
import type { AppSettings, UserProfile } from '@/types';

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

const COLLECTIONS = [
  'workoutLogs',
  'nutritionLogs',
  'cardioLogs',
  'weightLogs',
  'progressPhotos',
  'dailyChecklists',
  'videoAssets',
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
      await setDoc(doc(db, this.path(name), rec.id), rec as Record<string, unknown>);
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
      await setDoc(ref, local as Record<string, unknown>);
    } else if (remote && (!local || remote.updatedAt > local.updatedAt)) {
      await repo.set(remote);
    }
  }

  /** Full bidirectional sync pass. */
  async sync(): Promise<{ pushed: number; pulled: number }> {
    if (!navigator.onLine) return { pushed: 0, pulled: 0 };
    const ds = getDataSource();
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
