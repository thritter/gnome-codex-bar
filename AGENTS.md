## Project Overview

GNOME Shell extension ("CodexBar Usage Monitor") that displays Codex and Claude API usage limits in the GNOME top bar. 
It polls the `codexbar` CLI tool (`/usr/local/bin/codexbar`) every 5 minutes and shows color-coded usage percentages 
with a dropdown for details.

- **UUID**: `codexbar@gnome-codex-bar`
- **Target**: GNOME Shell 46
- **Language**: GJS (GNOME JavaScript with GObject Introspection)

## Architecture

Single-file extension (`extension.js`) using GNOME Shell's extension API.
Also: `prefs.js` for the preferences window (Adw/libadwaita widgets).

- `CodexBarExtension` — Entry point; manages lifecycle (`enable`/`disable`) and polling timer
- `CodexBarIndicator` — `PanelMenu.Button` subclass; renders the panel label and dropdown menu
- `runCommand()` — Async wrapper around `Gio.Subprocess` that shells out to `codexbar` CLI and parses JSON output
- `PROVIDERS` array defines the two monitored providers (Codex and Claude) with their CLI args

The extension calls `codexbar usage --provider <name> --source <source> --format json` 
and expects JSON with `usage.primary.usedPercent`, `usage.secondary.usedPercent`, and optional `credits.remaining`.

## Development

### Install for testing

```bash
# Symlink into GNOME extensions directory
ln -sf "$(pwd)" ~/.local/share/gnome-shell/extensions/codexbar@gnome-codex-bar
```

### Reload after changes

- After changing gschema XML: `glib-compile-schemas schemas/`
- On Wayland: log out and back in
- On X11: `Alt+F2` → `r` → Enter

### View logs

```bash
journalctl -f -o cat /usr/bin/gnome-shell
# or filter for extension output:
journalctl -f -o cat /usr/bin/gnome-shell | grep -i codex
```

## Key Conventions

- Uses ESM imports (`import ... from 'gi://...'` and `resource:///org/gnome/shell/...`)
- GObject class registration via `GObject.registerClass`
- Styling in `stylesheet.css` using St (Shell Toolkit) CSS classes
- `St.Icon` with `Gio.FileIcon` does NOT apply CSS `color` to SVGs — even with `fill="currentColor"`. Use pre-colored SVG variants and swap `icon.gicon` instead.
- Colored icon variants follow the pattern `{provider}_{color}.svg` (e.g. `codex_green.svg`, `claude_red.svg`)
- Color thresholds: green (<50%), yellow (50-80%), red (>80%)

## Display Modes

Controlled by `display-mode` GSettings key (`text` or `icons`).
- **text**: Panel shows `CX:46% CL:92%` colored by max usage
- **icons**: Panel shows Codex/Claude SVG icons, each colored per-provider by its own usage level
