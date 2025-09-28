import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { collectDestinationInfo } from '@/helpers/browser-render';
import { aiDestinationChecker } from '@/helpers/ai-destination-checker';
import { addEvaluation } from '@repo/data-ops/queries/evaluations';
import { initDatabase } from '@repo/data-ops/database';

export class DestinationEvaluationWorkflow extends WorkflowEntrypoint<Env, DestinationStatusEvaluationParams> {
  async run(event: Readonly<WorkflowEvent<DestinationStatusEvaluationParams>>, step: WorkflowStep): Promise<void> {
    initDatabase(this.env.DB);

    const collectedData = await step.do('Collect rendered destination page data', async () => {
      return collectDestinationInfo(this.env, event.payload.destinationUrl);
    });

    const aiStatus = await step.do(
      'Use AI to check status of page',
      {
        retries: { limit: 0, delay: 0 },
      },
      async () => {
        return aiDestinationChecker(this.env, collectedData.bodyText);
      },
    );

    const evaluationId = await step.do('Save evaluation in database', async () => {
      return await addEvaluation({
        linkId: event.payload.linkId,
        status: aiStatus.status,
        reason: aiStatus.statusReason,
        accountId: event.payload.accountId,
        destinationUrl: event.payload.destinationUrl,
      });
    });
  }
}
