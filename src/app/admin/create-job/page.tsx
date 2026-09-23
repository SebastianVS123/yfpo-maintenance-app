'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase/client'
import { collection, getDocs, addDoc } from 'firebase/firestore'
import { DEPARTMENTS } from '@/lib/utils'

interface Personnel { id: string; full_name: string; email: string; role: string }

export default function CreateJobPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [personnelList, setPersonnelList] = useState<Personnel[]>([])
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [form, setForm] = useState({ title: '', location: '', observed_at: new Date().toISOString().slice(0,16), required_actions: '', departments: [] as string[], priority: 'medium' as any, due_date: '', assignedPersonnel: [] as string[] })

  useEffect(() => { fetchPersonnel() }, [])
  const fetchPersonnel = async () => {
    const snap = await getDocs(collection(db, 'personnel'))
    // Only show personnel who have confirmed their account (has_account == true)
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter((d: any) => d.is_active !== false && d.has_account === true)
      .map(d => d as Personnel)
    setPersonnelList(list)
    
    // Also get pending count for info
    const pendingCount = snap.docs.filter(d => d.data().is_active !== false && d.data().has_account !== true).length
    if (pendingCount > 0) {
      console.log(`${pendingCount} personnel pending confirmation`)
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setPhotos(prev => [...prev, ...files])
      setPhotoPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
    }
  }
  const removePhoto = (i: number) => { setPhotos(p => p.filter((_, idx) => idx !== i)); setPhotoPreviews(p => { URL.revokeObjectURL(p[i]); return p.filter((_, idx) => idx !== i) }) }
  const toggleDept = (d: string) => setForm(prev => ({ ...prev, departments: prev.departments.includes(d) ? prev.departments.filter(x => x !== d) : [...prev.departments, d] }))
  const togglePer = (id: string) => setForm(prev => ({ ...prev, assignedPersonnel: prev.assignedPersonnel.includes(id) ? prev.assignedPersonnel.filter(x => x !== id) : [...prev.assignedPersonnel, id] }))

  const uploadToCloudinary = async (file: File, jobId: string) => {
    const fd = new FormData(); fd.append('file', file); fd.append('jobId', jobId); fd.append('type', 'issue')
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!res.ok) throw new Error('Upload failed')
    const data = await res.json(); return data.url
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.departments.length === 0) return alert('Select department')
    if (form.assignedPersonnel.length === 0) return alert('Assign someone')
    setLoading(true)
    try {
      if (!user) throw new Error('Not authenticated')
      const jobData = { title: form.title, location: form.location, observed_at: new Date(form.observed_at), required_actions: form.required_actions, departments: form.departments, priority: form.priority, due_date: form.due_date ? new Date(form.due_date) : null, created_by: user.uid, createdByName: profile?.full_name || user.email, createdByEmail: profile?.email || user.email, status: 'open', estimated_time: null, started_at: null, completed_at: null, completion_notes: null, created_at: new Date(), updated_at: new Date() }
      const jobRef = await addDoc(collection(db, 'jobCards'), jobData)
      const jobId = jobRef.id
      const photoUrls: string[] = []
      for (const photo of photos) {
        try {
          const url = await uploadToCloudinary(photo, jobId)
          photoUrls.push(url)
          await addDoc(collection(db, 'jobPhotos'), { job_id: jobId, url, type: 'issue', file_name: photo.name, uploaded_by: user.uid, created_at: new Date() })
        } catch {}
      }
      for (const pid of form.assignedPersonnel) {
        await addDoc(collection(db, 'jobAssignments'), { job_id: jobId, personnel_id: pid, profile_id: null, status: 'unopened', opened_at: null, created_at: new Date() })
      }
      const assignees = personnelList.filter(p => form.assignedPersonnel.includes(p.id))
      try {
        await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'assignment', jobId, title: jobData.title, location: jobData.location, observedAt: jobData.observed_at, requiredActions: jobData.required_actions, departments: jobData.departments, priority: jobData.priority, photos: photoUrls, createdByName: jobData.createdByName, createdByEmail: jobData.createdByEmail, assignees: assignees.map(a => ({ name: a.full_name, email: a.email })), dueDate: jobData.due_date, appUrl: window.location.origin }) })
      } catch {}
      router.push(`/jobs/${jobId}?created=true`)
    } catch (err: any) { alert(err.message) } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10"><div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between"><Link href="/admin" className="text-sm text-zinc-400 hover:text-white">← Back</Link><span className="text-sm font-medium text-white">New Job Card</span><span className="w-12"></span></div></header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 sm:p-8">
          <h1 className="text-xl font-semibold text-white tracking-tight">Raise Maintenance Issue</h1>
          <p className="text-sm text-zinc-400 mt-1 mb-6">Complete all fields to lodge job card</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><label className="text-sm text-zinc-300 mb-2 block">Issue Title *</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Hydraulic leak on Line 3" className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-white" /></div>
              <div><label className="text-sm text-zinc-300 mb-2 block">Location *</label><input required value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Plant B, Line 3" className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-white" /></div>
              <div><label className="text-sm text-zinc-300 mb-2 block">When Seen *</label><input required type="datetime-local" value={form.observed_at} onChange={e => setForm({ ...form, observed_at: e.target.value })} className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-white" /></div>
              <div className="md:col-span-2"><label className="text-sm text-zinc-300 mb-2 block">Required Actions *</label><textarea required rows={4} value={form.required_actions} onChange={e => setForm({ ...form, required_actions: e.target.value })} placeholder="What needs to be done..." className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-white" /></div>
              <div><label className="text-sm text-zinc-300 mb-2 block">Priority *</label><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as any })} className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white outline-none"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
              <div><label className="text-sm text-zinc-300 mb-2 block">Due Date</label><input type="datetime-local" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white outline-none" /></div>
              <div className="md:col-span-2"><label className="text-sm text-zinc-300 mb-2 block">Departments *</label><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{DEPARTMENTS.map(d => <label key={d} className={`p-3 border rounded-lg text-center cursor-pointer transition text-sm ${form.departments.includes(d) ? 'bg-white text-black border-white' : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'}`}><input type="checkbox" checked={form.departments.includes(d)} onChange={() => toggleDept(d)} className="hidden" />{d}</label>)}</div></div>
              <div className="md:col-span-2"><label className="text-sm text-zinc-300 mb-2 block">Photos *</label><div className="border border-dashed border-zinc-700 rounded-lg p-8 text-center hover:border-zinc-600"><input type="file" multiple accept="image/*" onChange={handlePhotoChange} id="up" className="hidden" /><label htmlFor="up" className="cursor-pointer"><div className="text-2xl mb-1">📷</div><div className="text-sm text-zinc-300">Upload photos</div><div className="text-xs text-zinc-500 mt-1">PNG, JPG up to 10MB</div></label></div>{photoPreviews.length > 0 && <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">{photoPreviews.map((p,i) => <div key={i} className="relative"><img src={p} className="w-full h-20 object-cover rounded-lg border border-zinc-700" /><button type="button" onClick={() => removePhoto(i)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full text-xs">✕</button></div>)}</div>}</div>
              <div className="md:col-span-2"><label className="text-sm text-zinc-300 mb-2 block">Assign To * (only confirmed accounts)</label>{personnelList.length === 0 ? <div className="p-4 bg-zinc-800 border border-zinc-700 rounded-lg"><div className="text-sm text-white font-medium">No confirmed personnel</div><p className="text-xs text-zinc-400 mt-1">Personnel must sign in themselves to confirm account before you can assign jobs. This prevents assigning to inactive accounts.</p><Link href="/admin/personnel" className="text-xs underline text-white mt-2 inline-block">Go to Personnel → Check pending</Link></div> : <div className="border border-zinc-700 rounded-lg max-h-60 overflow-y-auto divide-y divide-zinc-800 bg-zinc-800">{personnelList.map(per => <label key={per.id} className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-zinc-700 ${form.assignedPersonnel.includes(per.id) ? 'bg-zinc-700' : ''}`}><input type="checkbox" checked={form.assignedPersonnel.includes(per.id)} onChange={() => togglePer(per.id)} className="w-5 h-5" /><div><div className="flex items-center gap-2"><span className="text-sm text-white">{per.full_name}</span><span className="text-[10px] bg-emerald-900/40 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded-full">Confirmed</span></div><div className="text-xs text-zinc-400">{per.email}</div></div></label>)}</div>}<p className="text-xs text-zinc-500 mt-2">{personnelList.length > 0 ? `${form.assignedPersonnel.length} confirmed selected • Only confirmed can be assigned` : 'Waiting for personnel to confirm by signing in'}</p></div>
            </div>
            <div className="flex gap-3 pt-6 border-t border-zinc-800"><Link href="/admin" className="px-6 py-3 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800">Cancel</Link><button disabled={loading} className="flex-1 bg-white text-black py-3 rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50">{loading ? 'Saving...' : 'Create Job Card'}</button></div>
          </form>
        </div>
      </main>
    </div>
  )
}
