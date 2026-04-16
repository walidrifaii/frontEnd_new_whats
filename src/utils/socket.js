import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;

const getDefaultSocketUrl = () => {
  // 1) Explicit socket URL if provided.
  if (process.env.REACT_APP_SOCKET_URL) return process.env.REACT_APP_SOCKET_URL;

  // 2) If API URL is set, reuse the same host (strip trailing /api).
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '');
  }

  // 3) Default to known deployed backend when env var is not set.
  return 'https://amctag-whats.38f0fz.easypanel.host';
};

export const getSocket = () => {
  if (!socketInstance) {
    socketInstance = io(getDefaultSocketUrl(), {
      // Keep websocket preferred, but allow polling fallback on restrictive hosts/proxies.
      transports: ['websocket', 'polling'],
      autoConnect: true
    });
  }
  return socketInstance;
};

export const useSocket = (clientIdsOrSingle, handlers = {}) => {
  const socket = getSocket();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const ids = Array.isArray(clientIdsOrSingle)
    ? clientIdsOrSingle.filter(Boolean)
    : (clientIdsOrSingle ? [clientIdsOrSingle] : []);

  useEffect(() => {
    if (ids.length === 0) return;

    ids.forEach((id) => socket.emit('join-client-room', id));

    const events = Object.keys(handlersRef.current);
    const listeners = {};
    events.forEach((event) => {
      listeners[event] = (data) => handlersRef.current[event]?.(data);
      socket.on(event, listeners[event]);
    });

    return () => {
      events.forEach((event) => socket.off(event, listeners[event]));
    };
  }, [socket, ids.join('|')]);

  return socket;
};
