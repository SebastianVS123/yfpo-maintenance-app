import { Resend } from 'resend'
import nodemailer from 'nodemailer'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Gmail transporter - used when EMAIL_PROVIDER=gmail
function getGmailTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return null
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

interface OutstandingJob {
  id: string
  title: string
  location: string
  priority: string
  status: string
  due_date?: any
}

interface JobEmailData {
  jobId: string
  title: string
  location: string
  observedAt: string | Date
  requiredActions: string
  departments: string[]
  priority: string
  photos?: string[]
  createdByName: string
  createdByEmail: string
  assignees: { name: string; email: string; outstandingJobs?: OutstandingJob[] }[]
  dueDate?: string | Date | null
  appUrl: string
  issuerOutstandingJobs?: OutstandingJob[]
}

const priorityMap: Record<string, { label: string; color: string; bg: string; bgLight: string; border: string; emoji: string }> = {
  low: { label: 'LOW', color: '#ffffff', bg: '#16a34a', bgLight: '#f0fdf4', border: '#16a34a', emoji: '🟢' },
  medium: { label: 'MEDIUM', color: '#000000', bg: '#facc15', bgLight: '#fefce8', border: '#eab308', emoji: '🟡' },
  high: { label: 'HIGH', color: '#ffffff', bg: '#ea580c', bgLight: '#fff7ed', border: '#ea580c', emoji: '🟠' },
  critical: { label: 'CRITICAL', color: '#ffffff', bg: '#dc2626', bgLight: '#fef2f2', border: '#dc2626', emoji: '🔴' },
}

const deptColors: Record<string, string> = {
  Quality: '#8b5cf6',
  Safety: '#dc2626',
  Logistics: '#2563eb',
  Production: '#ea580c',
  Management: '#000000',
  Maintenance: '#16a34a',
}

const formatDate = (d: any) => {
  if (!d) return 'N/A'
  const date = d.toDate ? d.toDate() : new Date(d)
  return date.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
}

// Unified send function - tries Gmail first, then Resend
async function sendEmail(to: string, subject: string, html: string) {
  const provider = process.env.EMAIL_PROVIDER || (process.env.GMAIL_USER ? 'gmail' : 'resend')
  
  if (provider === 'gmail') {
    const transporter = getGmailTransporter()
    if (!transporter) throw new Error('Gmail not configured - missing GMAIL_USER or GMAIL_APP_PASSWORD')
    const from = process.env.GMAIL_USER!
    const result = await transporter.sendMail({ from: `YFPO Maintenance <${from}>`, to, subject, html })
    return { provider: 'gmail', result }
  } else {
    if (!resend) throw new Error('Resend not configured - missing RESEND_API_KEY')
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const result = await resend.emails.send({ from: `YFPO Maintenance <${fromEmail}>`, to, subject, html })
    return { provider: 'resend', result }
  }
}

export async function sendJobAssignmentEmail(data: JobEmailData) {
  const hasGmail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  const hasResend = !!process.env.RESEND_API_KEY
  if (!hasGmail && !hasResend) {
    console.log('[EMAIL MOCK] No provider configured. Would send to:', data.assignees.map(a => a.email), 'issuer', data.createdByEmail)
    return { success: true, mocked: true, reason: 'No email provider configured - add GMAIL_USER + GMAIL_APP_PASSWORD or RESEND_API_KEY' }
  }

  const priorityConfig = priorityMap[data.priority] || { label: data.priority.toUpperCase(), color: '#fff', bg: '#6b7280', bgLight: '#f3f4f6', border: '#6b7280', emoji: '⚪' }
  const jobLink = `${data.appUrl}/jobs/${data.jobId}`
  const deptBadges = data.departments.map(dept => {
    const color = deptColors[dept] || '#6b7280'
    return `<span style="display:inline-block; background:${color}; color:white; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:bold; margin:2px;">${dept}</span>`
  }).join(' ')
  const photosHtml = data.photos && data.photos.length > 0 
    ? `<div style="margin:16px 0;"><p style="font-weight:bold; color:#374151; margin-bottom:8px;">📸 Issue Photos (${data.photos.length}):</p><div>${data.photos.map((url, i) => `<a href="${url}" style="color:${priorityConfig.border}; font-size:12px;">Photo ${i+1}</a>`).join(' | ')}</div></div>` 
    : ''

  const allResults: any[] = []
  let hasError = false

  // 1. SEND TO EACH ASSIGNEE
  for (const assignee of data.assignees) {
    const outstanding = assignee.outstandingJobs || []
    const otherJobs = outstanding.filter(j => j.id !== data.jobId)
    
    const outstandingHtml = otherJobs.length > 0 ? `
      <div style="background:#fffbeb; border:1px solid #fcd34d; border-left:4px solid #f59e0b; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
        <h3 style="margin:0 0 10px 0; color:#92400e; font-size:13px; font-weight:800;">📋 YOUR OUTSTANDING JOBS (${otherJobs.length} other):</h3>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          ${otherJobs.map(j => {
            const p = priorityMap[j.priority] || priorityMap['medium']
            return `<tr style="border-bottom:1px solid #fde68a;"><td style="padding:8px 4px;"><span style="background:${p.bg}; color:${p.color}; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:bold;">${p.label}</span></td><td style="padding:8px 4px; font-weight:600;">${j.title}</td><td style="padding:8px 4px;">${j.location}</td><td style="padding:8px 4px;"><a href="${data.appUrl}/jobs/${j.id}" style="color:#d97706;">View</a></td></tr>`
          }).join('')}
        </table>
        <p style="margin:8px 0 0 0; font-size:11px;"><a href="${data.appUrl}/operator" style="color:#92400e; font-weight:bold;">Go to Dashboard → See all ${outstanding.length} jobs</a></p>
      </div>
    ` : ''

    const assigneeHtml = `
    <!DOCTYPE html><html><body style="margin:0; padding:0; background:#f4f4f5; font-family: -apple-system, sans-serif;">
    <div style="max-width:640px; margin:0 auto; padding:20px;">
      <div style="background:white; border-radius:16px; overflow:hidden; border:1px solid #e4e4e7;">
        <div style="background:${priorityConfig.bg}; color:${priorityConfig.color}; padding:24px; text-align:center;">
          <div style="font-size:11px; letter-spacing:2px; opacity:0.9; margin-bottom:6px;">JOB ASSIGNED TO YOU</div>
          <h1 style="margin:0; font-size:20px; font-weight:800;">${priorityConfig.emoji} NEW JOB: ${data.title}</h1>
          <div style="margin-top:14px; display:inline-block; background:white; color:${priorityConfig.bg}; padding:8px 22px; border-radius:20px; font-weight:900; font-size:14px;">PRIORITY: ${priorityConfig.label}</div>
        </div>
        <div style="padding:24px;">
          <p style="font-size:12px; color:#71717a;">Hi ${assignee.name}, assigned by ${data.createdByName}</p>
          <h2 style="font-size:16px; margin:8px 0;">${data.title}</h2>
          <table style="width:100%; background:#fafafa; border-radius:12px; overflow:hidden; font-size:12px; border-collapse:collapse;">
            <tr><td style="padding:8px 12px; background:#f4f4f5; font-weight:600;">📍 LOCATION</td><td style="padding:8px 12px; font-weight:600;">${data.location}</td></tr>
            <tr><td style="padding:8px 12px; background:#f4f4f5; font-weight:600;">👁️ OBSERVED</td><td style="padding:8px 12px;">${formatDate(data.observedAt)}</td></tr>
            <tr><td style="padding:8px 12px; background:#f4f4f5; font-weight:600;">👤 ISSUED BY</td><td style="padding:8px 12px;"><strong>${data.createdByName}</strong> (${data.createdByEmail})</td></tr>
            <tr><td style="padding:8px 12px; background:#f4f4f5; font-weight:600;">🏢 DEPTS</td><td style="padding:8px 12px;">${deptBadges}</td></tr>
            ${data.dueDate ? `<tr style="background:${priorityConfig.bgLight};"><td style="padding:8px 12px; font-weight:700; color:${priorityConfig.border};">⏰ DUE</td><td style="padding:8px 12px; font-weight:700; color:${priorityConfig.border};">${formatDate(data.dueDate)}</td></tr>` : ''}
          </table>
          <div style="background:${priorityConfig.bgLight}; border-left:4px solid ${priorityConfig.border}; padding:14px; margin:16px 0; border-radius:0 8px 8px 0;">
            <h4 style="margin:0 0 6px 0; font-size:11px; color:${priorityConfig.border};">⚙️ WHAT TO DO:</h4>
            <p style="margin:0; white-space:pre-wrap; font-size:13px; line-height:1.5;">${data.requiredActions}</p>
          </div>
          ${photosHtml}
          ${outstandingHtml}
          <div style="text-align:center; margin:20px 0;"><a href="${jobLink}" style="display:inline-block; background:${priorityConfig.bg}; color:${priorityConfig.color}; padding:12px 24px; text-decoration:none; border-radius:10px; font-weight:800;">🔗 VIEW & START JOB →</a></div>
          <p style="font-size:10px; color:#a1a1aa; text-align:center;">YFPO Maintenance • ${data.jobId.slice(0,8).toUpperCase()} • <a href="${jobLink}">${jobLink}</a></p>
        </div>
      </div>
    </div></body></html>
    `

    try {
      const result = await sendEmail(assignee.email, `${priorityConfig.emoji} [${priorityConfig.label}] Assigned: ${data.title} - ${data.location}`, assigneeHtml)
      allResults.push({ to: assignee.email, success: true, result })
    } catch (err: any) {
      allResults.push({ to: assignee.email, success: false, error: err.message })
      hasError = true
    }
  }

  // 2. SEND TO ISSUER
  try {
    const issuerOutstanding = data.issuerOutstandingJobs || []
    const issuerHtml = `
    <!DOCTYPE html><html><body style="margin:0; padding:0; background:#f4f4f5; font-family: -apple-system, sans-serif;">
    <div style="max-width:640px; margin:0 auto; padding:20px;">
      <div style="background:white; border-radius:16px; overflow:hidden; border:1px solid #e4e4e7;">
        <div style="background:#09090b; color:white; padding:20px; text-align:center;">
          <div style="font-size:10px; letter-spacing:2px; opacity:0.7;">JOB ISSUED CONFIRMATION</div>
          <h1 style="margin:6px 0 0 0; font-size:18px;">✅ You Issued: ${data.title}</h1>
          <div style="margin-top:10px; background:white; color:black; padding:6px 16px; border-radius:20px; font-weight:700; font-size:12px; display:inline-block;">PRIORITY: ${priorityConfig.label} • ${data.assignees.length} assignee(s)</div>
        </div>
        <div style="padding:20px;">
          <p style="font-size:12px;">Hi ${data.createdByName}, your job has been issued.</p>
          <h3 style="font-size:13px;">📋 Job Summary:</h3>
          <table style="width:100%; background:#fafafa; border-radius:12px; font-size:12px; border-collapse:collapse;">
            <tr><td style="padding:8px 12px; background:#f4f4f5; font-weight:600;">Title</td><td style="padding:8px 12px; font-weight:600;">${data.title}</td></tr>
            <tr><td style="padding:8px 12px; background:#f4f4f5; font-weight:600;">Location</td><td style="padding:8px 12px;">${data.location}</td></tr>
            <tr><td style="padding:8px 12px; background:#f4f4f5; font-weight:600;">Priority</td><td style="padding:8px 12px;"><span style="background:${priorityConfig.bg}; color:${priorityConfig.color}; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:bold;">${priorityConfig.label}</span></td></tr>
            <tr><td style="padding:8px 12px; background:#f4f4f5; font-weight:600;">Assigned To</td><td style="padding:8px 12px;">${data.assignees.map(a => `${a.name} (${a.email})`).join(', ')}</td></tr>
          </table>
          <div style="background:#f4f4f5; border-left:4px solid #09090b; padding:12px; margin:12px 0; border-radius:0 8px 8px 0; font-size:12px; white-space:pre-wrap;">${data.requiredActions}</div>
          ${photosHtml}
          <div style="text-align:center; margin:16px 0;"><a href="${jobLink}" style="display:inline-block; background:#09090b; color:white; padding:10px 20px; text-decoration:none; border-radius:8px; font-weight:700; font-size:12px;">View Job →</a></div>
          ${issuerOutstanding.length > 0 ? `<div style="background:#f4f4f5; padding:12px; border-radius:8px; font-size:11px;"><strong>Your Active Jobs (${issuerOutstanding.length}):</strong><br>${issuerOutstanding.slice(0,5).map(j => `• ${j.title} - ${j.location} (${j.status})`).join('<br>')}</div>` : ''}
        </div>
      </div>
    </div></body></html>
    `
    const issuerResult = await sendEmail(data.createdByEmail, `✅ Issued: ${data.title} - ${data.location} [${priorityConfig.label}]`, issuerHtml)
    allResults.push({ to: data.createdByEmail, type: 'issuer', success: true, result: issuerResult })
  } catch (err: any) {
    allResults.push({ to: data.createdByEmail, type: 'issuer', success: false, error: err.message })
    hasError = true
  }

  return { success: !hasError, results: allResults }
}

export async function sendJobCompletionEmail(data: any) {
  const hasGmail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  const hasResend = !!process.env.RESEND_API_KEY
  if (!hasGmail && !hasResend) return { success: true, mocked: true }
  
  const jobLink = `${data.appUrl}/jobs/${data.jobId}`
  const html = `<div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px;"><div style="background:white; border-radius:12px; padding:20px; border:1px solid #e4e4e7;"><h1 style="color:#16a34a;">✅ Job Completed: ${data.title}</h1><p>Location: ${data.location}</p><p>Completed by: ${data.completedBy}</p><p>Completed: ${formatDate(data.completedAt)}</p>${data.finalNotes ? `<p>Notes: ${data.finalNotes}</p>` : ''}<a href="${jobLink}" style="display:inline-block; background:black; color:white; padding:10px 20px; text-decoration:none; border-radius:8px;">View Job</a></div></div>`
  
  try {
    const result = await sendEmail(data.createdByEmail, `✅ Completed: ${data.title}`, html)
    return { success: true, result }
  } catch (e) { return { success: false, error: e } }
}

export async function sendOverdueEmail(data: any) {
  const hasGmail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  const hasResend = !!process.env.RESEND_API_KEY
  if (!hasGmail && !hasResend) return { success: true, mocked: true }
  
  const jobLink = `${data.appUrl}/jobs/${data.jobId}`
  const html = `<div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px;"><div style="background:white; border-radius:12px; border:2px solid #dc2626; overflow:hidden;"><div style="background:#dc2626; color:white; padding:16px; text-align:center;"><h1>🚨 OVERDUE: ${data.title}</h1></div><div style="padding:20px;"><p>Location: ${data.location}</p><p>Assigned: ${data.assignees.map((a:any)=>a.name).join(', ')}</p><a href="${jobLink}" style="display:inline-block; background:#dc2626; color:white; padding:12px 24px; text-decoration:none; border-radius:8px;">View Overdue Job</a></div></div></div>`
  
  try {
    const allRecipients = [...data.assignees.map((a:any)=>a.email), data.createdByEmail]
    const unique = [...new Set(allRecipients)]
    const results = await Promise.all(unique.map(email => sendEmail(email, `🚨 OVERDUE: ${data.title}`, html)))
    return { success: true, results }
  } catch (e) { return { success: false, error: e } }
}
