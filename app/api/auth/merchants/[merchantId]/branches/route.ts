import { proxyApiRequest } from "@/app/api/_utils/ugcProxy";

type RouteContext = {
  params: Promise<{ merchantId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { merchantId } = await params;
  if (!/^\d+$/.test(merchantId)) {
    return Response.json(
      { isSuccessful: false, errorMessages: ["A valid merchant ID is required."] },
      { status: 400 },
    );
  }

  return proxyApiRequest({
    path: `/api/auth/merchants/${merchantId}/branches`,
    affiliateApiPrefix: false,
  });
}
