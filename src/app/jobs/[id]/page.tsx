'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { db, storage } from '@/lib/firebase/client'
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
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

  useEffect(() => {
    if (!user) return
    fetchJob()
  }, [user, jobId])

  const fetchJob = async () => {
    try {
      const jobDoc = await getDoc(doc(db, 'jobCards', jobId))
      if (!jobDoc.exists()) {
        setLoading(false)
        return
      }
      const jobData: any = { id: jobDoc.id, ...jobDoc.data() }
      setJob(jobData)

      // Photos
      const photosQ = query(collection(db, 'jobPhotos'), where('job_id', '==', jobId))
      const photosSnap = await getDocs(photosQ)
      const photosData = photosSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setPhotos(photosData)

      // Assignments with personnel
      const assignmentsQ = query(collection(db, 'jobAssignments'), where('job_id', '==', jobId))
      const assignmentsSnap = await getDocs(assignmentsQ)
      const assignmentsData = []
      let currentUserAssignment = null

      for (const aDoc of assignmentsSnap.docs) {
        const aData = { id: aDoc.id, ...aDoc.data() } as any
        let personnelData = null
        if (aData.personnel_id) {
          const pDoc = await getDoc(doc(db, 'personnel', aData.personnel_id))
          if (pDoc.exists()) personnelData = { id: pDoc.id, ...pDoc.data() }
        }
        let profileData = null
        if (aData.profile_id) {
          const uDoc = await getDoc(doc(db, 'users', aData.profile_id))
          if (uDoc.exists()) profileData = uDoc.data()
        }
        const enriched = { ...aData, personnel: personnelData, profile: profileData }
        assignmentsData.push(enriched)

        // Check if current user
        if (personnelData && (personnelData as any).email === profile?.email) {
          currentUserAssignment = enriched
        }
        if (aData.profile_id === user?.uid) {
          currentUserAssignment = enriched
        }
      }
      setAssignments(assignmentsData)
      setUserAssignment(currentUserAssignment)
      setIsAssignee(!!currentUserAssignment)

      // Is manager?
      const manager = profile?.role === 'manager' || profile?.role === 'admin' || (jobData as any).created_by === user?.uid
      setIsManager(manager)

      // Commits
      const commitsQ = query(collection(db, 'jobCommits'), where('job_id', '==', jobId))
      const commitsSnap = await getDocs(commitsQ)
      const commitsData = commitsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))
      // Sort by created_at
      commitsData.sort((a, b) => {
        const aTime = a.created_at?.toDate ? a.created_at.toDate().getTime() : new Date(a.created_at).getTime()
        const bTime = b.created_at?.toDate ? b.created_at.toDate().getTime() : new Date(b.created_at).getTime()
        return aTime - bTime
      })
      setCommits(commitsData)

      // Auto-start if assignee and unopened
      if (currentUserAssignment && currentUserAssignment.status === 'unopened') {
        await updateDoc(doc(db, 'jobAssignments', currentUserAssignment.id), {
          status: 'opened',
          opened_at: new Date()
        })

        if (jobData.status === 'open') {
          await updateDoc(doc(db, 'jobCards', jobId), {
            status: 'started',
            started_at: jobData.started_at || new Date(),
            updated_at: new Date()
          })
          await addDoc(collection(db, 'jobCommits'), {
            job_id: jobId,
            user_id: user!.uid,
            userName: profile?.full_name || user?.email,
            userEmail: profile?.email || user?.email,
            message: `Job started by ${profile?.full_name || user?.email} at ${new Date().toLocaleString()}`,
            type: 'status_update',
            created_at: new Date()
          })
          // Refresh
          setJob((prev: any) => ({ ...prev, status: 'started', started_at: prev.started_at || new Date() }))
        }
        // Update local assignment
        setUserAssignment((prev: any) => ({ ...prev, status: 'opened' }))
      }

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!planForm.message.trim()) return
    setActionLoading(true)
    try {
      await addDoc(collection(db, 'jobCommits'), {
        job_id: jobId,
        user_id: user!.uid,
        userName: profile?.full_name,
        userEmail: profile?.email,
        message: planForm.message,
        estimated_time: planForm.estimated_time || null,
        type: 'plan',
        created_at: new Date()
      })

      if (planForm.estimated_time && !job.estimated_time) {
        await updateDoc(doc(db, 'jobCards', jobId), {
          estimated_time: planForm.estimated_time,
          status: job.status === 'started' ? 'in_progress' : job.status,
          updated_at: new Date()
        })
      } else if (job.status === 'started') {
        await updateDoc(doc(db, 'jobCards', jobId), {
          status: 'in_progress',
          updated_at: new Date()
        })
      }

      if (userAssignment) {
        await updateDoc(doc(db, 'jobAssignments', userAssignment.id), {
          status: 'started'
        })
      }

      setPlanForm({ estimated_time: '', message: '' })
      fetchJob()
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCompletionPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setCompletionForm({
        ...completionForm,
        photo: file,
        photoPreview: URL.createObjectURL(file)
      })
    }
  }

  const handleCompleteJob = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!completionForm.photo) {
      alert('Completion photo is required!')
      return
    }
    setActionLoading(true)
    try {
      const fileName = `job-photos/${jobId}/completion-${Date.now()}-${completionForm.photo.name}`
      const storageRef = ref(storage, fileName)
      await uploadBytes(storageRef, completionForm.photo)
      const publicUrl = await getDownloadURL(storageRef)

      await addDoc(collection(db, 'jobPhotos'), {
        job_id: jobId,
        url: publicUrl,
        type: 'completion',
        file_name: completionForm.photo.name,
        uploaded_by: user!.uid,
        created_at: new Date()
      })

      await updateDoc(doc(db, 'jobCards', jobId), {
        status: 'completed',
        completed_at: new Date(),
        completion_notes: completionForm.notes,
        updated_at: new Date()
      })

      if (userAssignment) {
        await updateDoc(doc(db, 'jobAssignments', userAssignment.id), { status: 'completed' })
      }

      await addDoc(collection(db, 'jobCommits'), {
        job_id: jobId,
        user_id: user!.uid,
        userName: profile?.full_name,
        userEmail: profile?.email,
        message: `✅ Job marked as completed. Notes: ${completionForm.notes || 'No additional notes'}`,
        type: 'status_update',
        created_at: new Date()
      })

      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'completion',
            jobId,
            title: job.title,
            location: job.location,
            completedBy: profile?.full_name || user?.email,
            completedByEmail: profile?.email || user?.email,
            completionPhoto: publicUrl,
            finalNotes: completionForm.notes,
            createdByEmail: job.createdByEmail,
            appUrl: window.location.origin,
            startedAt: job.started_at,
            completedAt: new Date()
          })
        })
      } catch (emailErr) {
        console.error('Completion email failed', emailErr)
      }

      alert('Job completed! Creator notified via email.')
      setShowComplete(false)
      router.push(isManager ? '/admin' : '/operator')
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Job not found</h1>
          <Link href="/dashboard" className="text-blue-600 underline text-sm">Back to dashboard</Link>
        </div>
      </div>
    )
  }

  const priority = getPriorityConfig(job.priority)
  const status = getStatusConfig(job.status)
  const issuePhotos = photos.filter(p => p.type === 'issue')
  const completionPhotos = photos.filter(p => p.type === 'completion')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={isManager ? '/admin' : '/operator'} className="text-sm hover:text-black text-gray-600 flex items-center gap-1">
            ← <span className="hidden sm:inline">Back to {isManager ? 'Admin' : 'Operator'}</span><span className="sm:hidden">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border ${priority.color}`}>
              {priority.label}
            </span>
            <span className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        {isCreated && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 sm:mb-6">
            <h3 className="font-bold text-green-800 text-sm sm:text-base">✅ Job Card Lodged Successfully!</h3>
            <p className="text-xs sm:text-sm text-green-700 mt-1">Emails sent to assigned personnel. They can view on mobile & desktop.</p>
          </div>
        )}

        {userAssignment?.status === 'opened' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 sm:mb-6">
            <h3 className="font-bold text-blue-800 text-sm">👋 Job Auto-Started!</h3>
            <p className="text-xs sm:text-sm text-blue-700 mt-1">Opened via email link, marked as STARTED. First open = start time. Add estimated time & plan below.</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
              <h1 className="text-lg sm:text-2xl font-bold mb-2 leading-tight">{job.title}</h1>
              <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-4">
                <span>📍 {job.location}</span>
                <span>🏢 {job.departments?.join(', ')}</span>
                <span className="hidden sm:inline">👤 {job.createdByName}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm bg-gray-50 p-3 sm:p-4 rounded-lg">
                <div><strong>Observed:</strong> {formatDate(job.observed_at)}</div>
                <div><strong>Created:</strong> {formatDate(job.created_at)}</div>
                {job.started_at && <div><strong>Started:</strong> {formatDate(job.started_at)}</div>}
                {job.completed_at && <div><strong>Completed:</strong> {formatDate(job.completed_at)}</div>}
                {job.due_date && <div><strong>Due:</strong> <span className={new Date(job.due_date?.toDate ? job.due_date.toDate() : job.due_date) < new Date() && job.status !== 'completed' ? 'text-red-600 font-bold' : ''}>{formatDate(job.due_date)}</span></div>}
                {job.estimated_time && <div><strong>Est. Time:</strong> {job.estimated_time}</div>}
              </div>

              <div className="mt-4 sm:mt-6">
                <h3 className="font-semibold mb-2 text-sm sm:text-base">Required Actions</h3>
                <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 sm:p-4 rounded-lg text-sm">{job.required_actions}</p>
              </div>

              <div className="mt-4 sm:mt-6">
                <h3 className="font-semibold mb-3 text-sm sm:text-base">Issue Photos ({issuePhotos.length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {issuePhotos.map((photo: any) => (
                    <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={photo.url} alt="Issue" className="w-full h-28 sm:h-32 object-cover rounded-lg border hover:opacity-90" />
                    </a>
                  ))}
                  {issuePhotos.length === 0 && <p className="text-xs sm:text-sm text-gray-500 col-span-2">No issue photos</p>}
                </div>
              </div>

              {completionPhotos.length > 0 && (
                <div className="mt-4 sm:mt-6">
                  <h3 className="font-semibold mb-3 text-sm sm:text-base">Completion Photos ({completionPhotos.length})</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {completionPhotos.map((photo: any) => (
                      <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={photo.url} alt="Completion" className="w-full h-28 sm:h-32 object-cover rounded-lg border-2 border-green-300" />
                      </a>
                    ))}
                  </div>
                  {job.completion_notes && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-xs sm:text-sm">
                      <strong>Completion Notes:</strong> {job.completion_notes}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6 border-b">
                <h3 className="font-semibold text-base sm:text-lg">Plan of Action & Previous Commits</h3>
                <p className="text-xs sm:text-sm text-gray-500">All operators can see previous commits and contribute - mobile friendly</p>
              </div>

              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 max-h-96 overflow-y-auto">
                {commits.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500 text-center py-8">No plans yet. Be first to add estimated time and action plan.</p>
                ) : (
                  commits.map((commit: any) => (
                    <div key={commit.id} className="border-l-4 border-blue-500 pl-3 sm:pl-4 py-2 bg-blue-50/50 rounded-r-lg">
                      <div className="flex justify-between items-start gap-2">
                        <div className="font-medium text-xs sm:text-sm truncate">{commit.userName || commit.userEmail || 'Unknown'}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">{formatDate(commit.created_at)}</div>
                      </div>
                      {commit.estimated_time && (
                        <div className="text-[11px] sm:text-xs font-semibold text-blue-700 mt-1">⏱️ Est: {commit.estimated_time}</div>
                      )}
                      <p className="text-xs sm:text-sm mt-1 whitespace-pre-wrap break-words">{commit.message}</p>
                      <span className={`inline-block mt-2 text-[10px] sm:text-xs px-2 py-0.5 rounded-full ${commit.type === 'plan' ? 'bg-purple-100 text-purple-700' : commit.type === 'status_update' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                        {commit.type}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {isAssignee && job.status !== 'completed' && (
                <div className="p-4 sm:p-6 border-t bg-gray-50">
                  <h4 className="font-medium mb-3 text-sm sm:text-base">Add Your Plan / Update</h4>
                  <form onSubmit={handleAddPlan} className="space-y-3">
                    <input
                      type="text"
                      placeholder="Estimated job time (e.g. 2 hours, 1 day)"
                      value={planForm.estimated_time}
                      onChange={e => setPlanForm({ ...planForm, estimated_time: e.target.value })}
                      className="w-full px-3 py-2.5 border rounded-lg text-sm sm:text-base"
                    />
                    <textarea
                      required
                      rows={3}
                      placeholder="Brief plan of action, what you will do, parts needed..."
                      value={planForm.message}
                      onChange={e => setPlanForm({ ...planForm, message: e.target.value })}
                      className="w-full px-3 py-2.5 border rounded-lg text-sm sm:text-base"
                    />
                    <button disabled={actionLoading} type="submit" className="w-full bg-black text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">
                      {actionLoading ? 'Adding...' : 'Add to Plan / Commit'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
              <h3 className="font-semibold mb-3 text-sm sm:text-base">Assigned Personnel</h3>
              <div className="space-y-2 sm:space-y-3">
                {assignments.map((assignment: any) => (
                  <div key={assignment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-xs sm:text-sm truncate">{assignment.personnel?.full_name || assignment.profile?.full_name || 'Unknown'}</div>
                      <div className="text-[11px] sm:text-xs text-gray-500 truncate">{assignment.personnel?.email || assignment.profile?.email}</div>
                    </div>
                    <span className={`text-[10px] sm:text-xs px-2 py-1 rounded-full ml-2 flex-shrink-0 ${
                      assignment.status === 'unopened' ? 'bg-orange-100 text-orange-700' :
                      assignment.status === 'completed' ? 'bg-green-100 text-green-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {assignment.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
              <h3 className="font-semibold mb-3 text-sm sm:text-base">Job Info</h3>
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between"><span className="text-gray-500">ID:</span><span className="font-mono text-[10px] sm:text-xs">{job.id.slice(0, 8)}...</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Priority:</span><span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border ${priority.color}`}>{priority.label}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Status:</span><span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs ${status.color}`}>{status.label}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Depts:</span><span>{job.departments?.length}</span></div>
              </div>
            </div>

            {isAssignee && job.status !== 'completed' && (
              <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
                <h3 className="font-semibold mb-3 text-sm sm:text-base">Complete Job</h3>
                <p className="text-[11px] sm:text-xs text-gray-600 mb-3">Required: Upload completion photo and confirm. Email will be sent to issuer. Works on mobile camera.</p>
                {!showComplete ? (
                  <button onClick={() => setShowComplete(true)} className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 text-sm sm:text-base">
                    ✅ Mark as Completed
                  </button>
                ) : (
                  <form onSubmit={handleCompleteJob} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Completion Photo * (use camera on mobile)</label>
                      <input type="file" accept="image/*" capture="environment" required onChange={handleCompletionPhoto} className="w-full text-xs sm:text-sm" />
                      {completionForm.photoPreview && (
                        <img src={completionForm.photoPreview} alt="Preview" className="mt-2 w-full h-32 object-cover rounded-lg border" />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Final Notes</label>
                      <textarea
                        rows={3}
                        value={completionForm.notes}
                        onChange={e => setCompletionForm({ ...completionForm, notes: e.target.value })}
                        placeholder="What was done, parts used..."
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowComplete(false)} className="flex-1 border py-2.5 rounded-lg text-sm">Cancel</button>
                      <button disabled={actionLoading} type="submit" className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">
                        {actionLoading ? 'Submitting...' : 'Confirm'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {isManager && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 sm:p-4 text-xs sm:text-sm">
                <strong>Manager View:</strong> You created this job. You&apos;ll get email when operators complete it. Status updates when operators open via link. Firebase real-time.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
