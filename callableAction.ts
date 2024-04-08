import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class CallableAction {

    static _textDecoder:TextDecoder = new TextDecoder();
    
    static async doCall(command:string, cb: (stout: string | null) => void){

        try {
            console.log("[gsystemd] Command: "+command)
            const proc = Gio.Subprocess.new(
                GLib.shell_parse_argv(command)[1],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
            const cancellable = new Gio.Cancellable();

            proc.communicate_utf8_async(null, cancellable, (a) => {

                if (a.get_successful())
                    cb("OK"/*this._textDecoder.decode(a.get_stdout_pipe()?.read_all(cancellable)[1]*/);
                else
                    cb("ERROR"/*console.error(this._textDecoder.decode(a.get_stderr_pipe()?.read_all(cancellable)[1])*/);
            }); 
            
        } catch (e) {
            console.error(e);
        }        
    }
}