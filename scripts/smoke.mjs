// Self-contained smoke test: starts a local HTTP mock of the Zapier Partner
// API, points the built server at it via ZAPIER_API_BASE, and drives all
// tools over stdio. No credentials, no network beyond localhost.
// Usage: npm run build && node scripts/smoke.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createServer } from "node:http";

const mock = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.searchParams.get("client_id") !== "smoke-id") {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ errors: ["Invalid `client_id`"] }));
  }
  if (url.pathname === "/v1/apps") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        objects: [
          { title: "Slack", slug: "slack", description: "<p>Team chat</p>", url: "https://zapier.com/apps/slack", categories: [{ slug: "team-chat" }] },
          { title: "Notion", slug: "notion", description: "<p>Docs &amp; wikis</p>", url: "https://zapier.com/apps/notion", categories: [{ slug: "docs" }] },
        ],
      }),
    );
  }
  if (url.pathname === "/v1/zap-templates") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify([
        {
          title: "Save new <em>Slack</em> saved messages to Notion databases",
          description: "<p>Never lose a good idea again.</p>",
          steps: [{ title: "Slack" }, { title: "Notion" }],
          create_url: "https://zapier.com/webintent/create-zap?template=12345",
          url: "https://zapier.com/apps/slack/integrations/notion/12345",
        },
      ]),
    );
  }
  res.writeHead(404);
  res.end("{}");
});

await new Promise((r) => mock.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${mock.address().port}`;

const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: ["dist/index.js"],
    env: { ...process.env, ZAPIER_API_BASE: base, ZAPIER_CLIENT_ID: "smoke-id" },
  }),
);

const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(", "));

for (const [name, args] of [
  ["search_apps", { query: "slack" }],
  ["find_zap_templates", { apps: ["slack", "notion"], limit: 5 }],
]) {
  const res = await client.callTool({ name, arguments: args });
  console.log(`\n== ${name} ${res.isError ? "(isError)" : ""}\n${res.content[0].text.slice(0, 600)}`);
}
await client.close();

// Second server without a client_id: must return setup guidance, not crash.
const bare = new Client({ name: "smoke2", version: "0.0.0" });
const env2 = { ...process.env, ZAPIER_API_BASE: base };
delete env2.ZAPIER_CLIENT_ID;
await bare.connect(new StdioClientTransport({ command: process.execPath, args: ["dist/index.js"], env: env2 }));
const res = await bare.callTool({ name: "search_apps", arguments: {} });
console.log(`\n== search_apps without client_id ${res.isError ? "(isError)" : ""}\n${res.content[0].text.slice(0, 200)}`);
await bare.close();

mock.close();
console.log("\nSMOKE OK");
