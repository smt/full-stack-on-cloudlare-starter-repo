import { getRoutingDestinations, getDestinationForCountry, captureLinkClickInBackground } from '@/helpers/route-ops';
import { cloudflareInfoSchema } from '@repo/data-ops/zod-schema/links';
import { LinkClickMessageType } from '@repo/data-ops/zod-schema/queue';

import { Hono } from 'hono';

export const App = new Hono<{ Bindings: Env }>();

App.get('/click-socket', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader?.toLowerCase() !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426); // HTTP 426 Upgrade Required
  }

  const accountId = c.req.header('account-id');

  if (!accountId) return c.text('Missing account-id header', 400);
  const doId = c.env.LINK_CLICK_TRACKER_OBJECT.idFromName(accountId); // use account ID as the DO name
  const stub = c.env.LINK_CLICK_TRACKER_OBJECT.get(doId);

  return await stub.fetch(c.req.raw);
});

App.get('/r/:id', async (c) => {
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
  // instead of awaiting the queue send and click tracking for background processing,
  // we use waitUntil to ensure it gets sent even if the response is returned
  c.executionCtx.waitUntil(captureLinkClickInBackground(c.env, queueMessage));

  return c.redirect(destination, 302);
});
