import { describe, expect, it } from 'vitest';
import { apiRouter } from '../server/routes';

describe('Financial Scenario Studio API registration', () => {
  it('registers every deterministic calculator and the scenario assistant', () => {
    const stack = (apiRouter as unknown as { stack: Array<{ route?: { path?: string } }> }).stack;
    const paths = stack.map((layer) => layer.route?.path).filter(Boolean);
    for (const path of [
      '/finance/compound-interest',
      '/finance/quick-ratio',
      '/finance/cagr',
      '/finance/break-even',
      '/finance/dti',
      '/finance/scenario-assistant',
    ]) expect(paths).toContain(path);
  });
});
