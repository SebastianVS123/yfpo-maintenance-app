import { NextRequest, NextResponse } from 'next/server'
import cloudinary, { isCloudinaryConfigured } from '@/lib/cloudinary'

export async function POST(request: NextRequest) {
  try {
    // Check if Cloudinary configured
    if (!isCloudinaryConfigured()) {
      console.log('[MOCK UPLOAD] Cloudinary not configured, returning mock URL')
      // Return mock URL for dev without Cloudinary
      const formData = await request.formData()
      const file = formData.get('file') as File
      const fileName = file?.name || 'mock.jpg'
      return NextResponse.json({
        url: `https://via.placeholder.com/400x300.png?text=${encodeURIComponent(fileName)}`,
        public_id: `mock/${Date.now()}-${fileName}`,
        mocked: true,
        message: 'Cloudinary not configured - using mock. Add Cloudinary env vars for real uploads.'
      })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const jobId = formData.get('jobId') as string
    const type = formData.get('type') as string || 'issue'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to Cloudinary
    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `maintenance-jobs/${jobId || 'general'}/${type}`,
          resource_type: 'image',
          // Optimize
          transformation: [
            { width: 1200, height: 1200, crop: 'limit' },
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      )
      uploadStream.end(buffer)
    })

    return NextResponse.json({
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Also support GET for testing
export async function GET() {
  const configured = isCloudinaryConfigured()
  return NextResponse.json({
    configured,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'not set',
    message: configured 
      ? 'Cloudinary configured ✅' 
      : 'Cloudinary NOT configured - add env vars. Using mock uploads for now.'
  })
}
