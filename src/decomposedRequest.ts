/**
 * A plain-object representation of an HTTP request, suitable for JSON schema validation.
 *
 * Canonical forms (enforced by decomposeRequest):
 *  - protocol: lowercase  (e.g. "https")
 *  - domain:   lowercase  (e.g. "api.github.com")
 *  - method:   UPPERCASE  (e.g. "GET")
 *  - headers:  keys are lowercase (e.g. "content-type")
 */

const decomposedRequestCoreFieldTypes = {
  protocol: '' as string,
  domain: '' as string,
  port: 0 as number,
  path: '' as string,
  method: '' as string,
  headers: {} as Readonly<Record<string, string>>,
  queryParams: {} as Readonly<Record<string, string>>,
  body: undefined as string | undefined,
} as const satisfies Record<string, unknown>;

/**
 * The structured form of the body. Only present when the raw body could be
 * parsed into a structured value, which currently happens for JSON request
 * bodies. Other content types (e.g. XML, GraphQL) may be supported later.
 */
export type DecomposedRequest = Readonly<typeof decomposedRequestCoreFieldTypes> & {
  readonly parsedBody?: unknown;
};

export const decomposedRequestPropertyNames: ReadonlySet<string> = new Set([
  ...Object.keys(decomposedRequestCoreFieldTypes),
  'parsedBody',
]);

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

export async function decomposeRequest(request: Request): Promise<DecomposedRequest> {
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
  };
}
