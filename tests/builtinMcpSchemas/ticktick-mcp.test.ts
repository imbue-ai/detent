import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

// The TickTick MCP server lives at the bare origin; there is no `/mcp` path.
const DOMAIN = 'mcp.ticktick.com';
const PATH = '/';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const readTools = [
  'search_task',
  'get_task_by_id',
  'list_undone_tasks_by_time_query',
  'list_undone_tasks_by_date',
  'list_completed_tasks_by_date',
  'filter_tasks',
  'get_task_in_project',
  'get_comment',
  'list_projects',
  'get_project_by_id',
  'get_project_with_undone_tasks',
  'list_columns',
  'list_project_groups',
  'list_project_members',
  'list_tags',
  'list_habits',
  'list_habit_sections',
  'get_habit',
  'get_habit_checkins',
  'get_focuses_by_time',
  'get_focus',
  'list_calendar_accounts',
  'query_calendar_events',
  'list_countdowns',
];

const writeTools = [
  'create_task',
  'batch_add_tasks',
  'complete_task',
  'complete_checklist_item',
  'complete_tasks_in_project',
  'update_task',
  'move_task',
  'batch_update_tasks',
  'add_comment',
  'assign_task',
  'unassign_task',
  'delete_task',
  'delete_comment',
  'create_project',
  'update_project',
  'create_column',
  'update_column',
  'create_project_group',
  'update_project_group',
  'delete_project_group',
  'create_tag',
  'rename_tag',
  'update_tag',
  'delete_tag',
  'create_habit',
  'update_habit',
  'upsert_habit_checkins',
  'create_focus',
  'update_focus',
  'delete_focus',
];

const fineGrained: Record<string, { yes: string[]; no: string[] }> = {
  'ticktick-mcp-read-tasks': {
    yes: ['search_task', 'filter_tasks', 'get_task_in_project', 'get_comment'],
    no: ['create_task', 'list_projects'],
  },
  'ticktick-mcp-write-tasks': {
    yes: ['create_task', 'complete_checklist_item', 'move_task', 'assign_task', 'add_comment'],
    no: ['delete_task', 'delete_comment', 'search_task'],
  },
  'ticktick-mcp-delete-tasks': {
    yes: ['delete_task', 'delete_comment'],
    no: ['update_task', 'delete_tag'],
  },
  'ticktick-mcp-read-lists': {
    yes: ['list_projects', 'list_columns', 'list_project_groups', 'list_project_members'],
    no: ['create_project', 'get_task_in_project'],
  },
  'ticktick-mcp-write-lists': {
    yes: ['create_project', 'update_column', 'delete_project_group'],
    no: ['list_projects', 'create_task'],
  },
  'ticktick-mcp-read-tags': { yes: ['list_tags'], no: ['create_tag'] },
  'ticktick-mcp-write-tags': {
    yes: ['create_tag', 'rename_tag', 'delete_tag'],
    no: ['list_tags', 'update_task'],
  },
  'ticktick-mcp-read-habits': {
    yes: ['list_habits', 'get_habit_checkins'],
    no: ['upsert_habit_checkins', 'list_tags'],
  },
  'ticktick-mcp-write-habits': {
    yes: ['create_habit', 'upsert_habit_checkins'],
    no: ['get_habit', 'create_task'],
  },
  'ticktick-mcp-read-focus-records': {
    yes: ['get_focuses_by_time', 'get_focus'],
    no: ['create_focus'],
  },
  'ticktick-mcp-write-focus-records': {
    yes: ['create_focus', 'delete_focus'],
    no: ['get_focus', 'delete_task'],
  },
  'ticktick-mcp-read-calendar-events': {
    yes: ['list_calendar_accounts', 'query_calendar_events'],
    no: ['list_countdowns'],
  },
  'ticktick-mcp-read-countdowns': { yes: ['list_countdowns'], no: ['query_calendar_events'] },
};

describe('builtin schemas: ticktick-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('ticktick-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('ticktick-mcp-api', makeRequest({ domain: 'api.ticktick.com' }))).toBe(false);
    expect(matches('ticktick-mcp-api', makeRequest({ domain: 'ticktick.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('ticktick-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('ticktick-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('ticktick-mcp-session', toolRequest('search_task'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of readTools) {
      expect(matches('ticktick-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('ticktick-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of writeTools) {
      expect(matches('ticktick-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('ticktick-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('ticktick-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('ticktick-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('ticktick-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('ticktick-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    for (const [schema, { yes, no }] of Object.entries(fineGrained)) {
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

  it('every tool appears in at least one fine-grained schema', () => {
    for (const tool of [...readTools, ...writeTools]) {
      const covering = Object.keys(fineGrained).filter((schema) =>
        matches(schema, toolRequest(tool))
      );
      expect(covering.length, tool).toBeGreaterThan(0);
    }
  });

  it('accepts the endpoint path with or without the trailing slash', () => {
    expect(
      matches('ticktick-mcp-read-all', mcpRequest(DOMAIN, '', mcpToolCall('search_task')))
    ).toBe(true);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('ticktick-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
