import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthContext';
import { VoiceAssistant } from './components/voice/VoiceAssistant';
import { installAiFetchResilience } from './services/aiFetchResilience';
import { installPersonalAiRequestGuard } from './services/personalAiRequestGuard';
import './index.css';

if (typeof window !== 'undefined') {
  // Light by default for everyone; dark only when the user picks it with the theme toggle.
  const stored = window.localStorage.getItem('artha-bench-theme-v2');
  const dark = stored === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  installPersonalAiRequestGuard();
  installAiFetchResilience();
}

createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><App /><VoiceAssistant /></AuthProvider></StrictMode>);
