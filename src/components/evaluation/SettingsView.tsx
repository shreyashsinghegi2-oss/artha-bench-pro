import React from 'react';
import { Settings, SlidersHorizontal, ShieldCheck } from 'lucide-react';

export const SettingsView: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-surface border border-line rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-interactive/20 border border-interactive/40 rounded-2xl text-interactive">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">Platform Settings & Configuration</h1>
            <p className="text-xs text-secondary">
              Server security rules, model overrides, and local workspace preferences.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <div className="p-5 bg-canvas border border-line rounded-2xl space-y-2">
            <h3 className="text-sm font-bold text-ink">Server Secret Management</h3>
            <p className="text-xs text-secondary">
              GROQ_API_KEY is securely loaded via server environment variables. Never committed or exposed to browser code.
            </p>
            <div className="inline-block px-3 py-1 bg-success-fill/10 text-success border border-success-fill/30 text-xs font-bold rounded-lg mt-1">
              Secure Server Proxy Enforced
            </div>
          </div>

          <div className="p-5 bg-canvas border border-line rounded-2xl space-y-2">
            <h3 className="text-sm font-bold text-ink">Model Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3 bg-surface border border-line rounded-xl">
                <span className="text-secondary block">Primary Model</span>
                <span className="font-mono text-ink font-bold">openai/gpt-oss-120b</span>
              </div>
              <div className="p-3 bg-surface border border-line rounded-xl">
                <span className="text-secondary block">Secondary Model</span>
                <span className="font-mono text-ink font-bold">openai/gpt-oss-20b</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
