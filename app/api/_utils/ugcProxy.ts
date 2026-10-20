import { NextResponse } from "next/server";

export const API_URL = process.env.HULUBEJE_API_BASE_URL ?? "https://v7-hulubeje.cnetcommerce.com";
const AFFILIATE_API_PREFIX = "/api/affiliate";
const API_KEY = process.env.HULUBEJE_API_KEY;

export function withSearchParams(path: string, searchParams?: URLSearchParams) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!searchParams || searchParams.size === 0) {
    return normalizedPath;
  }
  return `${normalizedPath}?${searchParams.toString()}`;
}

export async function proxyApiRequest({
  path,
  method = "GET",
  body,
  affiliateApiPrefix = true,
}: {
  path: string;
  method?: string;
  body?: unknown;
  affiliateApiPrefix?: boolean;
}) {
  if (!API_KEY) {
    return NextResponse.json(
      { isSuccessful: false, errorMessages: ["Hulubeje API credentials are not configured."] },
      { status: 500 },
    );
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const upstreamPath = !affiliateApiPrefix || normalizedPath.startsWith(`${AFFILIATE_API_PREFIX}/`)
    ? normalizedPath
    : `${AFFILIATE_API_PREFIX}${normalizedPath}`;

  try {
    const requestInit: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      cache: "no-store",
    };

    if (body !== undefined && method.toUpperCase() !== "GET") {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(new URL(upstreamPath, `${API_URL.replace(/\/+$/, "")}/`), requestInit);
    const text = await response.text();
    let payload: unknown;

    try {
      if (!text) throw new Error("The Hulubeje API returned an empty response.");
      payload = JSON.parse(text);
    } catch (error) {
      return NextResponse.json(
        {
          isSuccessful: false,
          errorMessages: [error instanceof Error ? error.message : "The Hulubeje API returned an invalid response."],
        },
        { status: response.ok ? 502 : response.status },
      );
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        isSuccessful: false,
        errorMessages: [error instanceof Error ? error.message : "Unable to complete the UGC request."],
      },
      { status: 502 },
    );
  }
}
