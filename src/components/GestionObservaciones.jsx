import React, { useState, useMemo } from 'react';
import ListaObservaciones from './ListaObservaciones';
import {
    hoyISO,
    estadoDe,
    esRealizada,
    esProgramada,
    programacionDe,
    esObservador,
    estaVencida,
    estaPorRealizar,
    tieneSolicitudAbierta
} from '../utils/storage';
import {
    ESTADOS,
    ESTADO_REALIZACION,
    TINTA_REALIZACION,
    PROGRAMACION,
    TINTA_PROGRAMACION,
    MATIZ_PENDIENTE
} from '../data/constants';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const PERIODOS = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'dia', label: 'Por día' },
    { id: 'mes', label: 'Por mes' },
    { id: 'anio', label: 'Por año' },
    { id: 'todo', label: 'Todo' }
];

const FILTROS_ESTADO = [
    { id: '', label: 'Todas' },
    { id: ESTADO_REALIZACION.REALIZADA, label: 'Realizadas' },
    { id: ESTADO_REALIZACION.NO_REALIZADA, label: 'No realizadas' }
];

const FILTROS_PROGRAMACION = [
    { id: '', label: 'Programadas y no programadas' },
    { id: PROGRAMACION.PROGRAMADA, label: 'Solo programadas' },
    { id: PROGRAMACION.NO_PROGRAMADA, label: 'Solo no programadas' }
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

// Los tiles de estado son tambien el filtro rapido: es el camino mas corto a
// "muéstrame las que no se hicieron".
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
    // El mes corriente y no "hoy": un observador tiene que poder ver de una vez
    // todo lo que le asignaron, no solo lo que le toca en las proximas horas.
    const [periodo, setPeriodo] = useState('mes');
    const [dia, setDia] = useState(hoyISO());
    const [mes, setMes] = useState(hoy.getMonth() + 1);
    const [anio, setAnio] = useState(hoy.getFullYear());
    const [texto, setTexto] = useState('');
    const [fEstado, setFEstado] = useState('');
    const [fProg, setFProg] = useState('');
    // Un observador entra viendo lo suyo; un jefe de area, todo el panorama.
    const [alcance, setAlcance] = useState(usuario.admin ? '' : 'mias');
    const [fAtencion, setFAtencion] = useState('');

    // Los paneles de arriba miran TODAS las observaciones, no solo el periodo:
    // una tarea vencida del mes pasado sigue siendo un incumplimiento abierto y
    // no puede desaparecer porque el filtro de fecha no la alcance.
    const mias = useMemo(() => observaciones.filter(o => esObservador(o, usuario)), [observaciones, usuario]);
    const misPorRealizar = mias.filter(estaPorRealizar).length;
    const misVencidas = mias.filter(estaVencida).length;
    const misRealizadas = mias.filter(esRealizada).length;

    const vencidasTotales = useMemo(() => observaciones.filter(estaVencida).length, [observaciones]);
    const solicitudesTotales = useMemo(() => observaciones.filter(tieneSolicitudAbierta).length, [observaciones]);

    const delPeriodo = useMemo(
        () => filtrarPorPeriodo(observaciones, periodo, { dia, mes, anio }),
        [observaciones, periodo, dia, mes, anio]
    );

    // Ambito: lo que ya paso por periodo, alcance y tipo de programacion. Los
    // tiles de estado cuentan sobre esto para que "Realizadas" signifique
    // siempre "de lo que estoy viendo".
    const delAmbito = useMemo(() => {
        let lista = alcance === 'mias' ? delPeriodo.filter(o => esObservador(o, usuario)) : delPeriodo;
        if (fProg) lista = lista.filter(o => programacionDe(o) === fProg);
        return lista;
    }, [delPeriodo, alcance, usuario, fProg]);

    const filtradas = useMemo(() => {
        let lista = fEstado ? delAmbito.filter(o => estadoDe(o) === fEstado) : delAmbito;
        if (fAtencion === 'vencidas') lista = lista.filter(estaVencida);
        if (fAtencion === 'solicitudes') lista = lista.filter(tieneSolicitudAbierta);

        const q = texto.trim().toLowerCase();
        if (q) {
            lista = lista.filter(o =>
                [o.tarea, o.ppf, o.area, o.creadoPorNombre, ...(o.observadores || []).flatMap(p => [p.nombre, p.email])]
                    .some(v => (v || '').toLowerCase().includes(q)));
        }

        // Lo mas reciente primero: es lo que se acaba de mover.
        return [...lista].sort((a, b) =>
            a.fecha === b.fecha
                ? (b.hora || '').localeCompare(a.hora || '')
                : (b.fecha || '').localeCompare(a.fecha || ''));
    }, [delAmbito, texto, fEstado, fAtencion]);

    const cuenta = (estado) => delAmbito.filter(o => estadoDe(o) === estado).length;
    const conHallazgos = delAmbito.filter(o => o.estado === ESTADOS.CON_HALLAZGOS).length;
    const programadas = delAmbito.filter(esProgramada).length;

    const alternar = (set) => (id) => set(actual => (actual === id ? '' : id));
    const alternarEstado = alternar(setFEstado);
    const alternarProgramacion = alternar(setFProg);
    const alternarAtencion = alternar(setFAtencion);

    const limpiarFiltros = () => { setFEstado(''); setFProg(''); setFAtencion(''); };

    /** Los paneles de arriba abren el periodo: lo suyo no cabe siempre en el mes. */
    const enfocar = (fn) => { setPeriodo('todo'); limpiarFiltros(); fn(); };

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
                                Las que están a tu nombre, sin importar la fecha del filtro.
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
                            valor={misPorRealizar} label="Por realizar" tinta={MATIZ_PENDIENTE}
                            activo={alcance === 'mias' && fEstado === ESTADO_REALIZACION.NO_REALIZADA && !fAtencion}
                            onClick={() => enfocar(() => { setAlcance('mias'); setFEstado(ESTADO_REALIZACION.NO_REALIZADA); })}
                        />
                        <Foco
                            valor={misVencidas} label="Fuera de plazo" tinta={TINTA_REALIZACION[ESTADO_REALIZACION.NO_REALIZADA]}
                            activo={alcance === 'mias' && fAtencion === 'vencidas'}
                            onClick={() => enfocar(() => { setAlcance('mias'); setFAtencion('vencidas'); })}
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
                        Observaciones vencidas sin realizar y solicitudes de reagendamiento esperando tu decisión.
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-w-md">
                        <Foco
                            valor={vencidasTotales} label="No realizadas fuera de plazo"
                            tinta={TINTA_REALIZACION[ESTADO_REALIZACION.NO_REALIZADA]}
                            activo={fAtencion === 'vencidas'}
                            onClick={() => enfocar(() => { setAlcance(''); setFAtencion('vencidas'); })}
                        />
                        <Foco
                            valor={solicitudesTotales} label="Reagendamientos solicitados" tinta="#6d28d9"
                            activo={fAtencion === 'solicitudes'}
                            onClick={() => enfocar(() => { setAlcance(''); setFAtencion('solicitudes'); })}
                        />
                    </div>
                </section>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-4">
                <Tile
                    label="Total tareas" valor={delAmbito.length}
                    activo={!fEstado && !fProg && !fAtencion}
                    onClick={limpiarFiltros}
                />
                <Tile
                    label="Programadas" valor={programadas} color={TINTA_PROGRAMACION[PROGRAMACION.PROGRAMADA]}
                    activo={fProg === PROGRAMACION.PROGRAMADA}
                    onClick={() => alternarProgramacion(PROGRAMACION.PROGRAMADA)}
                />
                <Tile
                    label="No programadas" valor={delAmbito.length - programadas} color={TINTA_PROGRAMACION[PROGRAMACION.NO_PROGRAMADA]}
                    activo={fProg === PROGRAMACION.NO_PROGRAMADA}
                    onClick={() => alternarProgramacion(PROGRAMACION.NO_PROGRAMADA)}
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

                    {/* Alcance: lo mio o lo de todos. Un observador ve el trabajo de
                        los demas, pero la lista abre en lo suyo. */}
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
                        <button
                            onClick={() => alternarAtencion('vencidas')}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition cursor-pointer ${
                                fAtencion === 'vencidas'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                            }`}
                        >
                            Fuera de plazo
                        </button>
                        <button
                            onClick={() => alternarAtencion('solicitudes')}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition cursor-pointer ${
                                fAtencion === 'solicitudes'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                            }`}
                        >
                            Reagendamiento solicitado
                        </button>
                    </div>
                    <select value={fProg} onChange={(e) => setFProg(e.target.value)} className={inputCls}>
                        {FILTROS_PROGRAMACION.map(f => (
                            <option key={f.id || 'todas'} value={f.id}>{f.label}</option>
                        ))}
                    </select>
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
