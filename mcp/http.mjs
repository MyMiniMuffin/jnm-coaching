/**
 * Streamable HTTP endpoint for the MCP server (mounted at /mcp by server.mjs).
 * Stateless: every POST gets its own server + transport, bound to the coach
 * API key in its Authorization header (validated exactly like the REST API).
 * Without sessions there is no SSE stream to open (GET) or session to end
 * (DELETE), so only POST is accepted.
 */
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createCoachMcpServer } from './server.mjs';

const sendResponse = (res, { statusCode, headers, body }) => {
  res.writeHead(statusCode, headers);
  res.end(body);
};

const jsonRpcError = (statusCode, code, message, headers = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null })
});

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {{ gateway: ReturnType<import('../coach-api/http.js').createCoachGateway>, ip: string, body: Buffer }} options
 *   `body` is the already-read request body; the request stream is drained.
 */
export const handleMcpRequest = async (req, res, { gateway, ip, body }) => {
  // Checked before auth and before any transport exists, so an authenticated
  // GET can never hold an SSE stream open.
  if (req.method !== 'POST') {
    sendResponse(res, jsonRpcError(405, -32000, 'Method not allowed. This MCP server is stateless; use POST.', { Allow: 'POST' }));
    return;
  }

  const auth = await gateway.authorize({ headers: req.headers, ip });
  if (!auth.ok) {
    sendResponse(res, auth.response);
    return;
  }

  // The body must be parsed here: the transport would otherwise try to read the
  // request stream again, which server.mjs has already drained.
  let parsedBody;
  try {
    if (!body?.length) throw new Error('empty body');
    parsedBody = JSON.parse(body.toString('utf8'));
  } catch {
    sendResponse(res, jsonRpcError(400, -32700, 'Parse error'));
    return;
  }

  const server = createCoachMcpServer({ service: gateway.service, key: auth.key });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  res.on('close', () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, parsedBody);
};
