import { DurableObject } from 'cloudflare:workers';

export class EvaluationScheduler extends DurableObject {
  count: number = 0;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.count = (await ctx.storage.get<number>('count')) || 0;
    });
  }

  async increment() {
    this.count++;
    await this.ctx.storage.put('count', this.count);
  }

  async getCount() {
    return this.count;
  }
}
