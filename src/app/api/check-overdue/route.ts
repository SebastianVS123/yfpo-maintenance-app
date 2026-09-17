import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { sendOverdueEmail } from '@/lib/email'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || 'dev-secret'

  if (process.env.CRON_SECRET && authHeader !== `Bearer ${cronSecret}`) {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('secret') !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!adminDb) {
    return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 })
  }

  try {
    const now = new Date()
    const nowIso = now.toISOString()

    // Query jobs not completed and not already overdue
    const jobsRef = adminDb.collection('jobCards')
    const snapshot = await jobsRef.where('status', '!=', 'completed').get()

    const overdueJobs: any[] = []

    for (const doc of snapshot.docs) {
      const data = doc.data()
      if (data.status === 'overdue') continue

      let isOverdue = false

      // Check due_date
      if (data.due_date) {
        const dueDate = data.due_date.toDate ? data.due_date.toDate() : new Date(data.due_date)
        if (dueDate < now) isOverdue = true
      }

      // Check heuristic based on started_at
      if (!isOverdue && data.started_at) {
        const started = data.started_at.toDate ? data.started_at.toDate() : new Date(data.started_at)
        const hoursSinceStart = (now.getTime() - started.getTime()) / (1000 * 60 * 60)
        let threshold = 48
        if (data.priority === 'critical') threshold = 4
        else if (data.priority === 'high') threshold = 12
        else if (data.priority === 'low') threshold = 168
        if (hoursSinceStart > threshold) isOverdue = true
      }

      if (isOverdue) {
        overdueJobs.push({ id: doc.id, ...data })
      }
    }

    const results = []

    for (const job of overdueJobs) {
      await adminDb.collection('jobCards').doc(job.id).update({ status: 'overdue', updated_at: new Date() })

      // Get assignments
      const assignmentsSnap = await adminDb.collection('jobAssignments').where('job_id', '==', job.id).get()
      const assignees = []
      for (const aDoc of assignmentsSnap.docs) {
        const aData = aDoc.data()
        if (aData.personnel_id) {
          const pDoc = await adminDb.collection('personnel').doc(aData.personnel_id).get()
          if (pDoc.exists) {
            const pData = pDoc.data()
            if (pData?.email) assignees.push({ name: pData.full_name, email: pData.email })
          }
        }
      }

      const emailResult = await sendOverdueEmail({
        jobId: job.id,
        title: job.title,
        location: job.location,
        priority: job.priority,
        assignees,
        createdByEmail: job.createdByEmail,
        dueDate: job.due_date,
        estimatedTime: job.estimated_time,
        startedAt: job.started_at,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      })

      results.push({ jobId: job.id, title: job.title, emailResult })
    }

    return NextResponse.json({
      checkedAt: nowIso,
      overdueFound: overdueJobs.length,
      results
    })
  } catch (err: any) {
    console.error('Overdue check error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
