import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// ── Config ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3100;
const API = process.env.API_BASE_URL || "https://gpt.coinugget.com";
const CACHE_TTL = 60_000;

// ── In-memory cache ──────────────────────────────────────────────────
const cache = new Map();

async function fetchAPI(path) {
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && now - cached.ts < CACHE_TTL) return cached.data;

  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  const data = await res.json();
  cache.set(path, { data, ts: now });
  return data;
}

// ── Valid intervals ──────────────────────────────────────────────────
const INTERVALS = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"];

// ── MCP Server ───────────────────────────────────────────────────────
function createServer() {
  const server = new McpServer({
    name: "coinugget-crypto-signals",
    version: "1.0.0",
  });

  server.tool(
    "get_rsi",
    "RSI overbought (>70) and oversold (<30) top 10 coins. Updated every 60s.",
    { interval: z.string().optional().describe("Candle interval: 1m,3m,5m,15m,30m,1h,4h,1d,1w. Default: 5m") },
    async ({ interval }) => {
      const iv = INTERVALS.includes(interval) ? interval : "5m";
      const data = await fetchAPI(`/rsi?interval=${iv}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_gainers",
    "24-hour top 10 gaining cryptocurrencies by price change percentage.",
    {},
    async () => {
      const data = await fetchAPI("/gainers");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_price_action",
    "Short-term price surges and drops — top 10 surging and top 10 dropping coins.",
    { interval: z.string().optional().describe("Candle interval: 1m,3m,5m,15m,30m,1h,4h,1d,1w. Default: 5m") },
    async ({ interval }) => {
      const iv = INTERVALS.includes(interval) ? interval : "5m";
      const data = await fetchAPI(`/price-action?interval=${iv}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_kimchi",
    "Korean kimchi premium and 10-country regional crypto premiums.",
    {},
    async () => {
      const data = await fetchAPI("/kimchi");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_markets",
    "Major market prices — BTC, ETH, BNB, SOL, XRP, NASDAQ, GOLD, VIX and more with 24h changes.",
    {},
    async () => {
      const data = await fetchAPI("/markets");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_derivatives",
    "24-hour liquidation summary and long/short ratios for major cryptocurrencies.",
    {},
    async () => {
      const data = await fetchAPI("/derivatives");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_full_snapshot",
    "Complete market snapshot — all signals combined: RSI, gainers, price action, kimchi premium, markets, and derivatives.",
    {},
    async () => {
      const data = await fetchAPI("/signals");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  return server;
}

// ── Express ──────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Session management
const transports = {};

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "coinugget-mcp",
    version: "1.0.0",
    tools: 7,
    uptime: Math.floor(process.uptime()),
    cache_entries: cache.size,
  });
});

// MCP endpoint — POST
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];

  if (sessionId && transports[sessionId]) {
    await transports[sessionId].handleRequest(req, res, req.body);
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      transports[id] = transport;
      console.log(`[MCP] Session started: ${id}`);
    },
  });

  transport.onclose = () => {
    const id = Object.keys(transports).find((k) => transports[k] === transport);
    if (id) {
      delete transports[id];
      console.log(`[MCP] Session closed: ${id}`);
    }
  };

  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// MCP endpoint — GET (SSE stream)
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (sessionId && transports[sessionId]) {
    await transports[sessionId].handleRequest(req, res);
    return;
  }
  res.status(400).json({ error: "Missing or invalid session ID" });
});

// MCP endpoint — DELETE
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (sessionId && transports[sessionId]) {
    await transports[sessionId].handleRequest(req, res, req.body);
    return;
  }
  res.status(400).json({ error: "Missing or invalid session ID" });
});

// ── Start ────────────────────────────────────────────────────────────
app.listen(PORT, "127.0.0.1", () => {
  console.log(`[MCP] Coinugget MCP server running on http://127.0.0.1:${PORT}`);
  console.log(`[MCP] Health: http://127.0.0.1:${PORT}/health`);
  console.log(`[MCP] MCP endpoint: http://127.0.0.1:${PORT}/mcp`);
});
