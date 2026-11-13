import type { NextRequest } from "next/server";
import { service, type Res } from "@/lib/server/service.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

async function run(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  let raw = "";
  const res: Res = await service().handle({
    method: req.method,
    path,
    ip: clientIp(req),
    headers: req.headers,
    rawLength: Number(req.headers.get("content-length") || 0),
    body: async () => {
      raw = await req.text();
      return raw ? JSON.parse(raw) : null;
    },
  });

  const headers = new Headers({ "Cache-Control": "no-store", ...res.headers });
  if (res.status === 204) return new Response(null, { status: 204, headers });
  if (res.bytes) return new Response(res.bytes as BodyInit, { status: res.status, headers });
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(res.json ?? {}), { status: res.status, headers });
}

export const GET = run;
export const POST = run;
export const DELETE = run;
