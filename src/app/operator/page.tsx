import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate, getPriorityConfig, getStatusConfig } from '@/lib/utils'

export default async function OperatorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  
  // Find personnel record for this user to get assignments via personnel_id OR profile_id
  const { data: personnel } = await supabase.from('personnel').select('*').eq('email', profile?.email || user.email).single()

  let assignments: any[] = []
  
  if (personnel) {
    const { data } = await supabase
      .from('job_assignments')
      .select(`
        *,
        job_cards(
          *,
          job_photos(*),
          profiles!job_cards_created_by_fkey(full_name, email)
        ),
        personnel(full_name, email)
      `)
      .eq('personnel_id', personnel.id)
      .order('created_at', { ascending: false })
    
    if (data) assignments = data
  }

  // Also try by profile_id (for linked assignments)
  const { data: assignmentsByProfile } = await supabase
    .from('job_assignments')
    .select(`
      *,
      job_cards(
        *,
        job_photos(*),
        profiles!job_cards_created_by_fkey(full_name, email)
      ),
      personnel(full_name, email)
    `)
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  // Merge unique by job_id
  const allAssignments = [...assignments]
  if (assignmentsByProfile) {
    for (const ap of assignmentsByProfile) {
      if (!allAssignments.find(a => a.job_id === ap.job_id)) {
        allAssignments.push(ap)
      }
    }
  }

  const jobs = allAssignments.map(a => a.job_cards).filter(Boolean)

  const unopened = allAssignments.filter(a => a.status === 'unopened').length
  const opened = allAssignments.filter(a => ['opened', 'started'].includes(a.status)).length
  const completed = jobs.filter((j: any) => j.status === 'completed').length
  const overdue = jobs.filter((j: any) => j.status === 'overdue').length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white">🔧</div>
            <div>
              <h1 className="font-bold">Operator Hub</h1>
              <p className="text-xs text-gray-500">{profile?.full_name} • {profile?.email}</p>
            </div>
          </div>
          <form action={async () => {
            'use server'
            const supabase = await createClient()
            await supabase.auth.signOut()
            redirect('/auth/login')
          }}>
            <button className="text-sm text-gray-600 hover:text-black border px-3 py-1.5 rounded-lg">Sign Out</button>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Your Assigned Jobs</h2>
          <p className="text-gray-600 text-sm">Jobs allocated to you. Click to view, start, and complete.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-2xl font-bold text-orange-600">{unopened}</div>
            <div className="text-sm text-gray-600">Unopened (New)</div>
          </div>
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-2xl font-bold text-blue-600">{opened}</div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-2xl font-bold text-green-600">{completed}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50">
            <div className="text-2xl font-bold text-red-600">{overdue}</div>
            <div className="text-sm text-red-700">Overdue</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-6 border-b">
            <h3 className="font-semibold">All Allocated Jobs ({allAssignments.length})</h3>
          </div>

          {allAssignments.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-4">📭</div>
              <h4 className="font-semibold">No jobs assigned yet</h4>
              <p className="text-sm text-gray-500 mt-1">When a manager assigns you, you&apos;ll get an email with a link. Jobs will appear here.</p>
            </div>
          ) : (
            <div className="divide-y">
              {allAssignments.map((assignment) => {
                const job = assignment.job_cards
                if (!job) return null
                const priority = getPriorityConfig(job.priority)
                const status = getStatusConfig(job.status)
                const issuePhotos = job.job_photos?.filter((p: any) => p.type === 'issue') || []

                return (
                  <Link key={assignment.id} href={`/jobs/${job.id}`} className="block hover:bg-gray-50 p-6 transition">
                    <div className="flex gap-4">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {issuePhotos[0] ? (
                          <img src={issuePhotos[0].url} alt="Issue" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">📷</div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-semibold truncate">{job.title}</h4>
                          <div className="flex gap-2 flex-shrink-0">
                            {assignment.status === 'unopened' && (
                              <span className="px-2 py-1 bg-orange-500 text-white rounded-full text-xs font-bold animate-pulse">NEW • UNOPENED</span>
                            )}
                            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${priority.color}`}>{priority.label}</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${status.color}`}>{status.label}</span>
                          </div>
                        </div>

                        <div className="flex gap-4 text-xs text-gray-600 mb-2">
                          <span>📍 {job.location}</span>
                          <span>👤 {job.profiles?.full_name || 'Manager'}</span>
                          <span>📅 {formatDate(job.created_at)}</span>
                        </div>

                        <p className="text-sm text-gray-600 line-clamp-2">{job.required_actions}</p>

                        <div className="mt-2 flex gap-3 text-xs">
                          <span className={assignment.status === 'unopened' ? 'text-orange-600 font-bold' : 'text-gray-500'}>
                            Your status: {assignment.status.toUpperCase()}
                          </span>
                          {job.due_date && (
                            <span className={new Date(job.due_date) < new Date() ? 'text-red-600 font-bold' : 'text-gray-500'}>
                              Due: {formatDate(job.due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
          <strong>How it works:</strong> When you click an email job link, the job auto-opens and marks as STARTED (admin sees started). First open time = job start time. You then add estimated time + plan of action. Others assigned see previous commits. Upload completion photo to finish.
        </div>
      </main>
    </div>
  )
}
