import puppeteer from '@cloudflare/puppeteer';

export async function collectDestinationInfo(env: Env, destinationUrl: string) {
  const browser = await puppeteer.launch(env.VIRTUAL_BROWSER);
  const page = await browser.newPage();

  // waits until there are no more than 2 network connections for at least 500 ms.
  const response = await page.goto(destinationUrl, { waitUntil: 'networkidle2' });

  const bodyText = (await page.$eval('body', (el) => el.innerText)) as string;
  const html = await page.content();
  const status = response ? response.status() : 0;

  const screenshot = await page.screenshot({ encoding: 'base64' });
  const screenshotDataUri = `data:image/png;base64;${screenshot}`;

  await browser.close();

  return {
    bodyText,
    html,
    status,
    screenshotDataUri,
  };
}
