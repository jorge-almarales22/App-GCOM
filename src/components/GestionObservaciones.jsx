import React, { useState, useMemo } from 'react';
import { Avatar } from './PeoplePicker';
import ModalObservacion, { ChipEstado } from './ModalObservacion';
import { hoyISO, puedeGestionar, tieneComentarioAdmin, estadoDe, estaVencida } from '../utils/storage';
import { ESTADOS, ESTADO_REALIZACION, TINTA_REALIZACION } from '../data/constants';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const PERIODOS = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'dia', label: 'Por día' },
    { id: 'mes', label: 'Por mes' },
    { id: 'anio', label: 'Por año' }
];

const FILTROS_ESTADO = [
    { id: '', label: 'Todas' },
    { id: ESTADO_REALIZACION.PENDIENTE, label: 'Pendientes' },
    { id: ESTADO_REALIZACION.REALIZADA, label: 'Realizadas' },
    { id: ESTADO_REALIZACION.NO_REALIZADA, label: 'No realizadas' }
];

export const filtrarPorPeriodo = (observaciones, periodo, { dia, mes, anio }) => {
    switch (periodo) {
        case 'hoy':
            return observaciones.filter(o => o.fecha === hoyISO());
        case 'dia':
            return observaciones.filter(o => o.fecha === dia);
        case 'mes':
            return observaciones.filter(o => o.fecha?.startsWith(`${anio}-${String(mes).padStart(2, '0')}`));
        case 'anio':
            return observaciones.filter(o => o.fecha?.startsWith(String(anio)));
        default:
            return observaciones;
    }
};

const BadgeHallazgos = ({ estado, cantidad }) =>
    estado === ESTADOS.CON_HALLAZGOS ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
            ⚠ {cantidad}
        </span>
    ) : (
        <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap">
            Sin hallazgos
        </span>
    );

// Los tiles de estado son el filtro rapido; el de hallazgos solo informa, asi
// que se rinde como texto y no finge ser un boton.
const Tile = ({ label, valor, color, activo, onClick }) => {
    const contenido = (
        <>
            <p className="text-lg sm:text-2xl font-bold tabular-nums" style={{ color: color || '#0f172a' }}>{valor}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold leading-tight mt-0.5">{label}</p>
        </>
    );
    const base = 'text-left px-3 sm:px-4 py-2.5 rounded-xl border bg-white transition';

    if (!onClick) return <div className={`${base} border-slate-200`}>{contenido}</div>;

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={activo}
            className={`${base} cursor-pointer ${activo ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'}`}
        >
            {contenido}
        </button>
    );
};

const GestionObservaciones = ({ usuario, observaciones }) => {
    const hoy = new Date();
    const [periodo, setPeriodo] = useState('hoy');
    const [dia, setDia] = useState(hoyISO());
    const [mes, setMes] = useState(hoy.getMonth() + 1);
    const [anio, setAnio] = useState(hoy.getFullYear());
    const [texto, setTexto] = useState('');
    const [fEstado, setFEstado] = useState('');
    const [seleccion, setSeleccion] = useState(null);

    const delPeriodo = useMemo(
        () => filtrarPorPeriodo(observaciones, periodo, { dia, mes, anio }),
        [observaciones, periodo, dia, mes, anio]
    );

    const filtradas = useMemo(() => {
        const porEstado = fEstado ? delPeriodo.filter(o => estadoDe(o) === fEstado) : delPeriodo;

        const q = texto.trim().toLowerCase();
        const conTexto = q
            ? porEstado.filter(o =>
                [o.tarea, o.ppf, o.area, o.observador?.nombre, o.observador?.email]
                    .some(v => (v || '').toLowerCase().includes(q)))
            : porEstado;

        return [...conTexto].sort((a, b) =>
            a.fecha === b.fecha
                ? (a.hora || '').localeCompare(b.hora || '')
                : (a.fecha || '').localeCompare(b.fecha || ''));
    }, [delPeriodo, texto, fEstado]);

    // El modal lee siempre de la lista viva, asi que se repinta solo cuando el
    // refresco automatico trae un cambio hecho desde otro equipo.
    const obsAbierta = seleccion ? observaciones.find(o => o.id === seleccion) : null;

    const cuenta = (estado) => delPeriodo.filter(o => estadoDe(o) === estado).length;
    const conHallazgos = delPeriodo.filter(o => o.estado === ESTADOS.CON_HALLAZGOS).length;

    const alternarEstado = (id) => setFEstado(actual => (actual === id ? '' : id));

    const inputCls = 'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 bg-white';

    return (
        <div>
            <div className="mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Gestión de observaciones</h2>
                <p className="text-sm text-slate-500 mt-1">
                    {periodo === 'hoy'
                        ? `Programadas para hoy, ${hoy.toLocaleDateString('es-CO', { dateStyle: 'long' })}`
                        : 'Consulta histórica de observaciones'}
                    <span className="hidden sm:inline"> · doble clic sobre una fila para abrirla</span>
                </p>
            </div>

            {/* Los tiles tambien filtran: es el camino mas corto a "muéstrame las pendientes". */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-4">
                <Tile label="Programadas" valor={delPeriodo.length} activo={fEstado === ''} onClick={() => setFEstado('')} />
                <Tile
                    label="Pendientes" valor={cuenta(ESTADO_REALIZACION.PENDIENTE)} color={TINTA_REALIZACION[ESTADO_REALIZACION.PENDIENTE]}
                    activo={fEstado === ESTADO_REALIZACION.PENDIENTE}
                    onClick={() => alternarEstado(ESTADO_REALIZACION.PENDIENTE)}
                />
                <Tile
                    label="Realizadas" valor={cuenta(ESTADO_REALIZACION.REALIZADA)} color={TINTA_REALIZACION[ESTADO_REALIZACION.REALIZADA]}
                    activo={fEstado === ESTADO_REALIZACION.REALIZADA}
                    onClick={() => alternarEstado(ESTADO_REALIZACION.REALIZADA)}
                />
                <Tile
                    label="No realizadas" valor={cuenta(ESTADO_REALIZACION.NO_REALIZADA)} color={TINTA_REALIZACION[ESTADO_REALIZACION.NO_REALIZADA]}
                    activo={fEstado === ESTADO_REALIZACION.NO_REALIZADA}
                    onClick={() => alternarEstado(ESTADO_REALIZACION.NO_REALIZADA)}
                />
                {/* El rojo queda reservado para los hallazgos, que son el riesgo real. */}
                <Tile label="Con hallazgos" valor={conHallazgos} color="#b91c1c" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 mb-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                        {PERIODOS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPeriodo(p.id)}
                                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                                    periodo === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {periodo === 'dia' && (
                        <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className={inputCls} />
                    )}
                    {periodo === 'mes' && (
                        <>
                            <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={inputCls}>
                                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                            </select>
                            <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={`${inputCls} w-24`} />
                        </>
                    )}
                    {periodo === 'anio' && (
                        <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={`${inputCls} w-28`} />
                    )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
                        {FILTROS_ESTADO.map(f => (
                            <button
                                key={f.id || 'todas'}
                                onClick={() => setFEstado(f.id)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition cursor-pointer ${
                                    fEstado === f.id
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <input
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        placeholder="Buscar por tarea, PPF, área u observador..."
                        className={`${inputCls} flex-1 sm:min-w-[240px]`}
                    />
                </div>
            </div>

            {filtradas.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-14 px-4 text-center">
                    <p className="text-sm font-semibold text-slate-600">No hay observaciones para este filtro</p>
                    <p className="text-xs text-slate-400 mt-1">Cambia el periodo o el estado para ver otras.</p>
                </div>
            ) : (
                <>
                    {/* ---- Tabla (pantallas medianas y grandes) ---- */}
                    <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-left">
                                    <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                                        <th className="px-4 py-3 font-bold">Hora</th>
                                        <th className="px-4 py-3 font-bold">Tarea</th>
                                        <th className="px-4 py-3 font-bold">Observador</th>
                                        <th className="px-4 py-3 font-bold">PPF</th>
                                        <th className="px-4 py-3 font-bold">Área</th>
                                        <th className="px-4 py-3 font-bold">Estado</th>
                                        <th className="px-4 py-3 font-bold">Hallazgos</th>
                                        <th className="px-4 py-3 font-bold text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtradas.map(o => {
                                        const comentada = tieneComentarioAdmin(o);
                                        const gestionable = puedeGestionar(o, usuario);
                                        return (
                                            <tr
                                                key={o.id}
                                                onDoubleClick={() => setSeleccion(o.id)}
                                                tabIndex={0}
                                                onKeyDown={(e) => { if (e.key === 'Enter') setSeleccion(o.id); }}
                                                title="Doble clic para abrir"
                                                className={`hover:bg-slate-50 focus:bg-slate-50 focus:outline-none cursor-pointer select-none ${comentada ? 'bg-amber-50/60' : ''}`}
                                            >
                                                <td className="px-4 py-3 whitespace-nowrap align-top">
                                                    <span className="font-bold text-slate-900">{o.hora}</span>
                                                    <span className="block text-[10px] text-slate-400">{o.turno} · {o.fecha}</span>
                                                </td>
                                                <td className="px-4 py-3 max-w-[240px] align-top">
                                                    <div className="flex items-start gap-2">
                                                        {comentada && <span title="Comentada por gerencia" className="text-amber-500 shrink-0">🚩</span>}
                                                        <span className="text-slate-800">{o.tarea}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    {o.observador ? (
                                                        <div className="flex items-center gap-2 min-w-[150px]">
                                                            <Avatar persona={o.observador} size="w-7 h-7" />
                                                            <span className="leading-tight min-w-0">
                                                                <span className="block text-xs font-semibold text-slate-800 truncate">{o.observador.nombre}</span>
                                                                <span className="block text-[10px] text-slate-500 truncate">{o.observador.email}</span>
                                                            </span>
                                                        </div>
                                                    ) : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-600 max-w-[150px] align-top">{o.ppf}</td>
                                                <td className="px-4 py-3 text-xs text-slate-600 align-top">{o.area}</td>
                                                <td className="px-4 py-3 align-top">
                                                    <ChipEstado estado={estadoDe(o)} />
                                                    {estaVencida(o) && (
                                                        <span className="block text-[10px] text-amber-700 font-semibold mt-1">Fuera de hora</span>
                                                    )}
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
                        {filtradas.map(o => {
                            const comentada = tieneComentarioAdmin(o);
                            const gestionable = puedeGestionar(o, usuario);
                            return (
                                <li
                                    key={o.id}
                                    onDoubleClick={() => setSeleccion(o.id)}
                                    className={`bg-white rounded-xl border p-4 ${comentada ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <ChipEstado estado={estadoDe(o)} />
                                            <BadgeHallazgos estado={o.estado} cantidad={o.hallazgos?.length || 0} />
                                        </div>
                                        <span className="text-right shrink-0">
                                            <span className="block text-sm font-bold text-slate-900">{o.hora}</span>
                                            <span className="block text-[10px] text-slate-400">{o.fecha}</span>
                                        </span>
                                    </div>

                                    <p className="text-sm font-semibold text-slate-900 leading-snug">
                                        {comentada && <span className="mr-1">🚩</span>}{o.tarea}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">{o.ppf} · {o.area} · Turno {o.turno}</p>
                                    {estaVencida(o) && (
                                        <p className="text-[11px] text-amber-700 font-semibold mt-1">Fuera de hora programada</p>
                                    )}

                                    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
                                        {o.observador ? (
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Avatar persona={o.observador} size="w-7 h-7" />
                                                <span className="text-xs text-slate-600 truncate">{o.observador.nombre}</span>
                                            </div>
                                        ) : <span className="text-xs text-slate-400">Sin observador</span>}
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
                </>
            )}

            {obsAbierta && (
                <ModalObservacion
                    obs={obsAbierta}
                    usuario={usuario}
                    onCerrar={() => setSeleccion(null)}
                />
            )}
        </div>
    );
};

export default GestionObservaciones;
