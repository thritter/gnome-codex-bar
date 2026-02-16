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
            lower: 30,
            upper: 3600,
            step_increment: 30,
            page_increment: 60,
            value: settings.get_int('poll-interval'),
        });
        const pollRow = new Adw.SpinRow({
            title: 'Poll interval (seconds)',
            subtitle: 'How often to check usage (30–3600)',
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
    }
}
