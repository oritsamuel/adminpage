import { NextResponse } from "next/server";
import { proxyApiRequest, withSearchParams } from "@/app/api/_utils/ugcProxy";

type RouteContext = {
  params: Promise<{ type: string; id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { type, id } = await params;
  if (!['merchant', 'staff', 'user'].includes(type)) {
    return NextResponse.json({ isSuccessful: false, errorMessages: ["Unsupported affiliate type."] }, { status: 400 });
  }

  const url = new URL(request.url);
  return proxyApiRequest({
    path: withSearchParams(`/affiliates/${type}/${id}`, url.searchParams),
  });
}
