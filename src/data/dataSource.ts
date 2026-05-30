import type { DataSource } from './repositories';
import { LocalDataSource } from './adapters/local/LocalDataSource';
import { isFirebaseConfigured } from './adapters/firebase/config';

let instance: DataSource | null = null;

/**
 * Returns the active data source. Local-only by default; when Firebase env
 * vars are present the Firebase adapter is loaded lazily so the local build
 * never bundles auth flows it doesn't use.
 *
 * The Firebase adapter mirrors writes to a local cache and is created via the
 * same `DataSource` contract, so callers are identical in both modes.
 */
export function getDataSource(): DataSource {
  if (instance) return instance;
  // NB: Firebase adapter is wired in src/data/adapters/firebase/FirebaseDataSource.ts.
  // It is intentionally NOT imported eagerly; bootstrap() upgrades the instance
  // asynchronously when configured. Until then everything runs on local storage.
  instance = new LocalDataSource();
  return instance;
}

/** Whether cloud sync *could* be enabled in this build. */
export function cloudAvailable(): boolean {
  return isFirebaseConfigured();
}

/** Allows the bootstrap step to swap in the Firebase-backed source. */
export function setDataSource(ds: DataSource): void {
  instance = ds;
}
