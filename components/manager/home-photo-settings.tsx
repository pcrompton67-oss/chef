'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { fetcher, send } from '@/app/manager/manager-console'
import { ImagePicker } from '@/components/manager/image-picker'

/** Console → Settings → Home page photo (issue #37). Saved as soon as it's chosen. */
export function HomePhotoSettings() {
  const { data, mutate } = useSWR<{ homeImage?: string; error?: string }>('/api/manager/home-photo', fetcher)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  if (data?.error) return <p className="text-sm text-destructive">The home page photo couldn’t be loaded.</p>
  if (!data) return <p className="text-sm text-stone">Loading…</p>

  async function choose(url: string) {
    setMessage(null)
    try {
      const res = await send('/api/manager/home-photo', 'PUT', { homeImage: url })
      await mutate({ homeImage: res.homeImage }, { revalidate: false })
      setMessage({ kind: 'ok', text: 'Saved. The home page shows it straight away.' })
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save.' })
    }
  }

  return (
    <section className="max-w-md space-y-4">
      <h2 className="caps text-sm text-charcoal">Home page photo</h2>
      <p className="text-sm text-stone">The large photo at the top of the home page, in English and French.</p>
      <ImagePicker
        label="Photo"
        noneLabel="The usual photo"
        value={data.homeImage ?? ''}
        onChange={(v) => void choose(v)}
      />
      {message ? (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'text-sm text-destructive' : 'text-sm text-charcoal'}>
          {message.text}
        </p>
      ) : null}
    </section>
  )
}
