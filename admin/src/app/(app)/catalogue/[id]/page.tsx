'use client';

import { Archive, ArchiveRestore, ExternalLink, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { GroupForm } from '@/components/admin/group-form';
import { GroupImages } from '@/components/admin/group-images';
import { useCan } from '@/components/admin/session';
import { ConfirmDialog, PageHeader, Panel } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import { Tag } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import type { BrandRow, CategoryRow, GroupDetail } from '@/lib/admin-types';
import { useSiteUrl } from '@/lib/site-url';
import { useResource } from '@/lib/use-resource';

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const can = useCan();
  const { notify } = useToast();
  const siteUrl = useSiteUrl();
  const group = useResource<GroupDetail>(`/catalog-groups/${id}`);
  const brands = useResource<BrandRow[]>('/brands');
  const g = group.data;
  const categories = useResource<CategoryRow[]>(g ? `/categories?kind=${g.kind}` : null);
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);

  if (group.error) return <ErrorState message={group.error} onRetry={group.reload} />;
  if (!g || !brands.data || !categories.data) return <LoadingBlock />;
  const phone = g.kind === 'PHONE';
  const listHref = phone ? '/smartphones' : '/accessoires';

  const act = async (action: 'archive' | 'restore' | 'delete') => {
    setBusy(true);
    try {
      if (action === 'delete') {
        await api.delete(`/catalog-groups/${g.id}`);
        notify('Produit supprimé.');
        router.push(listHref);
        return;
      }
      group.setData(await api.post<GroupDetail>(`/catalog-groups/${g.id}/${action}`));
      notify(action === 'archive' ? 'Produit archivé : il n’apparaît plus sur le site.' : 'Produit réactivé.');
    } catch (err) {
      notify(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <>
      <PageHeader
        back={{ href: listHref, label: phone ? 'Smartphones' : 'Accessoires' }}
        title={g.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {g.status === 'ARCHIVED' ? <Tag tone="bad">Archivé</Tag> : g.published ? <Tag tone="ok">Visible sur le site</Tag> : <Tag>Masqué du site</Tag>}
            {g.isDemo && <Tag tone="info">Démo</Tag>}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {siteUrl && g.status === 'ACTIVE' && g.published && (
              <a href={`${siteUrl}/${phone ? 'telephones' : 'accessoires'}/${g.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-sm px-3 text-[14px] text-ink-2 hover:bg-paper-2">
                Voir sur le site <ExternalLink className="size-3.5" />
              </a>
            )}
            {can('catalog.write') &&
              (g.status === 'ACTIVE' ? (
                <Button variant="secondary" onClick={() => setConfirm('archive')}>
                  <Archive className="size-4" /> Archiver
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => act('restore')} loading={busy}>
                  <ArchiveRestore className="size-4" /> Réactiver
                </Button>
              ))}
            {can('catalog.write') && (
              <Button variant="ghost" onClick={() => setConfirm('delete')}>
                <Trash2 className="size-4" /> Supprimer
              </Button>
            )}
          </div>
        }
      />
      <div className="max-w-4xl space-y-6">
        <Panel title="Photos">
          <GroupImages groupId={g.id} images={g.images} colors={[...new Set(g.variants.map((v) => v.color).filter((c): c is string => Boolean(c)))]} onChange={group.reload} />
        </Panel>
        {can('catalog.write') ? (
          <GroupForm key={g.updatedAt} kind={g.kind} group={g} brands={brands.data} categories={categories.data.filter((c) => c.active || c.id === g.category.id)} onSaved={group.setData} />
        ) : (
          <p className="text-[14px] text-muted">Consultation seule : la modification des produits est réservée au Responsable.</p>
        )}
      </div>
      <ConfirmDialog
        open={confirm === 'archive'}
        onClose={() => setConfirm(null)}
        onConfirm={() => act('archive')}
        title="Archiver ce produit ?"
        confirmLabel="Archiver"
        loading={busy}
      >
        Il disparaît du site et des recherches. Son historique (ventes, stock) est conservé et il peut être réactivé.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => act('delete')}
        title="Supprimer définitivement ?"
        danger
        confirmLabel="Supprimer"
        loading={busy}
      >
        Possible uniquement si le produit n’a jamais été vendu ni approvisionné. Sinon, archivez-le pour conserver son historique.
      </ConfirmDialog>
    </>
  );
}
