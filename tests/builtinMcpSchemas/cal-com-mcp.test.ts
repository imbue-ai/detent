import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.cal.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const readTools = [
  'get_app_link',
  'search_docs',
  'get_me',
  'get_event_types',
  'get_event_type',
  'get_event_type_settings',
  'get_event_type_history',
  'get_scheduling_config',
  'get_crm_sync_errors',
  'get_events',
  'get_event',
  'get_bookings',
  'get_booking',
  'get_booking_attendees',
  'get_booking_attendee',
  'get_booking_routing_trace',
  'get_org_team_bookings',
  'get_org_user_bookings',
  'get_schedules',
  'get_schedule',
  'get_default_schedule',
  'get_availability',
  'get_busy_times',
  'get_connected_calendars',
  'get_conferencing_apps',
  'get_my_teams',
  'get_org_teams',
  'get_team_memberships',
  'get_team_membership',
  'get_org_memberships',
  'get_org_membership',
  'get_org_attributes',
  'get_org_attribute',
  'get_attribute_options',
  'get_user_attributes',
  'get_user_attribute_history',
  'calculate_routing_form_slots',
  'get_org_routing_forms',
  'get_org_routing_form_responses',
  'get_team_routing_forms',
  'get_routing_form',
  'get_routing_form_history',
  'find_api_operation',
  'describe_api_operation',
];

const writeTools = [
  'update_me',
  'create_event_type',
  'update_event_type',
  'duplicate_event_type',
  'delete_event_type',
  'create_booking',
  'reschedule_booking',
  'cancel_booking',
  'confirm_booking',
  'mark_booking_absent',
  'add_booking_attendee',
  'create_schedule',
  'update_schedule',
  'delete_schedule',
  'create_team_invite',
  'create_team_membership',
  'update_team_membership',
  'delete_team_membership',
  'create_org_membership',
  'update_org_membership',
  'delete_org_membership',
  'assign_attribute_to_user',
  'update_user_attribute',
  'unassign_attribute_from_user',
  'create_routing_form',
  'edit_routing_form_routes',
  'edit_routing_form_fields',
  'call_api_operation',
];

const fineGrained: Record<string, { yes: string[]; no: string[] }> = {
  'cal-com-mcp-read-docs': { yes: ['search_docs', 'get_app_link'], no: ['get_me'] },
  'cal-com-mcp-read-profile': { yes: ['get_me'], no: ['update_me'] },
  'cal-com-mcp-write-profile': { yes: ['update_me'], no: ['get_me'] },
  'cal-com-mcp-read-event-types': {
    yes: ['get_event_types', 'get_crm_sync_errors'],
    no: ['create_event_type', 'get_events'],
  },
  'cal-com-mcp-write-event-types': {
    yes: ['create_event_type', 'duplicate_event_type'],
    no: ['delete_event_type', 'get_event_type'],
  },
  'cal-com-mcp-delete-event-types': { yes: ['delete_event_type'], no: ['update_event_type'] },
  'cal-com-mcp-read-events': { yes: ['get_events', 'get_event'], no: ['get_event_type'] },
  'cal-com-mcp-read-bookings': {
    yes: ['get_bookings', 'get_booking_routing_trace'],
    no: ['create_booking', 'cancel_booking'],
  },
  'cal-com-mcp-write-bookings': {
    yes: ['create_booking', 'mark_booking_absent'],
    no: ['get_booking', 'create_schedule'],
  },
  'cal-com-mcp-read-schedules': {
    yes: ['get_schedules', 'get_default_schedule'],
    no: ['update_schedule'],
  },
  'cal-com-mcp-write-schedules': {
    yes: ['create_schedule', 'update_schedule'],
    no: ['delete_schedule'],
  },
  'cal-com-mcp-delete-schedules': { yes: ['delete_schedule'], no: ['delete_event_type'] },
  'cal-com-mcp-read-availability': {
    yes: ['get_availability', 'get_connected_calendars'],
    no: ['get_schedules'],
  },
  'cal-com-mcp-read-teams': {
    yes: ['get_my_teams', 'get_team_membership'],
    no: ['create_team_invite'],
  },
  'cal-com-mcp-write-teams': {
    yes: ['create_team_invite', 'delete_team_membership'],
    no: ['get_org_teams', 'create_org_membership'],
  },
  'cal-com-mcp-read-organizations': {
    yes: ['get_org_memberships', 'get_user_attribute_history'],
    no: ['assign_attribute_to_user'],
  },
  'cal-com-mcp-write-organizations': {
    yes: ['create_org_membership', 'unassign_attribute_from_user'],
    no: ['get_org_attribute', 'update_team_membership'],
  },
  'cal-com-mcp-read-routing-forms': {
    yes: ['get_routing_form', 'calculate_routing_form_slots'],
    no: ['create_routing_form'],
  },
  'cal-com-mcp-write-routing-forms': {
    yes: ['create_routing_form', 'edit_routing_form_fields'],
    no: ['get_routing_form_history'],
  },
  'cal-com-mcp-read-api-catalog': {
    yes: ['find_api_operation', 'describe_api_operation'],
    no: ['call_api_operation'],
  },
  'cal-com-mcp-call-api-operations': { yes: ['call_api_operation'], no: ['find_api_operation'] },
};

describe('builtin schemas: cal-com-mcp', () => {
  it('scope matches the MCP host only', () => {
    expect(matches('cal-com-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('cal-com-mcp-api', makeRequest({ domain: 'api.cal.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('cal-com-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('cal-com-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('cal-com-mcp-session', toolRequest('get_me'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    for (const tool of readTools) {
      expect(matches('cal-com-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('cal-com-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of writeTools) {
      expect(matches('cal-com-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('cal-com-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('cal-com-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('cal-com-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('cal-com-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('cal-com-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
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
    const covered = new Set(Object.values(fineGrained).flatMap(({ yes }) => yes));
    for (const tool of [...readTools, ...writeTools]) {
      if (covered.has(tool)) continue;
      const matching = Object.keys(fineGrained).filter((schema) =>
        matches(schema, toolRequest(tool))
      );
      expect(matching.length, tool).toBeGreaterThan(0);
    }
  });

  it('schemas reject requests without a parsed JSON body', () => {
    expect(
      matches('cal-com-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
