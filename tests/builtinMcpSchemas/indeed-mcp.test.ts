import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.indeed.com';
const PATH = '/claude/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

// The two tools with confirmed identifiers, plus read-style names the resume and
// company tools (documented only by display name) are likely to use.
const READ_TOOLS = [
  'search_jobs',
  'get_job_details',
  'get_resume',
  'get_company_data',
  'getCompanyData',
  'list-companies',
  'get',
];

// Indeed documents no write tools; these are representative write-style names.
const WRITE_TOOLS = [
  'apply_to_job',
  'save_job',
  'update_resume',
  'delete_resume',
  'getaway_job', // "get" followed by a letter is not a read verb
  'settings',
];

describe('builtin schemas: indeed-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('indeed-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('indeed-mcp-api', makeRequest({ domain: 'apis.indeed.com' }))).toBe(false);
    expect(matches('indeed-mcp-api', makeRequest({ domain: 'secure.indeed.com' }))).toBe(false);
    expect(matches('indeed-mcp-api', makeRequest({ domain: 'www.indeed.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('indeed-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('indeed-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('indeed-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('indeed-mcp-session', toolRequest('search_jobs'))).toBe(false);
    expect(matches('indeed-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('indeed-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('indeed-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('indeed-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('indeed-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('indeed-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('indeed-mcp-write-all', rpcRequest('initialize'))).toBe(true);
  });

  it('read-jobs matches the job tools and nothing else', () => {
    for (const tool of ['search_jobs', 'get_job_details']) {
      expect(matches('indeed-mcp-read-jobs', toolRequest(tool)), tool).toBe(true);
      expect(
        matches('indeed-mcp-read-jobs', mcpRequest(DOMAIN, '/mcp', mcpToolCall(tool))),
        `${tool} wrong path`
      ).toBe(false);
    }
    for (const tool of ['get_resume', 'get_company_data', 'apply_to_job']) {
      expect(matches('indeed-mcp-read-jobs', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('indeed-mcp-read-jobs', rpcRequest('initialize'))).toBe(false);
    expect(matches('indeed-mcp-read-jobs', rpcRequest('tools/list'))).toBe(false);
  });

  it('permission schemas accept a trailing slash on the endpoint path', () => {
    expect(
      matches('indeed-mcp-read-all', mcpRequest(DOMAIN, '/claude/mcp/', mcpToolCall('search_jobs')))
    ).toBe(true);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    const bodyless = makeRequest({ domain: DOMAIN, method: 'POST', path: PATH });
    expect(matches('indeed-mcp-read-all', bodyless)).toBe(false);
    expect(matches('indeed-mcp-write-all', bodyless)).toBe(false);
    expect(matches('indeed-mcp-session', bodyless)).toBe(false);
    expect(matches('indeed-mcp-read-jobs', bodyless)).toBe(false);
  });
});
