import { proxyApiRequest, withSearchParams } from "@/app/api/_utils/ugcProxy";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return proxyApiRequest({
    path: withSearchParams("/ugc/kpis", url.searchParams),
  });
}
