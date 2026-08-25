import React from 'react';
import { esProgramada, programacionDe, tieneSolicitudAbierta } from '../utils/storage';
import { ESTADOS, ESTADO_REALIZACION } from '../data/constants';

// Distintivos compartidos por la lista, el modal y el tablero. Cada uno lleva
// icono ademas de color: el color nunca es el unico canal de informacion.

export const ESTILO_ESTADO = {
    [ESTADO_REALIZACION.POR_REALIZAR]: { chip: 'bg-blue-50 text-blue-700 border-blue-200', icono: '◷' },
    [ESTADO_REALIZACION.REALIZADA]: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', icono: '✓' },
    [ESTADO_REALIZACION.NO_REALIZADA]: { chip: 'bg-red-50 text-red-700 border-red-200', icono: '✕' }
};

const base = 'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border whitespace-nowrap';

export const ChipEstado = ({ estado, className = '' }) => {
    const e = ESTILO_ESTADO[estado] || ESTILO_ESTADO[ESTADO_REALIZACION.POR_REALIZAR];
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
