import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { VideoAsset } from '@/types';
import { useWorkout } from '@/stores/workoutStore';
import { useSettings } from '@/stores/settingsStore';
import { useTimer } from '@/stores/timerStore';
import { useVideos } from '@/stores/videoStore';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useElapsed } from '@/hooks/useElapsed';
import { ExerciseCard } from '@/components/ExerciseCard';
import { RestTimerBar } from '@/components/RestTimerBar';
import { VideoPlayerSheet } from '@/components/VideoPlayerSheet';
import { Icon } from '@/components/Icon';
import { formatDuration } from '@/lib/utils';
import { HAPTIC, vibrate } from '@/lib/haptics';

export function WorkoutSession() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const plan = useWorkout((s) => s.plan);
  const active = useWorkout((s) => s.active);
  const updateSet = useWorkout((s) => s.updateSet);
  const toggleSetDone = useWorkout((s) => s.toggleSetDone);
  const addSet = useWorkout((s) => s.addSet);
  const finishSession = useWorkout((s) => s.finishSession);
  const previousFor = useWorkout((s) => s.previousFor);

  const restDefault = useSettings((s) => s.settings?.restDefaultSec ?? 90);
  const startRest = useTimer((s) => s.startRest);
  const timerOn = useTimer((s) => s.running || s.paused);
  const removeSet = useWorkout((s) => s.removeSet);
  const byExercise = useVideos((s) => s.byExercise);

  const [videoAsset, setVideoAsset] = useState<VideoAsset | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  // Accordion: any number of exercise cards can be open at once.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const didInit = useRef(false);

  // Keep the screen awake for the whole session.
  useWakeLock(!!active);
  const elapsed = useElapsed(active?.startedAt ?? null);

  // Auto-expand the first not-yet-finished exercise the first time the session loads.
  useEffect(() => {
    if (!active || didInit.current) return;
    didInit.current = true;
    const firstOpen = active.exercises.find((e) => !e.done) ?? active.exercises[0];
    if (firstOpen) setExpandedIds(new Set([firstOpen.exerciseId]));
  }, [active]);

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!plan || !active) {
    return (
      <div className="space-y-4 pt-10 text-center">
        <p className="text-slate-400">{t('progress.noData')}</p>
        <button type="button" onClick={() => navigate('/workout')} className="btn-primary">
          {t('nav.workout')}
        </button>
      </div>
    );
  }

  const day = plan.days.find((d) => d.id === active.dayId);
  const totalSets = active.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = active.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);

  const handleToggle = (exerciseId: string, setIndex: number) => {
    const ex = active.exercises.find((e) => e.exerciseId === exerciseId);
    const wasDone = ex?.sets.find((s) => s.setIndex === setIndex)?.done;
    toggleSetDone(exerciseId, setIndex);
    if (!wasDone) {
      // Completing a set: haptic + auto-start rest timer.
      vibrate(HAPTIC.success);
      const restSec = plan.exercises[exerciseId]?.restSec ?? restDefault;
      startRest(restSec);
    }
  };

  const openVideo = (exerciseId: string) => {
    const asset = byExercise(exerciseId);
    setVideoAsset(asset);
    setVideoTitle(plan.exercises[exerciseId]?.name ?? '');
  };

  const handleFinish = async () => {
    if (!window.confirm(t('workout.confirmFinish'))) return;
    await finishSession();
    navigate('/progress');
  };

  return (
    <div className="space-y-3 pb-24">
      {/* Sticky session header */}
      <header className="sticky top-0 z-30 -mx-4 mb-1 flex items-center justify-between gap-2 bg-surface/95 px-4 py-2 backdrop-blur">
        <button type="button" onClick={() => navigate('/workout')} className="icon-btn h-10 w-10" aria-label="back">
          <Icon name="chevron" size={18} className="rotate-180" />
        </button>
        <div className="text-center">
          <p className="text-xs text-slate-400">{day?.title} · {doneSets}/{totalSets} {t('common.sets')}</p>
          <p className="font-mono text-lg font-bold tabular-nums text-brand-light">{formatDuration(elapsed)}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleFinish()}
          className="flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-bold text-slate-950 transition-transform active:scale-95"
        >
          {t('common.finish')}
        </button>
      </header>

      <div className="space-y-3">
        {active.exercises.map((log) => {
          const ex = plan.exercises[log.exerciseId];
          if (!ex) return null;
          return (
            <ExerciseCard
              key={log.exerciseId}
              exercise={ex}
              log={log}
              prev={previousFor(log.exerciseId)}
              expanded={expandedIds.has(log.exerciseId)}
              onToggle={() => toggleExpanded(log.exerciseId)}
              onUpdateSet={(setIndex, patch) => updateSet(log.exerciseId, setIndex, patch)}
              onToggleDone={(setIndex) => handleToggle(log.exerciseId, setIndex)}
              onAddSet={() => addSet(log.exerciseId)}
              onRemoveSet={(setIndex) => removeSet(log.exerciseId, setIndex)}
              onVideo={() => openVideo(log.exerciseId)}
            />
          );
        })}
      </div>

      <button type="button" onClick={() => void handleFinish()} className="btn-primary btn-lg mt-2 w-full">
        <Icon name="check" size={20} /> {t('workout.finishWorkout')}
      </button>

      {/* Fixed bottom bar: rest timer when running, otherwise a quick "start rest"
          button — the session timer always stays visible in the header above. */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-surface-card/95 px-3 py-2 backdrop-blur"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <div className="mx-auto flex max-w-md items-center justify-center gap-2">
          {timerOn ? (
            <RestTimerBar />
          ) : (
            <button type="button" onClick={() => startRest(restDefault)} className="btn-ghost h-11 w-full text-sm">
              <Icon name="timer" size={18} /> {t('workout.rest')} · {restDefault}s
            </button>
          )}
        </div>
      </div>

      <VideoPlayerSheet asset={videoAsset} title={videoTitle} onClose={() => setVideoAsset(null)} />
    </div>
  );
}
