import React from 'react';
import { Settings, SlidersHorizontal, ShieldCheck } from 'lucide-react';

export const SettingsView: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-[#08080E] border border-[#1A1A23] rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#4F32FF]/20 border border-[#4F32FF]/40 rounded-2xl text-[#665CFF]">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#F7F7FB]">Platform Settings & Configuration</h1>
            <p className="text-xs text-[#9A9AAA]">
              Server security rules, model overrides, and local workspace preferences.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <div className="p-5 bg-[#030303] border border-[#1A1A23] rounded-2xl space-y-2">
            <h3 className="text-sm font-bold text-[#F7F7FB]">Server Secret Management</h3>
            <p className="text-xs text-[#9A9AAA]">
              GROQ_API_KEY is securely loaded via server environment variables. Never committed or exposed to browser code.
            </p>
            <div className="inline-block px-3 py-1 bg-[#00D68F]/10 text-[#00D68F] border border-[#00D68F]/30 text-xs font-bold rounded-lg mt-1">
              Secure Server Proxy Enforced
            </div>
          </div>

          <div className="p-5 bg-[#030303] border border-[#1A1A23] rounded-2xl space-y-2">
            <h3 className="text-sm font-bold text-[#F7F7FB]">Model Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3 bg-[#08080E] border border-[#1A1A23] rounded-xl">
                <span className="text-[#9A9AAA] block">Primary Model</span>
                <span className="font-mono text-[#F7F7FB] font-bold">llama-3.3-70b-versatile</span>
              </div>
              <div className="p-3 bg-[#08080E] border border-[#1A1A23] rounded-xl">
                <span className="text-[#9A9AAA] block">Secondary Model</span>
                <span className="font-mono text-[#F7F7FB] font-bold">llama-3.1-8b-instant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
