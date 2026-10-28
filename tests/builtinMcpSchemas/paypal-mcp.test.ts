import { describe, it, expect } from 'vitest';
import { matches, mcpRequest, mcpRpc, mcpToolCall, makeRequest } from './helpers.js';

const DOMAIN = 'mcp.paypal.com';
const SANDBOX_DOMAIN = 'mcp.sandbox.paypal.com';
const PATH = '/mcp';
const toolRequest = (name: string) => mcpRequest(DOMAIN, PATH, mcpToolCall(name));
const rpcRequest = (method: string) => mcpRequest(DOMAIN, PATH, mcpRpc(method));

const FINE_GRAINED: Record<string, string[]> = {
  'paypal-mcp-read-invoices': [
    'list_invoices',
    'get_invoice',
    'search_invoicing',
    'get_recurring_series',
    'generate_invoice_qr_code',
    'generate_invoice_number',
  ],
  'paypal-mcp-write-invoices': [
    'create_invoice',
    'update_invoicing',
    'cancel_sent_invoice',
    'create_recurring_series',
    'activate_recurring_series',
    'cancel_recurring_series',
    'setup_invoice_auto_reminders',
    'update_invoice_auto_reminder',
    'cancel_invoice_auto_reminder',
    'record_payment_for_invoice',
    'record_refund_for_invoice',
    'create_conditional_rules_for_invoice',
  ],
  'paypal-mcp-send-invoices': ['send_invoice', 'send_invoice_reminder'],
  'paypal-mcp-delete-invoices': ['delete_invoice', 'delete_recurring_series'],
  'paypal-mcp-read-products': [
    'list_products',
    'list_product',
    'show_product_details',
    'search_product',
  ],
  'paypal-mcp-write-products': ['create_product', 'update_product'],
  'paypal-mcp-read-subscriptions': [
    'list_subscription_plans',
    'show_subscription_plan_details',
    'show_subscription_details',
  ],
  'paypal-mcp-write-subscriptions': [
    'create_subscription_plan',
    'update_plan',
    'create_subscription',
    'update_subscription',
    'cancel_subscription',
  ],
  'paypal-mcp-read-payments': ['get_order', 'get_order_details', 'get_refund'],
  'paypal-mcp-move-money': [
    'create_order',
    'pay_order',
    'create_refund',
    'create_cart',
    'checkout_cart',
    'accept_dispute_claim',
  ],
  'paypal-mcp-read-disputes': ['list_disputes', 'get_dispute'],
  'paypal-mcp-read-shipments': ['get_shipment_tracking'],
  'paypal-mcp-write-shipments': ['create_shipment_tracking', 'update_shipment_tracking'],
  'paypal-mcp-read-reports': ['list_transactions', 'list_transaction', 'get_merchant_insights'],
};

const READ_TOOLS = Object.entries(FINE_GRAINED)
  .filter(([schema]) => schema.startsWith('paypal-mcp-read-'))
  .flatMap(([, tools]) => tools);
const WRITE_TOOLS = Object.entries(FINE_GRAINED)
  .filter(([schema]) => !schema.startsWith('paypal-mcp-read-'))
  .flatMap(([, tools]) => tools);

describe('builtin schemas: paypal-mcp', () => {
  it('scope matches the production and sandbox MCP hosts only', () => {
    expect(matches('paypal-mcp-api', makeRequest({ domain: DOMAIN }))).toBe(true);
    expect(matches('paypal-mcp-api', makeRequest({ domain: SANDBOX_DOMAIN }))).toBe(true);
    expect(matches('paypal-mcp-api', makeRequest({ domain: 'api-m.paypal.com' }))).toBe(false);
    expect(matches('paypal-mcp-api', makeRequest({ domain: 'paypal.com' }))).toBe(false);
  });

  it('session matches the handshake but not tool calls', () => {
    expect(matches('paypal-mcp-session', rpcRequest('initialize'))).toBe(true);
    expect(matches('paypal-mcp-session', rpcRequest('tools/list'))).toBe(true);
    expect(matches('paypal-mcp-session', rpcRequest('notifications/initialized'))).toBe(true);
    expect(matches('paypal-mcp-session', toolRequest('list_invoices'))).toBe(false);
    expect(matches('paypal-mcp-session', rpcRequest('tools/call'))).toBe(false);
  });

  it('read-all and write-all partition the tools', () => {
    expect(READ_TOOLS.length + WRITE_TOOLS.length).toBe(53);
    for (const tool of READ_TOOLS) {
      expect(matches('paypal-mcp-read-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('paypal-mcp-write-all', toolRequest(tool)), tool).toBe(false);
    }
    for (const tool of WRITE_TOOLS) {
      expect(matches('paypal-mcp-write-all', toolRequest(tool)), tool).toBe(true);
      expect(matches('paypal-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
    expect(matches('paypal-mcp-read-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('paypal-mcp-write-all', rpcRequest('initialize'))).toBe(true);
    expect(matches('paypal-mcp-read-all', toolRequest('unknown_tool'))).toBe(false);
    expect(matches('paypal-mcp-write-all', toolRequest('unknown_tool'))).toBe(false);
  });

  it('money-moving tools are never allowed by non-money permissions', () => {
    for (const tool of FINE_GRAINED['paypal-mcp-move-money']!) {
      for (const schema of Object.keys(FINE_GRAINED)) {
        expect(matches(schema, toolRequest(tool)), `${schema} / ${tool}`).toBe(
          schema === 'paypal-mcp-move-money'
        );
      }
      expect(matches('paypal-mcp-read-all', toolRequest(tool)), tool).toBe(false);
    }
  });

  it('fine-grained schemas match exactly their tools and cover every tool', () => {
    const allTools = [...READ_TOOLS, ...WRITE_TOOLS];
    for (const [schema, tools] of Object.entries(FINE_GRAINED)) {
      for (const tool of allTools) {
        expect(matches(schema, toolRequest(tool)), `${schema} / ${tool}`).toBe(
          tools.includes(tool)
        );
      }
      expect(matches(schema, rpcRequest('initialize')), schema).toBe(false);
      expect(matches(schema, rpcRequest('tools/list')), schema).toBe(false);
      for (const tool of tools) {
        expect(matches(schema, mcpRequest(DOMAIN, '/sse', mcpToolCall(tool))), schema).toBe(false);
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
      matches('paypal-mcp-read-all', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
    expect(
      matches('paypal-mcp-move-money', makeRequest({ domain: DOMAIN, method: 'POST', path: PATH }))
    ).toBe(false);
  });
});
