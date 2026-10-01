import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = 'http://196.191.244.130:33333';
const API_KEY = '5D5EAFF4-D29A-485B-BDB9-785EF86FFFAE';

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

function buildFallbackTransactions(): NormalizedTransaction[] {
  return [
    {
      id: 'demo-1001',
      customerName: 'Marta Bekele',
      customerContact: '+251911000111',
      voucherCode: 'EVT-1001',
      bookingDateTime: '2026-09-17T09:15:00Z',
      eventName: 'City Music Night',
      eventDateTime: '2026-09-20T18:30:00Z',
      eventOrganizer: 'Addis Events Co.',
      paymentPhone: '+251911000111',
      paymentMethod: 'Telebirr',
      paymentReference: 'TB-88291',
      quantity: 2,
      totalPrice: 2200,
      invitedToName: '',
      invitedContact: '',
      status: 'Booked',
      ticketType: 'Regular',
    },
    {
      id: 'demo-1002',
      customerName: 'Samuel Worku',
      customerContact: '+251922000222',
      voucherCode: 'EVT-1002',
      bookingDateTime: '2026-09-17T12:40:00Z',
      eventName: 'Startup Expo',
      eventDateTime: '2026-09-25T10:00:00Z',
      eventOrganizer: 'Mela Hub',
      paymentPhone: '+251922000222',
      paymentMethod: 'CBE',
      paymentReference: 'CBE-44521',
      quantity: 1,
      totalPrice: 950,
      invitedToName: 'Liya Worku',
      invitedContact: '+251933000333',
      status: 'Redeemed',
      ticketType: 'VIP',
    },
    {
      id: 'demo-1003',
      customerName: 'Hana Tadesse',
      customerContact: '+251933000333',
      voucherCode: 'EVT-1003',
      bookingDateTime: '2026-09-16T15:20:00Z',
      eventName: 'Fashion Week',
      eventDateTime: '2026-09-22T19:00:00Z',
      eventOrganizer: 'Style Collective',
      paymentPhone: '+251933000333',
      paymentMethod: 'Bank Transfer',
      paymentReference: 'BT-3018',
      quantity: 3,
      totalPrice: 5100,
      invitedToName: '',
      invitedContact: '',
      status: 'Booked',
      ticketType: 'VVIP',
    },
    {
      id: 'demo-1004',
      customerName: 'Daniel Assefa',
      customerContact: '+251944000444',
      voucherCode: 'EVT-1004',
      bookingDateTime: '2026-09-15T08:00:00Z',
      eventName: 'City Music Night',
      eventDateTime: '2026-09-20T18:30:00Z',
      eventOrganizer: 'Addis Events Co.',
      paymentPhone: '+251944000444',
      paymentMethod: 'Telebirr',
      paymentReference: 'TB-99841',
      quantity: 2,
      totalPrice: 2400,
      invitedToName: '',
      invitedContact: '',
      status: 'Booked',
      ticketType: 'Regular',
    },
  ];
}

function buildSummary(transactions: NormalizedTransaction[]) {
  const eventCapacity = 200;
  const totalRevenue = transactions.reduce((sum: number, t: NormalizedTransaction) => sum + (Number(t.totalPrice) || 0), 0);
  const totalBookings = transactions.reduce((sum: number, t: NormalizedTransaction) => sum + (Number(t.quantity) || 0), 0);
  const totalRedeemed = transactions
    .filter((t: NormalizedTransaction) => t.status === 'Redeemed')
    .reduce((sum: number, t: NormalizedTransaction) => sum + (Number(t.quantity) || 0), 0);
  const notRedeemed = totalBookings - totalRedeemed;
  const remainingTickets = Math.max(0, eventCapacity - totalBookings);
  const yesterdayRevenue = 2200.0;
  const yesterdayBookings = 7;

  return {
    totalRevenue,
    revenueChangePercent: yesterdayRevenue > 0
      ? Number((((totalRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1))
      : 0,
    totalBookings,
    bookingsChangePercent: yesterdayBookings > 0
      ? Number((((totalBookings - yesterdayBookings) / yesterdayBookings) * 100).toFixed(1))
      : 0,
    totalRedeemed,
    redeemedPercent: totalBookings > 0
      ? Number(((totalRedeemed / totalBookings) * 100).toFixed(1))
      : 0,
    notRedeemed,
    notRedeemedPercent: totalBookings > 0
      ? Number((((totalBookings - totalRedeemed) / totalBookings) * 100).toFixed(1))
      : 0,
    remainingTickets,
    eventCapacity,
  };
}

export async function GET() {
  try {
    const response = await fetch(
      `${API_URL}/api/event/get_saved_event_txns?company=813804&branchId=121&event=3`,
      {
        method: 'GET',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error: ${response.status} ${response.statusText}`, errorText);
      const fallbackTransactions = buildFallbackTransactions();
      return NextResponse.json({
        success: true,
        dataSource: 'sample',
        data: fallbackTransactions,
        summary: buildSummary(fallbackTransactions),
      });
    }

    const apiData: unknown = await response.json();
    console.log('Raw API Response:', JSON.stringify(apiData, null, 2));

    let transactions: RawTransaction[] = [];

    if (Array.isArray(apiData)) {
      transactions = apiData as RawTransaction[];
    } else if (apiData && typeof apiData === 'object') {
      const apiObject = apiData as Record<string, unknown>;

      if (Array.isArray(apiObject.data)) {
        transactions = apiObject.data as RawTransaction[];
      } else if (Array.isArray(apiObject.transactions)) {
        transactions = apiObject.transactions as RawTransaction[];
      } else {
        console.warn('Unexpected API response format:', apiData);
      }
    } else {
      console.warn('Unexpected API response format:', apiData);
    }

    console.log('Parsed transactions count:', transactions.length);
    if (transactions.length > 0) {
      console.log('First transaction:', JSON.stringify(transactions[0], null, 2));
    }

    const normalizedTransactions: NormalizedTransaction[] = transactions.map((t: RawTransaction): NormalizedTransaction => ({
      id: String(t.id ?? t.txn_id ?? ''),
      customerName: String(t.ticketHolder ?? t.customerName ?? t.customer_name ?? t.name ?? ''),
      customerContact: String(t.ticketHolderPhone ?? t.customerContact ?? t.customer_contact ?? t.contact ?? ''),
      voucherCode: String(t.voucherCode ?? t.voucher_code ?? t.code ?? ''),
      bookingDateTime: String(t.bookingDateTime ?? t.booking_date ?? t.booking_datetime ?? t.createdDate ?? new Date().toISOString()),
      eventName: String(t.eventName ?? t.event_name ?? t.event ?? ''),
      eventDateTime: String(t.eventStartDate ?? t.eventDateTime ?? t.event_date ?? t.event_datetime ?? new Date().toISOString()),
      eventOrganizer: String(t.eventOrganizerName ?? t.eventOrganizer ?? t.organizer_name ?? t.organizer ?? ''),
      paymentPhone: String(t.paymentPhone ?? t.payment_phone ?? t.phone ?? ''),
      paymentMethod: String(t.paymentMethod ?? t.payment_method ?? 'Unknown'),
      paymentReference: String(t.paymentReference ?? t.payment_ref ?? t.reference ?? ''),
      quantity: Number(t.quantity ?? t.qty ?? 1),
      totalPrice: Number(t.totalAmount ?? t.totalPrice ?? t.total ?? t.price ?? 0),
      invitedToName: String(t.invitedToName ?? t.invited_name ?? ''),
      invitedContact: String(t.invitedContact ?? t.invited_contact ?? ''),
      status: String(t.status ?? 'Booked'),
      ticketType: String(t.ticketType ?? t.ticket_type ?? 'Regular'),
    }));

    console.log('Mapped transactions:', normalizedTransactions.length);

    const transactionsWithOrganizer = normalizedTransactions.map((transaction: NormalizedTransaction) => ({
      ...transaction,
      eventOrganizer: transaction.eventOrganizer || 'Unknown Organizer',
    }));

    return NextResponse.json({
      success: true,
      dataSource: 'live',
      data: transactionsWithOrganizer,
      summary: buildSummary(transactionsWithOrganizer),
    });
  } catch (error) {
    console.error('Failed to fetch transactions from API; using fallback dataset:', error);
    const fallbackTransactions = buildFallbackTransactions();
    return NextResponse.json(
      {
        success: true,
        dataSource: 'sample',
        data: fallbackTransactions,
        summary: buildSummary(fallbackTransactions),
      },
      { status: 200 }
    );
  }
}
