import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly redisService: RedisService) {}

  afterInit() {
    const subscriber = this.redisService?.getSubscriber();
    if (!subscriber) {
      console.warn('[WebSocket] Redis subscriber not ready during afterInit');
      return;
    }

    // Subscribe to all relevant Redis channels
    subscriber.subscribe('asset-events', 'render-progress', 'render-done');
    subscriber.psubscribe('render:*');

    subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        if (channel === 'asset-events' && data.assetId) {
          this.server.to(`asset:${data.assetId}`).emit('asset:status', data);
        } else if (channel === 'render-progress' && data.renderId) {
          this.server.to(`render:${data.renderId}`).emit('render:progress', data);
        } else if (channel === 'render-done' && data.renderId) {
          this.server.to(`render:${data.renderId}`).emit('render:done', data);
        }
      } catch (err) {
        console.error('Failed to parse redis message:', err);
      }
    });

    subscriber.on('pmessage', (_pattern, channel, message) => {
      try {
        const data = JSON.parse(message);
        if (channel.startsWith('render:')) {
          const renderId = channel.split(':')[1];
          this.server.to(`render:${renderId}`).emit('render:event', data);
        }
      } catch (err) {
        console.error('Failed to parse pmessage:', err);
      }
    });

    console.log('[WebSocket] EventsGateway initialized and subscribed to Redis');
  }

  handleConnection(client: Socket) {
    console.log(`[WebSocket] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[WebSocket] Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:asset')
  handleJoinAsset(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { assetId: string }
  ) {
    if (data?.assetId) {
      client.join(`asset:${data.assetId}`);
      return { status: 'joined', room: `asset:${data.assetId}` };
    }
  }

  @SubscribeMessage('join:render')
  handleJoinRender(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { renderId: string }
  ) {
    if (data?.renderId) {
      client.join(`render:${data.renderId}`);
      return { status: 'joined', room: `render:${data.renderId}` };
    }
  }
}
