/**
 * A plain-object representation of an HTTP request, suitable for JSON schema validation.
 *
 * Canonical forms (enforced by decomposeRequest):
 *  - protocol: lowercase  (e.g. "https")
 *  - domain:   lowercase  (e.g. "api.github.com")
 *  - method:   UPPERCASE  (e.g. "GET")
 *  - headers:  keys are lowercase (e.g. "content-type")
 */

/**
 * Caller-supplied metadata that is not derived from the request itself
 * (e.g. the identity of the agent making the request). Subfields are
 * arbitrary; schemas and hooks can inspect them.
 */
export type CustomMetadata = Readonly<Record<string, unknown>>;

interface DecomposedRequestCoreFields {
  readonly protocol: string;
  readonly domain: string;
  readonly port: number;
  readonly path: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly queryParams: Readonly<Record<string, string>>;
  readonly body: string | undefined;
}

/**
 * `parsedBody` is the structured form of the body. It is only present when the
 * raw body could be parsed into a structured value, which currently happens for
 * JSON request bodies. Other content types (e.g. XML, GraphQL) may be supported
 * later. `customMetadata` is only present when the caller supplied it.
 */
export type DecomposedRequest = DecomposedRequestCoreFields & {
  readonly parsedBody?: unknown;
  readonly customMetadata?: CustomMetadata;
};

// Listing every key explicitly is enforced by the `Record<keyof ...>` type, so
// the set of valid property names cannot drift from `DecomposedRequest`.
const decomposedRequestPropertyNameFlags: Record<keyof DecomposedRequest, true> = {
  protocol: true,
  domain: true,
  port: true,
  path: true,
  method: true,
  headers: true,
  queryParams: true,
  body: true,
  parsedBody: true,
  customMetadata: true,
};

export const decomposedRequestPropertyNames: ReadonlySet<string> = new Set(
  Object.keys(decomposedRequestPropertyNameFlags)
);

function isJsonContentType(contentType: string | undefined): boolean {
  if (contentType === undefined) {
    return false;
  }
  const mediaType = contentType.split(';', 1)[0]!.trim().toLowerCase();
  return mediaType === 'application/json' || mediaType.endsWith('+json');
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function decomposeRequest(
  request: Request,
  customMetadata?: CustomMetadata
): Promise<DecomposedRequest> {
  const url = new URL(request.url);

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const protocol = url.protocol.replace(/:$/, '').toLowerCase();
  const domain = url.hostname.toLowerCase();
  const defaultPort = protocol === 'https' ? 443 : 80;
  const port = url.port === '' ? defaultPort : Number(url.port);

  let body: string | undefined;
  let parsedBody: unknown;
  if (request.body !== null) {
    const text = await request.clone().text();
    body = text === '' ? undefined : text;
    if (body !== undefined && isJsonContentType(headers['content-type'])) {
      parsedBody = tryParseJson(body);
    }
  }

  return {
    protocol,
    domain,
    port,
    path: url.pathname,
    method: request.method.toUpperCase(),
    headers,
    queryParams,
    body,
    ...(parsedBody === undefined ? {} : { parsedBody }),
    ...(customMetadata === undefined ? {} : { customMetadata }),
  };
}
