import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useCardio } from '@/stores/cardioStore';
import { useWorkout } from '@/stores/workoutStore';
import { Icon } from '@/components/Icon';
import { addDays, today } from '@/lib/utils';

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="mb-3 font-bold">{title}</h2>
      <div className="h-44 w-full">{children}</div>
    </div>
  );
}

const AXIS = { stroke: '#64748b', fontSize: 10 };

export function Progress() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const weightLogs = useCardio((s) => s.weightLogs);
  const cardioLogs = useCardio((s) => s.cardioLogs);
  const plan = useWorkout((s) => s.plan);
  const logs = useWorkout((s) => s.logs);

  const [exerciseId, setExerciseId] = useState<string>(() => {
    const ids = plan ? Object.keys(plan.exercises) : [];
    return ids[0] ?? '';
  });

  const weightData = useMemo(
    () => weightLogs.map((w) => ({ date: w.date.slice(5), kg: w.weightKg })),
    [weightLogs],
  );

  // Top working-set weight per session for the selected exercise.
  const exerciseData = useMemo(() => {
    return logs
      .filter((l) => l.finished)
      .slice()
      .reverse()
      .map((l) => {
        const ex = l.exercises.find((e) => e.exerciseId === exerciseId);
        const top = ex ? Math.max(0, ...ex.sets.map((s) => s.weightKg ?? 0)) : 0;
        return { date: l.date.slice(5), kg: top };
      })
      .filter((d) => d.kg > 0);
  }, [logs, exerciseId]);

  // Steps over the last 14 days.
  const stepsData = useMemo(() => {
    const out: { date: string; steps: number }[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const day = addDays(today(), -i);
      const steps = cardioLogs.filter((c) => c.date === day).reduce((a, c) => a + (c.steps ?? 0), 0);
      out.push({ date: day.slice(5), steps });
    }
    return out;
  }, [cardioLogs]);

  // Weekly workout completion (last 6 weeks).
  const weeklyData = useMemo(() => {
    const out: { week: string; workouts: number }[] = [];
    for (let w = 5; w >= 0; w -= 1) {
      const start = addDays(today(), -(w * 7 + 6));
      const end = addDays(today(), -(w * 7));
      const count = logs.filter((l) => l.finished && l.date >= start && l.date <= end).length;
      out.push({ week: end.slice(5), workouts: count });
    }
    return out;
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('progress.title')}</h1>
        <button type="button" onClick={() => navigate('/progress/photos')} className="btn-ghost h-10 px-3 text-sm">
          <Icon name="camera" size={18} /> {t('progress.photos')}
        </button>
      </div>

      <ChartCard title={t('progress.bodyWeight')}>
        {weightData.length >= 1 ? (
          <ResponsiveContainer>
            <LineChart data={weightData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" />
              <XAxis dataKey="date" {...AXIS} />
              <YAxis {...AXIS} domain={['dataMin - 1', 'dataMax + 1']} width={32} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 12 }} />
              <Line type="monotone" dataKey="kg" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="pt-12 text-center text-sm text-slate-500">{t('progress.noData')}</p>
        )}
      </ChartCard>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{t('progress.exercise')}</h2>
          <select
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            className="input h-9 w-40 py-1 text-sm"
          >
            {plan &&
              Object.values(plan.exercises).map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
          </select>
        </div>
        <div className="h-44 w-full">
          {exerciseData.length >= 1 ? (
            <ResponsiveContainer>
              <LineChart data={exerciseData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#1e293b" />
                <XAxis dataKey="date" {...AXIS} />
                <YAxis {...AXIS} width={32} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 12 }} />
                <Line type="monotone" dataKey="kg" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="pt-12 text-center text-sm text-slate-500">{t('progress.noData')}</p>
          )}
        </div>
      </div>

      <ChartCard title={t('progress.completion')}>
        <ResponsiveContainer>
          <BarChart data={weeklyData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" />
            <XAxis dataKey="week" {...AXIS} />
            <YAxis {...AXIS} width={28} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 12 }} />
            <Bar dataKey="workouts" fill="#22c55e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t('progress.stepsCardio')}>
        <ResponsiveContainer>
          <BarChart data={stepsData} margin={{ top: 5, right: 8, left: -4, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" />
            <XAxis dataKey="date" {...AXIS} interval={2} />
            <YAxis {...AXIS} width={36} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)} />
            <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 12 }} />
            <Bar dataKey="steps" fill="#38bdf8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
