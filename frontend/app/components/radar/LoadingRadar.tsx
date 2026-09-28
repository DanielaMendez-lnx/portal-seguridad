"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import RadarGraphic from "./RadarGraphic";

export interface LoadingRadarProps {
  variant?: "fullscreen" | "compact";
  error?: Error | string | null;
  onRetry?: () => void;
  className?: string;
}

export default function LoadingRadar({
  variant = "fullscreen",
  error = null,
  onRetry,
  className = "",
}: LoadingRadarProps) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    // Si ya viene con error, no es necesario contar el tiempo
    if (error) return;

    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [error]);

  const hasTimedOut = secondsElapsed >= 45;
  const isErrorState = Boolean(error) || hasTimedOut;

  // Umbrales de tiempo adaptados para el límite de Vercel (45s antes del corte de 60s)
  let statusMessage: string | null = null;
  if (!isErrorState) {
    if (secondsElapsed >= 15) {
      statusMessage =
        "Sigue cargando: los servicios gratuitos a veces tardan más en la primera consulta.";
    } else if (secondsElapsed >= 2) {
      statusMessage = "Despertando el sistema, esto puede tardar unos segundos...";
    }
  }

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const getErrorMessage = () => {
    if (typeof error === "string") return error;
    if (error && error.message) {
      // Filtrar mensajes técnicos crudos si no aportan al usuario
      return error.message.includes("Timeout")
        ? "El servidor tardó más de lo esperado en responder."
        : error.message;
    }
    return "El servidor tardó más de lo esperado en responder.";
  };

  if (variant === "compact") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex flex-col items-center justify-center p-4 text-center ${className}`}
      >
        {!isErrorState ? (
          <>
            <RadarGraphic size="compact" />
            {statusMessage && (
              <p className="mt-2.5 text-xs text-umbra-ink-dim max-w-xs animate-fade-in leading-relaxed font-normal">
                {statusMessage}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 max-w-xs">
            <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-4 h-4" />
            </div>
            <p className="text-xs text-umbra-ink font-medium leading-tight">
              {getErrorMessage()}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-umbra-surface hover:bg-umbra-surface-hover text-umbra-cyan border border-umbra-cyan/30 hover:border-umbra-cyan/60 transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reintentar</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Variante: Fullscreen (Carga de ruta y error de página)
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center w-full max-w-md mx-auto text-center px-4 py-8 ${className}`}
    >
      {!isErrorState ? (
        <>
          <div className="relative mb-8 flex items-center justify-center">
            <RadarGraphic size="lg" />
          </div>

          {/* Región de mensajes dinámicos con reserva de altura para no provocar saltos de layout */}
          <div className="min-h-[52px] flex items-center justify-center">
            {statusMessage ? (
              <p className="text-sm md:text-base text-umbra-ink-dim font-medium leading-relaxed max-w-sm transition-opacity duration-300">
                {statusMessage}
              </p>
            ) : (
              <span className="sr-only">Cargando métricas de seguridad...</span>
            )}
          </div>

          {/* Micro-indicador de actividad */}
          <div className="mt-6 flex items-center gap-2 text-xs font-mono text-umbra-ink-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-umbra-cyan animate-pulse" />
            <span>Sondeando disponibilidad de servicios</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5 shadow-lg shadow-rose-500/5">
            <AlertCircle className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-bold text-umbra-ink mb-2">
            No se pudo completar la carga
          </h2>

          <p className="text-sm text-umbra-ink-dim leading-relaxed max-w-sm mb-6">
            {getErrorMessage()}
          </p>

          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-umbra-surface hover:bg-umbra-surface-hover text-umbra-cyan border border-umbra-cyan/40 hover:border-umbra-cyan transition-all cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reintentar conexión</span>
          </button>
        </div>
      )}
    </div>
  );
}
