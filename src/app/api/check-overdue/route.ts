import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendOverdueEmail } from '@/lib/email'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// This endpoint should be called by a cron job (e.g. Vercel Cron or Supabase pg_cron)
// It checks for overdue jobs and sends emails

export async function GET(request: NextRequest) {
  // Optional simple auth via query param or header
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || 'dev-secret'

  // Allow if no secret set in dev, or if matches
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${cronSecret}`) {
    // Also check query param for ease
    const { searchParams } = new URL(request.url)
    if (searchParams.get('secret') !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createServiceClient()

  try {
    // Find jobs that are overdue:
    // 1. Have due_date in past and not completed
    // 2. Or started_at + estimated_time parsing? For simplicity, we check due_date only in cron,
    //    but also check jobs started > 24h ago with high/critical priority as overdue heuristic
    const now = new Date().toISOString()

    const { data: overdueByDueDate, error } = await supabase
      .from('job_cards')
      .select(`
        *,
        job_assignments(
          personnel(email, full_name)
        ),
        profiles!job_cards_created_by_fkey(email, full_name)
      `)
      .neq('status', 'completed')
      .neq('status', 'overdue')
      .lt('due_date', now)

    if (error) throw error

    // Also check jobs that started more than X time ago without completion
    // For demo: critical jobs > 4 hours, high > 12 hours, medium > 48 hours, low > 7 days
    const { data: oldStartedJobs } = await supabase
      .from('job_cards')
      .select(`
        *,
        job_assignments(
          personnel(email, full_name)
        ),
        profiles!job_cards_created_by_fkey(email, full_name)
      `)
      .neq('status', 'completed')
      .neq('status', 'overdue')
      .not('started_at', 'is', null)

    const overdueHeuristic: any[] = []
    const nowTime = new Date().getTime()

    for (const job of oldStartedJobs || []) {
      if (!job.started_at) continue
      const started = new Date(job.started_at).getTime()
      const hoursSinceStart = (nowTime - started) / (1000 * 60 * 60)

      let threshold = 48 // default medium
      if (job.priority === 'critical') threshold = 4
      else if (job.priority === 'high') threshold = 12
      else if (job.priority === 'low') threshold = 168 // 7 days

      if (hoursSinceStart > threshold) {
        overdueHeuristic.push(job)
      }
    }

    const allOverdue = [...(overdueByDueDate || []), ...overdueHeuristic]
    // Deduplicate by id
    const uniqueOverdue = Array.from(new Map(allOverdue.map(j => [j.id, j])).values())

    const results = []

    for (const job of uniqueOverdue) {
      // Mark as overdue
      await supabase.from('job_cards').update({ status: 'overdue' }).eq('id', job.id)

      // Prepare assignees
      const assignees = job.job_assignments?.map((a: any) => ({
        name: a.personnel?.full_name || 'Operator',
        email: a.personnel?.email
      })).filter((a: any) => a.email) || []

      // Send overdue email
      const emailResult = await sendOverdueEmail({
        jobId: job.id,
        title: job.title,
        location: job.location,
        priority: job.priority,
        assignees,
        createdByEmail: job.profiles?.email,
        dueDate: job.due_date,
        estimatedTime: job.estimated_time,
        startedAt: job.started_at,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      })

      results.push({ jobId: job.id, title: job.title, emailResult })
    }

    return NextResponse.json({
      checkedAt: now,
      overdueFound: uniqueOverdue.length,
      overdueByDueDate: overdueByDueDate?.length || 0,
      overdueByHeuristic: overdueHeuristic.length,
      results
    })
  } catch (err: any) {
    console.error('Overdue check error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Also allow POST for manual trigger
export async function POST(request: NextRequest) {
  return GET(request)
}
