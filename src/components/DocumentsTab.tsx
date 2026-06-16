import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listDocumentTypes, listEntityDocuments, uploadDocument, deleteDocument, getDocumentCompliance } from '@/api/sdk.gen'
import type { EntityDocumentOut, ComplianceItem as ComplianceItemType } from '@/api'
import { Badge } from './Badge'
import { ConfirmDialog } from './ConfirmDialog'
import { Upload, Download, Trash2, FileText, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; variant: 'green' | 'red' | 'yellow' | 'gray'; icon: typeof CheckCircle }> = {
  ok: { label: 'OK', variant: 'green', icon: CheckCircle },
  falta: { label: 'Falta', variant: 'red', icon: XCircle },
  vencido: { label: 'Vencido', variant: 'red', icon: AlertTriangle },
  por_vencer: { label: 'Por vencer', variant: 'yellow', icon: Clock },
  opcional: { label: 'Opcional', variant: 'gray', icon: FileText },
}

interface Props {
  entityType: string
  entityId: string
}

export function DocumentsTab({ entityType, entityId }: Props) {
  const qc = useQueryClient()
  const [delDoc, setDelDoc] = useState<EntityDocumentOut | null>(null)
  const [uploadTipo, setUploadTipo] = useState('')
  const [uploadExpires, setUploadExpires] = useState('')
  const [uploadNotes, setUploadNotes] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const types = useQuery({
    queryKey: ['doc-types', entityType],
    queryFn: () => listDocumentTypes({ query: { entity_type: entityType } }),
  })
  const docs = useQuery({
    queryKey: ['docs', entityType, entityId],
    queryFn: () => listEntityDocuments({ path: { entity_type: entityType, entity_id: entityId } }),
  })
  const compliance = useQuery({
    queryKey: ['compliance', entityType, entityId],
    queryFn: () => getDocumentCompliance({ path: { entity_type: entityType, entity_id: entityId } }),
  })

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const params: Record<string, string> = { tipo: uploadTipo }
      if (uploadExpires) params.expires_at = uploadExpires
      if (uploadNotes) params.notes = uploadNotes
      return uploadDocument({ path: { entity_type: entityType, entity_id: entityId }, query: params as never, body: { file } })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['docs', entityType, entityId] })
      void qc.invalidateQueries({ queryKey: ['compliance', entityType, entityId] })
      setUploadTipo('')
      setUploadExpires('')
      setUploadNotes('')
    },
  })

  const delMut = useMutation({
    mutationFn: (docId: number) => deleteDocument({ path: { entity_type: entityType, entity_id: entityId, doc_id: docId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['docs', entityType, entityId] })
      void qc.invalidateQueries({ queryKey: ['compliance', entityType, entityId] })
      setDelDoc(null)
    },
  })

  const docTypes = (types.data?.data ?? []) as { codigo: string; nombre: string }[]
  const docList = (docs.data?.data ?? []) as EntityDocumentOut[]
  const comp = compliance.data?.data as { items: ComplianceItemType[]; total_mandatory: number; compliant: number; missing: number; expired: number } | undefined

  function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file || !uploadTipo) return
    uploadMut.mutate(file)
  }

  return (
    <div className="space-y-6">
      {/* Compliance summary */}
      {comp && (
        <div className="flex gap-3">
          <div className="bg-bg-800 rounded-md border border-line p-3 flex-1 text-center">
            <div className="text-[10px] text-text-muted uppercase tracking-wider">Obligatorios</div>
            <div className="text-xl font-semibold">{comp.total_mandatory}</div>
          </div>
          <div className="bg-bg-800 rounded-md border border-line p-3 flex-1 text-center">
            <div className="text-[10px] text-text-muted uppercase tracking-wider">Completos</div>
            <div className="text-xl font-semibold text-accent-green">{comp.compliant}</div>
          </div>
          <div className="bg-bg-800 rounded-md border border-line p-3 flex-1 text-center">
            <div className="text-[10px] text-text-muted uppercase tracking-wider">Faltan</div>
            <div className="text-xl font-semibold text-accent-red">{comp.missing}</div>
          </div>
          <div className="bg-bg-800 rounded-md border border-line p-3 flex-1 text-center">
            <div className="text-[10px] text-text-muted uppercase tracking-wider">Vencidos</div>
            <div className="text-xl font-semibold text-accent-yellow">{comp.expired}</div>
          </div>
        </div>
      )}

      {/* Compliance checklist */}
      {comp && (
        <div className="overflow-x-auto rounded-md border border-line bg-bg-800 shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Documento</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider w-24">Obligatorio</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider w-24">Validez</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider w-28">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {comp.items.map((item: ComplianceItemType) => {
                const st = STATUS_MAP[item.status] ?? STATUS_MAP.falta!
                const Icon = st.icon
                return (
                  <tr key={item.doc_type.codigo} className="hover:bg-bg-700/50">
                    <td className="px-4 py-2.5 text-[13px]">
                      <span className="font-medium">{item.doc_type.nombre}</span>
                      <span className="text-text-muted ml-2 text-[11px]">({item.doc_type.codigo})</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px]">{item.doc_type.mandatory ? 'Si' : 'No'}</td>
                    <td className="px-4 py-2.5 text-[12px] text-text-secondary">{item.doc_type.validez_meses ? `${item.doc_type.validez_meses} meses` : 'Sin vencimiento'}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1">
                        <Icon className="w-3.5 h-3.5" />
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload form */}
      <div className="bg-bg-800 rounded-md border border-line p-4 shadow-sm">
        <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider mb-3">Subir documento</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Tipo</label>
            <select value={uploadTipo} onChange={(e) => setUploadTipo(e.target.value)} className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500">
              <option value="">Seleccionar...</option>
              {docTypes.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Vencimiento</label>
            <input type="date" value={uploadExpires} onChange={(e) => setUploadExpires(e.target.value)} className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500" />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Notas (opcional)</label>
          <input value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} maxLength={500} className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500" />
        </div>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" className="text-[12px] text-text-primary file:mr-2 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-brand-600 file:uppercase file:tracking-wider hover:file:bg-brand-100" />
          <button onClick={handleUpload} disabled={!uploadTipo || uploadMut.isPending} className="bg-brand-500 text-white rounded px-4 py-2 text-[11px] font-semibold uppercase tracking-wider hover:bg-brand-600 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> {uploadMut.isPending ? 'Subiendo...' : 'Subir'}
          </button>
        </div>
        {uploadMut.error && <p className="text-[11px] text-accent-red mt-2">Error al subir archivo</p>}
      </div>

      {/* File list */}
      {docList.length > 0 && (
        <div>
          <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider mb-3">Archivos ({docList.length})</h3>
          <div className="overflow-x-auto rounded-md border border-line bg-bg-800 shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Archivo</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Tamano</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Subido</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Vence</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {docList.map((d) => (
                  <tr key={d.doc_id} className="hover:bg-bg-700/50">
                    <td className="px-4 py-2.5 text-[13px]"><Badge variant="blue">{d.tipo}</Badge></td>
                    <td className="px-4 py-2.5 text-[13px] font-medium">{d.filename}</td>
                    <td className="px-4 py-2.5 text-[12px] text-text-secondary">{(d.file_size / 1024).toFixed(0)} KB</td>
                    <td className="px-4 py-2.5 text-[12px] text-text-secondary">{new Date(d.uploaded_at).toLocaleDateString('es-CL')}</td>
                    <td className="px-4 py-2.5 text-[12px]">{d.expires_at ? new Date(d.expires_at).toLocaleDateString('es-CL') : '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 justify-end">
                        <a href={`/api/v1/documents/${entityType}/${entityId}/${d.doc_id}/download`} className="p-1.5 hover:bg-bg-700 rounded transition-colors" title="Descargar">
                          <Download className="w-3.5 h-3.5 text-text-muted" />
                        </a>
                        <button onClick={() => setDelDoc(d)} className="p-1.5 hover:bg-accent-red/10 rounded transition-colors" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5 text-accent-red" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!delDoc} onClose={() => setDelDoc(null)} onConfirm={() => delDoc && delMut.mutate(delDoc.doc_id)} title="Eliminar documento" message={`Se eliminara "${delDoc?.filename}" permanentemente.`} loading={delMut.isPending} />
    </div>
  )
}
