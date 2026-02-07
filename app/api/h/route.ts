
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    now: Date.now(),
    hasMK_API: !!process.env.MK_API,
    hasMK_TK: !!process.env.MK_TK,
  });
}
