'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { getStoredPin } from '@/components/pin-gate'
import { MAX_HERO_PHOTOS, type GalleryPhoto } from '@/lib/gallery-shared'

const LIST_URL = '/api/gallery'
const MAX_EDGE = 2000

function pinHeaders(): Record<string, string> {
  return { 'x-pin': getStoredPin('manager') }
}

const fetcher = (url: string) =>
  fetch(url, { headers: pinHeaders() }).then((r) => r.json())

// Phone photos are often 5-10 MB, over the 4.5 MB upload limit, so scale
// them down to a web-friendly JPEG before sending.
async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    return blob ?? file
  } catch {
    return file
  }
}

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}))
  return body.error || 'Something went wrong'
}

export function GalleryTab() {
  const { data, mutate } = useSWR<{ photos: GalleryPhoto[] }>(LIST_URL, fetcher)
  const photos = data?.photos ?? []
  const heroCount = photos.filter((p) => p.is_hero).length
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    setMessage(null)
    setUploading({ done: 0, total: list.length })
    let failed = 0
    for (const [index, file] of list.entries()) {
      const shrunk = await shrinkPhoto(file)
      const form = new FormData()
      form.append('file', shrunk, file.name.replace(/\.\w+$/, '') + '.jpg')
      const res = await fetch(LIST_URL, { method: 'POST', headers: pinHeaders(), body: form })
      if (!res.ok) failed += 1
      setUploading({ done: index + 1, total: list.length })
    }
    setUploading(null)
    if (inputRef.current) inputRef.current.value = ''
    await mutate()
    setMessage(
      failed > 0
        ? { kind: 'error', text: `${failed} of ${list.length} photo${list.length > 1 ? 's' : ''} could not be uploaded.` }
        : { kind: 'ok', text: `${list.length} photo${list.length > 1 ? 's' : ''} added.` },
    )
  }

  async function update(id: number, changes: Partial<Pick<GalleryPhoto, 'caption' | 'is_hero'>>) {
    setMessage(null)
    const res = await fetch(`${LIST_URL}/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...pinHeaders() },
      body: JSON.stringify(changes),
    })
    if (!res.ok) setMessage({ kind: 'error', text: await readError(res) })
    await mutate()
  }

  async function remove(photo: GalleryPhoto) {
    if (!window.confirm('Delete this photo? It will be removed from the website.')) return
    setMessage(null)
    const res = await fetch(`${LIST_URL}/${photo.id}`, { method: 'DELETE', headers: pinHeaders() })
    if (!res.ok) setMessage({ kind: 'error', text: await readError(res) })
    await mutate()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-bold text-brand-green">Photo gallery</h2>
          <p className="text-sm leading-relaxed text-brand-dark/70">
            Every photo here appears on the public Gallery page. Tick{' '}
            <span className="font-semibold">Show on home page</span> for up to{' '}
            {MAX_HERO_PHOTOS} favourites to feature at the top of the home page.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          id="gallery-upload"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading !== null}
        />
        <label
          htmlFor="gallery-upload"
          className={`flex cursor-pointer items-center justify-center rounded-md bg-brand-green px-5 py-3 font-bold text-brand-cream transition-colors hover:bg-brand-green-dark ${
            uploading ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          {uploading
            ? `Uploading ${uploading.done + 1 > uploading.total ? uploading.total : uploading.done + 1} of ${uploading.total}…`
            : 'Upload photos'}
        </label>
        <p className="text-xs text-brand-dark/60">
          You can pick several at once from your phone or computer. They are resized automatically.
        </p>
        {message ? (
          <p
            role="status"
            className={`text-sm font-semibold ${message.kind === 'error' ? 'text-destructive' : 'text-brand-green'}`}
          >
            {message.text}
          </p>
        ) : null}
      </div>

      {data && photos.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-brand-dark/60">
          No photos yet. Upload your first one above.
        </p>
      ) : null}

      <p className="text-sm text-brand-dark/70">
        On the home page: <span className="font-bold">{heroCount} of {MAX_HERO_PHOTOS}</span>
      </p>

      <ul className="grid gap-4 sm:grid-cols-2">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            heroFull={heroCount >= MAX_HERO_PHOTOS}
            onUpdate={(changes) => update(photo.id, changes)}
            onDelete={() => remove(photo)}
          />
        ))}
      </ul>
    </div>
  )
}

function PhotoCard({
  photo,
  heroFull,
  onUpdate,
  onDelete,
}: {
  photo: GalleryPhoto
  heroFull: boolean
  onUpdate: (changes: Partial<Pick<GalleryPhoto, 'caption' | 'is_hero'>>) => void
  onDelete: () => void
}) {
  const [caption, setCaption] = useState(photo.caption)
  const heroDisabled = !photo.is_hero && heroFull

  return (
    <li
      className={`flex flex-col overflow-hidden rounded-md border bg-card ${
        photo.is_hero ? 'border-brand-green ring-2 ring-brand-green' : 'border-border'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption || 'Gallery photo'}
        className="aspect-[4/3] w-full object-cover"
        loading="lazy"
      />
      <div className="flex flex-col gap-3 p-4">
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-brand-dark/60">
          Caption (optional)
          <input
            type="text"
            value={caption}
            maxLength={200}
            placeholder="e.g. Fresh batch of Moody Blues"
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => caption !== photo.caption && onUpdate({ caption })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-brand-dark"
          />
        </label>
        <label
          className={`flex items-center gap-2 text-sm font-semibold ${
            heroDisabled ? 'text-brand-dark/40' : 'text-brand-dark'
          }`}
        >
          <input
            type="checkbox"
            checked={photo.is_hero}
            disabled={heroDisabled}
            onChange={(e) => onUpdate({ is_hero: e.target.checked })}
            className="h-4 w-4 accent-brand-green"
          />
          Show on home page
          {heroDisabled ? (
            <span className="font-normal">({MAX_HERO_PHOTOS} already chosen)</span>
          ) : null}
        </label>
        <button
          type="button"
          onClick={onDelete}
          className="self-start text-sm font-semibold text-destructive underline-offset-2 hover:underline"
        >
          Delete photo
        </button>
      </div>
    </li>
  )
}
