import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Exercise, ExerciseLog, SetLog } from '@/types';
import type { PrevPerf } from '@/stores/workoutStore';
import { NumberStepper } from './NumberStepper';
import { Icon } from './Icon';
import { useLocalized } from '@/hooks/useLocalized';

interface ExerciseCardProps {
  exercise: Exercise;
  log: ExerciseLog;
  prev: PrevPerf | null;
  expanded: boolean;
  onToggle: () => void;
  onUpdateSet: (setIndex: number, patch: Partial<SetLog>) => void;
  onToggleDone: (setIndex: number) => void;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  onVideo: () => void;
}

export function ExerciseCard({
  exercise,
  log,
  prev,
  expanded,
  onToggle,
  onUpdateSet,
  onToggleDone,
  onAddSet,
  onRemoveSet,
  onVideo,
}: ExerciseCardProps) {
  const { t } = useTranslation();
  const loc = useLocalized();
  const [showNotes, setShowNotes] = useState(false);

  const doneCount = log.sets.filter((s) => s.done).length;
  const warmups = log.sets.filter((s) => s.type === 'warmup');
  const workings = log.sets.filter((s) => s.type === 'working');

  /** One set row — two-line layout: label/prev/done on top, steppers below. */
  const renderSet = (set: SetLog, label: string) => {
    const prevSet = prev?.sets[set.setIndex];
    const prevLabel =
      prevSet && (prevSet.weightKg != null || prevSet.actualReps != null)
        ? `${prevSet.weightKg ?? '–'}${t('common.kg')} × ${prevSet.actualReps ?? '–'}`
        : null;
    const isWarm = set.type === 'warmup';
    return (
      <li
        key={set.setIndex}
        className={`rounded-xl p-2 ${set.done ? 'bg-brand/10 ring-1 ring-brand/30' : 'bg-surface-raised/30'}`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg px-1 text-xs font-bold ${isWarm ? 'bg-warn/20 text-warn' : 'bg-surface-raised text-slate-300'}`}
            >
              {label}
            </span>
            {prevLabel && <span className="truncate text-xs text-slate-500">{prevLabel}</span>}
          </div>
          <button
            type="button"
            onClick={() => onToggleDone(set.setIndex)}
            className={`flex h-11 w-14 shrink-0 items-center justify-center rounded-xl transition-transform active:scale-90 ${
              set.done ? 'bg-brand text-slate-950' : 'bg-surface-raised text-slate-400'
            }`}
            aria-label={t('common.done')}
          >
            <Icon name="check" size={20} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
              {t('workout.weight')} ({t('common.kg')})
            </span>
            <NumberStepper
              ariaLabel={t('workout.weight')}
              value={set.weightKg}
              onChange={(v) => onUpdateSet(set.setIndex, { weightKg: v })}
              step={2.5}
              placeholder={prevSet?.weightKg != null ? String(prevSet.weightKg) : '0'}
            />
          </div>
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
              {t('common.reps')}
            </span>
            <NumberStepper
              ariaLabel={t('common.reps')}
              value={set.actualReps}
              onChange={(v) => onUpdateSet(set.setIndex, { actualReps: v })}
              step={1}
              placeholder={prevSet?.actualReps != null ? String(prevSet.actualReps) : set.targetReps || '0'}
            />
          </div>
        </div>
      </li>
    );
  };

  const workingSummary = [
    `${exercise.workingSets} ${t('common.sets')}`,
    exercise.repRange && exercise.repRange !== '-' ? exercise.repRange : null,
    exercise.rir && exercise.rir !== '-' ? `RIR ${exercise.rir}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className={`card !p-0 overflow-hidden ${log.done ? 'opacity-70' : ''}`}>
      {/* Accordion header — tap anywhere (except the video icon) to expand/collapse */}
      <header className="flex items-center justify-between gap-2 p-3">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-start">
          <span className="flex h-9 min-w-[2.75rem] items-center justify-center rounded-lg bg-surface-raised px-2 text-xs font-bold text-slate-300">
            {doneCount}/{log.sets.length}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-bold leading-tight">{exercise.name}</span>
            <span className="block truncate text-xs text-slate-400">{exercise.targetMuscle}</span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onVideo} className="icon-btn h-9 w-9" aria-label={t('workout.watchVideo')}>
            <Icon name="video" size={16} />
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="icon-btn h-9 w-9"
            aria-label={expanded ? t('common.close') : t('common.edit')}
          >
            <Icon name="chevron" size={16} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </header>

      {expanded && (
        <div className="space-y-3 px-3 pb-3">
          {/* Notes (collapsible) */}
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg bg-surface-raised/40 px-3 py-2 text-xs font-medium text-slate-300"
          >
            <span>{t('workout.notes')}</span>
            <Icon name="chevron" size={14} className={`transition-transform ${showNotes ? 'rotate-90' : ''}`} />
          </button>
          {showNotes && (
            <div className="rounded-xl bg-surface-raised/40 p-3 text-sm text-slate-300">
              {loc(exercise.notes)}
              {exercise.tempo && exercise.tempo !== '-' && (
                <p className="mt-1 text-xs text-slate-500">{t('workout.tempo')} {exercise.tempo}</p>
              )}
            </div>
          )}

          {/* Warm-up sets (matches the sheet's "Warm Up Sets" column) */}
          {warmups.length > 0 && (
            <div>
              <p className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-warn/20 px-1.5 py-0.5 font-semibold text-warn">
                  {t('workout.warmup')}
                </span>
                <span className="text-slate-500">{exercise.warmupSets}</span>
              </p>
              <ul className="space-y-2">
                {warmups.map((s, i) => renderSet(s, warmups.length > 1 ? `W${i + 1}` : 'W'))}
              </ul>
            </div>
          )}

          {/* Working sets (matches the sheet's "Working Sets" column) */}
          {workings.length > 0 && (
            <div>
              <p className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-brand/20 px-1.5 py-0.5 font-semibold text-brand-light">
                  {t('workout.working')}
                </span>
                <span className="text-slate-500">{workingSummary}</span>
              </p>
              <ul className="space-y-2">{workings.map((s, i) => renderSet(s, String(i + 1)))}</ul>

              <div className="mt-3 flex items-center justify-between gap-2">
                <button type="button" onClick={onAddSet} className="btn-ghost h-9 flex-1 text-xs">
                  <Icon name="plus" size={14} /> {t('workout.addSet')}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveSet(workings[workings.length - 1].setIndex)}
                  className="btn-ghost h-9 flex-1 text-xs text-slate-400"
                >
                  <Icon name="minus" size={14} /> {t('workout.removeSet')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
