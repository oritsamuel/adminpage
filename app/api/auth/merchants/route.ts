import { proxyApiRequest } from "@/app/api/_utils/ugcProxy";

export async function GET() {
  return proxyApiRequest({
    path: "/api/auth/merchants",
    affiliateApiPrefix: false,
  });
}
