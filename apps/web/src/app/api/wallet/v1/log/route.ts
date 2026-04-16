import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body.logs)) {
      body.logs.forEach((log: any) => console.log('[Apple Wallet Log]', log));
    } else {
      console.log('[Apple Wallet Log]', body);
    }
  } catch {}
  return new NextResponse(null, { status: 200 });
}
