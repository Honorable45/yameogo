'use client';

import { ImagePlus, Star, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { ImageRow } from '@/lib/admin-types';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';

const MAX = 12;

/**
 * Photos d'une fiche produit. Le serveur vérifie chaque fichier (vraie image, 8 Mo max), le recadre
 * et supprime ses métadonnées. Une photo peut être associée à une couleur : le site la montre quand
 * le client choisit cette couleur.
 */
export function GroupImages({ groupId, images, colors, onChange }: { groupId: string; images: ImageRow[]; colors: string[]; onChange: () => void }) {
  const { notify } = useToast();
  const [uploading, setUploading] = useState(0);
  const endpoint = `/catalog-groups/${groupId}/images`;

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files].slice(0, MAX - images.length);
    setUploading(list.length);
    for (const file of list) {
      if (file.size > 8 * 1024 * 1024) {
        notify(`${file.name} : fichier trop lourd (8 Mo maximum).`, 'bad');
      } else {
        const form = new FormData();
        form.set('file', file);
        try {
          await api.post(endpoint, form);
        } catch (err) {
          notify(`${file.name} : ${errorMessage(err)}`, 'bad');
        }
      }
      setUploading((n) => n - 1);
    }
    onChange();
  };

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      onChange();
    } catch (err) {
      notify(errorMessage(err), 'bad');
    }
  };

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((img, i) => (
          <li key={img.id} className="overflow-hidden rounded-md border border-line">
            <div className="relative aspect-square bg-paper-2">
              {img.url && <Image src={img.url} alt={img.alt} fill sizes="200px" className="object-cover" />}
              {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-xs bg-ink/80 px-1.5 py-0.5 text-[11px] text-white">Principale</span>}
            </div>
            <div className="space-y-2 p-2">
              {colors.length > 0 && (
                <select
                  value={img.color ?? ''}
                  onChange={(e) => act(() => api.patch(`${endpoint}/${img.id}`, { color: e.target.value || null }))}
                  aria-label="Couleur illustrée"
                  className="h-8 w-full rounded-xs border border-line-2 bg-surface px-2 text-[12.5px]"
                >
                  <option value="">Toutes les couleurs</option>
                  {colors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex justify-between">
                {i > 0 ? (
                  <button type="button" onClick={() => act(() => api.patch(`${endpoint}/order`, { ids: [img.id, ...images.filter((x) => x.id !== img.id).map((x) => x.id)] }))} className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
                    <Star className="size-3.5" /> Principale
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" onClick={() => act(() => api.delete(`${endpoint}/${img.id}`))} aria-label="Supprimer la photo" className="inline-flex size-7 items-center justify-center text-muted hover:text-bad">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
        {images.length < MAX && (
          <li>
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-line-2 text-[12.5px] text-muted hover:border-ink-2 hover:text-ink">
              {uploading ? <Spinner className="size-5" /> : <ImagePlus className="size-5" />}
              {uploading ? 'Envoi…' : 'Ajouter des photos'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="sr-only" disabled={uploading > 0} onChange={(e) => upload(e.target.files)} />
            </label>
          </li>
        )}
      </ul>
      <p className="mt-2 text-[12.5px] text-muted">JPEG, PNG, WebP ou HEIC, 8 Mo maximum, {MAX} photos au plus. Utilisez des photos réelles du produit.</p>
    </div>
  );
}
