'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Personnel {
  id: string
  full_name: string
  email: string
  role: string
  department?: string
  is_active: boolean
  created_at: string
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

  useEffect(() => {
    fetchPersonnel()
  }, [])

  const fetchPersonnel = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('personnel').select('*').order('created_at', { ascending: false })
    if (data) setPersonnel(data)
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase.from('personnel').insert({
        full_name: form.full_name,
        email: form.email.toLowerCase().trim(),
        role: form.role,
        department: form.department || null,
        created_by: user?.id,
        is_active: true
      })

      if (error) throw error

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
    const supabase = createClient()
    await supabase.from('personnel').update({ is_active: !current }).eq('id', id)
    fetchPersonnel()
  }

  const deletePersonnel = async (id: string) => {
    if (!confirm('Delete this personnel? Their job assignments will remain but they cannot log in with new account.')) return
    const supabase = createClient()
    await supabase.from('personnel').delete().eq('id', id)
    fetchPersonnel()
  }

  // Placeholder data helper
  const addPlaceholders = async () => {
    const placeholders = [
      { full_name: 'John Maintenance', email: 'john.maint@company.com', role: 'operator', department: 'Production' },
      { full_name: 'Sarah Safety', email: 'sarah.safety@company.com', role: 'operator', department: 'Safety' },
      { full_name: 'Mike Electrician', email: 'mike.elec@company.com', role: 'operator', department: 'Quality' },
      { full_name: 'Lisa Logistics', email: 'lisa.log@company.com', role: 'operator', department: 'Logistics' },
      { full_name: 'David Manager', email: 'david.mgr@company.com', role: 'manager', department: 'Management' },
    ]

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    for (const p of placeholders) {
      await supabase.from('personnel').upsert({
        full_name: p.full_name,
        email: p.email,
        role: p.role,
        department: p.department,
        created_by: user?.id,
        is_active: true
      }, { onConflict: 'email' })
    }
    fetchPersonnel()
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-sm text-gray-600 hover:text-black">← Dashboard</Link>
            <h1 className="font-bold">Personnel Management</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={addPlaceholders} className="px-3 py-2 text-xs border rounded-lg hover:bg-gray-50">Add 5 Placeholders</button>
            <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-semibold">
              {showForm ? 'Cancel' : '+ Add Personnel'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {showForm && (
          <div className="bg-white rounded-xl border p-6 mb-8">
            <h3 className="font-semibold mb-4">Add New Personnel / Operator</h3>
            <p className="text-sm text-gray-600 mb-4">This pre-registers them. When they first click email job link, they can create password with this exact email. Saved and matched automatically.</p>
            <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name *</label>
                <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="john@company.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role *</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="operator">Operator / Technician</option>
                  <option value="manager">Manager (can create jobs)</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Production" />
              </div>
              <div className="md:col-span-2">
                <button disabled={submitting} type="submit" className="w-full bg-black text-white py-2.5 rounded-lg font-semibold disabled:opacity-50">
                  {submitting ? 'Adding...' : 'Add Personnel'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl border overflow-hidden">
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

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <strong>How matching works:</strong> When you add personnel here, we save name + email + role. When that person first signs up via /auth/signup using SAME email, we automatically match them and assign their role. Their existing job assignments (via personnel_id) get linked to their new profile_id. Future emails to them will work.
        </div>
      </main>
    </div>
  )
}
