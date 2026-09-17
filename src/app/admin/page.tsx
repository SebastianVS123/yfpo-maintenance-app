import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate, getPriorityConfig, getStatusConfig } from '@/lib/utils'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  
  if (!profile || (profile.role !== 'manager' && profile.role !== 'admin')) {
    redirect('/operator')
  }

  // Get jobs created by this manager
  const { data: jobs } = await supabase
    .from('job_cards')
    .select(`
      *,
      job_photos(*),
      job_assignments(
        *,
        personnel(*)
      )
    `)
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  // Stats
  const total = jobs?.length || 0
  const open = jobs?.filter(j => j.status === 'open').length || 0
  const inProgress = jobs?.filter(j => ['started', 'in_progress'].includes(j.status)).length || 0
  const completed = jobs?.filter(j => j.status === 'completed').length || 0
  const overdue = jobs?.filter(j => j.status === 'overdue').length || 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-black rounded-lg flex items-center justify-center">
                <span className="text-white">🔧</span>
              </div>
              <div>
                <h1 className="font-bold text-gray-900">Maintenance Hub</h1>
                <p className="text-xs text-gray-500">Manager Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/personnel" className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                👥 Personnel
              </Link>
              <Link href="/admin/create-job" className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 font-semibold">
                + Create Job
              </Link>
              <form action={async () => {
                'use server'
                const supabase = await createClient()
                await supabase.auth.signOut()
                redirect('/auth/login')
              }}>
                <button className="text-sm text-gray-600 hover:text-black">Sign Out</button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Welcome, {profile.full_name}</h2>
          <p className="text-gray-600">Track and manage all maintenance issues you&apos;ve raised</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-sm text-gray-500">Total Jobs</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-yellow-200 bg-yellow-50/50">
            <div className="text-2xl font-bold text-yellow-700">{open}</div>
            <div className="text-sm text-yellow-700">Open</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/50">
            <div className="text-2xl font-bold text-blue-700">{inProgress}</div>
            <div className="text-sm text-blue-700">In Progress</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-green-200 bg-green-50/50">
            <div className="text-2xl font-bold text-green-700">{completed}</div>
            <div className="text-sm text-green-700">Completed</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/50">
            <div className="text-2xl font-bold text-red-700">{overdue}</div>
            <div className="text-sm text-red-700">Overdue</div>
          </div>
        </div>

        {/* Jobs Grid */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center">
            <h3 className="font-semibold text-lg">Your Job Cards</h3>
            <div className="text-sm text-gray-500">{jobs?.length || 0} issues</div>
          </div>

          {!jobs || jobs.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">📋</div>
              <h4 className="font-semibold mb-2">No jobs yet</h4>
              <p className="text-gray-500 text-sm mb-4">Create your first maintenance job to get started</p>
              <Link href="/admin/create-job" className="inline-block px-6 py-2 bg-black text-white rounded-lg text-sm font-semibold">
                Create Job Card
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {jobs.map((job) => {
                const priority = getPriorityConfig(job.priority)
                const status = getStatusConfig(job.status)
                const issuePhotos = job.job_photos?.filter((p: any) => p.type === 'issue') || []
                const assignees = job.job_assignments?.map((a: any) => a.personnel?.full_name).filter(Boolean) || []

                return (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="block hover:bg-gray-50 transition p-6">
                    <div className="flex gap-4">
                      {/* Photo preview */}
                      <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {issuePhotos[0] ? (
                          <img src={issuePhotos[0].url} alt="Issue" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl">📷</div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h4 className="font-semibold text-gray-900 truncate">{job.title}</h4>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${priority.color}`}>
                              {priority.label}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 mb-2">
                          <div>📍 {job.location}</div>
                          <div>🏢 {job.departments?.join(', ')}</div>
                          <div>📅 {formatDate(job.observed_at)}</div>
                          <div>👥 {assignees.length ? assignees.join(', ') : 'Unassigned'}</div>
                        </div>

                        <p className="text-sm text-gray-600 line-clamp-2">{job.required_actions}</p>

                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                          <span>Created {formatDate(job.created_at)}</span>
                          {job.started_at && <span className="text-blue-600">Started {formatDate(job.started_at)}</span>}
                          {job.completed_at && <span className="text-green-600">Completed {formatDate(job.completed_at)}</span>}
                          {job.due_date && <span className={new Date(job.due_date) < new Date() ? 'text-red-600 font-bold' : ''}>Due {formatDate(job.due_date)}</span>}
                          <span>• {issuePhotos.length} photo(s)</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
