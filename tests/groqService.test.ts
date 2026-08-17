import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkGroqDiagnostics, getGroqModels } from '../server/groqService';

const trackedEnvironmentKeys = [
  'GROQ_API_KEY',
  'GROQ_TUTOR_MODEL',
  'GROQ_EVALUATOR_MODEL',
  'GROQ_PRIMARY_MODEL',
  'GROQ_SECONDARY_MODEL',
] as const;

const originalEnvironment = Object.fromEntries(
  trackedEnvironmentKeys.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const key of trackedEnvironmentKeys) {
    const originalValue = originalEnvironment[key];
    if (originalValue === undefined) delete process.env[key];
    else process.env[key] = originalValue;
  }
});

function clearModelOverrides() {
  delete process.env.GROQ_TUTOR_MODEL;
  delete process.env.GROQ_EVALUATOR_MODEL;
  delete process.env.GROQ_PRIMARY_MODEL;
  delete process.env.GROQ_SECONDARY_MODEL;
}

describe('Groq model configuration and diagnostics', () => {
  it('uses the supported GPT-OSS replacements by default', () => {
    clearModelOverrides();

    expect(getGroqModels()).toEqual({
      tutorModel: 'openai/gpt-oss-120b',
      evaluatorModel: 'openai/gpt-oss-20b',
      primaryModel: 'openai/gpt-oss-120b',
      secondaryModel: 'openai/gpt-oss-20b',
    });
  });

  it('automatically migrates retired Vercel model overrides', () => {
    process.env.GROQ_TUTOR_MODEL = 'llama-3.3-70b-versatile';
    process.env.GROQ_EVALUATOR_MODEL = 'llama-3.1-8b-instant';
    process.env.GROQ_PRIMARY_MODEL = 'llama-3.3-70b-versatile';
    process.env.GROQ_SECONDARY_MODEL = 'llama-3.1-8b-instant';

    expect(getGroqModels()).toEqual({
      tutorModel: 'openai/gpt-oss-120b',
      evaluatorModel: 'openai/gpt-oss-20b',
      primaryModel: 'openai/gpt-oss-120b',
      secondaryModel: 'openai/gpt-oss-20b',
    });
  });

  it('preserves unrelated custom model overrides', () => {
    clearModelOverrides();
    process.env.GROQ_TUTOR_MODEL = 'qwen/qwen3.6-27b';

    expect(getGroqModels().tutorModel).toBe('qwen/qwen3.6-27b');
  });

  it('reports every role as not configured when the key is absent', async () => {
    clearModelOverrides();
    delete process.env.GROQ_API_KEY;

    const diagnostics = await checkGroqDiagnostics();

    expect(diagnostics).toHaveLength(3);
    expect(diagnostics.every((diagnostic) => diagnostic.status === 'not_configured')).toBe(true);
  });

  it('authenticates once against the model directory and confirms active models', async () => {
    clearModelOverrides();
    process.env.GROQ_API_KEY = 'groq-test-secret';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: 'openai/gpt-oss-120b', object: 'model' },
            { id: 'openai/gpt-oss-20b', object: 'model' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const diagnostics = await checkGroqDiagnostics();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/models');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      headers: {
        Authorization: 'Bearer groq-test-secret',
        'Content-Type': 'application/json',
      },
    });
    expect(diagnostics.every((diagnostic) => diagnostic.status === 'connected')).toBe(true);
    expect(JSON.stringify(diagnostics)).not.toContain('groq-test-secret');
  });

  it('identifies a configured model that is no longer active', async () => {
    clearModelOverrides();
    process.env.GROQ_API_KEY = 'groq-test-secret';
    process.env.GROQ_PRIMARY_MODEL = 'retired-model';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              { id: 'openai/gpt-oss-120b' },
              { id: 'openai/gpt-oss-20b' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const diagnostics = await checkGroqDiagnostics();

    expect(diagnostics.find((diagnostic) => diagnostic.id === 'groq-tutor')?.status).toBe(
      'connected',
    );
    expect(diagnostics.find((diagnostic) => diagnostic.id === 'groq-primary')).toMatchObject({
      name: 'retired-model',
      status: 'error',
      message: 'The configured Groq model is no longer active for this API key.',
    });
  });

  it('reports rejected credentials without exposing the key', async () => {
    clearModelOverrides();
    process.env.GROQ_API_KEY = 'never-return-this-groq-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 401 })),
    );

    const diagnostics = await checkGroqDiagnostics();

    expect(diagnostics.every((diagnostic) => diagnostic.status === 'invalid_credentials')).toBe(
      true,
    );
    expect(JSON.stringify(diagnostics)).not.toContain('never-return-this-groq-key');
  });
});
