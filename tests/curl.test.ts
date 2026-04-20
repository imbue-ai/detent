import { describe, it, expect } from 'vitest';
import { parseCurlArgs, CurlParseError } from '../src/curl.js';

describe('parseCurlArgs', () => {
  describe('URL parsing', () => {
    it('parses a simple URL as a GET request', () => {
      const request = parseCurlArgs(['https://example.com/path']);
      expect(request.method).toBe('GET');
      expect(request.url).toBe('https://example.com/path');
    });

    it('parses URL provided via --url', () => {
      const request = parseCurlArgs(['--url', 'https://example.com/path']);
      expect(request.url).toBe('https://example.com/path');
    });

    it('defaults to http:// when no scheme is provided', () => {
      const request = parseCurlArgs(['www.seznam.cz']);
      expect(request.url).toBe('http://www.seznam.cz/');
      expect(request.method).toBe('GET');
    });

    it('defaults to http:// for schemeless URL via --url', () => {
      const request = parseCurlArgs(['--url', 'example.com/path']);
      expect(request.url).toBe('http://example.com/path');
    });

    it('defaults to http:// for schemeless URL with host:port', () => {
      const request = parseCurlArgs(['example.com:8080/foo']);
      expect(request.url).toBe('http://example.com:8080/foo');
    });

    it('throws CurlParseError when no URL is provided', () => {
      expect(() => parseCurlArgs([])).toThrow(CurlParseError);
      expect(() => parseCurlArgs(['-X', 'GET'])).toThrow(CurlParseError);
    });
  });

  describe('method selection', () => {
    it('parses -X to set the method', () => {
      const request = parseCurlArgs(['-X', 'PUT', 'https://example.com/resource']);
      expect(request.method).toBe('PUT');
    });

    it('parses --request to set the method', () => {
      const request = parseCurlArgs(['--request', 'DELETE', 'https://example.com/resource']);
      expect(request.method).toBe('DELETE');
    });

    it('uses HEAD for -I flag', () => {
      const request = parseCurlArgs(['-I', 'https://example.com']);
      expect(request.method).toBe('HEAD');
    });

    it('uses HEAD for --head flag', () => {
      const request = parseCurlArgs(['--head', 'https://example.com']);
      expect(request.method).toBe('HEAD');
    });

    it('explicit -X overrides -I', () => {
      const request = parseCurlArgs(['-I', '-X', 'GET', 'https://example.com']);
      expect(request.method).toBe('GET');
    });

    it('parses combined short flag -XPOST (value attached without space)', () => {
      const request = parseCurlArgs(['-XPOST', 'https://example.com']);
      expect(request.method).toBe('POST');
    });

    it('parses combined short flag -XDELETE', () => {
      const request = parseCurlArgs(['-XDELETE', 'https://example.com/resource']);
      expect(request.method).toBe('DELETE');
    });

    it('uses GET for -G even with data', () => {
      const request = parseCurlArgs(['-G', '-d', 'q=test', 'https://example.com']);
      expect(request.method).toBe('GET');
    });

    it('appends -d data to query string when -G is used', () => {
      const request = parseCurlArgs([
        '-G',
        '-d',
        'q=hello',
        '-d',
        'page=2',
        'https://example.com/search',
      ]);
      const url = new URL(request.url);
      expect(url.searchParams.get('q')).toBe('hello');
      expect(url.searchParams.get('page')).toBe('2');
      expect(url.pathname).toBe('/search');
    });

    it('merges -G data with existing query params', () => {
      const request = parseCurlArgs([
        '-G',
        '-d',
        'extra=yes',
        'https://example.com/search?q=hello',
      ]);
      const url = new URL(request.url);
      expect(url.searchParams.get('q')).toBe('hello');
      expect(url.searchParams.get('extra')).toBe('yes');
    });

    it('handles -G with multi-pair -d values', () => {
      const request = parseCurlArgs(['-G', '-d', 'a=1&b=2', 'https://example.com']);
      const url = new URL(request.url);
      expect(url.searchParams.get('a')).toBe('1');
      expect(url.searchParams.get('b')).toBe('2');
    });

    it('does not set body when -G is used', async () => {
      const request = parseCurlArgs(['-G', '-d', 'q=test', 'https://example.com']);
      const body = await request.text();
      expect(body).toBe('');
    });
  });

  describe('headers', () => {
    it('parses headers with -H', () => {
      const request = parseCurlArgs([
        '-H',
        'Content-Type: application/json',
        'https://example.com',
      ]);
      expect(request.headers.get('Content-Type')).toBe('application/json');
    });

    it('parses headers with --header', () => {
      const request = parseCurlArgs(['--header', 'Accept: text/html', 'https://example.com']);
      expect(request.headers.get('Accept')).toBe('text/html');
    });

    it('throws CurlParseError for malformed header', () => {
      expect(() => parseCurlArgs(['-H', 'BadHeader', 'https://example.com'])).toThrow(
        CurlParseError
      );
    });

    it('parses -A as User-Agent header', () => {
      const request = parseCurlArgs(['-A', 'MyAgent/1.0', 'https://example.com']);
      expect(request.headers.get('User-Agent')).toBe('MyAgent/1.0');
    });

    it('parses --user-agent as User-Agent header', () => {
      const request = parseCurlArgs(['--user-agent', 'MyAgent/1.0', 'https://example.com']);
      expect(request.headers.get('User-Agent')).toBe('MyAgent/1.0');
    });

    it('parses -e as Referer header', () => {
      const request = parseCurlArgs(['-e', 'https://referrer.com', 'https://example.com']);
      expect(request.headers.get('Referer')).toBe('https://referrer.com');
    });

    it('parses -b as Cookie header', () => {
      const request = parseCurlArgs(['-b', 'session=abc123', 'https://example.com']);
      expect(request.headers.get('Cookie')).toBe('session=abc123');
    });

    it('parses combined -HContent-Type:application/json (value attached without space)', () => {
      const request = parseCurlArgs(['-HContent-Type: application/json', 'https://example.com']);
      expect(request.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('body data', () => {
    it('parses body with -d and defaults to POST', () => {
      const request = parseCurlArgs(['-d', '{"key":"value"}', 'https://example.com']);
      expect(request.method).toBe('POST');
    });

    it('parses combined -d with value attached (no space)', async () => {
      const request = parseCurlArgs(['-d{"key":"value"}', 'https://example.com']);
      expect(request.method).toBe('POST');
      const body = await request.text();
      expect(body).toBe('{"key":"value"}');
    });

    it('parses body with --data-raw', () => {
      const request = parseCurlArgs(['--data-raw', 'payload', 'https://example.com']);
      expect(request.method).toBe('POST');
    });

    it('parses body with --data-binary', () => {
      const request = parseCurlArgs(['--data-binary', 'payload', 'https://example.com']);
      expect(request.method).toBe('POST');
    });

    it('parses body with --data-urlencode', () => {
      const request = parseCurlArgs([
        '--data-urlencode',
        'name=hello world',
        'https://example.com',
      ]);
      expect(request.method).toBe('POST');
    });

    it('concatenates multiple -d args with &', async () => {
      const request = parseCurlArgs(['-d', 'a=1', '-d', 'b=2', 'https://example.com']);
      const body = await request.text();
      expect(body).toBe('a=1&b=2');
    });

    it('does not override explicit method when -d is used', () => {
      const request = parseCurlArgs(['-X', 'PUT', '-d', 'data', 'https://example.com']);
      expect(request.method).toBe('PUT');
    });
  });

  describe('form data (-F/--form)', () => {
    it('implies POST for -F', () => {
      const request = parseCurlArgs(['-F', 'name=value', 'https://example.com']);
      expect(request.method).toBe('POST');
    });

    it('implies POST for --form', () => {
      const request = parseCurlArgs(['--form', 'file=@path', 'https://example.com']);
      expect(request.method).toBe('POST');
    });

    it('implies POST for --form-string', () => {
      const request = parseCurlArgs(['--form-string', 'name=value', 'https://example.com']);
      expect(request.method).toBe('POST');
    });

    it('does not override explicit method for -F', () => {
      const request = parseCurlArgs(['-X', 'PUT', '-F', 'name=value', 'https://example.com']);
      expect(request.method).toBe('PUT');
    });
  });

  describe('--json flag', () => {
    it('implies POST and sets Content-Type', () => {
      const request = parseCurlArgs(['--json', '{"a":1}', 'https://example.com']);
      expect(request.method).toBe('POST');
      expect(request.headers.get('Content-Type')).toBe('application/json');
    });

    it('does not override explicit Content-Type header', () => {
      const request = parseCurlArgs([
        '--json',
        '{"a":1}',
        '-H',
        'Content-Type: text/plain',
        'https://example.com',
      ]);
      expect(request.headers.get('Content-Type')).toBe('text/plain');
    });
  });

  describe('upload file (-T/--upload-file)', () => {
    it('implies PUT for -T', () => {
      const request = parseCurlArgs(['-T', 'file.txt', 'https://example.com']);
      expect(request.method).toBe('PUT');
    });

    it('does not override explicit method for -T', () => {
      const request = parseCurlArgs(['-X', 'POST', '-T', 'file.txt', 'https://example.com']);
      expect(request.method).toBe('POST');
    });
  });

  describe('unknown and boolean flags', () => {
    it('skips boolean flags like -s without consuming next arg', () => {
      const request = parseCurlArgs(['-s', 'https://example.com']);
      expect(request.url).toBe('https://example.com/');
    });

    it('skips boolean long flags like --compressed', () => {
      const request = parseCurlArgs(['--compressed', 'https://example.com']);
      expect(request.url).toBe('https://example.com/');
    });

    it('correctly skips value-taking flags like -o', () => {
      const request = parseCurlArgs(['-o', '/dev/null', 'https://example.com']);
      expect(request.url).toBe('https://example.com/');
    });

    it('correctly skips long value-taking flags like --output', () => {
      const request = parseCurlArgs(['--output', '/dev/null', 'https://example.com']);
      expect(request.url).toBe('https://example.com/');
    });
  });

  describe('error cases', () => {
    it('throws CurlParseError when -X has no value', () => {
      expect(() => parseCurlArgs(['-X'])).toThrow(CurlParseError);
    });

    it('throws CurlParseError when -H has no value', () => {
      expect(() => parseCurlArgs(['-H'])).toThrow(CurlParseError);
    });

    it('throws CurlParseError when -d has no value', () => {
      expect(() => parseCurlArgs(['-d'])).toThrow(CurlParseError);
    });

    it('throws CurlParseError when --json has no value', () => {
      expect(() => parseCurlArgs(['--json'])).toThrow(CurlParseError);
    });
  });
});
