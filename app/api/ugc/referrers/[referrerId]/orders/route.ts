import { NextResponse } from "next/server";
import { proxyApiRequest, withSearchParams } from "@/app/api/_utils/ugcProxy";

type RouteContext = {
  params: Promise<{ referrerId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { referrerId } = await params;
  if (!/^\d+$/.test(referrerId)) {
    return NextResponse.json({ isSuccessful: false, errorMessages: ["A valid referrer ID is required."] }, { status: 400 });
  }

  const url = new URL(request.url);
  return proxyApiRequest({
    path: withSearchParams(`/referrers/${referrerId}/orders`, url.searchParams),
  });
}
