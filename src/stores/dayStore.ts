import { create } from 'zustand';
import { addDays, today } from '@/lib/utils';

/**
 * The calendar day the whole app is currently focused on. All modules
 * (workout, nutrition, cardio, habits) read and write data for this day, so the
 * user can navigate to any date and log/review just that day's data.
 */
interface DayState {
  selected: string;
  setDay: (day: string) => void;
  shift: (deltaDays: number) => void;
  reset: () => void;
}

export const useDay = create<DayState>((set, get) => ({
  selected: today(),
  setDay: (day) => set({ selected: day }),
  shift: (deltaDays) => set({ selected: addDays(get().selected, deltaDays) }),
  reset: () => set({ selected: today() }),
}));
