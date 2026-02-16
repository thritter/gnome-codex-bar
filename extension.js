import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const PROVIDERS = [
    {key: 'codex', label: 'CX', args: ['usage', '--provider', 'codex', '--source', 'cli', '--format', 'json']},
    {key: 'claude', label: 'CL', args: ['usage', '--provider', 'claude', '--source', 'oauth', '--format', 'json']},
];

function getColorClass(percent) {
    if (percent < 50) return 'codexbar-green';
    if (percent <= 80) return 'codexbar-yellow';
    return 'codexbar-red';
}

function getColorName(percent) {
    if (percent < 50) return 'green';
    if (percent <= 80) return 'yellow';
    return 'red';
}

function formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

function runCommand(bin, args) {
    const cmdline = [bin, ...args].join(' ');
    console.debug(`[CodexBar] Running: ${cmdline}`);
    return new Promise((resolve, reject) => {
        try {
            const proc = Gio.Subprocess.new(
                [bin, ...args],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
            proc.communicate_utf8_async(null, null, (source, res) => {
                try {
                    const [, stdout, stderr] = source.communicate_utf8_finish(res);
                    if (source.get_successful()) {
                        console.debug(`[CodexBar] stdout: ${stdout}`);
                        const parsed = JSON.parse(stdout);
                        resolve(Array.isArray(parsed) ? parsed[0] : parsed);
                    } else {
                        const msg = stderr?.trim() || 'Command failed';
                        console.error(`[CodexBar] Command failed: ${cmdline}\n  stderr: ${msg}`);
                        reject(new Error(msg));
                    }
                } catch (e) {
                    console.error(`[CodexBar] Error parsing output from: ${cmdline}\n  ${e.message}`);
                    reject(e);
                }
            });
        } catch (e) {
            console.error(`[CodexBar] Failed to spawn: ${cmdline}\n  ${e.message}`);
            reject(e);
        }
    });
}

const CodexBarIndicator = GObject.registerClass(
class CodexBarIndicator extends PanelMenu.Button {
    _init(extensionPath, settings) {
        super._init(0.0, 'CodexBar Usage Monitor');

        this._extensionPath = extensionPath;
        this._settings = settings;
        this._results = {};

        // Container box for all panel widgets
        this._panelBox = new St.BoxLayout({
            style_class: 'panel-status-indicators-box',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._panelBox);

        // Text mode label
        this._panelLabel = new St.Label({
            text: 'CX:-- CL:--',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'codexbar-label',
        });
        this._panelBox.add_child(this._panelLabel);

        // Icon mode widgets (one icon per provider, swapping colored SVGs)
        this._providerIcons = {};
        for (const provider of PROVIDERS) {
            // Preload a GIcon for each color variant
            const gicons = {};
            for (const color of ['gray', 'green', 'yellow', 'red']) {
                const file = Gio.File.new_for_path(`${extensionPath}/${provider.key}_${color}.svg`);
                gicons[color] = new Gio.FileIcon({file});
            }

            const icon = new St.Icon({
                gicon: gicons.gray,
                style_class: 'codexbar-icon',
            });

            this._panelBox.add_child(icon);

            this._providerIcons[provider.key] = {icon, gicons};
        }

        // Apply initial display mode
        this._applyDisplayMode();

        // Build the dropdown menu
        this._buildMenu();

        // Initial fetch
        this._refresh().catch(e => console.error('CodexBar: initial refresh failed:', e));
    }

    _buildMenu() {
        // Provider sections
        this._providerSections = {};
        for (const provider of PROVIDERS) {
            const section = new PopupMenu.PopupMenuSection();

            const header = new PopupMenu.PopupMenuItem(provider.key.toUpperCase(), {
                reactive: false,
                style_class: 'codexbar-header',
            });
            section.addMenuItem(header);

            const primary = new PopupMenu.PopupMenuItem('  Primary: --', {reactive: false});
            section.addMenuItem(primary);

            const secondary = new PopupMenu.PopupMenuItem('  Secondary: --', {reactive: false});
            section.addMenuItem(secondary);

            const credits = new PopupMenu.PopupMenuItem('', {reactive: false});
            credits.visible = false;
            section.addMenuItem(credits);

            const error = new PopupMenu.PopupMenuItem('', {reactive: false});
            error.label.style_class = 'codexbar-error';
            error.visible = false;
            section.addMenuItem(error);

            this._providerSections[provider.key] = {section, header, primary, secondary, credits, error};
            this.menu.addMenuItem(section);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        // Last updated
        this._timestampItem = new PopupMenu.PopupMenuItem('Last updated: --', {reactive: false});
        this._timestampItem.label.style_class = 'codexbar-timestamp';
        this.menu.addMenuItem(this._timestampItem);

        // Refresh button
        const refreshItem = new PopupMenu.PopupMenuItem('Refresh Now');
        refreshItem.connect('activate', () => this._refresh().catch(e => console.error('CodexBar: refresh failed:', e)));
        this.menu.addMenuItem(refreshItem);
    }

    async _refresh() {
        const bin = this._settings.get_string('codexbar-bin');
        const promises = PROVIDERS.map(async (provider) => {
            try {
                const data = await runCommand(bin, provider.args);
                this._results[provider.key] = data;
            } catch (e) {
                this._results[provider.key] = {error: {message: e.message}};
            }
        });

        await Promise.all(promises);
        this._updateUI();
    }

    _applyDisplayMode() {
        const mode = this._settings.get_string('display-mode');
        const isIcons = mode === 'icons';

        this._panelLabel.visible = !isIcons;
        for (const provider of PROVIDERS) {
            this._providerIcons[provider.key].icon.visible = isIcons;
        }
    }

    _updateUI() {
        const panelParts = [];

        for (const provider of PROVIDERS) {
            const data = this._results[provider.key];
            if (!data) {
                console.warn(`[CodexBar] : ${provider.key} NO Data`)
                continue;
            }
            const sec = this._providerSections[provider.key];

            if (data.error) {
                sec.primary.label.text = '  Primary: --';
                sec.secondary.label.text = '  Secondary: --';
                sec.credits.visible = false;
                sec.error.label.text = `  Error: ${data.error.message}`;
                sec.error.visible = true;
                panelParts.push(`${provider.label}:ERR`);
                continue;
            }

            sec.error.visible = false;

            // Primary window
            const pri = data.usage?.primary;
            if (pri) {
                const pct = Math.round(pri.usedPercent ?? 0);
                sec.primary.label.text = `  Primary: ${pct}% (${pri.resetDescription || 'resets in ' + pri.windowMinutes + 'min'})`;
                panelParts.push(`${provider.label}:${pct}%`);

                // Apply color to panel later
            } else {
                sec.primary.label.text = '  Primary: N/A';
                panelParts.push(`${provider.label}:--`);
            }

            // Secondary window
            const snd = data.usage?.secondary;
            if (snd) {
                const pct = Math.round(snd.usedPercent ?? 0);
                sec.secondary.label.text = `  Weekly: ${pct}% (${snd.resetDescription || 'resets in ' + snd.windowMinutes + 'min'})`;
            } else {
                sec.secondary.label.text = '  Weekly: N/A';
            }

            // Credits
            if (data.credits?.remaining != null) {
                sec.credits.label.text = `  Credits: $${data.credits.remaining.toFixed(2)} remaining`;
                sec.credits.visible = true;
            } else {
                sec.credits.visible = false;
            }
        }

        // Update panel label with color
        const panelText = panelParts.join(' ');
        this._panelLabel.text = panelText;
        console.debug(`[CodexBar] : ${panelText}`);

        // Color the panel label based on max primary usage
        let maxPct = 0;
        for (const provider of PROVIDERS) {
            const data = this._results[provider.key];
            if (data?.usage?.primary?.usedPercent != null) {
                maxPct = Math.max(maxPct, data.usage.primary.usedPercent);
            }
        }
        this._panelLabel.style_class = `codexbar-label ${getColorClass(maxPct)}`;

        // Update icon mode widgets per-provider (swap colored SVG)
        for (const provider of PROVIDERS) {
            const data = this._results[provider.key];
            const {icon, gicons} = this._providerIcons[provider.key];

            if (!data || data.error) {
                icon.gicon = gicons.gray;
                continue;
            }

            const pri = data.usage?.primary;
            if (pri?.usedPercent != null) {
                icon.gicon = gicons[getColorName(Math.round(pri.usedPercent))];
            } else {
                icon.gicon = gicons.gray;
            }
        }

        // Timestamp
        this._timestampItem.label.text = `Last updated: ${formatTime(new Date())}`;
    }

    destroy() {
        super.destroy();
    }
});

export default class CodexBarExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new CodexBarIndicator(this.path, this._settings);
        Main.panel.addToStatusArea('codexbar', this._indicator, 0, 'right');

        this._startTimer();

        // React to settings changes
        this._settingsChangedId = this._settings.connect('changed', (settings, key) => {
            if (key === 'poll-interval') {
                this._restartTimer();
            } else if (key === 'codexbar-bin') {
                this._indicator._refresh().catch(e => console.error('CodexBar: refresh failed:', e));
            } else if (key === 'display-mode') {
                this._indicator._applyDisplayMode();
            }
        });
    }

    _startTimer() {
        const interval = this._settings.get_int('poll-interval');
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
            this._indicator._refresh().catch(e => console.error('CodexBar: refresh failed:', e));
            return GLib.SOURCE_CONTINUE;
        });
    }

    _restartTimer() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }
        this._startTimer();
    }

    disable() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }

        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
