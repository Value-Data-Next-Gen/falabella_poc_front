import type { ReactNode } from 'react'

interface Column<T> {
  header: string
  accessor: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyFn: (row: T) => string | number
  emptyMessage?: string
  /** Optional per-row className for visual emphasis (e.g. VIP rows). */
  rowClassName?: (row: T) => string | undefined
}

export function DataTable<T>({ columns, data, keyFn, emptyMessage = 'Sin datos', rowClassName }: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-text-muted text-xs uppercase tracking-wider">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-bg-800 shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-line">
            {columns.map((col, i) => (
              <th
                key={i}
                className={`px-4 py-2.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/50">
          {data.map((row) => {
            const extra = rowClassName?.(row) ?? ''
            return (
              <tr
                key={keyFn(row)}
                className={`hover:bg-bg-700/50 transition-colors ${extra}`}
              >
                {columns.map((col, i) => (
                  <td key={i} className={`px-4 py-2.5 text-[13px] ${col.className ?? ''}`}>
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
