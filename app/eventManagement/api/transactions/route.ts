import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = 'https://v7-hulubeje.cnetcommerce.com/api/event/get_saved_event_txns?company=813804&branchId=121&event=3';
const API_KEY = process.env.HULUBEJE_API_KEY;

type RawTransaction = Record<string, unknown>;

type NormalizedTransaction = {
  id: string;
  customerName: string;
  customerContact: string;
  voucherCode: string;
  bookingDateTime: string;
  eventName: string;
  eventDateTime: string;
  eventOrganizer: string;
  paymentPhone: string;
  paymentMethod: string;
  paymentReference: string;
  quantity: number;
  totalPrice: number;
  invitedToName: string;
  invitedContact: string;
  status: string;
  ticketType: string;
};

type EventApiResponse = {
  isSuccessful?: boolean;
  data?: unknown;
  errorMessages?: string[] | null;
  additionalParameters?: unknown;
};

function buildSummary(transactions: NormalizedTransaction[]) {
  const totalRevenue = transactions.reduce((sum: number, transaction: NormalizedTransaction) => sum + (Number(transaction.totalPrice) || 0), 0);
  const totalBookings = transactions.reduce((sum: number, transaction: NormalizedTransaction) => sum + (Number(transaction.quantity) || 0), 0);
  const totalRedeemed = transactions
    .filter((transaction: NormalizedTransaction) => transaction.status === 'Redeemed')
    .reduce((sum: number, transaction: NormalizedTransaction) => sum + (Number(transaction.quantity) || 0), 0);
  const notRedeemed = totalBookings - totalRedeemed;

  return {
    totalRevenue,
    totalBookings,
    totalRedeemed,
    redeemedPercent: totalBookings > 0 ? Number(((totalRedeemed / totalBookings) * 100).toFixed(1)) : 0,
    notRedeemed,
    notRedeemedPercent: totalBookings > 0 ? Number((((totalBookings - totalRedeemed) / totalBookings) * 100).toFixed(1)) : 0,
  };
}

function normalizeTransactions(transactions: RawTransaction[]): NormalizedTransaction[] {
  return transactions.map((transaction: RawTransaction): NormalizedTransaction => ({
    id: String(transaction.id ?? transaction.txn_id ?? ''),
    customerName: String(transaction.ticketHolder ?? transaction.customerName ?? transaction.customer_name ?? transaction.name ?? ''),
    customerContact: String(transaction.ticketHolderPhone ?? transaction.customerContact ?? transaction.customer_contact ?? transaction.contact ?? ''),
    voucherCode: String(transaction.voucherCode ?? transaction.voucher_code ?? transaction.code ?? ''),
    bookingDateTime: String(transaction.bookingDateTime ?? transaction.booking_date ?? transaction.booking_datetime ?? transaction.createdDate ?? new Date().toISOString()),
    eventName: String(transaction.eventName ?? transaction.event_name ?? transaction.event ?? ''),
    eventDateTime: String(transaction.eventStartDate ?? transaction.eventDateTime ?? transaction.event_date ?? transaction.event_datetime ?? new Date().toISOString()),
    eventOrganizer: String(transaction.eventOrganizerName ?? transaction.eventOrganizer ?? transaction.organizer_name ?? transaction.organizer ?? ''),
    paymentPhone: String(transaction.paymentPhone ?? transaction.payment_phone ?? transaction.phone ?? ''),
    paymentMethod: String(transaction.paymentMethod ?? transaction.payment_method ?? 'Unknown'),
    paymentReference: String(transaction.paymentReference ?? transaction.payment_ref ?? transaction.reference ?? ''),
    quantity: Number(transaction.quantity ?? transaction.qty ?? 1),
    totalPrice: Number(transaction.totalAmount ?? transaction.totalPrice ?? transaction.total ?? transaction.price ?? 0),
    invitedToName: String(transaction.invitedToName ?? transaction.invited_name ?? ''),
    invitedContact: String(transaction.invitedContact ?? transaction.invited_contact ?? ''),
    status: String(transaction.status ?? 'Booked'),
    ticketType: String(transaction.ticketType ?? transaction.ticket_type ?? 'Regular'),
  }));
}

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json(
      { success: false, error: 'API_KEY is not configured.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Event transactions API error: ${response.status} ${response.statusText}`, errorText);
      return NextResponse.json(
        {
          success: false,
          error: `Event transactions API request failed: ${response.status} ${response.statusText}`,
        },
        { status: response.status || 502 }
      );
    }

    const payload: EventApiResponse = await response.json();

    if (!payload || typeof payload !== 'object' || typeof payload.isSuccessful !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Unexpected response format from the event transactions API.' },
        { status: 502 }
      );
    }

    if (!payload.isSuccessful) {
      const errorMessages = Array.isArray(payload.errorMessages) ? payload.errorMessages : [];
      return NextResponse.json(
        {
          success: false,
          error: errorMessages.length > 0 ? errorMessages.join(' ') : 'The event transactions API reported a failure.',
        },
        { status: 502 }
      );
    }

    const rawTransactions = Array.isArray(payload.data) ? payload.data : [];
    const normalizedTransactions = normalizeTransactions(rawTransactions as RawTransaction[]);

    return NextResponse.json({
      success: true,
      data: normalizedTransactions,
      summary: buildSummary(normalizedTransactions),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unable to retrieve transactions from the event API.';
    console.error('Failed to fetch transactions from the event API:', errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 502 }
    );
  }
}
