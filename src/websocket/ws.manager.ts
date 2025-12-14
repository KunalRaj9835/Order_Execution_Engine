import { WebSocket } from 'ws';

const clients = new Map<string, WebSocket>();

export function registerClient(orderId: string, socket: WebSocket) {
  clients.set(orderId, socket);
}

export function sendUpdate(orderId: string, data: any) {
  const client = clients.get(orderId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(data));
  }
}
