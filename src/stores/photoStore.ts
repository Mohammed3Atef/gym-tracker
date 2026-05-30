import { create } from 'zustand';
import type { PhotoPose, ProgressPhoto } from '@/types';
import { getDataSource } from '@/data/dataSource';
import { blobStore } from '@/data/blobStore';
import { today, uid } from '@/lib/utils';

interface PhotoState {
  photos: ProgressPhoto[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (pose: PhotoPose, file: Blob, opts?: { date?: string; weightKg?: number; note?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  url: (photo: ProgressPhoto) => Promise<string | null>;
}

export const usePhotos = create<PhotoState>((set, get) => ({
  photos: [],
  loaded: false,

  async load() {
    const photos = await getDataSource().progressPhotos.getAll();
    set({ photos: photos.sort((a, b) => b.date.localeCompare(a.date)), loaded: true });
  },

  async add(pose, file, opts) {
    const id = uid('photo');
    const localKey = `photo:${id}`;
    await blobStore.put(localKey, file);
    const photo: ProgressPhoto = {
      id,
      date: opts?.date ?? today(),
      pose,
      localKey,
      weightKg: opts?.weightKg,
      note: opts?.note,
      updatedAt: Date.now(),
      dirty: true,
    };
    await getDataSource().progressPhotos.put(photo);
    set({ photos: [photo, ...get().photos] });
  },

  async remove(id) {
    const photo = get().photos.find((p) => p.id === id);
    if (photo) await blobStore.remove(photo.localKey);
    await getDataSource().progressPhotos.remove(id);
    set({ photos: get().photos.filter((p) => p.id !== id) });
  },

  url(photo) {
    return blobStore.objectUrl(photo.localKey);
  },
}));
