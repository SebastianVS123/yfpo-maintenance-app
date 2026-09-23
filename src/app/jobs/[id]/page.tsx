'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase/client'
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore'
import { getPriorityConfig, getStatusConfig, formatDate } from '@/lib/utils'

export default function JobDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, profile } = useAuth()
  const jobId = params.id as string
  const isCreated = searchParams.get('created') === 'true'
  const [job, setJob] = useState<any>(null)
  const [commits, setCommits] = useState<any[]>([])
  const [photos, setPhotos] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [userAssignment, setUserAssignment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [isAssignee, setIsAssignee] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [planForm, setPlanForm] = useState({ estimated_time: '', message: '' })
  const [completionForm, setCompletionForm] = useState({ notes: '', photo: null as File | null, photoPreview: '' })

  useEffect(() => { if (!user) return; fetchJob() }, [user, jobId])

  const fetchJob = async () => {
    try {
      const jobDoc = await getDoc(doc(db, 'jobCards', jobId))
      if (!jobDoc.exists()) { setLoading(false); return }
      const jobData: any = { id: jobDoc.id, ...jobDoc.data() }
      setJob(jobData)
      const photosQ = query(collection(db, 'jobPhotos'), where('job_id', '==', jobId))
      const photosSnap = await getDocs(photosQ)
      setPhotos(photosSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      const assignmentsQ = query(collection(db, 'jobAssignments'), where('job_id', '==', jobId))
      const assignmentsSnap = await getDocs(assignmentsQ)
      const assignmentsData = []
      let currentUserAssignment = null
      for (const aDoc of assignmentsSnap.docs) {
        const aData = { id: aDoc.id, ...aDoc.data() } as any
        let personnelData = null
        if (aData.personnel_id) { const pDoc = await getDoc(doc(db, 'personnel', aData.personnel_id)); if (pDoc.exists()) personnelData = { id: pDoc.id, ...pDoc.data() } }
        let profileData = null
        if (aData.profile_id) { const uDoc = await getDoc(doc(db, 'users', aData.profile_id)); if (uDoc.exists()) profileData = uDoc.data() }
        const enriched = { ...aData, personnel: personnelData, profile: profileData }
        assignmentsData.push(enriched)
        if (personnelData && (personnelData as any).email === profile?.email) currentUserAssignment = enriched
        if (aData.profile_id === user?.uid) currentUserAssignment = enriched
      }
      setAssignments(assignmentsData)
      setUserAssignment(currentUserAssignment)
      setIsAssignee(!!currentUserAssignment)
      setIsManager(profile?.role === 'manager' || profile?.role === 'admin' || (jobData as any).created_by === user?.uid)
      const commitsQ = query(collection(db, 'jobCommits'), where('job_id', '==', jobId))
      const commitsSnap = await getDocs(commitsQ)
      const commitsData = commitsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))
      commitsData.sort((a, b) => {
        const aTime = a.created_at?.toDate ? a.created_at.toDate().getTime() : new Date(a.created_at).getTime()
        const bTime = b.created_at?.toDate ? b.created_at.toDate().getTime() : new Date(b.created_at).getTime()
        return aTime - bTime
      })
      setCommits(commitsData)
      if (currentUserAssignment && currentUserAssignment.status === 'unopened') {
        await updateDoc(doc(db, 'jobAssignments', currentUserAssignment.id), { status: 'opened', opened_at: new Date() })
        if (jobData.status === 'open') {
          await updateDoc(doc(db, 'jobCards', jobId), { status: 'started', started_at: jobData.started_at || new Date(), updated_at: new Date() })
          await addDoc(collection(db, 'jobCommits'), { job_id: jobId, user_id: user!.uid, userName: profile?.full_name || user?.email, userEmail: profile?.email || user?.email, message: `Job started by ${profile?.full_name || user?.email}`, type: 'status_update', created_at: new Date() })
          setJob((prev: any) => ({ ...prev, status: 'started', started_at: prev.started_at || new Date() }))
        }
        setUserAssignment((prev: any) => ({ ...prev, status: 'opened' }))
      }
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!planForm.message.trim()) return
    setActionLoading(true)
    try {
      await addDoc(collection(db, 'jobCommits'), { job_id: jobId, user_id: user!.uid, userName: profile?.full_name, userEmail: profile?.email, message: planForm.message, estimated_time: planForm.estimated_time || null, type: 'plan', created_at: new Date() })
      if (planForm.estimated_time && !job.estimated_time) await updateDoc(doc(db, 'jobCards', jobId), { estimated_time: planForm.estimated_time, status: job.status === 'started' ? 'in_progress' : job.status, updated_at: new Date() })
      else if (job.status === 'started') await updateDoc(doc(db, 'jobCards', jobId), { status: 'in_progress', updated_at: new Date() })
      if (userAssignment) await updateDoc(doc(db, 'jobAssignments', userAssignment.id), { status: 'started' })
      setPlanForm({ estimated_time: '', message: '' })
      fetchJob()
    } catch (err: any) { alert(err.message) } finally { setActionLoading(false) }
  }

  const handleCompletionPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setCompletionForm({ ...completionForm, photo: file, photoPreview: URL.createObjectURL(file) })
    }
  }

  const handleCompleteJob = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!completionForm.photo) return alert('Photo required')
    setActionLoading(true)
    try {
      const fd = new FormData(); fd.append('file', completionForm.photo); fd.append('jobId', jobId); fd.append('type', 'completion')
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const uploadData = await uploadRes.json()
      const publicUrl = uploadData.url
      await addDoc(collection(db, 'jobPhotos'), { job_id: jobId, url: publicUrl, type: 'completion', file_name: completionForm.photo.name, uploaded_by: user!.uid, created_at: new Date() })
      await updateDoc(doc(db, 'jobCards', jobId), { status: 'completed', completed_at: new Date(), completion_notes: completionForm.notes, updated_at: new Date() })
      if (userAssignment) await updateDoc(doc(db, 'jobAssignments', userAssignment.id), { status: 'completed' })
      await addDoc(collection(db, 'jobCommits'), { job_id: jobId, user_id: user!.uid, userName: profile?.full_name, userEmail: profile?.email, message: `Completed: ${completionForm.notes}`, type: 'status_update', created_at: new Date() })
      try { await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'completion', jobId, title: job.title, location: job.location, completedBy: profile?.full_name || user?.email, completedByEmail: profile?.email || user?.email, completionPhoto: publicUrl, finalNotes: completionForm.notes, createdByEmail: job.createdByEmail, appUrl: window.location.origin, startedAt: job.started_at, completedAt: new Date() }) }) } catch {}
      alert('Job completed!')
      router.push(isManager ? '/admin' : '/operator')
    } catch (err: any) { alert(err.message) } finally { setActionLoading(false) }
  }

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>
  if (!job) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4"><div className="text-center"><h1 className="text-white font-medium">Job not found</h1><Link href="/dashboard" className="text-zinc-400 underline text-sm mt-2 block">Back</Link></div></div>

  const priority = getPriorityConfig(job.priority)
  const status = getStatusConfig(job.status)
  const issuePhotos = photos.filter(p => p.type === 'issue')
  const completionPhotos = photos.filter(p => p.type === 'completion')

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-20"><div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between"><Link href={isManager ? '/admin' : '/operator'} className="text-sm text-zinc-400 hover:text-white">← Back</Link><div className="flex gap-2"><span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${priority.color}`}>{priority.label}</span><span className={`px-2.5 py-1 rounded-full text-xs ${status.color}`}>{status.label}</span></div></div></header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {isCreated && <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 mb-6"><h3 className="font-medium text-white text-sm">Job Card Created</h3><p className="text-xs text-zinc-400 mt-1">Assigned personnel will be notified.</p></div>}
        {userAssignment?.status === 'opened' && <div className="bg-blue-950/30 border border-blue-900/50 rounded-xl p-4 mb-6"><h3 className="font-medium text-blue-200 text-sm">Job Started</h3><p className="text-xs text-blue-300/70 mt-1">Marked as started. Add your plan below.</p></div>}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h1 className="text-xl font-semibold text-white tracking-tight">{job.title}</h1>
              <div className="flex flex-wrap gap-3 text-xs text-zinc-400 mt-2 mb-4"><span>{job.location}</span><span>{job.departments?.join(', ')}</span><span>{job.createdByName}</span></div>
              <div className="grid sm:grid-cols-2 gap-3 text-xs bg-zinc-800 border border-zinc-700 p-4 rounded-lg"><div className="text-zinc-300"><span className="text-zinc-500">Observed:</span> {formatDate(job.observed_at)}</div><div className="text-zinc-300"><span className="text-zinc-500">Created:</span> {formatDate(job.created_at)}</div>{job.started_at && <div className="text-zinc-300"><span className="text-zinc-500">Started:</span> {formatDate(job.started_at)}</div>}{job.completed_at && <div className="text-zinc-300"><span className="text-zinc-500">Completed:</span> {formatDate(job.completed_at)}</div>}{job.due_date && <div className="text-zinc-300"><span className="text-zinc-500">Due:</span> {formatDate(job.due_date)}</div>}{job.estimated_time && <div className="text-zinc-300"><span className="text-zinc-500">Est:</span> {job.estimated_time}</div>}</div>
              <h3 className="font-medium text-white mt-5 mb-2 text-sm">Required Actions</h3><p className="bg-zinc-800 border border-zinc-700 p-4 rounded-lg text-sm text-zinc-300 whitespace-pre-wrap">{job.required_actions}</p>
              <h3 className="font-medium text-white mt-5 mb-3 text-sm">Photos ({issuePhotos.length})</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{issuePhotos.map((p: any) => <a key={p.id} href={p.url} target="_blank"><img src={p.url} className="w-full h-32 object-cover rounded-lg border border-zinc-700 hover:opacity-80" /></a>)}{issuePhotos.length === 0 && <p className="text-xs text-zinc-500">No photos</p>}</div>
              {completionPhotos.length > 0 && <><h3 className="font-medium text-white mt-5 mb-3 text-sm">Completion</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{completionPhotos.map((p: any) => <img key={p.id} src={p.url} className="w-full h-32 object-cover rounded-lg border border-emerald-800" />)}</div>{job.completion_notes && <div className="bg-zinc-800 border border-zinc-700 p-3 rounded-lg text-sm text-zinc-300 mt-3">{job.completion_notes}</div>}</>}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-zinc-800"><h3 className="font-medium text-white">Action Plan & Updates</h3></div>
              <div className="p-5 space-y-3 max-h-96 overflow-y-auto">{commits.length === 0 ? <p className="text-sm text-zinc-500 text-center py-8">No updates yet</p> : commits.map((c: any) => <div key={c.id} className="border-l-2 border-zinc-700 pl-4 py-2"><div className="flex justify-between"><span className="font-medium text-white text-sm">{c.userName}</span><span className="text-xs text-zinc-500">{formatDate(c.created_at)}</span></div>{c.estimated_time && <div className="text-xs text-zinc-400 mt-1">⏱ {c.estimated_time}</div>}<p className="text-sm text-zinc-300 mt-1">{c.message}</p></div>)}</div>
              {isAssignee && job.status !== 'completed' && <div className="p-5 border-t border-zinc-800 bg-zinc-800/50"><form onSubmit={handleAddPlan} className="space-y-3"><input value={planForm.estimated_time} onChange={e => setPlanForm({ ...planForm, estimated_time: e.target.value })} placeholder="Estimated time" className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-sm" /><textarea required rows={3} value={planForm.message} onChange={e => setPlanForm({ ...planForm, message: e.target.value })} placeholder="Your plan..." className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-sm" /><button disabled={actionLoading} className="w-full bg-white text-black py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">{actionLoading ? 'Saving...' : 'Add Update'}</button></form></div>}
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"><h3 className="font-medium text-white mb-3 text-sm">Assigned</h3><div className="space-y-2">{assignments.map((a: any) => <div key={a.id} className="flex justify-between items-center p-2.5 bg-zinc-800 rounded-lg border border-zinc-700"><div><div className="text-sm text-white">{a.personnel?.full_name || a.profile?.full_name}</div><div className="text-xs text-zinc-400">{a.personnel?.email}</div></div><span className="text-xs px-2 py-1 bg-zinc-700 text-zinc-300 rounded-full">{a.status}</span></div>)}</div></div>
            {isAssignee && job.status !== 'completed' && <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"><h3 className="font-medium text-white mb-3 text-sm">Complete Job</h3>{!showComplete ? <button onClick={() => setShowComplete(true)} className="w-full bg-white text-black py-3 rounded-lg font-medium">Mark Completed</button> : <form onSubmit={handleCompleteJob} className="space-y-3"><input type="file" accept="image/*" capture="environment" required onChange={handleCompletionPhoto} className="w-full text-xs text-zinc-400" />{completionForm.photoPreview && <img src={completionForm.photoPreview} className="w-full h-32 object-cover rounded-lg border border-zinc-700" />}<textarea value={completionForm.notes} onChange={e => setCompletionForm({ ...completionForm, notes: e.target.value })} placeholder="Completion notes..." className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm" rows={2} /><div className="flex gap-2"><button type="button" onClick={() => setShowComplete(false)} className="flex-1 border border-zinc-700 py-2.5 rounded-lg text-sm text-zinc-300">Cancel</button><button disabled={actionLoading} className="flex-1 bg-white text-black py-2.5 rounded-lg text-sm font-medium">{actionLoading ? 'Saving...' : 'Confirm'}</button></div></form>}</div>}
          </div>
        </div>
      </main>
    </div>
  )
}
