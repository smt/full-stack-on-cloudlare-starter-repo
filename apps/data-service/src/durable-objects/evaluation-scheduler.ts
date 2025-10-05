import { DurableObject } from 'cloudflare:workers';
import { addDays, toDate } from 'date-fns';

interface ClickData {
  accountId: string;
  linkId: string;
  destinationUrl: string;
  destinationCountryCode: string;
}

export class EvaluationScheduler extends DurableObject<Env> {
  clickData: ClickData | undefined;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.clickData = await ctx.storage.get<ClickData>('click_data');
    });
  }

  async collectLinkClick(accountId: string, linkId: string, destinationUrl: string, destinationCountryCode: string) {
    this.clickData = {
      accountId,
      linkId,
      destinationUrl,
      destinationCountryCode,
    };
    await this.ctx.storage.put('click_data', this.clickData);

    const alarm = await this.ctx.storage.getAlarm();
    if (!alarm) {
      const oneDayFromNow = toDate(addDays(new Date(), 1)).valueOf();
      await this.ctx.storage.setAlarm(oneDayFromNow);
    }
  }

  async alarm() {
    console.log('EvaluationScheduler alarm triggered');
    const clickData = this.clickData;
    if (!clickData) {
      throw new Error('Click data not set');
    }
    await this.env.DESTINATION_EVALUATION_WORKFLOW.create({
      params: {
        linkId: clickData!.linkId,
        destinationUrl: clickData!.destinationUrl,
        accountId: clickData!.accountId,
      },
    });
  }
}
