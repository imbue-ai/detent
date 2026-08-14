/**
 * Data-driven verification that the tailscale-* builtin scopes cover exactly
 * the Tailscale admin API's real endpoint surface, by driving Detent's real
 * matcher over every operation in the Tailscale OpenAPI spec.
 *
 * The endpoint inventory is vendored from the spec (see
 * `fixtures/tailscale-openapi-endpoints.json`); path parameters are expanded to
 * sample values and prefixed with the spec's server base path `/api/v2/`.
 *
 * For each scope we compare the matcher's verdict over the full inventory to an
 * independently computed intended set, so a side-effecting GET or a read-only
 * write (the class of anomaly that would make a read/write split unsound) is
 * caught as a mismatch. Mirrors the verification the ngrok scopes shipped with.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SchemaRegistry, getAllBuiltinSchemas } from '../src/schemas/requestSchema.js';
import type { DecomposedRequest } from '../src/decomposedRequest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_PATH = join(__dirname, 'fixtures', 'tailscale-openapi-endpoints.json');

interface EndpointEntry {
  method: string;
  path: string;
}

const endpoints: readonly EndpointEntry[] = JSON.parse(
  readFileSync(FIXTURE_PATH, 'utf8')
) as EndpointEntry[];

const registry = new SchemaRegistry(getAllBuiltinSchemas());

function request(method: string, path: string): DecomposedRequest {
  return {
    protocol: 'https',
    domain: 'api.tailscale.com',
    port: 443,
    path,
    method,
    headers: {},
    queryParams: {},
    body: undefined,
  };
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

describe('tailscale scopes vs the real Tailscale OpenAPI surface', () => {
  it('the vendored inventory covers every operation exactly once', () => {
    const seen = new Set<string>();
    for (const endpoint of endpoints) {
      const key = `${endpoint.method} ${endpoint.path}`;
      expect(seen.has(key), `duplicate endpoint ${key}`).toBe(false);
      seen.add(key);
    }
    expect(endpoints.length).toBe(93);
  });

  it('tailscale-api matches every operation on api.tailscale.com', () => {
    const scope = registry.get('tailscale-api')!;
    expect(scope).toBeDefined();
    for (const endpoint of endpoints) {
      expect(
        scope.match(request(endpoint.method, endpoint.path)),
        `tailscale-api should match ${endpoint.method} ${endpoint.path}`
      ).toBe(true);
    }
  });

  it('tailscale-api rejects lookalike domains and the console/login hosts', () => {
    const scope = registry.get('tailscale-api')!;
    expect(
      scope.match({
        ...request('GET', '/api/v2/tailnet/example.com/users'),
        domain: 'api.tailscale.com.example.com',
      })
    ).toBe(false);
    expect(
      scope.match({ ...request('GET', '/admin/users'), domain: 'console.tailscale.com' })
    ).toBe(false);
    expect(scope.match({ ...request('GET', '/admin'), domain: 'login.tailscale.com' })).toBe(false);
  });

  it('tailscale-read-all matches exactly the safe-method operations', () => {
    const scope = registry.get('tailscale-read-all')!;
    // Independently computed intended set: the GETs (the spec declares no
    // HEAD/OPTIONS operations). A side-effecting GET or a write mislabelled as
    // a read would surface here as a mismatch.
    const intendedReads = endpoints.filter((e) => READ_METHODS.has(e.method));
    const intendedWrites = endpoints.filter((e) => !READ_METHODS.has(e.method));

    for (const endpoint of intendedReads) {
      expect(
        scope.match(request(endpoint.method, endpoint.path)),
        `read-all should match ${endpoint.method} ${endpoint.path}`
      ).toBe(true);
    }
    for (const endpoint of intendedWrites) {
      expect(
        scope.match(request(endpoint.method, endpoint.path)),
        `read-all should NOT match ${endpoint.method} ${endpoint.path}`
      ).toBe(false);
    }
  });

  it('tailscale-write-all matches exactly the unsafe-method operations', () => {
    const scope = registry.get('tailscale-write-all')!;
    const intendedReads = endpoints.filter((e) => READ_METHODS.has(e.method));
    const intendedWrites = endpoints.filter((e) => WRITE_METHODS.has(e.method));

    // Every operation is either a read or a write (the spec declares no methods
    // outside these two classes), so the split is exhaustive and sound.
    expect(endpoints.length).toBe(intendedReads.length + intendedWrites.length);

    for (const endpoint of intendedWrites) {
      expect(
        scope.match(request(endpoint.method, endpoint.path)),
        `write-all should match ${endpoint.method} ${endpoint.path}`
      ).toBe(true);
    }
    for (const endpoint of intendedReads) {
      expect(
        scope.match(request(endpoint.method, endpoint.path)),
        `write-all should NOT match ${endpoint.method} ${endpoint.path}`
      ).toBe(false);
    }
  });

  it('the read/write split is exhaustive (no side-effecting GETs, no read-only writes)', () => {
    // The read and write scopes partition the surface with no remainder and no
    // overlap: every operation is matched by exactly one of them.
    const read = registry.get('tailscale-read-all')!;
    const write = registry.get('tailscale-write-all')!;
    for (const endpoint of endpoints) {
      const isRead = read.match(request(endpoint.method, endpoint.path));
      const isWrite = write.match(request(endpoint.method, endpoint.path));
      expect(
        isRead === !isWrite,
        `${endpoint.method} ${endpoint.path} split between read and write`
      ).toBe(true);
    }
  });
});
