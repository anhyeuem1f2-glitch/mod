(async () => {
  'use strict';

  const VERSION = '1.4.1';
  const BUILD_MARKER = 'USER_AUTHORITY_CAUSAL_ROOT_FORCE_VERIFY_2026-09-30';
  const SCRIPT_KEY = '__MIEMIE_FUTURE_PLANNER_EXTERNAL__';
  const BUTTON_NAME = 'Miemie Future Planner';
  const STORAGE_KEY = 'miemie_future_planner_external_config_v1';
  const META_KEY = '__miemie_future_outline_v2';
  const LEGACY_META_KEYS = ['__miemie_future_outline_v1'];
  const EXT_PROMPT_ID = 'miemie_external_future_outline_v2';
  const LEGACY_EXT_PROMPT_IDS = ['miemie_external_future_outline_v1'];
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

  const PLANNER_SYSTEM = `Bạn là bộ lập đại cương tương lai KÍN cho một phiên nhập vai SillyTavern. Bạn KHÔNG viết chính văn, KHÔNG điều khiển <user>, KHÔNG khen <user>, KHÔNG tạo drama để giải trí. Nhiệm vụ duy nhất là duy trì một đại cương nhân quả ngắn, khách quan, có thể bị thay đổi bởi diễn biến mới để model kể chuyện chính bám theo.

QUY TẮC BẮT BUỘC — ƯU TIÊN CAO NHẤT:

0. CANON KHÔNG PHẢI ĐỊNH MỆNH CỦA <user>
- Dòng thời gian/nguyên tác chỉ là dữ liệu tham chiếu về thế giới, KHÔNG phải kịch bản bắt buộc phải tái diễn với <user>.
- Tuyệt đối cấm lấy một sự kiện từng xảy ra với nhân vật chính nguyên tác rồi thay tên nhân vật chính bằng <user> và gọi nó là OBJECTIVE_LOCKED.
- Một cuộc gặp, lời mời, trận chiến, nhiệm vụ, quan hệ hay cảnh tương tác cần <user> có mặt/đi tới/chấp nhận/thực hiện hành động thì KHÔNG phải sự kiện khách quan cố định.
- Ví dụ: “Rudeus gặp Ruijerd trong nguyên tác” KHÔNG chứng minh “<user> chắc chắn gặp Ruijerd”. Chỉ khi trạng thái hiện tại tạo ra đường nhân quả độc lập và hợp lý thì nó mới có thể trở thành CONDITIONAL.

1. PHÂN BIỆT OBJECTIVE_LOCKED VÀ CONDITIONAL BẰNG BÀI TEST ĐỘC LẬP
- OBJECTIVE_LOCKED chỉ hợp lệ nếu trả lời CÓ cho câu hỏi: “Nếu <user> lập tức rời khu vực, không làm gì thêm, từ chối tham gia hoặc biến mất khỏi tuyến này, LÕI SỰ KIỆN CHÍNH XÁC NÀY vẫn xảy ra vì nguyên nhân riêng của thế giới chứ?”
- Nếu câu trả lời là KHÔNG hoặc KHÔNG CHẮC -> chuyển sang CONDITIONAL hoặc bỏ hẳn.
- OBJECTIVE_LOCKED phải ghi independence_test rõ ràng. Không có independence_test đáng tin -> không được giữ trong objective_locked.
- Canon/timeline một mình không đủ làm căn cứ OBJECTIVE_LOCKED nếu sự kiện phụ thuộc vào nhân vật chính nguyên tác.
- fixed_core của OBJECTIVE_LOCKED không được là “NPC X gặp/tiếp cận/bảo vệ/theo dõi/mời/tấn công <user>”.
- Một NPC cụ thể chủ động tiến tới <user> do dấu vết/hành động của <user> luôn là CONDITIONAL, vì nếu <user> đổi vị trí, che dấu vết hoặc rời khu vực thì cuộc tiếp xúc có thể không xảy ra.
- Nếu một event có tên dạng ‘Gặp X’, ‘X tiếp cận <user>’, ‘X điều tra <user>’, ‘X bảo vệ <user>’ thì mặc định loại khỏi OBJECTIVE_LOCKED, bất kể canon từng xảy ra thế nào.

2. USER INPUT LÀ CAUSAL ROOT CAO NHẤT
- Phân loại newest user turn:
  A) ESTABLISH/DECLARATIVE: user xác lập hành động/kết quả như fact.
  B) ATTEMPT/UNCERTAIN: user nói thử/cố/xem có được không hoặc yêu cầu phán định.
  C) META/QUESTION.
- Với ESTABLISH: planner PHẢI áp hành động/kết quả vào state trước. Nó là IMMUTABLE ROOT FACT của lượt này.
- Không được dùng old world state, canon, NPC, logistics, luật, tiền, lịch trình, khả năng hay bất kỳ blocker nào để cancel/downgrade/reroute ROOT FACT.
- Nếu state cũ xung đột ROOT FACT: state cũ phải diverge/reconcile; user input thắng.
- Chỉ sau khi tạo POST-USER STATE mới được lập future threads từ hậu quả của state đó.
- cancel_conditions/downgrade_conditions/escalation_gate KHÔNG bao giờ áp lên ROOT FACT; chúng chỉ áp lên event tương lai của NPC/thế giới.
- Với ATTEMPT: việc user đã thử là fact, nhưng outcome chưa cố định; planner có thể giữ nhiều nhánh kết quả dựa trên state.
- Với META/QUESTION: không biến thành event in-world.
- Không tạo future thread có event chính là hành động user vừa declaratively xác lập. Chỉ theo dõi downstream consequences.

3. CONDITIONAL PHẢI THỰC SỰ CÓ THỂ BỊ HỦY
- CONDITIONAL sinh từ hành động, quan hệ, hiểu lầm, lợi ích hoặc xung đột có thể thay đổi.
- Phải có activation_conditions và cancel_conditions; nếu thích hợp thì có downgrade_conditions.
- Khi điều kiện hủy đã thực sự xảy ra, retire tuyến đó. Tuyệt đối không bịa “ngoài mặt hòa giải nhưng trong lòng vẫn...” chỉ để cứu event.
- Mọi bước leo thang phải có escalation_gate. Không nhảy từ chuyện cá nhân sang chiến tranh/tận thế nếu không tồn tại cơ chế độc lập tương ứng.

4. DẤU HIỆU KÍN — MẶC ĐỊNH LÀ KHÔNG CÀI
- subtle_sign_candidates được phép là [] và đây là lựa chọn mặc định nếu không có chi tiết thật sự tự nhiên.
- Dấu hiệu phải là một dữ kiện cảm giác/đời thường nhỏ, có thể bị bỏ qua hoàn toàn khi đọc lần đầu và KHÔNG tự mang ý nghĩa “đang có chuyện”.
- Dấu hiệu không được nêu tên tác nhân/sự kiện tương lai, không được chứa đặc điểm nhận dạng quá đặc thù đủ để đoán ra tác nhân.
- CẤM các dạng: bóng người bí ẩn, người đứng xa quan sát, ánh mắt theo dõi, silhouette cầm vũ khí đặc trưng, tiếng cười bí hiểm, lời thoại úp mở, “có ai đó đang nhìn”, “có gì đó không ổn”, “đáng chú ý”, “bất thường”, “điềm báo”, “như thể báo hiệu”, “sắp có chuyện”, “linh cảm”, “một cảm giác khó tả”.
- CẤM suy luận thay <user>: không viết <user> nhận ra/nghi ngờ/hiểu/ghi nhớ/cảm thấy chi tiết là bất thường.
- Nếu một dấu hiệu chỉ có tác dụng khi narrator phải giải thích nó liên quan tới event tương lai, đó là dấu hiệu KHÔNG HỢP LỆ.
- Ví dụ hợp lệ hơn: một hóa đơn bị trì hoãn, lịch trực đổi người, một quầy hàng đóng sớm, dấu bánh xe mới trên đường, một căn phòng vốn sáng nay nay tắt đèn — nhưng chỉ khi những chi tiết đó thật sự có đường nhân quả với outline và hợp cảnh hiện tại.

5. QUY MÔ + NPC LIÊN QUAN
- Mọi tuyến phải có nguyên nhân, phạm vi và NPC/tổ chức liên quan hợp lý.
- NPC chỉ tham gia khi có đường thông tin/lợi ích/nghĩa vụ/quan hệ thật sự.
- Không kéo NPC canon nổi tiếng vào chỉ vì họ nổi tiếng hoặc vì muốn tăng độ lớn câu chuyện.
- Ưu tiên cập nhật tuyến cũ hơn là tạo tuyến mới. Tối đa 6 tuyến hoạt động, không cần đủ số lượng.

6. KHÔNG SUY LUẬN THAY <user>
- Không ghi “<user> sẽ...”, “<user> nhận ra...”, “<user> quyết định...”, “<user> chắc chắn...”.
- Nếu một nhánh phụ thuộc <user>, chỉ được mô tả bằng điều kiện khách quan: “Nếu <user> làm X thì...”.

7. CHỈ XUẤT JSON HỢP LỆ, KHÔNG MARKDOWN, KHÔNG GIẢI THÍCH NGOÀI JSON.

SCHEMA:
{
  "version": 2,
  "objective_locked": [
    {
      "id": "O1",
      "event": "mô tả ngắn",
      "basis": "nguyên nhân độc lập đã được thiết lập",
      "source_basis": "world_state|worldbook|established_event|mixed",
      "independence_test": "Nếu <user> biến mất khỏi tuyến này thì sự kiện vẫn xảy ra vì...",
      "phase": "dormant|forming|approaching|active",
      "fixed_core": "phần không thể tránh",
      "user_can_change": "phần có thể tác động hoặc unknown",
      "next_hidden_step": "bước ngoài màn hình tiếp theo hoặc null",
      "earliest_touchpoint": "khi nào có thể chạm tới cảnh user hoặc null",
      "subtle_sign_candidates": ["0-3 chi tiết cực nhỏ; để [] nếu không cần"]
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
      "subtle_sign_candidates": ["0-3 chi tiết cực nhỏ; để [] nếu không cần"]
    }
  ],
  "retired": [
    {"id": "C0", "reason": "resolved|cancelled|invalidated|failed_independence_test"}
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
    injectDepth: 0,
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
    let outline = null;
    if (value.outline && typeof value.outline === 'object') outline = value.outline;
    else if (typeof value === 'object') outline = value;
    else if (typeof value === 'string') {
      try { outline = JSON.parse(value); } catch (_) { outline = null; }
    }
    // Fail closed: schema v1 / malformed outlines are never injected.
    if (!outline || Number(outline.version) !== 2) return null;
    return outline;
  }

  async function clearLegacyState(ctx = stContext()) {
    if (!ctx) return;
    let metadataChanged = false;
    try {
      for (const key of LEGACY_META_KEYS) {
        if (ctx.chatMetadata && Object.prototype.hasOwnProperty.call(ctx.chatMetadata, key)) {
          delete ctx.chatMetadata[key];
          metadataChanged = true;
        }
      }
      if (metadataChanged) await ctx.saveMetadata?.();
    } catch (_) {}
    try {
      if (ctx.setExtensionPrompt) {
        for (const id of LEGACY_EXT_PROMPT_IDS) {
          await ctx.setExtensionPrompt(id, '', 1, 0, false, 0);
        }
      }
    } catch (_) {}
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
      'Update the private future outline from the current state. Preserve valid old threads, retire invalidated conditional threads, and add only well-supported new threads. Classify the newest user turn as ESTABLISH, ATTEMPT, or META. For ESTABLISH, first apply the user's declared action/result as the highest-authority immutable causal root and build the outline only from the post-user state. Never cancel, downgrade, reroute, delay, or veto that root because of old world state, canon, NPCs, logistics, or prior facts. For ATTEMPT, the attempt itself is fixed but its outcome may be calculated. Return only JSON following the schema.',
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

  const SIGN_HARD_BAN = /(?:đáng chú ý|bất thường|điềm báo|như thể báo hiệu|dường như báo hiệu|sắp có chuyện|có gì đó không ổn|một cảm giác khó tả|linh cảm|không ai biết rằng|không hề biết rằng|có ai đó đang (?:nhìn|quan sát|theo dõi)|ánh mắt[^.。!?！\n]{0,60}(?:quan sát|theo dõi)|bóng người[^.。!?！\n]{0,80}(?:quan sát|theo dõi|nhìn về)|(?:đứng|ẩn|lướt)\s+(?:trên|sau|ở)\s+[^.。!?！\n]{0,60}(?:quan sát|theo dõi)|cầm\s+(?:giáo|kiếm|cung|súng)[^.。!?！\n]{0,60}(?:quan sát|theo dõi|nhìn về))/i;
  const USER_MIND_BAN = /(?:<user>|người chơi|\byou\b)[^.。!?！\n]{0,80}(?:nhận ra|nghi ngờ|hiểu|ghi nhớ|linh cảm|cảm thấy|sẽ chọn|sẽ quyết định)/i;
  const ENCOUNTER_EVENT = /(?:^|\b)(?:gặp gỡ|gặp|tiếp cận|đụng độ|đối đầu|theo dõi|bảo vệ|mời|tuyển mộ|liên hôn|tỏ tình|trả thù|tấn công)\b/i;

  function cleanStringArray(value, max = 8) {
    return Array.isArray(value) ? value.map(x => String(x || '').trim()).filter(Boolean).slice(0, max) : [];
  }

  function sanitizeSigns(value, ctx, related = []) {
    const userName = String(ctx?.name1 || '').trim().toLowerCase();
    const names = cleanStringArray(related, 12).map(x => x.toLowerCase()).filter(x => x.length >= 3);
    const out = [];
    for (const raw of cleanStringArray(value, 8)) {
      const s = raw.replace(/\s+/g, ' ').trim();
      const low = s.toLowerCase();
      if (!s || s.length > 220) continue;
      if (SIGN_HARD_BAN.test(s) || USER_MIND_BAN.test(s)) continue;
      if (userName && low.includes(userName) && /(?:nhận ra|nhìn thấy|cảm thấy|nghi ngờ|ghi nhớ|chú ý)/i.test(s)) continue;
      if (names.some(n => low.includes(n))) continue; // Dấu hiệu không được gọi thẳng tên tác nhân tương lai.
      if (/\b(?:ruijerd|orsted|hitogami|rudeus)\b/i.test(s)) continue; // guard các canon-name dễ bị dùng như spoiler trực tiếp
      out.push(s);
      if (out.length >= 3) break;
    }
    return out;
  }

  function objectiveIsIndependent(item, ctx) {
    const event = String(item?.event || '');
    const fixed = String(item?.fixed_core || '');
    const basis = String(item?.basis || '');
    const source = String(item?.source_basis || '');
    const test = String(item?.independence_test || '').trim();
    const userName = String(ctx?.name1 || '').trim();
    if (test.length < 12) return false;
    if (/\b(?:không chắc|uncertain|unknown)\b/i.test(test)) return false;
    if (/(?:nếu|khi)\s+<user>/i.test(test) || /phụ thuộc\s+(?:vào\s+)?<user>/i.test(test)) return false;
    if (userName && new RegExp(`(?:nếu|khi|cần|đợi|gặp|tiếp cận|bảo vệ|theo dõi|tấn công|mời)[^\\n.]{0,60}${userName.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}`, 'i').test(`${event} ${fixed} ${test}`)) return false;
    // Cuộc gặp/tương tác cá nhân không được khóa khách quan; nếu thật sự độc lập, planner phải diễn đạt thành biến động thế giới chứ không phải “gặp X”.
    if (ENCOUNTER_EVENT.test(event) || ENCOUNTER_EVENT.test(fixed)) return false;
    // Canon/timeline đơn độc không đủ làm căn cứ khóa.
    if (/(?:nguyên tác|canon|timeline|dòng thời gian)/i.test(basis) && !/(?:world_state|worldbook|established_event|mixed)/i.test(source)) return false;
    return true;
  }

  function sanitizeOutline(value, ctx = stContext()) {
    if (!value || typeof value !== 'object') throw new Error('Outline rỗng');
    const retired = Array.isArray(value.retired) ? value.retired.slice(0, 12).map(x => ({ id:String(x?.id||''), reason:String(x?.reason||'invalidated') })) : [];
    const objective = [];
    for (const raw of Array.isArray(value.objective_locked) ? value.objective_locked.slice(0, 10) : []) {
      if (!raw || typeof raw !== 'object') continue;
      if (!objectiveIsIndependent(raw, ctx)) {
        if (raw.id) retired.push({ id:String(raw.id), reason:'failed_independence_test' });
        continue;
      }
      const item = {
        id: String(raw.id || `O${objective.length+1}`),
        event: String(raw.event || '').trim(),
        basis: String(raw.basis || '').trim(),
        source_basis: String(raw.source_basis || 'mixed').trim(),
        independence_test: String(raw.independence_test || '').trim(),
        phase: String(raw.phase || 'dormant').trim(),
        fixed_core: String(raw.fixed_core || '').trim(),
        user_can_change: String(raw.user_can_change || 'unknown').trim(),
        next_hidden_step: raw.next_hidden_step == null ? null : String(raw.next_hidden_step).trim(),
        earliest_touchpoint: raw.earliest_touchpoint == null ? null : String(raw.earliest_touchpoint).trim(),
        subtle_sign_candidates: sanitizeSigns(raw.subtle_sign_candidates, ctx, [raw.event, raw.fixed_core]),
      };
      if (item.event && item.fixed_core) objective.push(item);
      if (objective.length >= 6) break;
    }
    const conditional = [];
    for (const raw of Array.isArray(value.conditional) ? value.conditional.slice(0, 10) : []) {
      if (!raw || typeof raw !== 'object') continue;
      const involved = cleanStringArray(raw.involved, 12);
      const item = {
        id: String(raw.id || `C${conditional.length+1}`),
        event: String(raw.event || '').trim(),
        cause: String(raw.cause || '').trim(),
        phase: String(raw.phase || 'seed').trim(),
        involved,
        activation_conditions: cleanStringArray(raw.activation_conditions, 8),
        cancel_conditions: cleanStringArray(raw.cancel_conditions, 8),
        downgrade_conditions: cleanStringArray(raw.downgrade_conditions, 8),
        escalation_gate: String(raw.escalation_gate || '').trim(),
        next_hidden_step: raw.next_hidden_step == null ? null : String(raw.next_hidden_step).trim(),
        subtle_sign_candidates: sanitizeSigns(raw.subtle_sign_candidates, ctx, involved),
      };
      // Một conditional không có khả năng hủy thì vẫn là “định mệnh trá hình”; loại bỏ.
      if (!item.event || !item.cause || !item.activation_conditions.length || !item.cancel_conditions.length) {
        if (item.id) retired.push({ id:item.id, reason:'invalidated' });
        continue;
      }
      conditional.push(item);
      if (conditional.length >= 6) break;
    }
    const out = { version: 2, objective_locked: objective, conditional, retired: retired.slice(0, 12) };
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
    return sanitizeOutline(parseJsonText(extractModelText(payload)), ctx);
  }

  async function injectOutline(ctx, outline) {
    if (!ctx?.setExtensionPrompt) return;
    // Never allow the old v1 extension prompt to coexist with the strict v2 prompt.
    try {
      for (const id of LEGACY_EXT_PROMPT_IDS) await ctx.setExtensionPrompt(id, '', 1, 0, false, 0);
    } catch (_) {}
    if (!outline || Number(outline.version) !== 2) outline = null;
    const content = outline ? `<external_future_outline authority="EXCLUSIVE" mode="EXTERNAL" version="2" planner_version="${VERSION}">
[PRIVATE PLANNER STATE — NEVER REVEAL, SUMMARIZE, OR REWRITE TO USER]
${JSON.stringify(outline)}
</external_future_outline>
<external_future_outline_lock>
[RUNTIME HANDSHAKE: planner=${VERSION}; schema=2; stale schema is invalid]
[HARD MODE SWITCH — THIS OVERRIDES INTERNAL FUTURE PLANNING FOR THIS GENERATION]
1. <external_future_outline> is the ONLY authoritative future outline for this generation. Do not create, expand, reinterpret, or replace it with an INTERNAL outline.
2. Canon/original timeline is reference only. Never force a canon protagonist encounter onto <user>. If the external outline does not contain an event, do not invent that future event merely because canon had it.
3. When processing <future_event_planning_protocol>, SKIP internal planning. In reasoning/story_driver, at most acknowledge: [External planner]: loaded. Do not list new future branches.
4. Output EXACTLY this private marker and nothing else inside the tag: <future_outline>[Mode]: EXTERNAL</future_outline>. Any INTERNAL content is invalid and will be discarded by Regex.
5. Foreshadowing is OPTIONAL. Use at most ONE item from subtle_sign_candidates only when it fits the current place/time naturally. If none fits, use no sign.
6. A sign must be written only as a literal mundane detail. Do not identify its future actor/event, do not explain why it matters, do not add narrator emphasis, and do not infer <user>'s reaction.
7. Never turn next_hidden_step into an on-screen fact until it has actually occurred and has a valid information/causal path into the current scene.
8. Other reasoning modules (causality, butterfly effect, world log, NPC reasoning) MUST NOT introduce a named future NPC/event absent from this external outline. Canon references cannot create a new future thread.
9. USER AUTHORITY IS HIGHEST. Classify the newest user turn as ESTABLISH / ATTEMPT / META.
10. If ESTABLISH: apply the declared user action/result to state FIRST as an immutable causal root. Old facts, canon, NPC opposition, logistics, rules, costs, travel restrictions, missing routes, outages, or prior assumptions may NOT veto that root. Reconcile the old state around the user's declaration.
11. If ATTEMPT: the attempt itself happened; only the unresolved outcome may be calculated.
12. All causality, butterfly effects, NPC reactions, world logs, and future threads must be derived from the POST-USER STATE.
13. Before writing story_scene, silently delete any planned future encounter inferred only from canon or from protagonist-centric convenience.
</external_future_outline_lock>` : '';
    // Strict mode always injects nearest to generation; old saved depth settings cannot weaken the lock.
    await ctx.setExtensionPrompt(EXT_PROMPT_ID, content, 1, 0, false, 0);
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
      <div class="mfp-row"><div><label>Timeout (ms)</label><input id="mfp-timeout" type="number" min="10000" max="180000" value="${esc(config.timeoutMs)}"></div><div><label>Strict lock</label><input value="ON · depth 0" disabled></div><div></div></div>
      <div class="mfp-actions"><button id="mfp-save">Lưu cấu hình</button><button id="mfp-test">Test + Load model</button><button id="mfp-run">Tính đại cương ngay</button><button id="mfp-clear">Xóa outline chat này</button></div>
      <div id="mfp-status" class="mfp-status"></div>
      <div class="mfp-note">Planner chỉ lập đại cương kín. Nếu endpoint chặn CORS, hãy dùng URL proxy có cho phép browser request. Outline được lưu theo từng chat. Strict lock luôn inject ở depth 0 để model chính không tự quay về INTERNAL.</div>
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
      injectDepth: 0,
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
  await clearLegacyState(stContext());
  const hasHelperButton = registerTavernHelperButton();
  if (!hasHelperButton) createFallbackButton();
  registerGenerationEvents();
  await injectOutline(stContext(), config.enabled ? getSavedOutline() : null);

  window[SCRIPT_KEY] = { version: VERSION, open: openUi, run: () => runPlanner({ manual:true }), cleanup, getConfig: () => ({...config}) };
  try { hostWindow.__MIEMIE_FUTURE_PLANNER_RUNTIME__ = { version: VERSION, schema: 2, loadedAt: new Date().toISOString() }; } catch (_) {}
  console.info(`[Miemie Future Planner] loaded v${VERSION}; schema=2; UI host=${hostDocument === document ? 'script-frame' : 'parent-document'}`);
})();
