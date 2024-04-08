/* extension.js
 */
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
//import {Spinner} from 'resource:///org/gnome/shell/ui/animation.js';

import {ServiceEntry, ServiceMenuEntry} from './serviceEntry.js';
import * as CallableAction from './callableAction.js';
import { PopupSeparatorMenuItem } from '@girs/gnome-shell/ui/popupMenu';

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {

    iconIndicator:St.Icon|null = null;
    services:ServiceMenuEntry[] = [];

    _textDecoder:TextDecoder = new TextDecoder();
    
    updateMenu(menuList: ServiceMenuEntry[], settings: Gio.Settings){
        
        (this.menu as PopupMenu.PopupMenu).removeAll();

        menuList.forEach((e) => { 
            let tokens:string[] = e.name.split("/");
            let service:string|undefined = tokens.at(-1);
            if(service){
                let serviceName = service.split("\.")[0];
                let item = new PopupMenu.PopupSwitchMenuItem(settings.get_boolean('show-restart')?_("Start"):_(serviceName), e.active);
                item.connect('toggled', async (obj, state) => {
                    let command = this._getCommand(service, state?"start":"stop");
                    CallableAction.CallableAction.doCall(command, (stout) => {});
                });
                if(settings.get_boolean('show-restart')){
                    let group = new PopupMenu.PopupSubMenuMenuItem(_(serviceName), true);
                    group.menu.addMenuItem(item);
                    let restart = new PopupMenu.PopupImageMenuItem(_("Restart"), 'view-refresh-symbolic');
                    restart.connect('activate', () => {
                        //Main.notify(_('Whatʼs up, folks?' + "Restart"));
                        let command = this._getCommand(service, "restart");                    
                        CallableAction.CallableAction.doCall(command, (stout) => {});
                    });
                    group.menu.addMenuItem(restart);
                    
                    (this.menu as PopupMenu.PopupMenu).addMenuItem(group);
                }else{
                    (this.menu as PopupMenu.PopupMenu).addMenuItem(item);
                }        
            }
        });

        if(settings.get_boolean('show-refresh')){
            (this.menu as PopupMenu.PopupMenu).addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Refresh'));
            switch(settings.get_enum('mode')){
                case 0:
                    let buttonDiscoverServices = new PopupMenu.PopupImageMenuItem(_("Discover Services"), 'view-refresh-symbolic');
                    buttonDiscoverServices.connect('activate', () => {
                        this.services = this.discoverServices(settings);
                        this.updateMenu(this.services, settings);
                    });
                    (this.menu as PopupMenu.PopupMenu).addMenuItem(buttonDiscoverServices);
                default:
                    let buttonRefreshServices = new PopupMenu.PopupImageMenuItem(_("Refresh Services"), 'view-refresh-symbolic');
                    buttonRefreshServices.connect('activate', () => {
                        let actives = this.updateStatuses();
                        if(this.iconIndicator?.labelActor instanceof St.Label){
                            this.iconIndicator.labelActor.text = `${actives}/${this.services?this.services.length:0}`;
                        }
                        this.updateMenu(this.services, settings);
                    });
                    (this.menu as PopupMenu.PopupMenu).addMenuItem(buttonRefreshServices);
            }
            
        }
        
    }

    _init() {
        super._init(0.0, _('Systemctl Indicator'));
        this.iconIndicator = new St.Icon({
            iconName: 'emblem-system-symbolic',
            styleClass: 'system-status-icon',
            labelActor: new St.Label({
                text:  `0/${this.services?this.services.length:0}` 
            })
        });
        this.add_child(this.iconIndicator);
    }

    _getCommand(service:String, action:String) {
        let command = "/bin/pkexec --user root /bin/systemctl"

        command += " " + action
        command += " " + service

        command =  'sh -c "' + command + '; exit;"'

        return command;
    }

    refresh(settings:Gio.Settings) {
        
        this.services = [];

        switch(settings.get_enum('mode')){
            case 0:
                this.services = this.discoverServices(settings);
                break;
            case 1:
                settings.get_strv('systemd-services').forEach((e:String) => {
                    this.services.push({name: e, active: false});
                });
                break;
        }
        let actives = this.updateStatuses();  
        if(this.iconIndicator?.labelActor instanceof St.Label){
            this.iconIndicator.labelActor.text = `0/${this.services?this.services.length:0}`;
        }
        this.updateMenu(this.services, settings);
    }

    updateStatuses():number {
        console.log("Update Statuses");
        let count:number = 0;
        this.services.forEach((e:ServiceMenuEntry) => {
            let [ok, standard_output, standard_error, exit_status] = 
                    GLib.spawn_command_line_sync( '/bin/sh -c "/bin/systemctl is-active '+e.name+'; exit;"');
            let out = this._textDecoder.decode(standard_output).trim();
            e.active= out === "active";
            if(e.active)count++;
        });
        return count;
    }

    discoverServices(settings:Gio.Settings): ServiceMenuEntry[] {
        
        let services:ServiceMenuEntry[] = [];
        let maxServices = settings.get_int("autoscan-max") + 1;
        settings.get_strv('systemd-paths').forEach((e:string) => {
            if(services.length < maxServices){
                let [ok, standard_output, standard_error, exit_status] = 
                    GLib.spawn_command_line_sync( '/bin/sh -c "/bin/find '+e+' -iname *.service -type f; exit;"');
                c.split("\n").forEach(f => {
                    if(services.length < maxServices){
                        services.push({name: f, active: false});
                    }
                });
            }
        });

        return services;
    }
});

export default class GSystemdExtension extends Extension {

    _indicator: typeof Indicator|any = null;
    _settings:Gio.Settings|null = null;

    _init() {
        console.log("[gsystemd] INIT");
        this._settings = this.getSettings();
        this._settings.connect('changed', (e:Gio.Settings) => {
            this._indicator.refresh(e);
        });
        this._indicator = new Indicator(0, "Systemd");
        Main.panel.addToStatusArea(this.uuid, this._indicator);   
        this._indicator.refresh(this._settings);
    }

    enable() {
        this._init();
    }

    disable() {
       this._indicator?.destroy();
       this._indicator = null;
       this._settings = null;
    }
}
