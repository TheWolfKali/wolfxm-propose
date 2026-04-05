'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { JobType } from '@/lib/types/database'

type Step = 1 | 2 | 3 | 4

interface JobTypeOption {
  value: JobType
  label: string
  icon: string
  description: string
}

const JOB_TYPES: JobTypeOption[] = [
  { value: 'foundation', label: 'Foundation', icon: '🏗️', description: 'Cracks, settling, waterproofing' },
  { value: 'crawlspace', label: 'Crawlspace', icon: '🕳️', description: 'Moisture, pests, encapsulation' },
  { value: 'framing', label: 'Framing', icon: '🪵', description: 'Structural, additions, repairs' },
  { value: 'roofing', label: 'Roofing', icon: '🏠', description: 'Shingles, flashing, gutters' },
  { value: 'remodel', label: 'Remodel', icon: '🔨', description: 'Kitchen, bath, interior' },
  { value: 'other', label: 'Other', icon: '🔧', description: 'General contracting work' },
]

const LOADING_MESSAGES = [
  'Analyzing your photos...',
  'Reading damage assessment...',
  'Pulling material costs...',
  'Building your estimate...',
  'Almost ready...',
]

const MAX_PHOTOS = 5
const MAX_DIM = 1200
const MAX_SIZE_BYTES = 1024 * 1024 // 1MB after compression

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width)
          width = MAX_DIM
        } else {
          width = Math.round((width * MAX_DIM) / height)
          height = MAX_DIM
        }
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size <= MAX_SIZE_BYTES) {
            resolve(blob)
          } else {
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(new Error('Compression failed'))),
              'image/jpeg',
              0.6
            )
          }
        },
        'image/jpeg',
        0.8
      )
    }
    img.onerror = reject
    img.src = url
  })
}

export default function NewJobPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [jobType, setJobType] = useState<JobType | null>(null)
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [msgIndex, setMsgIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading) { setMsgIndex(0); return }
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length)
    }, 2000)
    return () => clearInterval(id)
  }, [loading])

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const remaining = MAX_PHOTOS - photos.length
    const toAdd = files.slice(0, remaining)

    const newPhotos = await Promise.all(
      toAdd.map(async (file) => {
        const compressed = await compressImage(file)
        const compressedFile = new File([compressed], file.name, { type: 'image/jpeg' })
        return {
          file: compressedFile,
          preview: URL.createObjectURL(compressed),
        }
      })
    )

    setPhotos((prev) => [...prev, ...newPhotos])
    e.target.value = ''
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleGenerate() {
    if (!jobType) return
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          contractor_id: user.id,
          job_type: jobType,
          description,
          status: 'draft',
          address: address || null,
        })
        .select()
        .single()

      if (jobError || !job) throw new Error(jobError?.message ?? 'Failed to create job')

      const photoUrls: string[] = []
      if (photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i]
          const path = `jobs/${job.id}/${i}-${Date.now()}.jpg`
          const { error: uploadError } = await supabase.storage
            .from('job-photos')
            .upload(path, photo.file, { contentType: 'image/jpeg' })

          if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`)

          await supabase.from('job_photos').insert({
            job_id: job.id,
            storage_url: path,
            order: i,
          })

          photoUrls.push(path)
        }
      }

      const res = await fetch('/api/generate-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          description,
          job_type: jobType,
          photo_urls: photoUrls,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'AI generation failed')
      }

      router.push(`/jobs/${job.id}/estimate`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const canProceedStep1 = jobType !== null
  const canProceedStep3 = description.trim().length >= 10
  const canGenerate = canProceedStep1 && canProceedStep3

  return (
    <>
      {/* Full-screen loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center gap-8 px-8">
          <div className="w-16 h-16 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <div className="text-center space-y-2">
            <p className="text-xl font-bold text-gray-900 transition-all">
              {LOADING_MESSAGES[msgIndex]}
            </p>
            <p className="text-gray-500 text-sm">This takes 5–15 seconds</p>
          </div>
          <div className="flex gap-1.5 mt-2">
            {LOADING_MESSAGES.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === msgIndex ? 'bg-slate-900' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => (step > 1 ? setStep((s) => (s - 1) as Step) : router.push('/dashboard'))}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">New Job</h1>
            <p className="text-xs text-gray-400">Step {step} of 4</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-slate-900' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {/* Step 1: Job type */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">What type of job is this?</h2>
            <div className="grid grid-cols-2 gap-3">
              {JOB_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setJobType(type.value)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    jobType === type.value
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{type.icon}</div>
                  <div className="font-semibold text-gray-900 text-sm">{type.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5 leading-snug">{type.description}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors mt-2"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Photos */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Add job site photos</h2>
              <p className="text-sm text-gray-500 mt-1">
                Up to {MAX_PHOTOS} photos. The AI uses these to scope the work.
              </p>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-black/80"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < MAX_PHOTOS && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-10 flex flex-col items-center gap-2 hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm font-medium text-gray-600">Tap to add photos</p>
                <p className="text-xs text-gray-400">
                  {photos.length === 0 ? 'Opens camera or gallery' : `${MAX_PHOTOS - photos.length} remaining`}
                </p>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Skip photos
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-slate-900 text-white py-3.5 rounded-xl font-semibold hover:bg-slate-800 transition-colors"
              >
                Continue {photos.length > 0 && `(${photos.length})`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Description */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Describe the job</h2>
              <p className="text-sm text-gray-500 mt-1">
                Describe what you&apos;re seeing — damage, size, access issues, materials.
              </p>
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Foundation has 3 horizontal cracks on the north wall, largest is about 12 feet. Water intrusion visible after rain. Access is tight on the east side. Needs crack injection and waterproofing membrane on exterior."
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
            />
            <p className="text-xs text-gray-400 -mt-2">{description.length} chars · 10 minimum</p>

            <button
              onClick={() => setStep(4)}
              disabled={!canProceedStep3}
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 4: Address + Generate */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Job address</h2>
              <p className="text-sm text-gray-500 mt-1">Optional — appears on the proposal PDF.</p>
            </div>

            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Springfield, IL 62701"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-slate-500"
            />

            <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Type:</span>
                <span className="font-medium text-gray-900 capitalize">{jobType}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Photos:</span>
                <span className="font-medium text-gray-900">{photos.length}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-500 flex-shrink-0">Description:</span>
                <span className="text-gray-700 line-clamp-2">{description}</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex gap-2">
                <span className="flex-shrink-0">⚠️</span>
                <div>
                  <p className="font-semibold">Generation failed</p>
                  <p className="mt-0.5">{error}</p>
                  <button
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    className="mt-2 text-red-700 underline font-semibold"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed bottom CTA — only on step 4, not while loading */}
      {step === 4 && !loading && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pt-3 z-30"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
        >
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 active:bg-slate-700 transition-colors shadow-md"
          >
            Generate Estimate ✨
          </button>
        </div>
      )}
    </>
  )
}
