# zapier-discovery-mcp — Design

**Date:** 2026-08-14
**Goal:** Seventh portfolio MCP server — the second of the two Zapier-adjacent
ideas: automation discovery.

## The idea

Zapier's official MCP *executes* actions. This server answers the question
that comes before: **"what could I automate?"** It searches Zapier's app
directory (9,000+ apps) and surfaces real, popular Zap templates between
chosen apps — each with a one-click creation URL. "What do people automate
between Slack and Notion?" gets a concrete, current answer instead of a
hallucinated one.

Niche verified 2026-08-14: all existing Zapier MCP work is the official
action-execution server; nothing serves directory/template discovery.

## The credential story

The Partner API requires a `client_id` (verified live: missing → 401,
bogus → "Invalid client_id"). A client_id is free for anyone with a Zapier
integration and is not a secret — it ships in client-side embed code. So
this is a **bring-your-own-client_id** server, configured via env:

- `ZAPIER_CLIENT_ID` (required) — from your Zapier integration's embed setup
- `ZAPIER_API_BASE` (optional, default `https://api.zapier.com`) — makes the
  server testable against a local mock and usable behind proxies

This is deliberately the portfolio's first credential-configured server —
the registry entry declares the environment variable properly.

## Verification without credentials

No client_id is available at build time, so:

- The client parses **defensively** (field whitelists with fallbacks for
  `objects` vs bare-array responses) rather than assuming exact shapes.
- Unit tests run against mocked `fetch` with documented response shapes.
- The smoke test starts a **local HTTP mock of the Partner API** and points
  the built server at it via `ZAPIER_API_BASE` — true end-to-end over stdio,
  zero credentials. First live run happens when the user supplies their
  client_id (360dialog has a Zapier integration).

## Tools

| Tool | Purpose |
|------|---------|
| `search_apps(query?, limit?)` | Search the app directory (popularity-ordered when no query) |
| `find_zap_templates(apps[], limit?)` | Popular Zap templates using the given app(s): title, step chain, description, one-click create URL |

## Error handling

Missing `ZAPIER_CLIENT_ID` → setup instructions as a tool error. API `errors`
arrays (invalid client_id, unknown app slug) are surfaced verbatim. Template
descriptions arrive as HTML → stripped to text and truncated.

## Out of scope (v1)

Zap creation/execution (that's Zapier MCP's job), OAuth-scoped Partner API
endpoints (user profiles, zap counts), category browsing.
