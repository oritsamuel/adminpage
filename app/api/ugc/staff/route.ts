import { NextResponse } from "next/server";

const API_URL = "https://v7-hulubeje.cnetcommerce.com";
const API_KEY = process.env.HULUBEJE_API_KEY;
const BEARER_TOKEN = process.env.HULUBEJE_BEARER_TOKEN;

function findName(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const firstName = [record.firstName, record.first_name].find((candidate) => typeof candidate === "string" && !!candidate.trim());
  const lastName = [record.lastName, record.last_name].find((candidate) => typeof candidate === "string" && !!candidate.trim());
  if (typeof firstName === "string" || typeof lastName === "string") {
    return [firstName, lastName].filter((candidate): candidate is string => typeof candidate === "string").join(" ");
  }

  const directName = [
    record.name,
    record.fullName,
    record.fullname,
    record.staffName,
    record.staffFullName,
    record.waiterName,
    record.waiterFullName,
    record.employeeName,
    record.userName,
  ]
    .find((candidate) => typeof candidate === "string" && !!candidate.trim());
  if (typeof directName === "string") return directName.trim();

  for (const nestedValue of Object.values(record)) {
    const nestedName = findName(nestedValue);
    if (nestedName) return nestedName;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const nestedName = findName(item);
      if (nestedName) return nestedName;
    }
  }
  return "";
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const phoneNumber = (params.get("phoneNumber") ?? params.get("phone"))?.trim();
  const companyId = params.get("companyId")?.trim();
  if (!phoneNumber) {
    return NextResponse.json({ isSuccessful: false, errorMessages: ["Enter a staff phone number."] }, { status: 400 });
  }
  if (!companyId || !/^\d+$/.test(companyId)) {
    return NextResponse.json({ isSuccessful: false, errorMessages: ["Enter a valid company ID."] }, { status: 400 });
  }
  if (!API_KEY || !BEARER_TOKEN) {
    return NextResponse.json({ isSuccessful: false, errorMessages: ["Hulubeje credentials are not configured."] }, { status: 500 });
  }

  try {
    const query = new URLSearchParams({ phoneNumber, companyId });
    const response = await fetch(`${API_URL}/api/waiter/get?${query}`, {
      headers: {
        "x-api-key": API_KEY,
        Authorization: `Bearer ${BEARER_TOKEN}`,
      },
      cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);
    const name = findName(payload);
    if (!response.ok) {
      return NextResponse.json({ isSuccessful: false, errorMessages: ["Hulubeje staff lookup failed."] }, { status: 502 });
    }
    if (!name) {
      return NextResponse.json({ isSuccessful: false, errorMessages: ["No staff member was found for that phone number."] }, { status: response.ok ? 404 : response.status });
    }
    return NextResponse.json({ isSuccessful: true, name });
  } catch {
    return NextResponse.json({ isSuccessful: false, errorMessages: ["Unable to look up the staff member."] }, { status: 502 });
  }
}
