import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/stores/settingsStore';
import { useWorkout } from '@/stores/workoutStore';
import { useNutrition, computeConsumed } from '@/stores/nutritionStore';
import { useCardio } from '@/stores/cardioStore';
import { useHabits } from '@/stores/habitStore';
import { useReminders } from '@/services/reminders/reminderStore';
import { useTimer } from '@/stores/timerStore';
import { Icon, type IconName } from '@/components/Icon';
import { ProgressRing } from '@/components/ProgressRing';
import { Sheet } from '@/components/Sheet';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { useDay } from '@/stores/dayStore';
import { formatDuration } from '@/lib/utils';

const CHECKLIST_LABELS: Record<string, string> = {
  workout: 'nav.workout',
  supplements: 'nutrition.supplements',
  water: 'nutrition.water',
  steps: 'cardio.steps',
  cardio: 'home.cardio',
  creatine: 'nutrition.creatine',
};

export function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const profile = useSettings((s) => s.profile);
  const targets = useSettings((s) => s.settings?.targets);
  const plan = useWorkout((s) => s.plan);
  const logs = useWorkout((s) => s.logs);
  const active = useWorkout((s) => s.active);
  const startSession = useWorkout((s) => s.startSession);
  const mealPlan = useNutrition((s) => s.plan);
  const plannedMeals = mealPlan?.meals.length ?? 0;
  const nutritionLog = useNutrition((s) => s.log);
  const consumed = useMemo(() => computeConsumed(mealPlan, nutritionLog), [mealPlan, nutritionLog]);
  const latestWeight = useCardio((s) => s.latestWeight());
  const stepsFor = useCardio((s) => s.stepsFor);
  const logWeight = useCardio((s) => s.logWeight);
  const checklist = useHabits((s) => s.checklist);
  const streaks = useHabits((s) => s.streaks);
  const reminders = useReminders((s) => s.reminders);
  const startRest = useTimer((s) => s.startRest);

  const [weightOpen, setWeightOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [weight, setWeight] = useState('');

  // Suggested workout: rotate through the plan by number of finished sessions.
  const suggestedDay = useMemo(() => {
    if (!plan) return null;
    const finished = logs.filter((l) => l.finished).length;
    return plan.days[finished % plan.days.length];
  }, [plan, logs]);

  const eatenMeals = nutritionLog ? Object.values(nutritionLog.mealsEaten).filter(Boolean).length : 0;
  const selectedDay = useDay((s) => s.selected);
  const todaySteps = stepsFor(selectedDay);

  const nextReminder = useMemo(() => {
    const now = new Date();
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return (
      reminders
        .filter((r) => r.enabled && r.time >= hm)
        .sort((a, b) => a.time.localeCompare(b.time))[0] ?? null
    );
  }, [reminders]);

  const missed = checklist
    ? Object.entries(checklist.items).filter(([, v]) => !v.done).map(([k]) => k)
    : [];

  const startSuggested = async () => {
    if (active) {
      navigate('/workout/session');
      return;
    }
    if (suggestedDay) {
      await startSession(suggestedDay.id);
      navigate('/workout/session');
    }
  };

  const saveWeight = async () => {
    if (weight) await logWeight(Number(weight));
    setWeight('');
    setWeightOpen(false);
  };

  const quick: { icon: IconName; label: string; onClick: () => void }[] = [
    { icon: 'play', label: t('home.quick.startWorkout'), onClick: () => void startSuggested() },
    { icon: 'timer', label: t('home.quick.restTimer'), onClick: () => setRestOpen(true) },
    { icon: 'activity', label: t('home.quick.startCardio'), onClick: () => navigate('/cardio') },
    { icon: 'scale', label: t('home.quick.addWeight'), onClick: () => setWeightOpen(true) },
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{t('common.today')}</p>
          <h1 className="text-2xl font-bold">{t('home.greeting', { name: profile?.name ?? '' })}</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 rounded-full bg-surface-card px-3 py-1.5">
            <Icon name="flame" size={18} className="text-warn" />
            <span className="font-bold">{streaks.overall.current}</span>
          </div>
          <SyncStatusBadge />
        </div>
      </header>

      {/* Daily summary */}
      <div className="card">
        <div className="flex items-center gap-4">
          <ProgressRing value={(checklist?.completionPct ?? 0) / 100} label={`${checklist?.completionPct ?? 0}%`} sublabel={t('home.completion')} />
          <div className="flex-1">
            <h2 className="mb-1 font-bold">{t('home.dailyChecklist')}</h2>
            {missed.length === 0 ? (
              <p className="text-sm text-brand">✓ {t('common.done')}</p>
            ) : (
              <p className="text-sm text-slate-400">
                {t('home.missed')}: {missed.map((k) => t(CHECKLIST_LABELS[k] ?? 'nutrition.eaten')).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).join(' · ')}
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {t('home.nextReminder')}: {nextReminder ? `${nextReminder.time} — ${nextReminder.label}` : t('home.noReminder')}
            </p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        {quick.map((q) => (
          <button key={q.label} type="button" onClick={q.onClick} className="btn-primary btn-lg flex-col !gap-1 py-4">
            <Icon name={q.icon} size={24} />
            <span className="text-sm">{q.label}</span>
          </button>
        ))}
      </div>

      {/* Today's workout */}
      <button type="button" onClick={() => navigate('/workout')} className="card flex w-full items-center justify-between text-start">
        <div>
          <p className="text-xs uppercase text-slate-400">{t('home.todaysWorkout')}</p>
          <p className="text-lg font-bold">{active ? t('workout.resumeSession') : suggestedDay?.title ?? t('home.restDay')}</p>
          {suggestedDay && <p className="text-xs text-slate-500">{suggestedDay.focus}</p>}
        </div>
        <Icon name="dumbbell" size={28} className="text-brand" />
      </button>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => navigate('/nutrition')} className="card text-start">
          <p className="text-xs uppercase text-slate-400">{t('home.todaysNutrition')}</p>
          <p className="text-lg font-bold">{Math.round(consumed.calories)} <span className="text-sm font-normal text-slate-400">/ {targets?.calories}</span></p>
          <p className="text-xs text-slate-500">{eatenMeals}/{plannedMeals} {t('nutrition.eaten')} · P{Math.round(consumed.protein)}</p>
        </button>
        <button type="button" onClick={() => setWeightOpen(true)} className="card text-start">
          <p className="text-xs uppercase text-slate-400">{t('home.bodyWeight')}</p>
          <p className="text-lg font-bold">{latestWeight ?? profile?.weightKg ?? '–'} <span className="text-sm font-normal text-slate-400">{t('common.kg')}</span></p>
          <p className="text-xs text-slate-500">{t('home.quick.addWeight')}</p>
        </button>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">{t('home.steps')}</p>
          <p className="text-lg font-bold">{todaySteps.toLocaleString()}</p>
          <p className="text-xs text-slate-500">/ {targets?.steps.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">{t('home.streak')}</p>
          <p className="text-lg font-bold">{streaks.workout.current} 🏋️</p>
          <p className="text-xs text-slate-500">{t('common.previous')}: {streaks.workout.longest}</p>
        </div>
      </div>

      <Sheet open={weightOpen} onClose={() => setWeightOpen(false)} title={t('home.logWeightTitle')}>
        <div className="space-y-3">
          <input className="input text-center text-lg" inputMode="decimal" placeholder={String(latestWeight ?? profile?.weightKg ?? 0)} value={weight} onChange={(e) => setWeight(e.target.value)} />
          <button type="button" onClick={() => void saveWeight()} className="btn-primary w-full">{t('common.save')}</button>
        </div>
      </Sheet>

      <Sheet open={restOpen} onClose={() => setRestOpen(false)} title={t('home.quick.restTimer')}>
        <div className="grid grid-cols-3 gap-2">
          {[60, 90, 120, 150, 180, 240].map((sec) => (
            <button key={sec} type="button" onClick={() => { startRest(sec); setRestOpen(false); }} className="btn-ghost btn-lg">
              {formatDuration(sec)}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
