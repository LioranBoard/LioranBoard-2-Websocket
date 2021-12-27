const debug = require('debug')('lb-websocket-js:Socket');

var debug = require('bucket-js');

debug.Set.prototype.logIt = function(...args) {
        const _debug = console.debug.bind(console);
        const msg = {};
        _debug.apply(console, arguments);
        if (!LBDebugPost) return;
        Object.assign(msg, args[args.length - 2]);
        if (args[0].includes('Sending Message')) LBDebugPost('receiverSent', msg);
        else if (args[0].includes('Message received')) {
          LBDebugPost('receiver', msg);
        }
}

module.exports = bucket;