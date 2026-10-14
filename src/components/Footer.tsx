import React from 'react';

/** Workspace footer: product name, legal links and the not-advice line. */
export const Footer: React.FC = () => (
  <footer className="bg-canvas border-t border-line py-8 px-4 text-secondary text-xs">
    <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
      <div>
        <p className="font-semibold text-ink">ArthaMind AI · Artha Bench Pro</p>
        <p className="text-secondary mt-1">© {new Date().getFullYear()} ArthaMind AI. Financial information and planning tools, not investment advice.</p>
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-4 text-secondary" aria-label="Legal and support">
        <a className="font-medium text-interactive hover:underline" href="/terms.html">Terms &amp; conditions</a>
        <a className="font-medium text-interactive hover:underline" href="/privacy.html">Privacy policy</a>
        <a className="font-medium text-interactive hover:underline" href="/data-protection">Data protection</a>
        <a className="font-medium text-interactive hover:underline" href="/support">Support</a>
      </nav>
    </div>
  </footer>
);
