import { useTimer } from '@/stores/timerStore';
import { Icon } from './Icon';
import { formatDuration } from '@/lib/utils';

/**
 * Floating rest-timer controls. Always visible (within the session) without
 * leaving the exercise list: −15s / +15s / pause / skip.
 */
export function RestTimerBar() {
  const { running, paused, remainingSec, totalSec, adjust, pause, resume, skip } = useTimer();
  if (!running && !paused) return null;

  const pct = totalSec > 0 ? remainingSec / totalSec : 0;

  const pill = 'flex h-9 items-center justify-center rounded-full bg-surface-raised px-3 text-xs font-semibold text-slate-200 transition-transform active:scale-90';

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-brand/15 px-2 py-1.5 ring-1 ring-brand/40">
      <button type="button" onClick={skip} className="icon-btn h-9 w-9" aria-label="skip rest">
        <Icon name="close" size={16} />
      </button>
      <button
        type="button"
        onClick={() => (paused ? resume() : pause())}
        className="icon-btn h-9 w-9"
        aria-label={paused ? 'resume' : 'pause'}
      >
        <Icon name={paused ? 'play' : 'pause'} size={16} />
      </button>
      <button type="button" onClick={() => adjust(-15)} className={pill}>
        −15
      </button>
      <button type="button" onClick={() => adjust(15)} className={pill}>
        +15
      </button>
      <span className="min-w-[3.5ch] text-center font-mono text-lg font-bold tabular-nums text-brand-light">
        {formatDuration(remainingSec)}
      </span>
      <div className="relative h-8 w-8 shrink-0">
        <svg viewBox="0 0 36 36" className="-rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="#334155" strokeWidth="4" />
          <circle
            className="ring-track"
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="#22c55e"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 15}
            strokeDashoffset={2 * Math.PI * 15 * (1 - pct)}
          />
        </svg>
      </div>
    </div>
  );
}
