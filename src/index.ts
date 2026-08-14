#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { findZapTemplates, searchApps } from "./zapier.js";

const server = new McpServer({ name: "zapier-discovery", version: "0.1.0" });

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function guarded<A extends unknown[]>(fn: (...args: A) => Promise<ToolResult>) {
  return async (...args: A): Promise<ToolResult> => {
    try {
      return await fn(...args);
    } catch (err) {
      return { content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  };
}

server.registerTool(
  "search_apps",
  {
    title: "Search the Zapier app directory",
    description:
      "Search Zapier's directory of 9,000+ integrated apps by name. Without a query, returns the most popular apps. Use the returned slugs with find_zap_templates.",
    inputSchema: {
      query: z.string().optional().describe("App name to search for, e.g. 'notion'"),
      limit: z.number().int().min(1).max(50).default(10).describe("Max results"),
    },
  },
  guarded(async ({ query, limit }) => jsonResult(await searchApps(query, limit))),
);

server.registerTool(
  "find_zap_templates",
  {
    title: "Find popular Zap templates",
    description:
      "What do people actually automate with these apps? Returns popular, ready-made Zap templates (by app slug from search_apps — one app or a pair like ['slack','notion']), each with a step chain and a one-click create link.",
    inputSchema: {
      apps: z.array(z.string()).min(1).max(3).describe("App slugs, e.g. ['slack', 'notion']"),
      limit: z.number().int().min(1).max(50).default(10).describe("Max templates"),
    },
  },
  guarded(async ({ apps, limit }) => jsonResult(await findZapTemplates(apps, limit))),
);

await server.connect(new StdioServerTransport());
