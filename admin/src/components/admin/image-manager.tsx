'use client';

import { ImagePlus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';

interface Img {
  id: string;
  url: string | null;
  alt: string;
}

/**
 * Photos d'un article ou d'un téléphone. Le serveur vérifie chaque fichier (vraie image, 8 Mo max),
 * le recadre en plusieurs tailles et supprime ses métadonnées.
 */
export function ImageManager({ images, endpoint, max, onChange, hint }: { images: Img[]; endpoint: string; max: number; onChange: () => void; hint?: string }) {
  const { notify } = useToast();
  const [uploading, setUploading] = useState(0);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files].slice(0, max - images.length);
    setUploading(list.length);
    for (const file of list) {
      if (file.size > 8 * 1024 * 1024) {
        notify(`${file.name} : fichier trop lourd (8 Mo maximum).`, 'bad');
        setUploading((n) => n - 1);
        continue;
      }
      const form = new FormData();
      form.set('file', file);
      try {
        await api.post(`${endpoint}/images`, form);
      } catch (err) {
        notify(`${file.name} : ${errorMessage(err)}`, 'bad');
      }
      setUploading((n) => n - 1);
    }
    onChange();
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`${endpoint}/images/${id}`);
      onChange();
    } catch (err) {
      notify(errorMessage(err), 'bad');
    }
  };

  return (
    <div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((img, i) => (
          <li key={img.id} className="group relative aspect-square overflow-hidden rounded-xs bg-paper-2">
            {img.url && <Image src={img.url} alt={img.alt} fill sizes="160px" className="object-cover" />}
            {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-xs bg-ink/80 px-1.5 py-0.5 text-[11px] text-white">Principale</span>}
            <button type="button" onClick={() => remove(img.id)} aria-label="Supprimer la photo" className="absolute right-1.5 top-1.5 inline-flex size-8 items-center justify-center rounded-xs bg-surface/90 text-ink-2 opacity-100 hover:text-bad sm:opacity-0 sm:group-hover:opacity-100">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {images.length < max && (
          <li>
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xs border border-dashed border-line-2 text-[12.5px] text-muted hover:border-ink-2 hover:text-ink">
              {uploading ? <Spinner className="size-5" /> : <ImagePlus className="size-5" />}
              {uploading ? 'Envoi…' : 'Ajouter'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="sr-only" disabled={uploading > 0} onChange={(e) => upload(e.target.files)} />
            </label>
          </li>
        )}
      </ul>
      <p className="mt-2 text-[12.5px] text-muted">{hint ?? `JPEG, PNG, WebP ou HEIC, 8 Mo maximum, ${max} photos au plus. La première est la photo principale.`}</p>
    </div>
  );
}
