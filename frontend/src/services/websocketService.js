import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.callbacks = new Map();
  }

  connect(onConnectCallback) {
    if (this.socket && this.socket.connected) return;

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
    this.socket = io(BACKEND_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionDelay: 3000,
    });

    this.socket.on('connect', () => {
      console.log('Socket.IO connected successfully');
      if (onConnectCallback) onConnectCallback({ type: 'CONNECTED' });
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Socket.IO connection warning:', err.message);
    });

    // Listen to incoming notifications
    const events = ['NEW_BOOKING', 'BOOKING_SUCCESS', 'EXTENSION_REQUESTED', 'EXTENSION_APPROVED', 'EXTENSION_DECLINED'];
    events.forEach((evt) => {
      this.socket.on(evt, (data) => {
        const cb = this.callbacks.get(evt) || this.callbacks.get('ALL');
        if (cb) cb(data);
      });
    });
  }

  subscribeUser(role, email, callback) {
    if (!this.socket) {
      this.connect();
    }

    if (this.socket) {
      if (this.socket.connected) {
        this.socket.emit('join', { role, email });
      } else {
        this.socket.once('connect', () => {
          this.socket.emit('join', { role, email });
        });
      }
    }

    this.callbacks.set('ALL', callback);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.callbacks.clear();
    }
  }
}

export const websocketService = new WebSocketService();
