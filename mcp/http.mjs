/**
 * Streamable HTTP endpoint for the MCP server (mounted at /mcp by server.mjs).
 * Stateless: every POST gets its own server + transport, bound to the coach
 * API key in its Authorization header (validated exactly like the REST API).
 */
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createCoachMcpServer } from './server.mjs';

const sendResponse = (res, { statusCode, headers, body }) => {
  res.writeHead(statusCode, headers);
  res.end(body);
};

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {{ gateway: ReturnType<import('../coach-api/http.js').createCoachGateway>, ip: string, body: Buffer }} options
 */
export const handleMcpRequest = async (req, res, { gateway, ip, body }) => {
  const auth = await gateway.authorize({ headers: req.headers, ip });
  if (!auth.ok) {
    sendResponse(res, auth.response);
    return;
  }

  let parsedBody;
  if (body?.length) {
    try {
      parsedBody = JSON.parse(body.toString('utf8'));
    } catch {
      sendResponse(res, {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null })
      });
      return;
    }
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
