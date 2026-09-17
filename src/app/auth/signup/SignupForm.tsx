'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || ''

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const supabase = createClient()

    const { data: personnel } = await supabase
      .from('personnel')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (!personnel) {
      const { count } = await supabase.from('personnel').select('*', { count: 'exact', head: true })
      
      if (count !== 0) {
        setError('This email is not registered. Please ask your manager to add you in Personnel Management first.')
        setLoading(false)
        return
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: {
          full_name: fullName || personnel?.full_name || email.split('@')[0],
        }
      }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const roleToUse = personnel?.role || 'manager'
      const nameToUse = fullName || personnel?.full_name || email.split('@')[0]

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: email.toLowerCase().trim(),
          full_name: nameToUse,
          role: roleToUse
        })

      if (personnel) {
        await supabase
          .from('job_assignments')
          .update({ profile_id: data.user.id })
          .eq('personnel_id', personnel.id)
      }

      if (profileError) {
        console.error(profileError)
      }

      setMessage('Account created! You can now sign in. If email confirmation is required, check your inbox.')
      
      setTimeout(() => {
        if (next) {
          router.push(`/auth/login?next=${encodeURIComponent(next)}`)
        } else {
          router.push('/auth/login')
        }
      }, 1500)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-700 px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-black rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">👤</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-600 mt-2">First time? Set your password</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              {message}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Work Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              placeholder="you@company.com"
            />
            <p className="text-xs text-gray-500 mt-1">Must match email your manager used when assigning you</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Create Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 transition"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <div className="text-center text-sm">
            <Link href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-gray-600 hover:text-black">
              Already have account? <span className="font-semibold underline">Sign in</span>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
