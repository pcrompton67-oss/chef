'use client'

import { useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { fetcher, pinHeaders, send } from '@/app/manager/manager-console'
import { IMAGES, isPdf, isUploadedPhoto, type UploadedPhoto } from '@/lib/event-editing'
import { cn } from '@/lib/utils'

/*
 * Choosing pictures in the console: photos (issue #20; used for an evening's
 * main and second photo and the home page photo) and printed menus, a PDF or
 * a photo per language (issue #37).
 */

const inputClass =
  'w-full rounded-none border border-stone/40 bg-ivory px-3 py-2 text-base text-charcoal outline-none transition-colors focus:border-gold'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm text-charcoal">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-relaxed text-stone">{hint}</span> : null}
    </label>
  )
}

const PHOTOS_URL = '/api/manager/photos'
const PHOTO_MAX_SIDE = 2000

function photoLabel(p: UploadedPhoto) {
  const when = new Date(p.uploadedAt).toLocaleString('en-GB', {
    timeZone: 'Europe/Paris', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  return `Uploaded ${when}`
}

/** Choose a photo: one that came with the site, or one of Eleanor's uploads (issue #20). */
export function ImagePicker({
  label,
  value,
  onChange,
  hint,
  noneLabel = 'None',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  noneLabel?: string
}) {
  const photos = useSWR<{ configured?: boolean; photos?: UploadedPhoto[]; error?: string }>(PHOTOS_URL, fetcher)
  const [busy, setBusy] = useState<'' | 'upload' | 'delete'>('')
  const [message, setMessage] = useState('')
  const uploads = photos.data?.photos ?? []
  const configured = photos.data?.configured !== false
  const uploaded = isUploadedPhoto(value)
  // A saved upload that has since been deleted still shows, so the choice isn’t silently lost.
  const missing = uploaded && photos.data && !uploads.some((p) => p.url === value)

  async function upload(file: File) {
    setBusy('upload')
    setMessage('')
    try {
      const jpeg = await shrinkPhoto(file)
      const res = await fetch(PHOTOS_URL, { method: 'POST', headers: { 'content-type': 'image/jpeg', ...pinHeaders() }, body: jpeg })
      const body = (await res.json().catch(() => ({}))) as { photo?: UploadedPhoto; error?: string }
      if (!res.ok || !body.photo) throw new Error(body.error || 'The photo couldn’t be uploaded. Please try again.')
      await photos.mutate()
      onChange(body.photo.url)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'The photo couldn’t be uploaded.')
    } finally {
      setBusy('')
    }
  }

  async function remove() {
    if (!window.confirm('Delete this photo for good? It will no longer be available to choose.')) return
    setBusy('delete')
    setMessage('')
    try {
      await send(`${PHOTOS_URL}?url=${encodeURIComponent(value)}`, 'DELETE')
      await photos.mutate()
      onChange('')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'The photo couldn’t be deleted.')
    } finally {
      setBusy('')
    }
  }

  return (
    <Field label={label} hint={hint}>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{noneLabel}</option>
        {uploads.length || missing ? (
          <optgroup label="Your photos">
            {uploads.map((p) => (
              <option key={p.url} value={p.url}>
                {photoLabel(p)}
              </option>
            ))}
            {missing ? <option value={value}>Deleted photo</option> : null}
          </optgroup>
        ) : null}
        <optgroup label="Photos on the site">
          {IMAGES.map((i) => (
            <option key={i.path} value={i.path}>
              {i.label}
            </option>
          ))}
        </optgroup>
      </select>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mt-2 h-28 w-full border border-border object-cover" />
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {configured ? (
          <label className={cn('cursor-pointer underline underline-offset-4 hover:text-gold-deep', busy && 'pointer-events-none opacity-50')}>
            {busy === 'upload' ? 'Uploading…' : 'Upload a photo'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={Boolean(busy)}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void upload(file)
              }}
            />
          </label>
        ) : (
          <span className="text-stone">Photo uploads aren’t set up yet.</span>
        )}
        {uploaded && !missing ? (
          <button
            type="button"
            className="text-stone underline underline-offset-4 hover:text-gold-deep disabled:opacity-50"
            disabled={Boolean(busy)}
            onClick={remove}
          >
            {busy === 'delete' ? 'Deleting…' : 'Delete this photo'}
          </button>
        ) : null}
      </div>
      {message || photos.data?.error ? (
        <p className="mt-1 text-sm text-destructive">{message || photos.data?.error}</p>
      ) : null}
    </Field>
  )
}

/** Shrinks a photo in the browser to a web-sized JPEG (long side at most 2000 px). */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode().catch(() => {
      throw new Error('That file couldn’t be opened as a photo. Please choose a JPEG or PNG photo.')
    })
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser couldn’t prepare the photo. Please try another browser.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The photo couldn’t be prepared.'))), 'image/jpeg', 0.85),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

const MENUS_URL = '/api/manager/printed-menus'
/** Vercel takes about 4.5 MB per request; keep PDFs comfortably under that. */
const MENU_PDF_MAX = 3.5 * 1024 * 1024

/**
 * One printed menu (issue #37): a PDF or a photo, for the English or the
 * French site. Uploaded straight away; the evening keeps it when saved.
 */
export function PrintedMenuPicker({
  label,
  hint,
  value,
  language,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  language: 'en' | 'fr'
  onChange: (v: string) => void
}) {
  const photos = useSWR<{ configured?: boolean }>(PHOTOS_URL, fetcher)
  const configured = photos.data?.configured !== false
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function upload(file: File) {
    setBusy(true)
    setMessage('')
    try {
      const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      if (pdf && file.size > MENU_PDF_MAX)
        throw new Error('That PDF is too large (about 3 MB at most). Please save a smaller PDF, or upload a photo of the menu.')
      const body: Blob = pdf ? file : await shrinkPhoto(file)
      const res = await fetch(`${MENUS_URL}?language=${language}`, {
        method: 'POST',
        headers: { 'content-type': pdf ? 'application/pdf' : 'image/jpeg', ...pinHeaders() },
        body,
      })
      const out = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !out.url) throw new Error(out.error || 'The menu couldn’t be uploaded. Please try again.')
      onChange(out.url)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'The menu couldn’t be uploaded.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-sm text-charcoal">{label}</span>
      {value ? (
        isPdf(value) ? (
          <a
            href={value}
            target="_blank"
            rel="noopener"
            className="flex h-28 items-center justify-center border border-border bg-background text-sm text-charcoal underline-offset-4 hover:text-gold-deep hover:underline"
          >
            PDF menu · open it
          </a>
        ) : (
          <a href={value} target="_blank" rel="noopener" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-28 w-full border border-border bg-background object-contain" />
          </a>
        )
      ) : (
        <p className="flex h-28 items-center justify-center border border-dashed border-stone/40 text-sm text-stone">
          No printed menu
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {configured ? (
          <label className={cn('cursor-pointer underline underline-offset-4 hover:text-gold-deep', busy && 'pointer-events-none opacity-50')}>
            {busy ? 'Uploading…' : value ? 'Replace (PDF or photo)' : 'Upload a PDF or photo'}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void upload(file)
              }}
            />
          </label>
        ) : (
          <span className="text-stone">Uploads aren’t set up yet.</span>
        )}
        {value ? (
          <button
            type="button"
            className="text-stone underline underline-offset-4 hover:text-gold-deep disabled:opacity-50"
            disabled={busy}
            onClick={() => onChange('')}
          >
            Remove
          </button>
        ) : null}
      </div>
      {hint ? <span className="block text-xs leading-relaxed text-stone">{hint}</span> : null}
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  )
}
