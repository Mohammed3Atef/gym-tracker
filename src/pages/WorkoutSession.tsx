import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { VideoAsset } from '@/types';
import { useWorkout } from '@/stores/workoutStore';
import { useSettings } from '@/stores/settingsStore';
import { useTimer } from '@/stores/timerStore';
import { useVideos } from '@/stores/videoStore';
import { confirmDialog } from '@/stores/dialogStore';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useElapsed } from '@/hooks/useElapsed';
import { ExerciseCard } from '@/components/ExerciseCard';
import { RestTimerBar } from '@/components/RestTimerBar';
import { VideoPlayerSheet } from '@/components/VideoPlayerSheet';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { formatDuration, parseRestInput } from '@/lib/utils';
import { HAPTIC, vibrate } from '@/lib/haptics';

const REST_PRESETS = [45, 60, 90, 120, 150, 180];

export function WorkoutSession() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const plan = useWorkout((s) => s.plan);
  const active = useWorkout((s) => s.active);
  const updateSet = useWorkout((s) => s.updateSet);
  const toggleSetDone = useWorkout((s) => s.toggleSetDone);
  const addSet = useWorkout((s) => s.addSet);
  const removeSet = useWorkout((s) => s.removeSet);
  const beginTimer = useWorkout((s) => s.beginTimer);
  const discardDraft = useWorkout((s) => s.discardDraft);
  const finishSession = useWorkout((s) => s.finishSession);
  const previousFor = useWorkout((s) => s.previousFor);

  const restDefault = useSettings((s) => s.settings?.restDefaultSec ?? 90);
  const startRest = useTimer((s) => s.startRest);
  const timerOn = useTimer((s) => s.running || s.paused);
  const byExercise = useVideos((s) => s.byExercise);

  const [videoAsset, setVideoAsset] = useState<VideoAsset | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [restOpen, setRestOpen] = useState(false);
  const [restSec, setRestSec] = useState(restDefault);
  const [customRest, setCustomRest] = useState('');
  const didInit = useRef(false);

  const running = !!active?.startedAt && !active?.finished;
  useWakeLock(running);
  // Tick only while a live session is running; finished workouts show the saved time.
  const ticking = useElapsed(active && !active.finished ? active.startedAt : null);
  const elapsed = active?.finished ? active.durationSec : ticking;

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
  // The session has begun (timer started or already finished) — until then
  // nothing is recorded and "Finish" is hidden.
  const recording = !!active.startedAt || active.finished;

  const goBack = () => {
    discardDraft(); // no-op if already started/saved
    navigate('/workout');
  };

  const handleToggle = (exerciseId: string, setIndex: number) => {
    const ex = active.exercises.find((e) => e.exerciseId === exerciseId);
    const wasDone = ex?.sets.find((s) => s.setIndex === setIndex)?.done;
    toggleSetDone(exerciseId, setIndex);
    if (!wasDone) {
      // Completing a set: haptic + auto-start the rest timer with the chosen duration.
      vibrate(HAPTIC.success);
      startRest(restSec);
    }
  };

  const openVideo = (exerciseId: string) => {
    setVideoAsset(byExercise(exerciseId));
    setVideoTitle(plan.exercises[exerciseId]?.name ?? '');
  };

  const pickRest = (sec: number) => {
    setRestSec(sec);
    startRest(sec);
    setRestOpen(false);
  };

  const applyCustomRest = () => {
    const sec = parseRestInput(customRest);
    if (sec && sec > 0) {
      setCustomRest('');
      pickRest(sec);
    }
  };

  const handleFinish = async () => {
    const ok = await confirmDialog({
      title: t('workout.finishWorkout'),
      message: t('workout.confirmFinish'),
      confirmLabel: t('common.finish'),
    });
    if (!ok) return;
    await finishSession();
    navigate('/progress');
  };

  return (
    <div className="space-y-3 pb-24">
      {/* Sticky session header */}
      <header className="sticky top-0 z-30 -mx-4 mb-1 flex items-center justify-between gap-2 bg-surface/95 px-4 py-2 backdrop-blur">
        <button type="button" onClick={goBack} className="icon-btn h-10 w-10" aria-label="back">
          <Icon name="chevron" size={18} className="rotate-180" />
        </button>
        <div className="flex flex-col items-center">
          <p className="text-xs text-slate-400">{day?.title} · {doneSets}/{totalSets} {t('common.sets')}</p>
          {recording ? (
            <p className="font-mono text-lg font-bold tabular-nums text-brand-light">{formatDuration(elapsed)}</p>
          ) : (
            <span className="text-[10px] text-slate-500">{t('workout.notStarted')}</span>
          )}
        </div>
        {recording ? (
          <button
            type="button"
            onClick={() => void handleFinish()}
            className="flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-bold text-slate-950 transition-transform active:scale-95"
          >
            {t('common.finish')}
          </button>
        ) : (
          <button
            type="button"
            onClick={beginTimer}
            className="flex h-10 items-center gap-1 rounded-xl bg-brand px-4 text-sm font-bold text-slate-950 transition-transform active:scale-95"
          >
            <Icon name="play" size={16} /> {t('common.start')}
          </button>
        )}
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

      {recording ? (
        <button type="button" onClick={() => void handleFinish()} className="btn-primary btn-lg mt-2 w-full">
          <Icon name="check" size={20} /> {t('workout.finishWorkout')}
        </button>
      ) : (
        <button type="button" onClick={beginTimer} className="btn-primary btn-lg mt-2 w-full">
          <Icon name="play" size={20} /> {t('common.start')}
        </button>
      )}

      {/* Fixed bottom bar: rest timer when running, otherwise a "rest" button that
          opens the duration picker. The session timer stays in the header above. */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-surface-card/95 px-3 py-2 backdrop-blur"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <div className="mx-auto flex max-w-md items-center justify-center gap-2">
          {timerOn ? (
            <RestTimerBar />
          ) : (
            <button type="button" onClick={() => setRestOpen(true)} className="btn-ghost h-11 w-full text-sm">
              <Icon name="timer" size={18} /> {t('workout.rest')} · {formatDuration(restSec)}
            </button>
          )}
        </div>
      </div>

      {/* Rest duration picker */}
      <Sheet open={restOpen} onClose={() => setRestOpen(false)} title={t('workout.restTimer')}>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {REST_PRESETS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => pickRest(sec)}
                className={`btn-ghost btn-lg ${sec === restSec ? '!bg-brand !text-slate-950' : ''}`}
              >
                {formatDuration(sec)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1 text-center"
              inputMode="numeric"
              placeholder={t('workout.restCustom')}
              value={customRest}
              onChange={(e) => setCustomRest(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyCustomRest()}
            />
            <button type="button" onClick={applyCustomRest} className="btn-primary px-4">
              {t('common.start')}
            </button>
          </div>
        </div>
      </Sheet>

      <VideoPlayerSheet asset={videoAsset} title={videoTitle} onClose={() => setVideoAsset(null)} />
    </div>
  );
}
