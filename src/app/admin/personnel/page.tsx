'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { db } from '@/lib/firebase/client'
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'

interface Personnel { id: string; full_name: string; email: string; role: string; department?: string; is_active: boolean; created_at: any }

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
    try { await addDoc(collection(db, 'personnel'), { full_name: form.full_name, email: form.email.toLowerCase().trim(), role: form.role, department: form.department || null, created_by: user?.uid, is_active: true, created_at: new Date() }); setForm({ full_name: '', email: '', role: 'operator', department: '' }); setShowForm(false); fetchPersonnel() } catch (err: any) { alert(err.message) } finally { setSubmitting(false) }
  }
  const toggleActive = async (id: string, cur: boolean) => { await updateDoc(doc(db, 'personnel', id), { is_active: !cur }); fetchPersonnel() }
  const deleteP = async (id: string) => { if (!confirm('Delete?')) return; await deleteDoc(doc(db, 'personnel', id)); fetchPersonnel() }

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10"><div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between"><Link href="/admin" className="text-sm text-zinc-400 hover:text-white">← Dashboard</Link><h1 className="font-medium text-white text-sm">Personnel</h1><button onClick={() => setShowForm(!showForm)} className="px-3 py-2 bg-white text-black rounded-lg text-sm font-medium">{showForm ? 'Cancel' : '+ Add'}</button></div></header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {showForm && <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6"><h3 className="font-medium text-white mb-4">Add Personnel</h3><form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-3"><input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Full Name" className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500" /><input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500" /><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })} className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"><option value="operator">Operator</option><option value="manager">Manager</option><option value="admin">Admin</option></select><input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="Department" className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500" /><button disabled={submitting} className="sm:col-span-2 w-full bg-white text-black py-2.5 rounded-lg font-medium disabled:opacity-50">{submitting ? 'Adding...' : 'Add Personnel'}</button></form></div>}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800"><h2 className="font-medium text-white">Personnel ({personnel.length})</h2><p className="text-xs text-zinc-400 mt-1">Manage roles and assignments</p></div>
          <div className="divide-y divide-zinc-800">{personnel.map(p => <div key={p.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/50"><div><div className="font-medium text-white text-sm">{p.full_name}</div><div className="text-xs text-zinc-400">{p.email} • {p.role} {p.department ? `• ${p.department}` : ''}</div></div><div className="flex gap-2"><button onClick={() => toggleActive(p.id, p.is_active)} className="text-xs border border-zinc-700 px-2.5 py-1 rounded-lg text-zinc-300 hover:bg-zinc-800">{p.is_active ? 'Deactivate' : 'Activate'}</button><button onClick={() => deleteP(p.id)} className="text-xs border border-red-900/50 text-red-400 px-2.5 py-1 rounded-lg hover:bg-red-950/30">Delete</button></div></div>)}{personnel.length === 0 && <div className="p-8 text-center text-sm text-zinc-500">No personnel yet</div>}</div>
        </div>
      </main>
    </div>
  )
}
