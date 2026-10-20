import { NextResponse } from "next/server";
import { proxyApiRequest, withSearchParams } from "@/app/api/_utils/ugcProxy";

type RouteContext = {
  params: Promise<{ merchantId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { merchantId } = await params;
  if (!/^\d+$/.test(merchantId)) {
    return NextResponse.json({ isSuccessful: false, errorMessages: ["A valid merchant ID is required."] }, { status: 400 });
  }

  const url = new URL(request.url);
  return proxyApiRequest({
    path: withSearchParams(`/merchants/${merchantId}/registrations`, url.searchParams),
  });
}
