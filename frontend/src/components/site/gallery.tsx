'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { ImageRef } from '@/lib/types';
import { cn } from '@/lib/cn';
import { ProductImage } from './catalog';

export function Gallery({ images, alt, aspect = 'square' }: { images: ImageRef[]; alt: string; aspect?: 'square' | 'portrait' }) {
  const [index, setIndex] = useState(0);
  const current = images[index];
  return (
    <div className="flex flex-col gap-3">
      <ProductImage src={current?.url} alt={current?.alt || alt} sizes="(min-width: 1024px) 55vw, 100vw" priority className={aspect === 'portrait' ? 'aspect-[4/5]' : undefined} />
      {images.length > 1 && (
        <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6" aria-label="Autres photos">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Afficher la photo ${i + 1}`}
                aria-current={i === index}
                className={cn('relative block aspect-square w-full overflow-hidden bg-paper-2 outline-offset-2', i === index ? 'ring-1 ring-ink' : 'opacity-75 hover:opacity-100')}
              >
                {img.url && <Image src={img.url} alt="" fill sizes="96px" className="object-cover" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
