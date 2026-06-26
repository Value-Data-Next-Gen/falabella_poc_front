import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet, Upload, Download, CheckCircle, XCircle, X } from 'lucide-react'
import { Badge } from './Badge'

interface RowResult {
  fila: number
  estado: string
  detalle?: string | null
}

interface ImportResult {
  creados: number
  fallidos: number
  filas: RowResult[]
}

interface BulkUploadProps {
  entity: string
  uploadFn: (file: File) => Promise<ImportResult>
  invalidateKeys: string[][]
  templateUrl: string
}

export function BulkUpload({ entity, uploadFn, invalidateKeys, templateUrl }: BulkUploadProps) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [results, setResults] = useState<ImportResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const mutation = useMutation({
    mutationFn: uploadFn,
    onSuccess: (data) => {
      setResults(data)
      for (const key of invalidateKeys) void qc.invalidateQueries({ queryKey: key })
    },
  })

  function reset() {
    setFile(null)
    setResults(null)
    setOpen(false)
    mutation.reset()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-[11px] font-semibold text-text-primary uppercase tracking-wider hover:bg-bg-700 transition-colors"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" /> Cargar Excel
      </button>
    )
  }

  return (
    <div className="bg-bg-800 rounded-md border border-line p-4 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-text-primary uppercase tracking-wider">
          Carga masiva — {entity}
        </span>
        <button onClick={reset} className="p-1 hover:bg-bg-700 rounded"><X className="w-3.5 h-3.5 text-text-muted" /></button>
      </div>

      {/* Template download */}
      <a
        href={templateUrl}
        download
        className="inline-flex items-center gap-1.5 text-[11px] text-brand-500 hover:text-brand-600 uppercase tracking-wider font-semibold mb-3"
      >
        <Download className="w-3.5 h-3.5" /> Descargar plantilla
      </a>

      {!results && (
        <>
          {/* File picker */}
          <div
            onClick={() => inputRef.current?.click()}
            className="border border-dashed border-line rounded p-4 text-center cursor-pointer hover:border-brand-300 transition-colors mb-3"
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setResults(null) } }} className="hidden" />
            {file ? (
              <span className="flex items-center justify-center gap-2 text-[12px] text-text-primary">
                <FileSpreadsheet className="w-4 h-4 text-brand-500" />
                {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2 text-[12px] text-text-muted">
                <Upload className="w-4 h-4" /> Seleccionar archivo .xlsx
              </span>
            )}
          </div>

          {file && (
            <button
              onClick={() => mutation.mutate(file)}
              disabled={mutation.isPending}
              className="bg-brand-500 text-white rounded px-4 py-2 text-[11px] font-semibold uppercase tracking-wider hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? 'Procesando...' : 'Importar'}
            </button>
          )}
        </>
      )}

      {mutation.error && (
        <div className="mt-3 bg-accent-red/10 border border-accent-red/30 rounded p-2 text-[11px] text-accent-red">
          Error al importar
        </div>
      )}

      {results && (
        <div className="mt-2">
          <div className="flex gap-3 mb-3">
            <span className="text-[12px] text-accent-green font-semibold">{results.creados} creados</span>
            {results.fallidos > 0 && <span className="text-[12px] text-accent-red font-semibold">{results.fallidos} fallidos</span>}
          </div>
          <div className="overflow-x-auto rounded border border-line/50 max-h-48 overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="border-b border-line bg-bg-700/50">
                <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Fila</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Estado</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider">Detalle</th>
              </tr></thead>
              <tbody className="divide-y divide-line/30">
                {results.filas.map((r) => (
                  <tr key={r.fila}>
                    <td className="px-3 py-1.5">{r.fila}</td>
                    <td className="px-3 py-1.5">
                      {r.estado === 'creado' ? (
                        <span className="inline-flex items-center gap-1"><CheckCircle className="w-3 h-3 text-accent-green" /><Badge variant="green">OK</Badge></span>
                      ) : (
                        <span className="inline-flex items-center gap-1"><XCircle className="w-3 h-3 text-accent-red" /><Badge variant="red">Error</Badge></span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-text-secondary">{r.detalle ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={reset} className="mt-3 rounded border border-line px-3 py-1.5 text-[11px] font-semibold text-text-primary uppercase tracking-wider hover:bg-bg-700 transition-colors">
            Cerrar
          </button>
        </div>
      )}
    </div>
  )
}
