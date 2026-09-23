import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

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
  issuerOutstandingJobs?: OutstandingJob[] // for issuer summary
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

export async function sendJobAssignmentEmail(data: JobEmailData) {
  if (!resend) {
    console.log('[EMAIL MOCK - No RESEND_API_KEY] Would send assignment emails to:', data.assignees.map(a => a.email), 'and issuer', data.createdByEmail)
    return { success: true, mocked: true, reason: 'No RESEND_API_KEY set - add it in Render env vars' }
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const isOnboarding = fromEmail.includes('onboarding@resend.dev')
  if (isOnboarding) {
    console.warn('[EMAIL WARNING] Using onboarding@resend.dev - Resend free tier only allows sending to your own verified email. Add your domain in Resend to send to operators.')
  }

  const priorityConfig = priorityMap[data.priority] || { label: data.priority.toUpperCase(), color: '#fff', bg: '#6b7280', bgLight: '#f3f4f6', border: '#6b7280', emoji: '⚪' }
  const jobLink = `${data.appUrl}/jobs/${data.jobId}`

  const deptBadges = data.departments.map(dept => {
    const color = deptColors[dept] || '#6b7280'
    return `<span style="display:inline-block; background:${color}; color:white; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:bold; margin:2px;">${dept}</span>`
  }).join(' ')

  const photosHtml = data.photos && data.photos.length > 0 
    ? `<div style="margin:16px 0;"><p style="font-weight:bold; color:#374151; margin-bottom:8px;">📸 Issue Photos (${data.photos.length}):</p><div>${data.photos.map((url, i) => `<a href="${url}" style="display:inline-block; margin:4px; color:${priorityConfig.border}; font-size:12px;">Photo ${i+1}</a>`).join(' | ')}</div></div>` 
    : ''

  // Results array
  const allResults: any[] = []
  let hasError = false

  // 1. SEND TO EACH ASSIGNEE - with their outstanding jobs
  for (const assignee of data.assignees) {
    const outstanding = assignee.outstandingJobs || []
    const otherJobs = outstanding.filter(j => j.id !== data.jobId) // exclude current job
    
    const outstandingHtml = otherJobs.length > 0 ? `
      <div style="background:#fffbeb; border:1px solid #fcd34d; border-left:4px solid #f59e0b; padding:16px; border-radius:0 8px 8px 0; margin:20px 0;">
        <h3 style="margin:0 0 10px 0; color:#92400e; font-size:13px; font-weight:800;">📋 YOUR OUTSTANDING JOBS (${otherJobs.length} other):</h3>
        <p style="margin:0 0 8px 0; font-size:12px; color:#78350f;">You have ${otherJobs.length} other open job(s) assigned to you. Please review:</p>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          ${otherJobs.map(j => {
            const p = priorityMap[j.priority] || priorityMap['medium']
            return `<tr style="border-bottom:1px solid #fde68a;"><td style="padding:8px 4px;"><span style="display:inline-block; background:${p.bg}; color:${p.color}; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:bold;">${p.label}</span></td><td style="padding:8px 4px; font-weight:600;">${j.title}</td><td style="padding:8px 4px;">${j.location}</td><td style="padding:8px 4px;"><a href="${data.appUrl}/jobs/${j.id}" style="color:#d97706;">View</a></td></tr>`
          }).join('')}
        </table>
        <p style="margin:8px 0 0 0; font-size:11px; color:#92400e;"><a href="${data.appUrl}/operator" style="color:#92400e; font-weight:bold;">Go to Operator Dashboard → See all ${outstanding.length} jobs</a></p>
      </div>
    ` : ''

    const assigneeHtml = `
    <!DOCTYPE html><html><body style="margin:0; padding:0; background:#f4f4f5; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
    <div style="max-width:640px; margin:0 auto; padding:20px;">
      <div style="background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); border:1px solid #e4e4e7;">
        <div style="background:${priorityConfig.bg}; color:${priorityConfig.color}; padding:24px; text-align:center; border-bottom:4px solid ${priorityConfig.border};">
          <div style="font-size:12px; letter-spacing:2px; opacity:0.9; margin-bottom:8px;">JOB ASSIGNED TO YOU - ACTION REQUIRED</div>
          <h1 style="margin:0; font-size:22px; font-weight:800;">${priorityConfig.emoji} NEW JOB: ${data.title}</h1>
          <div style="margin-top:16px; display:inline-block; background:white; color:${priorityConfig.bg}; padding:10px 28px; border-radius:30px; font-weight:900; font-size:16px;">PRIORITY: ${priorityConfig.label}</div>
          ${data.priority === 'critical' ? '<div style="margin-top:12px; font-size:13px; font-weight:bold;">⚠️ IMMEDIATE ACTION REQUIRED</div>' : ''}
        </div>
        <div style="padding:28px;">
          <h2 style="color:#09090b; margin:0 0 4px 0; font-size:18px;">${data.title}</h2>
          <p style="color:#71717a; font-size:12px; margin:0 0 16px 0;">Hi ${assignee.name}, a new job has been assigned to you by ${data.createdByName}</p>
          <table style="width:100%; border-collapse:collapse; margin:16px 0; background:#fafafa; border-radius:12px; overflow:hidden;">
            <tr style="border-bottom:1px solid #e4e4e7;"><td style="padding:10px 14px; font-weight:600; color:#52525b; width:120px; font-size:12px; background:#f4f4f5;">📍 LOCATION</td><td style="padding:10px 14px; font-size:13px; font-weight:600;">${data.location}</td></tr>
            <tr style="border-bottom:1px solid #e4e4e7;"><td style="padding:10px 14px; font-weight:600; color:#52525b; font-size:12px; background:#f4f4f5;">👁️ OBSERVED</td><td style="padding:10px 14px; font-size:13px;">${formatDate(data.observedAt)}</td></tr>
            <tr style="border-bottom:1px solid #e4e4e7;"><td style="padding:10px 14px; font-weight:600; color:#52525b; font-size:12px; background:#f4f4f5;">👤 ISSUED BY</td><td style="padding:10px 14px; font-size:13px;"><strong>${data.createdByName}</strong> (${data.createdByEmail})</td></tr>
            <tr style="border-bottom:1px solid #e4e4e7;"><td style="padding:10px 14px; font-weight:600; color:#52525b; font-size:12px; background:#f4f4f5;">🏢 DEPTS</td><td style="padding:10px 14px;">${deptBadges}</td></tr>
            ${data.dueDate ? `<tr style="background:${priorityConfig.bgLight};"><td style="padding:10px 14px; font-weight:700; color:${priorityConfig.border}; font-size:12px;">⏰ DUE</td><td style="padding:10px 14px; font-weight:700; color:${priorityConfig.border};">${formatDate(data.dueDate)}</td></tr>` : ''}
          </table>
          <div style="background:${priorityConfig.bgLight}; border:2px solid ${priorityConfig.border}; border-left:6px solid ${priorityConfig.border}; padding:16px; border-radius:0 12px 12px 0; margin:16px 0;">
            <h3 style="margin:0 0 8px 0; color:${priorityConfig.border}; font-size:12px; font-weight:800;">⚙️ WHAT TO DO:</h3>
            <p style="margin:0; white-space:pre-wrap; color:#18181b; font-size:13px; line-height:1.5;">${data.requiredActions}</p>
          </div>
          ${photosHtml}
          ${outstandingHtml}
          <div style="text-align:center; margin:24px 0;">
            <a href="${jobLink}" style="display:inline-block; background:${priorityConfig.bg}; color:${priorityConfig.color}; padding:14px 28px; text-decoration:none; border-radius:12px; font-weight:800; font-size:14px;">🔗 VIEW & START JOB →</a>
            <p style="font-size:11px; color:#71717a; margin-top:10px;">Sign in with your email, add estimated time + plan, then complete with photo</p>
          </div>
          <div style="border-top:1px solid #e4e4e7; padding-top:12px; text-align:center;"><p style="font-size:10px; color:#a1a1aa;">YFPO Maintenance • Job ${data.jobId.slice(0,8).toUpperCase()} • <a href="${jobLink}" style="color:#71717a;">${jobLink}</a></p></div>
        </div>
      </div>
    </div></body></html>
    `

    try {
      const result = await resend.emails.send({
        from: `YFPO Maintenance <${fromEmail}>`,
        to: assignee.email,
        subject: `${priorityConfig.emoji} [${priorityConfig.label}] Assigned: ${data.title} - ${data.location}`,
        html: assigneeHtml,
      })
      allResults.push({ to: assignee.email, success: true, result })
    } catch (err: any) {
      console.error(`Failed to send to ${assignee.email}:`, err)
      allResults.push({ to: assignee.email, success: false, error: err.message })
      hasError = true
    }
  }

  // 2. SEND TO ISSUER - confirmation summary
  try {
    const issuerOutstanding = data.issuerOutstandingJobs || []
    const issuerHtml = `
    <!DOCTYPE html><html><body style="margin:0; padding:0; background:#f4f4f5; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
    <div style="max-width:640px; margin:0 auto; padding:20px;">
      <div style="background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); border:1px solid #e4e4e7;">
        <div style="background:#09090b; color:white; padding:24px; text-align:center;">
          <div style="font-size:11px; letter-spacing:2px; opacity:0.7; margin-bottom:6px;">JOB ISSUED CONFIRMATION</div>
          <h1 style="margin:0; font-size:20px; font-weight:700;">✅ You Issued: ${data.title}</h1>
          <div style="margin-top:12px; display:inline-block; background:white; color:black; padding:8px 20px; border-radius:20px; font-weight:700; font-size:13px;">PRIORITY: ${priorityConfig.label} • ${data.assignees.length} assignee(s)</div>
        </div>
        <div style="padding:28px;">
          <p style="font-size:13px; color:#52525b;">Hi ${data.createdByName},</p>
          <p style="font-size:13px; color:#09090b;">Your maintenance job has been successfully issued and notifications sent.</p>
          <h3 style="font-size:14px; margin:20px 0 8px 0;">📋 Job Summary You Issued:</h3>
          <table style="width:100%; border-collapse:collapse; background:#fafafa; border-radius:12px; overflow:hidden; font-size:13px;">
            <tr style="border-bottom:1px solid #e4e4e7;"><td style="padding:10px 14px; font-weight:600; color:#52525b; background:#f4f4f5; width:120px;">Title</td><td style="padding:10px 14px; font-weight:600;">${data.title}</td></tr>
            <tr style="border-bottom:1px solid #e4e4e7;"><td style="padding:10px 14px; font-weight:600; color:#52525b; background:#f4f4f5;">Location</td><td style="padding:10px 14px;">${data.location}</td></tr>
            <tr style="border-bottom:1px solid #e4e4e7;"><td style="padding:10px 14px; font-weight:600; color:#52525b; background:#f4f4f5;">Priority</td><td style="padding:10px 14px;"><span style="background:${priorityConfig.bg}; color:${priorityConfig.color}; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:bold;">${priorityConfig.label}</span></td></tr>
            <tr style="border-bottom:1px solid #e4e4e7;"><td style="padding:10px 14px; font-weight:600; color:#52525b; background:#f4f4f5;">Departments</td><td style="padding:10px 14px;">${deptBadges}</td></tr>
            <tr style="border-bottom:1px solid #e4e4e7;"><td style="padding:10px 14px; font-weight:600; color:#52525b; background:#f4f4f5;">Assigned To</td><td style="padding:10px 14px;">${data.assignees.map(a => `${a.name} (${a.email})`).join(', ')}</td></tr>
            ${data.dueDate ? `<tr><td style="padding:10px 14px; font-weight:600; color:#52525b; background:#f4f4f5;">Due Date</td><td style="padding:10px 14px;">${formatDate(data.dueDate)}</td></tr>` : ''}
          </table>
          <div style="background:#f4f4f5; border-left:4px solid #09090b; padding:14px; border-radius:0 8px 8px 0; margin:16px 0;">
            <h4 style="margin:0 0 6px 0; font-size:12px;">Required Actions:</h4>
            <p style="margin:0; white-space:pre-wrap; font-size:13px; line-height:1.5;">${data.requiredActions}</p>
          </div>
          ${photosHtml}
          <div style="text-align:center; margin:20px 0;">
            <a href="${jobLink}" style="display:inline-block; background:#09090b; color:white; padding:12px 24px; text-decoration:none; border-radius:10px; font-weight:700; font-size:13px;">View Job Card →</a>
          </div>
          ${issuerOutstanding.length > 0 ? `
          <div style="background:#f4f4f5; border:1px solid #e4e4e7; padding:14px; border-radius:8px; margin:20px 0;">
            <h4 style="margin:0 0 8px 0; font-size:12px; font-weight:700;">📊 Your Active Jobs (${issuerOutstanding.length}):</h4>
            <table style="width:100%; font-size:11px; border-collapse:collapse;">
              ${issuerOutstanding.slice(0,10).map(j => `<tr style="border-bottom:1px solid #e4e4e7;"><td style="padding:6px;">${j.title}</td><td style="padding:6px;">${j.location}</td><td style="padding:6px;"><span style="font-size:10px; background:#e4e4e7; padding:2px 6px; border-radius:8px;">${j.status}</span></td></tr>`).join('')}
            </table>
            ${issuerOutstanding.length > 10 ? `<p style="font-size:11px; color:#71717a; margin:8px 0 0 0;">+ ${issuerOutstanding.length - 10} more jobs...</p>` : ''}
          </div>` : ''}
          <div style="border-top:1px solid #e4e4e7; padding-top:12px; text-align:center;"><p style="font-size:10px; color:#a1a1aa;">Operators have been notified via email with colour-coded priority and outstanding jobs list.</p></div>
        </div>
      </div>
    </div></body></html>
    `
    const issuerResult = await resend.emails.send({
      from: `YFPO Maintenance <${fromEmail}>`,
      to: data.createdByEmail,
      subject: `✅ Issued: ${data.title} - ${data.location} [${priorityConfig.label}] to ${data.assignees.length} person(s)`,
      html: issuerHtml,
    })
    allResults.push({ to: data.createdByEmail, type: 'issuer', success: true, result: issuerResult })
  } catch (err: any) {
    console.error(`Failed to send to issuer ${data.createdByEmail}:`, err)
    allResults.push({ to: data.createdByEmail, type: 'issuer', success: false, error: err.message })
    hasError = true
  }

  return { success: !hasError, results: allResults, warning: isOnboarding ? 'Using onboarding@resend.dev - only sends to verified email. Add domain in Resend dashboard to send to all.' : undefined }
}

export async function sendJobCompletionEmail(data: {
  jobId: string
  title: string
  location: string
  completedBy: string
  completedByEmail: string
  completionPhoto?: string
  finalNotes?: string
  createdByEmail: string
  appUrl: string
  startedAt: any
  completedAt: any
}) {
  if (!resend) {
    console.log('[EMAIL MOCK] Would send completion email:', data)
    return { success: true, mocked: true }
  }
  const jobLink = `${data.appUrl}/jobs/${data.jobId}`
  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width:640px; margin:0 auto; background:#f4f4f5; padding:20px;">
    <div style="background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:#16a34a; color:white; padding:24px; text-align:center;">
        <h1 style="margin:0; font-size:22px; font-weight:800;">✅ JOB COMPLETED</h1>
      </div>
      <div style="padding:28px;">
        <h2 style="color:#09090b; margin-top:0; font-size:18px;">${data.title}</h2>
        <p style="font-size:13px;"><strong>Location:</strong> ${data.location}</p>
        <p style="font-size:13px;"><strong>Completed By:</strong> ${data.completedBy} (${data.completedByEmail})</p>
        <p style="font-size:13px;"><strong>Completed:</strong> ${formatDate(data.completedAt)}</p>
        ${data.finalNotes ? `<div style="background:#f0fdf4; border-left:4px solid #16a34a; padding:14px; margin:16px 0; font-size:13px;">${data.finalNotes}</div>` : ''}
        <div style="text-align:center; margin:20px 0;"><a href="${jobLink}" style="display:inline-block; background:#09090b; color:white; padding:12px 24px; text-decoration:none; border-radius:10px; font-weight:700;">View Job Card</a></div>
      </div>
    </div>
  </div>
  `
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const result = await resend.emails.send({
      from: `YFPO Maintenance <${fromEmail}>`,
      to: data.createdByEmail,
      subject: `✅ Completed: ${data.title} - ${data.location}`,
      html,
    })
    return { success: true, result }
  } catch (error) {
    console.error('Completion email failed:', error)
    return { success: false, error }
  }
}

export async function sendOverdueEmail(data: {
  jobId: string
  title: string
  location: string
  priority: string
  assignees: { name: string; email: string }[]
  createdByEmail: string
  dueDate?: any
  estimatedTime?: string
  startedAt?: any
  appUrl: string
}) {
  if (!resend) {
    console.log('[EMAIL MOCK] Would send overdue email:', data)
    return { success: true, mocked: true }
  }
  const priorityConfig = priorityMap[data.priority] || priorityMap['high']
  const jobLink = `${data.appUrl}/jobs/${data.jobId}`
  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width:640px; margin:0 auto; background:#f4f4f5; padding:20px;">
    <div style="background:white; border-radius:16px; overflow:hidden; border:2px solid #dc2626;">
      <div style="background:#dc2626; color:white; padding:24px; text-align:center;">
        <h1 style="margin:0; font-size:22px; font-weight:900;">🚨 OVERDUE JOB ALERT</h1>
        <div style="margin-top:10px; background:white; color:#dc2626; display:inline-block; padding:6px 16px; border-radius:20px; font-weight:800; font-size:12px;">PRIORITY: ${data.priority.toUpperCase()}</div>
      </div>
      <div style="padding:24px;">
        <h2 style="color:#dc2626; margin-top:0;">${data.title}</h2>
        <p><strong>Location:</strong> ${data.location}</p>
        <p><strong>Assigned To:</strong> ${data.assignees.map(a => a.name).join(', ')}</p>
        ${data.dueDate ? `<p style="color:#dc2626; font-weight:700;">Due: ${formatDate(data.dueDate)} (PASSED)</p>` : ''}
        <div style="text-align:center; margin:20px 0;"><a href="${jobLink}" style="display:inline-block; background:#dc2626; color:white; padding:14px 28px; text-decoration:none; border-radius:10px; font-weight:800;">VIEW OVERDUE JOB NOW</a></div>
      </div>
    </div>
  </div>
  `
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const allRecipients = [...data.assignees.map(a => a.email), data.createdByEmail]
    const uniqueRecipients = [...new Set(allRecipients)]
    const results = await Promise.all(
      uniqueRecipients.map(email =>
        resend.emails.send({
          from: `YFPO Maintenance <${fromEmail}>`,
          to: email,
          subject: `🚨 OVERDUE: ${data.title} - ${data.location}`,
          html,
        })
      )
    )
    return { success: true, results }
  } catch (error) {
    console.error('Overdue email failed:', error)
    return { success: false, error }
  }
}
