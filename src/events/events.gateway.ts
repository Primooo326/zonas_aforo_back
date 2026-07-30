import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private rooms = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    const edificioId = client.handshake.query.edificioId as string;
    if (edificioId) {
      client.join(`edificio:${edificioId}`);
      if (!this.rooms.has(edificioId)) {
        this.rooms.set(edificioId, new Set());
      }
      this.rooms.get(edificioId)!.add(client.id);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [edificioId, sockets] of this.rooms.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.rooms.delete(edificioId);
        break;
      }
    }
  }

  emitirActualizacion(edificioId: string, data: any) {
    this.server.to(`edificio:${edificioId}`).emit('actualizacion', data);
  }
}
