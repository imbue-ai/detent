import { describe, it, expect } from 'vitest';
import {
  builtinRegistry,
  matches,
  mcpRequest,
  mcpRpc,
  mcpToolCall,
  makeRequest,
} from './helpers.js';

const DOMAIN = 'mcp.strava.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

// Strava's hosted MCP server exposes read-only tools only, so there is no write-all schema.
const READ_TOOLS = [
  'health',
  'get_athlete_profile',
  'get_athlete_zones',
  'list_activities',
  'get_activity_streams',
  'get_activity_performance',
  'get_club_info',
  'get_gear',
];

const FINE_GRAINED: Record<string, string[]> = {
  'strava-mcp-read-activities': [
    'list_activities',
    'get_activity_streams',
    'get_activity_performance',
  ],
  'strava-mcp-read-profile': ['get_athlete_profile', 'get_athlete_zones'],
  'strava-mcp-read-clubs': ['get_club_info'],
  'strava-mcp-read-gear': ['get_gear'],
  'strava-mcp-check-health': ['health'],
};

describe('builtin schemas: strava-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('strava-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('strava-mcp-api', makeRequest({ domain: 'www.strava.com' }))).toBe(false);
    expect(matches('strava-mcp-api', makeRequest({ domain: 'strava.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('strava-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('strava-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('strava-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('strava-mcp-session', toolRequest('list_activities'))).toBe(false);
    expect(matches('strava-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('read-all covers every tool and the handshake; there is no write-all', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('strava-mcp-read-all', toolRequest(tool)), tool).toBe(true);
    }
    expect(matches('strava-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('strava-mcp-read-all', rpcRequest('tools/list'))).toBe(true);
    expect(matches('strava-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('strava-mcp-read-all', toolRequest('create_activity'))).toBe(false);
    expect(builtinRegistry.get('strava-mcp-write-all')).toBeUndefined();
  });

  it('fine-grained schemas match exactly their tools and cover every tool', () => {
    const covered = new Set(Object.values(FINE_GRAINED).flat());
    expect([...covered].sort()).toEqual([...READ_TOOLS].sort());
    for (const [schema, tools] of Object.entries(FINE_GRAINED)) {
      for (const tool of READ_TOOLS) {
        expect(matches(schema, toolRequest(tool)), `${schema} / ${tool}`).toBe(
          tools.includes(tool)
        );
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
      for (const tool of tools) {
        expect(matches(schema, mcpRequest(DOMAIN, '/v1/other', mcpToolCall(tool))), schema).toBe(
          false
        );
        expect(
          matches(
            schema,
            makeRequest({ domain: DOMAIN, path: PATH, parsedBody: mcpToolCall(tool) })
          ),
          `${schema} with GET`
        ).toBe(false);
      }
    }
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('strava-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches(
        'strava-mcp-read-activities',
        makeRequest({ domain: DOMAIN, method: 'POST', path: PATH })
      )
    ).toBe(false);
  });
});
