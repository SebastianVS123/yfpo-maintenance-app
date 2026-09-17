'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getPriorityConfig, getStatusConfig, formatDate } from '@/lib/utils'

export default function JobDetailClient({ job, commits, currentUser, userAssignment, isManager, isAssignee, isCreated }: any) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('details')
  const [loading, setLoading] = useState(false)
  const [showComplete, setShowComplete] = useState(false)

  const [planForm, setPlanForm] = useState({
    estimated_time: '',
    message: ''
  })

  const [completionForm, setCompletionForm] = useState({
    notes: '',
    photo: null as File | null,
    photoPreview: ''
  })

  const priority = getPriorityConfig(job.priority)
  const status = getStatusConfig(job.status)

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!planForm.message.trim()) return
    
    setLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.from('job_commits').insert({
        job_id: job.id,
        user_id: currentUser.id,
        message: planForm.message,
        estimated_time: planForm.estimated_time || null,
        type: 'plan'
      })

      if (error) throw error

      // Update job estimated time if provided and job doesn't have one
      if (planForm.estimated_time && !job.estimated_time) {
        await supabase.from('job_cards').update({
          estimated_time: planForm.estimated_time,
          status: job.status === 'started' ? 'in_progress' : job.status
        }).eq('id', job.id)
      } else if (job.status === 'started') {
        await supabase.from('job_cards').update({
          status: 'in_progress'
        }).eq('id', job.id)
      }

      // Update assignment status to started
      if (userAssignment) {
        await supabase.from('job_assignments').update({
          status: 'started'
        }).eq('id', userAssignment.id)
      }

      setPlanForm({ estimated_time: '', message: '' })
      router.refresh()
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
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

    setLoading(true)
    const supabase = createClient()

    try {
      // Upload completion photo
      const fileName = `${job.id}/completion-${Date.now()}-${completionForm.photo.name}`
      const { error: uploadError } = await supabase.storage.from('job-photos').upload(fileName, completionForm.photo)
      
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('job-photos').getPublicUrl(fileName)

      await supabase.from('job_photos').insert({
        job_id: job.id,
        url: publicUrl,
        type: 'completion',
        file_name: completionForm.photo.name,
        uploaded_by: currentUser.id
      })

      // Update job to completed
      const { error: jobError } = await supabase.from('job_cards').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completion_notes: completionForm.notes
      }).eq('id', job.id)

      if (jobError) throw jobError

      // Update all assignments to completed for this user
      if (userAssignment) {
        await supabase.from('job_assignments').update({ status: 'completed' }).eq('id', userAssignment.id)
      }

      // Add commit
      await supabase.from('job_commits').insert({
        job_id: job.id,
        user_id: currentUser.id,
        message: `✅ Job marked as completed. Notes: ${completionForm.notes || 'No additional notes'}`,
        type: 'status_update'
      })

      // Send completion email to creator
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'completion',
            jobId: job.id,
            title: job.title,
            location: job.location,
            completedBy: currentUser.profile?.full_name || currentUser.email,
            completedByEmail: currentUser.email,
            completionPhoto: publicUrl,
            finalNotes: completionForm.notes,
            createdByEmail: job.profiles?.email,
            appUrl: window.location.origin,
            startedAt: job.started_at,
            completedAt: new Date().toISOString()
          })
        })
      } catch (emailErr) {
        console.error('Completion email failed', emailErr)
      }

      alert('Job completed successfully! Creator has been notified via email.')
      setShowComplete(false)
      router.refresh()
      router.push(isManager ? '/admin' : '/operator')
    } catch (err: any) {
      alert('Error completing job: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const issuePhotos = job.job_photos?.filter((p: any) => p.type === 'issue') || []
  const completionPhotos = job.job_photos?.filter((p: any) => p.type === 'completion') || []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={isManager ? '/admin' : '/operator'} className="text-sm hover:text-black text-gray-600">
            ← Back to {isManager ? 'Admin' : 'Operator'} Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${priority.color}`}>
              {priority.label}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {isCreated && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <h3 className="font-bold text-green-800">✅ Job Card Lodged Successfully!</h3>
            <p className="text-sm text-green-700 mt-1">Emails have been sent to assigned personnel with link to this job. They will see priority clearly and can start work.</p>
          </div>
        )}

        {userAssignment?.status === 'opened' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <h3 className="font-bold text-blue-800">👋 Job Auto-Started!</h3>
            <p className="text-sm text-blue-700 mt-1">Because you opened this via email link, it&apos;s now marked as STARTED. First open time is job start time. Please provide estimated time and plan below.</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h1 className="text-2xl font-bold mb-2">{job.title}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                <span>📍 {job.location}</span>
                <span>🏢 {job.departments?.join(', ')}</span>
                <span>👤 Issued by {job.profiles?.full_name} ({job.profiles?.email})</span>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg">
                <div><strong>Observed:</strong> {formatDate(job.observed_at)}</div>
                <div><strong>Created:</strong> {formatDate(job.created_at)}</div>
                {job.started_at && <div><strong>Started:</strong> {formatDate(job.started_at)} (first open)</div>}
                {job.completed_at && <div><strong>Completed:</strong> {formatDate(job.completed_at)}</div>}
                {job.due_date && <div><strong>Due:</strong> <span className={new Date(job.due_date) < new Date() && job.status !== 'completed' ? 'text-red-600 font-bold' : ''}>{formatDate(job.due_date)}</span></div>}
                {job.estimated_time && <div><strong>Est. Time:</strong> {job.estimated_time}</div>}
              </div>

              <div className="mt-6">
                <h3 className="font-semibold mb-2">Required Actions</h3>
                <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">{job.required_actions}</p>
              </div>

              <div className="mt-6">
                <h3 className="font-semibold mb-3">Issue Photos ({issuePhotos.length})</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {issuePhotos.map((photo: any) => (
                    <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={photo.url} alt="Issue" className="w-full h-32 object-cover rounded-lg border hover:opacity-90" />
                    </a>
                  ))}
                  {issuePhotos.length === 0 && <p className="text-sm text-gray-500">No issue photos</p>}
                </div>
              </div>

              {completionPhotos.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Completion Photos ({completionPhotos.length})</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {completionPhotos.map((photo: any) => (
                      <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={photo.url} alt="Completion" className="w-full h-32 object-cover rounded-lg border-2 border-green-300" />
                      </a>
                    ))}
                  </div>
                  {job.completion_notes && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                      <strong>Completion Notes:</strong> {job.completion_notes}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Commits / Plan of Action */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="p-6 border-b">
                <h3 className="font-semibold text-lg">Plan of Action & Previous Commits</h3>
                <p className="text-sm text-gray-500">All operators assigned can see previous commits and contribute</p>
              </div>

              <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
                {commits.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No plans yet. Be first to add estimated time and action plan.</p>
                ) : (
                  commits.map((commit: any) => (
                    <div key={commit.id} className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50/50 rounded-r-lg">
                      <div className="flex justify-between items-start gap-2">
                        <div className="font-medium text-sm">{commit.profiles?.full_name || commit.profiles?.email || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{formatDate(commit.created_at)}</div>
                      </div>
                      {commit.estimated_time && (
                        <div className="text-xs font-semibold text-blue-700 mt-1">⏱️ Est: {commit.estimated_time}</div>
                      )}
                      <p className="text-sm mt-1 whitespace-pre-wrap">{commit.message}</p>
                      <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${commit.type === 'plan' ? 'bg-purple-100 text-purple-700' : commit.type === 'status_update' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                        {commit.type}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {isAssignee && job.status !== 'completed' && (
                <div className="p-6 border-t bg-gray-50">
                  <h4 className="font-medium mb-3">Add Your Plan / Update</h4>
                  <form onSubmit={handleAddPlan} className="space-y-3">
                    <input
                      type="text"
                      placeholder="Estimated job time (e.g. 2 hours, 1 day) - first open is start time"
                      value={planForm.estimated_time}
                      onChange={e => setPlanForm({ ...planForm, estimated_time: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                    <textarea
                      required
                      rows={3}
                      placeholder="Brief plan of action, what you will do, parts needed..."
                      value={planForm.message}
                      onChange={e => setPlanForm({ ...planForm, message: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                    <button disabled={loading} type="submit" className="w-full bg-black text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                      {loading ? 'Adding...' : 'Add to Plan / Commit'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-3">Assigned Personnel</h3>
              <div className="space-y-3">
                {job.job_assignments?.map((assignment: any) => (
                  <div key={assignment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{assignment.personnel?.full_name || assignment.profiles?.full_name || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{assignment.personnel?.email || assignment.profiles?.email}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
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

            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-3">Job Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">ID:</span><span className="font-mono text-xs">{job.id.slice(0, 8)}...</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Priority:</span><span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${priority.color}`}>{priority.label}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Status:</span><span className={`px-2 py-0.5 rounded-full text-xs ${status.color}`}>{status.label}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Departments:</span><span>{job.departments?.length}</span></div>
              </div>
            </div>

            {isAssignee && job.status !== 'completed' && (
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-semibold mb-3">Complete Job</h3>
                <p className="text-xs text-gray-600 mb-3">Required: Upload completion photo and confirm. Email will be sent to issuer.</p>
                {!showComplete ? (
                  <button onClick={() => setShowComplete(true)} className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700">
                    ✅ Mark as Completed
                  </button>
                ) : (
                  <form onSubmit={handleCompleteJob} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Completion Photo *</label>
                      <input type="file" accept="image/*" required onChange={handleCompletionPhoto} className="w-full text-xs" />
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
                      <button type="button" onClick={() => setShowComplete(false)} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
                      <button disabled={loading} type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                        {loading ? 'Submitting...' : 'Confirm Completion'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {isManager && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm">
                <strong>Manager View:</strong> You created this job. You&apos;ll get email when operators complete it. Status updates when operators open via link.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
