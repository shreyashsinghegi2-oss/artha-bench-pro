import React from 'react';
import { Github, Globe2, Laptop, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { startSocialOAuth, SocialAuthProvider } from '../../services/supabaseRest';

const providers: Array<{ id: SocialAuthProvider; label: string; icon: React.ReactNode }> = [
  { id: 'google', label: 'Google', icon: <Globe2 className="h-4 w-4" /> },
  { id: 'github', label: 'GitHub', icon: <Github className="h-4 w-4" /> },
  { id: 'azure', label: 'Microsoft', icon: <Laptop className="h-4 w-4" /> },
  { id: 'apple', label: 'Apple', icon: <span className="text-base leading-none"></span> },
];

export const SocialAuthDock: React.FC = () => {
  const auth = useAuth();
  if (!auth.authOpen || (auth.authScreen !== 'login' && auth.authScreen !== 'signup')) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[120] mx-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-line bg-surface/95 p-3 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-secondary">
        <ShieldCheck className="h-3.5 w-3.5 text-success" /> Social sign-in via Supabase Auth
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => startSocialOAuth(provider.id)}
            className="flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-xs font-bold text-ink transition hover:border-interactive/50 hover:bg-interactive-soft"
          >
            {provider.icon}
            {provider.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[9px] leading-4 text-secondary">A provider must also be enabled with its own OAuth client credentials in Supabase before authentication can complete.</p>
    </div>
  );
};
