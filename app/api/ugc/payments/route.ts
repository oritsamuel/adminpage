import { NextResponse } from "next/server";
import { proxyApiRequest } from "@/app/api/_utils/ugcProxy";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { isSuccessful: false, errorMessages: ["A valid JSON request body is required."] },
      { status: 400 },
    );
  }

  return proxyApiRequest({
    path: "/ugc/payments",
    method: "POST",
    body: payload,
  });
}
