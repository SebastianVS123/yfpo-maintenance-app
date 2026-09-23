import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'maintenance-job-card',
    uptime: process.uptime()
  }, { status: 200 })
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
