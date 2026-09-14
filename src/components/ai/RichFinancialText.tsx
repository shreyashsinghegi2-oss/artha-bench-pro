import React from 'react';

export function cleanFinancialText(value: unknown): string {
  return String(value ?? '')
    .replace(/```(?:json|markdown|text)?/gi, '')
    .replace(/```/g, '')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\operatorname\{([^}]*)\}/g, '$1')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\%/g, '%')
    .replace(/\\#/g, '#')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1) / ($2)')
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .replace(/^\s*(JSON|Answer|Direct answer|Assumptions and context|Formula or rule):\s*/gim, '')
    .trim();
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="rounded bg-subtle px-1 py-0.5 font-mono text-[0.92em]">{part.slice(1, -1)}</code>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export const RichFinancialText: React.FC<{ value: string; className?: string }> = ({ value, className = '' }) => {
  const text = cleanFinancialText(value);
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return (
    <div className={`space-y-2 leading-6 ${className}`}>
      {lines.map((line, index) => {
        if (/^#{1,4}\s+/.test(line)) return <h5 key={index} className="pt-1 text-sm font-extrabold text-ink">{inline(line.replace(/^#{1,4}\s+/, ''))}</h5>;
        if (/^[-•]\s+/.test(line)) return <div key={index} className="flex gap-2"><span aria-hidden="true">•</span><span>{inline(line.replace(/^[-•]\s+/, ''))}</span></div>;
        if (/^\d+[.)]\s+/.test(line)) return <div key={index} className="flex gap-2"><span className="font-bold text-interactive">{line.match(/^\d+/)?.[0]}.</span><span>{inline(line.replace(/^\d+[.)]\s+/, ''))}</span></div>;
        if (/^\$\$.*\$\$$/.test(line) || /^\\\(.*\\\)$/.test(line)) return <div key={index} className="overflow-x-auto rounded-lg bg-subtle px-3 py-2 font-mono text-xs">{cleanFinancialText(line).replace(/^\$\$|\$\$$/g, '').replace(/^\\\(|\\\)$/g, '')}</div>;
        return <p key={index}>{inline(line)}</p>;
      })}
    </div>
  );
};
