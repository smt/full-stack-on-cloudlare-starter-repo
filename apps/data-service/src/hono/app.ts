import { getRoutingDestinations, getDestinationForCountry } from '@/helpers/route-ops';
import { getLink } from '@repo/data-ops/queries/links';
import { cloudflareInfoSchema } from '@repo/data-ops/zod-schema/links';
import { LinkClickMessageType } from '@repo/data-ops/zod-schema/queue';

import { Hono } from 'hono';

export const App = new Hono<{ Bindings: Env }>();

App.get('/:id', async (c) => {
  const id = c.req.param('id');

  const linkInfo = await getRoutingDestinations(c.env, id);
  if (!linkInfo) {
    return c.text('Not Found', 404);
  }

  const cfHeader = cloudflareInfoSchema.safeParse(c.req.raw.cf);
  if (!cfHeader.success) {
    return c.text('Invalid Cloudflare headers', 400);
  }

  const headers = cfHeader.data;
  console.log(headers);
  const destination = getDestinationForCountry(linkInfo, headers.country);

  let queueMessage: LinkClickMessageType;
  queueMessage = {
    type: 'LINK_CLICK',
    data: {
      id,
      country: headers.country,
      destination,
      accountId: linkInfo.accountId,
      latitude: headers.latitude,
      longitude: headers.longitude,
      timestamp: new Date().toISOString(),
    },
  };
  // instead of awaiting the queue send, we use waitUntil to ensure it gets sent even if the response is returned
  c.executionCtx.waitUntil(c.env.QUEUE.send(queueMessage));

  return c.redirect(destination, 302);
});
