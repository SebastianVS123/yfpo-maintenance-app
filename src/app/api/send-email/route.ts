import { NextRequest, NextResponse } from 'next/server'
import { sendJobAssignmentEmail, sendJobCompletionEmail, sendOverdueEmail, diagGmailSmtp } from '@/lib/email'

function getStatus() {
  const hasBrevo = !!process.env.BREVO_API_KEY
  const hasGmail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  const hasResend = !!process.env.RESEND_API_KEY
  const explicit = (process.env.EMAIL_PROVIDER || '').toLowerCase()
  const provider = explicit === 'brevo' || explicit === 'gmail' || explicit === 'resend'
    ? explicit
    : hasBrevo ? 'brevo' : hasGmail ? 'gmail' : 'resend'
  const fromEmail = provider === 'brevo'
    ? (process.env.BREVO_SENDER || process.env.GMAIL_USER || 'yfpo.maintenance@gmail.com')
    : provider === 'gmail' ? (process.env.GMAIL_USER || 'not set') : (process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev')
  const configured = provider === 'brevo' ? hasBrevo : provider === 'gmail' ? hasGmail : hasResend
  return { provider, fromEmail, configured, hasBrevo, hasGmailUser: !!process.env.GMAIL_USER, hasGmailPass: !!process.env.GMAIL_APP_PASSWORD, hasResendKey: hasResend }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type } = body

    console.log(`[EMAIL API] Received ${type} request for job ${body.jobId}`)

    if (type === 'assignment') {
      const s = getStatus()
      console.log(`[EMAIL API] Config - Provider: ${s.provider}, Brevo: ${s.hasBrevo}, Gmail: ${s.hasGmailUser && s.hasGmailPass}, Resend: ${s.hasResendKey}, To: ${body.assignees?.map((a:any)=>a.email).join(', ')} + issuer ${body.createdByEmail}`)

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

    if (type === 'diag-smtp') {
      // Test if this server can reach Gmail SMTP (Render blocks port 465)
      const result = await diagGmailSmtp()
      return NextResponse.json({ smtp: result.ok ? 'ok' : 'blocked', ...result })
    }

    if (type === 'test') {
      const s = getStatus()
      return NextResponse.json({
        ...s,
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
        message: s.configured ? `Email ready via ${s.provider}` : 'Missing email config - add BREVO_API_KEY (recommended) or GMAIL_USER + GMAIL_APP_PASSWORD'
      })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    console.error('Email API error:', error)
    return NextResponse.json({ error: error.message, success: false }, { status: 500 })
  }
}

export async function GET() {
  const s = getStatus()
  return NextResponse.json({
    configured: s.configured,
    provider: s.provider,
    fromEmail: s.fromEmail,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'not set',
    hasBrevo: s.hasBrevo,
    hasGmailUser: s.hasGmailUser,
    hasGmailPass: s.hasGmailPass,
    hasResendKey: s.hasResendKey,
    warning: s.provider === 'resend' && s.fromEmail.includes('onboarding@resend.dev') ? 'Using onboarding@resend.dev - Resend free tier only sends to your verified email. Add domain to send to all.' : null,
    message: s.configured ? `Email system ready via ${s.provider} ✅` : 'Missing email config - add BREVO_API_KEY (recommended, works on Render) in Render env vars.'
  })
}
