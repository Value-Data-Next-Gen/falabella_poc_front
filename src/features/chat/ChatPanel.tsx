import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { chat } from '@/api/sdk.gen'
import { MessageCircle, Send, X, Bot, User, Wrench, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'

interface Message {
  role: 'user' | 'assistant'
  content: string
  tools?: string[]
}

const WELCOME: Message = { role: 'assistant', content: 'Hola, soy el asistente IA de Torre de Control. Puedo ayudarte con:\n\n- Consultar estado de conductores, vehiculos y empresas\n- Verificar documentos pendientes o vencidos\n- Clasificar motivos de no-entrega (14 motivos oficiales Falabella)\n- Generar resumenes operativos\n\n¿En que te puedo ayudar?' }
const STORAGE_KEY = 'td-chat-history'

function loadMessages(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Message[]
      return parsed.length > 0 ? parsed : [WELCOME]
    }
  } catch { /* ignore */ }
  return [WELCOME]
}

export function ChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(loadMessages)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  }, [messages])

  const mutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const allMessages = [...messages, { role: 'user' as const, content: userMessage }]
      const res = await chat({
        body: {
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
        },
      })
      return res.data as { reply: string; tool_calls_made: string[] } | undefined
    },
    onSuccess: (data) => {
      if (data) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, tools: data.tool_calls_made }])
      }
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error al procesar tu mensaje. Verifica que Azure OpenAI este configurado.' }])
    },
  })

  function handleSend() {
    if (!input.trim() || mutation.isPending) return
    const msg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    mutation.mutate(msg)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600 transition-colors flex items-center justify-center z-40"
        title="Asistente IA"
      >
        <MessageCircle className="w-5 h-5" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-bg-800 border border-line rounded-lg shadow-2xl flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">Asistente IA</span>
            <div className="text-[9px] text-text-muted">gpt-4o-mini · Torre de Control</div>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => { setMessages([WELCOME]); localStorage.removeItem(STORAGE_KEY) }} className="p-1 hover:bg-bg-700 rounded" title="Limpiar chat"><Trash2 className="w-3.5 h-3.5 text-text-muted" /></button>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-bg-700 rounded"><X className="w-4 h-4 text-text-muted" /></button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={clsx('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-brand-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-brand-500" />
              </div>
            )}
            <div className={clsx(
              'max-w-[80%] rounded-lg px-3 py-2 text-[12px]',
              m.role === 'user'
                ? 'bg-brand-500 text-white'
                : 'bg-bg-700 text-text-primary',
            )}>
              <pre className="whitespace-pre-wrap font-[inherit] m-0">{m.content}</pre>
              {m.tools && m.tools.length > 0 && (
                <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-white/10">
                  <Wrench className="w-3 h-3 text-text-muted" />
                  <span className="text-[9px] text-text-muted">{m.tools.join(', ')}</span>
                </div>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-bg-700 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-text-muted" />
              </div>
            )}
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-500/15 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-brand-500 animate-pulse" />
            </div>
            <div className="bg-bg-700 rounded-lg px-3 py-2 text-[12px] text-text-muted">
              Pensando...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-line p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Pregunta algo..."
            className="flex-1 rounded border border-line bg-bg-700 px-3 py-2 text-[12px] text-text-primary focus:outline-none focus:border-brand-500"
            disabled={mutation.isPending}
          />
          <button
            onClick={handleSend}
            disabled={mutation.isPending || !input.trim()}
            className="rounded bg-brand-500 px-3 py-2 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
