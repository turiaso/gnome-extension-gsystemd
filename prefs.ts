
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const listItems = [
    'Autoscan',
    'Custom',
];

export default class ServicesSystemd2Preferences extends ExtensionPreferences {

    page: Adw.PreferencesPage|null = null;
    group: Adw.PreferencesGroup|null = null;
    counter: Adw.SpinRow|null = null;
    maxAutoscan: Adw.SpinRow|null = null;
    entries: Adw.EntryRow[] = [];
    old_counter: number = 0;

    fillPreferencesWindow(window: Adw.PreferencesWindow) {

        console.log("[gsystemd-preferences] FILL PREFENRENCES");

        let settings = this.getSettings();

        /***************/
        /**  PAGE 1    */
        /***************/
        this.page = new Adw.PreferencesPage({
            title: 'Services',
        });
        window.add(this.page);

        const group1 = new Adw.PreferencesGroup({
            title: 'Basic Configurations',
            description: 'Basic configuration of the extension',
        });
        this.page.add(group1);

/***************/

        const row = new Adw.SwitchRow({
            title: 'Show restart button:',
            subtitle: 'Show Restart Button on Services',
        });
        group1.add(row);

        settings.bind('show-restart', row, 'active', Gio.SettingsBindFlags.DEFAULT);

        const row1 = new Adw.SwitchRow({
            title: 'Show refresh buttons:',
            subtitle: 'Show refresh management buttons',
        });
        group1.add(row1);

        settings.bind('show-refresh', row1, 'active', Gio.SettingsBindFlags.DEFAULT);

/***************/

        const model = Gio.ListStore.new(GObject.TYPE_OBJECT);

        listItems.forEach(e => {
            model.append( Gtk.StringObject.new(e));
        });

        const row2 = new Adw.ComboRow({
            title: 'Service list mode:',
            subtitle: 'Auto scan services or custom list',
            model: model,
            selected: settings.get_enum('mode'),
        });
        group1.add(row2);

        row2.connect('notify::selected', (selected:Adw.ComboRow) => {
            settings.set_enum('mode', selected.selected);
            this.loadDynamicSection(settings);
        });

/***************/

        this.group = new Adw.PreferencesGroup({
            title: listItems[settings.get_enum('mode')],
        });
        this.page?.add(this.group);

        this.loadDynamicSection(settings);

    }

    loadDynamicSection(settings: Gio.Settings) {

        console.log("[gsystemd-preferences] LOAD DYNAMIC");

        if(this.group){ 
            this.group.title=listItems[settings.get_enum('mode')];

            if(this.entries.length > 0){
                this.entries.forEach(e => {
                    if(this.group){                    
                        this.group.remove(e);
                    }
                });
                this.entries = [];
            }

            if(this.maxAutoscan)
                this.group.remove(this.maxAutoscan);
            
            switch(settings.get_enum('mode')){
                case 0:

                    this.maxAutoscan = new Adw.SpinRow({
                        title: 'Max AutoscanServices:',
                        subtitle: 'Max Autoscan services',
                        digits: 0,
                        numeric: true,
                        wrap: false,
                        updatePolicy: Gtk.SpinButtonUpdatePolicy.IF_VALID,
                        adjustment: Gtk.Adjustment.new(settings.get_int("autoscan-max"), 0,10,1,0,1)
                    });
                    this.group.add(this.maxAutoscan);

                    this.maxAutoscan.connect('notify::value', () => {
                        settings.set_int("autoscan-max", this.maxAutoscan?.value?this.maxAutoscan?.value:0);
                    });

                    settings.get_strv('systemd-paths').forEach((e: string) => {
                        let entry = new Adw.EntryRow({
                            text: e,
                            showApplyButton: true,
                            inputPurpose: Gtk.InputPurpose.ALPHA,
                            editable:true,
                            title: 'Path'
                        });
                        this.entries.push(entry);
                        entry.connect('apply', ($obj: Adw.EntryRow, pspec: GObject.ParamSpec) => {
                            settings.set_strv("systemd-paths", this.entries.map(e => e.text?e.text:''));
                        });
                    });
                    break;
                case 1:
                    settings.get_strv('systemd-services').forEach((e: string) => {
                        let entry = new Adw.EntryRow({
                            text: e,
                            showApplyButton: true,
                            inputPurpose: Gtk.InputPurpose.ALPHA,
                            editable:true,
                            title: 'Service'
                        });
                        this.entries.push(entry);
                        entry.connect('apply', ($obj: Adw.EntryRow, pspec: GObject.ParamSpec) => {
                            settings.set_strv("systemd-services", this.entries.map(e => e.text?e.text:''));
                        });
                    });
                    break;
            }  

            if(this.counter)
                this.group.remove(this.counter);
            
            this.counter = new Adw.SpinRow({
                title: 'Num. Elements:',
                subtitle: 'Num elements to analyze',
                digits: 0,
                numeric: true,
                wrap: false,
                updatePolicy: Gtk.SpinButtonUpdatePolicy.IF_VALID,
                adjustment: Gtk.Adjustment.new(this.entries.length, 0,10,1,0,1)
            });
            this.group.add(this.counter);
            this.old_counter = this.entries.length;

            this.counter.connect('notify::value', () => {
                if(this.counter && this.old_counter < this.counter.value){
                    let entry = new Adw.EntryRow({
                        text: "",
                        showApplyButton: true,
                        inputPurpose: Gtk.InputPurpose.ALPHA,
                        editable:true,
                        title: settings.get_enum('mode')==0?'Path':'Service'
                    });

                    entry.connect('apply', ($obj: Adw.EntryRow, pspec: GObject.ParamSpec) => {
                        settings.set_strv(settings.get_enum('mode')==0?"systemd-paths":"systemd-services", this.entries.map(e => e.text?e.text:''));
                    });
                    this.entries.push(entry);
                    this.group?.add(entry);
                }else if(this.counter && this.old_counter > this.counter.value){
                    let label = this.entries.pop();
                    if(label){
                        this.group?.remove(label);
                    }
                }
                this.old_counter = this.entries.length;
            });

            this.entries.forEach(e => {
                this.group?.add(e);
            });
        }
    }
   
};
