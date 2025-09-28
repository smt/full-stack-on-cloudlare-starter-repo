import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

export class DestinationEvaluationWorkflow extends WorkflowEntrypoint<Env, unknown> {
  async run(event: Readonly<WorkflowEvent<unknown>>, step: WorkflowStep): Promise<void> {
    const collectedData = await step.do('Collect rendered destination page data', async () => {
      console.log('Collecting rendered destination page data...');
      return {
        dummydata: 'dummydata',
      };
    });

    console.log('Collected Data:', collectedData);
  }
}
