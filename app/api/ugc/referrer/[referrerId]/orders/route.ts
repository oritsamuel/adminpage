import { NextResponse } from "next/server";

const API_URL = "https://v7-hulubeje.cnetcommerce.com";
const API_KEY = "5D5EAFF4-D29A-485B-BDB9-785EF86FFFAE";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ referrerId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { referrerId } = await params;
  if (!/^\d+$/.test(referrerId)) {
    return NextResponse.json({ isSuccessful: false, errorMessages: ["A valid referrer ID is required."] }, { status: 400 });
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/ugc/referrer/${referrerId}/orders`, {
      headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
      cache: "no-store",
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ isSuccessful: false, data: [], errorMessages: ["Unable to load referrer orders."] }, { status: 502 });
  }
}
