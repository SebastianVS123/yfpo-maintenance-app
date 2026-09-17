import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import JobDetailClient from './JobDetailClient'

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ created?: string, next?: string }> }) {
  const { id } = await params
  const search = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    // Redirect to login with next param to return to this job
    redirect(`/auth/login?next=/jobs/${id}`)
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  // Fetch job with all relations
  const { data: job, error } = await supabase
    .from('job_cards')
    .select(`
      *,
      job_photos(*),
      job_assignments(
        *,
        personnel(*),
        profiles:profile_id(full_name, email)
      ),
      profiles!job_cards_created_by_fkey(full_name, email)
    `)
    .eq('id', id)
    .single()

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Job not found</h1>
          <p className="text-gray-600">{error?.message}</p>
        </div>
      </div>
    )
  }

  // Fetch commits
  const { data: commits } = await supabase
    .from('job_commits')
    .select(`
      *,
      profiles(full_name, email)
    `)
    .eq('job_id', id)
    .order('created_at', { ascending: true })

  // Check if current user is assigned
  const { data: personnel } = await supabase.from('personnel').select('*').eq('email', profile?.email || user.email).single()
  
  let userAssignment = null
  if (personnel) {
    userAssignment = job.job_assignments.find((a: any) => a.personnel_id === personnel.id)
  }
  if (!userAssignment) {
    userAssignment = job.job_assignments.find((a: any) => a.profile_id === user.id)
  }

  const isManager = profile?.role === 'manager' || profile?.role === 'admin' || job.created_by === user.id
  const isAssignee = !!userAssignment

  // If operator opens via email link (or directly) and status is unopened, auto-mark as opened/started
  if (isAssignee && userAssignment?.status === 'unopened') {
    await supabase.from('job_assignments').update({
      status: 'opened',
      opened_at: new Date().toISOString()
    }).eq('id', userAssignment.id)

    // If job is still open, mark as started and set started_at if first time
    if (job.status === 'open') {
      await supabase.from('job_cards').update({
        status: 'started',
        started_at: job.started_at || new Date().toISOString()
      }).eq('id', job.id)
      
      // Add a commit for start
      await supabase.from('job_commits').insert({
        job_id: job.id,
        user_id: user.id,
        message: `Job started by ${profile?.full_name || user.email} at ${new Date().toLocaleString()}`,
        type: 'status_update'
      })
    }
  }

  // Re-fetch job after updates
  const { data: updatedJob } = await supabase
    .from('job_cards')
    .select(`
      *,
      job_photos(*),
      job_assignments(
        *,
        personnel(*),
        profiles:profile_id(full_name, email)
      ),
      profiles!job_cards_created_by_fkey(full_name, email)
    `)
    .eq('id', id)
    .single()

  const { data: updatedCommits } = await supabase
    .from('job_commits')
    .select(`
      *,
      profiles(full_name, email)
    `)
    .eq('job_id', id)
    .order('created_at', { ascending: true })

  return (
    <JobDetailClient
      job={updatedJob || job}
      commits={updatedCommits || commits || []}
      currentUser={{ id: user.id, email: user.email!, profile }}
      userAssignment={userAssignment}
      isManager={isManager}
      isAssignee={isAssignee}
      isCreated={search.created === 'true'}
    />
  )
}
