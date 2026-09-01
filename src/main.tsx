import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthContext';
import { installAiFetchResilience } from './services/aiFetchResilience';
import { installPersonalAiRequestGuard } from './services/personalAiRequestGuard';
import './index.css';

if (typeof window !== 'undefined') {
  const stored = window.localStorage.getItem('artha-bench-theme');
  const dark = stored === 'dark' || (!stored && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  installPersonalAiRequestGuard();
  installAiFetchResilience();
}

createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><App /></AuthProvider></StrictMode>);
