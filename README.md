# zapier-discovery-mcp

An [MCP](https://modelcontextprotocol.io) server for **automation discovery**. [Zapier MCP](https://docs.zapier.com/mcp/home) executes automations — this server answers the question that comes first: *what could I automate?*

- *"What do people automate between Slack and Notion?"* — real, popular Zap templates, each with a one-click create link
- *"Is there a Zapier integration for this tool?"* — search the 9,000+ app directory
- *"Give me automation ideas for my CRM"* — templates ranked by actual usage, not hallucinated

Sibling project: [zapier-dev-mcp](https://github.com/koleharv/zapier-dev-mcp) for *building* Zapier integrations.

## Setup

You need a Zapier Partner API `client_id` — free with any Zapier integration, and not a secret (it ships in client-side embed code). See the [Partner API docs](https://docs.api.zapier.com) for where to find yours.

**Claude Code**

```bash
claude mcp add zapier-discovery --env ZAPIER_CLIENT_ID=your_client_id -- npx -y zapier-discovery-mcp
```

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zapier-discovery": {
      "command": "npx",
      "args": ["-y", "zapier-discovery-mcp"],
      "env": { "ZAPIER_CLIENT_ID": "your_client_id" }
    }
  }
}
```

Optional: `ZAPIER_API_BASE` overrides the API host (testing, proxies).

## Tools

| Tool | What it does |
|------|--------------|
| `search_apps` | Search the app directory by name; popularity-ordered without a query. Returns slugs for the next step. |
| `find_zap_templates` | Popular ready-made Zap templates for one app or a pair — title, step chain (`Slack → Notion`), description, one-click create URL |

## Design notes

- **Defensive parsing.** Partner API responses are only partially documented; the client whitelists fields and handles both bare-array and enveloped responses rather than assuming shapes.
- **Testable without credentials.** The smoke test runs a local HTTP mock of the Partner API and points the server at it via `ZAPIER_API_BASE` — full end-to-end over stdio with zero secrets. Missing `ZAPIER_CLIENT_ID` produces setup instructions as a tool error, not a crash.
- HTML in titles/descriptions is stripped and truncated before it reaches the model.

Not affiliated with or endorsed by Zapier.

## Development

```bash
npm install
npm test                 # offline unit tests (mocked fetch)
npm run build            # tsc → dist/
node scripts/smoke.mjs   # end-to-end against a local Partner API mock
```

## License

MIT
