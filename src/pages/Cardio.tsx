import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardioType } from '@/types';
import { useCardio } from '@/stores/cardioStore';
import { useSettings } from '@/stores/settingsStore';
import { useElapsed } from '@/hooks/useElapsed';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useDay } from '@/stores/dayStore';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { formatDuration, shortDate } from '@/lib/utils';

const TYPES: CardioType[] = ['walking', 'treadmill', 'running', 'cycling', 'other'];

export function Cardio() {
  const { t } = useTranslation();
  const cardioLogs = useCardio((s) => s.cardioLogs);
  const addCardio = useCardio((s) => s.addCardio);
  const removeCardio = useCardio((s) => s.removeCardio);
  const stepsFor = useCardio((s) => s.stepsFor);
  const cardioSecFor = useCardio((s) => s.cardioSecFor);
  const targets = useSettings((s) => s.settings?.targets);

  const [running, setRunning] = useState<number | null>(null);
  const [type, setType] = useState<CardioType>('treadmill');
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState({ minutes: '', steps: '', distance: '', calories: '' });

  const elapsed = useElapsed(running);
  useWakeLock(running != null);

  // Stopping the live timer hands the elapsed minutes to the unified log form so
  // you can add steps/distance and save it all as one entry.
  const stopAndSave = () => {
    if (running == null) return;
    const mins = Math.max(1, Math.round((Date.now() - running) / 60000));
    setRunning(null);
    setForm({ minutes: String(mins), steps: '', distance: '', calories: '' });
    setLogOpen(true);
  };

  // One entry capturing what you actually did, e.g. "10k steps in 40 min".
  const saveManual = async () => {
    await addCardio({
      type,
      durationSec: (Number(form.minutes) || 0) * 60,
      steps: form.steps ? Number(form.steps) : null,
      distanceKm: form.distance ? Number(form.distance) : null,
      caloriesBurned: form.calories ? Number(form.calories) : null,
    });
    setForm({ minutes: '', steps: '', distance: '', calories: '' });
    setLogOpen(false);
  };

  const selected = useDay((s) => s.selected);
  const todaySteps = stepsFor(selected);
  const todayCardioMin = Math.round(cardioSecFor(selected) / 60);
  const activityMet =
    todaySteps >= (targets?.steps ?? Infinity) || todayCardioMin >= (targets?.cardioMinutes ?? Infinity);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('cardio.title')}</h1>

      {/* Combined daily activity goal — done when EITHER target is met. */}
      <div className={`card ${activityMet ? 'ring-1 ring-brand/40' : ''}`}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="activity" size={22} className="text-brand" />
            <div>
              <p className="font-semibold">{t('cardio.goal')}</p>
              <p className="text-xs text-slate-400">{t('cardio.goalHint')}</p>
            </div>
          </div>
          {activityMet && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-slate-950">
              <Icon name="check" size={16} />
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xl font-bold">
              {todaySteps.toLocaleString()}
              <span className="text-sm font-normal text-slate-400"> / {targets?.steps.toLocaleString()}</span>
            </p>
            <p className="mb-1 text-xs text-slate-400">{t('cardio.steps')}</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (todaySteps / (targets?.steps || 1)) * 100)}%` }} />
            </div>
          </div>
          <div>
            <p className="text-xl font-bold">
              {todayCardioMin}
              <span className="text-sm font-normal text-slate-400"> / {targets?.cardioMinutes} {t('common.min')}</span>
            </p>
            <p className="mb-1 text-xs text-slate-400">{t('cardio.minutes')}</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (todayCardioMin / (targets?.cardioMinutes || 1)) * 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Live cardio timer */}
      <div className="card text-center">
        <div className="mb-3 flex flex-wrap justify-center gap-1.5">
          {TYPES.map((ty) => (
            <button
              key={ty}
              type="button"
              onClick={() => setType(ty)}
              className={`rounded-full px-3 py-1.5 text-sm ${type === ty ? 'bg-brand text-slate-950' : 'bg-surface-raised text-slate-300'}`}
            >
              {t(`cardio.types.${ty}`)}
            </button>
          ))}
        </div>
        <p className="font-mono text-4xl font-bold tabular-nums text-brand-light">{formatDuration(elapsed)}</p>
        <div className="mt-3 flex gap-2">
          {running == null ? (
            <button type="button" onClick={() => setRunning(Date.now())} className="btn-primary btn-lg flex-1">
              <Icon name="play" size={20} /> {t('common.start')}
            </button>
          ) : (
            <button type="button" onClick={() => void stopAndSave()} className="btn-danger btn-lg flex-1">
              <Icon name="check" size={20} /> {t('common.finish')}
            </button>
          )}
        </div>
      </div>

      <button type="button" onClick={() => setLogOpen(true)} className="btn-ghost btn-lg w-full">
        <Icon name="plus" size={18} /> {t('cardio.logActivity')}
      </button>

      {/* History */}
      <div>
        <h2 className="mb-2 font-bold">{t('cardio.history')}</h2>
        <ul className="space-y-2">
          {cardioLogs.slice(0, 30).map((c) => (
            <li key={c.id} className="card flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{t(`cardio.types.${c.type}`)}</p>
                <p className="text-xs text-slate-400">{shortDate(c.date)}</p>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                {c.durationSec > 0 && <span>{Math.round(c.durationSec / 60)}{t('common.min')}</span>}
                {c.steps != null && <span>{c.steps.toLocaleString()} {t('cardio.steps')}</span>}
                {c.distanceKm != null && <span>{c.distanceKm} km</span>}
                <button type="button" onClick={() => void removeCardio(c.id)} className="text-danger">
                  <Icon name="close" size={16} />
                </button>
              </div>
            </li>
          ))}
          {cardioLogs.length === 0 && <li className="text-sm text-slate-500">{t('progress.noData')}</li>}
        </ul>
      </div>

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title={t('cardio.logActivity')}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((ty) => (
              <button key={ty} type="button" onClick={() => setType(ty)} className={`rounded-full px-3 py-1.5 text-sm ${type === ty ? 'bg-brand text-slate-950' : 'bg-surface-raised text-slate-300'}`}>
                {t(`cardio.types.${ty}`)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">{t('cardio.steps')}</label>
              <input className="input" inputMode="numeric" placeholder="10000" value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('cardio.duration')} ({t('common.min')})</label>
              <input className="input" inputMode="numeric" placeholder="40" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('cardio.distance')} (km)</label>
              <input className="input" inputMode="decimal" placeholder="0" value={form.distance} onChange={(e) => setForm({ ...form, distance: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('cardio.calories')}</label>
              <input className="input" inputMode="numeric" placeholder="0" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} />
            </div>
          </div>
          <button type="button" onClick={() => void saveManual()} className="btn-primary btn-lg w-full">{t('common.save')}</button>
        </div>
      </Sheet>
    </div>
  );
}
