# CodexBar Usage Monitor

A GNOME Shell extension that displays Codex and Claude API usage limits in the top bar. 
It polls the [`codexbar`](https://github.com/steipete/CodexBar) CLI tool and shows color-coded usage percentages with a dropdown for details.

## Requirements

- GNOME Shell 46
- `codexbar` CLI tool installed (default: `/usr/local/bin/codexbar`)

## Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/gnome-codex-bar.git
cd gnome-codex-bar

# Compile GSettings schemas
glib-compile-schemas schemas/

# Symlink into GNOME extensions directory
ln -sf "$(pwd)" ~/.local/share/gnome-shell/extensions/codexbar@gnome-codex-bar
```

Then restart GNOME Shell:

- **Wayland**: Log out and back in
- **X11**: `Alt+F2` → `r` → Enter

Enable the extension using the GNOME Extensions app or:

```bash
gnome-extensions enable codexbar@gnome-codex-bar
```

## Configuration

Open the extension preferences via the GNOME Extensions app (click the gear icon) to configure:

- **codexbar binary path** — Full path to the `codexbar` executable (default: `/usr/local/bin/codexbar`)
- **Poll interval** — How often to fetch usage data, in seconds (default: 300, range: 30–3600)

Changes take effect immediately without restarting the shell.

## How It Works

The extension calls `codexbar usage --provider <name> --source <source> --format json` for each provider and parses the JSON response. The top bar shows abbreviated usage percentages (e.g. `CX:42% CL:18%`), color-coded by severity:

- **Green** — below 50%
- **Yellow** — 50–80%
- **Red** — above 80%

Clicking the panel label opens a dropdown with detailed breakdowns including primary/secondary usage windows, reset timers, and remaining credits.

## Viewing Logs

```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep -i codex
```


## Debugging hints with wayland

from https://gjs.guide/extensions/development/debugging.html

```bash
#!/bin/sh -e

export G_MESSAGES_DEBUG=all
export SHELL_DEBUG=all

# Check if we need `mutter-devkit` (GNOME 49)
if [ "$(gnome-shell --version | awk '{print int($3)}')" -ge 49 ]; then
dbus-run-session gnome-shell --devkit --wayland
else
dbus-run-session gnome-shell --nested --wayland
fi
```

## License

MIT
