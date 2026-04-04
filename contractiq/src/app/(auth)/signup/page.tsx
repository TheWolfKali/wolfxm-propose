'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Step = 'account' | 'onboarding'

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('account')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [laborRate, setLaborRate] = useState('75')
  const [markupPct, setMarkupPct] = useState('20')
  const [zip, setZip] = useState('')
  const [licenseNo, setLicenseNo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleAccountStep(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setError(null)
    setStep('onboarding')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Signup failed')
      setLoading(false)
      return
    }

    // If Supabase requires email confirmation, there is no session yet and
    // auth.uid() will be null — the insert would fail the RLS check.
    // Sign in immediately to get a live session before inserting.
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        // Email confirmation is required — tell the user and bail out.
        // The contractor row will be created on their first login.
        setError(
          'Check your email and click the confirmation link, then sign in. ' +
          'Your profile will be saved on first login.'
        )
        setLoading(false)
        return
      }
    }

    // At this point we have a live session; auth.uid() === data.user.id
    const { error: profileError } = await supabase.from('contractors').insert({
      id: data.user.id,
      email,
      company_name: companyName,
      labor_rate: parseFloat(laborRate) || 75,
      markup_pct: parseFloat(markupPct) || 20,
      zip: zip || null,
      license_no: licenseNo || null,
    })

    if (profileError) {
      // Show the raw Supabase error so it's easy to diagnose
      setError(`Profile save failed: ${profileError.message} (code: ${profileError.code})`)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6 py-12">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ContractIQ</h1>
          <p className="mt-2 text-gray-500 text-sm">AI-powered proposals in minutes</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`h-2 w-16 rounded-full ${step === 'account' ? 'bg-blue-600' : 'bg-blue-200'}`} />
          <div className={`h-2 w-16 rounded-full ${step === 'onboarding' ? 'bg-blue-600' : 'bg-gray-200'}`} />
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          {step === 'account' ? 'Create your account' : 'Set up your profile'}
        </h2>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        {step === 'account' ? (
          <form onSubmit={handleAccountStep} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Min. 6 characters"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl text-base font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              Continue
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                id="company"
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Smith Construction LLC"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="labor" className="block text-sm font-medium text-gray-700 mb-1">
                  Labor Rate ($/hr)
                </label>
                <input
                  id="labor"
                  type="number"
                  min="0"
                  step="0.01"
                  value={laborRate}
                  onChange={(e) => setLaborRate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="markup" className="block text-sm font-medium text-gray-700 mb-1">
                  Markup %
                </label>
                <input
                  id="markup"
                  type="number"
                  min="0"
                  max="100"
                  value={markupPct}
                  onChange={(e) => setMarkupPct(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP Code
                </label>
                <input
                  id="zip"
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="90210"
                />
              </div>
              <div>
                <label htmlFor="license" className="block text-sm font-medium text-gray-700 mb-1">
                  License #
                </label>
                <input
                  id="license"
                  type="text"
                  value={licenseNo}
                  onChange={(e) => setLicenseNo(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl text-base font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('account'); setError(null) }}
              className="w-full text-gray-500 text-sm hover:text-gray-700"
            >
              ← Back
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
