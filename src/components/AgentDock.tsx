import { useState } from 'react';
import { Bot, X } from 'lucide-react';
import { AgentChatPanel } from './panels/AgentChatPanel';

/**
 * Dock global flotante del asistente conversacional.
 * Botón FAB abajo a la derecha; al click abre un drawer con el AgentChatPanel.
 * El chat reusa el mismo FSM que el bot de WhatsApp (ver backend/agent_web.py).
 */
export function AgentDock() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 bg-brand hover:bg-brand/90 text-white rounded-full w-12 h-12 shadow-lg flex items-center justify-center"
          title="Abrir asistente"
        >
          <Bot size={20} />
        </button>
      )}
      {open && (
        <div className="fixed bottom-4 right-4 z-40 w-[420px] h-[600px] max-h-[80vh] bg-bg-900 border border-line rounded-lg shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-bg-800">
            <div className="flex items-center gap-2 text-[12px] font-semibold">
              <Bot size={14} className="text-brand" />
              Asistente
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-text-muted hover:text-text-primary"
              title="Cerrar"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <AgentChatPanel />
          </div>
        </div>
      )}
    </>
  );
}
