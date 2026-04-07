/**
 * A plain-object representation of an HTTP request, suitable for JSON schema validation.
 *
 * Canonical forms (enforced by decomposeRequest):
 *  - protocol: lowercase  (e.g. "https")
 *  - domain:   lowercase  (e.g. "api.github.com")
 *  - method:   UPPERCASE  (e.g. "GET")
 *  - headers:  keys are lowercase (e.g. "content-type")
 */
export interface DecomposedRequest {
  readonly protocol: string;
  readonly domain: string;
  readonly port: number;
  readonly path: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly queryParams: Readonly<Record<string, string>>;
  readonly body: string | undefined;
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
  if (request.body !== null) {
    const text = await request.clone().text();
    body = text === '' ? undefined : text;
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
  };
}
