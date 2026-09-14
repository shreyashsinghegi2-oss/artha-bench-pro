import { describe, expect, it, beforeEach } from 'vitest';
import { detectArthaPilotIntent, createArthaPilotHandoff, readArthaPilotContext, contextGuidance } from '../src/services/arthaPilotRouter';
import { DEFAULT_AI_CONTEXT, saveAiDataContext } from '../src/services/aiDataContext';

describe('ArthaPilot router', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
      window.sessionStorage.clear();
      saveAiDataContext(DEFAULT_AI_CONTEXT);
    }
  });

  it('routes money planning to the finance workspace', () => expect(detectArthaPilotIntent('Make a budget from my monthly income').destination).toBe('budgeting'));
  it('routes EMI requests to the deterministic EMI workspace', () => expect(detectArthaPilotIntent('Calculate my EMI in INR').destination).toBe('emi-manager'));
  it('routes learning requests to the Financial Tutor', () => expect(detectArthaPilotIntent('Quiz me on budgeting').destination).toBe('tutor'));
  it('routes verification requests to Evaluation Lab', () => expect(detectArthaPilotIntent('Check this financial answer').destination).toBe('evaluation-lab'));
  it('routes future requests to Ripple Twin', () => expect(detectArthaPilotIntent('Show what changes if I save ₹5,000 every month').destination).toBe('financial-twin'));
  it('routes market requests to source-backed market data', () => expect(detectArthaPilotIntent('Explain why NIFTY moved today').destination).toBe('markets'));
  it('never requires personal data permission for a non-personal learning request', () => expect(contextGuidance(detectArthaPilotIntent('Explain SIP in Hindi'))).toBeNull());
  it('reports a clear privacy action when a personal context is requested but disabled', () => expect(contextGuidance(detectArthaPilotIntent('Plan my money'))).toContain('Enable'));
  it('preserves the original request in a handoff', () => {
    const handoff = createArthaPilotHandoff('Calculate my EMI in INR');
    expect(handoff?.request).toBe('Calculate my EMI in INR');
    expect(handoff?.destination).toBe('emi-manager');
  });
  it('reads safe default context without inventing records', () => {
    const context = readArthaPilotContext();
    expect(context.currency).toBe('INR');
    expect(context.dataPermissions.expenses).toBe(false);
  });
});
