'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { db } from '@/lib/firebase/client'
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'

interface Personnel {
  id: string
  full_name: string
  email: string
  role: string
  department?: string
  is_active: boolean
  created_at: any
}

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    role: 'operator' as 'manager' | 'operator' | 'admin',
    department: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    fetchPersonnel()
  }, [])

  const fetchPersonnel = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'personnel'), orderBy('created_at', 'desc')))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Personnel))
      setPersonnel(list)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'personnel'), {
        full_name: form.full_name,
        email: form.email.toLowerCase().trim(),
        role: form.role,
        department: form.department || null,
        created_by: user?.uid,
        is_active: true,
        created_at: new Date()
      })

      setForm({ full_name: '', email: '', role: 'operator', department: '' })
      setShowForm(false)
      fetchPersonnel()
      alert('Personnel added! They can now create account using this email.')
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (id: string, current: boolean) => {
    await updateDoc(doc(db, 'personnel', id), { is_active: !current })
    fetchPersonnel()
  }

  const deletePersonnel = async (id: string) => {
    if (!confirm('Delete this personnel?')) return
    await deleteDoc(doc(db, 'personnel', id))
    fetchPersonnel()
  }

  const addPlaceholders = async () => {
    const placeholders = [
      { full_name: 'John Maintenance', email: 'john.maint@company.com', role: 'operator', department: 'Production' },
      { full_name: 'Sarah Safety', email: 'sarah.safety@company.com', role: 'operator', department: 'Safety' },
      { full_name: 'Mike Electrician', email: 'mike.elec@company.com', role: 'operator', department: 'Quality' },
      { full_name: 'Lisa Logistics', email: 'lisa.log@company.com', role: 'operator', department: 'Logistics' },
      { full_name: 'David Manager', email: 'david.mgr@company.com', role: 'manager', department: 'Management' },
    ]

    for (const p of placeholders) {
      // Check if exists
      const existing = personnel.find(per => per.email === p.email)
      if (!existing) {
        await addDoc(collection(db, 'personnel'), {
          full_name: p.full_name,
          email: p.email,
          role: p.role,
          department: p.department,
          created_by: user?.uid,
          is_active: true,
          created_at: new Date()
        })
      }
    }
    fetchPersonnel()
  }

  if (loading) return <div className="p-8 text-center">Loading personnel...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-gray-600 hover:text-black flex items-center gap-1">
              ← <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <h1 className="font-bold text-sm sm:text-base">Personnel</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={addPlaceholders} className="px-2 sm:px-3 py-2 text-[11px] sm:text-xs border rounded-lg hover:bg-gray-50 whitespace-nowrap">
              +5 Placeholders
            </button>
            <button onClick={() => setShowForm(!showForm)} className="px-3 sm:px-4 py-2 bg-black text-white rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap">
              {showForm ? 'Cancel' : '+ Add'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-8">
        {showForm && (
          <div className="bg-white rounded-xl border p-4 sm:p-6 mb-6 sm:mb-8 shadow-sm">
            <h3 className="font-semibold mb-2">Add New Personnel / Operator</h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-4">Pre-registers them. When they first click email job link, they can create password with this exact email. Saved and matched automatically via Firebase.</p>
            <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name *</label>
                <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg text-base" placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg text-base" placeholder="john@company.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role *</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })} className="w-full px-3 py-2.5 border rounded-lg text-base bg-white">
                  <option value="operator">Operator / Technician</option>
                  <option value="manager">Manager (can create jobs)</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg text-base" placeholder="e.g. Production" />
              </div>
              <div className="sm:col-span-2">
                <button disabled={submitting} type="submit" className="w-full bg-black text-white py-3 rounded-lg font-semibold disabled:opacity-50 text-base">
                  {submitting ? 'Adding...' : 'Add Personnel'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Desktop Table */}
        <div className="hidden md:block bg-white rounded-xl border overflow-hidden shadow-sm">
          <div className="p-6 border-b">
            <h2 className="font-semibold">All Personnel ({personnel.length})</h2>
            <p className="text-sm text-gray-500">Manage who can be assigned jobs and their roles/emails</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Role</th>
                  <th className="text-left p-3">Dept</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {personnel.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium">{p.full_name}</td>
                    <td className="p-3 text-gray-600">{p.email}</td>
                    <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs ${p.role === 'manager' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100'}`}>{p.role}</span></td>
                    <td className="p-3">{p.department || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3 flex gap-2">
                      <button onClick={() => toggleActive(p.id, p.is_active)} className="text-xs underline">{p.is_active ? 'Deactivate' : 'Activate'}</button>
                      <button onClick={() => deletePersonnel(p.id)} className="text-xs text-red-600 underline">Delete</button>
                    </td>
                  </tr>
                ))}
                {personnel.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">No personnel yet. Add some or use placeholder button.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-sm">All Personnel ({personnel.length})</h2>
            <span className="text-xs text-gray-500">Tap for actions</span>
          </div>
          {personnel.map(p => (
            <div key={p.id} className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.full_name}</div>
                  <div className="text-xs text-gray-600 truncate">{p.email}</div>
                  <div className="flex gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${p.role === 'manager' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100'}`}>{p.role}</span>
                    {p.department && <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-700">{p.department}</span>}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => toggleActive(p.id, p.is_active)} className="text-[11px] px-2 py-1 border rounded hover:bg-gray-50">{p.is_active ? 'Deactivate' : 'Activate'}</button>
                  <button onClick={() => deletePersonnel(p.id)} className="text-[11px] px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50">Delete</button>
                </div>
              </div>
            </div>
          ))}
          {personnel.length === 0 && (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-500 text-sm">No personnel yet. Add some or use placeholder button.</div>
          )}
        </div>

        <div className="mt-6 sm:mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <strong>How matching works (Firebase):</strong> When you add personnel here, we save to Firestore. When that person first signs up using SAME email, we automatically match them and assign their role. Their job assignments get linked via profile_id. Future emails work instantly. No Supabase limit!
        </div>
      </main>
    </div>
  )
}
