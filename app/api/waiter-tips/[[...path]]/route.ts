import { NextResponse } from "next/server";

const API_URL = process.env.HULUBEJE_API_BASE_URL ?? "https://v7-hulubeje.cnetcommerce.com";
const BEARER_TOKEN = process.env.HULUBEJE_BEARER_TOKEN;
const LOCAL_PREFIX = "/api/waiter-tips";

function getUpstreamPath(request: Request, method: "GET" | "POST") {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(`${LOCAL_PREFIX}/`)) return null;

  const endpoint = pathname.slice(LOCAL_PREFIX.length);
  if (method === "GET" && endpoint === "/company") return endpoint;
  if (method === "POST" && /^\/companies\/\d+\/admins$/.test(endpoint)) return endpoint;
  return null;
}

async function forwardRequest(request: Request, method: "GET" | "POST") {
  const endpoint = getUpstreamPath(request, method);
  if (!endpoint) {
    return NextResponse.json({ message: "Waiter Tips endpoint not found." }, { status: 404 });
  }

  if (!BEARER_TOKEN) {
    return NextResponse.json(
      { message: "HULUBEJE_BEARER_TOKEN is not configured on the server." },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(`${API_URL}${LOCAL_PREFIX}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${BEARER_TOKEN}`,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: await request.text() } : {}),
      cache: "no-store",
    });
    const responseText = await response.text();
    let payload: unknown = null;

    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = { message: responseText };
      }
    }

    if (response.status === 404 && !responseText) {
      return NextResponse.json(
        {
          message:
            "The local proxy matched this request, but the Hulubeje API returned an empty 404 for /api/waiter-tips/company. Check that the endpoint is deployed and HULUBEJE_API_BASE_URL points to the correct API host.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to reach the Waiter Tips API." },
      { status: 502 },
    );
  }
}

export async function GET(request: Request) {
  return forwardRequest(request, "GET");
}

export async function POST(request: Request) {
  return forwardRequest(request, "POST");
}
