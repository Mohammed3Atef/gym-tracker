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
  const addSteps = useCardio((s) => s.addSteps);
  const removeCardio = useCardio((s) => s.removeCardio);
  const stepsFor = useCardio((s) => s.stepsFor);
  const cardioSecFor = useCardio((s) => s.cardioSecFor);
  const targets = useSettings((s) => s.settings?.targets);

  const [running, setRunning] = useState<number | null>(null);
  const [type, setType] = useState<CardioType>('treadmill');
  const [logOpen, setLogOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [steps, setSteps] = useState('');
  const [form, setForm] = useState({ minutes: '', distance: '', calories: '' });

  const elapsed = useElapsed(running);
  useWakeLock(running != null);

  const stopAndSave = async () => {
    if (running == null) return;
    const durationSec = Math.floor((Date.now() - running) / 1000);
    setRunning(null);
    await addCardio({ type, durationSec });
  };

  const saveManual = async () => {
    const durationSec = (Number(form.minutes) || 0) * 60;
    await addCardio({
      type,
      durationSec,
      distanceKm: form.distance ? Number(form.distance) : null,
      caloriesBurned: form.calories ? Number(form.calories) : null,
    });
    setForm({ minutes: '', distance: '', calories: '' });
    setLogOpen(false);
  };

  const saveSteps = async () => {
    if (steps) await addSteps(Number(steps));
    setSteps('');
    setStepsOpen(false);
  };

  const selected = useDay((s) => s.selected);
  const todaySteps = stepsFor(selected);
  const todayCardioMin = Math.round(cardioSecFor(selected) / 60);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('cardio.title')}</h1>

      {/* Today summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card flex items-center gap-3">
          <Icon name="steps" size={28} className="text-accent" />
          <div>
            <p className="text-xl font-bold">{todaySteps.toLocaleString()}</p>
            <p className="text-xs text-slate-400">{t('cardio.steps')} / {targets?.steps.toLocaleString()}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <Icon name="activity" size={28} className="text-brand" />
          <div>
            <p className="text-xl font-bold">{todayCardioMin} {t('common.min')}</p>
            <p className="text-xs text-slate-400">{t('cardio.title')} / {targets?.cardioMinutes}</p>
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

      <div className="flex gap-2">
        <button type="button" onClick={() => setLogOpen(true)} className="btn-ghost flex-1">
          <Icon name="plus" size={18} /> {t('cardio.logCardio')}
        </button>
        <button type="button" onClick={() => setStepsOpen(true)} className="btn-ghost flex-1">
          <Icon name="steps" size={18} /> {t('cardio.addSteps')}
        </button>
      </div>

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

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title={t('cardio.logCardio')}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((ty) => (
              <button key={ty} type="button" onClick={() => setType(ty)} className={`rounded-full px-3 py-1.5 text-sm ${type === ty ? 'bg-brand text-slate-950' : 'bg-surface-raised text-slate-300'}`}>
                {t(`cardio.types.${ty}`)}
              </button>
            ))}
          </div>
          <input className="input" inputMode="numeric" placeholder={`${t('cardio.duration')} (${t('common.min')})`} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
          <input className="input" inputMode="decimal" placeholder={`${t('cardio.distance')} (km)`} value={form.distance} onChange={(e) => setForm({ ...form, distance: e.target.value })} />
          <input className="input" inputMode="numeric" placeholder={t('cardio.calories')} value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} />
          <button type="button" onClick={() => void saveManual()} className="btn-primary w-full">{t('common.save')}</button>
        </div>
      </Sheet>

      <Sheet open={stepsOpen} onClose={() => setStepsOpen(false)} title={t('cardio.addSteps')}>
        <div className="space-y-3">
          <input className="input text-center text-lg" inputMode="numeric" placeholder="0" value={steps} onChange={(e) => setSteps(e.target.value)} />
          <button type="button" onClick={() => void saveSteps()} className="btn-primary w-full">{t('common.add')}</button>
        </div>
      </Sheet>
    </div>
  );
}
