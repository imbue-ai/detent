export class CurlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CurlParseError';
  }
}

/**
 * Short flags (single letter) that consume the next argument as their value.
 * Derived from `curl --help all` — every short flag shown with `<...>`.
 */
const SHORT_FLAGS_WITH_VALUE = new Set([
  '-A', // user-agent
  '-b', // cookie
  '-c', // cookie-jar
  '-C', // continue-at
  '-d', // data
  '-D', // dump-header
  '-E', // cert
  '-F', // form
  '-h', // help
  '-H', // header
  '-K', // config
  '-m', // max-time
  '-o', // output
  '-P', // ftp-port
  '-Q', // quote
  '-r', // range
  '-e', // referer
  '-t', // telnet-option
  '-T', // upload-file
  '-u', // user
  '-U', // proxy-user
  '-w', // write-out
  '-X', // request
  '-x', // proxy
  '-Y', // speed-limit
  '-y', // speed-time
  '-z', // time-cond
]);

/**
 * Long flags that consume the next argument as their value.
 * Derived from `curl --help all` — every long flag shown with `<...>`.
 */
const LONG_FLAGS_WITH_VALUE = new Set([
  '--abstract-unix-socket',
  '--alt-svc',
  '--aws-sigv4',
  '--cacert',
  '--capath',
  '--cert',
  '--cert-type',
  '--ciphers',
  '--config',
  '--connect-timeout',
  '--connect-to',
  '--continue-at',
  '--cookie',
  '--cookie-jar',
  '--create-file-mode',
  '--crlfile',
  '--curves',
  '--data',
  '--data-ascii',
  '--data-binary',
  '--data-raw',
  '--data-urlencode',
  '--delegation',
  '--dns-interface',
  '--dns-ipv4-addr',
  '--dns-ipv6-addr',
  '--dns-servers',
  '--doh-url',
  '--dump-header',
  '--egd-file',
  '--engine',
  '--etag-compare',
  '--etag-save',
  '--expect100-timeout',
  '--form',
  '--form-string',
  '--ftp-account',
  '--ftp-alternative-to-user',
  '--ftp-method',
  '--ftp-port',
  '--ftp-ssl-ccc-mode',
  '--happy-eyeballs-timeout-ms',
  '--header',
  '--help',
  '--hostpubmd5',
  '--hostpubsha256',
  '--hsts',
  '--interface',
  '--json',
  '--keepalive-time',
  '--key',
  '--key-type',
  '--krb',
  '--libcurl',
  '--limit-rate',
  '--local-port',
  '--login-options',
  '--mail-auth',
  '--mail-from',
  '--mail-rcpt',
  '--max-filesize',
  '--max-redirs',
  '--max-time',
  '--netrc-file',
  '--noproxy',
  '--oauth2-bearer',
  '--output',
  '--output-dir',
  '--parallel-max',
  '--pass',
  '--pinnedpubkey',
  '--preproxy',
  '--proto',
  '--proto-default',
  '--proto-redir',
  '--proxy',
  '--proxy-cacert',
  '--proxy-capath',
  '--proxy-cert',
  '--proxy-cert-type',
  '--proxy-ciphers',
  '--proxy-crlfile',
  '--proxy-header',
  '--proxy-key',
  '--proxy-key-type',
  '--proxy-pass',
  '--proxy-pinnedpubkey',
  '--proxy-service-name',
  '--proxy-tls13-ciphers',
  '--proxy-tlsauthtype',
  '--proxy-tlspassword',
  '--proxy-tlsuser',
  '--proxy-user',
  '--proxy1.0',
  '--pubkey',
  '--quote',
  '--random-file',
  '--range',
  '--rate',
  '--referer',
  '--request',
  '--request-target',
  '--resolve',
  '--retry',
  '--retry-delay',
  '--retry-max-time',
  '--sasl-authzid',
  '--service-name',
  '--socks4',
  '--socks4a',
  '--socks5',
  '--socks5-gssapi-service',
  '--socks5-hostname',
  '--speed-limit',
  '--speed-time',
  '--stderr',
  '--telnet-option',
  '--tftp-blksize',
  '--time-cond',
  '--tls-max',
  '--tls13-ciphers',
  '--tlsauthtype',
  '--tlspassword',
  '--tlsuser',
  '--trace',
  '--trace-ascii',
  '--unix-socket',
  '--upload-file',
  '--url',
  '--url-query',
  '--user',
  '--user-agent',
  '--write-out',
]);

function consumeNextArg(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined) {
    throw new CurlParseError(`Missing value for ${flag}`);
  }
  return value;
}

/**
 * Split a combined short flag into its flag and inline value.
 * Curl allows value-taking short flags to have their value attached directly,
 * e.g. `-XPOST` is equivalent to `-X POST`.
 *
 * Returns the inline value if the flag is known to take a value, or undefined
 * if the flag is boolean (no value) or not recognized.
 */
function extractInlineShortFlagValue(
  arg: string
): { flag: string; inlineValue: string } | undefined {
  if (arg.length <= 2) {
    return undefined;
  }
  const flag = arg.slice(0, 2);
  if (SHORT_FLAGS_WITH_VALUE.has(flag)) {
    return { flag, inlineValue: arg.slice(2) };
  }
  return undefined;
}

export function parseCurlArgs(args: readonly string[]): Request {
  let method: string | undefined;
  let url: string | undefined;
  const headers: Record<string, string> = {};
  const bodyParts: string[] = [];
  let hasFormData = false;
  let hasJsonFlag = false;
  let isHead = false;
  let isGet = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    // -- Long flags --
    if (arg.startsWith('--')) {
      if (arg === '--request') {
        method = consumeNextArg(args, i, arg);
        i++;
      } else if (arg === '--header') {
        const value = consumeNextArg(args, i, arg);
        i++;
        const colonIndex = value.indexOf(':');
        if (colonIndex === -1) {
          throw new CurlParseError(`Invalid header format: ${value}`);
        }
        headers[value.slice(0, colonIndex).trim()] = value.slice(colonIndex + 1).trim();
      } else if (
        arg === '--data' ||
        arg === '--data-ascii' ||
        arg === '--data-binary' ||
        arg === '--data-raw' ||
        arg === '--data-urlencode'
      ) {
        bodyParts.push(consumeNextArg(args, i, arg));
        i++;
      } else if (arg === '--form' || arg === '--form-string') {
        // -F/--form sends multipart/form-data, implies POST
        consumeNextArg(args, i, arg); // consume but we don't reconstruct multipart
        i++;
        hasFormData = true;
      } else if (arg === '--json') {
        bodyParts.push(consumeNextArg(args, i, arg));
        i++;
        hasJsonFlag = true;
      } else if (arg === '--url') {
        url = consumeNextArg(args, i, arg);
        i++;
      } else if (arg === '--user-agent') {
        headers['User-Agent'] = consumeNextArg(args, i, arg);
        i++;
      } else if (arg === '--referer') {
        headers.Referer = consumeNextArg(args, i, arg);
        i++;
      } else if (arg === '--cookie') {
        headers.Cookie = consumeNextArg(args, i, arg);
        i++;
      } else if (arg === '--upload-file') {
        consumeNextArg(args, i, arg);
        i++;
        // --upload-file implies PUT
        method ??= 'PUT';
      } else if (arg === '--head') {
        isHead = true;
      } else if (arg === '--get') {
        isGet = true;
      } else if (LONG_FLAGS_WITH_VALUE.has(arg)) {
        consumeNextArg(args, i, arg); // skip the value
        i++;
      }
      // Boolean long flags are simply ignored
      continue;
    }

    // -- Short flags --
    if (arg.startsWith('-') && arg.length > 1) {
      // Handle combined short flags like `-XPOST` (equivalent to `-X POST`).
      const inlineResult = extractInlineShortFlagValue(arg);
      const shortFlag = inlineResult !== undefined ? inlineResult.flag : arg;

      const consumeShortFlagValue = (flag: string): string => {
        if (inlineResult !== undefined) {
          return inlineResult.inlineValue;
        }
        const value = consumeNextArg(args, i, flag);
        i++;
        return value;
      };

      if (shortFlag === '-X') {
        method = consumeShortFlagValue(shortFlag);
      } else if (shortFlag === '-H') {
        const value = consumeShortFlagValue(shortFlag);
        const colonIndex = value.indexOf(':');
        if (colonIndex === -1) {
          throw new CurlParseError(`Invalid header format: ${value}`);
        }
        headers[value.slice(0, colonIndex).trim()] = value.slice(colonIndex + 1).trim();
      } else if (shortFlag === '-d') {
        bodyParts.push(consumeShortFlagValue(shortFlag));
      } else if (shortFlag === '-F') {
        consumeShortFlagValue(shortFlag);
        hasFormData = true;
      } else if (shortFlag === '-T') {
        consumeShortFlagValue(shortFlag);
        method ??= 'PUT';
      } else if (shortFlag === '-A') {
        headers['User-Agent'] = consumeShortFlagValue(shortFlag);
      } else if (shortFlag === '-e') {
        headers.Referer = consumeShortFlagValue(shortFlag);
      } else if (shortFlag === '-b') {
        headers.Cookie = consumeShortFlagValue(shortFlag);
      } else if (shortFlag === '-I') {
        isHead = true;
      } else if (shortFlag === '-G') {
        isGet = true;
      } else if (SHORT_FLAGS_WITH_VALUE.has(shortFlag)) {
        consumeShortFlagValue(shortFlag);
      }
      // Boolean short flags are simply ignored
      continue;
    }

    // Positional argument: URL
    url = arg;
  }

  if (url === undefined) {
    throw new CurlParseError('No URL provided in curl arguments');
  }

  // Determine the effective method
  const hasBody = bodyParts.length > 0 || hasFormData;
  let effectiveMethod: string;
  if (method !== undefined) {
    effectiveMethod = method;
  } else if (isHead) {
    effectiveMethod = 'HEAD';
  } else if (isGet) {
    effectiveMethod = 'GET';
  } else if (hasBody) {
    effectiveMethod = 'POST';
  } else {
    effectiveMethod = 'GET';
  }

  // When -G is used, data goes into the query string, not the body
  if (isGet && bodyParts.length > 0) {
    const parsed = new URL(url);
    for (const part of bodyParts) {
      for (const pair of part.split('&')) {
        const equalsIndex = pair.indexOf('=');
        if (equalsIndex === -1) {
          parsed.searchParams.append(pair, '');
        } else {
          parsed.searchParams.append(pair.slice(0, equalsIndex), pair.slice(equalsIndex + 1));
        }
      }
    }
    url = parsed.toString();
  }

  // Set implicit content-type headers
  if (hasJsonFlag && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json';
  }

  const body = !isGet && bodyParts.length > 0 ? bodyParts.join('&') : undefined;

  const init: RequestInit = {
    method: effectiveMethod,
    headers,
  };

  if (body !== undefined) {
    init.body = body;
  }

  return new Request(url, init);
}
