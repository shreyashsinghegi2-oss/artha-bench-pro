import React, { useState } from 'react';
import { Github, LoaderCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { SocialAuthProvider } from '../../services/supabaseRest';

const providers: Array<{ id: SocialAuthProvider; label: string; monogram: string }> = [
  { id: 'google', label: 'Google', monogram: 'G' },
  { id: 'github', label: 'GitHub', monogram: 'GH' },
  { id: 'azure', label: 'Microsoft', monogram: 'M' },
  { id: 'apple', label: 'Apple', monogram: '' },
];

export const SocialAuthButtons: React.FC = () => {
  const auth = useAuth();
  const [active, setActive] = useState<SocialAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const begin = (provider: SocialAuthProvider) => {
    setError(null);
    setActive(provider);
    try {
      auth.continueWithSocial(provider);
    } catch (requestError) {
      setActive(null);
      setError(requestError instanceof Error ? requestError.message : 'Social sign-in could not be started.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">
        <span className="h-px flex-1 bg-line" />
        Or continue with
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            disabled={!auth.configured || active !== null}
            onClick={() => begin(provider.id)}
            className="flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-xs font-bold text-ink transition hover:border-interactive/40 hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            {active === provider.id ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : provider.id === 'github' ? (
              <Github className="h-4 w-4" />
            ) : (
              <span aria-hidden="true" className="flex h-4 min-w-4 items-center justify-center text-[11px] font-black">{provider.monogram}</span>
            )}
            {provider.label}
          </button>
        ))}
      </div>
      <p className="text-center text-[9px] leading-4 text-secondary">
        Social sign-in works when that provider is enabled in Supabase Auth. Email/password remains available independently.
      </p>
      {error && <div className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-[10px] text-danger">{error}</div>}
    </div>
  );
};
