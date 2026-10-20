# UGC API integration

UGC calls are server-side proxies to the Hulubeje Affiliate API v1. Configure
`HULUBEJE_API_BASE_URL` and `HULUBEJE_API_KEY` in the server environment; the API
key is required and must not be exposed to the browser. Every proxy uses only the
documented backend path beneath the `/api/affiliate` deployment prefix and
forwards upstream errors rather than trying alternate route spellings.

## Frontend-to-backend map

| Frontend feature | Local route | Backend contract |
| --- | --- | --- |
| UGC operational snapshot | `/api/ugc/kpis` | `GET /api/affiliate/ugc/kpis` |
| Affiliate-link list and UGC dashboard | `/api/ugc/dashboard` | `GET /api/affiliate/links` |
| Create an affiliate link | `/api/ugc/links` (`POST`) | `POST /api/affiliate/links` |
| Affiliate-link listing alias | `/api/ugc/links` (`GET`) | `GET /api/affiliate/links` |
| Affiliate profile/performance | `/api/ugc/affiliates/{type}/{id}` | `GET /api/affiliate/affiliates/{type}/{id}` |
| Invitees for an affiliate link | `/api/ugc/affiliates/{type}/{id}/invitees` | `GET /api/affiliate/affiliates/{type}/{id}/invitees` |
| Referred-order list and payment status | `/api/ugc/orders` | `GET /api/affiliate/ugc/orders` |
| Record commission payment | `/api/ugc/payments` | `POST /api/affiliate/ugc/payments` |
| Merchant registration count | `/api/ugc/merchants/{merchantId}/registrations` | `GET /api/affiliate/merchants/{merchantId}/registrations` |
| Referrer dashboard | `/api/ugc/referrers/{referrerId}/dashboard` | `GET /api/affiliate/referrers/{referrerId}/dashboard` |
| Referrer summary | `/api/ugc/referrers/{referrerId}/summary` | `GET /api/affiliate/referrers/{referrerId}/summary` |
| Orders for a user-link referrer | `/api/ugc/referrers/{referrerId}/orders` | `GET /api/affiliate/referrers/{referrerId}/orders` |

The create-link dialog loads merchant choices from `GET /api/auth/merchants`.
After a merchant is selected, its branches are loaded from
`GET /api/auth/merchants/{merchantId}/branches`. Both lookups are proxied
server-side and keep the API key out of browser requests.

| Create-link lookup | Local route | Backend route |
| --- | --- | --- |
| Merchant choices | `/api/auth/merchants` | `GET /api/auth/merchants` |
| Branches for the selected merchant | `/api/auth/merchants/{merchantId}/branches` | `GET /api/auth/merchants/{merchantId}/branches` |

The dashboard adapter translates the documented `GET /api/affiliate/links` `data.items` list
to the row shape used by the UGC page and follows its `hasNext` pagination until
all link pages are loaded. The backend only lists links with at least one
registration; a newly created link is shown locally until the list includes it.
List requests use the documented maximum page size of 100.

`GET /api/affiliate/referrers/{id}/dashboard`, `/summary`, and `/orders` are for user-link
referrers. Affiliate detail and invitee views use the
`/api/affiliate/affiliates/{type}/{id}`
endpoints for all three types. Per-order affiliate breakdowns are not documented
for merchant or staff links; the UI reports that limitation instead of making an
undocumented request.

## Contract gaps surfaced in the UI

- The contract has no affiliate-disable endpoint or status field in `GET /api/affiliate/links`.
  Disable controls and status/date filters are therefore not offered.
- Commission tiers are fixed by the contract (10%, 8%, 5%, then ineligible); no
  endpoint for changing the tiers is documented, so the commission page is
  informational and read-only.
- The contract does not document a staff-name lookup endpoint. Staff name and
  phone are entered manually when creating a staff link.
- The contract has no separate per-order breakdown for merchant or staff
  affiliate links.
- `GET /api/affiliate/links` only returns links with registrations, so creation responses may
  not appear in subsequent list responses until a registration is attributed.
- The invitee endpoint describes `total`, `activeCount`, and `expiredCount`,
  but omits page metadata in its response example despite the general pagination
  convention. The UI requests 100 rows and displays when the count indicates
  there may be more; additional rows cannot be reliably paged until the backend
  documents the response metadata.
- The referrer-orders example returns a plain `data` array, while the general
  pagination section says list endpoints are paginated. The UGC detail view
  requests up to 100 rows; pagination beyond that needs clarification in the
  backend contract.

The affiliate API contract does not cover staff lookup. Legacy direct calls to
`/api/waiter/get`, `/api/auth/ugc/create`, and `/api/auth/ugcmarkpaid` have been
removed from UGC routes; link creation and payment recording use the documented
`POST /api/affiliate/links` and `POST /api/affiliate/ugc/payments` operations instead.
