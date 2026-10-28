import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.linktr.ee';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'get_profile_sharing_guidance',
  'list_accessible_profiles',
  'set_active_profile',
  'get_account',
  'get_suggested_bio',
  'get_social_integrations',
  'get_knowledge_base',
  'get_links',
  'get_social_links',
  'get_appearance',
  'get_account_analytics',
  'get_analytics_lifetime_totals',
  'get_top_links',
  'get_profile_views',
  'get_link_analytics',
  'get_workspace_profiles_analytics',
  'pull_recommendations',
  'get_workspaces_for_user',
  'get_workspace',
  'get_workspace_profiles',
  'get_workspace_members',
  'get_conversations',
  'get_messages',
];

const WRITE_TOOLS = [
  'create_profile',
  'update_account_profile',
  'add_link',
  'create_collection',
  'add_links_to_collection',
  'update_link',
  'reorder_link',
  'upsert_social_link',
  'reorder_social_links',
  'delete_link',
  'delete_social_link',
  'update_appearance',
  'submit_recommendation_feedback',
  'send_message',
];

const FINE_GRAINED: Record<string, string[]> = {
  'linktree-mcp-read-profiles': [
    'get_profile_sharing_guidance',
    'list_accessible_profiles',
    'set_active_profile',
    'get_account',
    'get_suggested_bio',
    'get_social_integrations',
    'get_knowledge_base',
  ],
  'linktree-mcp-write-profiles': ['create_profile', 'update_account_profile'],
  'linktree-mcp-read-links': ['get_links', 'get_social_links'],
  'linktree-mcp-write-links': [
    'add_link',
    'create_collection',
    'add_links_to_collection',
    'update_link',
    'reorder_link',
    'upsert_social_link',
    'reorder_social_links',
  ],
  'linktree-mcp-delete-links': ['delete_link', 'delete_social_link'],
  'linktree-mcp-read-appearance': ['get_appearance'],
  'linktree-mcp-write-appearance': ['update_appearance'],
  'linktree-mcp-read-analytics': [
    'get_account_analytics',
    'get_analytics_lifetime_totals',
    'get_top_links',
    'get_profile_views',
    'get_link_analytics',
    'get_workspace_profiles_analytics',
  ],
  'linktree-mcp-read-recommendations': ['pull_recommendations'],
  'linktree-mcp-write-recommendations': ['submit_recommendation_feedback'],
  'linktree-mcp-read-workspaces': [
    'get_workspaces_for_user',
    'get_workspace',
    'get_workspace_profiles',
    'get_workspace_members',
  ],
  'linktree-mcp-read-messages': ['get_conversations', 'get_messages'],
  'linktree-mcp-send-messages': ['send_message'],
};

describe('builtin schemas: linktree-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('linktree-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('linktree-mcp-api', makeRequest({ domain: 'linktr.ee' }))).toBe(false);
    expect(matches('linktree-mcp-api', makeRequest({ domain: 'ciam.linktr.ee' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('linktree-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('linktree-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('linktree-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('linktree-mcp-session', toolRequest('get_links'))).toBe(false);
    expect(matches('linktree-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('linktree-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('linktree-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('linktree-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('linktree-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('linktree-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('linktree-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('linktree-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('linktree-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
  });

  it('fine-grained schemas match exactly their tools and cover every tool', () => {
    const allTools = [...READ_TOOLS, ...WRITE_TOOLS];
    const covered = new Set(Object.values(FINE_GRAINED).flat());
    expect([...covered].sort()).toEqual([...allTools].sort());
    for (const [schema, tools] of Object.entries(FINE_GRAINED)) {
      for (const tool of allTools) {
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
      matches('linktree-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches(
        'linktree-mcp-send-messages',
        makeRequest({ domain: DOMAIN, method: 'POST', path: PATH })
      )
    ).toBe(false);
  });
});
