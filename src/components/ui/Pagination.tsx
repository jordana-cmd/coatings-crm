import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZES = [25, 50, 75, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

interface Props {
  page: number;
  pageSize: PageSize;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

export default function Pagination({ page, pageSize, totalCount, onPageChange, onPageSizeChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalCount);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3">
      <p className="text-[10px] text-subtle order-2 sm:order-1">
        {totalCount > 0 ? `${from}–${to} of ${totalCount}` : "No results"}
      </p>

      <div className="flex items-center gap-3 order-1 sm:order-2">
        {/* Page size selector */}
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
          className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-heading bg-card focus:outline-none focus:ring-1 focus:ring-brand"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s} / page</option>
          ))}
        </select>

        {/* Prev / Next */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="p-1.5 rounded-md border border-gray-200 text-heading disabled:opacity-30 disabled:cursor-not-allowed active:bg-gray-50"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[11px] text-label px-2 min-w-[3rem] text-center">
            {totalPages > 0 ? `${page + 1} / ${totalPages}` : "—"}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
            className="p-1.5 rounded-md border border-gray-200 text-heading disabled:opacity-30 disabled:cursor-not-allowed active:bg-gray-50"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
