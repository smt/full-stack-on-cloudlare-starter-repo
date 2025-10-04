import { DurableObject } from 'cloudflare:workers';

export class LinkClickTracker extends DurableObject<Env> {
  sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    ctx.blockConcurrencyWhile(async () => {
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
