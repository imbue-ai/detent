import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp2.readwise.io';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const READ_TOOLS = [
  'readwise_search_highlights',
  'readwise_list_highlights',
  'readwise_get_daily_review',
  'reader_get_document_highlights',
  'reader_search_documents',
  'reader_list_documents',
  'reader_get_document_details',
  'reader_list_tags',
  'reader_export_documents',
  'reader_get_export_documents_status',
  'books_list_books',
  'books_list_sessions',
  'books_get_sessions_by_day',
  'books_get_stats_summary',
  'books_list_public_tokens',
];

const WRITE_TOOLS = [
  'readwise_create_highlights',
  'readwise_update_highlight',
  'readwise_delete_highlight',
  'reader_create_highlight',
  'reader_add_tags_to_highlight',
  'reader_remove_tags_from_highlight',
  'reader_set_highlight_notes',
  'reader_create_document',
  'reader_move_documents',
  'reader_bulk_edit_document_metadata',
  'reader_add_tags_to_document',
  'reader_remove_tags_from_document',
  'books_create_books',
  'books_update_books',
  'books_delete_books',
  'books_create_sessions',
  'books_update_sessions',
  'books_delete_sessions',
  'books_create_public_token',
  'books_revoke_public_token',
];

const FINE_GRAINED: Record<string, { yes: [string, ...string[]]; no: string[] }> = {
  'readwise-mcp-read-highlights': {
    yes: ['readwise_search_highlights', 'reader_get_document_highlights'],
    no: ['readwise_create_highlights', 'reader_list_documents'],
  },
  'readwise-mcp-write-highlights': {
    yes: ['readwise_update_highlight', 'reader_set_highlight_notes'],
    no: ['readwise_delete_highlight', 'readwise_list_highlights'],
  },
  'readwise-mcp-delete-highlights': {
    yes: ['readwise_delete_highlight'],
    no: ['readwise_update_highlight', 'books_delete_books'],
  },
  'readwise-mcp-read-documents': {
    yes: ['reader_search_documents', 'reader_list_tags'],
    no: ['reader_create_document', 'reader_export_documents'],
  },
  'readwise-mcp-write-documents': {
    yes: ['reader_move_documents', 'reader_add_tags_to_document'],
    no: ['reader_get_document_details', 'reader_add_tags_to_highlight'],
  },
  'readwise-mcp-export-documents': {
    yes: ['reader_export_documents', 'reader_get_export_documents_status'],
    no: ['reader_list_documents'],
  },
  'readwise-mcp-read-books': {
    yes: ['books_list_books', 'books_get_stats_summary'],
    no: ['books_create_books', 'books_list_public_tokens'],
  },
  'readwise-mcp-write-books': {
    yes: ['books_update_books', 'books_create_sessions'],
    no: ['books_delete_sessions', 'books_list_sessions'],
  },
  'readwise-mcp-delete-books': {
    yes: ['books_delete_books', 'books_delete_sessions'],
    no: ['books_update_books'],
  },
  'readwise-mcp-read-public-tokens': {
    yes: ['books_list_public_tokens'],
    no: ['books_create_public_token'],
  },
  'readwise-mcp-write-public-tokens': {
    yes: ['books_create_public_token', 'books_revoke_public_token'],
    no: ['books_list_public_tokens'],
  },
};

describe('builtin schemas: readwise-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('readwise-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('readwise-mcp-api', makeRequest({ domain: 'readwise.io' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('readwise-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('readwise-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('readwise-mcp-session', toolRequest('readwise_list_highlights'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of READ_TOOLS) {
      expect(matches('readwise-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('readwise-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('readwise-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('readwise-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('readwise-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('readwise-mcp-write-all', rpcRequest('initialize'))).toBe(true);
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
      expect(matches(schema, mcpRequest(DOMAIN, '/v1/other', mcpToolCall(yes[0]))), schema).toBe(
        false
      );
    }
  });

  it('every tool appears in at least one fine-grained schema', () => {
    const allTools = [...READ_TOOLS, ...WRITE_TOOLS];
    const schemas = Object.keys(FINE_GRAINED);
    for (const tool of allTools) {
      expect(
        schemas.some((schema) => matches(schema, toolRequest(tool))),
        tool
      ).toBe(true);
    }
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('readwise-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
