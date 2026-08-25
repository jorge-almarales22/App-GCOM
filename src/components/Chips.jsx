import React from 'react';
import { esProgramada, programacionDe, estaVencida, estaPorRealizar, tieneSolicitudAbierta } from '../utils/storage';
import { ESTADOS, ESTADO_REALIZACION } from '../data/constants';

// Distintivos compartidos por la lista, el modal y el tablero. Cada uno lleva
// icono ademas de color: el color nunca es el unico canal de informacion.

export const ESTILO_ESTADO = {
    [ESTADO_REALIZACION.REALIZADA]: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', icono: '✓' },
    [ESTADO_REALIZACION.NO_REALIZADA]: { chip: 'bg-red-50 text-red-700 border-red-200', icono: '✕' }
};

const base = 'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border whitespace-nowrap';

export const ChipEstado = ({ estado, className = '' }) => {
    const e = ESTILO_ESTADO[estado] || ESTILO_ESTADO[ESTADO_REALIZACION.NO_REALIZADA];
    return (
        <span className={`${base} ${e.chip} ${className}`}>
            <span aria-hidden="true">{e.icono}</span>{estado}
        </span>
    );
};

// Origen de la tarea. La no programada va en naranja porque es la excepcion
// que hay que poder identificar de un vistazo dentro de una lista larga.
export const ChipProgramacion = ({ obs, className = '' }) => (
    <span className={`${base} ${
        esProgramada(obs)
            ? 'bg-slate-50 text-slate-600 border-slate-200'
            : 'bg-orange-50 text-orange-800 border-orange-200'
    } ${className}`}>
        <span aria-hidden="true">{esProgramada(obs) ? '🗓' : '⚡'}</span>{programacionDe(obs)}
    </span>
);

/**
 * Matiz temporal de una no realizada: si la hora ya paso es un incumplimiento,
 * y si no ha llegado el observador todavia esta a tiempo. No es un estado: el
 * estado sigue siendo "No realizada" en ambos casos.
 */
export const ChipVencimiento = ({ obs, className = '' }) => {
    if (estaVencida(obs)) {
        return (
            <span className={`${base} bg-amber-100 text-amber-900 border-amber-300 ${className}`}>
                <span aria-hidden="true">⏰</span>Fuera de plazo
            </span>
        );
    }
    if (estaPorRealizar(obs)) {
        return (
            <span className={`${base} bg-blue-50 text-blue-700 border-blue-200 ${className}`}>
                <span aria-hidden="true">◷</span>Por realizar
            </span>
        );
    }
    return null;
};

export const ChipSolicitud = ({ obs, className = '' }) =>
    tieneSolicitudAbierta(obs) ? (
        <span className={`${base} bg-violet-50 text-violet-800 border-violet-200 ${className}`}>
            <span aria-hidden="true">↻</span>Reagendamiento solicitado
        </span>
    ) : null;

export const BadgeHallazgos = ({ estado, cantidad }) =>
    estado === ESTADOS.CON_HALLAZGOS ? (
        <span className={`${base} bg-red-50 text-red-700 border-red-200`}>
            <span aria-hidden="true">⚠</span>{cantidad}
        </span>
    ) : (
        <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap">
            Sin hallazgos
        </span>
    );
