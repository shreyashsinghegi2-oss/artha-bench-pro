import { NormalizedNewsItem } from '../types';

export const DEMO_NEWS_ITEMS: NormalizedNewsItem[] = [
  {
    id: 'news-demo-1',
    title: 'Global Central Banks Signal Data-Dependent Monetary Policy Frameworks',
    summary:
      'Major central banks emphasize economic inflation metrics and labor market conditions before considering interest rate adjustments in upcoming quarterly meetings.',
    sourceName: 'Financial Times (Demo)',
    sourceUrl: 'https://example.com/demo/news/central-banks',
    publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    retrievedAt: new Date().toISOString(),
    category: 'Economy',
    region: 'global',
    imageUrl: null,
  },
  {
    id: 'news-demo-2',
    title: 'Tech Enterprise Earnings Exceed Consensus Revenue Estimates on Cloud Demand',
    summary:
      'Enterprise software leaders report robust cloud migration growth and enterprise digital transformation infrastructure demand across Q2 earnings disclosures.',
    sourceName: 'Wall Street Journal (Demo)',
    sourceUrl: 'https://example.com/demo/news/tech-earnings',
    publishedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    retrievedAt: new Date().toISOString(),
    category: 'Corporate',
    region: 'global',
    imageUrl: null,
  },
  {
    id: 'news-demo-3',
    title: 'India Retail Participation Increases in Systemic Investment Plans (SIPs)',
    summary:
      'Domestic mutual fund inflow data indicates steady retail monthly contributions into index funds and diversified equity schemes.',
    sourceName: 'Economic Times (Demo)',
    sourceUrl: 'https://example.com/demo/news/india-sips',
    publishedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    retrievedAt: new Date().toISOString(),
    category: 'Markets',
    region: 'india',
    imageUrl: null,
  },
];
