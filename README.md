# Miemie Future Planner v1.8.0

Bản strict planner dùng cho preset Miemie.

## Thay đổi chính
- EXTERNAL outline là nguồn duy nhất khi planner bật; inject cố định ở depth 0.
- Canon timeline không còn được phép biến thành sự kiện bắt buộc của `<user>`.
- OBJECTIVE_LOCKED phải vượt bài test độc lập với `<user>`, nếu không sẽ bị loại.
- CONDITIONAL bắt buộc có activation + cancel conditions.
- Dấu hiệu kín được hậu kiểm bằng regex/heuristic trong script: loại bóng người quan sát, ánh mắt theo dõi, lời báo hiệu, suy luận thay user và tên tác nhân tương lai.
- Nếu model phụ trả outline sai schema/logic, sanitizer loại tuyến sai thay vì chuyển nguyên xi cho model chính.

## Cập nhật GitHub
Ghi đè `dist/index.js`, hai file trong `release/`, và README rồi push. Preset GitHub loader hiện tại sẽ tự tải `dist/index.js` mới sau reload SillyTavern.


## v1.8.0 strict migration
- Uses schema-v2 metadata/injection IDs so stale v1 outlines cannot survive.
- Deletes legacy chat metadata and legacy extension prompt on load.
- Refuses to inject any outline whose `version` is not `2`.
- Adds runtime handshake `planner_version=1.2.0` to the injected tag.
- Keeps canon protagonist encounters out of `objective_locked`.


## v1.8.0
- Current explicit user intent is not converted into a conditional obstacle thread.
- No invented travel/booking/legal/account/NPC-veto friction without established facts.
- Conditional gates must be grounded in existing world state.


## v1.8.0
- User ESTABLISH input is the highest-authority immutable causal root.
- Planner applies user state first, then derives all consequences from post-user state.
- Old world facts/canon/NPC opposition cannot veto declarative user input.
- ATTEMPT remains calculable only for unresolved outcomes.


## v1.8.0 FORCE VERIFY
- Adds a visible build marker and VERIFY_V1.4.1.txt so overwrite/push issues are obvious.


## v1.8.0 FIX
- Fixes JavaScript syntax error `Unexpected identifier s` caused by the apostrophe in `user's` inside a single-quoted JavaScript string.
- `node --check dist/index.js` passes.


## v1.8.0 CANON BACKBONE
- Restores autonomous canon/world progression after user state is applied.
- Valid canon encounters are allowed when time/location/route prerequisites intersect.
- Open-direction user travel can be guided toward the nearest valid canon/world hook.
- Removes the overcorrection that made every event depend on user causation.

## v1.8.0 — CURRENT SCENE HOOK / schema v3
- Adds `scene_hook` with MANDATORY_NOW / OPTIONAL_NOW / NONE.
- MANDATORY_NOW is injected separately as `<external_scene_hook>` and must happen in the next story scene.
- Future outline no longer suppresses card/worldbook current plot-driving instructions.
- Open-direction travel should select a concrete canon/world waypoint instead of endless sailing filler.

## v1.8.0 — schema v4 EARLY SCENE SEED
- Replaces end-of-generation hook behavior with an EARLY scene seed.
- MANDATORY_EARLY must enter within the first 1–2 prose paragraphs, then the scene develops from it.
- Active NPC initiative can seed dialogue naturally; there is no dialogue quota.
- Scene seed cannot authorize user ability effects, hidden knowledge, status flex, or narrator praise.
- Planner future outline and current scene seed are separate responsibilities.

## v1.8.0 — BRANCH / SWIPE SAFE REROLL
- Removes the single chat-global outline architecture.
- Planner candidates are keyed by the exact selected branch and user-turn basis.
- Reroll/regenerate runs the secondary planner fresh from the accepted parent branch.
- Rejected assistant swipe is removed from planner input.
- The previous rejected candidate is never passed back as previous outline.
- Same user message keeps the same turn ID during reroll.
- MESSAGE_RECEIVED binds each completed selected swipe to the exact planner candidate used for it.
- MESSAGE_SWIPED/edit/delete/chat reload clears injected planner state; stale global outline is never auto-restored.
- Async results are discarded when the branch changes mid-call.
- Reroll API failure fails closed instead of falling back to the rejected candidate.
