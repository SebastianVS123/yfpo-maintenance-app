import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

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
  assignees: { name: string; email: string }[]
  dueDate?: string | Date | null
  appUrl: string
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

export async function sendJobAssignmentEmail(data: JobEmailData) {
  if (!resend) {
    console.log('[EMAIL MOCK - No RESEND_API_KEY] Would send assignment email:', JSON.stringify(data, null, 2))
    return { success: true, mocked: true, reason: 'No RESEND_API_KEY set' }
  }

  const priorityConfig = priorityMap[data.priority] || { label: data.priority.toUpperCase(), color: '#fff', bg: '#6b7280', bgLight: '#f3f4f6', border: '#6b7280', emoji: '⚪' }
  const jobLink = `${data.appUrl}/jobs/${data.jobId}`

  const formatDate = (d: any) => {
    if (!d) return 'N/A'
    const date = d.toDate ? d.toDate() : new Date(d)
    return date.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
  }

  const deptBadges = data.departments.map(dept => {
    const color = deptColors[dept] || '#6b7280'
    return `<span style="display:inline-block; background:${color}; color:white; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:bold; margin:2px;">${dept}</span>`
  }).join(' ')

  const photosHtml = data.photos && data.photos.length > 0 
    ? `<div style="margin:16px 0;"><p style="font-weight:bold; color:#374151; margin-bottom:8px;">📸 Issue Photos (${data.photos.length}):</p><div>${data.photos.map((url, i) => `<a href="${url}" style="display:inline-block; margin:4px; color:${priorityConfig.border}; font-size:12px;">Photo ${i+1} - View</a>`).join(' | ')}</div></div>` 
    : ''

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0; padding:0; background:#f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width:640px; margin:0 auto; padding:20px;">
    <div style="background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); border:1px solid #e4e4e7;">
      
      <!-- Priority Header - Colour Coded -->
      <div style="background:${priorityConfig.bg}; color:${priorityConfig.color}; padding:24px; text-align:center; border-bottom:4px solid ${priorityConfig.border};">
        <div style="font-size:12px; letter-spacing:2px; opacity:0.9; margin-bottom:8px;">MAINTENANCE JOB ASSIGNMENT</div>
        <h1 style="margin:0; font-size:22px; font-weight:800; letter-spacing:-0.5px;">${priorityConfig.emoji} NEW JOB CARD ASSIGNED TO YOU</h1>
        <div style="margin-top:16px; display:inline-block; background:white; color:${priorityConfig.bg}; padding:10px 28px; border-radius:30px; font-weight:900; font-size:16px; letter-spacing:1px; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
          PRIORITY: ${priorityConfig.label}
        </div>
        ${data.priority === 'critical' ? '<div style="margin-top:12px; font-size:13px; font-weight:bold;">⚠️ IMMEDIATE ACTION REQUIRED</div>' : ''}
        ${data.priority === 'high' ? '<div style="margin-top:12px; font-size:13px;">⏰ Action required within 24h</div>' : ''}
      </div>
      
      <div style="padding:28px;">
        <!-- Title -->
        <h2 style="color:#09090b; margin:0 0 4px 0; font-size:20px; font-weight:700; line-height:1.3;">${data.title}</h2>
        <p style="color:#71717a; font-size:13px; margin:0 0 20px 0;">Job ID: ${data.jobId.slice(0,8).toUpperCase()} • Issued ${formatDate(new Date())}</p>

        <!-- Quick Info Grid -->
        <table style="width:100%; border-collapse:collapse; margin:20px 0; background:#fafafa; border-radius:12px; overflow:hidden;">
          <tr style="border-bottom:1px solid #e4e4e7;">
            <td style="padding:12px 16px; font-weight:600; color:#52525b; width:130px; font-size:13px; background:#f4f4f5;">📍 LOCATION</td>
            <td style="padding:12px 16px; font-size:14px; font-weight:600; color:#09090b;">${data.location}</td>
          </tr>
          <tr style="border-bottom:1px solid #e4e4e7;">
            <td style="padding:12px 16px; font-weight:600; color:#52525b; font-size:13px; background:#f4f4f5;">👁️ OBSERVED</td>
            <td style="padding:12px 16px; font-size:14px; color:#09090b;">${formatDate(data.observedAt)}</td>
          </tr>
          <tr style="border-bottom:1px solid #e4e4e7;">
            <td style="padding:12px 16px; font-weight:600; color:#52525b; font-size:13px; background:#f4f4f5;">👤 ISSUED BY</td>
            <td style="padding:12px 16px; font-size:14px; color:#09090b;"><strong>${data.createdByName}</strong><br><span style="font-size:12px; color:#71717a;">${data.createdByEmail}</span></td>
          </tr>
          <tr style="border-bottom:1px solid #e4e4e7;">
            <td style="padding:12px 16px; font-weight:600; color:#52525b; font-size:13px; background:#f4f4f5;">🏢 DEPARTMENTS</td>
            <td style="padding:12px 16px;">${deptBadges}</td>
          </tr>
          ${data.dueDate ? `<tr style="border-bottom:1px solid #e4e4e7; background:${priorityConfig.bgLight};"><td style="padding:12px 16px; font-weight:700; color:${priorityConfig.border}; font-size:13px;">⏰ DUE DATE</td><td style="padding:12px 16px; font-size:14px; font-weight:700; color:${priorityConfig.border};">${formatDate(data.dueDate)}</td></tr>` : ''}
        </table>

        <!-- Required Actions - Highlighted -->
        <div style="background:${priorityConfig.bgLight}; border:2px solid ${priorityConfig.border}; border-left:6px solid ${priorityConfig.border}; padding:20px; border-radius:0 12px 12px 0; margin:24px 0;">
          <h3 style="margin:0 0 10px 0; color:${priorityConfig.border}; font-size:13px; letter-spacing:1px; font-weight:800;">⚙️ REQUIRED ACTIONS / BREAKDOWN:</h3>
          <p style="margin:0; white-space:pre-wrap; color:#18181b; font-size:14px; line-height:1.6;">${data.requiredActions}</p>
        </div>

        ${photosHtml}

        <!-- Assigned To -->
        <div style="background:#f4f4f5; padding:14px 16px; border-radius:8px; margin:20px 0;">
          <p style="margin:0; font-size:12px; color:#71717a; font-weight:600; letter-spacing:0.5px;">ASSIGNED TO:</p>
          <p style="margin:6px 0 0 0; font-size:13px; color:#09090b;">${data.assignees.map(a => `<strong>${a.name}</strong> (${a.email})`).join(', ')}</p>
        </div>

        <!-- CTA Button - Colour Coded -->
        <div style="text-align:center; margin:32px 0 16px 0;">
          <a href="${jobLink}" style="display:inline-block; background:${priorityConfig.bg}; color:${priorityConfig.color}; padding:16px 36px; text-decoration:none; border-radius:12px; font-weight:800; font-size:15px; letter-spacing:0.5px; box-shadow:0 4px 12px ${priorityConfig.border}40;">
            🔗 VIEW & START JOB CARD →
          </a>
          <p style="color:#71717a; font-size:11px; margin-top:14px; line-height:1.4;">Clicking will open the job. You will be asked to sign in.<br>First time? Use your assigned email to create a password. Auto-opens job and asks for estimated time + plan.</p>
        </div>

        <div style="border-top:1px solid #e4e4e7; padding-top:16px; margin-top:28px; text-align:center;">
          <p style="color:#a1a1aa; font-size:11px; margin:0;">This is an automated message from YFPO Maintenance System</p>
          <p style="color:#a1a1aa; font-size:11px; margin:4px 0 0 0;">Job Link: <a href="${jobLink}" style="color:#71717a;">${jobLink}</a></p>
        </div>
      </div>
    </div>
  </div>
  </body>
  </html>
  `

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const results = await Promise.all(
      data.assignees.map(assignee =>
        resend.emails.send({
          from: `YFPO Maintenance <${fromEmail}>`,
          to: assignee.email,
          subject: `${priorityConfig.emoji} [${priorityConfig.label}] ${data.title} - ${data.location}`,
          html,
        })
      )
    )
    return { success: true, results }
  } catch (error) {
    console.error('Email send failed:', error)
    return { success: false, error }
  }
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
  const formatDate = (d: any) => {
    if (!d) return 'N/A'
    const date = d.toDate ? d.toDate() : new Date(d)
    return date.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
  }

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width:640px; margin:0 auto; background:#f4f4f5; padding:20px;">
    <div style="background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:#16a34a; color:white; padding:24px; text-align:center;">
        <h1 style="margin:0; font-size:22px; font-weight:800;">✅ JOB COMPLETED</h1>
        <p style="margin:8px 0 0 0; opacity:0.9; font-size:13px;">Job has been marked as completed by operator</p>
      </div>
      <div style="padding:28px;">
        <h2 style="color:#09090b; margin-top:0; font-size:18px;">${data.title}</h2>
        <table style="width:100%; background:#f4f4f5; border-radius:12px; overflow:hidden; margin:16px 0;">
          <tr><td style="padding:10px 14px; font-weight:600; font-size:13px; color:#52525b; background:#fafafa;">Location</td><td style="padding:10px 14px; font-size:14px;">${data.location}</td></tr>
          <tr><td style="padding:10px 14px; font-weight:600; font-size:13px; color:#52525b; background:#fafafa;">Completed By</td><td style="padding:10px 14px; font-size:14px;"><strong>${data.completedBy}</strong> (${data.completedByEmail})</td></tr>
          <tr><td style="padding:10px 14px; font-weight:600; font-size:13px; color:#52525b; background:#fafafa;">Started</td><td style="padding:10px 14px; font-size:14px;">${formatDate(data.startedAt)}</td></tr>
          <tr><td style="padding:10px 14px; font-weight:600; font-size:13px; color:#52525b; background:#fafafa;">Completed</td><td style="padding:10px 14px; font-size:14px; font-weight:600;">${formatDate(data.completedAt)}</td></tr>
        </table>
        ${data.finalNotes ? `<div style="background:#f0fdf4; border:1px solid #bbf7d0; border-left:4px solid #16a34a; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;"><h3 style="margin:0 0 8px 0; font-size:13px; color:#16a34a;">Completion Notes:</h3><p style="margin:0; font-size:14px; line-height:1.5;">${data.finalNotes}</p></div>` : ''}
        <div style="text-align:center; margin:24px 0;">
          <a href="${jobLink}" style="display:inline-block; background:#09090b; color:white; padding:14px 28px; text-decoration:none; border-radius:12px; font-weight:700;">View Job Card</a>
        </div>
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
  const formatDate = (d: any) => {
    if (!d) return 'N/A'
    const date = d.toDate ? d.toDate() : new Date(d)
    return date.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
  }

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width:640px; margin:0 auto; background:#f4f4f5; padding:20px;">
    <div style="background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); border:2px solid #dc2626;">
      <div style="background:#dc2626; color:white; padding:24px; text-align:center;">
        <h1 style="margin:0; font-size:24px; font-weight:900;">🚨 OVERDUE JOB ALERT</h1>
        <div style="margin-top:12px; background:white; color:#dc2626; display:inline-block; padding:6px 20px; border-radius:20px; font-weight:800; font-size:14px;">PRIORITY: ${data.priority.toUpperCase()}</div>
      </div>
      <div style="padding:28px;">
        <h2 style="color:#dc2626; margin-top:0; font-size:18px;">${data.title}</h2>
        <p style="font-size:14px;"><strong>Location:</strong> ${data.location}</p>
        <p style="font-size:14px;"><strong>Assigned To:</strong> ${data.assignees.map(a => a.name).join(', ')}</p>
        ${data.dueDate ? `<p style="font-size:14px; color:#dc2626; font-weight:700;"><strong>Due Date PASSED:</strong> ${formatDate(data.dueDate)}</p>` : ''}
        ${data.estimatedTime ? `<p style="font-size:14px;"><strong>Estimated Time:</strong> ${data.estimatedTime}</p>` : ''}
        ${data.startedAt ? `<p style="font-size:14px;"><strong>Started:</strong> ${formatDate(data.startedAt)}</p>` : ''}
        <div style="text-align:center; margin:28px 0;">
          <a href="${jobLink}" style="display:inline-block; background:#dc2626; color:white; padding:16px 32px; text-decoration:none; border-radius:12px; font-weight:800; font-size:15px;">⚠️ VIEW OVERDUE JOB NOW</a>
        </div>
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
