import { DurableObject } from 'cloudflare:workers';
import { addSeconds, toDate } from 'date-fns';
import { getRecentClicks } from '@/helpers/durable-queries';

export class LinkClickTracker extends DurableObject<Env> {
  sql: SqlStorage;
  mostRecentOffsetTime: number = 0;
  leastRecentOffsetTime: number = 0;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    ctx.blockConcurrencyWhile(async () => {
      const [leastRecentOffestTime, mostRecentOffsetTime] = await Promise.all([
        ctx.storage.get<number>('leastRecentOffsetTime'),
        ctx.storage.get<number>('mostRecentOffsetTime'),
      ]);

      this.leastRecentOffsetTime = leastRecentOffestTime || this.leastRecentOffsetTime;
      this.mostRecentOffsetTime = mostRecentOffsetTime || this.mostRecentOffsetTime;

      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS geo_link_clicks (
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          country TEXT NOT NULL,
          time INTEGER NOT NULL
        )
      `);
    });
  }

  async addClick(latitude: number, longitude: number, country: string, time: number) {
    this.sql.exec(
      `
      INSERT INTO geo_link_clicks (latitude, longitude, country, time)
      VALUES (?, ?, ?, ?)
      `,
      latitude,
      longitude,
      country,
      time,
    );
    const alarm = await this.ctx.storage.getAlarm();
    if (!alarm) await this.ctx.storage.setAlarm(toDate(addSeconds(new Date(), 5)).valueOf());
  }

  async alarm() {
    console.log('Alarm triggered, flushing click buffer if any');
    const clickData = getRecentClicks(this.sql, this.mostRecentOffsetTime);

    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      ws.send(JSON.stringify(clickData.clicks));
    }
  }
  async fetch(_: Request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101, // HTTP 101 Switching Protocols, instructing the client to switch to the WebSocket protocol and keep the connection open
      webSocket: client,
    });
  }
}
