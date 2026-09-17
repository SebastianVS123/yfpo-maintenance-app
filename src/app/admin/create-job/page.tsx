'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase/client'
import { collection, getDocs, addDoc } from 'firebase/firestore'
import { DEPARTMENTS } from '@/lib/utils'

interface Personnel {
  id: string
  full_name: string
  email: string
  role: string
}

export default function CreateJobPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [personnelList, setPersonnelList] = useState<Personnel[]>([])
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  
  const [form, setForm] = useState({
    title: '',
    location: '',
    observed_at: new Date().toISOString().slice(0, 16),
    required_actions: '',
    departments: [] as string[],
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    due_date: '',
    assignedPersonnel: [] as string[],
  })

  useEffect(() => {
    fetchPersonnel()
  }, [])

  const fetchPersonnel = async () => {
    const snap = await getDocs(collection(db, 'personnel'))
    const list = snap.docs.filter(d => d.data().is_active !== false).map(d => ({ id: d.id, ...d.data() } as Personnel))
    setPersonnelList(list)
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setPhotos(prev => [...prev, ...files])
      const newPreviews = files.map(file => URL.createObjectURL(file))
      setPhotoPreviews(prev => [...prev, ...newPreviews])
    }
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  const toggleDepartment = (dept: string) => {
    setForm(prev => ({
      ...prev,
      departments: prev.departments.includes(dept)
        ? prev.departments.filter(d => d !== dept)
        : [...prev.departments, dept]
    }))
  }

  const togglePersonnel = (id: string) => {
    setForm(prev => ({
      ...prev,
      assignedPersonnel: prev.assignedPersonnel.includes(id)
        ? prev.assignedPersonnel.filter(p => p !== id)
        : [...prev.assignedPersonnel, id]
    }))
  }

  const uploadToCloudinary = async (file: File, jobId: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('jobId', jobId)
    formData.append('type', 'issue')

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Upload failed')
    }

    const data = await res.json()
    return data.url
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.departments.length === 0) {
      alert('Please select at least one affected department')
      return
    }
    if (form.assignedPersonnel.length === 0) {
      alert('Please assign at least one personnel')
      return
    }

    setLoading(true)

    try {
      if (!user) throw new Error('Not authenticated')

      const jobData = {
        title: form.title,
        location: form.location,
        observed_at: new Date(form.observed_at),
        required_actions: form.required_actions,
        departments: form.departments,
        priority: form.priority,
        due_date: form.due_date ? new Date(form.due_date) : null,
        created_by: user.uid,
        createdByName: profile?.full_name || user.email,
        createdByEmail: profile?.email || user.email,
        status: 'open',
        estimated_time: null,
        started_at: null,
        completed_at: null,
        completion_notes: null,
        created_at: new Date(),
        updated_at: new Date()
      }

      const jobRef = await addDoc(collection(db, 'jobCards'), jobData)
      const jobId = jobRef.id

      // Upload photos to Cloudinary (no billing needed!)
      const photoUrls: string[] = []
      for (const photo of photos) {
        try {
          const publicUrl = await uploadToCloudinary(photo, jobId)
          photoUrls.push(publicUrl)

          await addDoc(collection(db, 'jobPhotos'), {
            job_id: jobId,
            url: publicUrl,
            type: 'issue',
            file_name: photo.name,
            uploaded_by: user.uid,
            created_at: new Date()
          })
        } catch (uploadErr) {
          console.error('Photo upload failed:', uploadErr)
        }
      }

      // Create assignments
      for (const personnelId of form.assignedPersonnel) {
        await addDoc(collection(db, 'jobAssignments'), {
          job_id: jobId,
          personnel_id: personnelId,
          profile_id: null,
          status: 'unopened',
          opened_at: null,
          created_at: new Date()
        })
      }

      const assignees = personnelList.filter(p => form.assignedPersonnel.includes(p.id))

      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'assignment',
            jobId,
            title: jobData.title,
            location: jobData.location,
            observedAt: jobData.observed_at,
            requiredActions: jobData.required_actions,
            departments: jobData.departments,
            priority: jobData.priority,
            photos: photoUrls,
            createdByName: jobData.createdByName,
            createdByEmail: jobData.createdByEmail,
            assignees: assignees.map(a => ({ name: a.full_name, email: a.email })),
            dueDate: jobData.due_date,
            appUrl: window.location.origin
          })
        })
      } catch (emailError) {
        console.error('Email failed but job created:', emailError)
      }

      router.push(`/jobs/${jobId}?created=true`)
    } catch (error: any) {
      console.error(error)
      alert('Error creating job: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/admin" className="text-sm text-gray-600 hover:text-black flex items-center gap-1">
            <span>←</span> <span className="hidden sm:inline">Back to Dashboard</span><span className="sm:hidden">Back</span>
          </Link>
          <div className="text-sm font-medium">Create Job • Cloudinary</div>
          <div className="w-12"></div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6 md:p-8">
          <h1 className="text-xl sm:text-2xl font-bold mb-2">Raise New Maintenance Issue</h1>
          <p className="text-gray-600 text-sm mb-1">Fill in details. Photos stored on Cloudinary (free, no billing needed).</p>
          <div className="mb-6 inline-flex items-center gap-2 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full border border-green-200">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Firebase (no billing) + Cloudinary (no billing) = 100% Free
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">What is the issue? *</label>
                <input
                  required
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Hydraulic leak on Line 3 press"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Where? (Location) *</label>
                <input
                  required
                  type="text"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Plant B, Line 3"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">When Seen? *</label>
                <input
                  required
                  type="datetime-local"
                  value={form.observed_at}
                  onChange={e => setForm({ ...form, observed_at: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none text-base"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Required Actions *</label>
                <textarea
                  required
                  rows={4}
                  value={form.required_actions}
                  onChange={e => setForm({ ...form, required_actions: e.target.value })}
                  placeholder="Describe what needs to be done, safety precautions, tools needed..."
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Priority *</label>
                <select
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value as any })}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none text-base bg-white"
                >
                  <option value="low">Low - Can wait</option>
                  <option value="medium">Medium - Normal</option>
                  <option value="high">High - Urgent</option>
                  <option value="critical">Critical - Immediate!</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Due Date (for Overdue)</label>
                <input
                  type="datetime-local"
                  value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none text-base"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Affected Departments * (tap to select)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DEPARTMENTS.map(dept => (
                    <label key={dept} className={`p-3 border rounded-lg cursor-pointer flex items-center justify-center gap-2 transition text-center ${form.departments.includes(dept) ? 'bg-black text-white border-black' : 'bg-white hover:bg-gray-50'}`}>
                      <input
                        type="checkbox"
                        checked={form.departments.includes(dept)}
                        onChange={() => toggleDepartment(dept)}
                        className="hidden"
                      />
                      <span className="text-sm font-medium">{dept}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Upload Photos * (Cloudinary - no billing)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-8 text-center hover:border-gray-400 transition">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label htmlFor="photo-upload" className="cursor-pointer block">
                    <div className="text-3xl mb-2">📷</div>
                    <div className="text-sm font-medium">Tap to upload photos</div>
                    <div className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB - stored on Cloudinary free, works on mobile camera</div>
                  </label>
                </div>
                
                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
                    {photoPreviews.map((preview, idx) => (
                      <div key={idx} className="relative group">
                        <img src={preview} alt={`Preview ${idx}`} className="w-full h-20 sm:h-24 object-cover rounded-lg border" />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full text-xs flex items-center justify-center shadow"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Allocate to Personnel *</label>
                {personnelList.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                    No personnel found. <Link href="/admin/personnel" className="underline font-semibold">Add personnel first</Link>
                  </div>
                ) : (
                  <div className="border rounded-lg max-h-60 overflow-y-auto divide-y bg-white">
                    {personnelList.map(person => (
                      <label key={person.id} className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 ${form.assignedPersonnel.includes(person.id) ? 'bg-blue-50' : ''}`}>
                        <input
                          type="checkbox"
                          checked={form.assignedPersonnel.includes(person.id)}
                          onChange={() => togglePersonnel(person.id)}
                          className="w-5 h-5 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{person.full_name}</div>
                          <div className="text-xs text-gray-500 truncate">{person.email} • {person.role}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">Selected: {form.assignedPersonnel.length} person(s) - they will receive email with job link</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
              <Link href="/admin" className="px-6 py-3 border rounded-lg text-sm font-medium hover:bg-gray-50 text-center order-2 sm:order-1">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 text-base order-1 sm:order-2"
              >
                {loading ? 'Lodging Job...' : '✅ Confirm & Lodge Job Card'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
