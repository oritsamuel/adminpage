import { NextResponse } from "next/server";

const API_URL = "https://v7-hulubeje.cnetcommerce.com";
const API_KEY = "5D5EAFF4-D29A-485B-BDB9-785EF86FFFAE";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${API_URL}/api/auth/ugc/create`, {
      method: "POST",
      headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await response.text();
    let payload: Record<string, unknown> | null = null;

    if (text) {
      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch {
        payload = { message: text } as Record<string, unknown>;
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        payload && typeof payload === "object"
          ? payload
          : { isSuccessful: false, data: null, errorMessages: [`Upstream create referral request failed with status ${response.status}.`] },
        { status: response.status }
      );
    }

    return NextResponse.json(payload ?? { isSuccessful: true, data: null }, { status: 200 });
  } catch {
    return NextResponse.json({ isSuccessful: false, data: null, errorMessages: ["Unable to create referral link."] }, { status: 502 });
  }
}