import { describe, expect, it } from 'vitest';
import { assetClassFor, isoDate, parseAmfiNav, searchSchemes, trailingReturns } from '../server/mutualFundService';

const SAMPLE = `Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date

Open Ended Schemes(Equity Scheme - Flexi Cap Fund)

Parag Parikh Mutual Fund

122639;INF879O01027;-;Parag Parikh Flexi Cap Fund - Direct Plan - Growth;92.1234;24-Sep-2026
122640;INF879O01019;-;Parag Parikh Flexi Cap Fund - Regular Plan - Growth;85.5;24-Sep-2026

Open Ended Schemes(Debt Scheme - Liquid Fund)

HDFC Mutual Fund

119091;INF179KB1HK0;INF179KB1HL8;HDFC Liquid Fund - Direct Plan - Growth Option;5012.33;24-Sep-2026
119092;INF179KB1HM6;-;HDFC Liquid Fund - Bad row;N.A.;24-Sep-2026`;

describe('mutual fund data', () => {
  const list = parseAmfiNav(SAMPLE);
  it('parses AMFI rows with category, fund house, ISINs and NAV', () => {
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({ code: '122639', house: 'Parag Parikh Mutual Fund', category: 'Equity Scheme - Flexi Cap Fund', assetClass: 'Equity', isinGrowth: 'INF879O01027', isinReinvest: null, nav: 92.1234, navDate: '2026-09-24' });
    expect(list[2]).toMatchObject({ assetClass: 'Debt', isinReinvest: 'INF179KB1HL8' });
  });
  it('searches by words and puts direct growth plans first', () => {
    expect(searchSchemes(list, 'parag flexi')[0].name).toContain('Direct Plan - Growth');
    expect(searchSchemes(list, 'hdfc liquid')).toHaveLength(1);
    expect(searchSchemes(list, 'x')).toHaveLength(0);
  });
  it('classifies asset classes and dates', () => {
    expect(assetClassFor('Hybrid Scheme - Balanced Advantage Fund')).toBe('Hybrid');
    expect(assetClassFor('Other Scheme - FoF Domestic', 'Nippon India Gold Savings Fund')).toBe('Gold & commodities');
    expect(isoDate('05-01-2024')).toBe('2024-01-05');
  });
  it('computes trailing returns (absolute to 1 year, CAGR beyond)', () => {
    const pts = [{ date: '2023-09-24', nav: 100 }, { date: '2025-09-24', nav: 121 }, { date: '2026-09-24', nav: 133.1 }];
    const r = trailingReturns(pts);
    expect(r['1Y']).toBeCloseTo(0.1, 6);
    expect(r['3Y']).toBeCloseTo(0.1, 3);
  });
});
