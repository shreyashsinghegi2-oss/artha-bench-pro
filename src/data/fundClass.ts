/** Asset class of a mutual fund from its SEBI category and name. Shared by the server and the app. */
export type FundAssetClass = 'Equity' | 'Debt' | 'Hybrid' | 'Gold & commodities' | 'Other';

export function assetClassFor(category: string, name = ''): FundAssetClass {
  const c = `${category} ${name}`.toLowerCase();
  if (/gold|silver|commodit/.test(c)) return 'Gold & commodities';
  if (/hybrid|balanced|asset allocation|arbitrage|equity savings|multi asset/.test(c)) return 'Hybrid';
  if (/equity|elss|tax saver|index|etf|large ?cap|mid ?cap|small ?cap|large (&|and) mid|flexi|multi ?cap|focused|value|contra|dividend yield|sectoral|thematic|nifty|sensex|top 100|top 200|bluechip|blue chip|opportunities|infrastructure|pharma|banking (&|and) financial services|technology|consumption/.test(c)) return 'Equity';
  if (/debt|liquid|overnight|money market|gilt|bond|duration|credit risk|banking and psu|floater|income|fixed maturity|fmp/.test(c)) return 'Debt';
  return 'Other';
}

