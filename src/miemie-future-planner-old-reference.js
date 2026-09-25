(async () => {
  'use strict';

  const SCRIPT_ID = 'miemie-future-planner-v1';
  const STYLE_ID = `${SCRIPT_ID}-style`;
  const BUTTON_ID = `${SCRIPT_ID}-button`;
  const PANEL_ID = `${SCRIPT_ID}-panel`;
  const STORAGE_KEY = 'miemie_future_planner_config_v1';
  const META_KEY = '__miemie_future_outline_v1';
  const EXT_PROMPT_ID = 'miemie_external_future_outline_v1';
  const GLOBAL_KEY = '__MIEMIE_FUTURE_PLANNER_V1__';

  if (window[GLOBAL_KEY] && typeof window[GLOBAL_KEY].cleanup === 'function') {
    try { window[GLOBAL_KEY].cleanup(); } catch (_) {}
  }

  const PLANNER_SYSTEM = `Bạn là bộ lập đại cương tương lai kín cho một phiên nhập vai SillyTavern. Bạn KHÔNG viết chính văn, KHÔNG điều khiển <user>, KHÔNG khen <user>, KHÔNG tạo drama để giải trí. Nhiệm vụ duy nhất là duy trì một đại cương nhân quả ngắn để model kể chuyện chính bám theo.

QUY TẮC BẮT BUỘC:
1. Phân biệt hai loại tuyến:
- OBJECTIVE_LOCKED: sự kiện thế giới tồn tại độc lập với lựa chọn hiện tại của <user>; nếu dữ liệu nói lõi sự kiện là không thể tránh thì không được tự hủy nó. <user> chỉ có thể thay đổi phần mà thiết lập cho phép như thời điểm, hoàn cảnh, thiệt hại hoặc kết quả phụ.
- CONDITIONAL: sự kiện sinh từ hành động, quan hệ, xung đột hoặc điều kiện có thể thay đổi. Phải có activation_conditions và cancel_conditions/downgrade_conditions. Khi điều kiện hủy đã thực sự xảy ra, xóa tuyến đó; tuyệt đối không bịa lý do mới để ép nó quay lại.
2. Mọi tuyến phải có nguyên nhân, phạm vi và NPC/tổ chức liên quan hợp lý. Không nhảy từ xung đột cá nhân lên chiến tranh/tận thế nếu không có cơ chế độc lập tương ứng.
3. Foreshadowing chỉ là dấu hiệu nhỏ, tự nhiên, ít nổi bật, có thể có cách giải thích đời thường và không cần xuất hiện ở mỗi lượt. Không viết dấu hiệu theo kiểu khiến <user> chắc chắn nhận ra. Không dùng lời bình như "đáng chú ý", "bất thường", "điềm báo", "không ai biết rằng", "sắp có chuyện", "như thể báo hiệu".
4. Không suy luận thay <user>. Không ghi "<user> sẽ nhận ra/nghi ngờ/hiểu/chọn". Chỉ mô tả điều kiện khách quan mà nếu xuất hiện thì model chính có thể cài một chi tiết nhỏ.
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
      "user_can_change": "phần có thể tác động hoặc 'unknown'",
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

  function ctx() {
    try {
      if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') return window.SillyTavern.getContext();
    } catch (_) {}
    try {
      if (globalThis.SillyTavern && typeof globalThis.SillyTavern.getContext === 'function') return globalThis.SillyTavern.getContext();
    } catch (_) {}
    return null;
  }

  function loadConfig() {
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
    };
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const merged = { ...defaults, ...raw };
      if (!merged.saveKey) merged.apiKey = '';
      return merged;
    } catch (_) {
      return defaults;
    }
  }

  let config = loadConfig();
  let busy = false;
  let panelOpen = false;
  let statusText = 'Chưa chạy';
  let listeners = [];

  function saveConfig(next) {
    config = { ...config, ...next };
    const stored = { ...config };
    if (!stored.saveKey) stored.apiKey = '';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }

  function normalizeBaseUrl(raw) {
    let url = String(raw || '').trim().replace(/\/+$/, '');
    url = url.replace(/\/chat\/completions$/i, '');
    return url;
  }

  function endpoint(kind) {
    const base = normalizeBaseUrl(config.baseUrl);
    if (!base) throw new Error('Chưa điền Base URL');
    return `${base}/${kind === 'models' ? 'models' : 'chat/completions'}`;
  }

  function headers() {
    const value = { 'Content-Type': 'application/json' };
    if (config.apiKey) value.Authorization = `Bearer ${config.apiKey}`;
    return value;
  }

  function stripPlannerTags(text) {
    return String(text || '')
      .replace(/<future_outline>[\s\S]*?<\/future_outline>/gi, '')
      .replace(/<external_future_outline>[\s\S]*?<\/external_future_outline>/gi, '');
  }

  function compactMessage(text) {
    let value = stripPlannerTags(text);
    // UI/CSS-heavy blocks are low-value to the planner.
    value = value.replace(/<style[\s\S]*?<\/style>/gi, '');
    value = value.replace(/```[\s\S]{12000,}?```/g, '[large code block omitted]');
    if (value.length > 9000) value = value.slice(-9000);
    return value.trim();
  }

  function currentCharacterSnapshot(context) {
    try {
      const id = context.characterId;
      const character = id !== undefined && id !== null ? context.characters?.[Number(id)] : null;
      if (!character) return '';
      const data = character.data || character;
      const parts = [
        `Name: ${data.name || character.name || ''}`,
        `Description: ${data.description || ''}`,
        `Personality: ${data.personality || ''}`,
        `Scenario: ${data.scenario || ''}`,
      ];
      return parts.join('\n').slice(0, 18000);
    } catch (_) {
      return '';
    }
  }

  function getSavedOutline(context) {
    const meta = context?.chatMetadata?.[META_KEY];
    if (!meta) return null;
    if (typeof meta === 'string') {
      try { return JSON.parse(meta); } catch (_) { return null; }
    }
    if (meta.outline && typeof meta.outline === 'object') return meta.outline;
    if (typeof meta === 'object') return meta;
    return null;
  }

  async function activeWorldInfoSnapshot(context) {
    if (!context || typeof context.getWorldInfoPrompt !== 'function') return '';
    try {
      const chat = Array.isArray(context.chat) ? context.chat : [];
      const source = chat.slice(-Math.max(8, Math.min(40, Number(config.historyMessages) || 18)))
        .map(m => `${m.name || (m.is_user ? context.name1 : context.name2) || ''}: ${stripPlannerTags(m.mes || '')}`)
        .reverse();
      const wi = await context.getWorldInfoPrompt(source, Number(context.maxContext) || 200000, true);
      if (!wi || typeof wi !== 'object') return '';
      const chunks = [];
      for (const key of ['worldInfoBefore', 'worldInfoAfter', 'anBefore', 'anAfter', 'worldInfoString', 'worldInfoExamples']) {
        const value = wi[key];
        if (typeof value === 'string' && value.trim()) chunks.push(`[${key}]\n${value.trim()}`);
      }
      if (Array.isArray(wi.worldInfoDepth)) {
        for (const item of wi.worldInfoDepth) {
          const entries = Array.isArray(item?.entries) ? item.entries.join('\n') : '';
          if (entries.trim()) chunks.push(`[worldInfoDepth:${item.depth ?? '?'}]\n${entries.trim()}`);
        }
      }
      return chunks.join('\n\n').slice(0, 30000);
    } catch (_) {
      return '';
    }
  }

  async function plannerInput(context) {
    const chat = Array.isArray(context.chat) ? context.chat : [];
    const n = Math.max(4, Math.min(40, Number(config.historyMessages) || 18));
    const recent = chat.slice(-n).map((m, i) => {
      const role = m.is_user ? 'USER' : (m.is_system ? 'SYSTEM' : 'ASSISTANT');
      return `[${role} ${chat.length - n + i}]\n${compactMessage(m.mes || '')}`;
    }).filter(Boolean).join('\n\n');
    const previous = getSavedOutline(context);
    const activeWorldInfo = await activeWorldInfoSnapshot(context);
    const persona = String(context?.chatMetadata?.persona || '').slice(0, 6000);
    const scenario = String(context?.chatMetadata?.scenario || '').slice(0, 6000);
    return [
      '=== CHARACTER / SETTING SNAPSHOT ===',
      currentCharacterSnapshot(context) || '(none)',
      scenario ? `Chat scenario: ${scenario}` : '',
      persona ? `User persona: ${persona}` : '',
      '=== ACTIVE WORLD INFO / LOREBOOK ===',
      activeWorldInfo || '(none activated)',
      '=== PREVIOUS FUTURE OUTLINE ===',
      previous ? JSON.stringify(previous) : '(none)',
      '=== RECENT CHAT ===',
      recent || '(empty)',
      '=== TASK ===',
      'Update the future outline from the current state. Preserve valid old threads, retire invalidated conditional threads, and add only well-supported new threads. Return only JSON following the schema.',
    ].filter(Boolean).join('\n\n');
  }

  function extractText(payload) {
    const choice = payload?.choices?.[0];
    if (typeof choice?.message?.content === 'string') return choice.message.content;
    if (Array.isArray(choice?.message?.content)) {
      return choice.message.content.map(x => typeof x === 'string' ? x : (x?.text || '')).join('');
    }
    if (typeof choice?.text === 'string') return choice.text;
    if (typeof payload?.output_text === 'string') return payload.output_text;
    throw new Error('API không trả về nội dung model theo định dạng hỗ trợ');
  }

  function parseJsonText(text) {
    let raw = String(text || '').trim();
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try { return JSON.parse(raw); } catch (_) {}
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(raw.slice(first, last + 1));
    throw new Error('Model phụ không trả về JSON hợp lệ');
  }

  function sanitizeOutline(value) {
    if (!value || typeof value !== 'object') throw new Error('Outline rỗng');
    const clean = {
      version: 1,
      objective_locked: Array.isArray(value.objective_locked) ? value.objective_locked.slice(0, 6) : [],
      conditional: Array.isArray(value.conditional) ? value.conditional.slice(0, 6) : [],
      retired: Array.isArray(value.retired) ? value.retired.slice(0, 12) : [],
    };
    const serialized = JSON.stringify(clean);
    if (serialized.length > 24000) throw new Error('Outline vượt giới hạn 24k ký tự');
    return clean;
  }

  async function directFetch(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 45000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const text = await response.text();
      let payload = null;
      try { payload = text ? JSON.parse(text) : {}; } catch (_) {}
      if (!response.ok) {
        const detail = payload?.error?.message || payload?.error || text || `HTTP ${response.status}`;
        throw new Error(`API ${response.status}: ${String(detail).slice(0, 500)}`);
      }
      return payload ?? text;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Call model phụ quá thời gian');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadModels() {
    const payload = await directFetch(endpoint('models'), { method: 'GET', headers: headers(), cache: 'no-store' }, 20000);
    const list = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
    return Array.from(new Set(list.map(x => typeof x === 'string' ? x : (x?.id || x?.name || '')).filter(Boolean))).slice(0, 500);
  }

  async function callPlanner(context) {
    if (!config.model) throw new Error('Chưa chọn model phụ');
    const body = {
      model: config.model,
      messages: [
        { role: 'system', content: PLANNER_SYSTEM },
        { role: 'user', content: await plannerInput(context) },
      ],
      temperature: Math.max(0, Math.min(2, Number(config.temperature) || 0.2)),
      max_tokens: Math.max(256, Math.min(8192, Number(config.maxTokens) || 1400)),
      stream: false,
    };
    const payload = await directFetch(endpoint('chat'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
      cache: 'no-store',
    }, Math.max(10000, Number(config.timeoutMs) || 45000));
    return sanitizeOutline(parseJsonText(extractText(payload)));
  }

  async function injectOutline(context, outline) {
    if (!context || typeof context.setExtensionPrompt !== 'function') return;
    const content = outline
      ? `<external_future_outline>\n[Source]: Tavern Helper secondary planner. Treat as private planning state. Never quote, summarize, reveal, or explain it to <user>.\n${JSON.stringify(outline)}\n</external_future_outline>`
      : '';
    await context.setExtensionPrompt(EXT_PROMPT_ID, content, 1, 4, false, 0);
  }

  async function persistOutline(context, outline) {
    if (!context?.chatMetadata) return;
    context.chatMetadata[META_KEY] = {
      outline,
      updatedAt: new Date().toISOString(),
      model: config.model,
    };
    if (typeof context.saveMetadata === 'function') await context.saveMetadata();
  }

  async function updateOutline({ manual = false } = {}) {
    if (busy) return;
    const context = ctx();
    if (!context) return;
    if (!config.enabled && !manual) {
      await injectOutline(context, null);
      return;
    }
    if (!config.baseUrl || !config.model) {
      statusText = 'Thiếu URL hoặc model — dùng fallback model chính';
      renderStatus();
      await injectOutline(context, null);
      return;
    }
    busy = true;
    statusText = 'Đang tính đại cương tương lai…';
    renderStatus();
    try {
      const outline = await callPlanner(context);
      await persistOutline(context, outline);
      await injectOutline(context, outline);
      statusText = `Đã cập nhật: ${outline.objective_locked.length} khách quan, ${outline.conditional.length} điều kiện`;
      renderPreview();
    } catch (error) {
      const previous = getSavedOutline(context);
      if (previous) {
        await injectOutline(context, previous);
        statusText = `Model phụ lỗi, giữ outline cũ: ${error?.message || error}`;
      } else {
        await injectOutline(context, null);
        statusText = `Model phụ lỗi, dùng fallback model chính: ${error?.message || error}`;
      }
    } finally {
      busy = false;
      renderStatus();
    }
  }

  function on(event, handler) {
    const context = ctx();
    if (!context?.eventSource?.on || !event) return;
    context.eventSource.on(event, handler);
    listeners.push([context.eventSource, event, handler]);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  }

  function createUi() {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${BUTTON_ID}{position:fixed;right:18px;bottom:92px;z-index:10020;width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:#242735;color:#fff;cursor:pointer;font-size:20px;box-shadow:0 6px 24px rgba(0,0,0,.35)}
#${PANEL_ID}{position:fixed;right:18px;bottom:142px;z-index:10021;width:min(430px,calc(100vw - 24px));max-height:min(720px,calc(100vh - 170px));overflow:auto;background:#181a22;color:#e9e9ef;border:1px solid #3a3d4b;border-radius:12px;padding:12px;box-shadow:0 14px 45px rgba(0,0,0,.5);font:13px/1.4 system-ui,sans-serif;display:none}
#${PANEL_ID} h3{margin:0 0 10px;font-size:15px} #${PANEL_ID} label{display:block;margin:8px 0 3px;color:#bfc3d4} #${PANEL_ID} input,#${PANEL_ID} select,#${PANEL_ID} textarea{box-sizing:border-box;width:100%;background:#0f1118;color:#eee;border:1px solid #3b3f50;border-radius:7px;padding:7px} #${PANEL_ID} textarea{min-height:145px;resize:vertical;font-family:ui-monospace,monospace;font-size:11px} #${PANEL_ID} .row{display:flex;gap:8px;align-items:end} #${PANEL_ID} .row>*{flex:1} #${PANEL_ID} button{background:#303548;color:#fff;border:1px solid #4b5167;border-radius:7px;padding:7px 9px;cursor:pointer} #${PANEL_ID} .buttons{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px} #${PANEL_ID} .status{margin-top:8px;padding:7px;border-radius:7px;background:#11141d;color:#c8cde0;white-space:pre-wrap} #${PANEL_ID} .check{display:flex;gap:7px;align-items:center;margin:6px 0} #${PANEL_ID} .check input{width:auto} #${PANEL_ID} .muted{color:#8f95a8;font-size:11px}
`;
    document.head.appendChild(style);

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = '🧭';
    button.title = 'Miemie Future Planner';
    document.body.appendChild(button);

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    document.body.appendChild(panel);

    function renderPanel() {
      panel.innerHTML = `
<h3>🧭 Đại cương tương lai — Model phụ</h3>
<div class="check"><input id="mfp-enabled" type="checkbox" ${config.enabled ? 'checked' : ''}><label for="mfp-enabled" style="margin:0">Dùng model phụ trước khi model chính trả lời</label></div>
<label>Base URL OpenAI-compatible</label><input id="mfp-url" value="${escapeHtml(config.baseUrl)}" placeholder="https://.../v1">
<label>API key</label><input id="mfp-key" type="password" value="${escapeHtml(config.apiKey)}" autocomplete="off" placeholder="sk-...">
<div class="check"><input id="mfp-savekey" type="checkbox" ${config.saveKey ? 'checked' : ''}><label for="mfp-savekey" style="margin:0">Lưu key trong localStorage của trình duyệt</label></div>
<div class="row"><div><label>Model</label><input id="mfp-model" list="mfp-model-list" value="${escapeHtml(config.model)}"><datalist id="mfp-model-list"></datalist></div><div style="flex:0 0 auto"><button id="mfp-models" type="button">Load model</button></div></div>
<div class="row"><div><label>Temperature</label><input id="mfp-temp" type="number" min="0" max="2" step="0.05" value="${escapeHtml(config.temperature)}"></div><div><label>Max tokens</label><input id="mfp-tokens" type="number" min="256" max="8192" value="${escapeHtml(config.maxTokens)}"></div><div><label>Số message</label><input id="mfp-history" type="number" min="4" max="40" value="${escapeHtml(config.historyMessages)}"></div></div>
<div class="buttons"><button id="mfp-save" type="button">Lưu cấu hình</button><button id="mfp-run" type="button">Tính ngay</button><button id="mfp-clear" type="button">Xóa outline</button></div>
<div class="status" id="mfp-status"></div>
<label>Outline hiện tại</label><textarea id="mfp-preview" readonly></textarea>
<div class="muted">Model phụ chỉ lập đại cương kín và tiêm nó vào prompt bằng setExtensionPrompt. Nếu call lỗi, model chính dùng fallback. Direct API call có thể bị CORS nếu endpoint không cho phép trình duyệt truy cập.</div>`;
      bindPanel();
      renderStatus();
      renderPreview();
    }

    function readForm() {
      return {
        enabled: !!panel.querySelector('#mfp-enabled')?.checked,
        baseUrl: panel.querySelector('#mfp-url')?.value?.trim() || '',
        apiKey: panel.querySelector('#mfp-key')?.value || '',
        saveKey: !!panel.querySelector('#mfp-savekey')?.checked,
        model: panel.querySelector('#mfp-model')?.value?.trim() || '',
        temperature: Number(panel.querySelector('#mfp-temp')?.value || 0.2),
        maxTokens: Number(panel.querySelector('#mfp-tokens')?.value || 1400),
        historyMessages: Number(panel.querySelector('#mfp-history')?.value || 18),
      };
    }

    function bindPanel() {
      panel.querySelector('#mfp-save')?.addEventListener('click', () => {
        saveConfig(readForm());
        statusText = 'Đã lưu cấu hình';
        renderStatus();
      });
      panel.querySelector('#mfp-run')?.addEventListener('click', async () => {
        saveConfig(readForm());
        await updateOutline({ manual: true });
      });
      panel.querySelector('#mfp-models')?.addEventListener('click', async () => {
        saveConfig(readForm());
        statusText = 'Đang tải danh sách model…'; renderStatus();
        try {
          const models = await loadModels();
          const dl = panel.querySelector('#mfp-model-list');
          if (dl) dl.innerHTML = models.map(x => `<option value="${escapeHtml(x)}"></option>`).join('');
          statusText = `Đã tải ${models.length} model`;
        } catch (e) { statusText = `Load model lỗi: ${e?.message || e}`; }
        renderStatus();
      });
      panel.querySelector('#mfp-clear')?.addEventListener('click', async () => {
        const context = ctx();
        if (context?.chatMetadata) {
          delete context.chatMetadata[META_KEY];
          if (typeof context.saveMetadata === 'function') await context.saveMetadata();
        }
        await injectOutline(context, null);
        statusText = 'Đã xóa outline';
        renderStatus(); renderPreview();
      });
    }

    button.addEventListener('click', () => {
      panelOpen = !panelOpen;
      panel.style.display = panelOpen ? 'block' : 'none';
      if (panelOpen) renderPanel();
    });

    return { button, panel, style, renderPanel };
  }

  let ui = null;
  function renderStatus() {
    const el = document.querySelector(`#${PANEL_ID} #mfp-status`);
    if (el) el.textContent = statusText;
  }
  function renderPreview() {
    const el = document.querySelector(`#${PANEL_ID} #mfp-preview`);
    if (!el) return;
    const outline = getSavedOutline(ctx());
    el.value = outline ? JSON.stringify(outline, null, 2) : '';
  }

  async function reinjectSaved() {
    const context = ctx();
    if (!context) return;
    if (!config.enabled) return injectOutline(context, null);
    return injectOutline(context, getSavedOutline(context));
  }

  function installEvents() {
    const context = ctx();
    if (!context?.eventSource) return;
    const types = context.eventTypes || context.event_types || {};
    const generationStarted = types.GENERATION_STARTED || 'generation_started';
    const chatChanged = types.CHAT_CHANGED || 'chat_changed';

    on(generationStarted, async (type, options, dryRun) => {
      if (dryRun) return;
      if (!config.enabled) {
        await injectOutline(ctx(), null);
        return;
      }
      const t = String(type || '').toLowerCase();
      if (t.includes('regenerate') || t.includes('swipe') || t.includes('impersonate') || t.includes('quiet')) {
        await reinjectSaved();
        return;
      }
      await updateOutline();
    });

    on(chatChanged, async () => {
      setTimeout(() => { reinjectSaved().catch(() => {}); renderPreview(); }, 100);
    });
  }

  function cleanup() {
    for (const [source, event, handler] of listeners) {
      try { source.removeListener?.(event, handler); } catch (_) {}
    }
    listeners = [];
    try { document.getElementById(STYLE_ID)?.remove(); } catch (_) {}
    try { document.getElementById(BUTTON_ID)?.remove(); } catch (_) {}
    try { document.getElementById(PANEL_ID)?.remove(); } catch (_) {}
    try { injectOutline(ctx(), null); } catch (_) {}
    try { delete window[GLOBAL_KEY]; } catch (_) {}
  }

  ui = createUi();
  installEvents();
  await reinjectSaved();
  window[GLOBAL_KEY] = { cleanup, updateOutline, getConfig: () => ({ ...config }) };
})();
