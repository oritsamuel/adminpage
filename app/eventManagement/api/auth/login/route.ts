import { NextResponse } from 'next/server';

const VALID_CREDENTIALS = [
  { branchCode: 'BR001', phone: '0912345678', password: 'Admin@123', name: 'Branch BR001' },
  { branchCode: 'BR002', phone: '0923456789', password: 'Branch@202', name: 'Branch BR002' },
  { branchCode: 'BR003', phone: '0933456789', password: 'Ticket@303', name: 'Branch BR003' },
  { branchCode: 'BR004', phone: '0943456789', password: 'Event@404', name: 'Branch BR004' },
  { branchCode: 'BR005', phone: '0953456789', password: 'Access@505', name: 'Branch BR005' },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const branchCode = String(body.branchCode ?? '').trim().toUpperCase();
    const phone = String(body.phone ?? '').trim();
    const password = String(body.password ?? '').trim();

    if (!branchCode || !phone || !password) {
      return NextResponse.json(
        { success: false, message: 'All fields are required.' },
        { status: 400 }
      );
    }

    const matchedAccount = VALID_CREDENTIALS.find((account) => {
      return account.branchCode === branchCode && account.phone === phone && account.password === password;
    });

    if (!matchedAccount) {
      return NextResponse.json(
        { success: false, message: 'Invalid branch code, phone number, or password.' },
        { status: 401 }
      );
    }

    const token = `mock_token_${matchedAccount.branchCode}_${Date.now()}`;

    return NextResponse.json({
      success: true,
      token,
      user: {
        name: matchedAccount.name,
        branchCode: matchedAccount.branchCode,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
