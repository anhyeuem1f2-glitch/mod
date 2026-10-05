# Miemie Future Planner v1.5.0

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


## v1.5.0 strict migration
- Uses schema-v2 metadata/injection IDs so stale v1 outlines cannot survive.
- Deletes legacy chat metadata and legacy extension prompt on load.
- Refuses to inject any outline whose `version` is not `2`.
- Adds runtime handshake `planner_version=1.2.0` to the injected tag.
- Keeps canon protagonist encounters out of `objective_locked`.


## v1.5.0
- Current explicit user intent is not converted into a conditional obstacle thread.
- No invented travel/booking/legal/account/NPC-veto friction without established facts.
- Conditional gates must be grounded in existing world state.


## v1.5.0
- User ESTABLISH input is the highest-authority immutable causal root.
- Planner applies user state first, then derives all consequences from post-user state.
- Old world facts/canon/NPC opposition cannot veto declarative user input.
- ATTEMPT remains calculable only for unresolved outcomes.


## v1.5.0 FORCE VERIFY
- Adds a visible build marker and VERIFY_V1.4.1.txt so overwrite/push issues are obvious.


## v1.5.0 FIX
- Fixes JavaScript syntax error `Unexpected identifier s` caused by the apostrophe in `user's` inside a single-quoted JavaScript string.
- `node --check dist/index.js` passes.


## v1.5.0 CANON BACKBONE
- Restores autonomous canon/world progression after user state is applied.
- Valid canon encounters are allowed when time/location/route prerequisites intersect.
- Open-direction user travel can be guided toward the nearest valid canon/world hook.
- Removes the overcorrection that made every event depend on user causation.
