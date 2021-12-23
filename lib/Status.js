module.exports = {
  NOT_CONNECTED: {
    status: 'error',
    description: 'There is no socket connection available.'
  },
  CONNECTION_ERROR: {
    status: 'error',
    description: 'Connection error.'
  },
  SOCKET_EXCEPTION: {
    status: 'error',
    description: 'An exception occurred from the underlying WebSocket.'
  },
  AUTH_NOT_REQUIRED: {
    status: 'ok',
    description: 'Authentication is not required.'
  },
  REQUEST_TYPE_NOT_SPECIFIED: {
    status: 'error',
    description: 'No request type specified.'
  },
  ARGS_NOT_SPECIFIED: {
    status: 'error',
    description: 'No arguments specified.'
  },
  ARGS_NOT_OBJECT: {
    status: 'error',
    description: 'The supplied arguments parameter is not an object.'
  },

  init() {
    for (const key in this) {
      if ({}.hasOwnProperty.call(this, key)) {
        // Assign a value to 'code' identified by the status' key.
        this[key].code = key;

        // Assign a value to 'error' if one is not already defined.
        if (this[key].status === 'error' && !this[key].error) {
          this[key].error = this[key].description;
        }
      }
    }

    delete this.init;
    return this;
  }
}.init();
