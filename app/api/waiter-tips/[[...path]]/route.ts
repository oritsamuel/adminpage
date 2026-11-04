import { NextResponse } from "next/server";

const API_URL = process.env.HULUBEJE_API_BASE_URL ?? "https://v7-hulubeje.cnetcommerce.com";
const BEARER_TOKEN = process.env.HULUBEJE_BEARER_TOKEN;
const LOCAL_PREFIX = "/api/waiter-tips";

function getUpstreamPath(request: Request, method: "GET" | "POST" | "PUT") {
  const { pathname, search } = new URL(request.url);
  const validPaths = [
    { method: "GET", path: LOCAL_PREFIX },
    { method: "GET", path: `${LOCAL_PREFIX}/company` },
    { method: "GET", path: `${LOCAL_PREFIX}/public` },
    { method: "POST", path: `${LOCAL_PREFIX}/company` },
    { method: "POST", path: `${LOCAL_PREFIX}/companies` },
    { method: "PUT", path: `${LOCAL_PREFIX}/companies` },
  ];

  const matches = validPaths.some(({ method: allowedMethod, path }) => pathname === path && method === allowedMethod);
  if (matches) {
    return `${pathname}${search}`;
  }

  const companyAdminMatch = /^\/api\/waiter-tips\/companies\/\d+\/admins$/.test(pathname) && (method === "GET" || method === "POST");
  const companyActiveMatch = /^\/api\/waiter-tips\/companies\/\d+\/active$/.test(pathname) && method === "PUT";
  const adminActionMatch = /^\/api\/waiter-tips\/\d+\/\d+\/(terminate|activate)$/.test(pathname) && (method === "POST" || method === "PUT");

  if (companyAdminMatch || companyActiveMatch || adminActionMatch) {
    return `${pathname}${search}`;
  }

  return null;
}

async function forwardRequest(request: Request, method: "GET" | "POST" | "PUT") {
  const upstreamUrl = getUpstreamPath(request, method);
  if (!upstreamUrl) {
    return NextResponse.json({ message: "Waiter Tips endpoint not found." }, { status: 404 });
  }

  if (!BEARER_TOKEN) {
    return NextResponse.json(
      { message: "HULUBEJE_BEARER_TOKEN is not configured on the server." },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(`${API_URL}${upstreamUrl}`, {
      method,
      headers: {
        Authorization: `Bearer ${BEARER_TOKEN}`,
        ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method !== "GET" ? { body: await request.text() } : {}),
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
            "The local proxy matched this request, but the Hulubeje API returned an empty 404 for /api/waiter-tips. Check that the endpoint is deployed and HULUBEJE_API_BASE_URL points to the correct API host.",
        },
        { status: 404 },
      );
    }

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
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

export async function PUT(request: Request) {
  return forwardRequest(request, "PUT");
}
