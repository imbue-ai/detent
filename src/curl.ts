// Deep imports (rather than the `curlconverter` barrel) to avoid eagerly
// loading ~50 unrelated code generators (Python, Go, Rust, ...) at startup.
// This shaves ~25ms off CLI cold start. curlconverter's package.json has no
// `exports` map, so these internal paths are reachable; they're stable across
// the 4.x line but worth revisiting on any major bump.
import { toHarString } from 'curlconverter/dist/src/generators/har.js';
import { CCError } from 'curlconverter/dist/src/utils.js';

export class CurlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CurlParseError';
  }
}

/**
 * Subset of the HAR 1.2 request object that we actually consume.
 * See: http://www.softwareishard.com/blog/har-12-spec/#request
 */
interface HarNameValue {
  readonly name: string;
  readonly value: string;
}
interface HarPostData {
  readonly mimeType?: string;
  readonly text?: string;
  readonly params?: readonly HarNameValue[];
}
interface HarRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: readonly HarNameValue[];
  readonly cookies: readonly HarNameValue[];
  readonly queryString: readonly HarNameValue[];
  readonly postData?: HarPostData;
}
interface HarLog {
  readonly log: { readonly entries: readonly { readonly request: HarRequest }[] };
}

/**
 * Parse an argv-style list of curl arguments (excluding the leading `curl`
 * command name) into a `Request` object.
 *
 * Under the hood this delegates to curlconverter's HAR generator, which
 * handles the full curl flag vocabulary, attached short-flag values
 * (e.g. `-XPOST`), `-G` query-string promotion, default scheme inference,
 * and so on. HAR is used (over curlconverter's JSON format) because it
 * preserves raw body bytes and is a stable standard format.
 */
export function parseCurlArgs(args: readonly string[]): Request {
  let harLog: HarLog;
  try {
    harLog = JSON.parse(toHarString(['curl', ...args])) as HarLog;
  } catch (error: unknown) {
    if (error instanceof CCError) {
      throw new CurlParseError(error.message);
    }
    throw error;
  }

  const harRequest = harLog.log.entries[0]?.request;
  if (harRequest === undefined) {
    throw new CurlParseError('curlconverter produced an empty HAR log');
  }

  const init: RequestInit = {
    method: harRequest.method,
    headers: buildHeaders(harRequest.headers, harRequest.cookies),
  };
  const body = buildBody(harRequest.postData);
  if (body !== undefined) {
    init.body = body;
  }

  return new Request(buildUrl(harRequest.url, harRequest.queryString), init);
}

/**
 * Recombine HAR's separated `url` (path only) and `queryString` (list) into a
 * single URL string. HAR always strips query params out of `url`, even when
 * they were present in the original curl command.
 */
function buildUrl(baseUrl: string, queryString: readonly HarNameValue[]): string {
  if (queryString.length === 0) {
    return baseUrl;
  }
  const parsed = new URL(baseUrl);
  parsed.search = '';
  for (const { name, value } of queryString) {
    parsed.searchParams.append(name, value);
  }
  return parsed.toString();
}

/**
 * Fold HAR's separate `cookies` list back into a `Cookie` header. curl sends
 * cookies via that header, so putting them there makes the resulting Request
 * semantically equivalent to what curl would actually transmit.
 */
function buildHeaders(
  headers: readonly HarNameValue[],
  cookies: readonly HarNameValue[]
): [string, string][] {
  const result: [string, string][] = headers.map(({ name, value }) => [name, value]);
  if (cookies.length > 0) {
    const cookieHeader = cookies.map(({ name, value }) => `${name}=${value}`).join('; ');
    result.push(['Cookie', cookieHeader]);
  }
  return result;
}

/**
 * Reconstruct a body string from HAR's `postData`. HAR uses `text` for raw
 * bodies and `params` for parsed form-urlencoded key/value pairs. We don't
 * reconstruct multipart form uploads (curlconverter omits postData for `-F`).
 */
function buildBody(postData: HarPostData | undefined): string | undefined {
  if (postData === undefined) {
    return undefined;
  }
  if (postData.text !== undefined) {
    return postData.text;
  }
  if (postData.params !== undefined) {
    const params = new URLSearchParams();
    for (const { name, value } of postData.params) {
      params.append(name, value);
    }
    return params.toString();
  }
  return undefined;
}
