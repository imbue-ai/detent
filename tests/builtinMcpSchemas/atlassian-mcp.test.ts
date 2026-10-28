import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.atlassian.com';
const PATH = '/v2/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

// Representative tools for every fine-grained schema, keyed by schema name.
const READ_GROUPS: Record<string, string[]> = {
  'atlassian-mcp-read-account-and-tool-catalog': [
    'atlassianUserInfo',
    'getAccessibleAtlassianResources',
    'discover',
    'executeRead',
  ],
  'atlassian-mcp-read-jira': ['getJiraIssue', 'searchJiraIssuesUsingJql', 'getJiraWorkflows'],
  'atlassian-mcp-read-confluence-and-loom': [
    'getConfluenceContent',
    'searchConfluence',
    'getLoomObjectsContent',
    'getLoomVideoDownloadUrl',
  ],
  'atlassian-mcp-read-jsm': ['searchJsmRequests', 'getJsmOpsAlerts', 'queryAssetsObjectsUsingAql'],
  'atlassian-mcp-read-bitbucket-and-code': [
    'getBitbucketRepoPullRequestDiff',
    'listBitbucketRepositories',
    'searchCode',
    'getCodeFile',
  ],
  'atlassian-mcp-read-teamwork': [
    'search',
    'getTeamworkGraphContext',
    'getCollaborators',
    'searchGoals',
    'getProjectUpdate',
    'getTeam',
    'getFocusAreaTypes',
  ],
  'atlassian-mcp-read-workforce-planning': [
    'searchTalentPositions',
    'getTalentGroupMetrics',
    'getCapacityPlanAllocations',
  ],
};

const WRITE_GROUPS: Record<string, string[]> = {
  'atlassian-mcp-write-tool-catalog': ['executeWrite', 'executeDestructive'],
  'atlassian-mcp-write-jira': [
    'createJiraIssue',
    'transitionJiraIssue',
    'manageJiraSprint',
    'createJiraProject',
    'updateJiraScreen',
  ],
  'atlassian-mcp-delete-jira': ['deleteJiraIssue', 'deleteJiraComment'],
  'atlassian-mcp-write-confluence-and-loom': [
    'createConfluenceContent',
    'enableConfluencePublicLink',
    'publishLoomObject',
    'shareLoomObject',
  ],
  'atlassian-mcp-write-jsm': ['createJsmRequest', 'updateJsmOpsAlert'],
  'atlassian-mcp-write-bitbucket': ['mergeBitbucketRepoPullRequest', 'runBitbucketRepoPipeline'],
  'atlassian-mcp-write-teamwork': [
    'addTeamworkGraphContext',
    'createGoal',
    'addConnectionsToProjects',
    'updateTeam',
    'linkToFocusArea',
  ],
  'atlassian-mcp-write-workforce-planning': [
    'createTalentSkill',
    'updateTalentWorkerSkillMappings',
    'updateCapacityPlanAllocation',
  ],
};

const FINE_GRAINED = { ...READ_GROUPS, ...WRITE_GROUPS };
const SAMPLE_READ_TOOLS = Object.values(READ_GROUPS).flat();
const SAMPLE_WRITE_TOOLS = Object.values(WRITE_GROUPS).flat();

interface ToolNameSchema {
  const?: string;
  enum?: string[];
}
interface ToolCallSchema {
  properties?: { params?: { properties?: { name?: ToolNameSchema } } };
}
interface PermissionSchema {
  properties: { parsedBody: ToolCallSchema & { anyOf?: ToolCallSchema[] } };
}

function toolNamesOf(schema: ToolCallSchema): string[] {
  const name = schema.properties?.params?.properties?.name;
  return name?.enum ?? (name?.const === undefined ? [] : [name.const]);
}

function loadToolPartition(): { readAll: string[]; writeAll: string[]; fineGrained: string[] } {
  const file = new URL('../../src/schemas/builtin/atlassian-mcp.json', import.meta.url);
  const schemas = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, PermissionSchema>;
  const parsedBodyOf = (name: string) => {
    const schema = schemas[name];
    expect(schema, name).toBeDefined();
    return schema!.properties.parsedBody;
  };
  const toolsOfAll = (name: string) => (parsedBodyOf(name).anyOf ?? []).flatMap(toolNamesOf);
  const fineGrained = Object.keys(FINE_GRAINED).flatMap((name) => toolNamesOf(parsedBodyOf(name)));
  return {
    readAll: toolsOfAll('atlassian-mcp-read-all'),
    writeAll: toolsOfAll('atlassian-mcp-write-all'),
    fineGrained,
  };
}

describe('builtin schemas: atlassian-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('atlassian-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('atlassian-mcp-api', makeRequest({ domain: 'api.atlassian.com' }))).toBe(false);
    expect(matches('atlassian-mcp-api', makeRequest({ domain: 'auth.atlassian.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('atlassian-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('atlassian-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('atlassian-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('atlassian-mcp-session', toolRequest('getJiraIssue'))).toBe(false);
    expect(matches('atlassian-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of SAMPLE_READ_TOOLS) {
      expect(matches('atlassian-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('atlassian-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of SAMPLE_WRITE_TOOLS) {
      expect(matches('atlassian-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('atlassian-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('atlassian-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('atlassian-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('atlassian-mcp-read-all', toolRequest('unknownTool'))).toBe(false);
    expect(matches('atlassian-mcp-write-all', toolRequest('unknownTool'))).toBe(false);
  });

  it('every tool is in exactly one of read-all / write-all and in a fine-grained schema', () => {
    const { readAll, writeAll, fineGrained } = loadToolPartition();
    const all = [...readAll, ...writeAll];
    expect(new Set(all).size).toBe(all.length);
    expect(readAll.length).toBe(149);
    expect(writeAll.length).toBe(109);
    expect(new Set(fineGrained).size).toBe(fineGrained.length);
    expect([...fineGrained].sort()).toEqual([...all].sort());
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    for (const [schemaName, tools] of Object.entries(FINE_GRAINED)) {
      for (const tool of tools) {
        expect(matches(schemaName, toolRequest(tool)), `${schemaName} ${tool}`).toBe(true);
        expect(
          matches(schemaName, mcpRequest(DOMAIN, '/v1/mcp', mcpToolCall(tool))),
          `${schemaName} ${tool} on v1 path`
        ).toBe(false);
      }
      expect(matches(schemaName, rpcRequest('initialize')), schemaName).toBe(false);
      expect(matches(schemaName, rpcRequest('tools/list')), schemaName).toBe(false);
    }
    expect(matches('atlassian-mcp-read-jira', toolRequest('createJiraIssue'))).toBe(false);
    expect(matches('atlassian-mcp-write-jira', toolRequest('deleteJiraIssue'))).toBe(false);
    expect(matches('atlassian-mcp-delete-jira', toolRequest('createJiraProject'))).toBe(false);
    expect(matches('atlassian-mcp-read-confluence-and-loom', toolRequest('getJiraIssue'))).toBe(
      false
    );
    expect(
      matches('atlassian-mcp-write-confluence-and-loom', toolRequest('getConfluenceContent'))
    ).toBe(false);
    expect(
      matches('atlassian-mcp-read-account-and-tool-catalog', toolRequest('executeWrite'))
    ).toBe(false);
    expect(matches('atlassian-mcp-read-teamwork', toolRequest('listJiraProjects'))).toBe(false);
    expect(matches('atlassian-mcp-read-teamwork', toolRequest('searchTalentPositions'))).toBe(
      false
    );
  });

  it('schemas reject requests without a parsed JSON body', () => {
    const noBody = makeRequest({ domain: DOMAIN, method: 'POST', path: PATH });
    expect(matches('atlassian-mcp-read-all', noBody)).toBe(false);
    expect(matches('atlassian-mcp-write-all', noBody)).toBe(false);
    expect(matches('atlassian-mcp-session', noBody)).toBe(false);
    expect(matches('atlassian-mcp-read-jira', noBody)).toBe(false);
  });
});
