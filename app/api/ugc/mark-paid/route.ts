import { NextResponse } from "next/server";

const API_URL = "http://196.191.244.130:33333";
const API_KEY = "5D5EAFF4-D29A-485B-BDB9-785EF86FFFAE";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${API_URL}/api/auth/ugcmarkpaid`, {
      method: "POST",
      headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    console.info("[UGC mark-paid] Upstream response", { response, payload });
    return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ isSuccessful: false, data: 0, errorMessages: ["Unable to mark payment as paid."] }, { status: 502 });
  }
}
