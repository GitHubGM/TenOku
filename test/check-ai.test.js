import test from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../scripts/check-ai.mjs';

const fakeKey = 'test-only-not-a-real-key';
const moderation = { results: [{ flagged: false }] };
const generatedText = '2 + 2 is 4.';
const generation = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: generatedText }] }] };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('AI diagnostic with missing key does not call provider', async () => {
  const logs = [];
  const result = await runCheck({ env: {}, fetchImpl() { assert.fail('Provider must not be called'); }, log: line => logs.push(line) });
  assert.equal(result.code, 'AI_NOT_CONFIGURED');
  assert.equal(result.ok, false);
  assert.ok(logs.includes('OpenAI API key present: false'));
});

test('AI diagnostic checks all three provider endpoints without logging secrets or generated content', async () => {
  const calls = [], logs = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return json(calls.length === 2 ? generation : moderation);
  };
  const result = await runCheck({ env: { OPENAI_API_KEY: fakeKey }, fetchImpl, log: line => logs.push(line) });
  assert.equal(result.ok, true);
  assert.deepEqual(calls.map(call => call.url), [
    'https://api.openai.com/v1/moderations',
    'https://api.openai.com/v1/responses',
    'https://api.openai.com/v1/moderations',
  ]);
  assert.equal(calls[1].body.store, false);
  assert.equal(calls[1].body.max_output_tokens, 700);
  assert.equal(calls[1].body.safety_identifier, undefined);
  assert.equal(calls[2].body.input, generatedText);
  assert.ok(!logs.join('\n').includes(fakeKey));
  assert.ok(!logs.join('\n').includes(generatedText));
});

test('AI diagnostic exposes safe auth and quota codes, never raw provider errors', async () => {
  for (const [status, code, expected] of [[401, 'invalid_api_key', 'AI_AUTH_FAILED'], [429, 'insufficient_quota', 'AI_QUOTA_EXCEEDED']]) {
    const logs = [];
    const result = await runCheck({
      env: { OPENAI_API_KEY: fakeKey },
      fetchImpl: async () => json({ error: { code, message: `secret-body-${fakeKey}` } }, status),
      log: line => logs.push(line),
    });
    assert.equal(result.code, expected);
    assert.ok(!logs.join('\n').includes('secret-body'));
    assert.ok(!logs.join('\n').includes(fakeKey));
  }
});

test('AI diagnostic does not print an invalid model value or raw thrown errors', async () => {
  const invalidLogs = [];
  const invalid = await runCheck({
    env: { OPENAI_API_KEY: fakeKey, OPENAI_MODEL: 'private/model\nsecret' },
    fetchImpl() { assert.fail('Invalid model should not call provider'); },
    log: line => invalidLogs.push(line),
  });
  assert.equal(invalid.code, 'AI_MODEL_CONFIG_INVALID');
  assert.ok(!invalidLogs.join('\n').includes('private/model'));
  const thrownLogs = [];
  const failure = await runCheck({
    env: { OPENAI_API_KEY: fakeKey },
    fetchImpl: async () => { throw new Error(`private-network-message-${fakeKey}`); },
    log: line => thrownLogs.push(line),
  });
  assert.equal(failure.code, 'AI_CONNECTION_FAILED');
  assert.ok(!thrownLogs.join('\n').includes('private-network-message'));
  assert.ok(!thrownLogs.join('\n').includes(fakeKey));
});

test('AI diagnostic never prints a key accidentally entered as the model', async () => {
  const logs = [];
  const result = await runCheck({
    env: { OPENAI_API_KEY: fakeKey, OPENAI_MODEL: fakeKey },
    fetchImpl() { assert.fail('Accidental key as model must not call provider'); },
    log: line => logs.push(line),
  });
  assert.equal(result.code, 'AI_MODEL_CONFIG_INVALID');
  assert.ok(!logs.join('\n').includes(fakeKey));
});

test('AI diagnostic distinguishes incomplete output from an authentication failure', async () => {
  let calls = 0;
  const logs = [];
  const result = await runCheck({
    env: { OPENAI_API_KEY: fakeKey },
    fetchImpl: async () => json(++calls === 1 ? moderation : { status: 'incomplete', output: [] }),
    log: line => logs.push(line),
  });
  assert.equal(result.code, 'AI_INCOMPLETE_RESPONSE');
  assert.equal(calls, 2);
  assert.match(logs.join('\n'), /does not mean the key is invalid/);
});

test('AI diagnostic rejects malformed moderation and checks output moderation', async () => {
  const malformed = await runCheck({ env: { OPENAI_API_KEY: fakeKey }, fetchImpl: async () => json({ results: [] }), log() {} });
  assert.equal(malformed.code, 'AI_INVALID_RESPONSE');
  let calls = 0;
  const blocked = await runCheck({
    env: { OPENAI_API_KEY: fakeKey },
    fetchImpl: async () => json(++calls === 1 ? moderation : calls === 2 ? generation : { results: [{ flagged: true }] }),
    log() {},
  });
  assert.equal(blocked.code, 'AI_CONTENT_BLOCKED');
  assert.equal(blocked.stage, 'output moderation');
  assert.equal(calls, 3);
});

const localResponse = content => json({done: true, done_reason: 'stop', message: {role: 'assistant', content}});

test('local AI diagnostic uses only Ollama and performs both local checks without an API key', async () => {
  const calls = [], logs = [];
  const result = await runCheck({
    env: {AI_PROVIDER: 'ollama'},
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({url, options, body});
      return localResponse(body.format ? '{"safe":true}' : 'Four.');
    },
    log: line => logs.push(line),
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 3);
  for (const {url, options, body} of calls) {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(body.model, 'qwen3:1.7b-q8_0');
    assert.equal(body.think, false);
    assert.equal(body.stream, false);
  }
  assert.ok(calls[0].body.format);
  assert.equal(calls[1].body.format, undefined);
  assert.ok(calls[2].body.format);
  assert.ok(!logs.join('\n').includes('Four.'));
  assert.ok(!logs.join('\n').includes('http://127.0.0.1:11434'));
  assert.ok(!logs.join('\n').includes('qwen3:1.7b-q8_0'));
});

test('local diagnostic reports missing models and malformed safety checks without cloud fallback', async () => {
  let calls = 0;
  const logs = [];
  const missing = await runCheck({
    env: {AI_PROVIDER: 'ollama', OPENAI_API_KEY: fakeKey},
    fetchImpl: async url => {
      calls++;
      assert.equal(url, 'http://127.0.0.1:11434/api/chat');
      return json({error: `private error with ${fakeKey}`}, 404);
    },
    log: line => logs.push(line),
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'AI_LOCAL_MODEL_MISSING');
  assert.equal(calls, 1);
  assert.ok(!logs.join('\n').includes(fakeKey));
  assert.ok(!logs.join('\n').includes('private error'));
  calls = 0;
  const malformed = await runCheck({
    env: {AI_PROVIDER: 'ollama'},
    fetchImpl: async () => { calls++; return localResponse('{"safe":"true"}'); },
    log() {},
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.code, 'AI_LOCAL_SAFETY_UNAVAILABLE');
  assert.equal(calls, 1);
});

test('diagnostic validates provider and local configuration without printing or requesting invalid values', async () => {
  for (const [env, code] of [
    [{AI_PROVIDER: 'private-provider-value'}, 'AI_PROVIDER_INVALID'],
    [{AI_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://private-user:private-password@localhost:11434'}, 'AI_LOCAL_CONFIG_INVALID'],
    [{AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'private\nmodel'}, 'AI_LOCAL_CONFIG_INVALID'],
    [{AI_PROVIDER: 'ollama', OLLAMA_MODEL: fakeKey, OPENAI_API_KEY: fakeKey}, 'AI_LOCAL_CONFIG_INVALID'],
    [{AI_PROVIDER: 'ollama', OLLAMA_TIMEOUT_MS: '-1'}, 'AI_LOCAL_CONFIG_INVALID'],
  ]) {
    const logs = [];
    const result = await runCheck({env, fetchImpl() { assert.fail('Invalid configuration must not call a provider'); }, log: line => logs.push(line)});
    assert.equal(result.ok, false);
    assert.equal(result.code, code);
    assert.ok(!logs.join('\n').includes('private'));
    assert.ok(!logs.join('\n').includes(fakeKey));
  }
});

test('local diagnostic withholds a generated answer blocked by the output check', async () => {
  let calls = 0;
  const logs = [];
  const result = await runCheck({
    env: {AI_PROVIDER: 'ollama'},
    fetchImpl: async () => localResponse(++calls === 1 ? '{"safe":true}' : calls === 2 ? 'Private generated sentinel.' : '{"safe":false}'),
    log: line => logs.push(line),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'AI_CONTENT_BLOCKED');
  assert.equal(calls, 3);
  assert.ok(!logs.join('\n').includes('Private generated sentinel.'));
});
