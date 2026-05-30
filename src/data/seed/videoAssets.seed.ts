import type { VideoAsset } from '@/types';
import { SEED_EXERCISE_LIST } from './workoutPlan.seed';

/**
 * Local exercise video files. The user placed the coach's clips in
 * `public/exercise_videos/` so they work offline. We map each exercise id to
 * its file name; the app serves them same-origin at `/exercise_videos/...` and
 * the service worker caches them (range-request aware) for offline playback.
 */
const LOCAL_VIDEOS: Record<string, string> = {
  lat_stretch_er: 'lat stretch with external rotation.mp4',
  upside_down_kb: 'upside down kb.mp4',
  rope_crunch: 'rope crunch.mp4',
  incline_db_press: 'incline db press.mp4',
  peck_deck: 'peck deck machine.mp4',
  chest_press_machine: 'chest press machine.mp4',
  db_lateral_raise: 'db lateral raise.mp4',
  tricep_overhead: 'tricep overhead extension.mp4',
  db_front_raise: 'db front raise.mp4',
  tricep_pushdown: 'tricep push down.mp4',
  scapula_pulls: 'single arm scapula pulls.mp4',
  scapula_retractions: 'scapula retractions.mp4',
  back_extension: 'back extension.mp4',
  low_row_close: 'seated low row close grip.mp4',
  // low_row_wide: no file provided
  lat_pulldown_wide: 'lat pulldown wide grip.mp4',
  rear_delt_fly: 'rear delt fly machine.mp4',
  seated_db_curl: 'seated bicep curl with db.mp4',
  db_shrugs: 'db shrugs.mp4',
  machine_preacher_curl: 'machine preacher curl.mp4',
  deep_lunge_rockbacks: 'deep lunge rockbacks.mp4',
  ankle_mobility: 'ankle mobility.mp4',
  hip_cars: 'hip cars.mp4',
  adductor_machine: 'adductor machine.mp4',
  leg_press: 'leg press machine.mp4',
  lying_curl: 'lying curl.mp4',
  leg_extension: 'leg extension.mp4',
  rdl_db: 'rdl db.mp4',
  seated_calves: 'seated calves machine.mp4',
  leg_raises: 'leg raises.mp4',
};

/** Same-origin URL to a bundled local video file (spaces percent-encoded). */
export function localVideoUrl(file: string): string {
  return `/exercise_videos/${encodeURIComponent(file)}`;
}

export const SEED_VIDEO_ASSETS: VideoAsset[] = SEED_EXERCISE_LIST.map((e) => {
  const file = LOCAL_VIDEOS[e.id];
  const sourceUrl = file ? localVideoUrl(file) : null;
  return {
    id: e.videoId,
    exerciseId: e.id,
    title: `${e.name} — explanation`,
    sourceUrl,
    kind: sourceUrl ? 'file' : 'unknown',
    status: sourceUrl ? 'not-downloaded' : 'link-pending',
    updatedAt: 0,
  };
});
