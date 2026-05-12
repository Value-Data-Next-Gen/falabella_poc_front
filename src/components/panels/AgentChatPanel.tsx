import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, RefreshCw, Send, Sparkles, User as UserIcon } from 'lucide-react';
import { api } from '../../api';

interface Msg {
  who: 'user' | 'agent';
  text: string;
  ts: number;
}

const QUICK: { label: string; text: string }[] = [
  { label: 'Help',                    text: 'help' },
  { label: 'KPIs hoy',                text: 'kpis' },
  { label: 'Info',                    text: 'info' },
  { label: 'Soy driver',              text: 'driver' },
  { label: 'Buscar folio',            text: 'folio 14246780' },
  { label: 'Resumen ruta',            text: 'ruta R-20260419-001' },
];

export function AgentChatPanel() {
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    {
      who: 'agent',
      text: 'Hola, soy el asistente. Escribí "help" para ver comandos o probá los atajos de arriba.',
      ts: Date.now(),
    },
  ]);
  const endRef = useRef<HTMLDivElement | null>(null);

  const stateQ = useQuery({
    queryKey: ['agent-web-state'],
    queryFn: api.agent.state,
    refetchInterval: 10_000,
  });

  const sendMut = useMutation({
    mutationFn: (text: string) => api.agent.send(text),
    onSuccess: (resp, vars) => {
      setMsgs(m => [
        ...m,
        { who: 'user', text: vars, ts: Date.now() },
        { who: 'agent', text: resp.reply || '(sin respuesta)', ts: Date.now() },
      ]);
      setInput('');
      stateQ.refetch();
    },
    onError: (err: any, vars) => {
      setMsgs(m => [
        ...m,
        { who: 'user', text: vars, ts: Date.now() },
        { who: 'agent', text: `Error: ${err?.message || 'sin detalle'}`, ts: Date.now() },
      ]);
    },
  });

  const resetMut = useMutation({
    mutationFn: () => api.agent.reset(),
    onSuccess: () => {
      setMsgs([{
        who: 'agent',
        text: 'Sesión reiniciada. ¿En qué te puedo ayudar?',
        ts: Date.now(),
      }]);
      stateQ.refetch();
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  function send(text?: string) {
    const t = (text ?? input).trim();
    if (!t || sendMut.isPending) return;
    sendMut.mutate(t);
  }

  return (
    <div className="h-full flex flex-col p-3 gap-2">
      <div className="panel-title flex items-center gap-2">
        <Bot size={14} className="text-brand" />
        <span>Asistente conversacional</span>
        <span className="text-text-muted normal-case tracking-normal text-[10px]">
          mismo FSM que el bot de WhatsApp
        </span>
        <span className="ml-auto flex items-center gap-2 text-[10px] text-text-muted normal-case tracking-normal">
          <span>estado: <span className="text-text-secondary">{stateQ.data?.state ?? '…'}</span></span>
          {stateQ.data?.role && (
            <span>· rol: <span className="text-text-secondary">{stateQ.data.role}</span></span>
          )}
          <button
            onClick={() => resetMut.mutate()}
            disabled={resetMut.isPending}
            className="btn !py-0.5 !px-1.5 text-[10px] flex items-center gap-1"
            title="Reiniciar sesión del agente"
          >
            <RefreshCw size={9} className={resetMut.isPending ? 'animate-spin' : ''} />
            reset
          </button>
        </span>
      </div>

      <div className="panel flex-1 flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-line flex flex-wrap gap-1 text-[10px]">
          <span className="text-text-muted uppercase tracking-wider mr-2 self-center">Atajos</span>
          {QUICK.map(q => (
            <button
              key={q.label}
              onClick={() => send(q.text)}
              disabled={sendMut.isPending}
              className="btn !py-0.5 !px-1.5 text-[10px]"
              title={q.text}
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto px-3 py-3 space-y-2 text-[12px]">
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.who === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.who === 'agent' && (
                <div className="shrink-0 mt-0.5 text-brand"><Bot size={14} /></div>
              )}
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-md px-3 py-1.5 border ${
                  m.who === 'user'
                    ? 'bg-brand/10 border-brand/30 text-text-primary'
                    : 'bg-bg-700/40 border-line text-text-secondary'
                }`}
              >
                {m.text}
              </div>
              {m.who === 'user' && (
                <div className="shrink-0 mt-0.5 text-text-muted"><UserIcon size={14} /></div>
              )}
            </div>
          ))}
          {sendMut.isPending && (
            <div className="flex gap-2 items-center text-text-muted text-[11px]">
              <Sparkles size={12} className="text-brand animate-pulse" />
              pensando…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-line px-3 py-2 flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(); }}
            placeholder='Escribí un comando o consulta… (ej. "status FAL-1234", "ruta R-...", "help")'
            className="input flex-1 text-[12px] !py-1.5"
            disabled={sendMut.isPending}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || sendMut.isPending}
            className="btn !py-1.5 !px-3 flex items-center gap-1"
          >
            <Send size={12} /> Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
