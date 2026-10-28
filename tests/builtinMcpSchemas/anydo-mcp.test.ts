import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.any.do';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const readTools = [
  'get_tasks',
  'get_task',
  'get_completed_tasks_for_date_range',
  'get_subtasks',
  'get_lists',
  'get_active_spaces',
  'get_workspace_boards',
  'get_board_sections',
  'get_workspace_members',
  'get_connected_calendars',
  'get_events_for_date_range',
  'get_calendar_event',
  'get_user_info',
];

const writeTools = [
  'create_personal_tasks',
  'update_task_preview',
  'apply_bulk_task_updates',
  'create_subtasks',
  'update_subtask',
  'create_lists',
  'set_reminder',
  'set_recurring_reminder',
  'create_workspace_tasks',
  'create_board',
  'create_calendar_events',
  'update_calendar_events_preview',
  'apply_bulk_event_updates',
  'delete_calendar_events_preview',
];

const fineGrained: Record<string, { yes: string[]; no: string[] }> = {
  'anydo-mcp-read-tasks': {
    yes: ['get_tasks', 'get_subtasks', 'get_lists'],
    no: ['create_personal_tasks', 'get_workspace_boards'],
  },
  'anydo-mcp-write-tasks': {
    yes: [
      'create_personal_tasks',
      'update_task_preview',
      'apply_bulk_task_updates',
      'create_lists',
    ],
    no: ['get_tasks', 'set_reminder', 'create_workspace_tasks'],
  },
  'anydo-mcp-set-reminders': {
    yes: ['set_reminder', 'set_recurring_reminder'],
    no: ['create_personal_tasks'],
  },
  'anydo-mcp-read-workspaces': {
    yes: ['get_active_spaces', 'get_workspace_members'],
    no: ['create_board', 'get_lists'],
  },
  'anydo-mcp-write-workspaces': {
    yes: ['create_workspace_tasks', 'create_board'],
    no: ['get_board_sections', 'create_personal_tasks'],
  },
  'anydo-mcp-read-calendar-events': {
    yes: ['get_connected_calendars', 'get_calendar_event'],
    no: ['create_calendar_events', 'get_tasks'],
  },
  'anydo-mcp-write-calendar-events': {
    yes: ['create_calendar_events', 'update_calendar_events_preview', 'apply_bulk_event_updates'],
    no: ['delete_calendar_events_preview', 'get_calendar_event'],
  },
  'anydo-mcp-delete-calendar-events': {
    yes: ['delete_calendar_events_preview'],
    no: ['update_calendar_events_preview'],
  },
  'anydo-mcp-read-account': { yes: ['get_user_info'], no: ['get_tasks'] },
};

describe('builtin schemas: anydo-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('anydo-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('anydo-mcp-api', makeRequest({ domain: 'sm-prod4.any.do' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('anydo-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('anydo-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('anydo-mcp-session', toolRequest('get_tasks'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of readTools) {
      expect(matches('anydo-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('anydo-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of writeTools) {
      expect(matches('anydo-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('anydo-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('anydo-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('anydo-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('anydo-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('anydo-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
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

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('anydo-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
