import { NextRequest, NextResponse } from 'next/server'
import { sendJobAssignmentEmail, sendJobCompletionEmail, sendOverdueEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type } = body

    if (type === 'assignment') {
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
        assignees: body.assignees,
        dueDate: body.dueDate,
        appUrl: body.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      })
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

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    console.error('Email API error:', error)
    return NextResponse.json({ error: error.message, success: false }, { status: 500 })
  }
}
