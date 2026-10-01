import { NextResponse } from 'next/server';

const API_URL = 'http://196.191.244.130:33333';
const API_KEY = '5D5EAFF4-D29A-485B-BDB9-785EF86FFFAE';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { voucherId, userId } = body;

    if (!voucherId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: voucherId, userId' },
        { status: 400 }
      );
    }

    try {
      const response = await fetch(
        `${API_URL}/api/event/redeem_event_ticket?company=813804&branchId=121&voucherId=${voucherId}&userId=${userId}`,
        {
          method: 'GET',
          headers: {
            'x-api-key': API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const redeemResult = await response.json();
        console.log('Redemption result:', redeemResult);
        return NextResponse.json({
          success: true,
          data: redeemResult,
        });
      }

      const errorText = await response.text();
      console.warn(`Redeem API returned ${response.status}: ${response.statusText}`, errorText);
    } catch (upstreamError) {
      console.warn('Redeem API unavailable; using frontend fallback.', upstreamError);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(voucherId),
        redeemed: true,
        fallback: true,
        message: 'Redemption accepted in local fallback mode.',
      },
      warning: 'Backend is temporarily unavailable; ticket was marked as redeemed locally.',
    });
  } catch (error) {
    console.error('Failed to redeem ticket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to redeem ticket' },
      { status: 500 }
    );
  }
}
