import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const jobId = formData.get('jobId') as string
    const type = formData.get('type') as 'issue' | 'completion'

    if (!file || !jobId) {
      return NextResponse.json({ error: 'Missing file or jobId' }, { status: 400 })
    }

    const fileName = `${jobId}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('job-photos')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage.from('job-photos').getPublicUrl(fileName)

    const { data, error } = await supabase.from('job_photos').insert({
      job_id: jobId,
      url: publicUrl,
      type: type || 'issue',
      file_name: file.name,
      uploaded_by: user.id
    }).select().single()

    if (error) throw error

    return NextResponse.json({ url: publicUrl, photo: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
