(async () => {
  'use strict';

  const VERSION = '1.9.0';
  const BUILD_MARKER = 'WORLD_PULSE_CONTEXT_SCHEMA5_2026-10-05';
  const SCRIPT_KEY = '__MIEMIE_FUTURE_PLANNER_EXTERNAL__';
  const BUTTON_NAME = 'Miemie Future Planner';
  const STORAGE_KEY = 'miemie_future_planner_external_config_v1';
  const META_KEY = '__miemie_future_branch_store_v1';
  const LEGACY_META_KEYS = ['__miemie_future_outline_v1', '__miemie_future_outline_v2', '__miemie_future_outline_v3', '__miemie_future_outline_v4'];
  const EXT_PROMPT_ID = 'miemie_external_future_outline_v5';
  const LEGACY_EXT_PROMPT_IDS = ['miemie_external_future_outline_v1', 'miemie_external_future_outline_v2', 'miemie_external_future_outline_v3', 'miemie_external_future_outline_v4'];
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

  const PLANNER_SYSTEM = `Bạn là bộ lập đại cương KÍN + WORLD PULSE planner cho RP đồng nhân/SillyTavern. Bạn KHÔNG viết chính văn và KHÔNG quyết định thay lựa chọn quan trọng của <user>.

MỤC TIÊU:
1) giữ future outline nhất quán;
2) nhìn thấy đầy đủ card/worldbook/extension-state đang drive plot;
3) phân biệt "không rush" với "đứng hình";
4) khi scene đang thụ động, tạo một WORLD/NPC seed cụ thể để main model có tình huống thật thay vì filler.

0. USER AUTHORITY
- ESTABLISH của user là root fact và không được veto.
- Nhưng user authority KHÔNG có nghĩa mọi world event phải do user gây ra.
- NPC/canon/world processes có causal source riêng và tiếp tục sau POST_USER_STATE.

1. SCENE STATE — BẮT BUỘC PHÂN LOẠI
scene_state phải là một trong:
- ACTIVE_INTERACTION: đang có hội thoại/xung đột/vấn đề mở thật sự.
- EXPLICIT_DOWNTIME: latest user EXPLICIT muốn yên tĩnh/chờ/ngắm cảnh/nghỉ mà chưa muốn plot chen vào.
- PASSIVE_TRANSIT: chỉ đi đường/đi thuyền/bay/di chuyển.
- PASSIVE_REST: user đang ngủ/nghỉ; world vẫn vận hành.
- STATIC_AFTER_ACTION: hành động vừa xong, scene chỉ còn narration/scenery.
- WORLD_BEAT_DUE: một canon/NPC/world process đã tới lúc chạm scene.

Không được gọi PASSIVE_TRANSIT/PASSIVE_REST là EXPLICIT_DOWNTIME chỉ vì scene yên. Downtime cần bằng chứng từ ý user.

2. STATE-DELTA TEST
Tự hỏi: nếu bỏ phong cảnh, mỹ từ, status và lời tổng kết, cuối generation kế tiếp có khác đầu generation không?
- Nếu không và scene không phải EXPLICIT_DOWNTIME -> đó là STAGNATION.
- "thuyền tiếp tục đi", "biển yên", "user tiếp tục ngủ", "mọi người sẵn sàng cho phía trước" KHÔNG phải state delta.

3. SCENE SEED — EARLY WORLD PULSE
Trả:
{
  "scene_state": "...",
  "mode": "MANDATORY_EARLY" | "OPTIONAL_EARLY" | "NONE",
  "event": "...",
  "source": "canon_backbone|worldbook|card_prompt|extension_state|npc_goal|user_consequence|travel_progress|mixed",
  "why_now": "...",
  "entry_action": "...",
  "interaction_vector": "NPC_INITIATES|WORLD_EVENT|DISCOVERY|ARRIVAL|REST_PROGRESS",
  "state_delta": "...",
  "stop_boundary": "...",
  "involved": ["..."],
  "conditions_verified": ["..."]
}

MANDATORY_EARLY khi:
- scene_state = WORLD_BEAT_DUE;
- PASSIVE_TRANSIT/STATIC_AFTER_ACTION và có bất kỳ grounded process nào để tiến;
- PASSIVE_REST và có natural rest milestone/world process đáng thể hiện;
- active NPC ở cùng scene có mục tiêu/câu hỏi/thông tin tự nhiên cần chủ động nêu;
- card/worldbook/extension-state đang chủ động dẫn mainline.

ACTIVE_INTERACTION thường ưu tiên interaction hiện tại thay vì nhồi event khác.
EXPLICIT_DOWNTIME được phép mode=NONE.

4. PASSIVE TRANSIT / REST KHÔNG ĐƯỢC BIẾN THÀNH FILLER
PASSIVE_TRANSIT:
- ưu tiên arrival/waypoint/canon intersection/NPC initiative/world signal có hậu quả thật.
- open direction = user đã ủy quyền route cục bộ; được chọn waypoint hợp lý.

PASSIVE_REST:
- không tự viết mơ/suy nghĩ user;
- nhưng thời gian được tiến tới natural rest milestone hoặc world/NPC process có thể diễn ra quanh scene;
- không để cả generation chỉ "ngủ yên + phong cảnh".

Nếu không có canon event đủ dữ kiện:
- KHÔNG bịa major canon milestone.
- Dùng local low-commitment beat phù hợp card/setting/NPC goal/travel process, hoặc natural progress tới waypoint.
- Một beat nhỏ nhưng thật tốt hơn một trailer ending.

5. CARD / EXTENSION STATE LÀ NGUỒN PLOT HỢP LỆ
Bạn được cung cấp:
- CHARACTER/CARD DIRECTIVES;
- ACTIVE WORLD INFO;
- CURRENT EXTENSION PROMPTS (ví dụ database/state/story/memory modules đang inject cho main model).
Nếu các nguồn này nói card chủ động đẩy mainline hoặc chứa current world-state/event, PHẢI xem đó là plot-drive evidence.
Không được trả seed=NONE chỉ vì event không nằm trong previous future outline.

6. DECISION BOUNDARY
- Seed/world action phải xuất hiện TRƯỚC.
- Sau đó stop_boundary mới chặn decision quan trọng của user.
- Không được suy "event cần user phản ứng -> không tạo event".

7. NO USER FABRICATION
- Seed chỉ điều khiển WORLD/NPC.
- Không tự kích hoạt user ability/effect, không cấp hidden knowledge, không status-flex, không narrator praise.

8. FUTURE OUTLINE
- objective_locked / conditional là TƯƠNG LAI.
- next_hidden_step không phải current seed.
- subtle_sign chỉ dùng khi event chưa tới hạn.
- Butterfly phá prerequisite -> DIVERGED/INVALIDATED; phần còn nguyên vẫn chạy.

9. OUTPUT JSON ONLY — SCHEMA v5
{
  "version": 5,
  "scene_seed": {
    "scene_state": "ACTIVE_INTERACTION|EXPLICIT_DOWNTIME|PASSIVE_TRANSIT|PASSIVE_REST|STATIC_AFTER_ACTION|WORLD_BEAT_DUE",
    "mode": "MANDATORY_EARLY|OPTIONAL_EARLY|NONE",
    "event": "",
    "source": "",
    "why_now": "",
    "entry_action": "",
    "interaction_vector": "",
    "state_delta": "",
    "stop_boundary": "",
    "involved": [],
    "conditions_verified": []
  },
  "objective_locked": [],
  "conditional": [],
  "retired": []
}
Không markdown. Không giải thích ngoài JSON.`

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
      .replace(/<external_future_outline>[\s\S]*?<\/external_future_outline>/gi, '')
      .replace(/<external_scene_hook[\s\S]*?<\/external_scene_hook>/gi, '')
      .replace(/<external_scene_seed[\s\S]*?<\/external_scene_seed>/gi, '');
  }

  function compactMessage(text) {
    let value = stripPrivateBlocks(text)
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .trim();
    if (value.length > 9000) value = value.slice(-9000);
    return value;
  }

  function boundedText(label, value, cap = 6000) {
    const s = String(value || '').trim();
    return s ? `${label}:\n${s.slice(0, cap)}` : '';
  }

  function embeddedCharacterBookSnapshot(d) {
    try {
      const book = d?.character_book;
      const entries = Array.isArray(book?.entries) ? book.entries : [];
      const chunks = [];
      let used = 0;
      for (const e of entries) {
        if (!e || e.enabled === false) continue;
        const title = String(e.comment || e.name || '').trim();
        const keys = Array.isArray(e.keys) ? e.keys.join(', ') : '';
        const body = String(e.content || '').trim();
        if (!body) continue;
        const piece = `[CARD BOOK] ${title}${keys ? ` | keys=${keys}` : ''}\n${body}\n`;
        if (used + piece.length > 18000) break;
        chunks.push(piece);
        used += piece.length;
      }
      return chunks.join('\n');
    } catch (_) { return ''; }
  }

  function currentCharacterSnapshot(ctx) {
    try {
      const id = ctx.characterId;
      const ch = id !== undefined && id !== null ? ctx.characters?.[Number(id)] : null;
      if (!ch) return '';
      const d = ch.data || ch;
      const ext = d.extensions || {};
      const depthPrompt = typeof ext?.depth_prompt === 'string'
        ? ext.depth_prompt
        : (ext?.depth_prompt?.prompt || ext?.depth_prompt?.value || '');

      const parts = [
        `Name: ${d.name || ch.name || ''}`,
        boundedText('Description', d.description, 7000),
        boundedText('Personality', d.personality, 5000),
        boundedText('Scenario', d.scenario, 7000),
        boundedText('System Prompt', d.system_prompt, 9000),
        boundedText('Post History Instructions', d.post_history_instructions, 9000),
        boundedText('Depth Prompt', depthPrompt, 6000),
        boundedText('First Message', d.first_mes, 5000),
        boundedText('Message Examples', d.mes_example, 7000),
        embeddedCharacterBookSnapshot(d),
      ].filter(Boolean);
      return parts.join('\n\n').slice(0, 42000);
    } catch (_) { return ''; }
  }

  function currentExtensionPromptSnapshot(ctx) {
    try {
      const bag = ctx?.extensionPrompts || window?.extension_prompts || window?.extensionPrompts || {};
      const rows = [];
      for (const [id, item] of Object.entries(bag || {})) {
        if (/^miemie_external_future_outline/i.test(id)) continue;
        const value = typeof item === 'string' ? item : String(item?.value ?? item?.content ?? '');
        const text = value.trim();
        if (!text) continue;
        const priority = /(database|state|story|plot|world|lore|memory|event|timeline|mvu|auto|chronicle|planner)/i.test(id) ? 0 : 1;
        rows.push({ id, text, priority });
      }
      rows.sort((a,b) => a.priority - b.priority || a.id.localeCompare(b.id));

      const chunks = [];
      let used = 0;
      for (const row of rows) {
        const piece = `[EXTENSION PROMPT: ${row.id}]\n${row.text.slice(0, 12000)}\n`;
        if (used + piece.length > 36000) {
          if (row.priority === 0 && used < 34000) {
            const remain = Math.max(0, 36000 - used);
            if (remain > 300) chunks.push(piece.slice(0, remain));
          }
          break;
        }
        chunks.push(piece);
        used += piece.length;
      }
      return chunks.join('\n');
    } catch (_) { return ''; }
  }

  function shortHash(input) {
    let h1 = 0xdeadbeef ^ 0, h2 = 0x41c6ce57 ^ 0;
    const s = String(input || '');
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return ((h2 >>> 0).toString(36) + (h1 >>> 0).toString(36)).slice(0, 14);
  }

  function messageBranchToken(m, i) {
    const role = m?.is_user ? 'U' : (m?.is_system ? 'S' : 'A');
    const swipe = Number.isInteger(m?.swipe_id) ? m.swipe_id : -1;
    const mes = stripPrivateBlocks(String(m?.mes || ''));
    return `${i}:${role}:${swipe}:${shortHash(mes)}:${mes.length}`;
  }

  function branchKeyFromMessages(messages) {
    const arr = Array.isArray(messages) ? messages : [];
    return `b${arr.length}_${shortHash(arr.map(messageBranchToken).join('|'))}`;
  }

  function latestUserIndex(messages) {
    for (let i = (messages?.length || 0) - 1; i >= 0; i--) {
      if (messages[i]?.is_user) return i;
    }
    return -1;
  }

  function userTurnId(messages) {
    const i = latestUserIndex(messages);
    if (i < 0) return 'turn:none';
    return `turn:${i}:${shortHash(String(messages[i]?.mes || ''))}`;
  }

  function parentBranchKey(messages) {
    const i = latestUserIndex(messages);
    if (i < 0) return branchKeyFromMessages([]);
    return branchKeyFromMessages(messages.slice(0, i));
  }

  function isRerollType(type) {
    const t = String(type || '').toLowerCase();
    return t.includes('swipe') || t.includes('regenerate');
  }

  function isContinueType(type) {
    return String(type || '').toLowerCase().includes('continue');
  }

  function isQuietLikeType(type) {
    const t = String(type || '').toLowerCase();
    return t.includes('quiet') || t.includes('impersonate');
  }

  function generationBaseMessages(ctx, type = '', { manual = false } = {}) {
    const chat = Array.isArray(ctx?.chat) ? ctx.chat.slice() : [];
    if (manual) return chat;
    if (isRerollType(type) && chat.length && !chat[chat.length - 1]?.is_user) {
      chat.pop(); // rejected/selected assistant swipe is not reroll input
    }
    return chat;
  }

  function emptyBranchStore() {
    return { storeVersion: 1, outlineSchema: 5, candidates: {}, heads: {}, updatedAt: null };
  }

  function getBranchStore(ctx = stContext()) {
    const raw = ctx?.chatMetadata?.[META_KEY];
    if (!raw || typeof raw !== 'object' || Number(raw.storeVersion) !== 1) return emptyBranchStore();
    return {
      storeVersion: 1,
      outlineSchema: 5,
      candidates: raw.candidates && typeof raw.candidates === 'object' ? raw.candidates : {},
      heads: raw.heads && typeof raw.heads === 'object' ? raw.heads : {},
      updatedAt: raw.updatedAt || null,
    };
  }

  function validOutline(outline) {
    return outline && typeof outline === 'object' && Number(outline.version) === 5;
  }

  function pruneBranchStore(store) {
    const candidates = Object.entries(store.candidates || {})
      .filter(([,v]) => validOutline(v?.outline))
      .sort((a,b) => String(b[1]?.updatedAt || '').localeCompare(String(a[1]?.updatedAt || '')))
      .slice(0, 18);
    store.candidates = Object.fromEntries(candidates);
    const allowed = new Set(Object.keys(store.candidates));
    const heads = Object.entries(store.heads || {})
      .filter(([,v]) => v?.baseKey && allowed.has(v.baseKey))
      .sort((a,b) => String(b[1]?.updatedAt || '').localeCompare(String(a[1]?.updatedAt || '')))
      .slice(0, 32);
    store.heads = Object.fromEntries(heads);
    store.updatedAt = new Date().toISOString();
    return store;
  }

  async function saveBranchStore(ctx, store) {
    if (!ctx?.chatMetadata) return;
    ctx.chatMetadata[META_KEY] = pruneBranchStore(store);
    await ctx.saveMetadata?.();
  }

  function candidateForBase(ctx, baseKey) {
    const c = getBranchStore(ctx).candidates?.[baseKey];
    return validOutline(c?.outline) ? c : null;
  }

  function headForFullBranch(ctx, fullKey) {
    const store = getBranchStore(ctx);
    const h = store.heads?.[fullKey];
    if (!h?.baseKey) return null;
    const c = store.candidates?.[h.baseKey];
    return validOutline(c?.outline) ? { ...c, baseKey:h.baseKey, fullKey } : null;
  }

  function outlineForCurrentBranch(ctx = stContext()) {
    const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
    if (!chat.length) return null;
    const last = chat[chat.length - 1];
    if (last?.is_user) return candidateForBase(ctx, branchKeyFromMessages(chat));
    return headForFullBranch(ctx, branchKeyFromMessages(chat));
  }

  function branchMetaForCurrent(ctx = stContext()) {
    const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
    if (!chat.length) return null;
    const last = chat[chat.length - 1];
    if (last?.is_user) {
      const baseKey = branchKeyFromMessages(chat);
      const c = candidateForBase(ctx, baseKey);
      return c ? { ...c, baseKey, source:'candidate' } : null;
    }
    return headForFullBranch(ctx, branchKeyFromMessages(chat));
  }

  function parentOutlineForBase(ctx, baseMessages) {
    const store = getBranchStore(ctx);
    const pKey = parentBranchKey(baseMessages);
    const h = store.heads?.[pKey];
    if (!h?.baseKey) return null;
    const c = store.candidates?.[h.baseKey];
    return validOutline(c?.outline) ? c.outline : null;
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

  async function activeWorldInfoSnapshot(ctx, messagesOverride = null) {
    if (!ctx?.getWorldInfoPrompt) return '';
    try {
      const chat = Array.isArray(messagesOverride) ? messagesOverride : (Array.isArray(ctx.chat) ? ctx.chat : []);
      const n = Math.max(8, Math.min(40, Number(config.historyMessages) || 18));
      const source = chat.slice(-n)
        .map(m => `${m.name || (m.is_user ? ctx.name1 : ctx.name2) || ''}: ${stripPrivateBlocks(m.mes || '')}`)
        .reverse();
      const wi = await ctx.getWorldInfoPrompt(source, Number(ctx.maxContext) || 200000, true);
      if (!wi || typeof wi !== 'object') return '';
      const chunks = [];
      for (const key of ['worldInfoBefore','worldInfoAfter','anBefore','anAfter','worldInfoString','worldInfoExamples']) {
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

  async function plannerInput(ctx, opts = {}) {
    const chat = Array.isArray(opts.baseMessages) ? opts.baseMessages : (Array.isArray(ctx?.chat) ? ctx.chat : []);
    const n = Math.max(4, Math.min(40, Number(config.historyMessages) || 18));
    const recent = chat.slice(-n).map((m, i) => {
      const role = m.is_user ? 'USER' : (m.is_system ? 'SYSTEM' : 'ASSISTANT');
      return `[${role} ${chat.length - n + i}]\n${compactMessage(m.mes || '')}`;
    }).join('\n\n');
    const previous = validOutline(opts.previousOutline) ? opts.previousOutline : null;
    const wi = await activeWorldInfoSnapshot(ctx, chat);
    const extPrompts = currentExtensionPromptSnapshot(ctx);

    const modeText = opts.isReroll
      ? `REROLL/REGENERATE OF THE SAME USER TURN
turn_id=${opts.turnId}
branch_base=${opts.baseKey}
- The rejected assistant swipe is intentionally absent from selected-branch chat.
- Discard every event/result/choice/seed-progress assumption that exists only because of that rejected swipe.
- The latest USER message is the SAME turn being regenerated, not a new choice after the rejected result.
- The parent outline below comes from the accepted branch BEFORE this user turn, never from the rejected candidate.`
      : `NORMAL GENERATION
turn_id=${opts.turnId || userTurnId(chat)}
branch_base=${opts.baseKey || branchKeyFromMessages(chat)}
- Use only the currently selected visible branch.`;

    return [
      '=== BRANCH / TURN IDENTITY ===', modeText,
      '=== CHARACTER / SETTING SNAPSHOT ===',
      currentCharacterSnapshot(ctx) || '(none)',
      ctx?.chatMetadata?.scenario ? `Chat scenario: ${String(ctx.chatMetadata.scenario).slice(0, 6000)}` : '',
      ctx?.chatMetadata?.persona ? `User persona: ${String(ctx.chatMetadata.persona).slice(0, 6000)}` : '',
      '=== ACTIVE WORLD INFO / LOREBOOK ===', wi || '(none activated)',
      '=== CURRENT EXTENSION PROMPTS / DATABASE / STATE / PLOT DRIVE ===', extPrompts || '(none exposed)',
      '=== ACCEPTED PARENT OUTLINE ===', previous ? JSON.stringify(previous) : '(none)',
      '=== SELECTED-BRANCH RECENT CHAT ===', recent || '(empty)',
      '=== TASK ===',
      `Update schema-v5 planner state for THIS branch/turn only. First classify scene_state and run the state-delta test. Apply newest user ESTABLISH first. Select scene_seed for the next main generation. On reroll, never import the rejected swipe and never reinterpret the repeated latest user input as a new post-result decision. Return JSON only.`,
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

    const retired = Array.isArray(value.retired)
      ? value.retired.slice(0, 12).map(x => ({ id:String(x?.id||''), reason:String(x?.reason||'invalidated') }))
      : [];

    const rawSeed = value.scene_seed && typeof value.scene_seed === 'object' ? value.scene_seed : {};
    const modeRaw = String(rawSeed.mode || 'NONE').toUpperCase();
    const mode = ['MANDATORY_EARLY','OPTIONAL_EARLY','NONE'].includes(modeRaw) ? modeRaw : 'NONE';
    const stateRaw = String(rawSeed.scene_state || 'STATIC_AFTER_ACTION').toUpperCase();
    const scene_state = [
      'ACTIVE_INTERACTION','EXPLICIT_DOWNTIME','PASSIVE_TRANSIT',
      'PASSIVE_REST','STATIC_AFTER_ACTION','WORLD_BEAT_DUE'
    ].includes(stateRaw) ? stateRaw : 'STATIC_AFTER_ACTION';

    const scene_seed = {
      scene_state,
      mode,
      event: String(rawSeed.event || '').trim(),
      source: String(rawSeed.source || '').trim(),
      why_now: String(rawSeed.why_now || '').trim(),
      entry_action: String(rawSeed.entry_action || '').trim(),
      interaction_vector: String(rawSeed.interaction_vector || '').trim(),
      state_delta: String(rawSeed.state_delta || '').trim(),
      stop_boundary: String(rawSeed.stop_boundary || '').trim(),
      involved: cleanStringArray(rawSeed.involved, 12),
      conditions_verified: cleanStringArray(rawSeed.conditions_verified, 10),
    };

    if (scene_seed.mode !== 'NONE') {
      if (!scene_seed.event || !scene_seed.entry_action || !scene_seed.why_now || !scene_seed.stop_boundary || !scene_seed.state_delta) {
        scene_seed.mode = 'NONE';
      }
    }
    if (scene_seed.mode === 'NONE') {
      scene_seed.event = '';
      scene_seed.source = '';
      scene_seed.entry_action = '';
      scene_seed.interaction_vector = '';
      scene_seed.state_delta = '';
      scene_seed.stop_boundary = '';
      scene_seed.involved = [];
      scene_seed.conditions_verified = [];
    }

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
      if (!item.event || !item.cause || !item.activation_conditions.length) {
        if (item.id) retired.push({ id:item.id, reason:'invalidated' });
        continue;
      }
      conditional.push(item);
      if (conditional.length >= 6) break;
    }

    const out = { version: 5, scene_seed, objective_locked: objective, conditional, retired: retired.slice(0, 12) };
    if (JSON.stringify(out).length > 30000) throw new Error('Outline vượt giới hạn 30k ký tự');
    return out;
  }

  async function loadModels() {
    const payload = await fetchJson(apiUrl('models'), { method: 'GET', headers: apiHeaders() }, 20000);
    const list = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
    return [...new Set(list.map(x => typeof x === 'string' ? x : (x?.id || x?.name || '')).filter(Boolean))].slice(0, 500);
  }

  async function callPlanner(ctx, opts = {}) {
    if (!config.model) throw new Error('Chưa chọn model phụ');
    const body = {
      model: config.model,
      messages: [
        { role: 'system', content: PLANNER_SYSTEM },
        { role: 'user', content: await plannerInput(ctx, opts) },
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

  async function injectOutline(ctx, outline, meta = {}) {
    if (!ctx?.setExtensionPrompt) return;
    try {
      for (const id of LEGACY_EXT_PROMPT_IDS) await ctx.setExtensionPrompt(id, '', 1, 0, false, 0);
    } catch (_) {}

    if (!outline || Number(outline.version) !== 5) outline = null;
    const seed = outline?.scene_seed || { mode:'NONE' };
    const baseKey = String(meta.baseKey || '');
    const turnId = String(meta.turnId || '');
    const attempt = Number(meta.attempt || 0);
    const reroll = meta.isReroll ? 'true' : 'false';
    const attrs = ` branch_key="${baseKey}" turn_id="${turnId}" attempt="${attempt}" reroll="${reroll}"`;

    const seedContent = outline ? `<external_scene_seed authority="CURRENT_WORLD_BEAT" mode="${seed.mode}" planner_version="${VERSION}"${attrs}>
[PRIVATE EARLY-SCENE DIRECTIVE — DO NOT REVEAL AS META]
${JSON.stringify(seed)}
</external_scene_seed>` : '';

    const content = outline ? `<external_branch_guard planner_version="${VERSION}"${attrs}>
[SELECTED-BRANCH TRUTH]
- This state belongs ONLY to the currently selected SillyTavern branch and turn.
- Rejected/unselected swipes are NON-CANON.
- On reroll=true, the newest USER input is the SAME turn being regenerated, not a new decision after the rejected response.
- If a recent table/memory/wlog cache claims an event happened but the selected recent chat branch does not support it, treat that cache entry as stale swipe residue.
- Never say "your previous choice" or "chapter-one choice" solely because a rejected swipe/cache remembers it.
</external_branch_guard>
<external_future_outline authority="EXCLUSIVE" mode="EXTERNAL" version="5" planner_version="${VERSION}"${attrs}>
[PRIVATE PLANNER STATE — NEVER REVEAL, SUMMARIZE, OR REWRITE TO USER]
${JSON.stringify(outline)}
</external_future_outline>
${seedContent}
<external_future_outline_lock>
[RUNTIME HANDSHAKE: planner=${VERSION}; schema=5; branch_safe_reroll=true]
1. Future outline governs FUTURE continuity; scene seed governs CURRENT WORLD/NPC entry.
2. The selected visible branch outranks stale recent cache/table/memory residue from rejected swipes.
3. reroll=true means rejected assistant swipes DO NOT EXIST for continuity.
4. MANDATORY_EARLY executes in the first 1-2 prose paragraphs, then the scene develops from it.
5. scene_state=PASSIVE_TRANSIT/PASSIVE_REST/STATIC_AFTER_ACTION is NOT permission for scenery-only output. If seed is NONE, main model must still consult card/worldbook/current extension-state and produce a grounded state delta unless user explicitly requested downtime.
6. Decision boundary applies AFTER the world/NPC action is visible; never suppress a situation merely because user will need to react.
7. NPC_INITIATES means the NPC may actually act/speak; do not summarize the whole exchange.
8. No dialogue quota.
9. Scene seed never authorizes user ability activation/effects, hidden knowledge, status flex, or narrator praise.
10. seed=NONE does not freeze card/worldbook/world-backbone agency.
11. next_hidden_step remains future-only.
12. USER AUTHORITY remains highest for user-established facts.
13. Canon encounters remain valid when route/time/location + prerequisites intersect.
14. Skip competing INTERNAL future outline; output <future_outline>[Mode]: EXTERNAL</future_outline>.
</external_future_outline_lock>` : '';

    await ctx.setExtensionPrompt(EXT_PROMPT_ID, content, 1, 0, false, 0);
  }

  let plannerEpoch = 0;

  async function persistCandidate(ctx, meta, outline) {
    if (!ctx?.chatMetadata || !validOutline(outline)) return null;
    const store = getBranchStore(ctx);
    const old = store.candidates?.[meta.baseKey];
    const attempt = Number(old?.attempt || 0) + 1;
    store.candidates[meta.baseKey] = {
      outline,
      baseKey: meta.baseKey,
      parentKey: meta.parentKey,
      turnId: meta.turnId,
      attempt,
      isReroll: !!meta.isReroll,
      updatedAt: new Date().toISOString(),
      model: config.model,
      plannerVersion: VERSION,
    };
    await saveBranchStore(ctx, store);
    return store.candidates[meta.baseKey];
  }

  async function recordCurrentAssistantBranch(ctx = stContext()) {
    if (!ctx?.chatMetadata || !Array.isArray(ctx.chat) || !ctx.chat.length) return;
    const chat = ctx.chat;
    const last = chat[chat.length - 1];
    if (last?.is_user || last?.is_system) return;
    const fullKey = branchKeyFromMessages(chat);
    const baseKey = branchKeyFromMessages(chat.slice(0, -1));
    const store = getBranchStore(ctx);
    if (!validOutline(store.candidates?.[baseKey]?.outline)) return;
    store.heads[fullKey] = {
      baseKey,
      updatedAt: new Date().toISOString(),
      swipeId: Number.isInteger(last?.swipe_id) ? last.swipe_id : -1,
      messageIndex: chat.length - 1,
    };
    await saveBranchStore(ctx, store);
  }

  async function runPlanner({ manual = false, generationType = '' } = {}) {
    if (busy) return;
    const ctx = stContext();
    if (!ctx) { setStatus('Không lấy được SillyTavern context'); return; }
    if (!config.enabled && !manual) { await injectOutline(ctx, null); return; }

    const isReroll = !manual && isRerollType(generationType);
    const baseMessages = generationBaseMessages(ctx, generationType, { manual });
    const baseKey = branchKeyFromMessages(baseMessages);
    const parentKey = parentBranchKey(baseMessages);
    const turnId = userTurnId(baseMessages);
    const previousOutline = parentOutlineForBase(ctx, baseMessages);
    const existingSameBase = candidateForBase(ctx, baseKey);
    const epoch = ++plannerEpoch;

    if (!config.baseUrl || !config.model) {
      if (existingSameBase && !isReroll) {
        await injectOutline(ctx, existingSameBase.outline, { ...existingSameBase, baseKey, turnId, isReroll:false });
        setStatus('Thiếu Base URL/model; chỉ dùng candidate của ĐÚNG branch hiện tại.');
      } else {
        await injectOutline(ctx, null);
        setStatus(isReroll
          ? 'Reroll: thiếu Base URL/model; đã fail-closed, KHÔNG tái dùng candidate của swipe bị loại.'
          : 'Thiếu Base URL/model; branch hiện tại chưa có candidate.');
      }
      return;
    }

    busy = true;
    setStatus(isReroll ? `Reroll-safe: tính fresh ${turnId}` : `Đang tính đại cương ${turnId}`);
    try {
      const outline = await callPlanner(ctx, {
        baseMessages, previousOutline, baseKey, parentKey, turnId, isReroll,
      });

      const liveCtx = stContext();
      if (epoch !== plannerEpoch || !liveCtx) return;
      const liveBaseKey = branchKeyFromMessages(generationBaseMessages(liveCtx, generationType, { manual }));
      if (liveBaseKey !== baseKey) {
        setStatus('Bỏ kết quả planner: branch đã đổi trong lúc model phụ đang chạy.');
        return;
      }

      const saved = await persistCandidate(liveCtx, { baseKey, parentKey, turnId, isReroll }, outline);
      await injectOutline(liveCtx, outline, {
        baseKey, parentKey, turnId, isReroll, attempt:saved?.attempt || 1,
      });
      setStatus(`${isReroll ? 'REROLL FRESH' : 'Đã cập nhật'} · ${turnId} · attempt ${saved?.attempt || 1} · scene=${outline.scene_seed?.scene_state || '?'} · seed=${outline.scene_seed?.mode || 'NONE'}`);
      renderPreview();
    } catch (e) {
      if (!isReroll && existingSameBase?.outline) {
        await injectOutline(ctx, existingSameBase.outline, { ...existingSameBase, baseKey, turnId, isReroll:false });
        setStatus(`Model phụ lỗi; chỉ fallback candidate CÙNG branch. ${e?.message || e}`);
      } else {
        await injectOutline(ctx, null);
        setStatus(`${isReroll ? 'Reroll lỗi; candidate swipe cũ đã bị loại và KHÔNG fallback.' : 'Model phụ lỗi; không có candidate cùng branch.'} ${e?.message || e}`);
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
      <div class="mfp-note">Planner chỉ lập đại cương kín. Nếu endpoint chặn CORS, hãy dùng URL proxy có cho phép browser request. Planner state theo branch/swipe. Schema v5 adds scene-state + WORLD PULSE and reads card/worldbook/current extension prompts (database/state/plot-drive) so passive scenes cannot hide behind filler.</div>
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
    q('#mfp-copy').onclick = async () => { const out = branchMetaForCurrent()?.outline || null; if (!out) return setStatus('Branch hiện tại chưa có outline để copy'); try { await navigator.clipboard.writeText(JSON.stringify(out, null, 2)); setStatus('Đã copy outline JSON'); } catch (_) { setStatus('Không copy được qua clipboard API'); } };
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
    const env = branchMetaForCurrent();
    const outline = validOutline(env?.outline) ? env.outline : null;
    if (q('#mfp-preview')) q('#mfp-preview').value = outline ? JSON.stringify(outline, null, 2) : '';
    if (q('#mfp-meta')) {
      q('#mfp-meta').textContent = env
        ? `Branch ${env.baseKey || '?'} · ${env.turnId || '?'} · attempt ${env.attempt || '?'} · ${env.isReroll ? 'reroll' : 'normal'} · planner v${env.plannerVersion || VERSION}`
        : 'Branch hiện tại chưa có snapshot. Outline từ branch/swipe khác sẽ không được dùng.';
    }
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
      for (const key of LEGACY_META_KEYS) delete ctx.chatMetadata[key];
      await ctx.saveMetadata?.();
    }
    plannerEpoch++;
    await injectOutline(ctx, null);
    setStatus('Đã xóa toàn bộ planner state của mọi branch trong chat này');
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
    const receivedEvent = types.MESSAGE_RECEIVED || types.message_received || 'message_received';
    const swipedEvent = types.MESSAGE_SWIPED || types.message_swiped || 'message_swiped';
    const editedEvent = types.MESSAGE_EDITED || types.message_edited || 'message_edited';
    const deletedEvent = types.MESSAGE_DELETED || types.message_deleted || 'message_deleted';

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

      if (isQuietLikeType(type)) {
        await injectOutline(stContext(), null);
        return;
      }

      if (isContinueType(type)) {
        const current = outlineForCurrentBranch(stContext());
        if (current?.outline) await injectOutline(stContext(), current.outline, { ...current, isReroll:false });
        else await injectOutline(stContext(), null);
        return;
      }

      // Normal + Swipe + Regenerate all run planner.
      // Reroll is fresh from accepted parent; rejected candidate is NOT previous state.
      await runPlanner({ generationType:type });
    });

    onFn(receivedEvent, async () => {
      setTimeout(async () => {
        try { await recordCurrentAssistantBranch(stContext()); } catch (_) {}
        renderPreview();
      }, 0);
    });

    onFn(swipedEvent, async () => {
      plannerEpoch++;
      await injectOutline(stContext(), null);
      renderPreview();
    });

    const invalidateOnMutation = async () => {
      plannerEpoch++;
      await injectOutline(stContext(), null);
      renderPreview();
    };
    onFn(editedEvent, invalidateOnMutation);
    onFn(deletedEvent, invalidateOnMutation);

    onFn(chatEvent, async () => {
      plannerEpoch++;
      await injectOutline(stContext(), null);
      setTimeout(() => renderPreview(), 80);
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
  await injectOutline(stContext(), null);

  window[SCRIPT_KEY] = { version: VERSION, open: openUi, run: () => runPlanner({ manual:true, generationType:'manual' }), cleanup, getConfig: () => ({...config}) };
  try { hostWindow.__MIEMIE_FUTURE_PLANNER_RUNTIME__ = { version: VERSION, schema: 5, branchSafeReroll: true, worldPulseContext: true, loadedAt: new Date().toISOString() }; } catch (_) {}
  console.info(`[Miemie Future Planner] loaded v${VERSION}; schema=5; branch-safe-reroll=ON; UI host=${hostDocument === document ? 'script-frame' : 'parent-document'}`);
})();
