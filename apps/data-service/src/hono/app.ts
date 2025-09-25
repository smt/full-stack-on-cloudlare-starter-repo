import { Hono } from 'hono';

export const App = new Hono<{ Bindings: Env }>();

const UNKNOWN = 'unknown';

App.get('/:id', async (c) => {
  console.log(JSON.stringify(c.req.raw.cf));
  const cf = c.req.raw.cf;
  const country = cf?.country ?? UNKNOWN;
  const lat = cf?.latitude ?? UNKNOWN;
  const lng = cf?.longitude ?? UNKNOWN;
  return c.json({
    country,
    lat,
    lng,
  });
});
