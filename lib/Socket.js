const WebSocket = require('isomorphic-ws');
const EventEmitter = require('events');
const hash = require('./util/authenticationHashing');
const Status = require('./Status');
const debug = require('debug')('lb-websocket-js:Socket');
const logAmbiguousError = require('./util/logAmbiguousError');

class Socket extends EventEmitter {
  constructor() {
    super();
    this._connected = false;
    this._socket = undefined;

   /* const originalEmit = this.emit;
    this.emit = function (...args) {
      debug('[emit] %s err: %o data: %o', ...args);
      originalEmit.apply(this, args);
    };*/
  }

  async connect(args) {
    args = args || {};
    const address = args.address || 'localhost:9425';
    const name = args.name || (Math.random() + 1).toString(36).substring(2);

    if (this._socket) {
      try {
        // Blindly try to close the socket.
        // Don't care if its already closed.
        // We just don't want any sockets to leak.
        this._socket.close();
      } catch (error) {
        // These errors are probably safe to ignore, but debug log them just in case.
        debug('Failed to close previous WebSocket:', error.message);
      }
    }

    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        await this._connect(address, Boolean(args.secure));
        await this._authenticate(name, args.password);
        resolve();
      } catch (err) {
        this._socket.close();
        this._connected = false;
        logAmbiguousError(debug, 'Connection failed:', err);
        reject(err);
      }
    });
  }

  /**
   * Opens a WebSocket connection to an lb-websocket server, but does not attempt any authentication.
   *
   * @param {String} address url without ws:// or wss:// prefix.
   * @param {Boolean} secure whether to us ws:// or wss://
   * @returns {Promise}
   * @private
   * @return {Promise} on attempted creation of WebSocket connection.
   */
  async _connect(address, secure) {
    return new Promise((resolve, reject) => {
      let settled = false;

      debug('Attempting to connect to: %s', address);
      this._socket = new WebSocket((secure ? 'wss://' : 'ws://') + address);
      this._socket.binaryType = 'arraybuffer';

      // We only handle the initial connection error.
      // Beyond that, the consumer is responsible for adding their own generic `error` event listener.
      // FIXME: Unsure how best to expose additional information about the WebSocket error.
      this._socket.onerror = err => {
        if (settled) {
          logAmbiguousError(debug, 'Unknown Socket Error', err);
          this.emit('error', err);
          return;
        }

        settled = true;
        logAmbiguousError(debug, 'Websocket Connection failed:', err);
        reject(Status.CONNECTION_ERROR);
      };

      this._socket.onopen = () => {
        if (settled) {
          return;
        }

        this._connected = true;
        settled = true;

        debug('Connection opened: %s', address);
        this.emit('ConnectionOpened');
        resolve();
      };

      // Looks like this should be bound. We don't technically cancel the connection when the authentication fails.
      this._socket.onclose = () => {
        this._connected = false;
        debug('Connection closed: %s', address);
        this.emit('ConnectionClosed');
      };

      // This handler must be present before we can call _authenticate.
      this._socket.onmessage = msg => {
        const message = JSON.parse(new TextDecoder().decode(msg.data))
        debug('[Message received] %o', message);
        let err;
        let data;

        if (message.status === '404.0') {
          err = message.error;
        } else {
          data = message;
        }

        // Emit the message with ID if available, otherwise try to find a non-messageId driven event.
        if (message.id) {
          this.emit(`lb:internal:message:id-${message.id}`, err, data);
        } else if (message.upd) {
          if (message.upd === 'Ping') this.send('Pong')
          else {this.emit(message.upd, data);}
          // Emit separate extension message event 
          if (message.upd === 'ExecuteCommand') this.emit(message.CommandName, data)
        } else {
          //logAmbiguousError(debug, 'Unrecognized Socket Message:', message);
          this.emit('message', message);
        }
      };
    });
  }

  /**
   * Authenticates to an lb-websocket server. Must already have an active connection before calling this method.
   *
   * @param {String} [name=''] name of the client.
   * @param {String} [password=''] authentication string.
   * @private
   * @return {Promise} on resolution of authentication call.
   */
  async _authenticate(name = 'Transmitter', password = '') {
    if (!this._connected) {
      throw Status.NOT_CONNECTED;
    }
    const auth = await this.send('Authentication', { Name: name } );
    if (auth.AuthRequired === false) {
      debug('Authentication not Required');
      this.emit('AuthenticationSuccess');
      return Status.AUTH_NOT_REQUIRED;
    }

    try {
      await this.send('Authenticate', { Name:name,
        Enigma: hash(auth.Salt, auth.Challenge, password)
      });
    } catch (e) {
      debug('Authentication Failure %o', e);
      this.emit('AuthenticationFailure');
      throw e;
    }

    debug('Authentication Success');
    this.emit('AuthenticationSuccess');
  }

  /**
   * Close and disconnect the WebSocket connection.
   *
   * @function
   * @category request
   */
  disconnect() {
    debug('Disconnect requested.');
    if (this._socket) {
      this._socket.close();
    }
  }
}

module.exports = Socket;
