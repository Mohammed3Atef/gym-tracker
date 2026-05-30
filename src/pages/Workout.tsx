import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWorkout } from '@/stores/workoutStore';
import { Icon } from '@/components/Icon';

export function Workout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const plan = useWorkout((s) => s.plan);
  const active = useWorkout((s) => s.active);
  const startSession = useWorkout((s) => s.startSession);

  if (!plan) return <p className="text-slate-400">{t('progress.noData')}</p>;

  const start = async (dayId: string) => {
    await startSession(dayId);
    navigate('/workout/session');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('workout.weeklyPlan')}</h1>

      {active && (
        <button
          type="button"
          onClick={() => navigate('/workout/session')}
          className="btn-primary btn-lg w-full"
        >
          <Icon name="play" size={20} />
          {t('workout.resumeSession')}
        </button>
      )}

      <ul className="space-y-3">
        {plan.days.map((day) => (
          <li key={day.id} className="card">
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
                <Icon name="play" size={18} />
                {t('common.start')}
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
        ))}
      </ul>
    </div>
  );
}
