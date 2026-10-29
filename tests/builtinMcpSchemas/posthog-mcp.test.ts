import { describe, it, expect } from 'vitest';
import { getAllBuiltinSchemas } from '../../src/schemas/requestSchema.js';
import {
  builtinRegistry,
  matches,
  mcpRequest,
  mcpRpc,
  mcpToolCall,
  makeRequest,
} from './helpers.js';

const DOMAIN = 'mcp.posthog.com';
const EU_DOMAIN = 'mcp-eu.posthog.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const execRequest = (command: string) => mcpRequest(DOMAIN, PATH, mcpToolCall('exec', { command }));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

/** Tool names a schema allows in per-tool mode (the `name` enum/const of its `tools/call` branch). */
function toolNamesOf(schemaName: string): string[] {
  const schema = builtinRegistry.get(schemaName)!.schema as {
    properties: { parsedBody: { anyOf: Record<string, unknown>[] } };
  };
  return schema.properties.parsedBody.anyOf.flatMap((branch) => {
    const params = (branch.properties as Record<string, unknown> | undefined)?.params as
      | { properties: { name: { enum?: string[]; const?: string } } }
      | undefined;
    const name = params?.properties.name;
    return name?.enum ?? (name?.const !== undefined && name.const !== 'exec' ? [name.const] : []);
  });
}

const fineGrainedSchemas = Object.keys(getAllBuiltinSchemas()).filter(
  (name) =>
    name.startsWith('posthog-mcp-') &&
    ![
      'posthog-mcp-api',
      'posthog-mcp-session',
      'posthog-mcp-read-all',
      'posthog-mcp-write-all',
    ].includes(name)
);

describe('builtin schemas: posthog-mcp', () => {
  it('scope matches the US and EU MCP hosts only', () => {
    expect(matches('posthog-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('posthog-mcp-api', makeRequest({ domain: EU_DOMAIN }))).toBe(true);
    expect(matches('posthog-mcp-api', makeRequest({ domain: 'app.posthog.com' }))).toBe(false);
    expect(matches('posthog-mcp-api', makeRequest({ domain: 'oauth.posthog.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('posthog-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('posthog-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('posthog-mcp-session', toolRequest('feature-flag-get-all'))).toBe(false);
    expect(matches('posthog-mcp-session', execRequest('tools'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    const readTools = toolNamesOf('posthog-mcp-read-all');
    const writeTools = toolNamesOf('posthog-mcp-write-all');
    expect(readTools).toEqual(expect.arrayContaining(['execute-sql', 'feature-flag-get-all']));
    expect(writeTools).toEqual(expect.arrayContaining(['delete-feature-flag', 'switch-project']));
    expect(readTools.filter((tool) => writeTools.includes(tool))).toEqual([]);
    for (const tool of readTools) {
      expect(matches('posthog-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('posthog-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of writeTools) {
      expect(matches('posthog-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('posthog-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('posthog-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('posthog-mcp-write-all', rpcRequest('initialize'))).toBe(true);
  });

  it('every tool belongs to exactly one fine-grained schema', () => {
    const allTools = [
      ...toolNamesOf('posthog-mcp-read-all'),
      ...toolNamesOf('posthog-mcp-write-all'),
    ];
    const fineGrainedTools = fineGrainedSchemas.flatMap(toolNamesOf);
    expect(fineGrainedTools.sort()).toEqual(allTools.sort());
  });

  it('CLI mode: exec "call <tool>" follows the classification of the tool', () => {
    expect(matches('posthog-mcp-read-all', execRequest('call feature-flag-get-all {}'))).toBe(true);
    expect(
      matches('posthog-mcp-read-experimentation', execRequest('call feature-flag-get-all {}'))
    ).toBe(true);
    expect(matches('posthog-mcp-write-all', execRequest('call feature-flag-get-all {}'))).toBe(
      false
    );
    expect(
      matches('posthog-mcp-write-experimentation', execRequest('call feature-flag-get-all {}'))
    ).toBe(false);

    const deletion = 'call --json --confirm delete-feature-flag {"flagKey":"beta"}';
    expect(matches('posthog-mcp-write-all', execRequest(deletion))).toBe(true);
    expect(matches('posthog-mcp-write-experimentation', execRequest(deletion))).toBe(true);
    expect(matches('posthog-mcp-read-all', execRequest(deletion))).toBe(false);
    expect(matches('posthog-mcp-read-experimentation', execRequest(deletion))).toBe(false);
    expect(matches('posthog-mcp-write-messaging-and-surveys', execRequest(deletion))).toBe(false);

    expect(matches('posthog-mcp-read-all', execRequest('call feature-flag-get-allx {}'))).toBe(
      false
    );
    expect(matches('posthog-mcp-read-all', execRequest('call unknown-tool {}'))).toBe(false);
    expect(matches('posthog-mcp-write-all', execRequest('call unknown-tool {}'))).toBe(false);
    expect(matches('posthog-mcp-read-all', execRequest('call'))).toBe(false);
  });

  it('CLI mode: exec discovery commands are read-only and allowed by both -all schemas', () => {
    for (const command of [
      'help',
      'tools',
      'search feature flag',
      'info execute-sql',
      'schema query-trends series',
      'learn hogql',
    ]) {
      expect(matches('posthog-mcp-read-all', execRequest(command)), command).toBe(true);
      expect(matches('posthog-mcp-write-all', execRequest(command)), command).toBe(true);
      expect(matches('posthog-mcp-read-workspace', execRequest(command)), command).toBe(true);
      expect(matches('posthog-mcp-read-experimentation', execRequest(command)), command).toBe(
        false
      );
    }
    expect(matches('posthog-mcp-write-workspace', execRequest('help'))).toBe(false);
    expect(matches('posthog-mcp-read-workspace', execRequest('call execute-sql {}'))).toBe(false);
    expect(matches('posthog-mcp-read-workspace', execRequest('toolsx'))).toBe(false);
    expect(matches('posthog-mcp-read-workspace', toolRequest('render-ui'))).toBe(true);
    expect(matches('posthog-mcp-read-workspace', toolRequest('docs-search'))).toBe(true);
    expect(matches('posthog-mcp-read-workspace', execRequest('call docs-search {}'))).toBe(true);
    expect(matches('posthog-mcp-read-all', toolRequest('render-ui'))).toBe(true);
    expect(matches('posthog-mcp-write-all', toolRequest('render-ui'))).toBe(false);
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    expect(matches('posthog-mcp-read-analytics', toolRequest('execute-sql'))).toBe(true);
    expect(matches('posthog-mcp-read-analytics', toolRequest('query-trends'))).toBe(true);
    expect(matches('posthog-mcp-write-analytics', toolRequest('insight-delete'))).toBe(true);
    expect(matches('posthog-mcp-write-analytics', toolRequest('execute-sql'))).toBe(false);
    expect(matches('posthog-mcp-read-analytics', toolRequest('dashboard-get'))).toBe(true);
    expect(matches('posthog-mcp-write-analytics', toolRequest('dashboard-create'))).toBe(true);
    expect(matches('posthog-mcp-read-experimentation', toolRequest('experiment-results-get'))).toBe(
      true
    );
    expect(matches('posthog-mcp-write-experimentation', toolRequest('experiment-launch'))).toBe(
      true
    );
    expect(
      matches('posthog-mcp-read-monitoring', toolRequest('query-error-tracking-issues-list'))
    ).toBe(true);
    expect(
      matches('posthog-mcp-write-monitoring', toolRequest('error-tracking-issues-merge-create'))
    ).toBe(true);
    expect(matches('posthog-mcp-read-messaging-and-surveys', toolRequest('survey-stats'))).toBe(
      true
    );
    expect(matches('posthog-mcp-write-messaging-and-surveys', toolRequest('survey-launch'))).toBe(
      true
    );
    expect(matches('posthog-mcp-read-workspace', toolRequest('projects-get'))).toBe(true);
    expect(matches('posthog-mcp-write-workspace', toolRequest('switch-project'))).toBe(true);
    expect(
      matches('posthog-mcp-read-monitoring', toolRequest('get-llm-total-costs-for-project'))
    ).toBe(true);
    expect(matches('posthog-mcp-write-monitoring', toolRequest('llma-prompt-create'))).toBe(true);
    expect(matches('posthog-mcp-write-experimentation', toolRequest('llma-prompt-create'))).toBe(
      false
    );
    expect(matches('posthog-mcp-read-experimentation', toolRequest('dashboard-get'))).toBe(false);
    expect(matches('posthog-mcp-read-people-and-customers', toolRequest('persons-list'))).toBe(
      true
    );
    expect(matches('posthog-mcp-write-people-and-customers', toolRequest('accounts-create'))).toBe(
      true
    );
    expect(matches('posthog-mcp-read-data', toolRequest('external-data-sources-list'))).toBe(true);
    expect(matches('posthog-mcp-write-data', toolRequest('view-run'))).toBe(true);
    expect(matches('posthog-mcp-write-pipelines', toolRequest('batch-export-create'))).toBe(true);
    expect(matches('posthog-mcp-write-data', toolRequest('batch-export-create'))).toBe(false);
    expect(matches('posthog-mcp-read-data', toolRequest('cdp-functions-list'))).toBe(true);
    expect(
      matches('posthog-mcp-read-monitoring', toolRequest('query-session-recordings-list'))
    ).toBe(true);
    expect(matches('posthog-mcp-write-monitoring', toolRequest('inbox-report-actions-run'))).toBe(
      true
    );
    expect(matches('posthog-mcp-read-agents-and-engineering', toolRequest('skill-list'))).toBe(
      true
    );
    expect(matches('posthog-mcp-write-agents-and-engineering', toolRequest('tasks-create'))).toBe(
      true
    );
    expect(matches('posthog-mcp-read-data', toolRequest('persons-list'))).toBe(false);

    for (const schema of fineGrainedSchemas) {
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
    }
    const wrongPath = mcpRequest(DOMAIN, '/v1/other', mcpToolCall('feature-flag-get-all'));
    expect(matches('posthog-mcp-read-experimentation', wrongPath)).toBe(false);
    expect(matches('posthog-mcp-read-all', wrongPath)).toBe(false);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    const noBody = makeRequest({ domain: DOMAIN, method: 'POST', path: PATH });
    expect(matches('posthog-mcp-read-all', noBody)).toBe(false);
    expect(matches('posthog-mcp-write-all', noBody)).toBe(false);
    expect(matches('posthog-mcp-session', noBody)).toBe(false);
  });
});
