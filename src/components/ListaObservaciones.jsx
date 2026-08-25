import React, { useState } from 'react';
import { Avatar } from './PeoplePicker';
import ModalObservacion from './ModalObservacion';
import { ChipEstado, ChipProgramacion, ChipVencimiento, ChipSolicitud, BadgeHallazgos } from './Chips';
import {
    puedeGestionar,
    tieneComentarios,
    estadoDe,
    observadoresDe,
    esObservador,
    esProgramada
} from '../utils/storage';

// ---------------------------------------------------------------------------
// Lista de observaciones. Es la MISMA en el dashboard y en el tablero de
// metricas —incluida la gestion, que se abre con doble clic o con el boton—,
// para que nadie tenga que aprenderse dos tablas distintas de lo mismo.
//
// `observaciones` son las filas ya filtradas; `todas` existe solo para que el
// modal siga encontrando la observacion abierta aunque un cambio de estado la
// saque del filtro activo mientras se esta trabajando en ella.
// ---------------------------------------------------------------------------

const fechaCorta = (iso) =>
    iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

/** Hasta dos caras; el resto se resume, que si no la fila crece sin control. */
const Observadores = ({ obs, usuario, compacto = false }) => {
    const gente = observadoresDe(obs);
    if (!gente.length) {
        return (
            <span className="text-xs text-slate-500">
                {obs.creadoPorNombre ? <>Registró <span className="font-semibold text-slate-700">{obs.creadoPorNombre}</span></> : '—'}
            </span>
        );
    }
    const visibles = gente.slice(0, compacto ? 1 : 2);
    const resto = gente.length - visibles.length;
    return (
        <div className="flex items-center gap-2 min-w-0">
            <div className="flex -space-x-2 shrink-0">
                {visibles.map(p => <Avatar key={p.email} persona={p} size="w-7 h-7" />)}
            </div>
            <span className="leading-tight min-w-0">
                <span className="block text-xs font-semibold text-slate-800 truncate">
                    {visibles.map(p => p.nombre).join(', ')}
                    {resto > 0 && <span className="text-slate-500 font-normal"> +{resto}</span>}
                </span>
                {!compacto && gente.length === 1 && (
                    <span className="block text-[10px] text-slate-500 truncate">{gente[0].email}</span>
                )}
            </span>
            {esObservador(obs, usuario) && (
                <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-400 text-slate-900">TÚ</span>
            )}
        </div>
    );
};

const ListaObservaciones = ({ observaciones, todas, usuario, vacio }) => {
    const [seleccion, setSeleccion] = useState(null);

    // El modal lee siempre de la lista viva, asi que se repinta solo cuando el
    // refresco automatico trae un cambio hecho desde otro equipo.
    const fuente = todas || observaciones;
    const obsAbierta = seleccion ? fuente.find(o => o.id === seleccion) : null;

    if (observaciones.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-14 px-4 text-center">
                <p className="text-sm font-semibold text-slate-600">
                    {vacio || 'No hay observaciones para este filtro'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Cambia el periodo o los filtros para ver otras.</p>
            </div>
        );
    }

    return (
        <>
            {/* ---- Tabla (pantallas medianas y grandes) ---- */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left">
                            <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                                <th className="px-4 py-3 font-bold">Programada</th>
                                <th className="px-4 py-3 font-bold">Tarea</th>
                                <th className="px-4 py-3 font-bold">Observadores</th>
                                <th className="px-4 py-3 font-bold">PPF</th>
                                <th className="px-4 py-3 font-bold">Área</th>
                                <th className="px-4 py-3 font-bold">Estado</th>
                                <th className="px-4 py-3 font-bold">Hallazgos</th>
                                <th className="px-4 py-3 font-bold text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {observaciones.map(o => {
                                const comentada = tieneComentarios(o);
                                const gestionable = puedeGestionar(o, usuario);
                                const mia = esObservador(o, usuario);
                                return (
                                    <tr
                                        key={o.id}
                                        onDoubleClick={() => setSeleccion(o.id)}
                                        tabIndex={0}
                                        onKeyDown={(e) => { if (e.key === 'Enter') setSeleccion(o.id); }}
                                        title="Doble clic para abrir"
                                        className={`hover:bg-slate-50 focus:bg-slate-50 focus:outline-none cursor-pointer select-none ${
                                            mia ? 'bg-yellow-50/50' : ''
                                        }`}
                                    >
                                        <td className="px-4 py-3 whitespace-nowrap align-top">
                                            {esProgramada(o) ? (
                                                <>
                                                    <span className="font-bold text-slate-900">{o.hora}</span>
                                                    <span className="block text-[10px] text-slate-400">{o.turno} · {o.fecha}</span>
                                                </>
                                            ) : (
                                                <span className="text-xs text-slate-500">Sin programar</span>
                                            )}
                                            {/* Fecha de creacion: dice cuando entro el registro,
                                                que no es lo mismo que cuando se iba a observar. */}
                                            <span className="block text-[10px] text-slate-400 mt-0.5">
                                                Creada {fechaCorta(o.creadoEn)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 max-w-[240px] align-top">
                                            <div className="flex items-start gap-2">
                                                {comentada && <span title="Tiene comentarios adicionales" className="text-amber-500 shrink-0">💬</span>}
                                                <span className="text-slate-800">{o.tarea}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                {!esProgramada(o) && <ChipProgramacion obs={o} />}
                                                <ChipSolicitud obs={o} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-top min-w-[170px]">
                                            <Observadores obs={o} usuario={usuario} />
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600 max-w-[150px] align-top">{o.ppf}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600 align-top">{o.area || '—'}</td>
                                        <td className="px-4 py-3 align-top">
                                            <ChipEstado estado={estadoDe(o)} />
                                            <ChipVencimiento obs={o} className="mt-1" />
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <BadgeHallazgos estado={o.estado} cantidad={o.hallazgos?.length || 0} />
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap align-top">
                                            <button
                                                onClick={() => setSeleccion(o.id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                                                    gestionable
                                                        ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-900'
                                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                                }`}
                                            >
                                                {gestionable ? 'Gestionar' : 'Ver detalle'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ---- Tarjetas (móvil): una tabla de 8 columnas no cabe en un teléfono ---- */}
            <ul className="md:hidden space-y-3">
                {observaciones.map(o => {
                    const comentada = tieneComentarios(o);
                    const gestionable = puedeGestionar(o, usuario);
                    const mia = esObservador(o, usuario);
                    return (
                        <li
                            key={o.id}
                            onDoubleClick={() => setSeleccion(o.id)}
                            className={`bg-white rounded-xl border p-4 ${mia ? 'border-yellow-400 bg-yellow-50/40' : 'border-slate-200'}`}
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <ChipEstado estado={estadoDe(o)} />
                                    <ChipVencimiento obs={o} />
                                    {!esProgramada(o) && <ChipProgramacion obs={o} />}
                                </div>
                                <span className="text-right shrink-0">
                                    {esProgramada(o) && <span className="block text-sm font-bold text-slate-900">{o.hora}</span>}
                                    <span className="block text-[10px] text-slate-400">{o.fecha}</span>
                                </span>
                            </div>

                            <p className="text-sm font-semibold text-slate-900 leading-snug">
                                {comentada && <span className="mr-1">💬</span>}{o.tarea}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                {esProgramada(o) ? `${o.ppf} · ${o.area} · Turno ${o.turno}` : o.ppf}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">Creada {fechaCorta(o.creadoEn)}</p>
                            <div className="mt-1.5"><ChipSolicitud obs={o} /></div>

                            <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
                                <Observadores obs={o} usuario={usuario} compacto />
                                <button
                                    onClick={() => setSeleccion(o.id)}
                                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                                        gestionable
                                            ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-900'
                                            : 'bg-slate-100 text-slate-700'
                                    }`}
                                >
                                    {gestionable ? 'Gestionar' : 'Ver detalle'}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {obsAbierta && (
                <ModalObservacion
                    obs={obsAbierta}
                    usuario={usuario}
                    onCerrar={() => setSeleccion(null)}
                />
            )}
        </>
    );
};

export default ListaObservaciones;
