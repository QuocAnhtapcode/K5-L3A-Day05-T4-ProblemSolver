import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const baseUrl = 'http://127.0.0.1:4173';

async function recordLiveBonus() {
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenarioId: 'changed-description',
      mode: 'live',
      message: 'Lúc đặt mô tả ghi 6 lít, giờ shop sửa thành 5 lít. Tôi nhận nồi 5 lít; bước tiếp theo là gì?',
    }),
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok) {
    console.error('Chưa ghi nhận bonus AI thật:', result.message || result.error || `HTTP ${response.status}`);
    process.exitCode = 1;
    return;
  }
  if (result.mode !== 'live' || result.trace?.mode !== 'live' || !result.trace?.responseId) {
    throw new Error('Kết quả thiếu response ID của nhà cung cấp; không ghi bằng chứng AI thật.');
  }
  const evidenceDirectory = fileURLToPath(new URL('./evidence/', import.meta.url));
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(new URL('./evidence/live-bonus.json', import.meta.url), JSON.stringify({
    recordedAt: new Date().toISOString(),
    purpose: 'LAB5 T4: real AI compares complaint against purchase-time description',
    dataType: 'synthetic_fixture_only',
    scenarioId: 'changed-description',
    ...result,
  }, null, 2), 'utf8');
  console.log('Đã lưu evidence/live-bonus.json');
  console.log(`Model: ${result.trace.model}; response ID: ${result.trace.responseId}`);
}

recordLiveBonus().catch((error) => {
  console.error('Không ghi được bằng chứng:', error.message);
  process.exitCode = 1;
});
