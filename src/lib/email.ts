import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

interface JobEmailData {
  jobId: string
  title: string
  location: string
  observedAt: string
  requiredActions: string
  departments: string[]
  priority: string
  photos?: string[]
  createdByName: string
  createdByEmail: string
  assignees: { name: string; email: string }[]
  dueDate?: string
  appUrl: string
}

export async function sendJobAssignmentEmail(data: JobEmailData) {
  if (!resend) {
    console.log('[EMAIL MOCK] Would send assignment email:', data)
    return { success: true, mocked: true }
  }

  const priorityMap: Record<string, { label: string; color: string; bg: string }> = {
    low: { label: 'LOW', color: '#22c55e', bg: '#dcfce7' },
    medium: { label: 'MEDIUM', color: '#eab308', bg: '#fef9c3' },
    high: { label: 'HIGH', color: '#f97316', bg: '#ffedd5' },
    critical: { label: 'CRITICAL', color: '#dc2626', bg: '#fee2e2' },
  }
  const priorityConfig = priorityMap[data.priority] || { label: data.priority.toUpperCase(), color: '#6b7280', bg: '#f3f4f6' }

  const jobLink = `${data.appUrl}/jobs/${data.jobId}`

  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #f9fafb; padding: 20px;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div style="background: ${priorityConfig.color}; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🔧 NEW MAINTENANCE JOB ASSIGNED</h1>
        <div style="margin-top: 12px; display: inline-block; background: white; color: ${priorityConfig.color}; padding: 8px 24px; border-radius: 20px; font-weight: bold; font-size: 18px; letter-spacing: 1px;">
          PRIORITY: ${priorityConfig.label}
        </div>
      </div>
      
      <div style="padding: 24px;">
        <h2 style="color: #111827; margin-top: 0;">${data.title}</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; font-weight: bold; color: #6b7280; width: 140px;">📍 Location:</td><td style="padding: 8px;">${data.location}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #6b7280;">👁️ Observed:</td><td style="padding: 8px;">${new Date(data.observedAt).toLocaleString()}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #6b7280;">👤 Issued By:</td><td style="padding: 8px;">${data.createdByName} (${data.createdByEmail})</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #6b7280;">🏢 Departments:</td><td style="padding: 8px;">${data.departments.join(', ')}</td></tr>
          ${data.dueDate ? `<tr><td style="padding: 8px; font-weight: bold; color: #6b7280;">⏰ Due Date:</td><td style="padding: 8px; color: #dc2626; font-weight: bold;">${new Date(data.dueDate).toLocaleString()}</td></tr>` : ''}
        </table>

        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0; color: #374151;">Required Actions:</h3>
          <p style="margin: 0; white-space: pre-wrap; color: #111827;">${data.requiredActions}</p>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${jobLink}" style="display: inline-block; background: #111827; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            🔗 VIEW & START JOB CARD
          </a>
          <p style="color: #6b7280; font-size: 12px; margin-top: 12px;">You will be asked to sign in. First time? Create a password using this email: ${data.assignees.map(a => a.email).join(', ')}</p>
        </div>

        <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 24px;">
          <p style="color: #6b7280; font-size: 12px;">This job was assigned to: ${data.assignees.map(a => `${a.name} (${a.email})`).join(', ')}</p>
          <p style="color: #6b7280; font-size: 12px;">Job ID: ${data.jobId} | Link: ${jobLink}</p>
        </div>
      </div>
    </div>
  </div>
  `

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const results = await Promise.all(
      data.assignees.map(assignee =>
        resend.emails.send({
          from: `Maintenance System <${fromEmail}>`,
          to: assignee.email,
          subject: `[${priorityConfig.label}] New Job: ${data.title} - ${data.location}`,
          html: html.replace(
            'First time? Create a password using this email:',
            `First time? Create a password using your email (${assignee.email}):`
          ),
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
  startedAt: string
  completedAt: string
}) {
  if (!resend) {
    console.log('[EMAIL MOCK] Would send completion email:', data)
    return { success: true, mocked: true }
  }

  const jobLink = `${data.appUrl}/jobs/${data.jobId}`
  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #f9fafb; padding: 20px;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div style="background: #22c55e; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">✅ JOB COMPLETED</h1>
      </div>
      <div style="padding: 24px;">
        <h2 style="color: #111827; margin-top: 0;">${data.title}</h2>
        <p><strong>Location:</strong> ${data.location}</p>
        <p><strong>Completed By:</strong> ${data.completedBy} (${data.completedByEmail})</p>
        <p><strong>Started:</strong> ${new Date(data.startedAt).toLocaleString()}</p>
        <p><strong>Completed:</strong> ${new Date(data.completedAt).toLocaleString()}</p>
        ${data.finalNotes ? `<div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;"><h3>Completion Notes:</h3><p>${data.finalNotes}</p></div>` : ''}
        <div style="text-align: center; margin: 24px 0;">
          <a href="${jobLink}" style="display: inline-block; background: #111827; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Job Card</a>
        </div>
      </div>
    </div>
  </div>
  `

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const result = await resend.emails.send({
      from: `Maintenance System <${fromEmail}>`,
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
  dueDate?: string
  estimatedTime?: string
  startedAt?: string
  appUrl: string
}) {
  if (!resend) {
    console.log('[EMAIL MOCK] Would send overdue email:', data)
    return { success: true, mocked: true }
  }

  const jobLink = `${data.appUrl}/jobs/${data.jobId}`
  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #f9fafb; padding: 20px;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 3px solid #dc2626;">
      <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">🚨 OVERDUE JOB ALERT</h1>
        <div style="margin-top: 8px; background: white; color: #dc2626; display: inline-block; padding: 4px 16px; border-radius: 20px; font-weight: bold;">PRIORITY: ${data.priority.toUpperCase()}</div>
      </div>
      <div style="padding: 24px;">
        <h2 style="color: #dc2626; margin-top: 0;">${data.title}</h2>
        <p><strong>Location:</strong> ${data.location}</p>
        <p><strong>Assigned To:</strong> ${data.assignees.map(a => a.name).join(', ')}</p>
        ${data.dueDate ? `<p><strong>Due Date:</strong> ${new Date(data.dueDate).toLocaleString()} (PASSED)</p>` : ''}
        ${data.estimatedTime ? `<p><strong>Estimated Time:</strong> ${data.estimatedTime}</p>` : ''}
        ${data.startedAt ? `<p><strong>Started:</strong> ${new Date(data.startedAt).toLocaleString()}</p>` : ''}
        <div style="text-align: center; margin: 24px 0;">
          <a href="${jobLink}" style="display: inline-block; background: #dc2626; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">⚠️ VIEW OVERDUE JOB NOW</a>
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
          from: `Maintenance System <${fromEmail}>`,
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
