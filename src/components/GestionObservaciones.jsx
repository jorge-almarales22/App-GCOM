import React, { useState, useMemo } from 'react';
import ListaObservaciones from './ListaObservaciones';
import { useAhora } from '../utils/useAhora';
import {
    hoyISO,
    estadoDe,
    esRealizada,
    esProgramada,
    esObservador,
    estaVencida,
    estaPorRealizar,
    tieneSolicitudAbierta,
    ppfsDe
} from '../utils/storage';
import { ESTADOS, ESTADO_REALIZACION, TINTA_REALIZACION } from '../data/constants';

// ---------------------------------------------------------------------------
// Tablero de gestion.
//
// Programadas y no programadas viven en pestañas separadas y NUNCA se mezclan:
// son dos cosas distintas y sumarlas no significa nada. El compromiso del area
// son las programadas, asi que esa pestaña es la que abre.
// ---------------------------------------------------------------------------

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const PERIODOS = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'ayer', label: 'Ayer' },
    { id: 'dia', label: 'Por día' },
    { id: 'mes', label: 'Por mes' },
    { id: 'anio', label: 'Por año' },
    { id: 'rango', label: 'Rango' },
    { id: 'todo', label: 'Todo' }
];

const FILTROS_ESTADO = [
    { id: '', label: 'Todas' },
    { id: ESTADO_REALIZACION.POR_REALIZAR, label: 'Por realizar' },
    { id: ESTADO_REALIZACION.REALIZADA, label: 'Realizadas' },
    { id: ESTADO_REALIZACION.NO_REALIZADA, label: 'No realizadas' }
];

const ayerISO = () => hoyISO(new Date(Date.now() - 86400000));

export const filtrarPorPeriodo = (observaciones, periodo, { dia, mes, anio, desde, hasta }) => {
    switch (periodo) {
        case 'hoy':
            return observaciones.filter(o => o.fecha === hoyISO());
        case 'ayer':
            return observaciones.filter(o => o.fecha === ayerISO());
        case 'dia':
            return observaciones.filter(o => o.fecha === dia);
        case 'mes':
            return observaciones.filter(o => o.fecha?.startsWith(`${anio}-${String(mes).padStart(2, '0')}`));
        case 'anio':
            return observaciones.filter(o => o.fecha?.startsWith(String(anio)));
        case 'rango':
            // Los limites entran en el rango: "del 1 al 15" incluye ambos dias.
            return observaciones.filter(o => (!desde || o.fecha >= desde) && (!hasta || o.fecha <= hasta));
        default:
            return observaciones;
    }
};

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

/** Cifra grande y clicable dentro de un panel de color. */
const Foco = ({ valor, label, tinta, activo, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={activo}
        className={`text-left px-3 py-2 rounded-lg border bg-white/80 transition cursor-pointer ${
            activo ? 'border-slate-900 ring-1 ring-slate-900' : 'border-white hover:border-slate-300'
        }`}
    >
        <p className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: tinta }}>{valor}</p>
        <p className="text-[10px] uppercase font-bold text-slate-600 leading-tight mt-0.5">{label}</p>
    </button>
);

const GestionObservaciones = ({ usuario, observaciones }) => {
    const hoy = new Date();
    const ahora = useAhora();

    const [vista, setVista] = useState('programadas');
    const [periodo, setPeriodo] = useState('mes');
    const [dia, setDia] = useState(hoyISO());
    const [mes, setMes] = useState(hoy.getMonth() + 1);
    const [anio, setAnio] = useState(hoy.getFullYear());
    const [desde, setDesde] = useState(hoyISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
    const [hasta, setHasta] = useState(hoyISO());
    const [texto, setTexto] = useState('');
    const [fEstado, setFEstado] = useState('');
    const [alcance, setAlcance] = useState(usuario.admin ? '' : 'mias');
    const [fAtencion, setFAtencion] = useState('');

    const esProgramadaLaVista = vista === 'programadas';

    // Cada pestaña trabaja sobre su propio universo. Nada se suma entre ellas.
    const universo = useMemo(
        () => observaciones.filter(o => esProgramada(o) === esProgramadaLaVista),
        [observaciones, esProgramadaLaVista]
    );

    // Los paneles de arriba miran TODAS las programadas, no solo el periodo: una
    // tarea vencida del mes pasado sigue siendo un incumplimiento abierto y no
    // puede desaparecer porque el filtro de fecha no la alcance.
    const programadasTotales = useMemo(() => observaciones.filter(o => esProgramada(o)), [observaciones]);
    const mias = useMemo(() => programadasTotales.filter(o => esObservador(o, usuario)), [programadasTotales, usuario]);
    const misPorRealizar = mias.filter(o => estaPorRealizar(o, ahora)).length;
    const misNoRealizadas = mias.filter(o => estaVencida(o, ahora)).length;
    const misRealizadas = mias.filter(o => esRealizada(o)).length;

    const vencidasTotales = useMemo(
        () => programadasTotales.filter(o => estaVencida(o, ahora)).length,
        [programadasTotales, ahora]
    );
    const solicitudesTotales = useMemo(
        () => programadasTotales.filter(o => tieneSolicitudAbierta(o)).length,
        [programadasTotales]
    );

    const delPeriodo = useMemo(
        () => filtrarPorPeriodo(universo, periodo, { dia, mes, anio, desde, hasta }),
        [universo, periodo, dia, mes, anio, desde, hasta]
    );

    const delAmbito = useMemo(
        () => (alcance === 'mias' ? delPeriodo.filter(o => esObservador(o, usuario)) : delPeriodo),
        [delPeriodo, alcance, usuario]
    );

    const filtradas = useMemo(() => {
        let lista = fEstado ? delAmbito.filter(o => estadoDe(o, ahora) === fEstado) : delAmbito;
        if (fAtencion === 'solicitudes') lista = lista.filter(o => tieneSolicitudAbierta(o));

        const q = texto.trim().toLowerCase();
        if (q) {
            lista = lista.filter(o =>
                [o.tarea, o.area, o.creadoPorNombre, ...ppfsDe(o), ...(o.observadores || []).flatMap(p => [p.nombre, p.email])]
                    .some(v => (v || '').toLowerCase().includes(q)));
        }

        return [...lista].sort((a, b) =>
            a.fecha === b.fecha
                ? (b.hora || '').localeCompare(a.hora || '')
                : (b.fecha || '').localeCompare(a.fecha || ''));
    }, [delAmbito, texto, fEstado, fAtencion, ahora]);

    const cuenta = (estado) => delAmbito.filter(o => estadoDe(o, ahora) === estado).length;
    const conHallazgos = delAmbito.filter(o => o.estado === ESTADOS.CON_HALLAZGOS).length;

    const alternar = (set) => (id) => set(actual => (actual === id ? '' : id));
    const alternarEstado = alternar(setFEstado);
    const alternarAtencion = alternar(setFAtencion);

    const limpiarFiltros = () => { setFEstado(''); setFAtencion(''); };

    /** Los paneles de arriba abren el periodo: lo suyo no cabe siempre en el mes. */
    const enfocar = (fn) => { setVista('programadas'); setPeriodo('todo'); limpiarFiltros(); fn(); };

    const cambiarVista = (v) => { setVista(v); limpiarFiltros(); };

    const inputCls = 'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 bg-white';

    return (
        <div>
            <div className="mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Gestión de observaciones</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Consulta y cierre de las tareas relevantes de seguridad
                    <span className="hidden sm:inline"> · doble clic sobre una fila para abrirla</span>
                </p>
            </div>

            {/* ---- Lo primero que ve un observador: lo que le asignaron ---- */}
            {mias.length > 0 && (
                <section className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4 mb-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm">Mis observaciones asignadas</h3>
                            <p className="text-xs text-slate-600">
                                Las programadas a tu nombre, sin importar la fecha del filtro.
                            </p>
                        </div>
                        <button
                            onClick={() => enfocar(() => setAlcance('mias'))}
                            className="text-[11px] font-bold text-slate-700 underline underline-offset-2 cursor-pointer hover:text-slate-900"
                        >
                            Ver todas las mías
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Foco
                            valor={mias.length} label="Asignadas" tinta="#0f172a"
                            activo={alcance === 'mias' && !fEstado && !fAtencion}
                            onClick={() => enfocar(() => setAlcance('mias'))}
                        />
                        <Foco
                            valor={misPorRealizar} label="Por realizar" tinta={TINTA_REALIZACION[ESTADO_REALIZACION.POR_REALIZAR]}
                            activo={alcance === 'mias' && fEstado === ESTADO_REALIZACION.POR_REALIZAR}
                            onClick={() => enfocar(() => { setAlcance('mias'); setFEstado(ESTADO_REALIZACION.POR_REALIZAR); })}
                        />
                        <Foco
                            valor={misNoRealizadas} label="No realizadas" tinta={TINTA_REALIZACION[ESTADO_REALIZACION.NO_REALIZADA]}
                            activo={alcance === 'mias' && fEstado === ESTADO_REALIZACION.NO_REALIZADA}
                            onClick={() => enfocar(() => { setAlcance('mias'); setFEstado(ESTADO_REALIZACION.NO_REALIZADA); })}
                        />
                        <Foco
                            valor={misRealizadas} label="Realizadas" tinta={TINTA_REALIZACION[ESTADO_REALIZACION.REALIZADA]}
                            activo={alcance === 'mias' && fEstado === ESTADO_REALIZACION.REALIZADA}
                            onClick={() => enfocar(() => { setAlcance('mias'); setFEstado(ESTADO_REALIZACION.REALIZADA); })}
                        />
                    </div>
                </section>
            )}

            {/* ---- Lo primero que ve un jefe de area: lo que no se hizo ---- */}
            {usuario.admin && (vencidasTotales > 0 || solicitudesTotales > 0) && (
                <section className="rounded-2xl border border-red-200 bg-red-50 p-4 mb-4">
                    <h3 className="font-bold text-slate-900 text-sm mb-1">Requieren tu atención</h3>
                    <p className="text-xs text-slate-600 mb-3">
                        Programadas que vencieron sin realizarse y fechas propuestas esperando tu decisión.
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-w-md">
                        <Foco
                            valor={vencidasTotales} label="No realizadas"
                            tinta={TINTA_REALIZACION[ESTADO_REALIZACION.NO_REALIZADA]}
                            activo={fEstado === ESTADO_REALIZACION.NO_REALIZADA && !fAtencion}
                            onClick={() => enfocar(() => { setAlcance(''); setFEstado(ESTADO_REALIZACION.NO_REALIZADA); })}
                        />
                        <Foco
                            valor={solicitudesTotales} label="Reagendamientos propuestos" tinta="#6d28d9"
                            activo={fAtencion === 'solicitudes'}
                            onClick={() => enfocar(() => { setAlcance(''); setFAtencion('solicitudes'); })}
                        />
                    </div>
                </section>
            )}

            {/* ---- Pestañas: dos universos que nunca se mezclan ---- */}
            <div className="flex gap-1 border-b border-slate-200 mb-4">
                {[
                    { id: 'programadas', label: 'Programadas' },
                    { id: 'noProgramadas', label: 'No programadas' }
                ].map(v => (
                    <button
                        key={v.id}
                        onClick={() => cambiarVista(v.id)}
                        aria-pressed={vista === v.id}
                        className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition cursor-pointer ${
                            vista === v.id
                                ? 'border-yellow-400 text-slate-900'
                                : 'border-transparent text-slate-400 hover:text-slate-700'
                        }`}
                    >
                        {v.label}
                    </button>
                ))}
            </div>

            {/* Solo lo programado tiene metas que medir; de lo no programado no se
                llevan cifras, por decision de la gerencia. */}
            {esProgramadaLaVista && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-4">
                    <Tile
                        label="Programadas" valor={delAmbito.length}
                        activo={!fEstado && !fAtencion}
                        onClick={limpiarFiltros}
                    />
                    <Tile
                        label="Por realizar" valor={cuenta(ESTADO_REALIZACION.POR_REALIZAR)} color={TINTA_REALIZACION[ESTADO_REALIZACION.POR_REALIZAR]}
                        activo={fEstado === ESTADO_REALIZACION.POR_REALIZAR}
                        onClick={() => alternarEstado(ESTADO_REALIZACION.POR_REALIZAR)}
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
                    <Tile label="Con hallazgos" valor={conHallazgos} color="#b91c1c" />
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 mb-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
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
                    {periodo === 'rango' && (
                        <div className="flex items-center gap-2">
                            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputCls} />
                            <span className="text-xs text-slate-400">a</span>
                            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputCls} />
                        </div>
                    )}

                    <div className="flex gap-1 bg-slate-100 rounded-lg p-1 ml-auto">
                        {[{ id: 'mias', label: 'Mis observaciones' }, { id: '', label: 'Todas' }].map(a => (
                            <button
                                key={a.id || 'todas'}
                                onClick={() => setAlcance(a.id)}
                                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                                    alcance === a.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {a.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
                        {FILTROS_ESTADO.map(f => (
                            <button
                                key={f.id || 'todas'}
                                onClick={() => { setFEstado(f.id); setFAtencion(''); }}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition cursor-pointer ${
                                    fEstado === f.id && !fAtencion
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                        {esProgramadaLaVista && (
                            <button
                                onClick={() => alternarAtencion('solicitudes')}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition cursor-pointer ${
                                    fAtencion === 'solicitudes'
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                                }`}
                            >
                                Reagendamiento propuesto
                            </button>
                        )}
                    </div>
                    <input
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        placeholder="Buscar por tarea, PPF, área u observador..."
                        className={`${inputCls} flex-1 sm:min-w-[240px]`}
                    />
                </div>
            </div>

            <ListaObservaciones
                observaciones={filtradas}
                todas={observaciones}
                usuario={usuario}
                vacio={alcance === 'mias' ? 'No tienes observaciones para este filtro' : 'No hay observaciones para este filtro'}
            />
        </div>
    );
};

export default GestionObservaciones;
