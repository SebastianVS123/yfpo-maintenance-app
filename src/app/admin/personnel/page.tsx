'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { db } from '@/lib/firebase/client'
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy, where } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'

interface Personnel { id: string; full_name: string; email: string; role: string; department?: string; is_active: boolean; has_account?: boolean; user_id?: string; confirmed_at?: any; created_at: any }

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', role: 'operator' as any, department: '' })
  const [submitting, setSubmitting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const { user } = useAuth()

  useEffect(() => { fetchPersonnel() }, [])
  
  const fetchPersonnel = async () => {
    try { 
      const snap = await getDocs(query(collection(db, 'personnel'), orderBy('created_at', 'desc')))
      setPersonnel(snap.docs.map(d => ({ id: d.id, ...d.data() } as Personnel)))
    } catch {} finally { setLoading(false) }
  }

  // FIX: Sync all pending personnel with existing users - connects backend flows
  const syncConfirmations = async () => {
    setSyncing(true)
    try {
      const personnelSnap = await getDocs(collection(db, 'personnel'))
      const usersSnap = await getDocs(collection(db, 'users'))
      const usersByEmail: Record<string, any> = {}
      usersSnap.docs.forEach(d => {
        const data = d.data()
        usersByEmail[data.email.toLowerCase()] = { id: d.id, ...data }
      })

      let fixed = 0
      for (const pDoc of personnelSnap.docs) {
        const pData = pDoc.data()
        const email = pData.email?.toLowerCase()
        const userMatch = usersByEmail[email]
        
        // If personnel is pending but user exists -> mark confirmed
        if (email && userMatch && !pData.has_account) {
          await updateDoc(doc(db, 'personnel', pDoc.id), {
            has_account: true,
            user_id: userMatch.id,
            confirmed_at: new Date(),
            is_active: true
          })
          fixed++
          console.log(`Fixed ${email} -> Confirmed`)
        }
      }
      alert(`Sync complete: Fixed ${fixed} personnel from Pending to Confirmed`)
      fetchPersonnel()
    } catch (e: any) {
      alert('Sync failed: ' + e.message)
    } finally {
      setSyncing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true)
    try { 
      const emailLower = form.email.toLowerCase().trim()
      
      // Check if user already exists with this email
      const usersQuery = query(collection(db, 'users'), where('email', '==', emailLower))
      const usersSnap = await getDocs(usersQuery)
      let hasAccount = false
      let userId = null
      let confirmedAt = null
      
      if (!usersSnap.empty) {
        // User already signed up before being added as personnel - auto confirm
        hasAccount = true
        userId = usersSnap.docs[0].id
        confirmedAt = new Date()
      }

      await addDoc(collection(db, 'personnel'), { 
        full_name: form.full_name, 
        email: emailLower, 
        role: form.role, 
        department: form.department || null, 
        created_by: user?.uid, 
        is_active: true, 
        has_account: hasAccount,
        user_id: userId,
        confirmed_at: confirmedAt,
        created_at: new Date() 
      }); 
      setForm({ full_name: '', email: '', role: 'operator', department: '' }); 
      setShowForm(false); 
      fetchPersonnel() 
    } catch (err: any) { alert(err.message) } finally { setSubmitting(false) }
  }
  
  const toggleActive = async (id: string, cur: boolean) => { await updateDoc(doc(db, 'personnel', id), { is_active: !cur }); fetchPersonnel() }
  const deleteP = async (id: string) => { if (!confirm('Delete?')) return; await deleteDoc(doc(db, 'personnel', id)); fetchPersonnel() }
  
  const promoteToAdmin = async (p: Personnel) => {
    if (!confirm(`Promote ${p.full_name} (${p.email}) to Admin? Admin can see ALL jobs from all managers.`)) return
    try {
      await updateDoc(doc(db, 'personnel', p.id), { role: 'admin' })
      if (p.user_id) {
        await updateDoc(doc(db, 'users', p.user_id), { role: 'admin' })
      }
      alert(`${p.full_name} promoted to Admin. They need to sign out and sign in again to get admin access.`)
      fetchPersonnel()
    } catch (e: any) { alert(e.message) }
  }

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>

  const confirmed = personnel.filter(p => p.has_account)
  const pending = personnel.filter(p => !p.has_account)

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10"><div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between"><Link href="/admin" className="text-sm text-zinc-400 hover:text-white">← Dashboard</Link><h1 className="font-medium text-white text-sm">Personnel</h1><div className="flex gap-2"><button onClick={syncConfirmations} disabled={syncing} className="px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg text-xs font-medium hover:bg-zinc-700 disabled:opacity-50">{syncing ? 'Syncing...' : '🔄 Sync Confirmations'}</button><button onClick={() => setShowForm(!showForm)} className="px-3 py-2 bg-white text-black rounded-lg text-sm font-medium">{showForm ? 'Cancel' : '+ Add'}</button></div></div></header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {showForm && <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6"><h3 className="font-medium text-white mb-2">Add Personnel</h3><p className="text-xs text-zinc-400 mb-4">If they already signed up, they will be auto-confirmed. Otherwise they must sign in to confirm.</p><form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-3"><input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Full Name" className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500" /><input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500" /><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })} className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"><option value="operator">Operator</option><option value="manager">Manager</option><option value="admin">Admin</option></select><input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="Department" className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500" /><button disabled={submitting} className="sm:col-span-2 w-full bg-white text-black py-2.5 rounded-lg font-medium disabled:opacity-50">{submitting ? 'Adding...' : 'Add Personnel'}</button></form></div>}

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-4"><div className="text-lg font-semibold text-emerald-400">{confirmed.length}</div><div className="text-xs text-emerald-300/70">Confirmed - Can be assigned jobs</div></div>
          <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-4"><div className="text-lg font-semibold text-amber-400">{pending.length}</div><div className="text-xs text-amber-300/70">Pending - Must sign in to confirm • Click Sync if someone signed up but still pending</div></div>
        </div>

        {pending.length > 0 && <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-4 mb-6"><h4 className="text-sm font-medium text-amber-200 mb-1">⚠️ {pending.length} pending personnel showing as Pending but they already signed in?</h4><p className="text-xs text-amber-300/70 mb-3">If you signed in as operator BEFORE being added as personnel, the backend wasn't connected. Click "Sync Confirmations" top right — it checks users collection and flips them to Confirmed automatically.</p><button onClick={syncConfirmations} disabled={syncing} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700">{syncing ? 'Syncing...' : 'Fix Now - Sync Confirmations'}</button></div>}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800"><h2 className="font-medium text-white">All Personnel ({personnel.length})</h2><p className="text-xs text-zinc-400 mt-1">Only confirmed accounts can be assigned jobs • Admin can see all jobs</p></div>
          <div className="divide-y divide-zinc-800">
            {personnel.map(p => (
              <div key={p.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white text-sm">{p.full_name}</span>
                    {p.has_account ? <span className="text-[10px] bg-emerald-900/40 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full">Confirmed</span> : <span className="text-[10px] bg-amber-900/40 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full">Pending</span>}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${p.role === 'admin' ? 'bg-purple-900/40 text-purple-300 border-purple-800' : p.role === 'manager' ? 'bg-blue-900/40 text-blue-300 border-blue-800' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>{p.role}</span>
                    {!p.is_active && <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded-full">Inactive</span>}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">{p.email} • {p.department ? `${p.department} • ` : ''}{p.user_id ? `UID: ${p.user_id.slice(0,6)}...` : 'No UID yet'}</div>
                  {p.has_account && p.confirmed_at && <div className="text-[11px] text-zinc-500 mt-1">Confirmed: {new Date(p.confirmed_at?.toDate ? p.confirmed_at.toDate() : p.confirmed_at).toLocaleString()}</div>}
                  {!p.has_account && <div className="text-[11px] text-amber-300/70 mt-1">Waiting for user to sign in at /auth/signup with this email</div>}
                </div>
                <div className="flex gap-2 ml-3 flex-wrap justify-end">
                  {p.role !== 'admin' && <button onClick={() => promoteToAdmin(p)} className="text-xs border border-purple-900/50 text-purple-300 px-2.5 py-1.5 rounded-lg hover:bg-purple-950/30">Make Admin</button>}
                  <button onClick={() => toggleActive(p.id, p.is_active)} className="text-xs border border-zinc-700 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:bg-zinc-800">{p.is_active ? 'Deactivate' : 'Activate'}</button>
                  <button onClick={() => deleteP(p.id)} className="text-xs border border-red-900/50 text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-950/30">Delete</button>
                </div>
              </div>
            ))}
            {personnel.length === 0 && <div className="p-8 text-center text-sm text-zinc-500">No personnel yet</div>}
          </div>
        </div>

        <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h4 className="text-sm font-medium text-white mb-2">Backend Flows - How it connects</h4>
          <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside">
            <li><strong className="text-white">Manager adds personnel</strong> → Creates doc in `personnel` collection with has_account=false. If user already exists in `users`, auto sets has_account=true (FIXED NOW)</li>
            <li><strong className="text-white">Personnel signs up</strong> → Creates doc in `users` + updates matching `personnel` has_account=true, user_id, confirmed_at + links jobAssignments profile_id</li>
            <li><strong className="text-white">Sync button</strong> → Goes through all personnel, checks if email exists in users, if yes flips pending to confirmed. Fixes your case where you signed in BEFORE being added.</li>
            <li><strong className="text-white">Create Job</strong> → Only shows personnel where has_account=true. Creates jobCards + jobPhotos (Cloudinary) + jobAssignments + sends email via Resend</li>
            <li><strong className="text-white">Operator dashboard</strong> → Queries jobAssignments where personnel_id = my personnel ID OR profile_id = my UID</li>
          </ul>
        </div>

        <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h4 className="text-sm font-medium text-white mb-2">Admin Login Details</h4>
          <div className="text-xs text-zinc-400 space-y-2">
            <p><strong className="text-white">There is no separate Admin login page.</strong> Same login: /auth/login</p>
            <p>Roles are: operator, manager, admin — stored in both `personnel.role` and `users.role`</p>
            <p><strong className="text-white">First user</strong> to sign up when no personnel exists becomes <strong>manager</strong> automatically</p>
            <p><strong className="text-white">To make someone Admin:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Go to Personnel list above → Find person → Click "Make Admin"</li>
              <li>Or manually in Firebase Console: Firestore → users → find user doc → change role to "admin" → Same for personnel doc</li>
              <li>User must sign out and sign in again to get new role</li>
              <li>Admin then sees toggle: My Jobs vs All Jobs (all managers)</li>
            </ol>
            <p className="mt-3"><strong className="text-white">Your accounts:</strong></p>
            <p>- sebastianvanschoor@gmail = currently operator (as you signed up). You can promote to admin/manager via button above</p>
            <p>- Your other manager email = manager role. Can also promote to admin</p>
            <p className="mt-2 text-amber-300/70">Fix for your case: Click "Sync Confirmations" now — it will make sebastianvanschoor@gmail Confirmed if you already signed up, then you can assign jobs to it.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
