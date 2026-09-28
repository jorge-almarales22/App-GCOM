import React, { useMemo, useState } from 'react';
import { Avatar } from './PeoplePicker';
import ModalObservacion from './ModalObservacion';
import FiltroColumna, { VACIAS } from './FiltroColumna';
import { useAhora } from '../utils/useAhora';
import { ChipEstado, ChipProgramacion, ChipSolicitud, BadgeHallazgos } from './Chips';
import {
    puedeGestionar,
    tieneComentarios,
    estadoDe,
    observadoresDe,
    esObservador,
    esProgramada,
    ppfsDe,
    tecnicosDe
} from '../utils/storage';

// ---------------------------------------------------------------------------
// Lista de observaciones. Es la MISMA en el dashboard y en el tablero de
// metricas —incluida la gestion, que se abre con doble clic o con el boton—,
// para que nadie tenga que aprenderse dos tablas distintas de lo mismo.
//
// `observaciones` son las filas ya filtradas; `todas` existe solo para que el
// modal siga encontrando la observacion abierta aunque un cambio de estado la
// saque del filtro activo mientras se esta trabajando en ella.
//
// Cada cabecera filtra y ordena como en Excel. Esos filtros son de la tabla:
// se suman a los de la pantalla que la contiene, sin reemplazarlos.
// ---------------------------------------------------------------------------

/**
 * Columnas filtrables. `valores` devuelve lo que se ve en la celda (una
 * celda con varios PPF u observadores aporta varios valores) y `orden` la
 * clave para ordenar la tabla por esa columna.
 */
const COLUMNAS = [
    {
        id: 'programada', label: 'Programada',
        valores: (o) => [esProgramada(o) ? (o.fecha || '') : 'Sin programar'],
        orden: (o) => `${o.fecha || ''} ${o.hora || ''}`,
        textosOrden: ['Más antigua primero', 'Más reciente primero']
    },
    { id: 'tarea', label: 'Tarea', valores: (o) => [o.tarea], orden: (o) => o.tarea || '' },
    {
        id: 'observadores', label: 'Observadores',
        valores: (o) => {
            const gente = observadoresDe(o);
            return gente.length ? gente.map(p => p.nombre || p.email) : [o.creadoPorNombre];
        },
        orden: (o) => observadoresDe(o)[0]?.nombre || o.creadoPorNombre || ''
    },
    { id: 'ppf', label: 'PPF', valores: (o) => ppfsDe(o), orden: (o) => ppfsDe(o)[0] || '' },
    { id: 'area', label: 'Área', valores: (o) => [o.area], orden: (o) => o.area || '' },
    { id: 'estado', label: 'Estado', valores: (o, ahora) => [estadoDe(o, ahora)], orden: (o, ahora) => estadoDe(o, ahora) },
    { id: 'hallazgos', label: 'Hallazgos', valores: (o) => [o.estado], orden: (o) => o.hallazgos?.length || 0, alinear: 'right' }
];

/** Valores de una celda listos para filtrar: sin repetidos y con "(Vacías)". */
const valoresDe = (col, o, ahora) => {
    const v = col.valores(o, ahora).map(x => (x == null || String(x).trim() === '' ? VACIAS : String(x)));
    return v.length ? [...new Set(v)] : [VACIAS];
};

const comparar = (a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
};

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

/** A quien se observa: el primer tecnico y cuantos mas, con su taller. */
const Tecnicos = ({ obs }) => {
    const tecnicos = tecnicosDe(obs);
    if (!tecnicos.length) return null;
    return (
        <p className="text-[10px] text-slate-500 mt-1 leading-snug" title={tecnicos.join(', ')}>
            <span className="font-semibold text-slate-700">{tecnicos[0]}</span>
            {tecnicos.length > 1 && ` +${tecnicos.length - 1}`}
            {obs.taller && <span className="text-slate-400"> · {obs.taller}</span>}
        </p>
    );
};

const ListaObservaciones = ({ observaciones, todas, usuario, vacio }) => {
    const [seleccion, setSeleccion] = useState(null);
    const ahora = useAhora();
    // { [columna]: Set de valores marcados }. Sin entrada = sin filtro.
    const [filtros, setFiltros] = useState({});
    const [orden, setOrden] = useState(null);          // { col, dir } | null

    const pasa = (o, excepto) => COLUMNAS.every(col =>
        col.id === excepto || !filtros[col.id] || valoresDe(col, o, ahora).some(v => filtros[col.id].has(v)));

    const filas = useMemo(() => {
        const lista = observaciones.filter(o => pasa(o));
        if (!orden) return lista;
        const col = COLUMNAS.find(c => c.id === orden.col);
        const signo = orden.dir === 'asc' ? 1 : -1;
        return [...lista].sort((a, b) => signo * comparar(col.orden(a, ahora), col.orden(b, ahora)));
    }, [observaciones, filtros, orden, ahora]);

    // Como en Excel, cada columna ofrece los valores de las filas que dejan
    // pasar los DEMAS filtros: asi los filtros se encadenan.
    const opcionesDe = (col) => {
        const cuenta = new Map();
        observaciones.filter(o => pasa(o, col.id)).forEach(o =>
            valoresDe(col, o, ahora).forEach(v => cuenta.set(v, (cuenta.get(v) || 0) + 1)));
        // Lo marcado se conserva aunque ya no aparezca, para poder desmarcarlo.
        filtros[col.id]?.forEach(v => { if (!cuenta.has(v)) cuenta.set(v, 0); });
        return [...cuenta.entries()]
            .map(([valor, n]) => ({ valor, cuenta: n }))
            .sort((a, b) => (a.valor === VACIAS) - (b.valor === VACIAS) || comparar(a.valor, b.valor));
    };

    const aplicar = (id) => (set) => setFiltros(prev => {
        const sig = { ...prev };
        if (set) sig[id] = set; else delete sig[id];
        return sig;
    });

    const activos = COLUMNAS.filter(c => filtros[c.id]);
    const quitarTodos = () => { setFiltros({}); setOrden(null); };

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
            {(activos.length > 0 || orden) && (
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        {filas.length} de {observaciones.length}
                    </span>
                    {activos.map(col => (
                        <span key={col.id} className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-slate-900 text-white rounded-full pl-2.5 pr-1.5 py-1">
                            <span className="text-slate-400 font-normal">{col.label}:</span>
                            <span className="max-w-[180px] truncate">
                                {filtros[col.id].size === 1 ? [...filtros[col.id]][0] : `${filtros[col.id].size} valores`}
                            </span>
                            <button
                                type="button"
                                onClick={() => aplicar(col.id)(null)}
                                aria-label={`Quitar filtro de ${col.label}`}
                                className="w-4 h-4 grid place-items-center rounded-full hover:bg-white/20 cursor-pointer"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                    {orden && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded-full pl-2.5 pr-1.5 py-1">
                            Orden: {COLUMNAS.find(c => c.id === orden.col)?.label} {orden.dir === 'asc' ? '↑' : '↓'}
                            <button
                                type="button"
                                onClick={() => setOrden(null)}
                                aria-label="Quitar orden"
                                className="w-4 h-4 grid place-items-center rounded-full hover:bg-slate-200 cursor-pointer"
                            >
                                ×
                            </button>
                        </span>
                    )}
                    <button onClick={quitarTodos} className="text-[11px] font-bold text-slate-500 hover:text-slate-900 underline underline-offset-2 cursor-pointer">
                        Quitar todo
                    </button>
                </div>
            )}

            {/* ---- Tabla (pantallas medianas y grandes) ---- */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left">
                            <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                                {COLUMNAS.map(col => (
                                    <th key={col.id} className="px-4 py-3 font-bold whitespace-nowrap">
                                        <FiltroColumna
                                            label={col.label}
                                            opciones={opcionesDe(col)}
                                            seleccion={filtros[col.id] || null}
                                            onAplicar={aplicar(col.id)}
                                            orden={orden?.col === col.id ? orden.dir : null}
                                            onOrdenar={(dir) => setOrden(dir ? { col: col.id, dir } : null)}
                                            textosOrden={col.textosOrden}
                                            alinear={col.alinear}
                                        />
                                    </th>
                                ))}
                                <th className="px-4 py-3 font-bold text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filas.length === 0 && (
                                <tr>
                                    <td colSpan={COLUMNAS.length + 1} className="px-4 py-10 text-center text-sm text-slate-500">
                                        Ninguna fila cumple los filtros de columna.{' '}
                                        <button onClick={quitarTodos} className="font-bold text-slate-800 underline underline-offset-2 cursor-pointer">
                                            Quitar filtros
                                        </button>
                                    </td>
                                </tr>
                            )}
                            {filas.map(o => {
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
                                            <Tecnicos obs={o} />
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                {!esProgramada(o) && <ChipProgramacion obs={o} />}
                                                <ChipSolicitud obs={o} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-top min-w-[170px]">
                                            <Observadores obs={o} usuario={usuario} />
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600 max-w-[170px] align-top">
                                            {ppfsDe(o).length ? (
                                                <span className="flex flex-wrap gap-1">
                                                    {ppfsDe(o).map(p => (
                                                        <span key={p} className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-700">
                                                            {p}
                                                        </span>
                                                    ))}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600 align-top">{o.area || '—'}</td>
                                        <td className="px-4 py-3 align-top">
                                            <ChipEstado estado={estadoDe(o, ahora)} />
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
            {filas.length === 0 && (
                <p className="md:hidden text-sm text-slate-500 text-center py-8">Ninguna fila cumple los filtros de columna.</p>
            )}
            <ul className="md:hidden space-y-3">
                {filas.map(o => {
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
                                    <ChipEstado estado={estadoDe(o, ahora)} />
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
                            <Tecnicos obs={o} />
                            <p className="text-xs text-slate-500 mt-1">
                                {ppfsDe(o).join(' · ') || '—'}
                            </p>
                            <p className="text-xs text-slate-500">
                                {o.area}{esProgramada(o) && ` · Turno ${o.turno}`}
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
