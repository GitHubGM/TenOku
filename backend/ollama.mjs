// Local inference only: the endpoint and model are administrator configuration.
// Never log prompts, raw provider errors, endpoint URLs, or credentials.
const errors = {
  AI_LOCAL_UNAVAILABLE: [502, 'The server could not reach the local AI service. Ask the administrator to check Ollama and its connection.'],
  AI_LOCAL_MODEL_MISSING: [503, 'The local AI model is not installed. Ask the administrator to download the configured Ollama model.'],
  AI_LOCAL_BUSY: [503, 'The local AI service is busy. Please try again shortly.'],
  AI_LOCAL_INCOMPLETE: [502, 'The local AI reply was incomplete. Please try a shorter question.'],
  AI_TIMEOUT: [504, 'The AI request timed out. Please try again shortly.'],
  AI_INVALID_RESPONSE: [502, 'The local AI service returned an invalid response. Please try again later.']
};

export class OllamaError extends Error {
  constructor(code) {
    const knownCode = Object.hasOwn(errors, code) ? code : 'AI_LOCAL_UNAVAILABLE';
    const [appStatus, message] = errors[knownCode];
    super(message);
    this.name = 'OllamaError';
    this.code = knownCode;
    this.appStatus = appStatus;
  }
}

function endpointFor(baseUrl) {
  let url;
  try {
    if (typeof baseUrl !== 'string') throw new Error();
    url = new URL(baseUrl.trim());
  } catch {
    throw new TypeError('OLLAMA_BASE_URL must be an HTTP or HTTPS origin.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/') {
    throw new TypeError('OLLAMA_BASE_URL must be an HTTP or HTTPS origin without credentials, path, query or fragment.');
  }
  return new URL('/api/chat', url.origin).href;
}

function classifyHTTP(status) {
  if (status === 404) return 'AI_LOCAL_MODEL_MISSING';
  if (status === 429 || status === 503) return 'AI_LOCAL_BUSY';
  if (status === 408 || status === 504) return 'AI_TIMEOUT';
  return 'AI_LOCAL_UNAVAILABLE';
}

export function createOllamaClient({
  baseUrl = 'http://127.0.0.1:11434', model = 'qwen3:1.7b-q8_0',
  fetchImpl = globalThis.fetch, timeoutMs = 120000, logger = console.warn
} = {}) {
  const endpoint = endpointFor(baseUrl);
  const modelName = typeof model === 'string' ? model.trim() : '';
  if (!modelName || modelName.length > 200 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(modelName)) {
    throw new TypeError('OLLAMA_MODEL must be a valid local model identifier.');
  }
  // Ollama also supports cloud model names; those are not a local provider.
  if (/(?:-cloud|:cloud)$/i.test(modelName)) {
    throw new TypeError('OLLAMA_MODEL must name a locally installed model, not a cloud model.');
  }
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120000;

  return async function request({messages, format, maxTokens = 700, temperature = 0.7} = {}) {
    if (!Array.isArray(messages) || !messages.length || messages.some(message =>
      !message || !['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string')) {
      throw new OllamaError('AI_INVALID_RESPONSE');
    }
    const numPredict = Number.isFinite(maxTokens) ? Math.min(700, Math.max(1, Math.floor(maxTokens))) : 700;
    const samplingTemperature = Number.isFinite(temperature) ? Math.min(2, Math.max(0, temperature)) : 0.7;
    const payload = {
      model: modelName,
      messages: messages.map(({role, content}) => ({role, content})),
      stream: false,
      think: false,
      keep_alive: '5m',
      options: {num_ctx: 4096, num_predict: numPredict, temperature: samplingTemperature}
    };
    if (format !== undefined) payload.format = format;

    const controller = new AbortController();
    let timer, status, timedOut = false;
    const expire = new Promise((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new OllamaError('AI_TIMEOUT'));
      }, timeout);
    });
    const operation = (async () => {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: 'error'
      });
      status = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : undefined;
      // Error bodies can contain student text or internal paths. Do not read them.
      if (!response.ok) {
        controller.abort();
        throw new OllamaError(classifyHTTP(status));
      }
      let data;
      try { data = await response.json(); } catch (error) {
        if (timedOut || error?.name === 'AbortError' || error?.name === 'TimeoutError') throw new OllamaError('AI_TIMEOUT');
        throw new OllamaError('AI_INVALID_RESPONSE');
      }
      if (!data || typeof data !== 'object' || Array.isArray(data) || data.error ||
          data.done !== true || data.message?.role !== 'assistant' || typeof data.message?.content !== 'string') {
        throw new OllamaError('AI_INVALID_RESPONSE');
      }
      if (data.done_reason === 'length') throw new OllamaError('AI_LOCAL_INCOMPLETE');
      const reply = data.message.content.trim();
      // Some old runtimes put reasoning in content despite think:false. Fail closed.
      if (!reply || reply.length > 16000 || /<\/?think\b/i.test(reply)) throw new OllamaError('AI_INVALID_RESPONSE');
      return reply;
    })();
    try {
      return await Promise.race([operation, expire]);
    } catch (error) {
      const known = error instanceof OllamaError ? error : new OllamaError(
        timedOut || error?.name === 'AbortError' || error?.name === 'TimeoutError' ? 'AI_TIMEOUT' : 'AI_LOCAL_UNAVAILABLE'
      );
      const diagnostic = {endpoint: 'ollama/chat', category: known.code};
      if (status !== undefined) diagnostic.status = status;
      try { logger(diagnostic); } catch {}
      throw known;
    } finally {
      clearTimeout(timer);
    }
  };
}
