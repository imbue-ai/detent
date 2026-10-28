import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.mixpanel.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'Run-Query',
  'Get-Query-Schema',
  'Get-Report',
  'Display-Query',
  'Get-User-Replays-Data',
  'List-Dashboards',
  'Get-Dashboard',
  'Get-Projects',
  'List-Organizations',
  'Get-Business-Context',
  'Search-Entities',
  'Get-Audit-Log',
  'Get-Events',
  'List-Properties',
  'Get-Property-Values',
  'Get-Issues',
  'Get-Lexicon-URL',
  'Find-Duplicate-Groups',
  'Get-Custom-Property',
  'Get-Lookup-Table',
  'List-Cohorts',
  'Get-Cohort',
  'Describe-Cohort-Schema',
  'List-Metrics',
  'Get-Metric',
  'List-Experiments',
  'Get-Experiment',
  'Search-Prior-Experiments',
  'Get-Experiment-Setup-Guidance',
  'Get-Experiment-Results-Interpretation-Guidance',
  'Explain-Experiment-Health-Check',
  'Run-Experiment-Pre-Launch-Checks',
  'List-Feature-Flags',
  'Get-Feature-Flag',
  'Get-Feature-Flag-Setup-Guidance',
  'Get-Feature-Flag-Lifecycle-Guidance',
];

const WRITE_TOOLS = [
  'Create-Dashboard',
  'Update-Dashboard',
  'Duplicate-Dashboard',
  'Delete-Dashboard',
  'Edit-Event',
  'Edit-Property',
  'Bulk-Edit-Events',
  'Bulk-Edit-Properties',
  'Fill-Event-Metadata',
  'Create-Tag',
  'Rename-Tag',
  'Delete-Tag',
  'Dismiss-Issues',
  'Dismiss-Duplicate-Group',
  'Merge-Group',
  'Update-Business-Context',
  'Create-Custom-Property',
  'Update-Custom-Property',
  'Create-Lookup-Table',
  'Update-Lookup-Table',
  'Create-Cohort',
  'Update-Cohort',
  'Delete-Cohort',
  'Create-Metric',
  'Update-Metric',
  'Create-Experiment',
  'Update-Experiment',
  'Create-Feature-Flag',
  'Update-Feature-Flag',
];

const FINE_GRAINED: Record<string, { yes: string[]; no: string[] }> = {
  'mixpanel-mcp-run-queries': {
    yes: ['Run-Query', 'Display-Query'],
    no: ['Get-User-Replays-Data'],
  },
  'mixpanel-mcp-read-session-replays': { yes: ['Get-User-Replays-Data'], no: ['Run-Query'] },
  'mixpanel-mcp-read-dashboards': { yes: ['List-Dashboards'], no: ['Update-Dashboard'] },
  'mixpanel-mcp-write-dashboards': { yes: ['Create-Dashboard'], no: ['Delete-Dashboard'] },
  'mixpanel-mcp-delete-dashboards': { yes: ['Delete-Dashboard'], no: ['Update-Dashboard'] },
  'mixpanel-mcp-read-projects': { yes: ['Get-Projects', 'Get-Audit-Log'], no: ['Get-Events'] },
  'mixpanel-mcp-read-lexicon': { yes: ['Get-Events', 'Get-Lookup-Table'], no: ['Edit-Event'] },
  'mixpanel-mcp-write-lexicon': { yes: ['Edit-Event', 'Merge-Group'], no: ['Get-Events'] },
  'mixpanel-mcp-read-cohorts': { yes: ['List-Cohorts'], no: ['Create-Cohort'] },
  'mixpanel-mcp-write-cohorts': { yes: ['Update-Cohort'], no: ['Delete-Cohort'] },
  'mixpanel-mcp-delete-cohorts': { yes: ['Delete-Cohort'], no: ['Update-Cohort'] },
  'mixpanel-mcp-read-metrics': { yes: ['Get-Metric'], no: ['Update-Metric'] },
  'mixpanel-mcp-write-metrics': { yes: ['Create-Metric'], no: ['List-Metrics'] },
  'mixpanel-mcp-read-experiments': {
    yes: ['Get-Experiment', 'Run-Experiment-Pre-Launch-Checks'],
    no: ['Update-Experiment'],
  },
  'mixpanel-mcp-write-experiments': { yes: ['Update-Experiment'], no: ['List-Experiments'] },
  'mixpanel-mcp-read-feature-flags': { yes: ['Get-Feature-Flag'], no: ['Create-Feature-Flag'] },
  'mixpanel-mcp-write-feature-flags': { yes: ['Create-Feature-Flag'], no: ['Get-Feature-Flag'] },
};

describe('builtin schemas: mixpanel-mcp', () => {
  it('scope matches the US, EU and India MCP hosts only', () => {
    for (const domain of ['mcp.mixpanel.com', 'mcp-eu.mixpanel.com', 'mcp-in.mixpanel.com']) {
      expect(matches('mixpanel-mcp-api', makeRequest({ domain })), domain).toBe(true);
    }
    expect(matches('mixpanel-mcp-api', makeRequest({ domain: 'mixpanel.com' }))).toBe(false);
    expect(matches('mixpanel-mcp-api', makeRequest({ domain: 'api.mixpanel.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('mixpanel-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('mixpanel-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('mixpanel-mcp-session', rpcRequest('tools/call'))).toBe(false);
    expect(matches('mixpanel-mcp-session', toolRequest('Get-Projects'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('mixpanel-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('mixpanel-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('mixpanel-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('mixpanel-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('mixpanel-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('mixpanel-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('mixpanel-mcp-read-all', toolRequest('run_jql'))).toBe(false);
    expect(matches('mixpanel-mcp-write-all', toolRequest('run_jql'))).toBe(false);
  });

  it('every tool is covered by at least one fine-grained schema', () => {
    for (const tool of [...READ_TOOLS, ...WRITE_TOOLS]) {
      const covered = Object.keys(FINE_GRAINED).some((schema) =>
        matches(schema, toolRequest(tool))
      );
      expect(covered, tool).toBe(true);
    }
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    for (const [schema, { yes, no }] of Object.entries(FINE_GRAINED)) {
      for (const tool of yes) {
        expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(true);
        expect(
          matches(schema, mcpRequest(DOMAIN, '/v1/other', mcpToolCall(tool))),
          `${schema} ${tool} wrong path`
        ).toBe(false);
      }
      for (const tool of no) {
        expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(false);
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
    }
  });

  it('schemas reject requests without a parsed JSON body', () => {
    const noBody = makeRequest({ domain: DOMAIN, method: 'POST', path: PATH });
    expect(matches('mixpanel-mcp-read-all', noBody)).toBe(false);
    expect(matches('mixpanel-mcp-write-all', noBody)).toBe(false);
    expect(matches('mixpanel-mcp-run-queries', noBody)).toBe(false);
  });
});
