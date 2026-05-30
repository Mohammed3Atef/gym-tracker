import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWorkout } from '@/stores/workoutStore';
import { Icon } from '@/components/Icon';
import { TrainingGuideSheet } from '@/components/TrainingGuideSheet';

export function Workout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [guideOpen, setGuideOpen] = useState(false);
  const plan = useWorkout((s) => s.plan);
  const rawActive = useWorkout((s) => s.active);
  const startSession = useWorkout((s) => s.startSession);
  // Ignore an unstarted, unsaved draft — only a started/finished session counts.
  const active = rawActive && (rawActive.startedAt || rawActive.finished) ? rawActive : null;

  if (!plan) return <p className="text-slate-400">{t('progress.noData')}</p>;

  const start = async (dayId: string) => {
    await startSession(dayId);
    navigate('/workout/session');
  };

  const activeDay = active ? plan.days.find((d) => d.id === active.dayId) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('workout.weeklyPlan')}</h1>
        <button type="button" onClick={() => setGuideOpen(true)} className="icon-btn h-10 w-10" aria-label={t('guide.title')}>
          <Icon name="info" size={20} />
        </button>
      </div>
      <TrainingGuideSheet open={guideOpen} onClose={() => setGuideOpen(false)} />

      {active && (
        <button
          type="button"
          onClick={() => navigate('/workout/session')}
          className="btn-primary btn-lg w-full"
        >
          <Icon name={active.finished ? 'edit' : 'play'} size={20} />
          {active.finished
            ? `${t('common.edit')} · ${activeDay?.title ?? ''}`
            : `${t('workout.resumeSession')} · ${activeDay?.title ?? ''}`}
        </button>
      )}

      <ul className="space-y-3">
        {plan.days.map((day) => {
          const isActive = active?.dayId === day.id;
          return (
          <li key={day.id} className={`card ${isActive ? 'ring-1 ring-brand/40' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{day.title}</h2>
                <p className="text-sm text-slate-400">{day.focus}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {day.exerciseIds.length} {t('workout.exercises')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void start(day.id)}
                className="btn-primary h-12 px-4"
              >
                <Icon name={isActive ? 'edit' : 'play'} size={18} />
                {isActive ? t('common.edit') : t('common.start')}
              </button>
            </div>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {day.exerciseIds.slice(0, 8).map((id) => (
                <li key={id} className="rounded-full bg-surface-raised px-2 py-1 text-xs text-slate-300">
                  {plan.exercises[id]?.name}
                </li>
              ))}
            </ul>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
