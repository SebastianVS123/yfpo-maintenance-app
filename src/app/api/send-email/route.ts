import { NextRequest, NextResponse } from 'next/server'
import { sendJobAssignmentEmail, sendJobCompletionEmail, sendOverdueEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type } = body

    console.log(`[EMAIL API] Received ${type} request for job ${body.jobId}`)

    if (type === 'assignment') {
      // Check config
      const provider = process.env.EMAIL_PROVIDER || (process.env.GMAIL_USER ? 'gmail' : 'resend')
      const hasGmail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
      const hasResendKey = !!process.env.RESEND_API_KEY
      console.log(`[EMAIL API] Config - Provider: ${provider}, Gmail: ${hasGmail}, Resend: ${hasResendKey}, To: ${body.assignees?.map((a:any)=>a.email).join(', ')} + issuer ${body.createdByEmail}`)

      const result = await sendJobAssignmentEmail({
        jobId: body.jobId,
        title: body.title,
        location: body.location,
        observedAt: body.observedAt,
        requiredActions: body.requiredActions,
        departments: body.departments,
        priority: body.priority,
        photos: body.photos,
        createdByName: body.createdByName,
        createdByEmail: body.createdByEmail,
        assignees: body.assignees, // now includes outstandingJobs per assignee
        dueDate: body.dueDate,
        appUrl: body.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        issuerOutstandingJobs: body.issuerOutstandingJobs
      })
      console.log(`[EMAIL API] Assignment result:`, JSON.stringify(result).slice(0,500))
      return NextResponse.json(result)
    }

    if (type === 'completion') {
      const result = await sendJobCompletionEmail({
        jobId: body.jobId,
        title: body.title,
        location: body.location,
        completedBy: body.completedBy,
        completedByEmail: body.completedByEmail,
        completionPhoto: body.completionPhoto,
        finalNotes: body.finalNotes,
        createdByEmail: body.createdByEmail,
        appUrl: body.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        startedAt: body.startedAt,
        completedAt: body.completedAt
      })
      return NextResponse.json(result)
    }

    if (type === 'overdue') {
      const result = await sendOverdueEmail({
        jobId: body.jobId,
        title: body.title,
        location: body.location,
        priority: body.priority,
        assignees: body.assignees,
        createdByEmail: body.createdByEmail,
        dueDate: body.dueDate,
        estimatedTime: body.estimatedTime,
        startedAt: body.startedAt,
        appUrl: body.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      })
      return NextResponse.json(result)
    }

    if (type === 'test') {
      // Test email endpoint
      const hasKey = !!process.env.RESEND_API_KEY
      return NextResponse.json({ 
        hasResendKey: hasKey, 
        fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
        message: hasKey ? 'Resend configured' : 'Missing RESEND_API_KEY - emails mocked'
      })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    console.error('Email API error:', error)
    return NextResponse.json({ error: error.message, success: false }, { status: 500 })
  }
}

export async function GET() {
  const hasGmail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  const hasResend = !!process.env.RESEND_API_KEY
  const provider = process.env.EMAIL_PROVIDER || (hasGmail ? 'gmail' : 'resend')
  const fromEmail = provider === 'gmail' ? (process.env.GMAIL_USER || 'not set') : (process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev')
  const configured = provider === 'gmail' ? hasGmail : hasResend
  return NextResponse.json({
    configured,
    provider,
    fromEmail,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'not set',
    hasGmailUser: !!process.env.GMAIL_USER,
    hasGmailPass: !!process.env.GMAIL_APP_PASSWORD,
    hasResendKey: hasResend,
    warning: provider === 'resend' && fromEmail.includes('onboarding@resend.dev') ? 'Using onboarding@resend.dev - Resend free tier only sends to your verified email. Add domain to send to all.' : null,
    message: configured ? `Email system ready via ${provider} ✅` : 'Missing email config - add GMAIL_USER + GMAIL_APP_PASSWORD with EMAIL_PROVIDER=gmail in Render env vars.'
  })
}
