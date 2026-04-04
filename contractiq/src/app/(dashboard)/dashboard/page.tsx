import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { JobStatus } from '@/lib/types/database'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      id, job_type, description, status, address, created_at,
      estimates (grand_total)
    `)
    .eq('contractor_id', user.id)
    .order('created_at', { ascending: false })

  const safeJobs = (jobs ?? []) as {
    id: string
    job_type: string
    description: string
    status: JobStatus
    address: string | null
    created_at: string
    estimates: { grand_total: number }[] | null
  }[]

  const pipelineValue = safeJobs.reduce((sum, job) => {
    if (job.status === 'declined') return sum
    const latest = job.estimates?.[0]
    return sum + (latest?.grand_total ?? 0)
  }, 0)

  return (
    <DashboardClient
      initialJobs={safeJobs}
      userId={user.id}
      pipelineValue={pipelineValue}
    />
  )
}
