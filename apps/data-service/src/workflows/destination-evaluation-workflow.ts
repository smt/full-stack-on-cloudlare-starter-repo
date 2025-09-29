import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { v4 as uuidv4 } from 'uuid';
import { collectDestinationInfo } from '@/helpers/browser-render';
import { aiDestinationChecker } from '@/helpers/ai-destination-checker';
import { addEvaluation } from '@repo/data-ops/queries/evaluations';
import { initDatabase } from '@repo/data-ops/database';

export class DestinationEvaluationWorkflow extends WorkflowEntrypoint<Env, DestinationStatusEvaluationParams> {
  async run(event: Readonly<WorkflowEvent<DestinationStatusEvaluationParams>>, step: WorkflowStep): Promise<void> {
    initDatabase(this.env.DB);

    const evaluationInfo = await step.do(
      'Collect rendered destination page data',
      {
        retries: { limit: 1, delay: 1000 },
      },
      async () => {
        const evaluationId = uuidv4();
        const data = await collectDestinationInfo(this.env, event.payload.destinationUrl);

        const accountId = event.payload.accountId;
        const r2PathHtml = `evaluations/${accountId}/html/${evaluationId}`;
        const r2PathBodyText = `evaluations/${accountId}/body-text/${evaluationId}`;
        const r2PathScreenshot = `evaluations/${accountId}/screenshots/${evaluationId}.png`;

        // Convert base64 Data URI to buffer for R2 storage
        const screenshotBase64 = data.screenshotDataUri.replace(/^data:image\/png;base64,/, '');
        const screenshotBuffer = Buffer.from(screenshotBase64);

        await this.env.BUCKET.put(r2PathHtml, data.html);
        await this.env.BUCKET.put(r2PathBodyText, data.bodyText);
        await this.env.BUCKET.put(r2PathScreenshot, screenshotBuffer);

        return {
          evaluationId,
          bodyText: data.bodyText,
        };
      },
    );

    const aiStatus = await step.do(
      'Use AI to check status of page',
      {
        retries: { limit: 0, delay: 0 },
      },
      async () => {
        return aiDestinationChecker(this.env, evaluationInfo.bodyText);
      },
    );

    await step.do('Save evaluation in database', async () => {
      return await addEvaluation({
        evaluationId: evaluationInfo.evaluationId,
        linkId: event.payload.linkId,
        status: aiStatus.status,
        reason: aiStatus.statusReason,
        accountId: event.payload.accountId,
        destinationUrl: event.payload.destinationUrl,
      });
    });
  }
}
