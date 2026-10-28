import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.miro.com';
const PATH = '/';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'canvas_read_as_svg',
  'canvas_search',
  'canvas_get_canvas_composer_skill',
  'canvas_load_format_skill',
  'board_search_boards',
  'board_show',
  'board_get_space',
  'content_item_list_roles',
  'space_list',
  'space_list_boards',
  'space_list_children',
  'blog_post_list',
  'table_list_rows',
  'table_get_latest_update_history',
  'comment_list_comments',
  'image_get_data',
  'image_get_url',
  'prototype_read',
  'user_who_am_i',
  'user_search_organization_users',
  'get_brand_context',
];

const WRITE_TOOLS = [
  'canvas_create_from_svg',
  'canvas_update_from_svg',
  'canvas_get_html_upload_url',
  'board_create',
  'board_create_format',
  'board_move',
  'board_move_to_team',
  'board_restore',
  'board_update_metadata',
  'board_share',
  'board_role_update',
  'space_share',
  'space_role_update',
  'space_create',
  'space_update_metadata',
  'section_create',
  'section_update_metadata',
  'section_delete',
  'blog_post_create',
  'blog_post_update',
  'table_create',
  'table_sync_rows',
  'table_update_view',
  'comment_create',
  'comment_reply',
  'comment_resolve',
  'image_get_upload_url',
  'image_create',
  'prototype_create',
  'prototype_get_upload_url',
  'import-claude-design-from-url',
];

const FINE_GRAINED: Record<string, { yes: string[]; no: string[] }> = {
  'miro-mcp-read-canvas': {
    yes: ['canvas_search', 'canvas_read_as_svg'],
    no: ['canvas_create_from_svg'],
  },
  'miro-mcp-write-canvas': {
    yes: ['canvas_create_from_svg', 'canvas_update_from_svg'],
    no: ['canvas_search'],
  },
  'miro-mcp-read-boards': { yes: ['board_search_boards', 'board_show'], no: ['board_create'] },
  'miro-mcp-write-boards': { yes: ['board_create', 'board_restore'], no: ['board_share'] },
  'miro-mcp-read-sharing': { yes: ['content_item_list_roles'], no: ['board_share'] },
  'miro-mcp-write-sharing': {
    yes: ['board_share', 'space_role_update'],
    no: ['content_item_list_roles'],
  },
  'miro-mcp-read-spaces': { yes: ['space_list', 'blog_post_list'], no: ['space_create'] },
  'miro-mcp-write-spaces': { yes: ['space_create', 'section_delete'], no: ['space_list'] },
  'miro-mcp-read-tables': { yes: ['table_list_rows'], no: ['table_sync_rows'] },
  'miro-mcp-write-tables': { yes: ['table_create', 'table_sync_rows'], no: ['table_list_rows'] },
  'miro-mcp-read-comments': { yes: ['comment_list_comments'], no: ['comment_create'] },
  'miro-mcp-write-comments': {
    yes: ['comment_create', 'comment_resolve'],
    no: ['comment_list_comments'],
  },
  'miro-mcp-read-images': { yes: ['image_get_data', 'image_get_url'], no: ['image_create'] },
  'miro-mcp-write-images': { yes: ['image_create', 'image_get_upload_url'], no: ['image_get_url'] },
  'miro-mcp-read-prototypes': { yes: ['prototype_read'], no: ['prototype_create'] },
  'miro-mcp-write-prototypes': {
    yes: ['prototype_create', 'import-claude-design-from-url'],
    no: ['prototype_read'],
  },
  'miro-mcp-read-organization': {
    yes: ['user_who_am_i', 'get_brand_context'],
    no: ['board_share'],
  },
};

describe('builtin schemas: miro-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('miro-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('miro-mcp-api', makeRequest({ domain: 'api.miro.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('miro-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('miro-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('miro-mcp-session', toolRequest('canvas_search'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('miro-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('miro-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('miro-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('miro-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('miro-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('miro-mcp-write-all', rpcRequest('initialize'))).toBe(true);
  });

  it('every tool appears in exactly one fine-grained schema', () => {
    const fineGrainedNames = Object.keys(FINE_GRAINED);
    for (const tool of [...READ_TOOLS, ...WRITE_TOOLS]) {
      const matched = fineGrainedNames.filter((name) => matches(name, toolRequest(tool)));
      expect(matched, tool).toHaveLength(1);
    }
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    for (const [name, checks] of Object.entries(FINE_GRAINED)) {
      for (const tool of checks.yes) {
        expect(matches(name, toolRequest(tool)), `${name} ${tool}`).toBe(true);
      }
      for (const tool of checks.no) {
        expect(matches(name, toolRequest(tool)), `${name} ${tool}`).toBe(false);
      }
      expect(matches(name, rpcRequest('initialize')), name).toBe(false);
      expect(
        matches(name, mcpRequest(DOMAIN, '/v1/other', mcpToolCall(checks.yes[0]!))),
        name
      ).toBe(false);
    }
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('miro-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
