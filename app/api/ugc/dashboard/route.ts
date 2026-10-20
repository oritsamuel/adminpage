import { NextResponse } from "next/server";
import { proxyApiRequest, withSearchParams } from "@/app/api/_utils/ugcProxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const response = await proxyApiRequest({
    path: withSearchParams("/links", url.searchParams),
  });

  const payload = await response.json() as { isSuccessful?: boolean; data?: unknown; [key: string]: unknown };
  if (!response.ok || payload.isSuccessful === false) {
    return NextResponse.json(payload, { status: response.status });
  }
  const pageData = payload?.data;
  const items = pageData && typeof pageData === "object" && "items" in pageData
    ? (pageData as { items?: unknown }).items
    : null;

  if (!Array.isArray(items)) {
    return NextResponse.json(
      { isSuccessful: false, errorMessages: ["The /links endpoint returned an unexpected response."] },
      { status: 502 },
    );
  }

  const records = items.map((value) => {
    const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const link = item.link;
    const linkUrl = typeof link === "string" ? new URL(link, "https://hulubeje.invalid") : null;
    const code = linkUrl?.searchParams.get("ref") ?? "";

    return {
      id: item.ownerId,
      name: item.ownerName,
      phone: item.ownerPhone,
      affiliateType: item.type,
      merchantId: item.merchantId,
      merchant: item.merchantName,
      branchId: item.branchId,
      branch: item.branchName,
      referrals: item.registrations,
      code,
      affiliateLink: link,
    };
  });

  const pagination = pageData as {
    page?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
    hasNext?: boolean;
  };

  return NextResponse.json({
    ...payload,
    data: records,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalCount: pagination.totalCount,
      totalPages: pagination.totalPages,
      hasNext: pagination.hasNext,
    },
  }, { status: response.status });
}
