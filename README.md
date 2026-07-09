# Monfig

A desktop app for editing Minecraft modpack config files without going insane.

If you've ever spent twenty minutes hunting through `.toml` files just to flip one setting, this is for you.

---

## What it does

Point it at a `config/` folder and it shows every setting across every mod in a clean grid with labels, descriptions, default values, and range hints all surfaced from the comments already in the files. No more reading raw TOML by hand.

**Supports:** `.toml`, `.properties`, `.cfg`, `.conf`, `.ini`, `.json`, `.json5`

---

## Features

**Browsing**
- Mods are automatically grouped by name, so `create-client.toml` and `create-common.toml` live together under one entry
- Filter by variant (client / server / common), hide empty configs, pin frequently-used mods to the top

**Editing**
- Every value type gets the right input: toggles for booleans, number fields with range display, dropdowns for enums, and a pop-up editor for arrays
- Changes are tracked per-file with a pink dot on anything unsaved
- Reset individual settings, whole sections, or an entire file back to defaults. The reset button only shows up when something actually differs from the default

**Search**
- `Ctrl+F` opens a full indexed search across every setting in the modpack
- With a file open, just start typing and it filters inline. No need to click anything.
- From the modpack or mod view, start typing and the global search opens with your first character already in the box

**History**
- `Ctrl+Z` / `Ctrl+Y` to undo and redo
- Each undo/redo shows a toast with exactly what changed and a "Go to setting" link that scrolls to the card and flashes it orange so you can't miss it

---

## Getting started

```
pnpm install
pnpm tauri dev
```

Click **+** in the sidebar to add a modpack. Point it at the `config/` folder inside your modpack directory or the modpack folder itself, it'll figure it out.

---

## Building

```
pnpm tauri build
```

Output lands in `src-tauri/target/release/bundle/`.

---

## Stack

- **Tauri**: Rust backend, native file access, small binary
- **React + TypeScript**: Vite for dev and build
- **Tailwind CSS**

---

## A couple things to know

Monfig only ever writes back to the exact line it changed. It doesn't reformat, reorder, or touch anything else in the file. The one exception is plain `.json` files, which are re-serialized on save (key order and indentation are preserved).

Arrays are handled on a best-effort basis. Config formats don't agree on how to write them, so the editor parses what it can and tries to preserve the original format on save. If something looks off, check the raw file.
