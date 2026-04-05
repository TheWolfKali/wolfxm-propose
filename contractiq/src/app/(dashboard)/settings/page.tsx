'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface ContractorForm {
  company_name: string
  labor_rate: number
  markup_pct: number
  zip: string
  license_no: string
  logo_url: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [form, setForm] = useState<ContractorForm>({
    company_name: '',
    labor_rate: 75,
    markup_pct: 20,
    zip: '',
    license_no: '',
    logo_url: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('contractors')
        .select('company_name, labor_rate, markup_pct, zip, license_no, logo_url')
        .eq('id', user.id)
        .single()

      if (data) {
        setForm({
          company_name: data.company_name ?? '',
          labor_rate: data.labor_rate ?? 75,
          markup_pct: data.markup_pct ?? 20,
          zip: data.zip ?? '',
          license_no: data.license_no ?? '',
          logo_url: data.logo_url ?? null,
        })
      }
      setLoading(false)
    }
    load()
  }, [router])

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploadingLogo(true)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `${userId}/logo.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadErr) throw new Error(uploadErr.message)

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      setForm((f) => ({ ...f, logo_url: publicUrl }))
      showToast('success', 'Logo uploaded!')
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Upload failed')
    }
    setUploadingLogo(false)
    e.target.value = ''
  }

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('contractors')
      .update({
        company_name: form.company_name,
        labor_rate: form.labor_rate,
        markup_pct: form.markup_pct,
        zip: form.zip || null,
        license_no: form.license_no || null,
        logo_url: form.logo_url,
      })
      .eq('id', userId)

    setSaving(false)
    if (error) {
      showToast('error', error.message)
    } else {
      showToast('success', 'Settings saved!')
      router.refresh()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-16 left-4 right-4 z-50 rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3 ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <p className="font-semibold">{toast.msg}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Logo */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Company Logo</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
            {form.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                🏢
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {uploadingLogo ? 'Uploading…' : form.logo_url ? 'Change Logo' : 'Upload Logo'}
            </button>
            {form.logo_url && (
              <button
                onClick={() => setForm((f) => ({ ...f, logo_url: null }))}
                className="w-full text-red-500 text-sm hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>
      </div>

      {/* Company info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Company Info</h2>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">Company Name *</label>
          <input
            type="text"
            value={form.company_name}
            onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
            placeholder="Acme Contracting LLC"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">License Number</label>
          <input
            type="text"
            value={form.license_no}
            onChange={(e) => setForm((f) => ({ ...f, license_no: e.target.value }))}
            placeholder="CGC1234567"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">ZIP Code</label>
          <input
            type="text"
            value={form.zip}
            onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
            placeholder="62701"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>
      </div>

      {/* Rates */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Default Rates</h2>
        <p className="text-sm text-gray-500 -mt-2">Used as defaults when generating new estimates.</p>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">
            Labor Rate ($/hr)
          </label>
          <input
            type="number"
            value={form.labor_rate}
            onChange={(e) => setForm((f) => ({ ...f, labor_rate: parseFloat(e.target.value) || 0 }))}
            min="0"
            step="1"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700">Default Markup</label>
            <span className="text-slate-900 font-bold">{form.markup_pct}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="50"
            value={form.markup_pct}
            onChange={(e) => setForm((f) => ({ ...f, markup_pct: parseInt(e.target.value) }))}
            className="w-full accent-slate-900"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>10%</span>
            <span>50%</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !form.company_name.trim()}
        className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-base hover:bg-slate-800 active:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
      >
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  )
}
