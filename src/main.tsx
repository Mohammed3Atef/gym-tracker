import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import './index.css';
import { App } from './App';

/**
 * Service worker registration with automatic updates. Installed PWAs otherwise
 * keep serving the old cached build — so we poll for a new service worker
 * (on launch, when the app regains focus, and every minute) and, when a new
 * version is ready, activate it and reload so changes appear without reinstalling.
 */
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true); // new version available → activate + reload
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const check = () => {
      if (navigator.onLine) void registration.update().catch(() => undefined);
    };
    setInterval(check, 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
