'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { db } from '@/lib/firebase/client'
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'

interface Personnel { id: string; full_name: string; email: string; role: string; department?: string; is_active: boolean; has_account?: boolean; user_id?: string; confirmed_at?: any; created_at: any }

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', role: 'operator' as any, department: '' })
  const [submitting, setSubmitting] = useState(false)
  const { user } = useAuth()

  useEffect(() => { fetchPersonnel() }, [])
  const fetchPersonnel = async () => {
    try { const snap = await getDocs(query(collection(db, 'personnel'), orderBy('created_at', 'desc'))); setPersonnel(snap.docs.map(d => ({ id: d.id, ...d.data() } as Personnel))) } catch {} finally { setLoading(false) }
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true)
    try { 
      await addDoc(collection(db, 'personnel'), { 
        full_name: form.full_name, 
        email: form.email.toLowerCase().trim(), 
        role: form.role, 
        department: form.department || null, 
        created_by: user?.uid, 
        is_active: true, 
        has_account: false,
        user_id: null,
        confirmed_at: null,
        created_at: new Date() 
      }); 
      setForm({ full_name: '', email: '', role: 'operator', department: '' }); 
      setShowForm(false); 
      fetchPersonnel() 
    } catch (err: any) { alert(err.message) } finally { setSubmitting(false) }
  }
  const toggleActive = async (id: string, cur: boolean) => { await updateDoc(doc(db, 'personnel', id), { is_active: !cur }); fetchPersonnel() }
  const deleteP = async (id: string) => { if (!confirm('Delete?')) return; await deleteDoc(doc(db, 'personnel', id)); fetchPersonnel() }

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>

  const confirmed = personnel.filter(p => p.has_account)
  const pending = personnel.filter(p => !p.has_account)

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10"><div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between"><Link href="/admin" className="text-sm text-zinc-400 hover:text-white">← Dashboard</Link><h1 className="font-medium text-white text-sm">Personnel</h1><button onClick={() => setShowForm(!showForm)} className="px-3 py-2 bg-white text-black rounded-lg text-sm font-medium">{showForm ? 'Cancel' : '+ Add'}</button></div></header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {showForm && <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6"><h3 className="font-medium text-white mb-2">Add Personnel</h3><p className="text-xs text-zinc-400 mb-4">They must sign in themselves to confirm account before you can assign jobs to them.</p><form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-3"><input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Full Name" className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500" /><input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500" /><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })} className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"><option value="operator">Operator</option><option value="manager">Manager</option><option value="admin">Admin</option></select><input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="Department" className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500" /><button disabled={submitting} className="sm:col-span-2 w-full bg-white text-black py-2.5 rounded-lg font-medium disabled:opacity-50">{submitting ? 'Adding...' : 'Add Personnel'}</button></form></div>}

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-4"><div className="text-lg font-semibold text-emerald-400">{confirmed.length}</div><div className="text-xs text-emerald-300/70">Confirmed - Can be assigned jobs</div></div>
          <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-4"><div className="text-lg font-semibold text-amber-400">{pending.length}</div><div className="text-xs text-amber-300/70">Pending - Must sign in to confirm</div></div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800"><h2 className="font-medium text-white">All Personnel ({personnel.length})</h2><p className="text-xs text-zinc-400 mt-1">Only confirmed accounts can be assigned jobs</p></div>
          <div className="divide-y divide-zinc-800">
            {personnel.map(p => (
              <div key={p.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-sm">{p.full_name}</span>
                    {p.has_account ? <span className="text-[10px] bg-emerald-900/40 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full">Confirmed</span> : <span className="text-[10px] bg-amber-900/40 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full">Pending</span>}
                    {!p.is_active && <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded-full">Inactive</span>}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">{p.email} • {p.role} {p.department ? `• ${p.department}` : ''}</div>
                  {p.has_account && p.confirmed_at && <div className="text-[11px] text-zinc-500 mt-1">Confirmed: {new Date(p.confirmed_at?.toDate ? p.confirmed_at.toDate() : p.confirmed_at).toLocaleString()}</div>}
                  {!p.has_account && <div className="text-[11px] text-amber-300/70 mt-1">Waiting for user to sign in and create password</div>}
                </div>
                <div className="flex gap-2 ml-3">
                  <button onClick={() => toggleActive(p.id, p.is_active)} className="text-xs border border-zinc-700 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:bg-zinc-800">{p.is_active ? 'Deactivate' : 'Activate'}</button>
                  <button onClick={() => deleteP(p.id)} className="text-xs border border-red-900/50 text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-950/30">Delete</button>
                </div>
              </div>
            ))}
            {personnel.length === 0 && <div className="p-8 text-center text-sm text-zinc-500">No personnel yet</div>}
          </div>
        </div>

        <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h4 className="text-sm font-medium text-white mb-2">How confirmation works</h4>
          <ul className="text-xs text-zinc-400 space-y-1 list-disc list-inside">
            <li>Manager adds personnel email here → Status = Pending</li>
            <li>Personnel goes to /auth/signup → Uses SAME email → Creates password → Status = Confirmed</li>
            <li>Only Confirmed personnel appear in Create Job → Assign list</li>
            <li>This prevents assigning jobs to people who never signed in</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
