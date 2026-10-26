import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function paginate<T>(items: T[], total: number, q: PageQuery): Paginated<T> {
  return { items, total, page: q.page, pageSize: q.pageSize, pageCount: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export function skipTake(q: PageQuery) {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

/** Restreint le tri aux colonnes autorisées. */
export function orderByFrom<T extends string>(q: PageQuery, allowed: readonly T[], fallback: T, fallbackDir: 'asc' | 'desc' = 'desc') {
  const field = (allowed as readonly string[]).includes(q.sort ?? '') ? (q.sort as T) : fallback;
  return { [field]: q.dir ?? fallbackDir } as Record<T, 'asc' | 'desc'>;
}
