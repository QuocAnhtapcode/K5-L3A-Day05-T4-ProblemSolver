import http from 'node:http';
import { appendFile, mkdir, readFile, realpath, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { getScenario, scenarios } from './fixtures.mjs';
import { DomainError, applyAction, buildResponsesRequest, createCaseState, enforceAnalysisGuardrails, recordSellerResponse, simulateAnalysis, validateAnalysis } from './domain.mjs';

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 16 * 1024;
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function sendJson(response, status, value) {
  response.writeHead(status, JSON_HEADERS);
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new DomainError('JSON_REQUIRED', 'Hãy gửi dữ liệu JSON.', 415);
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new DomainError('REQUEST_TOO_LARGE', 'Dữ liệu gửi quá lớn.', 413);
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not object');
    return value;
  } catch {
    throw new DomainError('INVALID_JSON', 'Dữ liệu JSON không hợp lệ.');
  }
}

function redactSecrets(value, apiKey) {
  if (!apiKey) return value;
  return JSON.parse(JSON.stringify(value).split(apiKey).join('[REDACTED]'));
}

function getOutputText(result) {
  if (result.status !== 'completed' || !Array.isArray(result.output)) throw new DomainError('AI_INCOMPLETE', 'AI chưa hoàn tất phân tích. Hồ sơ vẫn mở; hãy thử lại hoặc chuyển nhân viên.', 502);
  const content = result.output.flatMap((item) => item.type === 'message' && Array.isArray(item.content) ? item.content : []);
  if (content.some((item) => item.type === 'refusal')) throw new DomainError('AI_REFUSED', 'AI không thể phân tích ca này. Bạn có thể chuyển nhân viên; chưa có quyết định tiền.', 502);
  const output = content.filter((item) => item.type === 'output_text').map((item) => item.text).join('');
  try { return validateAnalysis(JSON.parse(output)); } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('AI_INVALID_OUTPUT', 'AI chưa trả kết quả hợp lệ. Hồ sơ vẫn mở; bạn có thể chuyển nhân viên.', 502);
  }
}

export function createApp(options = {}) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? '';
  const model = options.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const publicDirectory = options.publicDirectory ?? path.join(projectDirectory, 'public');
  const evidenceDirectory = options.evidenceDirectory ?? path.join(projectDirectory, 'evidence');
  const now = options.now ?? (() => new Date().toISOString());
  const states = new Map(scenarios.map((scenario) => [scenario.id, createCaseState(scenario, now())]));
  const rateWindows = new Map();
  let activeLiveRequests = 0;

  function lookup(id) {
    const scenario = getScenario(id);
    if (!scenario) throw new DomainError('SCENARIO_NOT_FOUND', 'Không tìm thấy ca mô phỏng.', 404);
    return { scenario, state: states.get(id) };
  }

  function applyPolicy(scenario, state, analysis) {
    const policyActions = [];
    const missingSnapshot = !scenario.originalDescription || !scenario.originalCapturedAt;
    const changedDescription = scenario.originalDescription !== scenario.currentDescription
      && Date.parse(scenario.updatedAt) > Date.parse(scenario.originalCapturedAt);
    if ((missingSnapshot || changedDescription) && !state.escalated && !state.decision) {
      applyAction(state, scenario, { action: 'chuyen_truong_nhom', actor: 'reviewer' }, now());
      state.history.at(-1).actor = 'system';
      policyActions.push({ action: 'chuyen_truong_nhom', reason: missingSnapshot ? 'missing_purchase_snapshot' : 'purchase_description_changed' });
    } else if (!state.decision && analysis.decision === 'yeu_cau_bang_chung' && analysis.missingEvidence.length
      && !state.history.some((event) => event.action === 'yeu_cau_bang_chung')) {
      applyAction(state, scenario, { action: 'yeu_cau_bang_chung', actor: 'reviewer' }, now());
      state.history.at(-1).actor = 'system';
      policyActions.push({ action: 'yeu_cau_bang_chung', reason: 'missing_evidence_neutral_template_once' });
    }
    return policyActions;
  }

  const server = http.createServer(async (request, response) => {
    try {
      const host = request.headers.host ?? '';
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) throw new DomainError('INVALID_HOST', 'Chỉ dùng prototype qua địa chỉ local.', 403);
      if (request.headers.origin && ![`http://${host}`, `http://127.0.0.1:${server.address()?.port}`, `http://localhost:${server.address()?.port}`].includes(request.headers.origin)) {
        throw new DomainError('INVALID_ORIGIN', 'Yêu cầu phải đến từ prototype local.', 403);
      }
      let decodedPath;
      try { decodedPath = decodeURIComponent(request.url.split('?')[0]).replaceAll('\\', '/'); } catch { throw new DomainError('INVALID_PATH', 'Đường dẫn không hợp lệ.'); }
      if (decodedPath.split('/').some((part) => part.startsWith('.'))) throw new DomainError('PATH_FORBIDDEN', 'Không mở được đường dẫn này.', 403);
      const url = new URL(request.url, `http://${host}`);
      const key = `${request.socket.remoteAddress}:${url.pathname === '/api/analyze' ? 'analyze' : 'all'}`;
      const epoch = Date.now();
      let rate = rateWindows.get(key);
      if (!rate || epoch - rate.since > 60000) { rate = { since: epoch, count: 0 }; rateWindows.set(key, rate); }
      rate.count += 1;
      if (rate.count > (url.pathname === '/api/analyze' ? 12 : 240)) throw new DomainError('RATE_LIMITED', 'Bạn thao tác quá nhanh; vui lòng đợi một phút rồi thử lại.', 429);

      if (request.method === 'GET' && url.pathname === '/api/health') {
        return sendJson(response, 200, { aiConfigured: Boolean(apiKey.trim()), model });
      }
      if (request.method === 'GET' && url.pathname === '/api/scenarios') return sendJson(response, 200, { scenarios });
      if (request.method === 'GET' && url.pathname === '/api/case') return sendJson(response, 200, { state: lookup(url.searchParams.get('scenarioId')).state });
      if (request.method === 'GET' && url.pathname === '/api/evidence') {
        let traces = [];
        try {
          const data = await readFile(path.join(evidenceDirectory, 'live-traces.jsonl'), 'utf8');
          traces = data.split('\n').filter(Boolean).flatMap((line) => {
            try { const trace = JSON.parse(line); return trace.mode === 'live' && trace.responseId ? [trace] : []; } catch { return []; }
          });
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
        return sendJson(response, 200, redactSecrets({ traces, note: 'Chỉ chứa phân tích live thành công. Mô phỏng, lỗi và test không phải bằng chứng bonus.' }, apiKey));
      }
      if (request.method === 'POST' && url.pathname === '/api/seller-response') {
        const body = await readJson(request);
        const { state } = lookup(body.scenarioId);
        return sendJson(response, 200, recordSellerResponse(state, body.response, now()));
      }
      if (request.method === 'POST' && url.pathname === '/api/action') {
        const body = await readJson(request);
        const { scenario, state } = lookup(body.scenarioId);
        try { return sendJson(response, 200, applyAction(state, scenario, body, now())); }
        catch (error) { if (error instanceof DomainError) return sendJson(response, error.status, { ok: false, error: { code: error.code, message: error.message }, state }); throw error; }
      }
      if (request.method === 'POST' && url.pathname === '/api/analyze') {
        const body = await readJson(request);
        const { scenario, state } = lookup(body.scenarioId);
        if (!['live', 'simulation'].includes(body.mode)) throw new DomainError('INVALID_MODE', 'Chọn rõ chế độ live hoặc simulation.');
        const message = body.message ?? scenario.buyerMessage;
        if (typeof message !== 'string' || !message.trim() || message.length > 4000) throw new DomainError('INVALID_MESSAGE', 'Tin nhắn cần từ 1 đến 4.000 ký tự.');
        if (state.decision) throw new DomainError('CASE_CLOSED', 'Hồ sơ mô phỏng đã có quyết định. Hãy dùng ca khác hoặc khởi động lại để demo.', 409);
        const createdAt = now();
        const id = randomUUID();
        if (body.mode === 'simulation') {
          const analysis = simulateAnalysis(scenario, message.trim(), state);
          const policyActions = applyPolicy(scenario, state, analysis);
          return sendJson(response, 200, { mode: 'simulation', analysis, state, policyActions, trace: { id, mode: 'simulation', model: null, responseId: null, createdAt, scenarioId: scenario.id, aiRecommendation: analysis.decision, policyActions, note: 'Luật mô phỏng cục bộ; không gọi AI, không tính bonus.' } });
        }
        if (!apiKey.trim()) throw new DomainError('AI_NOT_CONFIGURED', 'Chưa cấu hình OPENAI_API_KEY trên server. Có thể dùng mô phỏng; mô phỏng không phải lời gọi AI thật.', 503);
        if (activeLiveRequests >= 2) throw new DomainError('AI_BUSY', 'Đang có hai lượt phân tích AI, vui lòng đợi.', 429);
        activeLiveRequests += 1;
        try {
          let provider;
          try {
            provider = await fetchImpl('https://api.openai.com/v1/responses', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify(buildResponsesRequest({ model, scenario, message: message.trim(), state })),
              signal: AbortSignal.timeout(options.aiTimeoutMs ?? 45000),
            });
          } catch {
            throw new DomainError('AI_CONNECTION_FAILED', 'Không kết nối được AI hoặc đã hết thời gian chờ. Hồ sơ vẫn mở; chưa có quyết định tiền.', 502);
          }
          if (!provider.ok) throw new DomainError('AI_PROVIDER_ERROR', 'Dịch vụ AI chưa xử lý được yêu cầu. Kiểm tra cấu hình hoặc thử lại sau; kết quả không được ghi là live thành công.', 502);
          let result;
          try {
            const text = await provider.text();
            if (text.length > 128000) throw new Error('too large');
            result = JSON.parse(text);
          } catch { throw new DomainError('AI_INVALID_OUTPUT', 'Dịch vụ AI trả dữ liệu chưa hợp lệ. Bạn có thể chuyển nhân viên.', 502); }
          if (typeof result.id !== 'string' || !result.id.startsWith('resp_')) throw new DomainError('AI_INVALID_OUTPUT', 'Thiếu mã phản hồi AI, chưa thể xác nhận lời gọi live thành công.', 502);
          const recommendation = getOutputText(result);
          const { analysis, guardrailsApplied } = enforceAnalysisGuardrails(recommendation, { ...scenario, sellerResponse: state.sellerResponse });
          const policyActions = applyPolicy(scenario, state, analysis);
          const trace = redactSecrets({ id, mode: 'live', model: result.model || model, responseId: result.id, createdAt, scenarioId: scenario.id,
            requestId: provider.headers?.get('x-request-id') ?? null, aiRecommendation: recommendation.decision, rawAnalysis: recommendation, guardrailsApplied, policyActions,
            input: { scenario, message: message.trim(), sellerResponse: state.sellerResponse }, analysis,
            usage: result.usage ?? null, source: 'openai_responses_api', mockedActions: true }, apiKey);
          try {
            await mkdir(evidenceDirectory, { recursive: true });
            await appendFile(path.join(evidenceDirectory, 'live-traces.jsonl'), `${JSON.stringify(trace)}\n`, 'utf8');
          } catch { throw new DomainError('EVIDENCE_WRITE_FAILED', 'AI đã phản hồi nhưng chưa lưu được bằng chứng bonus. Kiểm tra quyền thư mục evidence trước khi ghi nhận bonus.', 500); }
          return sendJson(response, 200, redactSecrets({ mode: 'live', analysis, state, policyActions, trace }, apiKey));
        } finally { activeLiveRequests -= 1; }
      }
      if (url.pathname.startsWith('/api/')) throw new DomainError('ENDPOINT_NOT_FOUND', 'Không tìm thấy API này.', 404);
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new DomainError('METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ.', 405);
      const requestedFile = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
      const rootPath = await realpath(publicDirectory);
      const candidate = path.resolve(rootPath, requestedFile);
      if (!candidate.startsWith(rootPath + path.sep)) throw new DomainError('PATH_FORBIDDEN', 'Không mở được đường dẫn này.', 403);
      const extension = path.extname(candidate).toLowerCase();
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
      if (!types[extension]) throw new DomainError('FILE_NOT_FOUND', 'Không tìm thấy tệp công khai.', 404);
      let canonical;
      try { canonical = await realpath(candidate); } catch { throw new DomainError('FILE_NOT_FOUND', 'Không tìm thấy tệp công khai.', 404); }
      if (!canonical.startsWith(rootPath + path.sep) || !(await stat(canonical)).isFile()) throw new DomainError('PATH_FORBIDDEN', 'Không mở được đường dẫn này.', 403);
      const data = await readFile(canonical);
      response.writeHead(200, { 'Content-Type': types[extension], 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (response.headersSent) return response.end();
      const known = error instanceof DomainError;
      sendJson(response, known ? error.status : 500, { ok: false, error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'Prototype gặp lỗi nội bộ; hồ sơ chưa có quyết định tiền mới.' } });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const environmentFile = path.join(projectDirectory, '.env');
  if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);
  const requestedPort = Number(process.env.PORT ?? 4173);
  const port = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort < 65536 ? requestedPort : 4173;
  const app = createApp();
  app.listen(port, '127.0.0.1', () => console.log(`ProblemSolver prototype: http://127.0.0.1:${port} | AI ${process.env.OPENAI_API_KEY?.trim() ? 'configured' : 'not configured'} | actions are fictional`));
}
