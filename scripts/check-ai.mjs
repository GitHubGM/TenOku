import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpenAIClient } from '../backend/openai.mjs';
import { createOllamaClient } from '../backend/ollama.mjs';
import { createLocalTutor } from '../backend/local-tutor.mjs';

const guidance = Object.freeze({
  AI_PROVIDER_INVALID: 'Set AI_PROVIDER to openai or ollama, then recreate the container.',
  AI_LOCAL_CONFIG_INVALID: 'Check OLLAMA_BASE_URL, OLLAMA_MODEL and OLLAMA_TIMEOUT_MS in the server configuration, then recreate the container.',
  AI_LOCAL_UNAVAILABLE: 'Check that Ollama is running and reachable from the application container. Container localhost normally refers to the container itself.',
  AI_LOCAL_MODEL_MISSING: 'Pull the configured OLLAMA_MODEL on the Ollama host, then retry the check.',
  AI_LOCAL_BUSY: 'Ollama or the local tutor is busy. Wait for the current request to finish, then retry.',
  AI_LOCAL_INCOMPLETE: 'The local model stopped before finishing. Check the model, context and output-token settings.',
  AI_LOCAL_SAFETY_UNAVAILABLE: 'The local model could not complete a valid safety check. No unchecked answer was returned.',
  AI_NOT_CONFIGURED: 'Set OPENAI_API_KEY in the server .env, then recreate the container.',
  AI_AUTH_FAILED: 'Check that the server uses a valid active OpenAI API key, then recreate the container.',
  AI_QUOTA_EXCEEDED: 'Check API project billing, available credits and quota in the provider dashboard.',
  AI_RATE_LIMITED: 'Wait briefly and retry; check the API project request and token limits.',
  AI_ACCESS_DENIED: 'Check API project permissions and access to both Responses and Moderations.',
  AI_MODEL_UNAVAILABLE: 'Set OPENAI_MODEL to a model available to the API project, then recreate the container.',
  AI_BAD_REQUEST: 'Check the configured model supports this Responses request and update the application.',
  AI_TIMEOUT: 'The configured AI service timed out. Check connectivity and model loading; for local CPU inference, review OLLAMA_TIMEOUT_MS.',
  AI_CONNECTION_FAILED: 'Check server DNS, HTTPS certificates, firewall and outbound access to api.openai.com.',
  AI_UNAVAILABLE: 'The provider is unavailable or an unexpected error occurred. Retry later.',
  AI_INVALID_RESPONSE: 'The provider returned an unexpected response shape. Check for service issues and update the application.',
  AI_INCOMPLETE_RESPONSE: 'OpenAI was reachable but did not return complete text. Check model compatibility and output-token requirements; this does not mean the key is invalid.',
  AI_CONTENT_BLOCKED: 'The diagnostic input or output was blocked by moderation. Retry later; no content was logged.',
  AI_MODEL_CONFIG_INVALID: 'Set OPENAI_MODEL to a model identifier containing only letters, digits, dot, underscore, colon or hyphen.',
});

async function runLocalCheck({env, fetchImpl, log}) {
  const model = typeof env.OLLAMA_MODEL === 'string' && env.OLLAMA_MODEL.trim()
    ? env.OLLAMA_MODEL.trim() : 'qwen3:1.7b-q8_0';
  const baseUrl = typeof env.OLLAMA_BASE_URL === 'string' && env.OLLAMA_BASE_URL.trim()
    ? env.OLLAMA_BASE_URL.trim() : 'http://127.0.0.1:11434';
  const timeoutMs = env.OLLAMA_TIMEOUT_MS === undefined || env.OLLAMA_TIMEOUT_MS === ''
    ? 120000 : Number(env.OLLAMA_TIMEOUT_MS);
  // Hide values even when a credential was accidentally pasted into configuration.
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(model) || /^sk-/i.test(model) ||
      (typeof env.OPENAI_API_KEY === 'string' && model === env.OPENAI_API_KEY.trim()) ||
      !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fail(log, 'AI_LOCAL_CONFIG_INVALID', 'configuration');
  }
  let request;
  try {
    request = createOllamaClient({baseUrl, model, timeoutMs, fetchImpl, logger: () => {}});
  } catch {
    return fail(log, 'AI_LOCAL_CONFIG_INVALID', 'configuration');
  }
  log('Configured local model identifier: valid (value hidden)');
  log('Checking a fixed arithmetic prompt with local input and output checks. No OpenAI API calls are made.');
  try {
    const tutor = createLocalTutor({request});
    const result = await tutor({message: 'Explain 2 + 2 in one short sentence.', history: [], lang: 'en'});
    if (result.blocked) return fail(log, 'AI_CONTENT_BLOCKED', 'local tutor');
    if (typeof result.reply !== 'string' || !result.reply.trim()) {
      return fail(log, 'AI_INVALID_RESPONSE', 'local tutor');
    }
    log('Local tutor generation and checks: OK');
    log('AI check passed. No configuration values, generated text, or raw provider errors were printed.');
    return {ok: true, code: 'AI_CHECK_PASSED', stage: 'complete'};
  } catch (error) {
    return fail(log, typeof error?.code === 'string' ? error.code : 'AI_LOCAL_UNAVAILABLE', 'local tutor');
  }
}

function fail(log, code, stage) {
  const safeCode = Object.hasOwn(guidance, code) ? code : 'AI_UNAVAILABLE';
  log(`Check failed: ${safeCode} (${stage})`);
  log(guidance[safeCode]);
  return { ok: false, code: safeCode, stage };
}

function moderationStatus(data) {
  if (!Array.isArray(data?.results) || data.results.length < 1 ||
      data.results.some(result => typeof result?.flagged !== 'boolean')) return 'AI_INVALID_RESPONSE';
  return data.results.some(result => result.flagged) ? 'AI_CONTENT_BLOCKED' : null;
}

/** Explicit diagnostic only: injected env/fetch/log make tests independent of real credentials. */
export async function runCheck({ env = {}, fetchImpl = globalThis.fetch, log = console.log } = {}) {
  const provider = typeof env.AI_PROVIDER === 'string' ? env.AI_PROVIDER.trim().toLowerCase() || 'openai' : 'openai';
  if (!['openai', 'ollama'].includes(provider)) return fail(log, 'AI_PROVIDER_INVALID', 'configuration');
  log(`AI provider: ${provider}`);
  if (provider === 'ollama') return runLocalCheck({env, fetchImpl, log});
  const apiKey = typeof env.OPENAI_API_KEY === 'string' ? env.OPENAI_API_KEY.trim() : '';
  const model = typeof env.OPENAI_MODEL === 'string' && env.OPENAI_MODEL.trim()
    ? env.OPENAI_MODEL.trim() : 'gpt-4.1-mini';
  log(`OpenAI API key present: ${Boolean(apiKey)}`);
  if (!/^[a-zA-Z0-9._:-]{1,100}$/.test(model) || /^sk-/i.test(model) || (apiKey && model === apiKey)) {
    log('Configured model: [invalid identifier]');
    return fail(log, 'AI_MODEL_CONFIG_INVALID', 'configuration');
  }
  log('Configured model identifier: valid (value hidden)');
  if (!apiKey) return fail(log, 'AI_NOT_CONFIGURED', 'configuration');
  log('Checking a fixed arithmetic prompt; this consumes a small amount of API usage.');
  const request = createOpenAIClient({ apiKey, fetchImpl, logger: () => {} });
  const prompt = 'Explain 2 + 2 in one short sentence.';
  let stage = 'input moderation';
  try {
    const inputModeration = await request('moderations', {
      model: 'omni-moderation-latest', input: prompt,
    });
    const inputError = moderationStatus(inputModeration);
    if (inputError) return fail(log, inputError, stage);
    log('Input moderation: OK');

    stage = 'generation';
    const response = await request('responses', {
      model, input: prompt, max_output_tokens: 700, store: false,
    });
    const outputText = Array.isArray(response?.output)
      ? response.output.flatMap(item => Array.isArray(item?.content) ? item.content : [])
        .filter(item => item?.type === 'output_text' && typeof item.text === 'string')
        .map(item => item.text).join('\n').trim()
      : '';
    if (response.status === 'incomplete') {
      return fail(log, 'AI_INCOMPLETE_RESPONSE', stage);
    }
    if (!outputText || (response.status && response.status !== 'completed')) {
      return fail(log, 'AI_INVALID_RESPONSE', stage);
    }
    log('Generation: OK');

    stage = 'output moderation';
    const outputModeration = await request('moderations', {
      model: 'omni-moderation-latest', input: outputText,
    });
    const outputError = moderationStatus(outputModeration);
    if (outputError) return fail(log, outputError, stage);
    log('Output moderation: OK');
    log('AI check passed. No key, prompt response, or raw provider error was printed.');
    return { ok: true, code: 'AI_CHECK_PASSED', stage: 'complete' };
  } catch (error) {
    // Only allow known codes. Never print message, stack, body, headers or credentials.
    return fail(log, typeof error?.code === 'string' ? error.code : 'AI_UNAVAILABLE', stage);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runCheck({ env: process.env });
  process.exitCode = result.ok ? 0 : 1;
}
