'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase/client'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { formatDate, getPriorityConfig, getStatusConfig } from '@/lib/utils'

interface AssignmentWithJob { id: string; job_id: string; status: string; personnel_id: string; job?: any }

export default function OperatorPage() {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const [assignments, setAssignments] = useState<AssignmentWithJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => { if (!loading && !user) router.push('/auth/login') }, [user, loading, router])
  useEffect(() => { if (user && profile) fetchAssignments() }, [user, profile])

  const fetchAssignments = async () => {
    try {
      const personnelQ = query(collection(db, 'personnel'), where('email', '==', profile?.email || user?.email))
      const personnelSnap = await getDocs(personnelQ)
      let personnelId = null
      if (!personnelSnap.empty) personnelId = personnelSnap.docs[0].id
      let allAssignments: AssignmentWithJob[] = []
      if (personnelId) {
        const q = query(collection(db, 'jobAssignments'), where('personnel_id', '==', personnelId))
        const snap = await getDocs(q)
        for (const docSnap of snap.docs) {
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
      }
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
      allAssignments.sort((a, b) => {
        const aTime = a.job?.created_at?.toDate ? a.job.created_at.toDate().getTime() : new Date(a.job?.created_at || 0).getTime()
        const bTime = b.job?.created_at?.toDate ? b.job.created_at.toDate().getTime() : new Date(b.job?.created_at || 0).getTime()
        return bTime - aTime
      })
      setAssignments(allAssignments)
    } catch (e) { console.error(e) } finally { setLoadingJobs(false) }
  }

  if (loading || loadingJobs) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>

  const unopened = assignments.filter(a => a.status === 'unopened').length
  const opened = assignments.filter(a => ['opened', 'started'].includes(a.status)).length
  const completed = assignments.filter(a => a.job?.status === 'completed').length
  const overdue = assignments.filter(a => a.job?.status === 'overdue').length

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10"><div className="max-w-7xl mx-auto px-4 h-14 flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center"><span className="text-black font-bold text-sm">YF</span></div><div><h1 className="font-medium text-white text-sm">Operator Console</h1><p className="text-[11px] text-zinc-400">{profile?.full_name}</p></div></div><div className="hidden md:flex"><button onClick={() => { signOut(); router.push('/auth/login') }} className="text-sm text-zinc-400 hover:text-white border border-zinc-700 px-3 py-1.5 rounded-lg">Sign out</button></div><button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300">{mobileMenuOpen ? '✕' : '☰'}</button></div>{mobileMenuOpen && <div className="md:hidden px-4 py-3 border-t border-zinc-800"><button onClick={() => { signOut(); router.push('/auth/login') }} className="w-full text-left px-3 py-2 border border-zinc-700 rounded-lg text-sm text-zinc-300">Sign out</button></div>}</header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6"><h2 className="text-2xl font-semibold text-white tracking-tight">Assigned Jobs</h2><p className="text-sm text-zinc-400 mt-1">{assignments.length} jobs allocated to you</p></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl"><div className="text-2xl font-semibold text-amber-400">{unopened}</div><div className="text-xs text-zinc-400 mt-1">New</div></div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl"><div className="text-2xl font-semibold text-blue-400">{opened}</div><div className="text-xs text-zinc-400 mt-1">In Progress</div></div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl"><div className="text-2xl font-semibold text-emerald-400">{completed}</div><div className="text-xs text-zinc-400 mt-1">Completed</div></div>
          <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-xl"><div className="text-2xl font-semibold text-red-400">{overdue}</div><div className="text-xs text-red-300/70 mt-1">Overdue</div></div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800"><h3 className="font-medium text-white">All Jobs</h3></div>
          {assignments.length === 0 ? <div className="p-12 text-center"><div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-3">📭</div><h4 className="font-medium text-white">No jobs assigned</h4><p className="text-sm text-zinc-400 mt-1">Jobs will appear here when assigned</p></div> : <div className="divide-y divide-zinc-800">{assignments.map(a => {
            const job = a.job; if (!job) return null
            const priority = getPriorityConfig(job.priority); const status = getStatusConfig(job.status); const issuePhotos = job.photos?.filter((p: any) => p.type === 'issue') || []
            return <Link key={a.id} href={`/jobs/${job.id}`} className="block hover:bg-zinc-800/50 p-4 transition"><div className="flex gap-3"><div className="w-16 h-16 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-700">{issuePhotos[0] ? <img src={issuePhotos[0].url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-500">📷</div>}</div><div className="flex-1 min-w-0"><div className="flex justify-between gap-2"><h4 className="font-medium text-white text-sm truncate">{job.title}</h4><div className="flex gap-1.5 flex-shrink-0">{a.status === 'unopened' && <span className="px-2 py-0.5 bg-amber-500 text-black rounded-full text-[10px] font-bold">NEW</span>}<span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priority.color}`}>{priority.label}</span></div></div><p className="text-xs text-zinc-400 mt-1">{job.location} • {formatDate(job.created_at)}</p><p className="text-xs text-zinc-400 line-clamp-1 mt-1">{job.required_actions}</p></div></div></Link>
          })}</div>}
        </div>
      </main>
    </div>
  )
}
