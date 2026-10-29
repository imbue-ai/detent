import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.canva.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'search-designs',
  'get-design',
  'get-design-pages',
  'get-design-content',
  'get-presenter-notes',
  'get-design-thumbnail',
  'get-create-design-async-job',
  'resolve-shortlink',
  'get-export-formats',
  'export-design',
  'get-assets',
  'get-generate-image-job',
  'get-separate-image-layers-job',
  'list-folder-items',
  'search-folders',
  'list-comments',
  'list-replies',
  'search-brand-templates',
  'list-brand-kits',
  'get-brand-template-dataset',
  'get-design-dataset',
  'help',
];

const WRITE_TOOLS = [
  'generate-design',
  'create-design-from-candidate',
  'create-design',
  'copy-design',
  'merge-designs',
  'import-design-from-url',
  'resize-design',
  'start-editing-transaction',
  'perform-editing-operations',
  'commit-editing-transaction',
  'cancel-editing-transaction',
  'upload-asset-from-url',
  'create-upload-url',
  'generate-image',
  'remove-background',
  'separate-image-layers',
  'create-folder',
  'move-item-to-folder',
  'comment-on-design',
  'reply-to-comment',
  'create-design-from-brand-template',
  'autofill-design',
  'create-brand-template-draft',
  'publish-brand-template',
];

const FINE_GRAINED: Record<string, { allowed: string[]; denied: string[] }> = {
  'canva-mcp-read-designs': {
    allowed: ['search-designs', 'get-design-content', 'resolve-shortlink'],
    denied: ['export-design', 'create-design'],
  },
  'canva-mcp-export-designs': {
    allowed: ['get-export-formats', 'export-design'],
    denied: ['get-design', 'import-design-from-url'],
  },
  'canva-mcp-create-designs': {
    allowed: ['generate-design', 'resize-design', 'import-design-from-url'],
    denied: ['get-design', 'perform-editing-operations'],
  },
  'canva-mcp-edit-designs': {
    allowed: ['start-editing-transaction', 'commit-editing-transaction'],
    denied: ['create-design', 'get-design-content'],
  },
  'canva-mcp-read-assets': { allowed: ['get-assets'], denied: ['upload-asset-from-url'] },
  'canva-mcp-write-assets': {
    allowed: ['upload-asset-from-url', 'create-upload-url'],
    denied: ['get-assets'],
  },
  'canva-mcp-read-images': {
    allowed: ['get-generate-image-job', 'get-separate-image-layers-job'],
    denied: ['generate-image'],
  },
  'canva-mcp-write-images': {
    allowed: ['generate-image', 'remove-background', 'separate-image-layers'],
    denied: ['get-generate-image-job'],
  },
  'canva-mcp-read-folders': {
    allowed: ['list-folder-items', 'search-folders'],
    denied: ['create-folder'],
  },
  'canva-mcp-write-folders': {
    allowed: ['create-folder', 'move-item-to-folder'],
    denied: ['list-folder-items'],
  },
  'canva-mcp-read-comments': {
    allowed: ['list-comments', 'list-replies'],
    denied: ['comment-on-design'],
  },
  'canva-mcp-write-comments': {
    allowed: ['comment-on-design', 'reply-to-comment'],
    denied: ['list-comments'],
  },
  'canva-mcp-read-brand-templates': {
    allowed: ['search-brand-templates', 'list-brand-kits', 'get-design-dataset'],
    denied: ['autofill-design'],
  },
  'canva-mcp-write-brand-templates': {
    allowed: ['autofill-design', 'publish-brand-template'],
    denied: ['search-brand-templates'],
  },
  'canva-mcp-help': { allowed: ['help'], denied: ['get-design'] },
};

describe('builtin schemas: canva-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('canva-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('canva-mcp-api', makeRequest({ domain: 'api.canva.com' }))).toBe(false);
    expect(matches('canva-mcp-api', makeRequest({ domain: 'www.canva.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('canva-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('canva-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('canva-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('canva-mcp-session', toolRequest('search-designs'))).toBe(false);
    expect(matches('canva-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('canva-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('canva-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('canva-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('canva-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('canva-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('canva-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('canva-mcp-read-all', toolRequest('unknown-tool'))).toBe(false);
    expect(matches('canva-mcp-write-all', toolRequest('unknown-tool'))).toBe(false);
  });

  it('every tool is covered by at least one fine-grained schema', () => {
    const schemaNames = Object.keys(FINE_GRAINED);
    for (const tool of [...READ_TOOLS, ...WRITE_TOOLS]) {
      expect(
        schemaNames.some((schemaName) => matches(schemaName, toolRequest(tool))),
        tool
      ).toBe(true);
    }
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    for (const [schemaName, { allowed, denied }] of Object.entries(FINE_GRAINED)) {
      for (const tool of allowed) {
        expect(matches(schemaName, toolRequest(tool)), `${schemaName} ${tool}`).toBe(true);
        expect(
          matches(schemaName, mcpRequest(DOMAIN, '/v1/other', mcpToolCall(tool))),
          `${schemaName} ${tool} wrong path`
        ).toBe(false);
      }
      for (const tool of denied) {
        expect(matches(schemaName, toolRequest(tool)), `${schemaName} ${tool}`).toBe(false);
      }
      expect(matches(schemaName, rpcRequest('initialize')), schemaName).toBe(false);
      expect(matches(schemaName, rpcRequest('tools/list')), schemaName).toBe(false);
    }
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('canva-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches('canva-mcp-session', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches('canva-mcp-read-designs', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
