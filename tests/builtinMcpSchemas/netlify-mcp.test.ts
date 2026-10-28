import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'netlify-mcp.netlify.app';
const PATH = '/mcp';
const toolRequest = (name: string, path = PATH) => mcpRequest(DOMAIN, path, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_GROUPS: Record<string, string[]> = {
  'netlify-mcp-read-coding-guidance': ['get-netlify-coding-context', 'netlify-coding-rules'],
  'netlify-mcp-read-account': [
    'netlify-user-services-reader',
    'netlify-team-services-reader',
    'netlify-user-get-user',
    'netlify-team-get-teams',
    'netlify-team-get-team',
    'netlify-team-get-team-env-vars',
  ],
  'netlify-mcp-read-projects': [
    'netlify-project-services-reader',
    'netlify-project-get-project',
    'netlify-project-get-projects',
    'netlify-project-get-forms-for-project',
  ],
  'netlify-mcp-read-deploys': [
    'netlify-deploy-services-reader',
    'netlify-deploy-get-deploy',
    'netlify-deploy-get-deploy-for-site',
  ],
  'netlify-mcp-read-extensions': [
    'netlify-extension-services-reader',
    'netlify-extension-get-extensions',
    'netlify-extension-get-full-extension-details',
    'netlify-get-database-setup-steps',
  ],
  'netlify-mcp-read-observability': [
    'netlify-observability-services-reader',
    'netlify-observability-get-counts',
    'netlify-observability-get-topk',
    'netlify-observability-get-timeseries',
    'netlify-observability-get-request-logs',
    'netlify-observability-get-request-detail',
  ],
};

const WRITE_GROUPS: Record<string, string[]> = {
  'netlify-mcp-write-projects': [
    'netlify-project-services-updater',
    'netlify-project-create-new-project',
    'netlify-project-update-project-name',
    'netlify-project-update-visitor-access-controls',
    'netlify-project-update-forms',
    'netlify-project-manage-form-submissions',
    'netlify-project-manage-env-vars',
  ],
  'netlify-mcp-write-env-vars': ['netlify-project-manage-env-vars'],
  'netlify-mcp-write-forms': [
    'netlify-project-update-forms',
    'netlify-project-manage-form-submissions',
  ],
  'netlify-mcp-deploy-sites': ['netlify-deploy-services-updater', 'netlify-deploy-site'],
  'netlify-mcp-write-extensions': [
    'netlify-extension-services-updater',
    'netlify-extension-change-extension-installation',
  ],
};

const DESIGN_IMPORT_READ_TOOLS = ['get-design-import-job-status'];
const DESIGN_IMPORT_WRITE_TOOLS = ['import-claude-design-from-url'];

const READ_TOOLS = [
  ...new Set([...Object.values(READ_GROUPS).flat(), ...DESIGN_IMPORT_READ_TOOLS]),
];
const WRITE_TOOLS = [
  ...new Set([...Object.values(WRITE_GROUPS).flat(), ...DESIGN_IMPORT_WRITE_TOOLS]),
];
const FINE_GRAINED_SCHEMAS = [
  ...Object.keys(READ_GROUPS),
  ...Object.keys(WRITE_GROUPS),
  'netlify-mcp-import-designs',
];

describe('builtin schemas: netlify-mcp', () => {
  it('scope matches both MCP hosts only', () => {
    expect(matches('netlify-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('netlify-mcp-api', makeRequest({ domain: 'mcp.netlify.com' }))).toBe(true);
    expect(matches('netlify-mcp-api', makeRequest({ domain: 'api.netlify.com' }))).toBe(false);
    expect(matches('netlify-mcp-api', makeRequest({ domain: 'netlify.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('netlify-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('netlify-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('netlify-mcp-session', rpcRequest('tools/call'))).toBe(false);
    expect(matches('netlify-mcp-session', toolRequest('netlify-user-get-user'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('netlify-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('netlify-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('netlify-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('netlify-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('netlify-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('netlify-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('netlify-mcp-read-all', toolRequest('netlify-project-services'))).toBe(false);
    expect(matches('netlify-mcp-write-all', toolRequest('netlify-project-services'))).toBe(false);
  });

  it('fine-grained read and write groups match exactly their tools', () => {
    const allTools = [...READ_TOOLS, ...WRITE_TOOLS];
    for (const [schema, tools] of Object.entries({ ...READ_GROUPS, ...WRITE_GROUPS })) {
      for (const tool of allTools) {
        expect(matches(schema, toolRequest(tool)), `${schema} / ${tool}`).toBe(
          tools.includes(tool)
        );
      }
    }
  });

  it('design imports are grouped together and only there', () => {
    for (const tool of [...DESIGN_IMPORT_WRITE_TOOLS, ...DESIGN_IMPORT_READ_TOOLS]) {
      expect(matches('netlify-mcp-import-designs', toolRequest(tool)), tool).toBe(true);
    }
    expect(matches('netlify-mcp-import-designs', toolRequest('netlify-deploy-site'))).toBe(false);
    expect(
      matches('netlify-mcp-write-projects', toolRequest('import-claude-design-from-url'))
    ).toBe(false);
  });

  it('fine-grained schemas ignore the handshake and other paths', () => {
    for (const schema of FINE_GRAINED_SCHEMAS) {
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
    }
    expect(
      matches('netlify-mcp-read-account', toolRequest('netlify-user-get-user', '/api/v1/user'))
    ).toBe(false);
    expect(
      matches('netlify-mcp-read-all', toolRequest('netlify-user-get-user', '/oauth-server/token'))
    ).toBe(false);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    const noBody = makeRequest({ domain: DOMAIN, method: 'POST', path: PATH });
    expect(matches('netlify-mcp-read-all', noBody)).toBe(false);
    expect(matches('netlify-mcp-write-all', noBody)).toBe(false);
    expect(matches('netlify-mcp-session', noBody)).toBe(false);
  });
});
