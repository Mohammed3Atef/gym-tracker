import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { bootstrapData } from '@/data/bootstrap';
import { useSettings } from '@/stores/settingsStore';
import { useWorkout } from '@/stores/workoutStore';
import { useNutrition } from '@/stores/nutritionStore';
import { useCardio } from '@/stores/cardioStore';
import { useVideos } from '@/stores/videoStore';
import { useHabits } from '@/stores/habitStore';
import { useReminders } from '@/services/reminders/reminderStore';
import { useCloud } from '@/services/auth/cloudStore';
import { AppShell } from '@/components/AppShell';
import { Splash } from '@/components/Splash';
import { Home } from '@/pages/Home';
import { Workout } from '@/pages/Workout';
import { WorkoutSession } from '@/pages/WorkoutSession';
import { Nutrition } from '@/pages/Nutrition';
import { Cardio } from '@/pages/Cardio';
import { Progress } from '@/pages/Progress';
import { ProgressPhotos } from '@/pages/ProgressPhotos';
import { Settings } from '@/pages/Settings';
import { VideoManager } from '@/pages/VideoManager';
import { ImportData } from '@/pages/ImportData';

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      await bootstrapData();
      await Promise.all([
        useSettings.getState().load(),
        useWorkout.getState().load(),
        useNutrition.getState().load(),
        useCardio.getState().load(),
        useVideos.getState().load(),
      ]);
      await useHabits.getState().refresh();
      await useReminders.getState().load();
      useReminders.getState().start();
      useCloud.getState().init();
      // Ask the OS not to evict our IndexedDB data.
      if (navigator.storage?.persist) void navigator.storage.persist();
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
      useReminders.getState().stop();
    };
  }, []);

  if (!ready) return <Splash />;

  return (
    <Routes>
      <Route path="/" element={<AppShell><Home /></AppShell>} />
      <Route path="/workout" element={<AppShell><Workout /></AppShell>} />
      <Route path="/workout/session" element={<AppShell hideNav><WorkoutSession /></AppShell>} />
      <Route path="/nutrition" element={<AppShell><Nutrition /></AppShell>} />
      <Route path="/cardio" element={<AppShell><Cardio /></AppShell>} />
      <Route path="/progress" element={<AppShell><Progress /></AppShell>} />
      <Route path="/progress/photos" element={<AppShell><ProgressPhotos /></AppShell>} />
      <Route path="/settings" element={<AppShell><Settings /></AppShell>} />
      <Route path="/settings/videos" element={<AppShell><VideoManager /></AppShell>} />
      <Route path="/settings/import" element={<AppShell><ImportData /></AppShell>} />
      <Route path="*" element={<AppShell><Home /></AppShell>} />
    </Routes>
  );
}
