import { describe, expect, it } from 'vitest';
import { assetKind } from '../src/components/market/AssetIcon';

describe('market symbols without a logo file', () => {
  it('maps gold, oil and oil & gas stocks', () => {
    expect(assetKind('GC=F')?.kind).toBe('gold');
    expect(assetKind('Gold')?.kind).toBe('gold');
    expect(assetKind('CL=F')?.kind).toBe('oil');
    expect(assetKind('ONGC.NS')?.kind).toBe('oil');
    expect(assetKind('BPCL:NSE')?.kind).toBe('oil');
  });

  it('maps currency pairs to base and quote flags', () => {
    expect(assetKind('USD/INR')).toEqual({ kind: 'pair', flags: ['US', 'IN'] });
    expect(assetKind('INR=X')).toEqual({ kind: 'pair', flags: ['US', 'IN'] });
    expect(assetKind('EURINR=X')).toEqual({ kind: 'pair', flags: ['EU', 'IN'] });
    expect(assetKind('GBPUSD=X')).toEqual({ kind: 'pair', flags: ['GB', 'US'] });
  });

  it('maps US indices and funds to the US flag, and crypto to its coin', () => {
    expect(assetKind('^GSPC')?.kind).toBe('us');
    expect(assetKind('SPY')?.kind).toBe('us');
    expect(assetKind('BTC-USD')?.kind).toBe('btc');
    expect(assetKind('ETHUSDT')?.kind).toBe('eth');
  });

  it('leaves ordinary companies to their logo or badge', () => {
    expect(assetKind('RELIANCE.NS')).toBeNull();
    expect(assetKind('AAPL')).toBeNull();
  });
});
