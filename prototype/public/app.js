const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
const state = { scenarios: [], scenario: null, caseState: null, analysis: null, trace: null, health: null, busy: false, activeView: 'buyer', requestVersion: 0 };
const statusLabels = { open: 'Hồ sơ đang mở', evidence_requested: 'Đang xin bằng chứng', escalated: 'Đã chuyển nhân viên', refund_approved: 'Đã duyệt hoàn · mô phỏng', claim_rejected: 'Đã duyệt từ chối · mô phỏng' };
const decisionLabels = { yeu_cau_bang_chung: 'Cần thêm căn cứ', escalate: 'Cần người có thẩm quyền xem xét', guide_claim: 'Có thể hướng dẫn gửi yêu cầu' };

async function requestJson(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  let payload;
  try { payload = await response.json(); } catch { throw new Error('Máy chủ chưa trả về dữ liệu hợp lệ. Hãy thử lại.'); }
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error?.message || payload.message || `Không hoàn tất yêu cầu (${response.status}).`);
  }
  return payload;
}

function postJson(path, body) {
  return requestJson(path, { method: 'POST', body: JSON.stringify(body) });
}

function setText(id, value) {
  elements[id].textContent = value ?? '—';
}

function setNotice(message, isError = false) {
  elements.notice.textContent = message;
  elements.notice.classList.toggle('error', isError);
  elements.notice.hidden = !message;
}

function renderList(id, items, emptyMessage = 'Chưa có bằng chứng được ghi nhận.') {
  const list = elements[id];
  list.replaceChildren();
  for (const value of items?.length ? items : [emptyMessage]) {
    const item = document.createElement('li');
    item.textContent = typeof value === 'string' ? value : value.detail || value.source || '';
    list.append(item);
  }
}

function formatDate(value) {
  if (!value) return 'Chưa có mốc thời gian';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value);
  return `${new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(date)} (UTC+7)`;
}

function formatMoney(value) {
  return Number.isFinite(Number(value)) ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value) : String(value || 'Chưa xác định');
}

function renderRemainingTime(scenario) {
  const time = scenario.simulatedNow || scenario.demoNow;
  if (!time || !scenario.claimDeadline) {
    setText('remaining-time', 'Thời hạn minh họa; không dùng đồng hồ hiện tại để tính.');
    return;
  }
  const remaining = new Date(scenario.claimDeadline).valueOf() - new Date(time).valueOf();
  if (!Number.isFinite(remaining)) { setText('remaining-time', 'Chưa đủ dữ liệu để tính thời gian còn lại.'); return; }
  const minutes = Math.max(0, Math.floor(remaining / 60000));
  setText('remaining-time', remaining <= 0 ? 'Đã tới hạn theo đồng hồ mô phỏng.' : `Còn ${Math.floor(minutes / 60)} giờ ${minutes % 60} phút · tính tại ${formatDate(time)}.`);
}

function renderScenario() {
  const scenario = state.scenario;
  if (!scenario) return;
  setText('buyer-order-id', `ĐƠN DỰNG / ${scenario.orderId}`);
  setText('buyer-product', scenario.product);
  setText('buyer-amount', formatMoney(scenario.amount));
  setText('buyer-message-preview', scenario.buyerMessage);
  elements['complaint-input'].value = scenario.buyerMessage;
  setText('original-description', scenario.originalDescription || 'Không có bản mô tả lúc đặt trong hồ sơ.');
  setText('original-timestamp', scenario.originalDescription ? `Lưu lúc: ${formatDate(scenario.originalCapturedAt)}` : 'Nguồn ưu tiên đang thiếu — không thay bằng mô tả hiện tại.');
  elements['original-description'].closest('.source-block').classList.toggle('missing-source', !scenario.originalDescription);
  setText('current-description', scenario.currentDescription || 'Chưa có dữ liệu mô tả hiện tại.');
  setText('current-timestamp', `Cập nhật: ${formatDate(scenario.updatedAt)}`);
  renderList('buyer-evidence', scenario.buyerEvidence);
  setText('claim-deadline', formatDate(scenario.claimDeadline));
  setText('buyer-seller-deadline', formatDate(scenario.sellerDeadline));
  setText('reviewer-deadline', formatDate(scenario.reviewerDeadline));
  setText('seller-deadline', `Hạn phản hồi: ${formatDate(scenario.sellerDeadline)}`);
  setText('policy-note', scenario.policyNote || 'Các mốc do nhóm tự dựng, không phải chính sách Shopee.');
  renderRemainingTime(scenario);
  setText('case-order-id', `HỒ SƠ DỰNG / ${scenario.orderId}`);
  setText('case-product', scenario.product);
  setText('case-buyer-message', scenario.buyerMessage);
  renderList('case-buyer-evidence', scenario.buyerEvidence);
  setText('case-original-description', scenario.originalDescription || 'Thiếu bản mô tả lúc đặt — chưa thể ra quyết định tiền.');
  setText('case-original-time', scenario.originalDescription ? formatDate(scenario.originalCapturedAt) : 'Phải bổ sung nguồn trước khi nhân viên quyết.');
  renderList('seller-evidence', scenario.sellerEvidence, 'Người bán chưa gửi bằng chứng bổ sung.');
  elements['seller-response'].value = state.caseState?.sellerResponse || scenario.sellerResponse || '';
  elements['review-reason'].value = '';
  elements['review-confirm'].checked = false;
  elements['analysis-result'].hidden = true;
  elements['live-receipt'].hidden = true;
  setText('case-analysis-summary', 'Phân tích khiếu nại để xác định phần đã có căn cứ và bước tiếp theo.');
  setText('ai-seller-message', 'Người mua phản ánh hàng không đúng mô tả. Vui lòng đối chiếu bản lúc đặt và gửi căn cứ cho phần đang tranh chấp; chưa có phán quyết.');
  renderCaseState();
}

function renderAnalysis() {
  const analysis = state.analysis;
  if (!analysis) return;
  elements['analysis-result'].hidden = false;
  setText('ai-buyer-message', analysis.messageToBuyer);
  setText('decision-label', decisionLabels[analysis.decision] || 'Chưa đủ căn cứ để quyết định');
  setText('analysis-reason', analysis.reason);
  renderList('missing-evidence', analysis.missingEvidence, 'Chưa ghi nhận phần thiếu; nhân viên vẫn cần kiểm tra trước tác động tiền.');
  setText('case-analysis-summary', analysis.summary);
  setText('ai-seller-message', analysis.messageToSeller);
  const isLive = state.trace?.mode === 'live';
  setText('analysis-mode-badge', isLive ? 'AI thật' : 'Mô phỏng');
  setText('response-mode-label', isLive ? 'Phản hồi từ API thật' : 'Kịch bản mô phỏng · không gọi AI');
  elements['analysis-mode-badge'].classList.toggle('live', isLive);
  elements['live-receipt'].hidden = !isLive;
  if (isLive) setText('live-receipt-text', `API thật · ${state.trace.model} · response ${state.trace.responseId} · ${formatDate(state.trace.createdAt)}. Xuất log ở thanh demo để lưu bằng chứng bonus.`);
}

function renderCaseState() {
  const caseState = state.caseState;
  if (!caseState) return;
  const completed = Boolean(caseState.decision);
  setText('case-status', statusLabels[caseState.status] || caseState.status);
  elements['case-status'].classList.toggle('waiting', caseState.status === 'escalated' || caseState.status === 'evidence_requested');
  elements['case-status'].classList.toggle('resolved', completed);
  setText('seller-response-status', caseState.sellerResponded ? 'Đã phản hồi' : 'Chờ phản hồi');
  elements['seller-response-status'].classList.toggle('waiting', !caseState.sellerResponded);
  elements['rut-chuyen-truong-nhom'].hidden = !caseState.escalationReversible || completed;
  elements['chuyen-truong-nhom'].disabled = state.busy || Boolean(caseState.escalated) || completed;
  elements['yeu-cau-bang-chung'].disabled = state.busy || completed;
  elements['send-seller-response'].disabled = state.busy || completed;
  if (caseState.escalated) setText('action-state-note', `Hồ sơ đã chuyển nhân viên · có thể rút khi chưa tiếp nhận. Cập nhật mô phỏng trước ${formatDate(state.scenario?.reviewerDeadline)}; chưa có quyết định tiền.`);
  else if (completed) setText('action-state-note', 'Quyết định đã được nhân viên xác nhận trong bản mô phỏng. Không có giao dịch tiền thật.');
  else if (caseState.status === 'evidence_requested') setText('action-state-note', 'Mẫu xin bằng chứng đã gửi trong mô phỏng. Tin đã gửi không thể xoá; có thể gửi nội dung đính chính.');
  else setText('action-state-note', 'Thông báo và thao tác nghiệp vụ trong prototype đều được mô phỏng.');
  const requirements = [
    { done: Boolean(state.scenario?.originalDescription && state.scenario?.originalCapturedAt), text: 'Có bản mô tả lúc đặt kèm thời điểm để đối chiếu' },
    { done: Boolean(caseState.buyerResponded), text: 'Có lời trình bày của người mua' },
    { done: Boolean(caseState.sellerResponded), text: 'Người bán đã có cơ hội và gửi phản hồi' },
    { done: !completed, text: completed ? 'Hồ sơ đã có quyết định; không thực thi lại' : 'Chưa có quyết định tiền trước đó' },
  ];
  elements['review-checklist'].replaceChildren(...requirements.map(requirement => {
    const item = document.createElement('li'); item.textContent = requirement.text; item.classList.toggle('done', requirement.done); return item;
  }));
  const history = [...(caseState.history || [])].reverse();
  elements['case-history'].replaceChildren(...(history.length ? history.map(event => {
    const item = document.createElement('li'); const time = document.createElement('time'); time.textContent = formatDate(event.at); time.dateTime = event.at || ''; const message = document.createElement('p'); message.textContent = event.message || event.action; item.append(time, message); return item;
  }) : [Object.assign(document.createElement('li'), { textContent: 'Chưa có thao tác nghiệp vụ. Hồ sơ đang chờ xử lý.', className: 'history-empty' })]));
  updateReviewGate();
}

function updateReviewGate() {
  const caseState = state.caseState;
  const hasSnapshot = Boolean(state.scenario?.originalDescription && state.scenario?.originalCapturedAt);
  const hasBothSides = Boolean(caseState?.buyerResponded && caseState?.sellerResponded);
  const hasReason = elements['review-reason'].value.trim().length >= 10;
  const confirmed = elements['review-confirm'].checked;
  const permitted = hasSnapshot && hasBothSides && hasReason && confirmed && !caseState?.decision && !state.busy;
  elements['soan-hoan-tien'].disabled = !permitted;
  elements['tu-choi-khieu-nai'].disabled = !permitted;
  let note = 'Có thể duyệt sau khi tự kiểm tra căn cứ. Prototype chỉ mô phỏng tiền.';
  if (caseState?.decision) note = 'Hồ sơ đã được quyết định. Nút thực thi lại bị khoá.';
  else if (!hasSnapshot) note = 'Đang chặn quyết định: thiếu bản mô tả lúc đặt. Chuyển nhân viên để lấy nguồn.';
  else if (!hasBothSides) note = 'Đang chặn quyết định: chưa có phản hồi đủ hai bên. Không xem im lặng là tự động thua.';
  else if (!hasReason || !confirmed) note = 'Nhân viên phải ghi căn cứ (ít nhất 10 ký tự) và xác nhận tác động trước khi duyệt.';
  setText('review-gate-note', note);
}

function setBusy(busy) {
  state.busy = busy;
  elements['analyze-claim'].disabled = busy;
  elements['scenario-select'].disabled = busy;
  elements['mode-select'].disabled = busy;
  elements['analysis-loading'].hidden = !busy;
  setText('analyze-claim', busy ? 'Đang đối chiếu…' : 'Phân tích khiếu nại ↗');
  renderCaseState();
}

function switchView(view) {
  state.activeView = view;
  for (const name of ['buyer', 'case']) {
    const active = name === view;
    elements[`${name}-view`].hidden = !active;
    elements[`${name}-tab`].classList.toggle('active', active);
    elements[`${name}-tab`].setAttribute('aria-selected', String(active));
  }
}

async function loadScenario(scenarioId, analyze = true) {
  const version = ++state.requestVersion;
  setNotice('');
  state.scenario = state.scenarios.find(scenario => scenario.id === scenarioId) || state.scenarios[0];
  state.analysis = null; state.trace = null; state.caseState = null;
  if (!state.scenario) throw new Error('Chưa có dữ liệu tình huống.');
  elements['scenario-select'].value = state.scenario.id;
  const payload = await requestJson(`/api/case?scenarioId=${encodeURIComponent(state.scenario.id)}`);
  if (version !== state.requestVersion) return;
  state.caseState = payload.state;
  renderScenario();
  if (analyze) await analyzeClaim();
}

async function analyzeClaim() {
  if (!state.scenario || state.busy) return;
  const mode = elements['mode-select'].value;
  if (mode === 'live' && !state.health?.aiConfigured) { setNotice('Chưa cấu hình OPENAI_API_KEY trên server. Chọn mô phỏng để thử UX; mô phỏng không được tính bonus AI thật.', true); return; }
  const message = elements['complaint-input'].value.trim();
  if (!message) { setNotice('Hãy cho biết bạn muốn đối chiếu phần nào của đơn hàng.', true); elements['complaint-input'].focus(); return; }
  setBusy(true); setNotice('');
  try {
    const payload = await postJson('/api/analyze', { scenarioId: state.scenario.id, message, mode });
    state.analysis = payload.analysis;
    elements['review-confirm'].checked = false;
    state.trace = payload.trace || { mode: payload.mode || mode };
    setText('buyer-message-preview', message);
    setText('case-buyer-message', message);
    renderAnalysis();
    if (payload.state) state.caseState = payload.state;
    if (payload.policyActions?.some(item => item.action === 'chuyen_truong_nhom')) {
      setNotice('Hồ sơ đã tự chuyển nhân viên theo quy tắc nguồn bằng chứng. Có thể rút chuyển khi chưa tiếp nhận; AI chưa quyết định tiền.');
    } else if (payload.policyActions?.some(item => item.action === 'yeu_cau_bang_chung')) {
      setNotice('Đã tự gửi mẫu xin phần bằng chứng còn thiếu trong bản mô phỏng. Mẫu trung lập không đưa ra phán quyết tiền.');
    }
    renderCaseState();
    await refreshEvidenceCount();
  } catch (error) { setNotice(error.message, true); }
  finally { setBusy(false); }
}

async function runAction(action) {
  if (!state.scenario || state.busy) return;
  const financial = action === 'soan_hoan_tien' || action === 'tu_choi_khieu_nai';
  const body = { scenarioId: state.scenario.id, action, actor: financial ? 'reviewer' : 'buyer' };
  if (financial) { body.approved = elements['review-confirm'].checked; body.reason = elements['review-reason'].value.trim(); }
  setBusy(true); setNotice('');
  try {
    const payload = await postJson('/api/action', body);
    state.caseState = payload.state;
    renderCaseState();
    setNotice(payload.message || 'Đã cập nhật hồ sơ mô phỏng.');
    if (financial) { elements['review-confirm'].checked = false; updateReviewGate(); }
  } catch (error) { setNotice(error.message, true); }
  finally { setBusy(false); }
}

async function sendSellerResponse() {
  if (!state.scenario || state.busy) return;
  const response = elements['seller-response'].value.trim();
  if (!response) { setNotice('Cần ghi phản hồi của người bán trước khi gửi.', true); elements['seller-response'].focus(); return; }
  setBusy(true); setNotice('');
  try {
    const payload = await postJson('/api/seller-response', { scenarioId: state.scenario.id, response });
    state.caseState = payload.state;
    elements['review-confirm'].checked = false;
    renderCaseState();
    setNotice(payload.message || 'Đã ghi nhận phản hồi người bán trong hồ sơ mô phỏng.');
  } catch (error) { setNotice(error.message, true); }
  finally { setBusy(false); }
}

async function refreshEvidenceCount() {
  try {
    const payload = await requestJson('/api/evidence');
    const count = payload.traces?.length || 0;
    setText('trace-count', count);
    elements['export-evidence'].disabled = !count;
  } catch { elements['export-evidence'].disabled = true; }
}

async function exportEvidence() {
  try {
    const payload = await requestJson('/api/evidence');
    if (!payload.traces?.length) { setNotice('Chưa có lời gọi AI thật thành công để xuất. Log mô phỏng không được dùng làm bằng chứng bonus.', true); return; }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'live-ai-evidence.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Đã xuất bằng chứng API thật. Lưu file vào prototype/evidence/ trước khi nộp bài.');
  } catch (error) { setNotice(error.message, true); }
}

elements['buyer-tab'].addEventListener('click', () => switchView('buyer'));
elements['case-tab'].addEventListener('click', () => switchView('case'));
elements['analyze-claim'].addEventListener('click', analyzeClaim);
elements['scenario-select'].addEventListener('change', event => { switchView('buyer'); loadScenario(event.target.value).catch(error => setNotice(error.message, true)); });
elements['mode-select'].addEventListener('change', () => {
  if (elements['mode-select'].value === 'live' && !state.health?.aiConfigured) setNotice('Chế độ AI thật cần OPENAI_API_KEY trên server. Chưa có cấu hình; nút Phân tích sẽ không tạo lời gọi giả.', true);
  else setNotice(elements['mode-select'].value === 'live' ? 'Lần phân tích tiếp theo sẽ gọi API thật bằng dữ liệu dựng của hồ sơ.' : 'Đã chọn mô phỏng. Bấm Phân tích để nhận kết quả mô phỏng mới.');
});
elements['correct-claim'].addEventListener('click', () => { elements['complaint-input'].focus(); elements['complaint-input'].setSelectionRange(elements['complaint-input'].value.length, elements['complaint-input'].value.length); setNotice('Sửa hoặc bổ sung nội dung, rồi bấm Phân tích để trợ lý đối chiếu lại.'); });
elements['yeu-cau-bang-chung'].addEventListener('click', () => runAction('yeu_cau_bang_chung'));
elements['chuyen-truong-nhom'].addEventListener('click', () => runAction('chuyen_truong_nhom'));
elements['rut-chuyen-truong-nhom'].addEventListener('click', () => runAction('rut_chuyen_truong_nhom'));
elements['soan-hoan-tien'].addEventListener('click', () => runAction('soan_hoan_tien'));
elements['tu-choi-khieu-nai'].addEventListener('click', () => runAction('tu_choi_khieu_nai'));
elements['send-seller-response'].addEventListener('click', sendSellerResponse);
elements['review-reason'].addEventListener('input', updateReviewGate);
elements['review-confirm'].addEventListener('change', updateReviewGate);
elements['export-evidence'].addEventListener('click', exportEvidence);

async function initializeApp() {
  try {
    const [health, scenarioPayload] = await Promise.all([requestJson('/api/health'), requestJson('/api/scenarios')]);
    state.health = health; state.scenarios = scenarioPayload.scenarios || [];
    setText('connection-status', health.aiConfigured ? `Server sẵn sàng · AI thật đã cấu hình (${health.model}) · Thao tác tiền vẫn chỉ mô phỏng.` : 'Server sẵn sàng · Chưa cấu hình API key · Mô phỏng dùng được; bonus AI thật chưa xác nhận.');
    elements['scenario-select'].replaceChildren(...state.scenarios.map(scenario => { const option = document.createElement('option'); option.value = scenario.id; option.textContent = scenario.title; return option; }));
    await loadScenario(state.scenarios[0]?.id);
    await refreshEvidenceCount();
  } catch (error) { setNotice(`Không mở được prototype: ${error.message}`, true); setText('connection-status', 'Không kết nối được server. Mở prototype bằng npm start, không mở trực tiếp file HTML.'); }
}

initializeApp();
