import { LinkSchemaType, linkSchema } from '@repo/data-ops/zod-schema/links';
import { LinkClickMessageType } from '@repo/data-ops/zod-schema/queue';
import { getLink } from '@repo/data-ops/queries/links';

async function getLinkInfoFromKv(env: Env, id: string) {
  const linkInfo = await env.CACHE.get(id);
  if (!linkInfo) {
    console.log('Cache miss for link ID:', id);
    return null;
  }
  console.log('Cache hit for link ID:', id);
  const parsedLinkInfo = linkSchema.safeParse(JSON.parse(linkInfo));
  return parsedLinkInfo.success ? parsedLinkInfo.data : null;
}

const TTL_TIME = 60 * 60 * 24; // 1 day in seconds

async function saveLinkInfoToKv(env: Env, id: string, linkInfo: LinkSchemaType) {
  try {
    await env.CACHE.put(id, JSON.stringify(linkInfo), {
      expirationTtl: TTL_TIME,
    });
  } catch (error) {
    console.error('Error saving link info to KV:', error);
  }
}

export async function getRoutingDestinations(env: Env, id: string) {
  const linkInfo = await getLinkInfoFromKv(env, id);
  if (linkInfo) {
    return linkInfo;
  }

  const linkInfoFromDb = await getLink(id);
  if (!linkInfoFromDb) {
    return null;
  }
  await saveLinkInfoToKv(env, id, linkInfoFromDb);
  return linkInfoFromDb;
}

export function getDestinationForCountry(linkInfo: LinkSchemaType, countryCode?: string) {
  if (!countryCode) {
    return linkInfo.destinations.default;
  }

  // Check if the country code exists in destinations
  if (linkInfo.destinations[countryCode]) {
    return linkInfo.destinations[countryCode];
  }

  // Fallback to default
  return linkInfo.destinations.default;
}

export async function scheduleEvalWorkflow(env: Env, event: LinkClickMessageType) {
  const doId = env.EVALUATION_SCHEDULER_OBJECT.idFromName(`${event.data.id}:${event.data.destination}`); // use a combination of link ID and destination URL as the DO name
  const stub = env.EVALUATION_SCHEDULER_OBJECT.get(doId);
  await stub.collectLinkClick(event.data.accountId, event.data.id, event.data.destination, event.data.country || 'UNKNOWN');
}

export async function captureLinkClickInBackground(env: Env, event: LinkClickMessageType) {
  env.QUEUE.send(event);
  const doId = env.LINK_CLICK_TRACKER_OBJECT.idFromName(event.data.accountId); // use link click account ID as the DO name
  const stub = env.LINK_CLICK_TRACKER_OBJECT.get(doId);
  if (!event.data.latitude || !event.data.longitude || !event.data.country) return;
  await stub.addClick(event.data.latitude, event.data.longitude, event.data.country, new Date(event.data.timestamp).valueOf());
}
