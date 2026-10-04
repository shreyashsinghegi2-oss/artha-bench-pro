/**
 * OpenAPI 3.1 document for /api/v1, generated from the same registry the router uses to validate requests,
 * so the documentation cannot drift from the behaviour.
 */
import { CALCULATORS } from './calculators';
import type { ParamDef } from './params';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const paramSchema = (p: ParamDef): Json =>
  p.kind === 'number'
    ? { type: p.integer ? 'integer' : 'number', minimum: p.min, maximum: p.max, ...(p.default !== undefined ? { default: p.default } : {}), example: p.example }
    : { type: 'string', enum: [...p.values], ...(p.default !== undefined ? { default: p.default } : {}), example: p.example };

const envelopeRef = (dataDescription: string): Json => ({
  description: dataDescription,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Envelope' } } },
});

const errors: Json = {
  '400': { description: 'Invalid parameters', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
};

export function buildOpenApi(): Json {
  const paths: Record<string, Json> = {};
  for (const c of CALCULATORS) {
    paths[`/calculators/${c.slug}`] = {
      get: {
        tags: ['Calculators'],
        operationId: `calc_${c.slug.replace(/-/g, '_')}`,
        summary: c.summary,
        description: `Formula: ${c.formula}\n\nSource: ${c.source}. Deterministic, no API key needed, cached 60 s.`,
        parameters: c.params.map((p) => ({ name: p.name, in: 'query', required: p.required, description: p.description, schema: paramSchema(p) })),
        responses: {
          '200': envelopeRef(`${c.summary} result`),
          '422': {
            description: 'Inputs are valid numbers but the calculation is not possible',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          ...(errors as Record<string, Json>),
        },
      },
    };
  }
  const market = (slug: string, summary: string, description: string) => ({
    get: {
      tags: ['Market'],
      operationId: `market_${slug.replace(/-/g, '_')}`,
      summary,
      description,
      responses: { '200': envelopeRef(summary), '503': { description: 'Source unavailable (no substitute data is ever returned)' } },
    },
  });
  paths['/market/nifty'] = market('nifty', 'NIFTY 50 quote', 'Yahoo Finance quote for ^NSEI. Usually delayed.');
  paths['/market/btc'] = market('btc', 'Bitcoin (BTC/USDT)', 'Binance public market data, 24-hour statistics.');
  paths['/market/fii-dii'] = market(
    'fii-dii',
    'FII/DII daily net flows',
    'NSE provisional cash-market flows in ₹ crore for the latest trading day. NSE sometimes blocks cloud servers; then 503.',
  );
  paths['/market/sector-rotation'] = market(
    'sector-rotation',
    'NSE sector performance (1 day)',
    'Ten NSE sectoral indices ranked by change versus previous close, with leaders and laggards.',
  );
  paths['/health'] = {
    get: {
      tags: ['Service'],
      operationId: 'health',
      summary: 'Service and data-source health',
      responses: { '200': envelopeRef('status, uptime_s and per-source health (ok, degraded, down)') },
    },
  };
  paths['/ai/cfo'] = {
    post: {
      tags: ['AI (API key)'],
      operationId: 'ai_cfo',
      summary: 'AI CFO brief grounded in live sources',
      security: [{ ApiKeyAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['query'],
              properties: {
                query: { type: 'string', minLength: 3, maxLength: 2000, example: 'Should I prepay my home loan or invest in an index fund?' },
                context: {
                  type: 'object',
                  properties: {
                    country: { type: 'string', enum: ['India', 'US', 'Global'] },
                    language: { type: 'string', enum: ['english', 'hindi', 'hinglish'] },
                    detail: { type: 'string', enum: ['short', 'standard', 'detailed'] },
                  },
                },
              },
            },
          },
        },
      },
      responses: { '200': envelopeRef('brief, sources, verified_numbers, model_used'), '401': { description: 'Missing or invalid API key' } },
    },
  };
  paths['/ai/benchmark'] = {
    post: {
      tags: ['AI (API key)'],
      operationId: 'ai_benchmark',
      summary: 'Score an AI model on your numeric questions',
      security: [{ ApiKeyAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['items'],
              properties: {
                model: { type: 'string', enum: ['artha', 'nemotron'], default: 'artha' },
                tolerance_pct: { type: 'number', minimum: 0, maximum: 20, default: 1 },
                items: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 10,
                  items: { type: 'object', required: ['question', 'expected'], properties: { question: { type: 'string' }, expected: { type: 'number' } } },
                  example: [{ question: 'EMI on ₹10,00,000 at 8.5% for 20 years?', expected: 8678.23 }],
                },
              },
            },
          },
        },
      },
      responses: { '200': envelopeRef('accuracy_pct, per-question results, latency'), '401': { description: 'Missing or invalid API key' } },
    },
  };
  const webhookBody: Json = {
    type: 'object',
    required: ['url', 'symbol', 'condition', 'threshold'],
    properties: {
      url: { type: 'string', format: 'uri', example: 'https://example.com/hooks/arthabench' },
      symbol: { type: 'string', enum: ['nifty', 'btc'] },
      condition: { type: 'string', enum: ['above', 'below'] },
      threshold: { type: 'number', example: 25000 },
    },
  };
  paths['/webhooks'] = {
    get: {
      tags: ['Webhooks (API key)'],
      operationId: 'webhooks_list',
      summary: 'List your market-alert webhooks',
      security: [{ ApiKeyAuth: [] }],
      responses: { '200': envelopeRef('webhooks') },
    },
    post: {
      tags: ['Webhooks (API key)'],
      operationId: 'webhooks_create',
      summary: 'Create a market-alert webhook',
      description:
        'We POST JSON to your https URL when the condition becomes true. Verify X-ArthaBench-Signature: sha256=HMAC-SHA256(secret, raw body). The secret is shown only once.',
      security: [{ ApiKeyAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: webhookBody } } },
      responses: { '201': envelopeRef('the webhook including its secret') },
    },
  };
  paths['/webhooks/{id}'] = {
    delete: {
      tags: ['Webhooks (API key)'],
      operationId: 'webhooks_delete',
      summary: 'Delete a webhook',
      security: [{ ApiKeyAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: { '200': envelopeRef('deleted: true') },
    },
  };

  return {
    openapi: '3.1.0',
    info: {
      title: 'ArthaBench Public API',
      version: '1.0.0',
      description:
        'Deterministic financial calculators (no key), market data and AI endpoints. Every response is { data, source, timestamp, reliability_score, is_deterministic }. Free: 100 requests/minute per IP. With an API key: 1000/minute. Educational use; not investment, tax or legal advice.',
      license: { name: 'See repository licence', url: 'https://github.com/shreyashsinghegi2-oss/artha-bench-pro' },
    },
    servers: [{ url: '/api/v1' }],
    tags: [{ name: 'Calculators' }, { name: 'Market' }, { name: 'AI (API key)' }, { name: 'Webhooks (API key)' }, { name: 'Service' }],
    paths,
    components: {
      securitySchemes: { ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' } },
      schemas: {
        Envelope: {
          type: 'object',
          required: ['data', 'source', 'timestamp', 'reliability_score', 'is_deterministic'],
          properties: {
            data: { description: 'Endpoint-specific result' },
            source: { type: 'string', description: 'Where the data or rules came from' },
            timestamp: { type: 'string', format: 'date-time', description: 'When the data was produced (as-of time for market data)' },
            reliability_score: { type: 'integer', minimum: 0, maximum: 100, description: 'Source confidence adjusted for freshness; see /developers' },
            is_deterministic: { type: 'boolean', description: 'true when the same inputs always give the same output' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: { code: { type: 'string' }, message: { type: 'string' }, details: { type: 'object', additionalProperties: { type: 'string' } } },
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  };
}

export const SWAGGER_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>ArthaBench API docs</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css"/>
<style>body{margin:0;background:#fff}.topbar{display:none}</style></head>
<body><div id="ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin="anonymous"></script>
<script>window.ui=SwaggerUIBundle({url:'/api/v1/openapi.json',dom_id:'#ui',deepLinking:true,tryItOutEnabled:true,persistAuthorization:true});</script>
</body></html>`;
