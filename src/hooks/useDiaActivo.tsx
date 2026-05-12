import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'fpoc.diaActivo';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readInitial(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  } catch { /* ignore */ }
  return todayISO();
}

interface Ctx {
  fecha: string;
  setFecha: (f: string) => void;
}

const DiaActivoContext = createContext<Ctx | null>(null);

export function DiaActivoProvider({ children }: { children: ReactNode }) {
  const [fecha, setFechaState] = useState<string>(readInitial);

  const setFecha = useCallback((f: string) => {
    setFechaState(f);
    try { localStorage.setItem(STORAGE_KEY, f); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    // Si otro tab/ventana cambia la fecha, lo reflejamos acá.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && /^\d{4}-\d{2}-\d{2}$/.test(e.newValue)) {
        setFechaState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <DiaActivoContext.Provider value={{ fecha, setFecha }}>
      {children}
    </DiaActivoContext.Provider>
  );
}

export function useDiaActivo(): Ctx {
  const ctx = useContext(DiaActivoContext);
  if (!ctx) {
    // Fallback: si no hay provider (tests, etc) devuelve estado local
    return { fecha: todayISO(), setFecha: () => { /* noop */ } };
  }
  return ctx;
}
