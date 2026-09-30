# Miemie Future Planner v1.3.0

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


## v1.3.0 strict migration
- Uses schema-v2 metadata/injection IDs so stale v1 outlines cannot survive.
- Deletes legacy chat metadata and legacy extension prompt on load.
- Refuses to inject any outline whose `version` is not `2`.
- Adds runtime handshake `planner_version=1.2.0` to the injected tag.
- Keeps canon protagonist encounters out of `objective_locked`.


## v1.3.0
- Current explicit user intent is not converted into a conditional obstacle thread.
- No invented travel/booking/legal/account/NPC-veto friction without established facts.
- Conditional gates must be grounded in existing world state.
