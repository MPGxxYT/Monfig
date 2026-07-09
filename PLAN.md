# Monfig — Bug/Improvement Plan

Compiled 2026-07-08 from a full code review. Ordered by severity.
Status: `[ ]` todo · `[x]` done · `[-]` skipped/deferred.

## Critical — file corruption / crash

- [x] 1. **Multi-line TOML arrays corrupt the file on edit** (`parser.ts`, `serializer.ts`). Parser only sees `[` on the first line; editing replaces line 1 and orphans the remaining `"item",` / `]` lines → broken TOML.
- [x] 2. **Conditional React hook crashes the sidebar** (`Sidebar.tsx`). `useState` after an early `return null`; toggling variant filter / hide-empty changes hook count → React throws.
- [x] 3. **String values containing `#` get truncated into comments** (`serializer.ts`). Replace regex treats first ` #` as inline comment; editing `key = "a #b"` corrupts the line.
- [x] 4. **TOML inline comments break type detection** (`parser.ts`). `speed = 1.5 # note` parses as string; re-saving writes it back quoted.

## High — data loss / broken core flows

- [x] 5. **Mod view editing/saving broken.** Edits in ModPage were silent no-ops (no filePath passed through), and there was no Save button / Ctrl+S path outside single-file view. Fix: wire filePath per file in ModPage; Save now saves all modified files ("Save all (n)").
- [x] 6. **Unsaved changes silently discarded** — switching/removing modpacks and closing the window now confirm first (native ask dialog).
- [x] 7. **Subdirectories ignored** (`fs.ts`). `readDir` not recursive; nested configs (`config/modname/*.toml`) never appear. Fix: recursive listing (depth ≤ 3), group nested files by top-level folder.
- [x] 8. **`.properties` files using `:` separator can't be written** — serializer required `=`, edit silently no-oped. Fix: quote/comment-aware value replacement per file type; also stop force-quoting strings in properties/cfg.

## Medium — correctness / behavior

- [x] 12. **Floats saved as ints** (`String(2.0)` → `"2"`, changes TOML type). Fixed alongside serializer rewrite (writes `2.0`).
- [x] 9. **TOML keys with dashes or quotes are invisible** — parser now accepts `[\w-]+` bare keys and `"quoted keys"`.
- [x] 10. **Modpack-switch race can restore stale state** — fixed as part of #5/#6 refactor (generation token replaces shared abort ref).
- [x] 11. **StrictMode double-runs `pushHistory`** — fixed as part of #5 refactor (history pushed outside updaters, ref-backed cache; section/file resets are now a single undo step).
- [x] 13. **JSON handling** — nested objects editable to depth 5; saves preserve the file's indentation style and trailing newline (still a re-serialize, noted in README).
- [x] 14. **Search result click jumps to the setting** — wired into `navigateToSetting` (opens file, switches tab, scrolls, flashes card).
- [x] 15. **Undo granularity** — bursts of typed edits to the same setting (< 1.2 s apart) coalesce into one undo frame; toggles/selects/resets stay individual.
- [x] 16. **Files outside home folder** — added `tauri-plugin-persisted-scope`; folders picked via the dialog extend the fs scope at runtime and persist across restarts.
- [x] 17. **Old Forge `.cfg` support** — `B:/I:/D:/S:` type prefixes, nested `name { }` blocks, `[range: …, default: …]` comment metadata; `S:key < … >` lists are skipped (not editable).
- [x] 18. **Caps Lock breaks undo** — shortcuts compare lowercased keys.

## QoL / polish

- [x] 19. Keyboard navigation in global search — arrows/Enter, selected row highlighted and kept in view.
- [x] 20. Indexing: 8 parallel readers, progressive cache commits (files usable mid-index), "Still indexing…" placeholder instead of the welcome screen, plus a "couldn't read" state for unparseable files.
- [x] 21. `.json5` support — line-based parser (comments → descriptions, nested objects, multi-line arrays, quoted `mod:id` keys); saves are surgical like TOML, comments preserved.
- [x] 22. Number inputs clamp to range on blur (and round integers); out-of-range values aren't emitted while typing.
- [x] 23. Duplicate keys disambiguated by lineIndex/occurrence — each card edits its own line.
- [x] 24. Housekeeping: package.json version 0.1.0 (matches tauri.conf), `.claude/` gitignored, eslint config fixed (ignore `.claude`, set tsconfigRootDir), README updated (json5, JSON re-serialize note).
  - [ ] Stale worktrees NOT removed (permission denied) — run manually:
    `git worktree remove --force .claude/worktrees/hardcore-solomon-7bbd75`
    `git worktree remove --force .claude/worktrees/tender-boyd-7950f1`
    `git branch -D claude/hardcore-solomon-7bbd75 claude/tender-boyd-7950f1`
  - [ ] Pre-existing lint findings remain: ~10 `set-state-in-effect` / ref-in-render / fast-refresh warnings (style-grade, in App/GlobalSearch/SettingsPage/SettingField/Sidebar/Toast).
