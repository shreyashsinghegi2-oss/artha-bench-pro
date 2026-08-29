type ImportResult = { name: string; ok: boolean; error?: string };

function safeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 500);
  return String(error).slice(0, 500);
}

export default async function handler(_req: unknown, res: any) {
  const results: ImportResult[] = [];

  const run = async (name: string, loader: () => Promise<unknown>) => {
    try {
      await loader();
      results.push({ name, ok: true });
    } catch (error) {
      results.push({ name, ok: false, error: safeError(error) });
    }
  };

  await run('groqService', () => import('../server/groqService'));
  await run('aiResponseStandard', () => import('../server/aiResponseStandard'));
  await run('safetyChecker', () => import('../server/safetyChecker'));
  await run('batchBenchmark', () => import('../server/batchBenchmark'));
  await run('reportStorage', () => import('../server/reportStorage'));
  await run('financeEngine', () => import('../server/financeEngine'));
  await run('learningService', () => import('../server/learningService'));
  await run('businessNewsService', () => import('../server/businessNewsService'));
  await run('marketDataService', () => import('../server/marketDataService'));
  await run('indiaMarketTickerService', () => import('../server/indiaMarketTickerService'));
  await run('newsProvider', () => import('../server/providers/newsProvider'));
  await run('marketDataProvider', () => import('../server/providers/marketDataProvider'));
  await run('fredProvider', () => import('../server/providers/fredProvider'));
  await run('worldBankProvider', () => import('../server/providers/worldBankProvider'));
  await run('finnhubProvider', () => import('../server/providers/finnhubProvider'));
  await run('cryptoService', () => import('../server/cryptoService'));
  await run('cryptoTypes', () => import('../src/components/crypto/cryptoTypes'));
  await run('personalAccountRoutes', () => import('../server/personalAccountRoutes'));

  res.status(200).json({ runtime: process.version, results });
}
