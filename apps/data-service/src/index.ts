import { WorkerEntrypoint } from 'cloudflare:workers';
import { App } from '@/hono/app';
import { initDatabase } from '@repo/data-ops/database';
import { QueueMessageSchema } from '@repo/data-ops/zod-schema/queue';
import { handleLinkClick } from '@/queue-handlers/link-clicks';
export { DestinationEvaluationWorkflow } from '@/workflows/destination-evaluation-workflow';
export { EvaluationScheduler } from '@/durable-objects/evaluation-scheduler';
export { LinkClickTracker } from '@/durable-objects/link-click-tracker';

export default class DataService extends WorkerEntrypoint<Env> {
  constructor(ctx: ExecutionContext, env: Env) {
    super(ctx, env);
    initDatabase(env.DB);
  }

  fetch(request: Request) {
    return App.fetch(request, this.env, this.ctx);
  }

  async queue(batch: MessageBatch<unknown>): Promise<void> {
    for (const message of batch.messages) {
      const parsedEvent = QueueMessageSchema.safeParse(message.body);
      if (parsedEvent.success) {
        const event = parsedEvent.data;
        console.log(`Queue Message ${message.id}:`, event);

        switch (event.type) {
          case 'LINK_CLICK': {
            console.log(`Begin handling event type: ${event.type}`);
            await handleLinkClick(this.env, event);
            console.log(`Done handling event type: ${event.type}`);
            break;
          }
          default: {
            console.warn(`Unhandled event type: ${event.type}`);
          }
        }
      } else {
        console.error(parsedEvent.error);
      }
    }
  }
}
