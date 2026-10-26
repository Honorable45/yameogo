import type { AdminProduct } from '@/lib/admin-types';
import { Status } from '@/components/ui/status';

export function StockStatus({ p }: { p: Pick<AdminProduct, 'availability' | 'available' | 'reservedQuantity'> }) {
  const tone = p.availability === 'OUT_OF_STOCK' ? 'bad' : p.availability === 'LOW_STOCK' ? 'warn' : 'ok';
  return (
    <Status tone={tone}>
      <span className="num">{p.available}</span>
      {p.reservedQuantity > 0 && <span className="text-muted">(+{p.reservedQuantity} réservé{p.reservedQuantity > 1 ? 's' : ''})</span>}
    </Status>
  );
}
