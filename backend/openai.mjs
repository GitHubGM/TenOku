// Provider errors must never expose response bodies, credentials, or student text.
const endpoints = new Set(['responses', 'moderations']);
const quotaCodes = new Set([
  'insufficient_quota', 'credit_balance_exhausted', 'billing_hard_limit_reached',
  'organization_spend_limit_exceeded', 'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded'
]);
const providerCodes = new Set([
  ...quotaCodes, 'invalid_api_key', 'rate_limit_exceeded', 'model_not_found',
  'unsupported_parameter', 'unsupported_value', 'invalid_parameter',
  'invalid_request_error', 'permission_denied', 'insufficient_permissions',
  'content_policy_violation', 'server_error', 'engine_overloaded'
]);
const networkCodes = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
  'EHOSTUNREACH', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'CERT_HAS_EXPIRED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN', 'ERR_TLS_CERT_ALTNAME_INVALID',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'
]);
const errors = {
  AI_NOT_CONFIGURED: [503, 'The AI assistant is not configured yet.'],
  AI_AUTH_FAILED: [502, 'OpenAI rejected API authentication. Ask the administrator to check the API key, project permissions, and IP restrictions.'],
  AI_QUOTA_EXCEEDED: [503, 'The OpenAI API credit or project spending limit has been reached. Ask the administrator to check API billing and limits.'],
  AI_RATE_LIMITED: [503, 'OpenAI is limiting requests. Please wait briefly and try again.'],
  AI_ACCESS_DENIED: [502, 'OpenAI denied access. Ask the administrator to check project permissions and access restrictions.'],
  AI_MODEL_UNAVAILABLE: [502, 'The configured OpenAI model is unavailable for this project. Ask the administrator to check the model setting and access.'],
  AI_BAD_REQUEST: [502, 'OpenAI rejected the request configuration. Ask the administrator to check the model and supported request settings.'],
  AI_TIMEOUT: [504, 'The OpenAI request timed out. Please try again shortly.'],
  AI_CONNECTION_FAILED: [502, 'The server could not connect securely to OpenAI. Ask the administrator to check network, DNS, and TLS connectivity.'],
  AI_UNAVAILABLE: [502, 'OpenAI is temporarily unavailable. Please try again later.'],
  AI_INVALID_RESPONSE: [502, 'OpenAI returned an invalid response. Please try again later.']
};

export class OpenAIError extends Error {
  constructor(code) {
    const knownCode = Object.hasOwn(errors, code) ? code : 'AI_UNAVAILABLE';
    const [appStatus, message] = errors[knownCode];
    super(message);
    this.name = 'OpenAIError';
    this.appStatus = appStatus;
    this.code = knownCode;
  }
}

function classifyHTTP(status, providerCode, providerType) {
  if (status === 401) return 'AI_AUTH_FAILED';
  if (status === 429) return quotaCodes.has(providerCode) || providerType === 'insufficient_quota' ? 'AI_QUOTA_EXCEEDED' : 'AI_RATE_LIMITED';
  if (status === 403) return 'AI_ACCESS_DENIED';
  if (status >= 500) return 'AI_UNAVAILABLE';
  if (status === 404 || providerCode === 'model_not_found') return 'AI_MODEL_UNAVAILABLE';
  if (status === 400 || status === 422) return 'AI_BAD_REQUEST';
  if (status === 408) return 'AI_TIMEOUT';
  return 'AI_UNAVAILABLE';
}

function safeNetworkCode(error) {
  const candidates = [error?.code, error?.cause?.code];
  // Node's connection races may report individual failures inside AggregateError.
  if (Array.isArray(error?.cause?.errors)) candidates.push(...error.cause.errors.slice(0, 8).map(e => e?.code));
  return candidates.find(code => networkCodes.has(code));
}

export function createOpenAIClient({apiKey, fetchImpl = globalThis.fetch, logger = console.warn, timeoutMs = 30000} = {}) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000;
  return async function request(path, payload) {
    if (!endpoints.has(path)) throw new OpenAIError('AI_BAD_REQUEST');
    if (!key) throw new OpenAIError('AI_NOT_CONFIGURED');
    const controller = new AbortController();
    let timer, status, requestId, providerCode, timedOut = false;
    const expire = new Promise((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new OpenAIError('AI_TIMEOUT'));
      }, timeout);
    });
    const operation = (async () => {
      const response = await fetchImpl(`https://api.openai.com/v1/${path}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${key}`},
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: 'error'
      });
      status = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : undefined;
      const id = response.headers?.get?.('x-request-id');
      if (typeof id === 'string' && /^req_[a-zA-Z0-9_-]{1,96}$/.test(id)) requestId = id;
      let data, parseError;
      try { data = await response.json(); } catch (error) { parseError = error; }
      const upstreamCode = data?.error?.code;
      if (providerCodes.has(upstreamCode)) providerCode = upstreamCode;
      if (!response.ok) throw new OpenAIError(classifyHTTP(status, upstreamCode, data?.error?.type));
      if (parseError) {
        if (timedOut || parseError.name === 'AbortError' || parseError.name === 'TimeoutError') throw new OpenAIError('AI_TIMEOUT');
        if (safeNetworkCode(parseError)) throw parseError;
        throw new OpenAIError('AI_INVALID_RESPONSE');
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new OpenAIError('AI_INVALID_RESPONSE');
      return data;
    })();
    try {
      return await Promise.race([operation, expire]);
    } catch (error) {
      const networkCode = safeNetworkCode(error);
      const known = error instanceof OpenAIError ? error : new OpenAIError(
        timedOut || error?.name === 'AbortError' || error?.name === 'TimeoutError' ? 'AI_TIMEOUT' : 'AI_CONNECTION_FAILED'
      );
      const diagnostic = {endpoint: path, category: known.code};
      if (status !== undefined) diagnostic.status = status;
      if (providerCode) diagnostic.providerCode = providerCode;
      if (requestId) diagnostic.requestId = requestId;
      if (networkCode) diagnostic.networkCode = networkCode;
      // A failing log sink must not replace the safe, actionable client response.
      try { logger(diagnostic); } catch {}
      throw known;
    } finally {
      clearTimeout(timer);
    }
  };
}
