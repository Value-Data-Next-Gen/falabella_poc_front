import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle, CheckCircle2, Copy, Loader2, MessageCircle, Phone, Send,
} from 'lucide-react';
import { api } from '../../api';
import { Modal } from './Modal';

interface Props {
  /** Datos del recién creado para guiarlo. */
  phone: string;
  name: string;
  roleHint?: 'driver' | 'manager' | 'contacto';
  driverId?: string;
  userId?: number;
  contactId?: number;
  onClose: () => void;
}

type Step = 1 | 2 | 3;

/** Flow guiado post-creación: muestra el join del sandbox y permite mandar
 *  un mensaje de prueba para verificar end-to-end. */
export function OnboardWhatsAppModal({
  phone, name, roleHint, driverId, userId, contactId, onClose,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [testResult, setTestResult] = useState<Awaited<ReturnType<typeof api.admin.whatsappInvite>> | null>(null);
  const [testErr, setTestErr] = useState<string | null>(null);

  const sandboxQ = useQuery({
    queryKey: ['whatsapp-sandbox-info'],
    queryFn: api.admin.whatsappSandboxInfo,
    staleTime: 5 * 60_000,
  });

  const testMut = useMutation({
    mutationFn: () => api.admin.whatsappInvite({
      phone_e164: phone, name, role_hint: roleHint,
      driver_id: driverId, user_id: userId, contact_id: contactId,
    }),
    onSuccess: r => { setTestResult(r); setTestErr(null); setStep(3); },
    onError: (e: Error) => { setTestErr(e?.message ?? 'error'); setStep(3); },
  });

  const joinCode = sandboxQ.data?.join_code ?? '<código>';
  const sandboxNumber = sandboxQ.data?.sandbox_number ?? '+14155238886';
  const joinText = `join ${joinCode}`;

  return (
    <Modal title="Activar WhatsApp" onClose={onClose} width="lg">
      <div className="flex flex-col gap-4 text-[12px]">
        {/* Header con el dato confirmado */}
        <div className="panel bg-bg-700/40 p-3 flex items-start gap-3">
          <div className="rounded-full bg-accent-green/15 p-2"><CheckCircle2 size={14} className="text-accent-green" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold">{name} creado/a correctamente</div>
            <div className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5">
              <Phone size={10} /> <span className="font-mono">{phone}</span>
              {roleHint && <span className="ml-2 pill bg-bg-700 text-text-secondary border border-line">{roleHint}</span>}
            </div>
          </div>
        </div>

        <Stepper step={step} />

        {/* Step 1 — instrucciones de join */}
        {step === 1 && (
          <div className="flex flex-col gap-3">
            <div className="text-[13px] font-semibold">1. {name} debe unirse al sandbox de Twilio</div>
            <ol className="list-decimal list-inside text-[11px] space-y-1 text-text-secondary">
              <li>Abrir WhatsApp en el celular de <strong>{name}</strong>.</li>
              <li>Crear un chat nuevo al número <Copyable text={sandboxNumber} mono />.</li>
              <li>Enviar como primer mensaje el texto: <Copyable text={joinText} mono /></li>
              <li>Twilio responde "You are all set!" → el número quedó habilitado.</li>
              <li>Cualquier mensaje que envíe después (ej. "hola") lo identificará por su <span className="font-mono">{phone}</span>.</li>
            </ol>
            {!sandboxQ.data?.join_code && (
              <div className="text-[10px] text-accent-yellow italic flex items-center gap-1">
                <AlertCircle size={11} />
                No tengo el join code en .env (<span className="font-mono">TWILIO_SANDBOX_JOIN_CODE</span>).
                Bajalo de Twilio Console → Messaging → Try it out → Sandbox.
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={onClose} className="btn text-[11px]">Saltar test</button>
              <button onClick={() => setStep(2)} className="btn-primary text-[11px]">
                Ya hizo el join →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — mandar test */}
        {step === 2 && (
          <div className="flex flex-col gap-3">
            <div className="text-[13px] font-semibold">2. Probar que el bot le responde</div>
            <div className="text-[11px] text-text-muted">
              Voy a enviar un mensaje de prueba al <span className="font-mono">{phone}</span> usando la
              plantilla de invitación. {name} debería recibirlo en su WhatsApp.
            </div>
            <div className="flex items-center justify-between pt-2">
              <button onClick={() => setStep(1)} className="text-[11px] text-text-muted hover:text-text-primary">
                ← volver
              </button>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="btn text-[11px]">Cerrar sin probar</button>
                <button onClick={() => testMut.mutate()}
                        disabled={testMut.isPending}
                        className="btn-primary text-[11px] flex items-center gap-1">
                  {testMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                  Enviar mensaje de prueba
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — resultado */}
        {step === 3 && (
          <div className="flex flex-col gap-3">
            <div className="text-[13px] font-semibold">3. Resultado del envío</div>
            {testErr && (
              <div className="text-accent-red text-[11px] flex items-center gap-1">
                <AlertCircle size={11} /> {testErr}
              </div>
            )}
            {testResult && (
              <div className="flex flex-col gap-2">
                {testResult.ok ? (
                  <div className="panel bg-accent-green/10 border-accent-green/30 p-3 flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-accent-green mt-0.5" />
                    <div className="flex-1 text-[11px]">
                      <div className="text-accent-green font-semibold">Twilio aceptó el envío</div>
                      <div className="text-text-muted mt-1">
                        Estado: <strong>{testResult.status}</strong>
                        {testResult.twilio_sid && (
                          <> · SID <span className="font-mono">{testResult.twilio_sid.slice(0, 18)}…</span></>
                        )}
                      </div>
                      <div className="text-text-muted mt-1">
                        Confirmá con {name} que el mensaje le llegó en su WhatsApp.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="panel bg-accent-red/10 border-accent-red/30 p-3 flex items-start gap-2">
                    <AlertCircle size={14} className="text-accent-red mt-0.5" />
                    <div className="flex-1 text-[11px]">
                      <div className="text-accent-red font-semibold">No se pudo enviar</div>
                      <div className="text-text-muted mt-1">
                        {testResult.error ?? testResult.status}
                      </div>
                    </div>
                  </div>
                )}
                {testResult.sandbox_warning && (
                  <div className="text-[10px] text-accent-yellow italic flex items-center gap-1">
                    <AlertCircle size={11} /> {testResult.sandbox_warning}
                  </div>
                )}
                {testResult.body_preview && (
                  <div className="text-[10px] text-text-muted">
                    <span className="uppercase tracking-wider">Vista previa del mensaje enviado:</span>
                    <div className="font-mono bg-bg-700/40 p-2 rounded mt-1 whitespace-pre-wrap">
                      {testResult.body_preview}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between pt-2">
              <button onClick={() => { setStep(2); setTestResult(null); setTestErr(null); }}
                      className="text-[11px] text-text-muted hover:text-text-primary">
                ← reintentar
              </button>
              <button onClick={onClose} className="btn-primary text-[11px]">
                Listo
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      {([1, 2, 3] as Step[]).map((n, i) => (
        <div key={n} className="flex items-center gap-1">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center font-mono ${
            n === step ? 'bg-brand text-white' :
            n < step ? 'bg-accent-green/30 text-accent-green' :
            'bg-bg-700 text-text-muted'
          }`}>{n}</div>
          <span className={n === step ? 'text-text-primary' : 'text-text-muted'}>
            {n === 1 ? 'Join sandbox' : n === 2 ? 'Test' : 'Resultado'}
          </span>
          {i < 2 && <div className="w-6 h-px bg-line ml-1" />}
        </div>
      ))}
    </div>
  );
}

function Copyable({ text, mono }: { text: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 bg-bg-700/60 border border-line rounded ${mono ? 'font-mono' : ''}`}>
      <span>{text}</span>
      <button onClick={copy} className="text-text-muted hover:text-brand" title="Copiar">
        {copied ? <CheckCircle2 size={10} className="text-accent-green" /> : <Copy size={10} />}
      </button>
    </span>
  );
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const _unused = MessageCircle;
