import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'public-api.wordpress.com';
const PATH = '/wpcom/v2/mcp/v1';
const toolRequest = (name: string, toolArguments: Record<string, unknown> = {}) =>
  mcpRequest(DOMAIN, PATH, mcpToolCall(name, toolArguments));
const executeRequest = (name: string, operation: string) =>
  toolRequest(name, { action: 'execute', operation, params: {} });
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const readTools = [
  'wpcom-mcp-site-editor-context',
  'wpcom-user-sites',
  'wpcom-plans-list',
  'wpcom-checkout-url',
  'wpcom-domain-purchase',
  'wpcom-ai-agent-sites-list',
  'wpcom-mcp-jetpack-search-voice',
  'wpcom-mcp-posts-search',
  'wpcom-mcp-site-statistics',
  'wpcom-mcp-user-profile',
];
const writeTools = [
  'wpcom-domain-update-dns-records',
  'wpcom-domain-restore-default-dns-records',
  'wpcom-domain-update-nameservers',
  'wpcom-domain-set-mail-service',
  'wpcom-mcp-send-feedback',
];
const readOperations: [string, string][] = [
  ['wpcom-mcp-content-authoring', 'posts.list'],
  ['wpcom-mcp-content-authoring', 'content.search'],
  ['wpcom-mcp-account', 'profile.get'],
  ['wpcom-mcp-account', 'domains.dns_records'],
  ['wpcom-mcp-site', 'statistics.get'],
  ['wpcom-mcp-site', 'backup.rewind_status'],
  ['wpcom-mcp-user-management', 'user.pending-invites'],
  ['wpcom-mcp-plugin-management', 'plugin.search'],
  ['wpcom-mcp-site-editing', 'templates.lookup'],
  ['wpcom-mcp-create-site', 'subdomain.check'],
];
const writeOperations: [string, string][] = [
  ['wpcom-mcp-content-authoring', 'posts.create'],
  ['wpcom-mcp-content-authoring', 'media.upload'],
  ['wpcom-mcp-content-authoring', 'comments.delete'],
  ['wpcom-mcp-account', 'subscriptions.stop_renewal'],
  ['wpcom-mcp-account', 'domains.set_primary'],
  ['wpcom-mcp-site', 'manage-site.launch'],
  ['wpcom-mcp-user-management', 'user.remove-access'],
  ['wpcom-mcp-plugin-management', 'plugin.install'],
  ['wpcom-mcp-site-editing', 'global-styles.update'],
  ['wpcom-mcp-create-site', 'site.provision'],
];

describe('builtin schemas: wordpress-com-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('wordpress-com-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('wordpress-com-mcp-api', makeRequest({ domain: 'wordpress.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('wordpress-com-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('wordpress-com-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('wordpress-com-mcp-session', toolRequest('wpcom-user-sites'))).toBe(false);
  });

  it('read-all and write-all partition the tools and facade operations', () => {
    for (const tool of readTools) {
      expect(matches('wordpress-com-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('wordpress-com-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of writeTools) {
      expect(matches('wordpress-com-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('wordpress-com-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const [tool, operation] of readOperations) {
      const request = executeRequest(tool, operation);
      expect(matches('wordpress-com-mcp-read-all', request), operation).toBe(true);
      expect(matches('wordpress-com-mcp-write-all', request), operation).toBe(false);
    }
    for (const [tool, operation] of writeOperations) {
      const request = executeRequest(tool, operation);
      expect(matches('wordpress-com-mcp-write-all', request), operation).toBe(true);
      expect(matches('wordpress-com-mcp-read-all', request), operation).toBe(false);
    }
    expect(matches('wordpress-com-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('wordpress-com-mcp-write-all', rpcRequest('initialize'))).toBe(true);
  });

  it('listing and describing facade operations is read-only; bare facade calls match nothing', () => {
    const describeRequest = toolRequest('wpcom-mcp-content-authoring', {
      action: 'describe',
      operation: 'posts.delete',
    });
    expect(matches('wordpress-com-mcp-read-all', describeRequest)).toBe(true);
    expect(matches('wordpress-com-mcp-write-all', describeRequest)).toBe(false);
    expect(matches('wordpress-com-mcp-write-content', describeRequest)).toBe(true);
    expect(matches('wordpress-com-mcp-delete-content', describeRequest)).toBe(false);
    const bareRequest = toolRequest('wpcom-mcp-content-authoring');
    expect(matches('wordpress-com-mcp-read-all', bareRequest)).toBe(false);
    expect(matches('wordpress-com-mcp-write-all', bareRequest)).toBe(false);
    const unknownOperation = executeRequest('wpcom-mcp-site', 'settings.reset');
    expect(matches('wordpress-com-mcp-read-all', unknownOperation)).toBe(false);
    expect(matches('wordpress-com-mcp-write-all', unknownOperation)).toBe(false);
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    type ToolCase = [string, string];
    const cases: [string, [ToolCase, ...ToolCase[]], ToolCase[]][] = [
      [
        'read-content',
        [
          ['wpcom-mcp-content-authoring', 'pages.get'],
          ['wpcom-mcp-posts-search', ''],
        ],
        [
          ['wpcom-mcp-content-authoring', 'pages.update'],
          ['wpcom-mcp-site', 'settings.get'],
        ],
      ],
      [
        'write-content',
        [
          ['wpcom-mcp-content-authoring', 'pages.update'],
          ['wpcom-mcp-content-authoring', 'post-sections.remove'],
        ],
        [
          ['wpcom-mcp-content-authoring', 'pages.delete'],
          ['wpcom-mcp-content-authoring', 'pages.get'],
        ],
      ],
      [
        'delete-content',
        [['wpcom-mcp-content-authoring', 'pages.delete']],
        [['wpcom-mcp-content-authoring', 'pages.update']],
      ],
      [
        'read-design',
        [
          ['wpcom-mcp-site-editing', 'menus.list'],
          ['wpcom-mcp-site-editor-context', ''],
        ],
        [['wpcom-mcp-site-editing', 'menus.delete']],
      ],
      [
        'write-design',
        [['wpcom-mcp-site-editing', 'menus.delete']],
        [['wpcom-mcp-site-editing', 'menus.list']],
      ],
      [
        'read-sites',
        [
          ['wpcom-mcp-site', 'scan.status'],
          ['wpcom-mcp-create-site', 'subdomain.check'],
          ['wpcom-user-sites', ''],
        ],
        [
          ['wpcom-mcp-site', 'scan.run'],
          ['wpcom-plans-list', ''],
        ],
      ],
      [
        'write-sites',
        [
          ['wpcom-mcp-site', 'theme.set'],
          ['wpcom-mcp-create-site', 'site.provision'],
        ],
        [['wpcom-mcp-site', 'theme.list']],
      ],
      [
        'read-plugins',
        [['wpcom-mcp-plugin-management', 'plugin.list']],
        [['wpcom-mcp-plugin-management', 'plugin.activate']],
      ],
      [
        'write-plugins',
        [['wpcom-mcp-plugin-management', 'plugin.uninstall']],
        [['wpcom-mcp-plugin-management', 'plugin.list']],
      ],
      [
        'read-users',
        [['wpcom-mcp-user-management', 'user.list']],
        [['wpcom-mcp-user-management', 'user.invite']],
      ],
      [
        'write-users',
        [['wpcom-mcp-user-management', 'user.change-role']],
        [['wpcom-mcp-user-management', 'user.list']],
      ],
      [
        'read-account',
        [
          ['wpcom-mcp-account', 'subscriptions.invoice.get'],
          ['wpcom-checkout-url', ''],
        ],
        [
          ['wpcom-mcp-account', 'domains.list'],
          ['wpcom-mcp-account', 'currency.change'],
        ],
      ],
      [
        'write-account',
        [['wpcom-mcp-account', 'currency.change']],
        [
          ['wpcom-mcp-account', 'domains.attach'],
          ['wpcom-mcp-account', 'profile.get'],
        ],
      ],
      [
        'read-domains',
        [
          ['wpcom-mcp-account', 'domains.list'],
          ['wpcom-domain-purchase', ''],
        ],
        [
          ['wpcom-mcp-account', 'domains.attach'],
          ['wpcom-domain-update-nameservers', ''],
        ],
      ],
      [
        'write-domains',
        [
          ['wpcom-mcp-account', 'domains.attach'],
          ['wpcom-domain-update-nameservers', ''],
        ],
        [
          ['wpcom-mcp-account', 'domains.list'],
          ['wpcom-domain-purchase', ''],
        ],
      ],
      ['send-feedback', [['wpcom-mcp-send-feedback', '']], [['wpcom-user-sites', '']]],
    ];
    const requestFor = ([tool, operation]: ToolCase) =>
      operation === '' ? toolRequest(tool) : executeRequest(tool, operation);
    for (const [suffix, positives, negatives] of cases) {
      const schema = `wordpress-com-mcp-${suffix}`;
      for (const positive of positives) {
        expect(matches(schema, requestFor(positive)), `${schema} ${positive.join(' ')}`).toBe(true);
      }
      for (const negative of negatives) {
        expect(matches(schema, requestFor(negative)), `${schema} ${negative.join(' ')}`).toBe(
          false
        );
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      const wrongPath = { ...requestFor(positives[0]), path: '/rest/v1.1/me' };
      expect(matches(schema, wrongPath), schema).toBe(false);
    }
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches(
        'wordpress-com-mcp-read-all',
        makeRequest({ domain: DOMAIN, method: 'POST', path: PATH })
      )
    ).toBe(false);
  });
});
