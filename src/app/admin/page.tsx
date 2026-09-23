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
  createdByName: string
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
  const [allJobs, setAllJobs] = useState<JobCard[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my')

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login')
    if (!loading && profile && profile.role !== 'manager' && profile.role !== 'admin') router.push('/operator')
  }, [user, profile, loading, router])

  useEffect(() => { 
    if (user && profile) {
      fetchJobs()
      if (profile.role === 'admin') setViewMode('all')
    }
  }, [user, profile])

  const fetchJobs = async () => {
    try {
      // Fetch MY jobs (created by me)
      const myQ = query(collection(db, 'jobCards'), where('created_by', '==', user!.uid), orderBy('created_at', 'desc'))
      const mySnap = await getDocs(myQ)
      const myJobsData: JobCard[] = []
      for (const docSnap of mySnap.docs) {
        const data = docSnap.data()
        const photosQ = query(collection(db, 'jobPhotos'), where('job_id', '==', docSnap.id))
        const photosSnap = await getDocs(photosQ)
        const photos = photosSnap.docs.map(d => d.data())
        const assignmentsQ = query(collection(db, 'jobAssignments'), where('job_id', '==', docSnap.id))
        const assignmentsSnap = await getDocs(assignmentsQ)
        const assignments = []
        for (const aDoc of assignmentsSnap.docs) {
          const aData = aDoc.data()
          let personnelData = null
          if (aData.personnel_id) {
            try {
              const { doc, getDoc } = await import('firebase/firestore')
              const pDoc = await getDoc(doc(db, 'personnel', aData.personnel_id))
              if (pDoc.exists()) personnelData = pDoc.data()
            } catch {}
          }
          assignments.push({ ...aData, personnel: personnelData })
        }
        myJobsData.push({ id: docSnap.id, ...data, photos, assignments } as JobCard)
      }
      setJobs(myJobsData)

      // If admin, also fetch ALL jobs
      if (profile?.role === 'admin') {
        const allQ = query(collection(db, 'jobCards'), orderBy('created_at', 'desc'))
        const allSnap = await getDocs(allQ)
        const allJobsData: JobCard[] = []
        for (const docSnap of allSnap.docs) {
          const data = docSnap.data()
          const photosQ = query(collection(db, 'jobPhotos'), where('job_id', '==', docSnap.id))
          const photosSnap = await getDocs(photosQ)
          const photos = photosSnap.docs.map(d => d.data())
          const assignmentsQ = query(collection(db, 'jobAssignments'), where('job_id', '==', docSnap.id))
          const assignmentsSnap = await getDocs(assignmentsQ)
          const assignments = []
          for (const aDoc of assignmentsSnap.docs) {
            const aData = aDoc.data()
            let personnelData = null
            if (aData.personnel_id) {
              try {
                const { doc, getDoc } = await import('firebase/firestore')
                const pDoc = await getDoc(doc(db, 'personnel', aData.personnel_id))
                if (pDoc.exists()) personnelData = pDoc.data()
              } catch {}
            }
            assignments.push({ ...aData, personnel: personnelData })
          }
          allJobsData.push({ id: docSnap.id, ...data, photos, assignments } as JobCard)
        }
        setAllJobs(allJobsData)
      }
    } catch (e) { console.error(e) } finally { setLoadingJobs(false) }
  }

  if (loading || loadingJobs) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>
  }

  const isAdmin = profile?.role === 'admin'
  const displayJobs = viewMode === 'all' && isAdmin ? allJobs : jobs

  const total = displayJobs.length
  const open = displayJobs.filter(j => j.status === 'open').length
  const inProgress = displayJobs.filter(j => ['started', 'in_progress'].includes(j.status)).length
  const completed = displayJobs.filter(j => j.status === 'completed').length
  const overdue = displayJobs.filter(j => j.status === 'overdue').length

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-[64px]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center"><span className="text-black font-bold text-sm">YF</span></div>
              <div>
                <h1 className="font-semibold text-white text-sm tracking-tight">YFPO Maintenance</h1>
                <p className="text-[11px] text-zinc-400">{isAdmin ? 'Admin Console' : 'Manager Console'} • {profile?.role}</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Link href="/admin/personnel" className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700">Personnel</Link>
              <Link href="/admin/create-job" className="px-4 py-2 text-sm bg-white text-black rounded-lg hover:bg-zinc-200 font-medium">New Job</Link>
              <button onClick={() => { signOut(); router.push('/auth/login') }} className="text-sm text-zinc-400 hover:text-white px-3">Sign out</button>
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300">{mobileMenuOpen ? '✕' : '☰'}</button>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden py-3 border-t border-zinc-800 space-y-2">
              <Link href="/admin/personnel" className="block w-full px-3 py-2.5 bg-zinc-800 rounded-lg text-sm text-zinc-200">Personnel</Link>
              <Link href="/admin/create-job" className="block w-full px-3 py-2.5 bg-white text-black rounded-lg text-sm font-medium text-center">New Job</Link>
              <button onClick={() => { signOut(); router.push('/auth/login') }} className="block w-full text-left px-3 py-2 text-sm text-zinc-400">Sign out • {profile?.full_name}</button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-white tracking-tight">{isAdmin ? 'All Issued Jobs' : 'My Issued Jobs'}</h2>
          <p className="text-sm text-zinc-400 mt-1">
            {isAdmin ? `Admin view — ${allJobs.length} total jobs from all managers, ${jobs.length} issued by you` : `Manager view — Everything you issued: ${jobs.length} jobs`} • {profile?.full_name}
          </p>
        </div>

        {isAdmin && (
          <div className="flex gap-2 mb-6">
            <button onClick={() => setViewMode('my')} className={`px-4 py-2 rounded-lg text-sm border transition ${viewMode === 'my' ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'}`}>My Jobs ({jobs.length})</button>
            <button onClick={() => setViewMode('all')} className={`px-4 py-2 rounded-lg text-sm border transition ${viewMode === 'all' ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'}`}>All Jobs ({allJobs.length}) • Admin</button>
          </div>
        )}

        <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl"><div className="text-2xl font-semibold text-white">{total}</div><div className="text-xs text-zinc-400 mt-1">{viewMode === 'all' && isAdmin ? 'All Total' : 'My Total'}</div></div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl"><div className="text-2xl font-semibold text-amber-400">{open}</div><div className="text-xs text-zinc-400 mt-1">Open</div></div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl"><div className="text-2xl font-semibold text-blue-400">{inProgress}</div><div className="text-xs text-zinc-400 mt-1">In Progress</div></div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl"><div className="text-2xl font-semibold text-emerald-400">{completed}</div><div className="text-xs text-zinc-400 mt-1">Completed</div></div>
          <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-xl col-span-3 lg:col-span-1"><div className="text-2xl font-semibold text-red-400">{overdue}</div><div className="text-xs text-red-300/70 mt-1">Overdue</div></div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
            <h3 className="font-medium text-white">{viewMode === 'all' && isAdmin ? 'All Job Cards (Admin)' : 'My Issued Job Cards'}</h3>
            <span className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 px-2.5 py-1 rounded-full">{displayJobs.length} jobs</span>
          </div>

          {displayJobs.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-3">📋</div>
              <h4 className="font-medium text-white">No jobs yet</h4>
              <p className="text-sm text-zinc-400 mt-1 mb-4">{viewMode === 'my' ? 'You have not issued any jobs yet' : 'No jobs in system yet'}</p>
              <Link href="/admin/create-job" className="inline-block px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium">Create Job</Link>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {displayJobs.map(job => {
                const priority = getPriorityConfig(job.priority)
                const status = getStatusConfig(job.status)
                const issuePhotos = job.photos?.filter((p: any) => p.type === 'issue') || []
                const assignees = job.assignments?.map((a: any) => a.personnel?.full_name).filter(Boolean) || []
                return (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="block hover:bg-zinc-800/50 transition p-4">
                    <div className="flex gap-4">
                      <div className="w-20 h-20 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-700">
                        {issuePhotos[0] ? <img src={issuePhotos[0].url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-500">📷</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2 mb-1">
                          <h4 className="font-medium text-white text-sm truncate pr-2">{job.title}</h4>
                          <div className="flex gap-1.5 flex-shrink-0"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priority.color}`}>{priority.label}</span><span className={`px-2 py-0.5 rounded-full text-[10px] ${status.color}`}>{status.label}</span></div>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
                          <span>{job.location}</span>
                          <span>{job.departments?.slice(0,2).join(', ')}</span>
                          <span>{assignees.slice(0,2).join(', ') || 'Unassigned'}</span>
                          {isAdmin && viewMode === 'all' && <span className="text-zinc-500">By: {job.createdByName}</span>}
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-1 mt-2">{job.required_actions}</p>
                        <div className="flex gap-3 mt-2 text-[11px] text-zinc-500"><span>{formatDate(job.created_at)}</span>{job.started_at && <span className="text-blue-400">Started {formatDate(job.started_at)}</span>}<span>• {issuePhotos.length} photos</span></div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h4 className="text-sm font-medium text-white mb-2">Role Difference</h4>
          <div className="grid md:grid-cols-3 gap-4 text-xs">
            <div><div className="font-medium text-zinc-200 mb-1">Operator</div><ul className="text-zinc-400 space-y-1 list-disc list-inside"><li>Views only assigned jobs</li><li>Starts & completes jobs</li><li>Adds plan & photos</li></ul></div>
            <div><div className="font-medium text-zinc-200 mb-1">Manager</div><ul className="text-zinc-400 space-y-1 list-disc list-inside"><li>Creates jobs</li><li>Sees <strong className="text-white">all jobs they issued</strong></li><li>Manages personnel</li><li>Assigns only confirmed accounts</li></ul></div>
            <div><div className="font-medium text-zinc-200 mb-1">Admin</div><ul className="text-zinc-400 space-y-1 list-disc list-inside"><li>All manager powers</li><li>Sees <strong className="text-white">ALL jobs from all managers</strong></li><li>Can manage all personnel & roles</li><li>Full system access</li></ul></div>
          </div>
        </div>
      </main>
    </div>
  )
}
