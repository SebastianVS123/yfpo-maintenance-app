'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || ''
  const { signIn } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signIn(email, password)
      setTimeout(() => { if (next) router.push(next); else router.push('/dashboard') }, 500)
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4 py-6">
      <div className="w-full max-w-md">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-black">YF</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">YFPO Maintenance</h1>
            <p className="text-zinc-400 mt-2 text-sm">Sign in to your workspace</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && <div className="bg-red-950/50 border border-red-900 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent outline-none text-white placeholder-zinc-500 text-base" placeholder="you@company.com" autoComplete="email" />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent outline-none text-white placeholder-zinc-500 text-base" placeholder="••••••••" autoComplete="current-password" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-white text-black py-3 rounded-lg font-semibold hover:bg-zinc-200 disabled:opacity-50 transition text-base">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="text-center text-sm text-zinc-400">
              First time? <Link href={`/auth/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-white font-semibold underline underline-offset-4">Create account</Link>
            </div>
          </form>

          {next && <div className="mt-6 p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300">📎 Job link detected — you'll go directly to the job after sign in.</div>}
        </div>
      </div>
    </div>
  )
}
