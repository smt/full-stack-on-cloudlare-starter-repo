import { DurableObject } from 'cloudflare:workers';

export class EvaluationScheduler extends DurableObject {
  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
  }
}
