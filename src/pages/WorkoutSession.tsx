import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { StatTile } from '@/components/StatTile';
import { formatDuration } from '@/lib/utils';
import { logVolume, logSetCount, logExerciseCount } from '@/lib/calc';
import { muscleColor, muscleLabel } from '@/lib/muscle';
import { HAPTIC, vibrate } from '@/lib/haptics';

export function WorkoutSession() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const plan = useWorkout((s) => s.plan);
  const active = useWorkout((s) => s.active);
  const updateSet = useWorkout((s) => s.updateSet);
  const toggleSetDone = useWorkout((s) => s.toggleSetDone);
  const addSet = useWorkout((s) => s.addSet);
  const removeSet = useWorkout((s) => s.removeSet);
  const addExercise = useWorkout((s) => s.addExercise);
  const removeExercise = useWorkout((s) => s.removeExercise);
  const beginTimer = useWorkout((s) => s.beginTimer);
  const discardDraft = useWorkout((s) => s.discardDraft);
  const discardActive = useWorkout((s) => s.discardActive);
  const finishSession = useWorkout((s) => s.finishSession);
  const previousFor = useWorkout((s) => s.previousFor);

  const restDefault = useSettings((s) => s.settings?.restDefaultSec ?? 90);
  const startRest = useTimer((s) => s.startRest);
  const timerOn = useTimer((s) => s.running || s.paused);
  const byExercise = useVideos((s) => s.byExercise);

  const [videoAsset, setVideoAsset] = useState<VideoAsset | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<null | {
    durationSec: number;
    volume: number;
    sets: number;
    exercises: number;
  }>(null);
  const didInit = useRef(false);

  const running = !!active?.startedAt && !active?.finished;
  useWakeLock(running);
  const ticking = useElapsed(active && !active.finished ? active.startedAt : null);
  const elapsed = active?.finished ? active.durationSec : ticking;

  useEffect(() => {
    if (!active || didInit.current) return;
    didInit.current = true;
  }, [active]);

  const totalSets = active?.exercises.reduce((a, e) => a + e.sets.length, 0) ?? 0;
  const doneSets = active?.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0) ?? 0;
  const runningVolume = useMemo(() => (active ? logVolume(active) : 0), [active]);

  const availableToAdd = useMemo(() => {
    if (!plan || !active) return [];
    const inSession = new Set(active.exercises.map((e) => e.exerciseId));
    const q = search.trim().toLowerCase();
    return Object.values(plan.exercises)
      .filter((ex) => !inSession.has(ex.id))
      .filter((ex) => !q || ex.name.toLowerCase().includes(q) || ex.targetMuscle.toLowerCase().includes(q));
  }, [plan, active, search]);

  if (!plan || !active) {
    return (
      <div className="space-y-4 pt-16 text-center">
        <p className="text-earth-muted">{t('progress.noData')}</p>
        <button type="button" onClick={() => navigate('/workout')} className="btn-primary mx-auto">
          {t('nav.workout')}
        </button>
      </div>
    );
  }

  const day = plan.days.find((d) => d.id === active.dayId);
  const recording = !!active.startedAt || active.finished;

  const minimize = () => {
    discardDraft(); // no-op if already started/saved
    navigate('/workout');
  };

  const handleToggle = (exerciseId: string, setIndex: number) => {
    const ex = active.exercises.find((e) => e.exerciseId === exerciseId);
    const wasDone = ex?.sets.find((s) => s.setIndex === setIndex)?.done;
    toggleSetDone(exerciseId, setIndex);
    if (!wasDone) {
      vibrate(HAPTIC.success);
      startRest(restDefault);
    }
  };

  const openVideo = (exerciseId: string) => {
    setVideoAsset(byExercise(exerciseId));
    setVideoTitle(plan.exercises[exerciseId]?.name ?? '');
  };

  const doSave = async () => {
    await finishSession();
    setSummary({
      durationSec: active.startedAt ? Math.round((Date.now() - active.startedAt) / 1000) : active.durationSec,
      volume: logVolume(active),
      sets: logSetCount(active),
      exercises: logExerciseCount(active),
    });
    setConfirmOpen(false);
  };

  const doDiscard = async () => {
    setConfirmOpen(false);
    await discardActive();
    navigate('/');
  };

  // --- Finish summary (full-screen) ---
  if (summary) {
    return (
      <div className="anim-fade flex min-h-[80vh] flex-col items-center justify-center px-2 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success text-white shadow-[0_0_40px_rgba(46,93,60,0.6)]">
          <Icon name="check" size={36} />
        </div>
        <p className="eyebrow mt-7">{t('gt.workoutComplete')}</p>
        <h1 className="h1 mt-2">
          {t('gt.strongSession')} <span className="font-serif italic text-brand">{t('gt.logged')}</span>
        </h1>
        <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
          <StatTile icon="timer" value={formatDuration(summary.durationSec)} label={t('gt.duration')} />
          <StatTile icon="arrowUp" value={(summary.volume / 1000).toFixed(1)} unit="t" label={t('gt.volume')} />
          <StatTile icon="bolt" value={summary.sets} label={t('gt.setsDone')} />
          <StatTile icon="list" value={summary.exercises} label={t('gt.exercises')} />
        </div>
        <button type="button" onClick={() => navigate('/')} className="btn-primary mt-8 w-full max-w-sm">
          {t('common.done')}
        </button>
      </div>
    );
  }

  return (
    <div className="-mx-5 flex min-h-screen flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-black px-5 py-3">
        <button type="button" onClick={minimize} className="icon-btn h-[42px] w-[42px]" aria-label="minimize">
          <Icon name="chevronDown" size={20} />
        </button>
        <div className="flex flex-col items-center">
          <p className="eyebrow">{day?.title ?? t('workout.session')}</p>
          {recording ? (
            <p className="font-mono text-[22px] font-medium tabular-nums">{formatDuration(elapsed)}</p>
          ) : (
            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-earth-subtle">{t('workout.notStarted')}</p>
          )}
        </div>
        {recording ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="flex h-[42px] items-center rounded-full bg-brand px-5 font-mono text-[12px] font-medium uppercase tracking-[0.04em] text-white transition-transform active:scale-95"
          >
            {t('common.finish')}
          </button>
        ) : (
          <button
            type="button"
            onClick={beginTimer}
            className="flex h-[42px] items-center gap-1.5 rounded-full bg-brand px-5 font-mono text-[12px] font-medium uppercase tracking-[0.04em] text-white transition-transform active:scale-95"
          >
            <Icon name="play" size={14} /> {t('common.start')}
          </button>
        )}
      </header>

      {/* Progress */}
      <div className="px-5 py-3">
        <div className="prog">
          <span style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[11.5px] text-earth-muted">
          <span>{t('gt.setsCount', { done: doneSets, total: totalSets })}</span>
          <span>{(runningVolume / 1000).toFixed(1)}t</span>
        </div>
      </div>

      {/* Exercise blocks */}
      <div className="flex-1 space-y-3 px-5 pb-44">
        {active.exercises.map((log) => {
          const ex = plan.exercises[log.exerciseId];
          if (!ex) return null;
          return (
            <ExerciseCard
              key={log.exerciseId}
              exercise={ex}
              log={log}
              prev={previousFor(log.exerciseId)}
              onUpdateSet={(setIndex, patch) => updateSet(log.exerciseId, setIndex, patch)}
              onToggleDone={(setIndex) => handleToggle(log.exerciseId, setIndex)}
              onAddSet={() => addSet(log.exerciseId)}
              onRemoveSet={(setIndex) => removeSet(log.exerciseId, setIndex)}
              onVideo={() => openVideo(log.exerciseId)}
              onRemoveExercise={active.exercises.length > 1 ? () => removeExercise(log.exerciseId) : undefined}
            />
          );
        })}

        <button type="button" onClick={() => setPickerOpen(true)} className="btn-ghost w-full">
          <Icon name="plus" size={15} /> {t('gt.addExercise')}
        </button>
      </div>

      {/* Floating rest timer */}
      {timerOn && (
        <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center px-5">
          <RestTimerBar />
        </div>
      )}

      {/* Finish confirm */}
      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('gt.finishWorkoutQ')}>
        <p className="mb-5 font-mono text-[13px] text-earth-muted">
          {t('gt.setsCount', { done: doneSets, total: totalSets })} · {(runningVolume / 1000).toFixed(1)}t · {formatDuration(elapsed)}
        </p>
        <div className="space-y-2.5">
          <button type="button" onClick={() => void doSave()} className="btn-primary w-full">
            {t('gt.saveWorkout')}
          </button>
          <button type="button" onClick={() => setConfirmOpen(false)} className="btn-ghost w-full">
            {t('gt.keepGoing')}
          </button>
          <button type="button" onClick={() => void doDiscard()} className="btn-danger w-full">
            {t('gt.discard')}
          </button>
        </div>
      </Sheet>

      {/* Exercise picker */}
      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title={t('gt.addExercise')}>
        <div className="relative mb-3">
          <span className="absolute inset-y-0 left-3 flex items-center text-earth-subtle rtl:left-auto rtl:right-3">
            <Icon name="search" size={18} />
          </span>
          <input
            className="input pl-10 rtl:pl-4 rtl:pr-10"
            placeholder={t('gt.searchExercises')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto">
          {availableToAdd.map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => {
                  addExercise(ex.id);
                  setPickerOpen(false);
                  setSearch('');
                }}
                className="row w-full text-start"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: muscleColor(ex.targetMuscle) }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{ex.name}</p>
                  <p className="font-mono text-[11.5px] text-earth-muted">{muscleLabel(ex.targetMuscle, t)}</p>
                </div>
                <Icon name="plus" size={18} className="text-brand" />
              </button>
            </li>
          ))}
          {availableToAdd.length === 0 && (
            <li className="py-6 text-center font-mono text-[12px] text-earth-subtle">—</li>
          )}
        </ul>
      </Sheet>

      <VideoPlayerSheet asset={videoAsset} title={videoTitle} onClose={() => setVideoAsset(null)} />
    </div>
  );
}
