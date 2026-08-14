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
 * caught as a mismatch. The granular scopes (users, devices, keys) are checked
 * the same way, narrowed by path pattern. Mirrors the verification the ngrok
 * scopes shipped with.
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

// Independently computed path patterns for the three granular areas. These are
// the same patterns the schemas declare, written here from scratch so a typo in
// the schema that narrows the wrong surface is caught as a mismatch.
const AREA_PATTERNS = {
  users: /^\/api\/v2\/(users\/|user-invites\/|tailnet\/[^/]+\/users|tailnet\/[^/]+\/user-invites)/,
  devices:
    /^\/api\/v2\/(device-invites\/|device\/|tailnet\/[^/]+\/devices|tailnet\/[^/]+\/device-attributes)/,
  keys: /^\/api\/v2\/tailnet\/[^/]+\/keys/,
} as const;

function verifyScopeMatchesExactly(
  scopeName: string,
  isIntended: (endpoint: EndpointEntry) => boolean
): void {
  const scope = registry.get(scopeName)!;
  expect(scope, `scope ${scopeName} should exist`).toBeDefined();
  for (const endpoint of endpoints) {
    const intended = isIntended(endpoint);
    const matched = scope.match(request(endpoint.method, endpoint.path));
    expect(
      matched === intended,
      `${scopeName}: ${endpoint.method} ${endpoint.path} should ${intended ? 'match' : 'NOT match'}`
    ).toBe(true);
  }
}

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
    verifyScopeMatchesExactly('tailscale-read-all', (e) => READ_METHODS.has(e.method));
  });

  it('tailscale-write-all matches exactly the unsafe-method operations', () => {
    verifyScopeMatchesExactly('tailscale-write-all', (e) => WRITE_METHODS.has(e.method));
  });

  it('the read/write umbrella split is exhaustive (no side-effecting GETs, no read-only writes)', () => {
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

  // The granular scopes narrow the surface by area (users, devices, keys),
  // split read/write within each. Each is verified against its independently
  // computed intended set over the full real endpoint inventory.
  describe('granular scopes: users', () => {
    it('tailscale-read-users matches exactly the safe-method user operations', () => {
      verifyScopeMatchesExactly(
        'tailscale-read-users',
        (e) => READ_METHODS.has(e.method) && AREA_PATTERNS.users.test(e.path)
      );
    });
    it('tailscale-write-users matches exactly the unsafe-method user operations', () => {
      verifyScopeMatchesExactly(
        'tailscale-write-users',
        (e) => WRITE_METHODS.has(e.method) && AREA_PATTERNS.users.test(e.path)
      );
    });
  });

  describe('granular scopes: devices', () => {
    it('tailscale-read-devices matches exactly the safe-method device operations', () => {
      verifyScopeMatchesExactly(
        'tailscale-read-devices',
        (e) => READ_METHODS.has(e.method) && AREA_PATTERNS.devices.test(e.path)
      );
    });
    it('tailscale-write-devices matches exactly the unsafe-method device operations', () => {
      verifyScopeMatchesExactly(
        'tailscale-write-devices',
        (e) => WRITE_METHODS.has(e.method) && AREA_PATTERNS.devices.test(e.path)
      );
    });
  });

  describe('granular scopes: keys', () => {
    it('tailscale-read-keys matches exactly the safe-method key operations', () => {
      verifyScopeMatchesExactly(
        'tailscale-read-keys',
        (e) => READ_METHODS.has(e.method) && AREA_PATTERNS.keys.test(e.path)
      );
    });
    it('tailscale-write-keys matches exactly the unsafe-method key operations', () => {
      verifyScopeMatchesExactly(
        'tailscale-write-keys',
        (e) => WRITE_METHODS.has(e.method) && AREA_PATTERNS.keys.test(e.path)
      );
    });
  });

  it('the three granular areas partition the surface with no overlap', () => {
    for (const endpoint of endpoints) {
      const areas = [
        AREA_PATTERNS.users.test(endpoint.path),
        AREA_PATTERNS.devices.test(endpoint.path),
        AREA_PATTERNS.keys.test(endpoint.path),
      ];
      const count = areas.filter(Boolean).length;
      expect(
        count <= 1,
        `${endpoint.method} ${endpoint.path} matched ${String(count)} areas (should be 0 or 1)`
      ).toBe(true);
    }
  });
});
