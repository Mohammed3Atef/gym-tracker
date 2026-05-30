import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from './Icon';

const ITEMS: { to: string; icon: IconName; key: string }[] = [
  { to: '/', icon: 'home', key: 'home' },
  { to: '/workout', icon: 'dumbbell', key: 'workout' },
  { to: '/nutrition', icon: 'meal', key: 'nutrition' },
  { to: '/cardio', icon: 'activity', key: 'cardio' },
  { to: '/progress', icon: 'chart', key: 'progress' },
  { to: '/settings', icon: 'settings', key: 'settings' },
];

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-surface-card/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1">
        {ITEMS.map((item) => (
          <li key={item.key} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-brand' : 'text-slate-400'
                }`
              }
            >
              <Icon name={item.icon} size={22} />
              {t(`nav.${item.key}`)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
