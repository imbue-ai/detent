import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.wix.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const DOCS_TOOLS = [
  'WixREADME',
  'SearchWixRESTDocumentation',
  'SearchWixSDKDocumentation',
  'SearchBuildAppsDocumentation',
  'SearchWixHeadlessDocumentation',
  'SearchWixWDSDocumentation',
  'SearchWixCLIDocumentation',
  'SearchDevelopmentDocumentation',
  'SearchWixHelpCenter',
  'WixBusinessFlowsDocumentation',
  'BrowseWixRESTDocsMenu',
  'ReadFullDocsArticle',
  'ReadFullDocsMethodSchema',
  'SearchWixAPISpec',
  'CreateWixBusinessGuide',
];
const SITES_READ_TOOLS = [
  'ListWixSites',
  'GetSiteContext',
  'PullSiteCreationJob',
  'pullSiteCreationJob',
  'GetSuggestedDomains',
  'SearchSiteTemplates',
];
const SITE_API_TOOLS = ['CallWixSiteAPI', 'ExecuteWixAPI'];
const SITES_WRITE_TOOLS = [
  'ManageWixSite',
  'WixSiteBuilder',
  'CreateSiteFromTemplate',
  'ClaimAnonymousSite',
  'import-claude-design-from-url',
  'StartDeployWebsite',
  'StartHeadlessBuild',
  'UploadHeadlessWebsiteFiles',
];
const MEDIA_TOOLS = ['UploadImageToWixSite'];
const FEEDBACK_TOOLS = ['SupportAndFeedback', 'ReportIssueToWix'];

const READ_TOOLS = [...DOCS_TOOLS, ...SITES_READ_TOOLS];
const WRITE_TOOLS = [...SITE_API_TOOLS, ...SITES_WRITE_TOOLS, ...MEDIA_TOOLS, ...FEEDBACK_TOOLS];

const FINE_GRAINED: Record<string, string[]> = {
  'wix-mcp-read-docs': DOCS_TOOLS,
  'wix-mcp-read-sites': SITES_READ_TOOLS,
  'wix-mcp-call-site-apis': SITE_API_TOOLS,
  'wix-mcp-write-sites': SITES_WRITE_TOOLS,
  'wix-mcp-write-media': MEDIA_TOOLS,
  'wix-mcp-send-feedback': FEEDBACK_TOOLS,
};

describe('builtin schemas: wix-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('wix-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('wix-mcp-api', makeRequest({ domain: 'www.wixapis.com' }))).toBe(false);
    expect(matches('wix-mcp-api', makeRequest({ domain: 'dev.wix.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('wix-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('wix-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('wix-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('wix-mcp-session', toolRequest('ListWixSites'))).toBe(false);
    expect(matches('wix-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('wix-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('wix-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('wix-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('wix-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('wix-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('wix-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('wix-mcp-read-all', toolRequest('UnknownTool'))).toBe(false);
    expect(matches('wix-mcp-write-all', toolRequest('UnknownTool'))).toBe(false);
  });

  it('every tool is covered by exactly one fine-grained schema', () => {
    const allTools = [...READ_TOOLS, ...WRITE_TOOLS];
    for (const tool of allTools) {
      const matching = Object.keys(FINE_GRAINED).filter((schema) =>
        matches(schema, toolRequest(tool))
      );
      expect(matching, tool).toHaveLength(1);
    }
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    for (const [schema, tools] of Object.entries(FINE_GRAINED)) {
      for (const tool of tools) {
        expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(true);
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
      expect(matches(schema, toolRequest('UnknownTool')), schema).toBe(false);
    }
    expect(matches('wix-mcp-read-docs', toolRequest('CallWixSiteAPI'))).toBe(false);
    expect(matches('wix-mcp-read-sites', toolRequest('ManageWixSite'))).toBe(false);
    expect(matches('wix-mcp-call-site-apis', toolRequest('ManageWixSite'))).toBe(false);
    expect(matches('wix-mcp-write-sites', toolRequest('UploadImageToWixSite'))).toBe(false);
    expect(matches('wix-mcp-write-media', toolRequest('UploadHeadlessWebsiteFiles'))).toBe(false);
    expect(matches('wix-mcp-send-feedback', toolRequest('WixREADME'))).toBe(false);
  });

  it('tool names are case-sensitive', () => {
    expect(matches('wix-mcp-read-docs', toolRequest('wixreadme'))).toBe(false);
    expect(matches('wix-mcp-call-site-apis', toolRequest('callwixsiteapi'))).toBe(false);
  });

  it('schemas require the MCP endpoint path', () => {
    const wrongPath = mcpRequest(DOMAIN, '/v1/other', mcpToolCall('ListWixSites'));
    expect(matches('wix-mcp-read-sites', wrongPath)).toBe(false);
    expect(matches('wix-mcp-read-all', wrongPath)).toBe(false);
    expect(matches('wix-mcp-session', mcpRequest(DOMAIN, '/sse', mcpRpc('initialize')))).toBe(
      false
    );
    expect(
      matches('wix-mcp-read-sites', mcpRequest(DOMAIN, '/mcp/', mcpToolCall('ListWixSites')))
    ).toBe(true);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('wix-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches('wix-mcp-session', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
