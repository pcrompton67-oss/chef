import type { Metadata } from 'next'
import Link from 'next/link'
import { listGalleryPhotos, type GalleryPhoto } from '@/lib/gallery'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Photo gallery · Magnificent Sausage Rolls & Sausages',
  description:
    'Photos of our handcrafted sausage rolls and sausages, made in Valence-en-Poitou.',
}

export default async function GalleryPage() {
  const photos = await listGalleryPhotos().catch((): GalleryPhoto[] => [])

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="bg-brand-green text-brand-yellow">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-10">
          <Link
            href="/"
            className="self-start text-sm font-bold text-brand-cream/80 underline-offset-4 hover:text-brand-yellow hover:underline"
          >
            ← Back to home
          </Link>
          <h1 className="text-balance font-display text-4xl font-bold sm:text-5xl">
            Photo gallery
          </h1>
          <p className="font-display text-lg italic text-brand-cream/90">
            We make, you discover
          </p>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl px-5 py-10">
        {photos.length === 0 ? (
          <p className="py-16 text-center text-brand-dark/60">
            Photos coming soon.
          </p>
        ) : (
          <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {photos.map((photo) => (
              <li key={photo.id} className="mb-4 break-inside-avoid">
                <figure className="flex flex-col overflow-hidden rounded-md border border-border bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption || 'Magnificent Sausage Rolls & Sausages'}
                    loading="lazy"
                    className="w-full"
                  />
                  {photo.caption ? (
                    <figcaption className="px-4 py-3 text-sm leading-relaxed text-brand-dark/80">
                      {photo.caption}
                    </figcaption>
                  ) : null}
                </figure>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 flex justify-center">
          <Link
            href="/order"
            className="rounded-md bg-brand-green px-6 py-3 font-display text-lg font-bold text-brand-cream transition-colors hover:bg-brand-green-dark"
          >
            Order now →
          </Link>
        </div>
      </section>
    </main>
  )
}
