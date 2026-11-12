import test from 'node:test';
import assert from 'node:assert/strict';
import {createOllamaClient, OllamaError} from '../backend/ollama.mjs';

const privateText = 'private student question sentinel';
const input = {messages: [{role: 'user', content: privateText}]};
const response = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const answer = (overrides = {}) => ({done: true, done_reason: 'stop', message: {role: 'assistant', content: 'Four.', thinking: 'private reasoning sentinel'}, ...overrides});
const silent = () => {};

test('Ollama sends a bounded local chat request without cloud authorization or thinking output', async () => {
  const requests = [];
  const client = createOllamaClient({baseUrl: 'http://host.docker.internal:11434/', logger: silent, fetchImpl: async (url, options) => {
    requests.push({url, options});
    return response(answer());
  }});
  assert.equal(await client({...input, maxTokens: 100000, temperature: 100, baseUrl: 'https://api.openai.com', model: 'other'}), 'Four.');
  assert.equal(requests.length, 1);
  const {url, options} = requests[0];
  assert.equal(url, 'http://host.docker.internal:11434/api/chat');
  assert.equal(options.redirect, 'error');
  assert.equal(new Headers(options.headers).get('authorization'), null);
  const body = JSON.parse(options.body);
  assert.equal(body.model, 'qwen3:1.7b-q8_0');
  assert.equal(body.think, false);
  assert.equal(body.stream, false);
  assert.equal(body.options.num_ctx, 4096);
  assert.equal(body.options.num_predict, 700);
  assert.deepEqual(body.messages, input.messages);
});

test('Ollama configuration rejects unsafe origins and cloud model names before any request', () => {
  let calls = 0;
  const fetchImpl = async () => {calls++; return response(answer());};
  for (const baseUrl of ['file:///tmp/test', 'https://user:secret@example.com', 'http://localhost/api/chat',
    'http://localhost?token=secret', 'http://localhost/#private', '', 'not a URL', 42]) {
    assert.throws(() => createOllamaClient({baseUrl, fetchImpl}), error => error instanceof TypeError && !error.message.includes('secret'));
  }
  for (const model of ['qwen3:cloud', 'qwen3-cloud', '', 'model\nsecret']) {
    assert.throws(() => createOllamaClient({model, fetchImpl}), TypeError);
  }
  assert.equal(calls, 0);
});

test('Ollama maps unavailable, missing-model, busy and timeout statuses without exposing raw responses', async () => {
  const cases = [[404, 'AI_LOCAL_MODEL_MISSING', 503], [429, 'AI_LOCAL_BUSY', 503], [503, 'AI_LOCAL_BUSY', 503],
    [500, 'AI_LOCAL_UNAVAILABLE', 502], [400, 'AI_LOCAL_UNAVAILABLE', 502], [408, 'AI_TIMEOUT', 504]];
  for (const [status, code, appStatus] of cases) {
    const logs = [];
    let readBody = false;
    const client = createOllamaClient({logger: entry => logs.push(entry), fetchImpl: async () => ({
      status, ok: false, json: async () => {readBody = true; throw new Error(privateText);}
    })});
    await assert.rejects(client(input), error => error instanceof OllamaError && error.code === code && error.appStatus === appStatus && !error.message.includes(privateText));
    assert.equal(readBody, false);
    assert.deepEqual(logs, [{endpoint: 'ollama/chat', category: code, status}]);
  }
});

test('Ollama rejects unfinished, invalid and hidden-reasoning responses', async () => {
  const cases = [null, [], 'text', {}, answer({done: false}), answer({error: privateText}),
    answer({message: {role: 'tool', content: privateText}}), answer({message: {role: 'assistant', content: ''}}),
    answer({message: {role: 'assistant', content: '<think>private reasoning</think>Four.'}}),
    answer({message: {role: 'assistant', content: 'x'.repeat(16001)}})];
  for (const body of cases) {
    const client = createOllamaClient({logger: silent, fetchImpl: async () => response(body)});
    await assert.rejects(client(input), {code: 'AI_INVALID_RESPONSE'});
  }
  const truncated = createOllamaClient({logger: silent, fetchImpl: async () => response(answer({done_reason: 'length'}))});
  await assert.rejects(truncated(input), {code: 'AI_LOCAL_INCOMPLETE'});
  const invalidJSON = createOllamaClient({logger: silent, fetchImpl: async () => new Response(privateText)});
  await assert.rejects(invalidJSON(input), {code: 'AI_INVALID_RESPONSE'});
});

test('Ollama preserves structured-output requests for local safety checks', async () => {
  const schema = {type: 'object', properties: {safe: {type: 'boolean'}}, required: ['safe'], additionalProperties: false};
  const client = createOllamaClient({logger: silent, fetchImpl: async (_, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(body.format, schema);
    assert.equal(body.options.num_predict, 40);
    assert.equal(body.options.temperature, 0);
    return response(answer({message: {role: 'assistant', content: '{"safe":true}'}}));
  }});
  assert.equal(await client({...input, format: schema, maxTokens: 40, temperature: 0}), '{"safe":true}');
});

test('Ollama transport errors and failing log sinks never expose private detail', async () => {
  for (const logger of [silent, () => {throw new Error(privateText); }]) {
    const client = createOllamaClient({logger, fetchImpl: async () => {throw new Error(`Connection failed ${privateText}`);}});
    await assert.rejects(client(input), error => error.code === 'AI_LOCAL_UNAVAILABLE' && !error.message.includes(privateText));
  }
});

async function bounded(promise) {
  let timer;
  try {return await Promise.race([promise, new Promise((_, reject) => {timer = setTimeout(() => reject(new Error('Timeout failed to bound request')), 1500);})]);}
  finally {clearTimeout(timer);}
}

test('Ollama timeout bounds both a stalled fetch and a stalled JSON body', async () => {
  for (const fetchImpl of [() => new Promise(() => {}), async () => ({ok: true, status: 200, json: () => new Promise(() => {})})]) {
    const client = createOllamaClient({fetchImpl, timeoutMs: 20, logger: silent});
    await bounded(assert.rejects(client(input), {code: 'AI_TIMEOUT', appStatus: 504}));
  }
});
