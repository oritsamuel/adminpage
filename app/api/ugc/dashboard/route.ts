import { NextResponse } from "next/server";

const API_URL = "https://v7-hulubeje.cnetcommerce.com";
const API_KEY = "5D5EAFF4-D29A-485B-BDB9-785EF86FFFAE";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/auth/ugcdashboard`, {
      headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
      cache: "no-store",
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ isSuccessful: false, data: [], errorMessages: ["Unable to load UGC dashboard."] }, { status: 502 });
  }
}
