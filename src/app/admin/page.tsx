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

  useEffect(() => { if (user) fetchJobs() }, [user])

  const fetchJobs = async () => {
    try {
      const q = query(collection(db, 'jobCards'), where('created_by', '==', user!.uid), orderBy('created_at', 'desc'))
      const snap = await getDocs(q)
      const jobsData: JobCard[] = []
      for (const docSnap of snap.docs) {
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
        jobsData.push({ id: docSnap.id, ...data, photos, assignments } as JobCard)
      }
      setJobs(jobsData)
    } catch (e) { console.error(e) } finally { setLoadingJobs(false) }
  }

  if (loading || loadingJobs) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const total = jobs.length
  const open = jobs.filter(j => j.status === 'open').length
  const inProgress = jobs.filter(j => ['started', 'in_progress'].includes(j.status)).length
  const completed = jobs.filter(j => j.status === 'completed').length
  const overdue = jobs.filter(j => j.status === 'overdue').length

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-[64px]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center"><span className="text-black font-bold text-sm">YF</span></div>
              <div>
                <h1 className="font-semibold text-white text-sm tracking-tight">YFPO Maintenance</h1>
                <p className="text-[11px] text-zinc-400">Manager Console</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Link href="/admin/personnel" className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 transition">Personnel</Link>
              <Link href="/admin/create-job" className="px-4 py-2 text-sm bg-white text-black rounded-lg hover:bg-zinc-200 font-medium transition">New Job</Link>
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
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-white tracking-tight">Overview</h2>
          <p className="text-sm text-zinc-400 mt-1">Welcome back, {profile?.full_name} — {total} total jobs</p>
        </div>

        <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl"><div className="text-2xl font-semibold text-white">{total}</div><div className="text-xs text-zinc-400 mt-1">Total</div></div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl"><div className="text-2xl font-semibold text-amber-400">{open}</div><div className="text-xs text-zinc-400 mt-1">Open</div></div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl"><div className="text-2xl font-semibold text-blue-400">{inProgress}</div><div className="text-xs text-zinc-400 mt-1">In Progress</div></div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl"><div className="text-2xl font-semibold text-emerald-400">{completed}</div><div className="text-xs text-zinc-400 mt-1">Completed</div></div>
          <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-xl col-span-3 lg:col-span-1"><div className="text-2xl font-semibold text-red-400">{overdue}</div><div className="text-xs text-red-300/70 mt-1">Overdue</div></div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
            <h3 className="font-medium text-white">Job Cards</h3>
            <span className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 px-2.5 py-1 rounded-full">{jobs.length}</span>
          </div>

          {jobs.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-3">📋</div>
              <h4 className="font-medium text-white">No jobs yet</h4>
              <p className="text-sm text-zinc-400 mt-1 mb-4">Create your first maintenance job</p>
              <Link href="/admin/create-job" className="inline-block px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium">Create Job</Link>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {jobs.map(job => {
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
                        <div className="flex justify-between gap-2 mb-1"><h4 className="font-medium text-white text-sm truncate pr-2">{job.title}</h4><div className="flex gap-1.5 flex-shrink-0"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priority.color}`}>{priority.label}</span><span className={`px-2 py-0.5 rounded-full text-[10px] ${status.color}`}>{status.label}</span></div></div>
                        <div className="flex flex-wrap gap-3 text-xs text-zinc-400"><span>{job.location}</span><span>{job.departments?.slice(0,2).join(', ')}</span><span>{assignees.slice(0,2).join(', ') || 'Unassigned'}</span></div>
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
      </main>
    </div>
  )
}
