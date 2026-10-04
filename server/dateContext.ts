/**
 * Current-date preamble for every AI system prompt, so assistants reason about "today", the running
 * Indian financial year and data freshness instead of their training cut-off.
 */
export function currentDateContext(now: Date = new Date()): string {
  const tz = 'Asia/Kolkata';
  const label = new Intl.DateTimeFormat('en-IN', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  const year = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(now));
  const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'numeric' }).format(now));
  const fy = month >= 4 ? year : year - 1; // Indian financial year starts on 1 April
  const short = (y: number) => String(y).slice(-2);
  return [
    `Current date: ${label} (India Standard Time).`,
    `Current Indian financial year: FY ${fy}-${short(fy + 1)} (assessment year ${fy + 1}-${short(fy + 2)}).`,
    'Treat this as today. Prices, rates, index levels and news are current only when they are supplied in this conversation with a timestamp; otherwise say you do not have live figures and name the date any figure refers to.',
    'If a calculation or tool result in the conversation is labelled with a different financial year, say which year it uses.',
  ].join('\n');
}

export const withDateContext = (systemPrompt: string, now?: Date) => `${currentDateContext(now)}\n\n${systemPrompt}`;
