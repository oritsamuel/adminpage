import { NextResponse } from "next/server";
import { proxyApiRequest, withSearchParams } from "@/app/api/_utils/ugcProxy";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return proxyApiRequest({
    path: withSearchParams("/links", url.searchParams),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { isSuccessful: false, errorMessages: ["A valid JSON request body is required."] },
      { status: 400 },
    );
  }

  return proxyApiRequest({
    path: "/links",
    method: "POST",
    body,
  });
}
