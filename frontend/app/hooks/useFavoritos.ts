"use client";

import { useSyncExternalStore, useCallback, useMemo, useTransition } from "react";

export interface ReglaFavorita {
  key: string;             // Llave compuesta: `${regla_id}::${tecnica_id}`
  regla_id: number;
  regla_nombre: string;
  regla_formato: string;
  url_fuente: string | null;
  tecnica_id: string;      // ej. "T1071.004"
  tecnica_nombre: string;  // ej. "Application Layer Protocol: DNS"
  dominio_codigo: string;  // ej. "DNS"
  dominio_nombre: string;  // ej. "Domain Name System (DNS)"
  agregado_en: string;     // ISO 8601 string
}

export type InputNuevoFavorito = Omit<ReglaFavorita, "key" | "agregado_en">;

const STORAGE_KEY = "umbra_radar_repertorio";
const SYNC_EVENT = "umbra:repertorio-updated";

export function generarLlaveFavorito(reglaId: number, tecnicaId: string): string {
  return `${reglaId}::${tecnicaId.trim()}`;
}

// Fallback en memoria si localStorage está deshabilitado
let memoriaFallback: ReglaFavorita[] = [];

// Cache referencial para useSyncExternalStore
let cacheRaw: string | null = null;
let cacheParsed: ReglaFavorita[] = [];

function getSnapshot(): ReglaFavorita[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cacheRaw) {
      return cacheParsed;
    }
    cacheRaw = raw;
    cacheParsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(cacheParsed) ? cacheParsed : [];
  } catch (error) {
    console.warn("[Umbra Repertorio] Error al leer localStorage:", error);
    return memoriaFallback;
  }
}

const SERVER_SNAPSHOT: ReglaFavorita[] = [];
function getServerSnapshot(): ReglaFavorita[] {
  return SERVER_SNAPSHOT;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SYNC_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SYNC_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function notificarActualizacion() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  }
}

function escribirAlmacenamiento(items: ReglaFavorita[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = JSON.stringify(items);
    window.localStorage.setItem(STORAGE_KEY, raw);
    cacheRaw = raw;
    cacheParsed = items;
    memoriaFallback = items;
    notificarActualizacion();
    return true;
  } catch (error) {
    console.warn("[Umbra Repertorio] Fallo al escribir en localStorage (quota o restricción):", error);
    memoriaFallback = items;
    cacheParsed = items;
    notificarActualizacion();
    return false;
  }
}

export function useFavoritos() {
  const favoritos = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [, startTransition] = useTransition();

  // Índice O(1) de llaves activas
  const setLlaves = useMemo(() => {
    return new Set(favoritos.map((f) => f.key));
  }, [favoritos]);

  const esFavorito = useCallback(
    (reglaId: number, tecnicaId: string): boolean => {
      const k = generarLlaveFavorito(reglaId, tecnicaId);
      return setLlaves.has(k);
    },
    [setLlaves]
  );

  const agregarFavorito = useCallback((input: InputNuevoFavorito) => {
    startTransition(() => {
      const actuales = getSnapshot();
      const key = generarLlaveFavorito(input.regla_id, input.tecnica_id);
      if (actuales.some((f) => f.key === key)) return;
      const nuevo: ReglaFavorita = {
        ...input,
        key,
        agregado_en: new Date().toISOString(),
      };
      escribirAlmacenamiento([nuevo, ...actuales]);
    });
  }, []);

  const quitarFavorito = useCallback((reglaId: number, tecnicaId: string) => {
    startTransition(() => {
      const actuales = getSnapshot();
      const key = generarLlaveFavorito(reglaId, tecnicaId);
      const actualizados = actuales.filter((f) => f.key !== key);
      escribirAlmacenamiento(actualizados);
    });
  }, []);

  const toggleFavorito = useCallback((input: InputNuevoFavorito) => {
    startTransition(() => {
      const actuales = getSnapshot();
      const key = generarLlaveFavorito(input.regla_id, input.tecnica_id);
      const existe = actuales.some((f) => f.key === key);
      if (existe) {
        escribirAlmacenamiento(actuales.filter((f) => f.key !== key));
      } else {
        const nuevo: ReglaFavorita = {
          ...input,
          key,
          agregado_en: new Date().toISOString(),
        };
        escribirAlmacenamiento([nuevo, ...actuales]);
      }
    });
  }, []);

  const limpiarTodos = useCallback(() => {
    startTransition(() => {
      escribirAlmacenamiento([]);
    });
  }, []);

  return {
    favoritos,
    totalFavoritos: favoritos.length,
    esFavorito,
    agregarFavorito,
    quitarFavorito,
    toggleFavorito,
    limpiarTodos,
  };
}
