import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.clickup.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'clickup_search',
  'clickup_get_workspace_hierarchy',
  'clickup_get_workspace_members',
  'clickup_find_member_by_name',
  'clickup_resolve_assignees',
  'clickup_get_user',
  'clickup_get_list',
  'clickup_get_folder',
  'clickup_get_custom_fields',
  'clickup_get_schema',
  'clickup_get_operators',
  'clickup_get_task',
  'clickup_filter_tasks',
  'clickup_get_task_time_in_status',
  'clickup_get_bulk_tasks_time_in_status',
  'clickup_download_task_attachment',
  'clickup_get_current_time_entry',
  'clickup_get_time_entries',
  'clickup_get_task_comments',
  'clickup_get_threaded_comments',
  'clickup_list_document_pages',
  'clickup_get_document_pages',
  'clickup_list_document_page_attachments',
  'clickup_download_document_page_attachment',
  'clickup_get_chat_channels',
  'clickup_get_chat_channel_messages',
  'clickup_get_chat_message_replies',
  'clickup_search_reminders',
];

const WRITE_TOOLS = [
  'clickup_create_list',
  'clickup_create_list_in_folder',
  'clickup_update_list',
  'clickup_create_folder',
  'clickup_update_folder',
  'clickup_create_space_tag',
  'clickup_create_task',
  'clickup_update_task',
  'clickup_move_task',
  'clickup_add_task_to_list',
  'clickup_remove_task_from_list',
  'clickup_add_task_dependency',
  'clickup_remove_task_dependency',
  'clickup_add_task_link',
  'clickup_remove_task_link',
  'clickup_add_tag_to_task',
  'clickup_remove_tag_from_task',
  'clickup_attach_task_file',
  'clickup_request_attachment_upload',
  'clickup_delete_task',
  'clickup_merge_tasks',
  'clickup_start_time_tracking',
  'clickup_stop_time_tracking',
  'clickup_add_time_entry',
  'clickup_create_comment',
  'clickup_create_task_comment',
  'clickup_update_comment',
  'clickup_delete_comment',
  'clickup_create_document',
  'clickup_create_document_page',
  'clickup_update_document_page',
  'clickup_send_chat_message',
  'clickup_update_chat_message',
  'clickup_react_to_chat_message',
  'clickup_create_reminder',
  'clickup_update_reminder',
  'clickup_execute_operator',
];

const FINE_GRAINED: Record<string, { yes: string[]; no: string[] }> = {
  'clickup-mcp-search': { yes: ['clickup_search'], no: ['clickup_search_reminders'] },
  'clickup-mcp-read-workspace': {
    yes: ['clickup_get_workspace_hierarchy', 'clickup_get_list'],
    no: ['clickup_create_list'],
  },
  'clickup-mcp-write-lists-and-folders': {
    yes: ['clickup_create_list_in_folder', 'clickup_update_folder'],
    no: ['clickup_get_folder'],
  },
  'clickup-mcp-read-tasks': {
    yes: ['clickup_get_task', 'clickup_filter_tasks'],
    no: ['clickup_update_task'],
  },
  'clickup-mcp-write-tasks': {
    yes: ['clickup_create_task', 'clickup_add_task_dependency'],
    no: ['clickup_delete_task', 'clickup_get_task'],
  },
  'clickup-mcp-delete-tasks': {
    yes: ['clickup_delete_task', 'clickup_merge_tasks'],
    no: ['clickup_update_task'],
  },
  'clickup-mcp-read-time-entries': {
    yes: ['clickup_get_time_entries'],
    no: ['clickup_add_time_entry'],
  },
  'clickup-mcp-write-time-entries': {
    yes: ['clickup_start_time_tracking', 'clickup_add_time_entry'],
    no: ['clickup_get_current_time_entry'],
  },
  'clickup-mcp-read-comments': {
    yes: ['clickup_get_task_comments'],
    no: ['clickup_create_comment'],
  },
  'clickup-mcp-write-comments': {
    yes: ['clickup_create_comment', 'clickup_update_comment'],
    no: ['clickup_delete_comment'],
  },
  'clickup-mcp-delete-comments': {
    yes: ['clickup_delete_comment'],
    no: ['clickup_update_comment'],
  },
  'clickup-mcp-read-docs': {
    yes: ['clickup_get_document_pages'],
    no: ['clickup_update_document_page'],
  },
  'clickup-mcp-write-docs': {
    yes: ['clickup_create_document', 'clickup_update_document_page'],
    no: ['clickup_list_document_pages'],
  },
  'clickup-mcp-read-chat-messages': {
    yes: ['clickup_get_chat_channel_messages'],
    no: ['clickup_send_chat_message'],
  },
  'clickup-mcp-send-chat-messages': {
    yes: ['clickup_send_chat_message', 'clickup_react_to_chat_message'],
    no: ['clickup_get_chat_channels'],
  },
  'clickup-mcp-read-reminders': {
    yes: ['clickup_search_reminders'],
    no: ['clickup_create_reminder'],
  },
  'clickup-mcp-write-reminders': {
    yes: ['clickup_create_reminder', 'clickup_update_reminder'],
    no: ['clickup_search_reminders'],
  },
  'clickup-mcp-execute-operators': {
    yes: ['clickup_execute_operator'],
    no: ['clickup_get_operators'],
  },
};

describe('builtin schemas: clickup-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('clickup-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('clickup-mcp-api', makeRequest({ domain: 'api.clickup.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('clickup-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('clickup-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('clickup-mcp-session', toolRequest('clickup_get_task'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('clickup-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('clickup-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('clickup-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('clickup-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('clickup-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('clickup-mcp-write-all', rpcRequest('initialize'))).toBe(true);
  });

  it('every tool appears in at least one fine-grained schema', () => {
    const covered = new Set(Object.values(FINE_GRAINED).flatMap((entry) => entry.yes));
    for (const tool of [...READ_TOOLS, ...WRITE_TOOLS]) {
      const schemaNames = Object.keys(FINE_GRAINED);
      const matched = schemaNames.some((schema) => matches(schema, toolRequest(tool)));
      expect(matched, tool).toBe(true);
    }
    expect(covered.size).toBeGreaterThan(0);
  });

  it('fine-grained schemas match their tools and nothing else', () => {
    for (const [schema, { yes, no }] of Object.entries(FINE_GRAINED)) {
      for (const tool of yes) {
        expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(true);
      }
      for (const tool of no) {
        expect(matches(schema, toolRequest(tool)), `${schema} ${tool}`).toBe(false);
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
    }
    expect(
      matches(
        'clickup-mcp-read-tasks',
        mcpRequest(DOMAIN, '/v1/other', mcpToolCall('clickup_get_task'))
      )
    ).toBe(false);
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('clickup-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches('clickup-mcp-read-tasks', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
