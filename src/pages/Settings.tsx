import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ActivityLevel, Goal, Locale } from '@/types';
import { useSettings } from '@/stores/settingsStore';
import { useReminders } from '@/services/reminders/reminderStore';
import { useCloud } from '@/services/auth/cloudStore';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';

const GOALS: Goal[] = ['muscle_gain', 'fat_loss', 'recomp', 'maintenance', 'strength'];
const ACTIVITY: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-7 w-12 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-surface-raised'}`}
      role="switch"
      aria-checked={on}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? 'start-6' : 'start-1'}`} />
    </button>
  );
}

export function Settings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const profile = useSettings((s) => s.profile);
  const settings = useSettings((s) => s.settings);
  const updateProfile = useSettings((s) => s.updateProfile);
  const updateSettings = useSettings((s) => s.updateSettings);
  const updateTargets = useSettings((s) => s.updateTargets);
  const setLocale = useSettings((s) => s.setLocale);

  const reminders = useReminders((s) => s.reminders);
  const updateReminder = useReminders((s) => s.update);
  const requestPermission = useReminders((s) => s.requestPermission);

  const cloud = useCloud();
  const [authOpen, setAuthOpen] = useState(false);
  const [creds, setCreds] = useState({ email: '', password: '', create: false });

  if (!profile || !settings) return null;

  const enableNotifications = async () => {
    const granted = await requestPermission();
    await updateSettings({ notificationsEnabled: granted });
  };

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      {/* Profile */}
      <section className="card space-y-3">
        <h2 className="font-bold">{t('settings.profile')}</h2>
        <div>
          <label className="label">{t('settings.name')}</label>
          <input className="input" value={profile.name} onChange={(e) => void updateProfile({ name: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">{t('settings.age')}</label>
            <input className="input" inputMode="numeric" value={profile.age} onChange={(e) => void updateProfile({ age: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">{t('settings.weight')}</label>
            <input className="input" inputMode="decimal" value={profile.weightKg} onChange={(e) => void updateProfile({ weightKg: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">{t('settings.height')}</label>
            <input className="input" inputMode="numeric" value={profile.heightCm} onChange={(e) => void updateProfile({ heightCm: Number(e.target.value) || 0 })} />
          </div>
        </div>
        <div>
          <label className="label">{t('settings.goal')}</label>
          <select className="input" value={profile.goal} onChange={(e) => void updateProfile({ goal: e.target.value as Goal })}>
            {GOALS.map((g) => <option key={g} value={g}>{t(`settings.goals.${g}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('settings.activity')}</label>
          <select className="input" value={profile.activityLevel} onChange={(e) => void updateProfile({ activityLevel: e.target.value as ActivityLevel })}>
            {ACTIVITY.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </section>

      {/* Preferences */}
      <section className="card space-y-3">
        <h2 className="font-bold">{t('settings.title')}</h2>
        <div className="flex items-center justify-between">
          <span>{t('settings.language')}</span>
          <div className="flex gap-1">
            {(['en', 'ar'] as Locale[]).map((l) => (
              <button key={l} type="button" onClick={() => void setLocale(l)} className={`rounded-lg px-3 py-1.5 text-sm ${settings.locale === l ? 'bg-brand text-slate-950' : 'bg-surface-raised'}`}>
                {l === 'en' ? 'English' : 'العربية'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span>{t('settings.restDefault')}</span>
          <input className="input h-10 w-24 text-center" inputMode="numeric" value={settings.restDefaultSec} onChange={(e) => void updateSettings({ restDefaultSec: Number(e.target.value) || 0 })} />
        </div>
        <div className="flex items-center justify-between">
          <span>{t('settings.keepAwake')}</span>
          <Toggle on={settings.keepAwakeDuringWorkout} onClick={() => void updateSettings({ keepAwakeDuringWorkout: !settings.keepAwakeDuringWorkout })} />
        </div>
        <div className="flex items-center justify-between">
          <span>{t('settings.vibration')}</span>
          <Toggle on={settings.vibrationEnabled} onClick={() => void updateSettings({ vibrationEnabled: !settings.vibrationEnabled })} />
        </div>
        <div className="flex items-center justify-between">
          <span>{t('settings.notifications')}</span>
          <Toggle on={settings.notificationsEnabled} onClick={() => void (settings.notificationsEnabled ? updateSettings({ notificationsEnabled: false }) : enableNotifications())} />
        </div>
      </section>

      {/* Daily targets */}
      <section className="card space-y-3">
        <h2 className="font-bold">{t('settings.targets')}</h2>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['calories', t('nutrition.calories')],
            ['protein', t('nutrition.protein')],
            ['carbs', t('nutrition.carbs')],
            ['fats', t('nutrition.fats')],
            ['waterMl', t('nutrition.water')],
            ['steps', t('cardio.steps')],
            ['cardioMinutes', t('home.cardio')],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                className="input"
                inputMode="numeric"
                value={settings.targets[key]}
                onChange={(e) => void updateTargets({ [key]: Number(e.target.value) || 0 })}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Reminders */}
      <section className="card space-y-2">
        <h2 className="font-bold">{t('settings.reminders')}</h2>
        {reminders.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <input
              type="time"
              value={r.time}
              onChange={(e) => void updateReminder({ ...r, time: e.target.value })}
              className="input h-10 w-28 py-1"
            />
            <span className="flex-1 truncate text-sm">{r.label}</span>
            <Toggle on={r.enabled} onClick={() => void updateReminder({ ...r, enabled: !r.enabled })} />
          </div>
        ))}
        {!settings.notificationsEnabled && (
          <p className="text-xs text-slate-500">{t('settings.enableNotifications')} ↑</p>
        )}
      </section>

      {/* Links */}
      <section className="space-y-2">
        <button type="button" onClick={() => navigate('/settings/videos')} className="card flex w-full items-center justify-between">
          <span className="flex items-center gap-2"><Icon name="video" size={18} /> {t('settings.videos')}</span>
          <Icon name="chevron" size={18} className="text-slate-500" />
        </button>
        <button type="button" onClick={() => navigate('/settings/import')} className="card flex w-full items-center justify-between">
          <span className="flex items-center gap-2"><Icon name="download" size={18} /> {t('settings.import')}</span>
          <Icon name="chevron" size={18} className="text-slate-500" />
        </button>
      </section>

      {/* Cloud */}
      <section className="card">
        <h2 className="mb-1 font-bold">{t('settings.cloud')}</h2>
        {!cloud.available ? (
          <p className="text-sm text-slate-400">{t('settings.localOnly')}</p>
        ) : cloud.user ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-300">{cloud.user.email}</p>
            {cloud.lastSync && <p className="text-xs text-slate-500">Last sync: {new Date(cloud.lastSync).toLocaleTimeString()}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => void cloud.syncNow()} disabled={cloud.syncing} className="btn-primary flex-1">
                {cloud.syncing ? '…' : 'Sync now'}
              </button>
              <button type="button" onClick={() => void cloud.signOut()} className="btn-ghost flex-1">{t('settings.signOut')}</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAuthOpen(true)} className="btn-ghost mt-2 w-full">{t('settings.signIn')}</button>
        )}
      </section>

      <Sheet open={authOpen} onClose={() => setAuthOpen(false)} title={t('settings.cloud')}>
        <div className="space-y-3">
          <input className="input" type="email" placeholder="email" value={creds.email} onChange={(e) => setCreds({ ...creds, email: e.target.value })} />
          <input className="input" type="password" placeholder="password" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} />
          {cloud.error && <p className="text-sm text-danger">{cloud.error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => void cloud.signIn(creds.email, creds.password, false).then(() => setAuthOpen(false))} className="btn-primary flex-1">{t('settings.signIn')}</button>
            <button type="button" onClick={() => void cloud.signIn(creds.email, creds.password, true).then(() => setAuthOpen(false))} className="btn-ghost flex-1">Sign up</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
