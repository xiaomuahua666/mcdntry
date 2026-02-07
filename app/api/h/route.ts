import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    now: Date.now(),
    hasDATABASE_URL: !!process.env.DATABASE_URL,
  });
}
