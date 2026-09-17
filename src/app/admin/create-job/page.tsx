'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DEPARTMENTS } from '@/lib/utils'

interface Personnel {
  id: string
  full_name: string
  email: string
  role: string
}

export default function CreateJobPage() {
  const router = useRouter()
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
    const supabase = createClient()
    const { data } = await supabase.from('personnel').select('*').eq('is_active', true).order('full_name')
    if (data) setPersonnelList(data)
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
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create job card
      const { data: job, error: jobError } = await supabase
        .from('job_cards')
        .insert({
          title: form.title,
          location: form.location,
          observed_at: new Date(form.observed_at).toISOString(),
          required_actions: form.required_actions,
          departments: form.departments,
          priority: form.priority,
          due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
          created_by: user.id,
          status: 'open'
        })
        .select()
        .single()

      if (jobError) throw jobError

      // Upload photos
      const photoUrls: string[] = []
      for (const photo of photos) {
        const fileName = `${job.id}/${Date.now()}-${photo.name}`
        const { error: uploadError } = await supabase.storage
          .from('job-photos')
          .upload(fileName, photo)

        if (uploadError) {
          console.error('Upload error:', uploadError)
          continue
        }

        const { data: { publicUrl } } = supabase.storage.from('job-photos').getPublicUrl(fileName)
        photoUrls.push(publicUrl)

        await supabase.from('job_photos').insert({
          job_id: job.id,
          url: publicUrl,
          type: 'issue',
          file_name: photo.name,
          uploaded_by: user.id
        })
      }

      // Create assignments
      for (const personnelId of form.assignedPersonnel) {
        await supabase.from('job_assignments').insert({
          job_id: job.id,
          personnel_id: personnelId,
          status: 'unopened'
        })
      }

      // Get creator profile
      const { data: creatorProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      
      // Get assignee details for email
      const assignees = personnelList.filter(p => form.assignedPersonnel.includes(p.id))

      // Send emails via API
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'assignment',
            jobId: job.id,
            title: job.title,
            location: job.location,
            observedAt: job.observed_at,
            requiredActions: job.required_actions,
            departments: job.departments,
            priority: job.priority,
            photos: photoUrls,
            createdByName: creatorProfile?.full_name || 'Manager',
            createdByEmail: creatorProfile?.email || user.email,
            assignees: assignees.map(a => ({ name: a.full_name, email: a.email })),
            dueDate: job.due_date,
            appUrl: window.location.origin
          })
        })
      } catch (emailError) {
        console.error('Email failed but job created:', emailError)
      }

      router.push(`/jobs/${job.id}?created=true`)
    } catch (error: any) {
      console.error(error)
      alert('Error creating job: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/admin" className="text-sm text-gray-600 hover:text-black">← Back to Dashboard</Link>
          <div className="text-sm font-medium">Create Maintenance Job</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border shadow-sm p-6 md:p-8">
          <h1 className="text-2xl font-bold mb-2">Raise New Maintenance Issue</h1>
          <p className="text-gray-600 text-sm mb-8">Fill in details. Photos and assignment are required.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">What is the issue? *</label>
                <input
                  required
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Hydraulic leak on Line 3 press"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Where? (Location) *</label>
                <input
                  required
                  type="text"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Plant B, Assembly Line 3"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">When Seen? *</label>
                <input
                  required
                  type="datetime-local"
                  value={form.observed_at}
                  onChange={e => setForm({ ...form, observed_at: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none"
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
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Priority *</label>
                <select
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value as any })}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none"
                >
                  <option value="low">Low - Can wait</option>
                  <option value="medium">Medium - Normal</option>
                  <option value="high">High - Urgent</option>
                  <option value="critical">Critical - Immediate!</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Due Date (Optional but for Overdue)</label>
                <input
                  type="datetime-local"
                  value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-black outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Affected Departments * (multi-select)</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {DEPARTMENTS.map(dept => (
                    <label key={dept} className={`p-3 border rounded-lg cursor-pointer flex items-center gap-2 ${form.departments.includes(dept) ? 'bg-black text-white border-black' : 'bg-white hover:bg-gray-50'}`}>
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
                <label className="block text-sm font-medium mb-2">Upload Photos * (issue evidence)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label htmlFor="photo-upload" className="cursor-pointer">
                    <div className="text-3xl mb-2">📷</div>
                    <div className="text-sm font-medium">Click to upload photos</div>
                    <div className="text-xs text-gray-500">PNG, JPG up to 10MB each</div>
                  </label>
                </div>
                
                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mt-4">
                    {photoPreviews.map((preview, idx) => (
                      <div key={idx} className="relative group">
                        <img src={preview} alt={`Preview ${idx}`} className="w-full h-24 object-cover rounded-lg border" />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full text-xs flex items-center justify-center"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Allocate to Personnel * (multi-select)</label>
                {personnelList.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                    No personnel found. <Link href="/admin/personnel" className="underline font-semibold">Add personnel first</Link>
                  </div>
                ) : (
                  <div className="border rounded-lg max-h-60 overflow-y-auto divide-y">
                    {personnelList.map(person => (
                      <label key={person.id} className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 ${form.assignedPersonnel.includes(person.id) ? 'bg-blue-50' : ''}`}>
                        <input
                          type="checkbox"
                          checked={form.assignedPersonnel.includes(person.id)}
                          onChange={() => togglePersonnel(person.id)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{person.full_name}</div>
                          <div className="text-xs text-gray-500">{person.email} • {person.role}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">Selected: {form.assignedPersonnel.length} person(s) - they will receive email with job link</p>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t">
              <Link href="/admin" className="px-6 py-3 border rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50"
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
