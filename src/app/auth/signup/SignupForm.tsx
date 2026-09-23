'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

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
  const { signUp } = useAuth()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await signUp(email, password, fullName)
      setMessage('Account created. Redirecting...')
      setTimeout(() => { if (next) router.push(`/auth/login?next=${encodeURIComponent(next)}`); else router.push('/auth/login') }, 1200)
    } catch (err: any) { setError(err.message); setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-black">YF</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Create Account</h1>
            <p className="text-zinc-400 mt-2 text-sm">Set your password to get started</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            {error && <div className="bg-red-950/50 border border-red-900 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}
            {message && <div className="bg-zinc-800 border border-zinc-700 text-zinc-200 px-4 py-3 rounded-lg text-sm">{message}</div>}

            <div><label className="block text-sm font-medium text-zinc-300 mb-2">Full Name</label><input required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-white outline-none text-white text-base" placeholder="John Doe" /></div>
            <div><label className="block text-sm font-medium text-zinc-300 mb-2">Work Email</label><input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-white outline-none text-white text-base" placeholder="you@company.com" /><p className="text-xs text-zinc-500 mt-1">Must match email added by manager</p></div>
            <div><label className="block text-sm font-medium text-zinc-300 mb-2">Password</label><input required type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-white outline-none text-white text-base" placeholder="At least 6 characters" /></div>

            <button disabled={loading} className="w-full bg-white text-black py-3 rounded-lg font-semibold hover:bg-zinc-200 disabled:opacity-50 transition text-base">{loading ? 'Creating...' : 'Create Account'}</button>
            <div className="text-center text-sm"><Link href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-zinc-400 hover:text-white">Already have account? <span className="text-white font-semibold underline underline-offset-4">Sign in</span></Link></div>
          </form>
        </div>
      </div>
    </div>
  )
}
