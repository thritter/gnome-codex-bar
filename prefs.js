import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class CodexBarPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'CodexBar',
            icon_name: 'utilities-system-monitor-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: 'General',
            description: 'Configure the CodexBar usage monitor',
        });
        page.add(group);

        // Binary path
        const binRow = new Adw.EntryRow({
            title: 'codexbar binary path',
            text: settings.get_string('codexbar-bin'),
        });
        binRow.connect('changed', () => {
            settings.set_string('codexbar-bin', binRow.get_text());
        });
        group.add(binRow);

        // Poll interval
        const adjustment = new Gtk.Adjustment({
            lower: 300,
            upper: 3600,
            step_increment: 60,
            page_increment: 300,
            value: settings.get_int('poll-interval'),
        });
        const pollRow = new Adw.SpinRow({
            title: 'Poll interval (seconds)',
            subtitle: 'How often to check usage (300–3600 seconds)',
            adjustment,
        });
        settings.bind('poll-interval', adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(pollRow);

        // Display mode
        const displayModel = new Gtk.StringList();
        displayModel.append('text');
        displayModel.append('icons');

        const displayRow = new Adw.ComboRow({
            title: 'Display mode',
            subtitle: 'Text labels or colored SVG icons in the panel',
            model: displayModel,
        });

        // Set initial selection from current setting
        const currentMode = settings.get_string('display-mode');
        displayRow.set_selected(currentMode === 'icons' ? 1 : 0);

        displayRow.connect('notify::selected', () => {
            const value = displayRow.get_selected() === 1 ? 'icons' : 'text';
            settings.set_string('display-mode', value);
        });

        group.add(displayRow);

        // Providers group
        const providersGroup = new Adw.PreferencesGroup({
            title: 'Providers',
            description: 'Enable or disable individual providers',
        });
        page.add(providersGroup);

        for (const [key, title] of [['codex', 'Codex'], ['claude', 'Claude'], ['gemini', 'Gemini']]) {
            const row = new Adw.SwitchRow({
                title,
                subtitle: `Poll and display ${title} usage`,
            });
            settings.bind(`provider-${key}-enabled`, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            providersGroup.add(row);
        }
    }
}
