(async () => {
  'use strict';

  const VERSION = '1.0.1';
  const SCRIPT_KEY = '__MIEMIE_FUTURE_PLANNER_EXTERNAL__';
  const BUTTON_NAME = 'Miemie Future Planner';
  const STORAGE_KEY = 'miemie_future_planner_external_config_v1';
  const META_KEY = '__miemie_future_outline_v1';
  const EXT_PROMPT_ID = 'miemie_external_future_outline_v1';
  const UI_ID = 'mfp-external-ui-v1';

  // Tavern Helper scripts run in a background iframe. UI must be mounted into
  // SillyTavern's parent document, not the hidden script iframe document.
  const hostWindow = (() => {
    try { return window.parent && window.parent !== window ? window.parent : window; }
    catch (_) { return window; }
  })();
  const hostDocument = (() => {
    try { return hostWindow.document || document; }
    catch (_) { return document; }
  })();
  const hostStorage = (() => {
    try { return hostWindow.localStorage || localStorage; }
    catch (_) { return localStorage; }
  })();

  // Hot-reload safely when the script is re-imported/reloaded.
  try {
    if (window[SCRIPT_KEY]?.cleanup) await window[SCRIPT_KEY].cleanup();
  } catch (_) {}

  const PLANNER_SYSTEM = `Bạn là bộ lập đại cương tương lai kín cho một phiên nhập vai SillyTavern. Bạn KHÔNG viết chính văn, KHÔNG điều khiển <user>, KHÔNG khen <user>, KHÔNG tạo drama để giải trí. Nhiệm vụ duy nhất là duy trì một đại cương nhân quả ngắn để model kể chuyện chính bám theo.

QUY TẮC BẮT BUỘC:
1. Phân biệt hai loại tuyến:
- OBJECTIVE_LOCKED: sự kiện thế giới tồn tại độc lập với lựa chọn hiện tại của <user>; nếu dữ liệu nói lõi sự kiện là không thể tránh thì không được tự hủy nó. <user> chỉ có thể thay đổi phần mà thiết lập cho phép như thời điểm, hoàn cảnh, thiệt hại hoặc kết quả phụ.
- CONDITIONAL: sự kiện sinh từ hành động, quan hệ, xung đột hoặc điều kiện có thể thay đổi. Phải có activation_conditions và cancel_conditions/downgrade_conditions. Khi điều kiện hủy đã thực sự xảy ra, xóa tuyến đó; tuyệt đối không bịa lý do mới để ép nó quay lại.
2. Mọi tuyến phải có nguyên nhân, phạm vi và NPC/tổ chức liên quan hợp lý. Không nhảy từ xung đột cá nhân lên chiến tranh/tận thế nếu không có cơ chế độc lập tương ứng.
3. Foreshadowing chỉ là dấu hiệu nhỏ, tự nhiên, ít nổi bật, có thể có cách giải thích đời thường và không cần xuất hiện ở mỗi lượt. Không viết dấu hiệu theo kiểu khiến <user> chắc chắn nhận ra. Không dùng lời bình như “đáng chú ý”, “bất thường”, “điềm báo”, “không ai biết rằng”, “sắp có chuyện”, “như thể báo hiệu”.
4. Không suy luận thay <user>. Không ghi “<user> sẽ nhận ra/nghi ngờ/hiểu/chọn”. Chỉ mô tả điều kiện khách quan mà nếu xuất hiện thì model chính có thể cài một chi tiết nhỏ.
5. Không tự thêm quan hệ, sức mạnh bí mật, tổ chức hay sự kiện lớn nếu dữ liệu hiện tại không hỗ trợ.
6. Ưu tiên cập nhật tuyến cũ thay vì tạo tuyến mới. Tối đa 6 tuyến đang hoạt động. Không cần đủ số lượng.
7. Chỉ xuất JSON hợp lệ, không markdown, không giải thích ngoài JSON.

SCHEMA:
{
  "version": 1,
  "objective_locked": [
    {
      "id": "O1",
      "event": "mô tả ngắn",
      "basis": "căn cứ đã có",
      "phase": "dormant|forming|approaching|active",
      "fixed_core": "phần không thể tránh",
      "user_can_change": "phần có thể tác động hoặc unknown",
      "next_hidden_step": "bước ngoài màn hình tiếp theo hoặc null",
      "earliest_touchpoint": "khi nào có thể chạm tới cảnh user hoặc null",
      "subtle_sign_candidates": ["chi tiết nhỏ có thể cài nếu hợp cảnh"]
    }
  ],
  "conditional": [
    {
      "id": "C1",
      "event": "mô tả ngắn",
      "cause": "nguyên nhân hiện có",
      "phase": "seed|forming|escalating|active|cooling",
      "involved": ["NPC/tổ chức thực sự liên quan"],
      "activation_conditions": ["điều kiện tiếp tục/kích hoạt"],
      "cancel_conditions": ["điều kiện khiến tuyến phải hủy"],
      "downgrade_conditions": ["điều kiện làm giảm quy mô"],
      "escalation_gate": "điều kiện bắt buộc trước khi tăng quy mô",
      "next_hidden_step": "bước ngoài màn hình tiếp theo hoặc null",
      "subtle_sign_candidates": ["chi tiết nhỏ có thể cài nếu hợp cảnh"]
    }
  ],
  "retired": [
    {"id": "C0", "reason": "resolved|cancelled|invalidated"}
  ]
}`;

  const defaults = {
    enabled: false,
    baseUrl: '',
    apiKey: '',
    saveKey: false,
    model: '',
    temperature: 0.2,
    maxTokens: 1400,
    historyMessages: 18,
    timeoutMs: 45000,
    injectDepth: 4,
  };

  let config = loadConfig();
  let busy = false;
  let status = 'Sẵn sàng';
  let listeners = [];
  let fallbackButton = null;
  let overlay = null;
  let hostClickListener = null;

  function stContext() {
    try { return SillyTavern?.getContext?.() || window.SillyTavern?.getContext?.() || null; }
    catch (_) { return null; }
  }

  function loadConfig() {
    try {
      const raw = JSON.parse(hostStorage.getItem(STORAGE_KEY) || '{}');
      const merged = { ...defaults, ...raw };
      if (!merged.saveKey) merged.apiKey = '';
      return merged;
    } catch (_) { return { ...defaults }; }
  }

  function saveConfig(next = {}) {
    config = { ...config, ...next };
    const stored = { ...config };
    if (!stored.saveKey) stored.apiKey = '';
    hostStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }

  function normalizeBaseUrl(raw) {
    return String(raw || '')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/chat\/completions$/i, '')
      .replace(/\/models$/i, '');
  }

  function apiUrl(kind) {
    const base = normalizeBaseUrl(config.baseUrl);
    if (!base) throw new Error('Chưa điền Base URL');
    return `${base}/${kind === 'models' ? 'models' : 'chat/completions'}`;
  }

  function apiHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (config.apiKey) h.Authorization = `Bearer ${config.apiKey}`;
    return h;
  }

  async function fetchJson(url, options = {}, timeoutMs = 45000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
      const text = await res.text();
      let payload;
      try { payload = text ? JSON.parse(text) : {}; }
      catch (_) { payload = { raw: text }; }
      if (!res.ok) {
        const detail = payload?.error?.message || payload?.error || payload?.raw || `HTTP ${res.status}`;
        throw new Error(`API ${res.status}: ${String(detail).slice(0, 600)}`);
      }
      return payload;
    } catch (e) {
      if (e?.name === 'AbortError') throw new Error('Call model phụ quá thời gian');
      throw e;
    } finally { clearTimeout(timer); }
  }

  function stripPrivateBlocks(text) {
    return String(text || '')
      .replace(/<future_outline>[\s\S]*?<\/future_outline>/gi, '')
      .replace(/<external_future_outline>[\s\S]*?<\/external_future_outline>/gi, '');
  }

  function compactMessage(text) {
    let value = stripPrivateBlocks(text)
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .trim();
    if (value.length > 9000) value = value.slice(-9000);
    return value;
  }

  function currentCharacterSnapshot(ctx) {
    try {
      const id = ctx.characterId;
      const ch = id !== undefined && id !== null ? ctx.characters?.[Number(id)] : null;
      if (!ch) return '';
      const d = ch.data || ch;
      return [
        `Name: ${d.name || ch.name || ''}`,
        `Description: ${d.description || ''}`,
        `Personality: ${d.personality || ''}`,
        `Scenario: ${d.scenario || ''}`,
      ].join('\n').slice(0, 18000);
    } catch (_) { return ''; }
  }

  function getSavedEnvelope(ctx = stContext()) {
    return ctx?.chatMetadata?.[META_KEY] || null;
  }

  function getSavedOutline(ctx = stContext()) {
    const value = getSavedEnvelope(ctx);
    if (!value) return null;
    if (value.outline && typeof value.outline === 'object') return value.outline;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch (_) { return null; }
    }
    return null;
  }

  async function activeWorldInfoSnapshot(ctx) {
    if (!ctx?.getWorldInfoPrompt) return '';
    try {
      const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
      const n = Math.max(8, Math.min(40, Number(config.historyMessages) || 18));
      const source = chat.slice(-n)
        .map(m => `${m.name || (m.is_user ? ctx.name1 : ctx.name2) || ''}: ${stripPrivateBlocks(m.mes || '')}`)
        .reverse();
      const wi = await ctx.getWorldInfoPrompt(source, Number(ctx.maxContext) || 200000, true);
      if (!wi || typeof wi !== 'object') return '';
      const chunks = [];
      for (const key of ['worldInfoBefore', 'worldInfoAfter', 'anBefore', 'anAfter', 'worldInfoString', 'worldInfoExamples']) {
        const v = wi[key];
        if (typeof v === 'string' && v.trim()) chunks.push(`[${key}]\n${v.trim()}`);
      }
      if (Array.isArray(wi.worldInfoDepth)) {
        for (const item of wi.worldInfoDepth) {
          const entries = Array.isArray(item?.entries) ? item.entries.join('\n') : '';
          if (entries.trim()) chunks.push(`[worldInfoDepth:${item.depth ?? '?'}]\n${entries.trim()}`);
        }
      }
      return chunks.join('\n\n').slice(0, 30000);
    } catch (_) { return ''; }
  }

  async function plannerInput(ctx) {
    const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
    const n = Math.max(4, Math.min(40, Number(config.historyMessages) || 18));
    const recent = chat.slice(-n).map((m, i) => {
      const role = m.is_user ? 'USER' : (m.is_system ? 'SYSTEM' : 'ASSISTANT');
      return `[${role} ${chat.length - n + i}]\n${compactMessage(m.mes || '')}`;
    }).join('\n\n');
    const previous = getSavedOutline(ctx);
    const wi = await activeWorldInfoSnapshot(ctx);
    return [
      '=== CHARACTER / SETTING SNAPSHOT ===',
      currentCharacterSnapshot(ctx) || '(none)',
      ctx?.chatMetadata?.scenario ? `Chat scenario: ${String(ctx.chatMetadata.scenario).slice(0, 6000)}` : '',
      ctx?.chatMetadata?.persona ? `User persona: ${String(ctx.chatMetadata.persona).slice(0, 6000)}` : '',
      '=== ACTIVE WORLD INFO / LOREBOOK ===', wi || '(none activated)',
      '=== PREVIOUS FUTURE OUTLINE ===', previous ? JSON.stringify(previous) : '(none)',
      '=== RECENT CHAT ===', recent || '(empty)',
      '=== TASK ===',
      'Update the private future outline from the current state. Preserve valid old threads, retire invalidated conditional threads, and add only well-supported new threads. Return only JSON following the schema.',
    ].filter(Boolean).join('\n\n');
  }

  function extractModelText(payload) {
    const c = payload?.choices?.[0];
    if (typeof c?.message?.content === 'string') return c.message.content;
    if (Array.isArray(c?.message?.content)) return c.message.content.map(x => typeof x === 'string' ? x : (x?.text || '')).join('');
    if (typeof c?.text === 'string') return c.text;
    if (typeof payload?.output_text === 'string') return payload.output_text;
    throw new Error('API không trả về nội dung model theo định dạng hỗ trợ');
  }

  function parseJsonText(text) {
    let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try { return JSON.parse(raw); } catch (_) {}
    const a = raw.indexOf('{');
    const b = raw.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(raw.slice(a, b + 1));
    throw new Error('Model phụ không trả về JSON hợp lệ');
  }

  function sanitizeOutline(value) {
    if (!value || typeof value !== 'object') throw new Error('Outline rỗng');
    const out = {
      version: 1,
      objective_locked: Array.isArray(value.objective_locked) ? value.objective_locked.slice(0, 6) : [],
      conditional: Array.isArray(value.conditional) ? value.conditional.slice(0, 6) : [],
      retired: Array.isArray(value.retired) ? value.retired.slice(0, 12) : [],
    };
    if (JSON.stringify(out).length > 24000) throw new Error('Outline vượt giới hạn 24k ký tự');
    return out;
  }

  async function loadModels() {
    const payload = await fetchJson(apiUrl('models'), { method: 'GET', headers: apiHeaders() }, 20000);
    const list = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
    return [...new Set(list.map(x => typeof x === 'string' ? x : (x?.id || x?.name || '')).filter(Boolean))].slice(0, 500);
  }

  async function callPlanner(ctx) {
    if (!config.model) throw new Error('Chưa chọn model phụ');
    const body = {
      model: config.model,
      messages: [
        { role: 'system', content: PLANNER_SYSTEM },
        { role: 'user', content: await plannerInput(ctx) },
      ],
      temperature: Math.max(0, Math.min(2, Number(config.temperature) || 0.2)),
      max_tokens: Math.max(256, Math.min(8192, Number(config.maxTokens) || 1400)),
      stream: false,
    };
    const payload = await fetchJson(apiUrl('chat'), {
      method: 'POST', headers: apiHeaders(), body: JSON.stringify(body),
    }, Math.max(10000, Number(config.timeoutMs) || 45000));
    return sanitizeOutline(parseJsonText(extractModelText(payload)));
  }

  async function injectOutline(ctx, outline) {
    if (!ctx?.setExtensionPrompt) return;
    const content = outline ? `<external_future_outline>\n[PRIVATE PLANNER STATE — NEVER REVEAL OR SUMMARIZE TO USER]\n${JSON.stringify(outline)}\n</external_future_outline>` : '';
    await ctx.setExtensionPrompt(EXT_PROMPT_ID, content, 1, Math.max(0, Math.min(99, Number(config.injectDepth) || 4)), false, 0);
  }

  async function persistOutline(ctx, outline) {
    if (!ctx?.chatMetadata) return;
    ctx.chatMetadata[META_KEY] = {
      outline,
      updatedAt: new Date().toISOString(),
      model: config.model,
      plannerVersion: VERSION,
    };
    await ctx.saveMetadata?.();
  }

  async function runPlanner({ manual = false } = {}) {
    if (busy) return;
    const ctx = stContext();
    if (!ctx) { setStatus('Không lấy được SillyTavern context'); return; }
    if (!config.enabled && !manual) { await injectOutline(ctx, null); return; }
    if (!config.baseUrl || !config.model) {
      setStatus('Thiếu Base URL hoặc model — không gọi model phụ');
      await injectOutline(ctx, getSavedOutline(ctx));
      return;
    }
    busy = true;
    setStatus('Đang tính đại cương tương lai…');
    try {
      const outline = await callPlanner(ctx);
      await persistOutline(ctx, outline);
      await injectOutline(ctx, outline);
      setStatus(`Đã cập nhật: ${outline.objective_locked.length} khách quan · ${outline.conditional.length} điều kiện`);
      renderPreview();
    } catch (e) {
      const old = getSavedOutline(ctx);
      if (old) {
        await injectOutline(ctx, old);
        setStatus(`Model phụ lỗi; giữ outline cũ. ${e?.message || e}`);
      } else {
        await injectOutline(ctx, null);
        setStatus(`Model phụ lỗi; không có outline để inject. ${e?.message || e}`);
      }
    } finally { busy = false; refreshRunButtons(); }
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function buildUi() {
    removeUi();
    overlay = hostDocument.createElement('div');
    overlay.id = UI_ID;
    overlay.innerHTML = `
<style>
#${UI_ID}{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.68);display:none;align-items:center;justify-content:center;padding:18px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#e9ebf2}
#${UI_ID} .mfp-card{width:min(920px,96vw);max-height:92vh;overflow:auto;background:#17191f;border:1px solid #3a3e4a;border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.6)}
#${UI_ID} .mfp-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:14px 16px;background:#1d2028;border-bottom:1px solid #343845}
#${UI_ID} .mfp-head h2{font-size:17px;margin:0;flex:1} #${UI_ID} .mfp-ver{font-size:11px;color:#9298a9}
#${UI_ID} button{border:1px solid #4a5060;background:#2d3240;color:#f3f5fa;border-radius:9px;padding:8px 11px;cursor:pointer} #${UI_ID} button:hover{background:#363c4c} #${UI_ID} button:disabled{opacity:.55;cursor:not-allowed}
#${UI_ID} .mfp-close{font-size:18px;min-width:40px}
#${UI_ID} .mfp-body{padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:16px} #${UI_ID} .mfp-section{background:#12141a;border:1px solid #303441;border-radius:12px;padding:13px}
#${UI_ID} .mfp-section h3{margin:0 0 10px;font-size:14px} #${UI_ID} label{display:block;margin:9px 0 4px;color:#b9bfce;font-size:12px}
#${UI_ID} input,#${UI_ID} select,#${UI_ID} textarea{box-sizing:border-box;width:100%;background:#0c0e13;color:#eef0f6;border:1px solid #363b49;border-radius:8px;padding:8px;outline:none} #${UI_ID} textarea{min-height:300px;resize:vertical;font:11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}
#${UI_ID} input:focus,#${UI_ID} select:focus,#${UI_ID} textarea:focus{border-color:#7885aa} #${UI_ID} .mfp-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px} #${UI_ID} .mfp-line{display:flex;gap:8px;align-items:end} #${UI_ID} .mfp-line>div{flex:1}
#${UI_ID} .mfp-check{display:flex;align-items:center;gap:8px;margin:6px 0 4px} #${UI_ID} .mfp-check input{width:auto} #${UI_ID} .mfp-check label{margin:0;font-size:13px;color:#e4e7ef}
#${UI_ID} .mfp-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px} #${UI_ID} .mfp-status{white-space:pre-wrap;margin-top:10px;background:#0d1016;border:1px solid #303747;border-radius:9px;padding:9px;color:#cdd3e2;min-height:20px}
#${UI_ID} .mfp-note{font-size:11px;color:#8f96a8;margin-top:10px;line-height:1.45} #${UI_ID} .mfp-badge{display:inline-block;padding:3px 7px;border-radius:999px;background:#263049;color:#cdd9ff;font-size:11px}
@media(max-width:760px){#${UI_ID}{padding:6px;align-items:stretch}#${UI_ID} .mfp-card{width:100%;max-height:100%;border-radius:10px}#${UI_ID} .mfp-body{grid-template-columns:1fr;padding:10px;gap:10px}#${UI_ID} .mfp-row{grid-template-columns:1fr}#${UI_ID} .mfp-line{display:block}}
</style>
<div class="mfp-card">
  <div class="mfp-head"><h2>🧭 Miemie Future Planner</h2><span class="mfp-ver">v${VERSION}</span><span class="mfp-badge" id="mfp-state">${config.enabled ? 'AUTO ON' : 'AUTO OFF'}</span><button class="mfp-close" id="mfp-close">×</button></div>
  <div class="mfp-body">
    <section class="mfp-section">
      <h3>Model phụ</h3>
      <div class="mfp-check"><input id="mfp-enabled" type="checkbox" ${config.enabled ? 'checked' : ''}><label for="mfp-enabled">Tự cập nhật trước lượt model chính</label></div>
      <label>Base URL OpenAI-compatible</label><input id="mfp-url" value="${esc(config.baseUrl)}" placeholder="https://example.com/v1">
      <label>API key</label><input id="mfp-key" type="password" value="${esc(config.apiKey)}" autocomplete="off" placeholder="sk-...">
      <div class="mfp-check"><input id="mfp-save-key" type="checkbox" ${config.saveKey ? 'checked' : ''}><label for="mfp-save-key">Lưu API key trong trình duyệt này</label></div>
      <div class="mfp-line"><div><label>Model</label><input id="mfp-model" list="mfp-models-list" value="${esc(config.model)}" placeholder="model-id"><datalist id="mfp-models-list"></datalist></div><button id="mfp-load-models">Load model</button></div>
      <div class="mfp-row"><div><label>Temperature</label><input id="mfp-temp" type="number" min="0" max="2" step="0.05" value="${esc(config.temperature)}"></div><div><label>Max tokens</label><input id="mfp-tokens" type="number" min="256" max="8192" value="${esc(config.maxTokens)}"></div><div><label>Lịch sử (message)</label><input id="mfp-history" type="number" min="4" max="40" value="${esc(config.historyMessages)}"></div></div>
      <div class="mfp-row"><div><label>Timeout (ms)</label><input id="mfp-timeout" type="number" min="10000" max="180000" value="${esc(config.timeoutMs)}"></div><div><label>Inject depth</label><input id="mfp-depth" type="number" min="0" max="99" value="${esc(config.injectDepth)}"></div><div></div></div>
      <div class="mfp-actions"><button id="mfp-save">Lưu cấu hình</button><button id="mfp-test">Test + Load model</button><button id="mfp-run">Tính đại cương ngay</button><button id="mfp-clear">Xóa outline chat này</button></div>
      <div id="mfp-status" class="mfp-status"></div>
      <div class="mfp-note">Planner chỉ lập đại cương kín. Nếu endpoint chặn CORS, hãy dùng URL proxy có cho phép browser request. Outline được lưu theo từng chat và inject bằng system prompt ở depth đã chọn.</div>
    </section>
    <section class="mfp-section">
      <h3>Đại cương hiện tại</h3>
      <textarea id="mfp-preview" readonly></textarea>
      <div class="mfp-actions"><button id="mfp-copy">Copy JSON</button><button id="mfp-refresh">Refresh</button></div>
      <div class="mfp-note" id="mfp-meta"></div>
    </section>
  </div>
</div>`;
    hostDocument.body.appendChild(overlay);

    const q = s => overlay.querySelector(s);
    q('#mfp-close').onclick = closeUi;
    overlay.addEventListener('pointerdown', e => { if (e.target === overlay) closeUi(); });
    q('#mfp-save').onclick = () => { saveConfig(readUiConfig()); setStatus('Đã lưu cấu hình'); updateStateBadge(); };
    q('#mfp-load-models').onclick = async () => { saveConfig(readUiConfig()); await doLoadModels(); };
    q('#mfp-test').onclick = async () => { saveConfig(readUiConfig()); await doLoadModels(); };
    q('#mfp-run').onclick = async () => { saveConfig(readUiConfig()); await runPlanner({ manual: true }); };
    q('#mfp-clear').onclick = clearOutline;
    q('#mfp-refresh').onclick = renderPreview;
    q('#mfp-copy').onclick = async () => { const out = getSavedOutline(); if (!out) return setStatus('Chưa có outline để copy'); try { await navigator.clipboard.writeText(JSON.stringify(out, null, 2)); setStatus('Đã copy outline JSON'); } catch (_) { setStatus('Không copy được qua clipboard API'); } };
    q('#mfp-enabled').onchange = () => updateStateBadge();
    renderPreview();
    renderStatus();
  }

  function readUiConfig() {
    if (!overlay) return { ...config };
    const q = s => overlay.querySelector(s);
    return {
      enabled: !!q('#mfp-enabled')?.checked,
      baseUrl: q('#mfp-url')?.value?.trim() || '',
      apiKey: q('#mfp-key')?.value || '',
      saveKey: !!q('#mfp-save-key')?.checked,
      model: q('#mfp-model')?.value?.trim() || '',
      temperature: Number(q('#mfp-temp')?.value || 0.2),
      maxTokens: Number(q('#mfp-tokens')?.value || 1400),
      historyMessages: Number(q('#mfp-history')?.value || 18),
      timeoutMs: Number(q('#mfp-timeout')?.value || 45000),
      injectDepth: Number(q('#mfp-depth')?.value || 4),
    };
  }

  function openUi() {
    if (!hostDocument.getElementById(UI_ID)) buildUi();
    overlay.style.display = 'flex';
    renderPreview();
    renderStatus();
  }
  function closeUi() { if (overlay) overlay.style.display = 'none'; }
  function removeUi() { try { hostDocument.getElementById(UI_ID)?.remove(); } catch (_) {} overlay = null; }

  function setStatus(text) { status = String(text || ''); renderStatus(); }
  function renderStatus() { const el = overlay?.querySelector('#mfp-status'); if (el) el.textContent = status; }
  function updateStateBadge() { const el = overlay?.querySelector('#mfp-state'); if (el) el.textContent = overlay?.querySelector('#mfp-enabled')?.checked ? 'AUTO ON' : 'AUTO OFF'; }
  function refreshRunButtons() { if (!overlay) return; for (const id of ['#mfp-run','#mfp-load-models','#mfp-test']) { const el = overlay.querySelector(id); if (el) el.disabled = busy; } }

  function renderPreview() {
    if (!overlay) return;
    const q = s => overlay.querySelector(s);
    const outline = getSavedOutline();
    const env = getSavedEnvelope();
    if (q('#mfp-preview')) q('#mfp-preview').value = outline ? JSON.stringify(outline, null, 2) : '';
    if (q('#mfp-meta')) q('#mfp-meta').textContent = env?.updatedAt ? `Cập nhật: ${env.updatedAt} · model: ${env.model || '?'} · planner v${env.plannerVersion || '?'}` : 'Chưa có đại cương lưu trong chat này.';
  }

  async function doLoadModels() {
    busy = true; refreshRunButtons(); setStatus('Đang tải danh sách model…');
    try {
      const models = await loadModels();
      const dl = overlay?.querySelector('#mfp-models-list');
      if (dl) dl.innerHTML = models.map(x => `<option value="${esc(x)}"></option>`).join('');
      setStatus(`Đã tải ${models.length} model`);
    } catch (e) { setStatus(`Load model lỗi: ${e?.message || e}`); }
    finally { busy = false; refreshRunButtons(); }
  }

  async function clearOutline() {
    const ctx = stContext();
    if (ctx?.chatMetadata) {
      delete ctx.chatMetadata[META_KEY];
      await ctx.saveMetadata?.();
    }
    await injectOutline(ctx, null);
    setStatus('Đã xóa outline của chat hiện tại');
    renderPreview();
  }

  function registerTavernHelperButton() {
    let registered = false;
    try {
      if (typeof appendInexistentScriptButtons === 'function') {
        appendInexistentScriptButtons([{ name: BUTTON_NAME, visible: true }]);
        registered = true;
      }

      // Newer Tavern Helper exposes getButtonEvent(name), while some builds emit
      // the literal button label as the event. Listen to BOTH so the imported
      // button works across versions and Unicode/event-name implementations.
      if (typeof eventOn === 'function') {
        if (typeof getButtonEvent === 'function') {
          try {
            const ev = getButtonEvent(BUTTON_NAME);
            if (ev) {
              eventOn(ev, openUi);
              listeners.push({ kind:'th', eventName:ev, handler:openUi });
              registered = true;
            }
          } catch (_) {}
        }
        try {
          eventOn(BUTTON_NAME, openUi);
          listeners.push({ kind:'th', eventName:BUTTON_NAME, handler:openUi });
          registered = true;
        } catch (_) {}
      }

      // Last-resort bridge: capture clicks on the visible Tavern Helper button in
      // the SillyTavern parent DOM. This fixes builds where the button renders but
      // the script-button event is never emitted.
      if (!hostClickListener && hostDocument?.addEventListener) {
        hostClickListener = (event) => {
          try {
            let node = event.target;
            for (let i = 0; node && i < 6; i++, node = node.parentElement) {
              const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
              if (text === BUTTON_NAME) {
                event.preventDefault?.();
                event.stopPropagation?.();
                openUi();
                return;
              }
            }
          } catch (_) {}
        };
        hostDocument.addEventListener('click', hostClickListener, true);
      }
    } catch (e) { console.warn('[MFP] Tavern Helper button registration failed', e); }
    return registered;
  }

  function createFallbackButton() {
    if (fallbackButton) return;
    fallbackButton = hostDocument.createElement('button');
    fallbackButton.type = 'button';
    fallbackButton.textContent = '🧭 MFP';
    fallbackButton.title = 'Miemie Future Planner';
    Object.assign(fallbackButton.style, {
      position:'fixed', right:'14px', top:'14px', zIndex:'2147483645', padding:'8px 11px', borderRadius:'10px',
      border:'1px solid #667085', background:'#252936', color:'#fff', cursor:'pointer', font:'12px system-ui,sans-serif', boxShadow:'0 6px 20px rgba(0,0,0,.35)'
    });
    fallbackButton.onclick = openUi;
    hostDocument.body.appendChild(fallbackButton);
  }

  function registerGenerationEvents() {
    const ctx = stContext();
    const types = ctx?.eventTypes || ctx?.event_types || window.tavern_events || {};
    const genEvent = types.GENERATION_STARTED || types.generation_started || 'generation_started';
    const chatEvent = types.CHAT_CHANGED || types.chat_changed || 'chat_changed';

    const onFn = (eventName, handler) => {
      try {
        if (typeof eventOn === 'function') {
          eventOn(eventName, handler);
          listeners.push({ kind:'th', eventName, handler });
          return;
        }
      } catch (_) {}
      try {
        if (ctx?.eventSource?.on) {
          ctx.eventSource.on(eventName, handler);
          listeners.push({ kind:'st', source:ctx.eventSource, eventName, handler });
        }
      } catch (_) {}
    };

    onFn(genEvent, async (type, options, dryRun) => {
      if (dryRun) return;
      config = loadConfig();
      if (!config.enabled) { await injectOutline(stContext(), null); return; }
      const t = String(type || '').toLowerCase();
      if (t.includes('swipe') || t.includes('regenerate') || t.includes('quiet') || t.includes('impersonate')) {
        await injectOutline(stContext(), getSavedOutline());
        return;
      }
      await runPlanner();
    });

    onFn(chatEvent, async () => {
      setTimeout(async () => {
        config = loadConfig();
        await injectOutline(stContext(), config.enabled ? getSavedOutline() : null);
        renderPreview();
      }, 80);
    });
  }

  async function cleanup() {
    try { removeUi(); } catch (_) {}
    try { fallbackButton?.remove(); } catch (_) {}
    fallbackButton = null;
    try { if (hostClickListener) hostDocument.removeEventListener('click', hostClickListener, true); } catch (_) {}
    hostClickListener = null;
    for (const l of listeners.splice(0)) {
      try {
        if (l.kind === 'st') l.source?.removeListener?.(l.eventName, l.handler);
        else if (l.kind === 'th' && typeof eventRemoveListener === 'function') eventRemoveListener(l.eventName, l.handler);
      } catch (_) {}
    }
    try { await injectOutline(stContext(), null); } catch (_) {}
    try { delete window[SCRIPT_KEY]; } catch (_) {}
  }

  // Initialize only after the page body exists.
  if (!hostDocument.body) await new Promise(resolve => hostWindow.addEventListener('DOMContentLoaded', resolve, { once:true }));
  buildUi();
  const hasHelperButton = registerTavernHelperButton();
  if (!hasHelperButton) createFallbackButton();
  registerGenerationEvents();
  await injectOutline(stContext(), config.enabled ? getSavedOutline() : null);

  window[SCRIPT_KEY] = { version: VERSION, open: openUi, run: () => runPlanner({ manual:true }), cleanup, getConfig: () => ({...config}) };
  console.info(`[Miemie Future Planner] loaded v${VERSION}; UI host=${hostDocument === document ? 'script-frame' : 'parent-document'}`);
})();
