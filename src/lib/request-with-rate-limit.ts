import * as needle from 'needle';
import Bottleneck from 'bottleneck';
import * as debugLib from 'debug';
import { OutgoingHttpHeaders } from 'http2';

const debug = debugLib('snyk:limiter');

export async function limiterWithRateLimitRetries<ResponseType>(
  verb: needle.NeedleHttpVerbs,
  url: string,
  headers: OutgoingHttpHeaders,
  limiter: Bottleneck,
  rateLimitSleepTime: number,
): Promise<{
  statusCode: number;
  body: ResponseType;
  headers: Record<string, unknown>;
}> {
  let data: {
    statusCode: number;
    body: ResponseType;
    headers: Record<string, unknown>;
  };
  const maxRetries = 7;
  let attempt = 0;
  const encodedUrl = encodeURI(url);
  limiter.on('failed', async (error, jobInfo) => {
    const id = jobInfo.options.id;
    debug(`Job ${id} failed: ${error}`);
    if (jobInfo.retryCount === 0) {
      // Here we only retry once
      debug(`Retrying job ${id} in 25ms!`);
      return 25;
    }
  });
  while (attempt < maxRetries) {
    data = (await limiter.schedule(() =>
      needle(verb, encodedUrl, { headers: headers }),
    )) as {
      statusCode: number;
      body: ResponseType;
      headers: Record<string, unknown>;
    };
    if ([404, 200].includes(Number(data.statusCode))) {
      break;
    }
    if (data.statusCode === 401) {
      console.error(
        `ERROR: ${JSON.stringify(
          data.body,
        )}. Please check the token and try again.`,
      );
      break;
    }
    if (data.statusCode === 429) {
      const sleepTime = (rateLimitSleepTime || 60000) * attempt; // 10 mins x attempt with a max of ~ 1hr
      console.error(
        `Received a rate limit error, sleeping for ${sleepTime} ms (attempt # ${attempt})`,
      );
      await new Promise((r) => setTimeout(r, sleepTime));
    }
    attempt += 1;
  }

  return data!;
}
