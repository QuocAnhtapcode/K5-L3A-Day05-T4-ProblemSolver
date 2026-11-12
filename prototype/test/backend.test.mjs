import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server.mjs';
import { getScenario } from '../fixtures.mjs';
import { applyAction, createCaseState, DomainError, enforceAnalysisGuardrails, recordSellerResponse, simulateAnalysis } from '../domain.mjs';

const now = '2026-11-12T07:00:00.000Z';
const reason = 'Đã đối chiếu đơn, ảnh nhãn và phản hồi xác nhận gửi sai của shop.';

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof DomainError && error.code === code);
}

async function withServer(options, callback) {
  const evidenceDirectory = await mkdtemp(path.join(os.tmpdir(), 'problemsolver-test-'));
  const server = createApp({ apiKey: '', model: 'gpt-4o-mini', evidenceDirectory, now: () => now, ...options });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (endpoint, body) => {
    const response = await fetch(base + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, value: await response.json() };
  };
  try { await callback({ base, post, evidenceDirectory }); }
  finally { await new Promise((resolve) => server.close(resolve)); await rm(evidenceDirectory, { recursive: true, force: true }); }
}

test('a buyer cannot transfer money even when submitting approved=true', () => {
  const scenario = getScenario('normal-size');
  const state = createCaseState(scenario, now);
  expectCode(() => applyAction(state, scenario, { action: 'soan_hoan_tien', actor: 'buyer', approved: true, reason }, now), 'HUMAN_APPROVAL_REQUIRED');
  assert.equal(state.moneyMoved, false);
  assert.equal(state.decision, null);
});

test('a reviewer must explicitly approve, and a valid decision cannot execute twice', () => {
  const scenario = getScenario('normal-size');
  const state = createCaseState(scenario, now);
  expectCode(() => applyAction(state, scenario, { action: 'soan_hoan_tien', actor: 'reviewer', reason }, now), 'HUMAN_APPROVAL_REQUIRED');
  expectCode(() => applyAction(state, scenario, { action: 'soan_hoan_tien', actor: 'reviewer', approved: true, reason: '' }, now), 'REVIEW_REASON_REQUIRED');
  const result = applyAction(state, scenario, { action: 'soan_hoan_tien', actor: 'reviewer', approved: true, reason }, now);
  assert.equal(result.state.status, 'refund_approved');
  assert.equal(result.state.mocked, true);
  assert.match(result.message, /MÔ PHỎNG/);
  expectCode(() => applyAction(state, scenario, { action: 'soan_hoan_tien', actor: 'reviewer', approved: true, reason }, now), 'CASE_CLOSED');
});

test('a decision waits for both sides rather than treating silence as losing', () => {
  const scenario = getScenario('changed-description');
  const state = createCaseState(scenario, now);
  expectCode(() => applyAction(state, scenario, { action: 'tu_choi_khieu_nai', actor: 'reviewer', approved: true, reason }, now), 'BOTH_SIDES_REQUIRED');
  assert.equal(state.status, 'open');
  recordSellerResponse(state, 'Shop bổ sung phản hồi mô phỏng và đồng ý đối chiếu bản lưu.', now);
  assert.equal(state.sellerResponded, true);
  const result = applyAction(state, scenario, { action: 'soan_hoan_tien', actor: 'reviewer', approved: true, reason }, now);
  assert.equal(result.state.status, 'refund_approved');
});

test('seller punishment is forbidden for every simulated role', () => {
  const scenario = getScenario('seller-correct');
  for (const actor of ['buyer', 'seller', 'reviewer']) {
    const state = createCaseState(scenario, now);
    expectCode(() => applyAction(state, scenario, { action: 'phat_shop', actor, approved: true, reason }, now), 'ACTION_FORBIDDEN');
    assert.equal(state.history.length, 0);
  }
});

test('missing purchase snapshot cannot become a rejection even after human approval', () => {
  const scenario = getScenario('missing-snapshot');
  const state = createCaseState(scenario, now);
  recordSellerResponse(state, 'Shop chưa có bản lưu mô tả lúc đặt, cần nhân viên tìm bổ sung.', now);
  for (const action of ['tu_choi_khieu_nai', 'soan_hoan_tien']) expectCode(() => applyAction(state, scenario, { action, actor: 'reviewer', approved: true, reason }, now), 'MISSING_PURCHASE_SNAPSHOT');
  const original = simulateAnalysis(getScenario('normal-size'), 'Hướng dẫn giúp tôi', createCaseState(getScenario('normal-size'), now));
  original.evidence.push({ source: 'originalDescription', detail: 'Nguồn gốc không tồn tại trong ca thiếu snapshot.' });
  const guarded = enforceAnalysisGuardrails(original, scenario);
  assert.equal(guarded.analysis.decision, 'escalate');
  assert.ok(guarded.analysis.evidence.every((item) => !['originalDescription', 'originalCapturedAt'].includes(item.source)));
  assert.deepEqual(guarded.guardrailsApplied, ['missing_purchase_snapshot']);
});

test('escalation can be withdrawn without deleting the complaint or its evidence', () => {
  const scenario = getScenario('changed-description');
  const state = createCaseState(scenario, now);
  applyAction(state, scenario, { action: 'chuyen_truong_nhom', actor: 'buyer' }, now);
  assert.equal(state.escalationReversible, true);
  applyAction(state, scenario, { action: 'rut_chuyen_truong_nhom', actor: 'buyer' }, now);
  assert.equal(state.status, 'open');
  assert.equal(state.moneyMoved, false);
  assert.equal(state.history.length, 2);
});

test('changed-description guard uses an existing snapshot instead of asking for it again', () => {
  const scenario = getScenario('changed-description');
  const state = createCaseState(scenario, now);
  const recommendation = simulateAnalysis(scenario, scenario.buyerMessage, state);
  recommendation.decision = 'yeu_cau_bang_chung';
  recommendation.missingEvidence = ['Bản lưu mô tả sản phẩm tại thời điểm đặt hàng', 'Ảnh người mua đã gửi'];
  recommendation.messageToBuyer = 'Bạn hãy gửi lại bản mô tả lúc mua và ảnh đã gửi.';
  const result = enforceAnalysisGuardrails(recommendation, scenario);
  assert.equal(result.analysis.decision, 'escalate');
  assert.deepEqual(result.guardrailsApplied, ['purchase_description_changed']);
  assert.deepEqual(result.analysis.missingEvidence, ['Phản hồi của người bán về khác biệt giữa mô tả lúc đặt và mô tả hiện tại.']);
  assert.match(result.analysis.messageToBuyer, /không cần gửi lại/);
  assert.ok(result.analysis.messageToBuyer.includes(scenario.originalDescription));
  assert.ok(result.analysis.messageToBuyer.includes(scenario.currentDescription));
  assert.equal(result.analysis.evidence.filter((item) => item.source === 'originalDescription').length, 1);
  const afterSellerResponse = enforceAnalysisGuardrails(recommendation, { ...scenario, sellerResponse: 'Shop đã bổ sung giải thích mô phỏng.' });
  assert.deepEqual(afterSellerResponse.analysis.missingEvidence, []);
});

test('live mode without a server key fails clearly and cannot claim bonus evidence', async () => {
  await withServer({}, async ({ base, post }) => {
    const result = await post('/api/analyze', { scenarioId: 'normal-size', mode: 'live' });
    assert.equal(result.status, 503);
    assert.equal(result.value.error.code, 'AI_NOT_CONFIGURED');
    const evidence = await fetch(base + '/api/evidence').then((response) => response.json());
    assert.deepEqual(evidence.traces, []);
  });
});

test('simulation is labelled, never calls AI, and writes no live trace', async () => {
  let called = false;
  await withServer({ apiKey: 'test-key', fetchImpl: async () => { called = true; throw new Error('must not call'); } }, async ({ base, post, evidenceDirectory }) => {
    const result = await post('/api/analyze', { scenarioId: 'changed-description', mode: 'simulation' });
    assert.equal(result.status, 200);
    assert.equal(result.value.mode, 'simulation');
    assert.equal(result.value.trace.model, null);
    assert.equal(result.value.trace.responseId, null);
    assert.equal(called, false);
    assert.equal(result.value.state.escalated, true);
    assert.equal(result.value.state.escalationReversible, true);
    assert.equal(result.value.state.history.at(-1).actor, 'system');
    assert.equal(result.value.state.moneyMoved, false);
    assert.equal(result.value.policyActions[0].reason, 'purchase_description_changed');
    const evidence = await fetch(base + '/api/evidence').then((response) => response.json());
    assert.deepEqual(evidence.traces, []);
    await assert.rejects(readFile(path.join(evidenceDirectory, 'live-traces.jsonl')), { code: 'ENOENT' });
  });
});

test('live Responses request uses strict JSON schema and store:false; only successful live results persist', async () => {
  const scenario = getScenario('normal-size');
  const analysis = simulateAnalysis(scenario, scenario.buyerMessage, createCaseState(scenario, now));
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ id: 'resp_test_fixture', status: 'completed', model: 'gpt-4o-mini-test', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(analysis) }] }], usage: { input_tokens: 120, output_tokens: 180 } }), { status: 200, headers: { 'x-request-id': 'req_test_fixture' } });
  };
  await withServer({ apiKey: 'unit-test-secret', fetchImpl }, async ({ base, post, evidenceDirectory }) => {
    const result = await post('/api/analyze', { scenarioId: 'normal-size', mode: 'live' });
    assert.equal(result.status, 200);
    assert.equal(captured.url, 'https://api.openai.com/v1/responses');
    assert.equal(captured.body.model, 'gpt-4o-mini');
    assert.equal(captured.body.store, false);
    assert.equal(captured.body.text.format.type, 'json_schema');
    assert.equal(captured.body.text.format.strict, true);
    assert.equal(captured.body.text.format.schema.additionalProperties, false);
    assert.equal(captured.init.headers.Authorization, 'Bearer unit-test-secret');
    assert.equal(result.value.trace.responseId, 'resp_test_fixture');
    assert.equal(result.value.trace.mode, 'live');
    assert.equal(result.value.trace.aiRecommendation, 'guide_claim');
    assert.equal(result.value.state.moneyMoved, false);
    assert.deepEqual(result.value.policyActions, []);
    const evidence = await fetch(base + '/api/evidence').then((response) => response.json());
    assert.equal(evidence.traces.length, 1);
    assert.equal(evidence.traces[0].requestId, 'req_test_fixture');
    assert.ok(!JSON.stringify(evidence).includes('unit-test-secret'));
    const stored = await readFile(path.join(evidenceDirectory, 'live-traces.jsonl'), 'utf8');
    assert.ok(stored.includes('resp_test_fixture'));
    assert.ok(!stored.includes('unit-test-secret'));
  });
});

test('provider errors do not leak raw error details or write fake live evidence', async () => {
  await withServer({ apiKey: 'unit-test-secret', fetchImpl: async () => new Response('raw error unit-test-secret', { status: 401 }) }, async ({ base, post }) => {
    const result = await post('/api/analyze', { scenarioId: 'normal-size', mode: 'live' });
    assert.equal(result.status, 502);
    assert.equal(result.value.error.code, 'AI_PROVIDER_ERROR');
    assert.ok(!JSON.stringify(result.value).includes('unit-test-secret'));
    assert.ok(!JSON.stringify(result.value).includes('raw error'));
    assert.deepEqual((await fetch(base + '/api/evidence').then((response) => response.json())).traces, []);
  });
});

test('missing-snapshot policy overrides an unsafe model recommendation without executing money actions', async () => {
  const scenario = getScenario('normal-size');
  const analysis = simulateAnalysis(scenario, scenario.buyerMessage, createCaseState(scenario, now));
  await withServer({ apiKey: 'unit-test-secret', fetchImpl: async () => new Response(JSON.stringify({ id: 'resp_missing_snapshot_test', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(analysis) }] }] }), { status: 200 }) }, async ({ post }) => {
    const result = await post('/api/analyze', { scenarioId: 'missing-snapshot', mode: 'live' });
    assert.equal(result.status, 200);
    assert.equal(result.value.analysis.decision, 'escalate');
    assert.equal(result.value.trace.aiRecommendation, 'guide_claim');
    assert.deepEqual(result.value.trace.guardrailsApplied, ['missing_purchase_snapshot']);
    assert.equal(result.value.state.moneyMoved, false);
    assert.equal(result.value.state.escalated, true);
  });
});

test('API rejects cross-origin mutations, oversize input, unknown modes and dotfiles', async () => {
  await withServer({}, async ({ base, post }) => {
    const origin = await fetch(base + '/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' }, body: '{}' });
    assert.equal(origin.status, 403);
    const oversized = await post('/api/analyze', { scenarioId: 'normal-size', mode: 'simulation', message: 'x'.repeat(17000) });
    assert.equal(oversized.status, 413);
    const mode = await post('/api/analyze', { scenarioId: 'normal-size', mode: 'pretend-live' });
    assert.equal(mode.value.error.code, 'INVALID_MODE');
    const dotfile = await fetch(base + '/.env');
    assert.equal(dotfile.status, 403);
    const traversal = await fetch(base + '/%2e%2e%5c.env');
    assert.equal(traversal.status, 403);
  });
});
