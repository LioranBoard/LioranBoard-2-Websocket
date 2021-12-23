const Socket = require('./Socket');
const Status = require('./Status');
const debug = require('debug')('lb-websocket-js:Core');

let requestCounter = 0;
const noArgRequests = ['GetDeckList', 'GetModifications', 'GetVersion', 'Close', 'GetOngoingButtons', 'GetTwitchList', 'GetModifications']

function generateMessageId() {
  return String(requestCounter++);
}

class LBWebSocket extends Socket {
  /**
   * Generic Socket request method. Returns a promise.
   * Generates a messageId internally and will override any passed in the args.
   * Note that the requestType here is pre-marshaling and currently must match exactly what the websocket plugin is expecting.
   *
   * @param  {String}   requestType lb-websocket plugin expected request type.
   * @param  {Object}   [arg={}]        request arguments.
   * @return {Promise}              Promise, passes the plugin response object.
   */
  send(requestType, args = {}) {
    if (requestType === 'Authentication') requestCounter = 0
    args = args || {};

    return new Promise((resolve, reject) => {
      const messageId = generateMessageId();
      let rejectReason;

      if (!requestType) {
        rejectReason = Status.REQUEST_TYPE_NOT_SPECIFIED;
      }

      if (!args && !noArgRequests.includes(requestType)) {
        rejectReason = Status.ARGS_NOT_SPECIFIED;
      }

      if (args && (typeof args !== 'object' || args === null || Array.isArray(args))) {
        rejectReason = Status.ARGS_NOT_OBJECT;
      }

      if (!this._connected) {
        rejectReason = Status.NOT_CONNECTED;
      }

      // Assign a temporary event listener for this particular messageId to uniquely identify the response.
      this.once(`lb:internal:message:id-${messageId}`, (err, data) => {
        if (err) {
          //debug('[send:reject] %o', err);
          reject(err);
        } else {
          //debug('[send:resolve] %o', data);
          resolve(data);
        }
      });

      // If we don't have a reason to fail fast, send the request to the socket.
      if (!rejectReason) {
        args['rq'] = requestType;
        args['id'] = messageId;

        // Submit the request to the websocket.
        debug('[Sending Message] %s %s %o', messageId, requestType, args);
        try {
          this._socket.send(JSON.stringify(args));
        } catch (_) {
          // TODO: Consider inspecting the exception thrown to gleam some relevant info and pass that on.
          rejectReason = Status.SOCKET_EXCEPTION;
        }
      }

      // If the socket call was unsuccessful or bypassed, simulate its resolution.
      if (rejectReason) {
        this.emit(`lb:internal:message:id-${messageId}`, rejectReason);
      }
    });
  }
}

module.exports = LBWebSocket;
