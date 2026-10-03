import { describe, expect, it } from 'vitest';
import { casToHoldings, parseCas } from '../src/services/casParser';
import { summarise, xirr, portfolioSnapshot, type PortfolioData } from '../src/services/portfolio';

// Text as it comes out of a CAMS/KFintech detailed CAS after PDF text extraction (anonymised sample).
const CAS = `Consolidated Account Statement
01-Apr-2024 To 24-Sep-2026
Name : Sample Investor
Parag Parikh Mutual Fund
Folio No: 12345678 / 90 PAN: ABCDE1234F KYC: OK PAN: OK
Q123-Parag Parikh Flexi Cap Fund - Direct Plan - Growth (Non-Demat) - ISIN: INF879O01027(Advisor: DIRECT) Registrar : CAMS
Opening Unit Balance: 0.000
10-Apr-2024 Purchase - Systematic Investment 10,000.00 142.857 70.0000 142.857
10-Apr-2024 *** Stamp Duty *** 0.50
10-Apr-2025 Purchase - Systematic Investment 10,000.00 125.000 80.0000 267.857
Closing Unit Balance: 267.857 NAV on 24-Sep-2026: INR 92.00 Total Cost Value: 20,000.00 Market Value on 24-Sep-2026: INR 24,642.84
HDFC Mutual Fund
Folio No: 99887766 PAN: ABCDE1234F
B55RG-HDFC Top 100 Fund - Regular Plan - Growth - ISIN: INF179K01BB8(Advisor: ARN-12345) Registrar : CAMS
Opening Unit Balance: 100.000
15-Jan-2025 Redemption 5,000.00 (5.000) 1,000.0000 95.000
Closing Unit Balance: 95.000 NAV on 24-Sep-2026: INR 1,100.00 Total Cost Value: 80,000.00 Market Value on 24-Sep-2026: INR 1,04,500.00
Closing Unit Balance: 0.000`;

describe('CAS import', () => {
  const cas = parseCas(CAS);
  it('reads schemes, folios, ISINs, closing units, NAV, cost and value', () => {
    expect(cas.kind).toBe('detailed');
    expect(cas.statementPeriod).toBe('2024-04-01 to 2026-09-24');
    expect(cas.schemes).toHaveLength(2);
    const [pp, hdfc] = cas.schemes;
    expect(pp).toMatchObject({ name: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth', isin: 'INF879O01027', folio: '12345678 / 90', units: 267.857, nav: 92, navDate: '2026-09-24', cost: 20000, value: 24642.84, advisor: 'DIRECT', amc: 'Parag Parikh Mutual Fund' });
    expect(pp.txns).toHaveLength(2); // stamp duty ignored
    expect(hdfc).toMatchObject({ name: 'HDFC Top 100 Fund - Regular Plan - Growth', value: 104500, advisor: 'ARN-12345' });
    expect(hdfc.txns[0]).toMatchObject({ kind: 'sell', amount: 5000, date: '2025-01-15' });
  });
  it('turns schemes into holdings with an asset class', () => {
    const hs = casToHoldings(cas);
    expect(hs[0]).toMatchObject({ kind: 'mf', assetClass: 'Equity', invested: 20000, value: 24642.84, source: 'cas', txnsComplete: true });
    expect(hs[1].txnsComplete).toBe(false);
  });
});

describe('XIRR', () => {
  it('matches a known annual return', () => {
    // 1,00,000 invested, worth 1,10,000 exactly one year later → 10%.
    expect(xirr([{ date: '2025-01-01', amount: -100000 }, { date: '2026-01-01', amount: 110000 }])!).toBeCloseTo(0.1, 3);
  });
  it('handles a SIP (two instalments) and refuses impossible inputs', () => {
    const r = xirr([{ date: '2024-04-10', amount: -10000 }, { date: '2025-04-10', amount: -10000 }, { date: '2026-04-10', amount: 23100 }])!;
    expect(r).toBeCloseTo(0.1, 2); // 10000·1.1² + 10000·1.1 = 23,100
    expect(xirr([{ date: '2025-01-01', amount: -100 }])).toBeNull();
    expect(xirr([{ date: '2025-01-01', amount: 100 }, { date: '2026-01-01', amount: 200 }])).toBeNull();
  });
});

describe('portfolio summary', () => {
  const data: PortfolioData = {
    holdings: [
      ...casToHoldings(parseCas(CAS)),
      { id: 'c', kind: 'cash', name: 'Savings account', assetClass: 'Cash', invested: 0, value: 50000, source: 'manual', updatedAt: '' },
    ],
    liabilities: [{ id: 'l', name: 'Car loan', outstanding: 30000, ratePct: 9 }],
  };
  const s = summarise(data, 30);
  it('computes net worth, gains and allocation', () => {
    expect(s.assets).toBeCloseTo(24642.84 + 104500 + 50000, 2);
    expect(s.netWorth).toBeCloseTo(s.assets - 30000, 2);
    expect(s.invested).toBe(100000);
    expect(s.byClass[0].cls).toBe('Equity');
    // HDFC was held before the statement (opening 100 units), so only Parag Parikh counts for XIRR.
    expect(s.xirrCoverage).toBeCloseTo(24642.84 / s.assets, 4);
    // Parag Parikh: 10,000 on 10-Apr-2024 and 10-Apr-2025, worth 24,642.84 today → a sane yearly return.
    expect(s.xirr!).toBeGreaterThan(0.05);
    expect(s.xirr!).toBeLessThan(0.4);
  });
  it('flags a Regular plan with a cost range, and the snapshot has full amounts only', () => {
    const reg = s.insights.find((i) => /Regular plan/.test(i.title))!;
    expect(reg.detail).toContain('₹523 to ₹1,568');
    const snap = portfolioSnapshot(data, s);
    expect(snap).toContain('Net worth ₹1,49,143');
    expect(snap).not.toMatch(/\d\s?(k|L|Cr|lakh)\b/);
  });
});

import { sipBacktest } from '../src/services/portfolio';
describe('SIP check', () => {
  it('buys monthly at actual NAVs and values at the latest NAV', () => {
    // NAV 100 flat for 2 years, then 110 on the last day → every unit gains 10%.
    const hist: Array<{ date: string; nav: number }> = [];
    for (let d = new Date('2024-01-01'); d <= new Date('2026-01-01'); d.setUTCDate(d.getUTCDate() + 7)) hist.push({ date: d.toISOString().slice(0, 10), nav: 100 });
    hist.push({ date: '2026-01-02', nav: 110 });
    const r = sipBacktest(hist, 5000, 1)!;
    expect(r.months).toBe(12);
    expect(r.invested).toBe(60000);
    expect(r.value).toBeCloseTo(66000, 6);
    expect(r.xirr!).toBeGreaterThan(0.1);
    expect(sipBacktest(hist, 5000, 5)).toBeNull(); // not enough history
  });
});
