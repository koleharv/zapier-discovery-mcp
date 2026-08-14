import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findZapTemplates, itemsOf, searchApps, shapeApp, shapeTemplate, stripHtml } from "../src/zapier.js";

beforeEach(() => {
  process.env.ZAPIER_CLIENT_ID = "test-client";
  delete process.env.ZAPIER_API_BASE;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ZAPIER_CLIENT_ID;
});

describe("itemsOf", () => {
  it("handles bare arrays and known envelopes", () => {
    expect(itemsOf([1, 2])).toEqual([1, 2]);
    expect(itemsOf({ objects: [3] })).toEqual([3]);
    expect(itemsOf({ results: [4] })).toEqual([4]);
    expect(itemsOf({ nonsense: true })).toEqual([]);
  });
});

describe("stripHtml", () => {
  it("strips tags and entities", () => {
    expect(stripHtml("<p>Save <b>Slack</b> messages &amp; more</p>")).toBe("Save Slack messages & more");
  });
});

describe("shaping", () => {
  it("shapes apps defensively across field variants", () => {
    expect(shapeApp({ title: "Slack", slug: "slack", description: "<p>Chat</p>", categories: [{ slug: "team-chat" }] }))
      .toEqual({ title: "Slack", slug: "slack", description: "Chat", url: undefined, categories: ["team-chat"] });
    expect(shapeApp({ title: "X", key: "x-app", categories: ["misc"] }).slug).toBe("x-app");
  });

  it("shapes templates into step chains", () => {
    const t = shapeTemplate({
      title: "Save new <em>Slack</em> messages to Notion",
      description: "<p>Long&nbsp;desc</p>",
      steps: [{ title: "Slack" }, { title: "Notion" }],
      create_url: "https://zapier.com/webintent/create-zap?template=1",
    });
    expect(t.title).toBe("Save new Slack messages to Notion");
    expect(t.chain).toBe("Slack → Notion");
    expect(t.description).toBe("Long desc");
  });
});

describe("API calls", () => {
  it("builds the apps request with client_id and title_search", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ objects: [{ title: "Notion", slug: "notion" }] }) });
    vi.stubGlobal("fetch", fetchMock);
    const apps = await searchApps("notion", 5);
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.origin + url.pathname).toBe("https://api.zapier.com/v1/apps");
    expect(url.searchParams.get("client_id")).toBe("test-client");
    expect(url.searchParams.get("title_search")).toBe("notion");
    expect(apps).toEqual([{ title: "Notion", slug: "notion", description: undefined, url: undefined, categories: undefined }]);
  });

  it("builds the zap-templates request with comma-joined apps", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ title: "T", steps: [{ title: "A" }, { title: "B" }] }] });
    vi.stubGlobal("fetch", fetchMock);
    const templates = await findZapTemplates(["slack", "notion"], 3);
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.pathname).toBe("/v1/zap-templates");
    expect(url.searchParams.get("apps")).toBe("slack,notion");
    expect(templates[0].chain).toBe("A → B");
  });

  it("respects the ZAPIER_API_BASE override", async () => {
    process.env.ZAPIER_API_BASE = "http://127.0.0.1:9999/";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    await searchApps(undefined, 2);
    expect((fetchMock.mock.calls[0][0] as URL).origin).toBe("http://127.0.0.1:9999");
  });

  it("surfaces the API's own error messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ errors: ["Invalid `client_id`"] }) }));
    await expect(searchApps("x", 1)).rejects.toThrow(/Invalid `client_id`/);
  });

  it("gives setup instructions when ZAPIER_CLIENT_ID is missing", async () => {
    delete process.env.ZAPIER_CLIENT_ID;
    await expect(searchApps("x", 1)).rejects.toThrow(/ZAPIER_CLIENT_ID is not set/);
  });
});
