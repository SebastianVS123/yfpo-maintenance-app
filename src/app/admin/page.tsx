'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase/client'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { formatDate, getPriorityConfig, getStatusConfig } from '@/lib/utils'

interface JobCard {
  id: string
  title: string
  location: string
  observed_at: any
  required_actions: string
  departments: string[]
  priority: string
  status: string
  created_by: string
  created_at: any
  started_at?: any
  completed_at?: any
  due_date?: any
  photos?: any[]
  assignments?: any[]
}

export default function AdminPage() {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const [jobs, setJobs] = useState<JobCard[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login')
    if (!loading && profile && profile.role !== 'manager' && profile.role !== 'admin') router.push('/operator')
  }, [user, profile, loading, router])

  useEffect(() => {
    if (user) fetchJobs()
  }, [user])

  const fetchJobs = async () => {
    try {
      const q = query(collection(db, 'jobCards'), where('created_by', '==', user!.uid), orderBy('created_at', 'desc'))
      const snap = await getDocs(q)
      
      const jobsData: JobCard[] = []
      for (const docSnap of snap.docs) {
        const data = docSnap.data()
        // Get photos
        const photosQ = query(collection(db, 'jobPhotos'), where('job_id', '==', docSnap.id))
        const photosSnap = await getDocs(photosQ)
        const photos = photosSnap.docs.map(d => d.data())
        
        // Get assignments with personnel
        const assignmentsQ = query(collection(db, 'jobAssignments'), where('job_id', '==', docSnap.id))
        const assignmentsSnap = await getDocs(assignmentsQ)
        const assignments = []
        for (const aDoc of assignmentsSnap.docs) {
          const aData = aDoc.data()
          let personnelData = null
          if (aData.personnel_id) {
            const personnelDoc = await getDocs(query(collection(db, 'personnel'), where('__name__', '==', aData.personnel_id)))
            // Actually use doc directly
            try {
              const { doc, getDoc } = await import('firebase/firestore')
              const pDoc = await getDoc(doc(db, 'personnel', aData.personnel_id))
              if (pDoc.exists()) personnelData = pDoc.data()
            } catch {}
          }
          assignments.push({ ...aData, personnel: personnelData })
        }

        jobsData.push({
          id: docSnap.id,
          ...data,
          photos,
          assignments
        } as JobCard)
      }
      setJobs(jobsData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingJobs(false)
    }
  }

  if (loading || loadingJobs) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const total = jobs.length
  const open = jobs.filter(j => j.status === 'open').length
  const inProgress = jobs.filter(j => ['started', 'in_progress'].includes(j.status)).length
  const completed = jobs.filter(j => j.status === 'completed').length
  const overdue = jobs.filter(j => j.status === 'overdue').length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Responsive */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm">🔧</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">Maintenance Hub</h1>
                <p className="text-xs text-gray-500">Manager Dashboard • Firebase</p>
              </div>
              <div className="sm:hidden">
                <h1 className="font-bold text-gray-900 text-sm">Maint Hub</h1>
                <p className="text-[10px] text-gray-500">Manager</p>
              </div>
            </div>
            
            {/* Desktop actions */}
            <div className="hidden md:flex items-center gap-2 lg:gap-3">
              <Link href="/admin/personnel" className="px-3 lg:px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition whitespace-nowrap">
                👥 Personnel
              </Link>
              <Link href="/admin/create-job" className="px-3 lg:px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 font-semibold whitespace-nowrap">
                + Create Job
              </Link>
              <button onClick={() => { signOut(); router.push('/auth/login') }} className="text-sm text-gray-600 hover:text-black px-2">
                Sign Out
              </button>
            </div>

            {/* Mobile menu button */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg border hover:bg-gray-50">
              <span className="text-lg">{mobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-3 border-t space-y-2">
              <Link href="/admin/personnel" className="block w-full text-left px-3 py-2.5 border rounded-lg text-sm hover:bg-gray-50">
                👥 Personnel Management
              </Link>
              <Link href="/admin/create-job" className="block w-full text-center px-3 py-2.5 bg-black text-white rounded-lg text-sm font-semibold">
                + Create New Job
              </Link>
              <button onClick={() => { signOut(); router.push('/auth/login') }} className="block w-full text-left px-3 py-2 text-sm text-gray-600">
                Sign Out ({profile?.full_name})
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Welcome */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Welcome, {profile?.full_name}</h2>
          <p className="text-gray-600 text-sm mt-1">Track and manage all maintenance issues you&apos;ve raised</p>
        </div>

        {/* Stats - Responsive Grid */}
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white p-3 sm:p-4 rounded-xl border shadow-sm">
            <div className="text-xl sm:text-2xl font-bold">{total}</div>
            <div className="text-[11px] sm:text-sm text-gray-500">Total</div>
          </div>
          <div className="bg-yellow-50/70 p-3 sm:p-4 rounded-xl border border-yellow-200">
            <div className="text-xl sm:text-2xl font-bold text-yellow-700">{open}</div>
            <div className="text-[11px] sm:text-sm text-yellow-700">Open</div>
          </div>
          <div className="bg-blue-50/70 p-3 sm:p-4 rounded-xl border border-blue-200">
            <div className="text-xl sm:text-2xl font-bold text-blue-700">{inProgress}</div>
            <div className="text-[11px] sm:text-sm text-blue-700">In Progress</div>
          </div>
          <div className="bg-green-50/70 p-3 sm:p-4 rounded-xl border border-green-200">
            <div className="text-xl sm:text-2xl font-bold text-green-700">{completed}</div>
            <div className="text-[11px] sm:text-sm text-green-700">Done</div>
          </div>
          <div className="bg-red-50/70 p-3 sm:p-4 rounded-xl border border-red-200 col-span-3 lg:col-span-1">
            <div className="text-xl sm:text-2xl font-bold text-red-700">{overdue}</div>
            <div className="text-[11px] sm:text-sm text-red-700">Overdue</div>
          </div>
        </div>

        {/* Jobs List */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-gray-50/50">
            <h3 className="font-semibold text-base sm:text-lg">Your Job Cards</h3>
            <div className="text-xs sm:text-sm text-gray-500 bg-white px-2 py-1 rounded-full border">{jobs.length} issues</div>
          </div>

          {jobs.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">📋</div>
              <h4 className="font-semibold mb-2">No jobs yet</h4>
              <p className="text-gray-500 text-sm mb-4 max-w-sm mx-auto">Create your first maintenance job to get started. It will work on mobile and desktop.</p>
              <Link href="/admin/create-job" className="inline-block px-6 py-2.5 bg-black text-white rounded-lg text-sm font-semibold">
                Create Job Card
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {jobs.map((job) => {
                const priority = getPriorityConfig(job.priority)
                const status = getStatusConfig(job.status)
                const issuePhotos = job.photos?.filter((p: any) => p.type === 'issue') || []
                const assignees = job.assignments?.map((a: any) => a.personnel?.full_name).filter(Boolean) || []

                return (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="block hover:bg-gray-50 transition p-4 sm:p-6">
                    {/* Mobile Layout */}
                    <div className="sm:hidden space-y-3">
                      <div className="flex gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          {issuePhotos[0] ? (
                            <img src={issuePhotos[0].url} alt="Issue" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">📷</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">{job.title}</h4>
                          <p className="text-xs text-gray-500 mt-1">📍 {job.location}</p>
                          <div className="flex gap-1.5 mt-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priority.color}`}>
                              {priority.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{job.required_actions}</p>
                      <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
                        <span>🏢 {job.departments?.slice(0,2).join(', ')}</span>
                        <span>👥 {assignees.length ? assignees.slice(0,2).join(', ') : 'Unassigned'}</span>
                        <span>📅 {formatDate(job.created_at)}</span>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:flex gap-4">
                      <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {issuePhotos[0] ? (
                          <img src={issuePhotos[0].url} alt="Issue" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl">📷</div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h4 className="font-semibold text-gray-900 truncate pr-2">{job.title}</h4>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${priority.color}`}>
                              {priority.label}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs text-gray-600 mb-2">
                          <div className="truncate">📍 {job.location}</div>
                          <div className="truncate">🏢 {job.departments?.join(', ')}</div>
                          <div>📅 {formatDate(job.observed_at)}</div>
                          <div className="truncate">👥 {assignees.length ? assignees.join(', ') : 'Unassigned'}</div>
                        </div>

                        <p className="text-sm text-gray-600 line-clamp-2">{job.required_actions}</p>

                        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 flex-wrap">
                          <span>Created {formatDate(job.created_at)}</span>
                          {job.started_at && <span className="text-blue-600">Started {formatDate(job.started_at)}</span>}
                          {job.completed_at && <span className="text-green-600">Completed {formatDate(job.completed_at)}</span>}
                          {job.due_date && <span className={new Date(job.due_date?.toDate ? job.due_date.toDate() : job.due_date) < new Date() ? 'text-red-600 font-bold' : ''}>Due {formatDate(job.due_date)}</span>}
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
