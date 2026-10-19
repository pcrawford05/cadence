import { NextRequest, NextResponse } from "next/server";
import { adminClient, isDemo } from "@/lib/supabase";
import { DemoRepo, Repo, SupabaseRepo } from "@/lib/repo";
import { sha256 } from "@/lib/crypto";
import { callTool, toolList } from "@/lib/mcp-tools";

/**
 * Minimal MCP server over Streamable HTTP (stateless, JSON responses).
 * Auth: "Authorization: Bearer <token from Settings>". Each token sees only its owner's data.
 */

type RPC = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

async function repoFor(req: NextRequest): Promise<Repo | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  if (isDemo()) return new DemoRepo();
  const admin = adminClient();
  const { data } = await admin.from("user_settings").select("user_id").eq("mcp_token_hash", sha256(token)).maybeSingle();
  return data ? new SupabaseRepo(admin, data.user_id) : null;
}

async function handle(repo: Repo, m: RPC) {
  switch (m.method) {
    case "initialize":
      return {
        protocolVersion: (m.params?.protocolVersion as string) ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "cadence", version: "0.1.0" },
        instructions: "Cadence is the user's personal networking CRM. Use list_due to see who to reach out to, and log_interaction after they talk with someone.",
      };
    case "ping":
      return {};
    case "tools/list":
      return { tools: toolList() };
    case "tools/call": {
      const name = m.params?.name as string;
      try {
        const out = await callTool(repo, name, m.params?.arguments);
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: Array.isArray(out) ? { items: out } : out };
      } catch (e) {
        return { content: [{ type: "text", text: (e as Error).message }], isError: true };
      }
    }
    default:
      throw Object.assign(new Error(`Method not found: ${m.method}`), { code: -32601 });
  }
}

export async function POST(req: NextRequest) {
  const repo = await repoFor(req);
  if (!repo) return NextResponse.json({ error: "Invalid or missing token" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  const batch: RPC[] = Array.isArray(body) ? body : [body];

  const out = [];
  for (const m of batch) {
    if (m.id === undefined || m.id === null) continue; // notification
    try {
      out.push({ jsonrpc: "2.0", id: m.id, result: await handle(repo, m) });
    } catch (e) {
      out.push({ jsonrpc: "2.0", id: m.id, error: { code: (e as { code?: number }).code ?? -32603, message: (e as Error).message } });
    }
  }
  if (out.length === 0) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? out : out[0]);
}

export async function GET() {
  return new NextResponse("Use POST (MCP Streamable HTTP)", { status: 405, headers: { Allow: "POST" } });
}
