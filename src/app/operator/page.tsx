'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase/client'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { formatDate, getPriorityConfig, getStatusConfig } from '@/lib/utils'

interface AssignmentWithJob {
  id: string
  job_id: string
  status: string
  personnel_id: string
  job?: any
}

export default function OperatorPage() {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const [assignments, setAssignments] = useState<AssignmentWithJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user && profile) fetchAssignments()
  }, [user, profile])

  const fetchAssignments = async () => {
    try {
      // Find personnel by email
      const personnelQ = query(collection(db, 'personnel'), where('email', '==', profile?.email || user?.email))
      const personnelSnap = await getDocs(personnelQ)
      let personnelId = null
      if (!personnelSnap.empty) {
        personnelId = personnelSnap.docs[0].id
      }

      let allAssignments: AssignmentWithJob[] = []

      if (personnelId) {
        const q = query(collection(db, 'jobAssignments'), where('personnel_id', '==', personnelId))
        const snap = await getDocs(q)
        for (const docSnap of snap.docs) {
          const data = docSnap.data()
          // Get job
          const jobDoc = await getDoc(doc(db, 'jobCards', data.job_id))
          let jobData = null
          if (jobDoc.exists()) {
            jobData = { id: jobDoc.id, ...jobDoc.data() }
            // Get photos
            const photosQ = query(collection(db, 'jobPhotos'), where('job_id', '==', data.job_id))
            const photosSnap = await getDocs(photosQ)
            jobData.photos = photosSnap.docs.map(d => d.data())
          }
          allAssignments.push({ id: docSnap.id, job_id: data.job_id, status: data.status, personnel_id: data.personnel_id, job: jobData })
        }
      }

      // Also by profile_id
      const q2 = query(collection(db, 'jobAssignments'), where('profile_id', '==', user!.uid))
      const snap2 = await getDocs(q2)
      for (const docSnap of snap2.docs) {
        if (allAssignments.find(a => a.job_id === docSnap.data().job_id)) continue
        const data = docSnap.data()
        const jobDoc = await getDoc(doc(db, 'jobCards', data.job_id))
        let jobData = null
        if (jobDoc.exists()) {
          jobData = { id: jobDoc.id, ...jobDoc.data() }
          const photosQ = query(collection(db, 'jobPhotos'), where('job_id', '==', data.job_id))
          const photosSnap = await getDocs(photosQ)
          jobData.photos = photosSnap.docs.map(d => d.data())
        }
        allAssignments.push({ id: docSnap.id, job_id: data.job_id, status: data.status, personnel_id: data.personnel_id, job: jobData })
      }

      // Sort by created_at desc via job
      allAssignments.sort((a, b) => {
        const aTime = a.job?.created_at?.toDate ? a.job.created_at.toDate().getTime() : new Date(a.job?.created_at || 0).getTime()
        const bTime = b.job?.created_at?.toDate ? b.job.created_at.toDate().getTime() : new Date(b.job?.created_at || 0).getTime()
        return bTime - aTime
      })

      setAssignments(allAssignments)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingJobs(false)
    }
  }

  if (loading || loadingJobs) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const unopened = assignments.filter(a => a.status === 'unopened').length
  const opened = assignments.filter(a => ['opened', 'started'].includes(a.status)).length
  const completed = assignments.filter(a => a.job?.status === 'completed').length
  const overdue = assignments.filter(a => a.job?.status === 'overdue').length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm flex-shrink-0">🔧</div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base leading-tight truncate">Operator Hub</h1>
              <p className="text-[11px] sm:text-xs text-gray-500 truncate">{profile?.full_name} • {profile?.email}</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => { signOut(); router.push('/auth/login') }} className="text-sm text-gray-600 hover:text-black border px-3 py-1.5 rounded-lg">Sign Out</button>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 border rounded-lg">
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden px-4 py-3 border-t">
            <button onClick={() => { signOut(); router.push('/auth/login') }} className="w-full text-left px-3 py-2 border rounded-lg text-sm">Sign Out</button>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 sm:py-8">
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">Your Assigned Jobs</h2>
          <p className="text-gray-600 text-xs sm:text-sm mt-1">Jobs allocated to you. Tap to view, start, and complete. Fully mobile responsive.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6">
          <div className="bg-white p-3 sm:p-4 rounded-xl border shadow-sm">
            <div className="text-xl sm:text-2xl font-bold text-orange-600">{unopened}</div>
            <div className="text-[11px] sm:text-sm text-gray-600">Unopened</div>
            <div className="text-[10px] text-orange-600 font-medium mt-1">NEW • Tap to start</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-xl border shadow-sm">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">{opened}</div>
            <div className="text-[11px] sm:text-sm text-gray-600">In Progress</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-xl border shadow-sm">
            <div className="text-xl sm:text-2xl font-bold text-green-600">{completed}</div>
            <div className="text-[11px] sm:text-sm text-gray-600">Completed</div>
          </div>
          <div className="bg-red-50 p-3 sm:p-4 rounded-xl border border-red-200">
            <div className="text-xl sm:text-2xl font-bold text-red-600">{overdue}</div>
            <div className="text-[11px] sm:text-sm text-red-700">Overdue</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-semibold text-sm sm:text-base">All Allocated Jobs ({assignments.length})</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Firebase Live</span>
          </div>

          {assignments.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="text-4xl mb-4">📭</div>
              <h4 className="font-semibold text-sm sm:text-base">No jobs assigned yet</h4>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-sm mx-auto">When a manager assigns you, you&apos;ll get an email with a link. Jobs will appear here on mobile and desktop.</p>
            </div>
          ) : (
            <div className="divide-y">
              {assignments.map((assignment) => {
                const job = assignment.job
                if (!job) return null
                const priority = getPriorityConfig(job.priority)
                const status = getStatusConfig(job.status)
                const issuePhotos = job.photos?.filter((p: any) => p.type === 'issue') || []

                return (
                  <Link key={assignment.id} href={`/jobs/${job.id}`} className="block hover:bg-gray-50 p-4 sm:p-6 transition">
                    {/* Mobile */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex gap-3">
                        <div className="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          {issuePhotos[0] ? (
                            <img src={issuePhotos[0].url} alt="Issue" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">📷</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm line-clamp-2 leading-tight">{job.title}</h4>
                          <p className="text-[11px] text-gray-500 mt-1 truncate">📍 {job.location} • {job.createdByName || 'Manager'}</p>
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {assignment.status === 'unopened' && (
                              <span className="px-2 py-0.5 bg-orange-500 text-white rounded-full text-[10px] font-bold animate-pulse">NEW</span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priority.color}`}>{priority.label}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${status.color}`}>{status.label}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{job.required_actions}</p>
                      <div className="text-[11px] text-gray-500">
                        Your status: <span className={assignment.status === 'unopened' ? 'text-orange-600 font-bold' : 'font-medium'}>{assignment.status.toUpperCase()}</span>
                        {job.due_date && <span className="ml-2">Due: {formatDate(job.due_date)}</span>}
                      </div>
                    </div>

                    {/* Desktop */}
                    <div className="hidden sm:flex gap-4">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {issuePhotos[0] ? (
                          <img src={issuePhotos[0].url} alt="Issue" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">📷</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-semibold truncate pr-2">{job.title}</h4>
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
                          <span>👤 {job.createdByName || 'Manager'}</span>
                          <span>📅 {formatDate(job.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{job.required_actions}</p>
                        <div className="mt-2 flex gap-3 text-xs">
                          <span className={assignment.status === 'unopened' ? 'text-orange-600 font-bold' : 'text-gray-500'}>
                            Your status: {assignment.status.toUpperCase()}
                          </span>
                          {job.due_date && (
                            <span className={new Date(job.due_date?.toDate ? job.due_date.toDate() : job.due_date) < new Date() ? 'text-red-600 font-bold' : 'text-gray-500'}>
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

        <div className="mt-6 sm:mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs sm:text-sm">
          <strong>How it works (Firebase):</strong> When you click an email job link, the job auto-opens and marks as STARTED. First open time = job start time. Add estimated time + plan. Others see previous commits. Upload completion photo to finish. All real-time on mobile & desktop.
        </div>
      </main>
    </div>
  )
}
