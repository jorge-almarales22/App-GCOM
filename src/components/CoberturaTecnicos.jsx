import React, { useMemo, useState } from 'react';
import ListaObservaciones from './ListaObservaciones';
import SelectorMultiple from './SelectorMultiple';
import { useAhora } from '../utils/useAhora';
import {
    esProgramada,
    esRealizada,
    estaPorRealizar,
    observadoresDe,
    ppfsDe,
    tecnicosDe
} from '../utils/storage';
import { ESTADO_REALIZACION, COLOR_REALIZACION, TINTA_REALIZACION, normalizarCorreo } from '../data/constants';
import { TALLERES, TECNICOS } from '../data/tecnicos';

// ---------------------------------------------------------------------------
// Cobertura de tecnicos observados.
//
// La meta: cada tecnico de cada taller tiene que ser observado por un
// supervisor (los observadores que registran en la app) por lo menos UNA vez al
// año, en cualquier PPF. Un tecnico cuenta como observado cuando aparece en una
// observacion programada y REALIZADA de ese año; si solo esta asignado a una que
// todavia tiene plazo, cuenta como "programado", que es avance pero no
// cumplimiento.
//
// El tablero tiene su propio selector de año porque la meta es anual: el rango
// de fechas del resto de la pantalla (por defecto el mes) no aplica aqui.
// ---------------------------------------------------------------------------

const VERDE = COLOR_REALIZACION[ESTADO_REALIZACION.REALIZADA];
const AZUL = COLOR_REALIZACION[ESTADO_REALIZACION.POR_REALIZAR];
const ROJO = COLOR_REALIZACION[ESTADO_REALIZACION.NO_REALIZADA];
const TINTA_MUTED = '#898781';

const ESTADO_TECNICO = {
    OBSERVADO: 'Observado',
    PROGRAMADO: 'Programado',
    SIN_OBSERVAR: 'Sin observar'
};

const ESTILO_TECNICO = {
    [ESTADO_TECNICO.OBSERVADO]: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', icono: '✓' },
    [ESTADO_TECNICO.PROGRAMADO]: { chip: 'bg-blue-50 text-blue-700 border-blue-200', icono: '◷' },
    [ESTADO_TECNICO.SIN_OBSERVAR]: { chip: 'bg-red-50 text-red-700 border-red-200', icono: '✕' }
};

// Semaforo del taller contra el ritmo esperado: la meta es anual, asi que en
// septiembre no se exige el 100 % sino lo proporcional al año corrido.
const RITMO = {
    CUMPLE: { label: 'Cumple', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', icono: '✓' },
    AL_DIA: { label: 'Al día', chip: 'bg-blue-50 text-blue-700 border-blue-200', icono: '◷' },
    ATRASADO: { label: 'Atrasado', chip: 'bg-red-50 text-red-700 border-red-200', icono: '!' },
    NO_CUMPLIO: { label: 'No cumplió', chip: 'bg-red-50 text-red-700 border-red-200', icono: '✕' }
};

const pct = (v, t) => (t ? Math.round((v / t) * 100) : 0);

const chipBase = 'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap';

const ChipTecnico = ({ estado, veces }) => {
    const e = ESTILO_TECNICO[estado];
    return (
        <span className={`${chipBase} ${e.chip}`}>
            <span aria-hidden="true">{e.icono}</span>
            {estado === ESTADO_TECNICO.OBSERVADO && veces > 1 ? `${estado} ×${veces}` : estado}
        </span>
    );
};

const ChipRitmo = ({ ritmo }) => (
    <span className={`${chipBase} ${ritmo.chip}`}>
        <span aria-hidden="true">{ritmo.icono}</span>{ritmo.label}
    </span>
);

/** Fraccion del año ya transcurrida (0..1). Años pasados = 1, futuros = 0. */
const avanceDelAnio = (anio, ahora) => {
    const y = ahora.getFullYear();
    if (anio < y) return 1;
    if (anio > y) return 0;
    const inicio = new Date(anio, 0, 1);
    const fin = new Date(anio + 1, 0, 1);
    return (ahora - inicio) / (fin - inicio);
};

const ritmoDe = (porcentaje, anio, esperado, ahora) => {
    if (porcentaje >= 100) return RITMO.CUMPLE;
    if (anio < ahora.getFullYear()) return RITMO.NO_CUMPLIO;
    return porcentaje >= Math.round(esperado * 100) ? RITMO.AL_DIA : RITMO.ATRASADO;
};

/** Suma uno a la cuenta de `clave` dentro de un Map. */
const contar = (mapa, clave, n = 1) => mapa.set(clave, (mapa.get(clave) || 0) + n);

/** Las N claves con mas cuenta, de mayor a menor. */
const top = (mapa, n) => [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

// Barra de avance con una marca en lo esperado a la fecha: se lee de un
// vistazo si el taller va por delante o por detras del ritmo anual.
const BarraAvance = ({ porcentaje, esperado, color, alto = 'h-2.5' }) => (
    <div className={`relative ${alto} rounded-full bg-slate-100`}>
        <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${Math.min(porcentaje, 100)}%`, backgroundColor: color }}
        />
        {esperado > 0 && esperado < 1 && (
            <span
                className="absolute -top-1 -bottom-1 w-0.5 bg-slate-900/70 rounded"
                style={{ left: `${esperado * 100}%` }}
                title={`Esperado a la fecha: ${Math.round(esperado * 100)} %`}
            />
        )}
    </div>
);

const Kpi = ({ valor, label, nota, color }) => (
    <div className="bg-white rounded-2xl border border-slate-200 px-3 sm:px-4 py-3">
        <p className="text-xl sm:text-2xl font-bold tabular-nums leading-none" style={{ color: color || '#0b0b0b' }}>{valor}</p>
        <p className="text-[10px] font-bold uppercase tracking-wide mt-1.5 leading-tight" style={{ color: TINTA_MUTED }}>{label}</p>
        {nota && <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{nota}</p>}
    </div>
);

const Destacado = ({ titulo, valor, detalle }) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: TINTA_MUTED }}>{titulo}</p>
        <p className="text-xs font-bold text-slate-900 mt-0.5 truncate" title={valor}>{valor || '—'}</p>
        {detalle && <p className="text-[11px] text-slate-500">{detalle}</p>}
    </div>
);

const ORDENES_TALLER = [
    { id: 'cobertura', label: 'Menor cobertura' },
    { id: 'observaciones', label: 'Más observaciones' },
    { id: 'observados', label: 'Más técnicos observados' }
];

const FILTROS_TECNICO = [
    { id: '', label: 'Todos' },
    { id: ESTADO_TECNICO.SIN_OBSERVAR, label: 'Sin observar' },
    { id: ESTADO_TECNICO.PROGRAMADO, label: 'Programados' },
    { id: ESTADO_TECNICO.OBSERVADO, label: 'Observados' }
];

const FILAS_INICIALES = 25;

const CoberturaTecnicos = ({ observaciones, usuario }) => {
    const ahora = useAhora();
    const anioActual = ahora.getFullYear();
    const [anio, setAnio] = useState(anioActual);
    const [fTalleres, setFTalleres] = useState([]);
    const [ordenTaller, setOrdenTaller] = useState('cobertura');
    const [fTecnico, setFTecnico] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [verTodas, setVerTodas] = useState(false);
    const [tecnicoAbierto, setTecnicoAbierto] = useState(null);

    // Años con datos, mas el actual: la meta del año en curso existe aunque
    // todavia no haya ninguna observacion.
    const anios = useMemo(() => {
        const s = new Set([anioActual]);
        observaciones.forEach(o => { if (tecnicosDe(o).length && o.fecha) s.add(Number(o.fecha.slice(0, 4))); });
        return [...s].filter(Boolean).sort((a, b) => b - a);
    }, [observaciones, anioActual]);

    const esperado = avanceDelAnio(anio, ahora);

    // Observaciones del año que apuntan a tecnicos.
    const delAnio = useMemo(() => observaciones.filter(o =>
        esProgramada(o) && tecnicosDe(o).length && o.fecha?.startsWith(String(anio))
    ), [observaciones, anio]);

    const realizadas = useMemo(() => delAnio.filter(o => esRealizada(o)), [delAnio]);

    // Ficha por tecnico del catalogo. Los nombres que ya no esten en el
    // catalogo no cuentan: la meta se mide contra la nomina vigente.
    const fichas = useMemo(() => {
        const porNombre = new Map(TECNICOS.map(t => [t.nombre, {
            ...t,
            veces: 0,
            ultima: '',
            programado: false,
            observadores: new Map(),
            ppfs: new Map(),
            obsIds: []
        }]));

        realizadas.forEach(o => {
            tecnicosDe(o).forEach(nombre => {
                const f = porNombre.get(nombre);
                if (!f) return;
                f.veces += 1;
                if ((o.fecha || '') > f.ultima) f.ultima = o.fecha;
                observadoresDe(o).forEach(p => contar(f.observadores, p.nombre || p.email));
                ppfsDe(o).forEach(p => contar(f.ppfs, p));
                f.obsIds.push(o.id);
            });
        });

        delAnio.filter(o => estaPorRealizar(o, ahora)).forEach(o => {
            tecnicosDe(o).forEach(nombre => {
                const f = porNombre.get(nombre);
                if (!f) return;
                f.programado = true;
                f.obsIds.push(o.id);
            });
        });

        return [...porNombre.values()].map(f => ({
            ...f,
            estado: f.veces > 0
                ? ESTADO_TECNICO.OBSERVADO
                : f.programado ? ESTADO_TECNICO.PROGRAMADO : ESTADO_TECNICO.SIN_OBSERVAR
        }));
    }, [realizadas, delAnio, ahora]);

    const enAlcance = useMemo(
        () => (fTalleres.length ? fichas.filter(f => fTalleres.includes(f.taller)) : fichas),
        [fichas, fTalleres]
    );
    const realizadasEnAlcance = useMemo(
        () => (fTalleres.length
            ? realizadas.filter(o => tecnicosDe(o).some(n => enAlcance.some(f => f.nombre === n)))
            : realizadas),
        [realizadas, enAlcance, fTalleres]
    );

    // ---- cifras generales ----------------------------------------------------
    const totalTecnicos = enAlcance.length;
    const observados = enAlcance.filter(f => f.estado === ESTADO_TECNICO.OBSERVADO).length;
    const programados = enAlcance.filter(f => f.estado === ESTADO_TECNICO.PROGRAMADO).length;
    const sinObservar = totalTecnicos - observados - programados;
    const cobertura = pct(observados, totalTecnicos);
    const ritmoGeneral = ritmoDe(cobertura, anio, esperado, ahora);

    // Cuantos hay que observar por semana para cerrar el año en 100 %.
    const faltan = totalTecnicos - observados;
    const semanasRestantes = anio === anioActual
        ? Math.max(Math.ceil((new Date(anio + 1, 0, 1) - ahora) / (7 * 86400000)), 1)
        : 0;
    const porSemana = semanasRestantes ? Math.ceil(faltan / semanasRestantes) : 0;

    // ---- por taller ----------------------------------------------------------
    const talleres = useMemo(() => {
        const lista = TALLERES
            .filter(t => !fTalleres.length || fTalleres.includes(t))
            .map(taller => {
                const suyas = fichas.filter(f => f.taller === taller);
                const obs = suyas.filter(f => f.estado === ESTADO_TECNICO.OBSERVADO).length;
                const prog = suyas.filter(f => f.estado === ESTADO_TECNICO.PROGRAMADO).length;
                const nombres = new Set(suyas.map(f => f.nombre));
                const nObservaciones = realizadas.filter(o => tecnicosDe(o).some(n => nombres.has(n))).length;
                const porcentaje = pct(obs, suyas.length);
                return {
                    taller,
                    total: suyas.length,
                    observados: obs,
                    programados: prog,
                    observaciones: nObservaciones,
                    porcentaje,
                    ritmo: ritmoDe(porcentaje, anio, esperado, ahora)
                };
            });
        const orden = {
            cobertura: (a, b) => a.porcentaje - b.porcentaje || b.total - a.total,
            observaciones: (a, b) => b.observaciones - a.observaciones || b.porcentaje - a.porcentaje,
            observados: (a, b) => b.observados - a.observados || b.porcentaje - a.porcentaje
        }[ordenTaller];
        return lista.sort(orden);
    }, [fichas, realizadas, fTalleres, ordenTaller, anio, esperado, ahora]);

    const masObservaciones = [...talleres].sort((a, b) => b.observaciones - a.observaciones)[0];
    const masObservados = [...talleres].sort((a, b) => b.observados - a.observados)[0];
    const masRezagado = [...talleres].sort((a, b) => a.porcentaje - b.porcentaje || b.total - a.total)[0];
    const talleresCumplen = talleres.filter(t => t.porcentaje >= 100).length;

    // ---- observadores (supervisores) -------------------------------------------
    const observadores = useMemo(() => {
        const nombresEnAlcance = new Set(enAlcance.map(f => f.nombre));
        const tallerDe = new Map(TECNICOS.map(t => [t.nombre, t.taller]));
        const porCorreo = new Map();
        realizadasEnAlcance.forEach(o => {
            const suyos = tecnicosDe(o).filter(n => nombresEnAlcance.has(n));
            observadoresDe(o).forEach(p => {
                const clave = normalizarCorreo(p.email) || p.nombre;
                const r = porCorreo.get(clave) || { nombre: p.nombre || p.email, observaciones: 0, tecnicos: new Set(), talleres: new Set() };
                r.observaciones += 1;
                suyos.forEach(n => { r.tecnicos.add(n); r.talleres.add(tallerDe.get(n)); });
                porCorreo.set(clave, r);
            });
        });
        return [...porCorreo.values()].sort((a, b) => b.tecnicos.size - a.tecnicos.size || b.observaciones - a.observaciones);
    }, [realizadasEnAlcance, enAlcance]);

    // ---- PPF observados en tecnicos ------------------------------------------
    // Cada tecnico observado cuenta una vez por cada PPF de su observacion: asi
    // se ve en que protocolos se esta observando a la gente.
    const ppfs = useMemo(() => {
        const nombresEnAlcance = new Set(enAlcance.map(f => f.nombre));
        const veces = new Map();
        const distintos = new Map();
        realizadasEnAlcance.forEach(o => {
            const suyos = tecnicosDe(o).filter(n => nombresEnAlcance.has(n));
            ppfsDe(o).forEach(p => {
                contar(veces, p, suyos.length);
                const s = distintos.get(p) || new Set();
                suyos.forEach(n => s.add(n));
                distintos.set(p, s);
            });
        });
        return top(veces, 12).map(([ppf, n]) => ({ ppf, veces: n, tecnicos: distintos.get(ppf).size }));
    }, [realizadasEnAlcance, enAlcance]);
    const maxPpf = Math.max(...ppfs.map(p => p.veces), 1);

    // ---- tabla de tecnicos ---------------------------------------------------
    const filasTecnicos = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        const peso = { [ESTADO_TECNICO.SIN_OBSERVAR]: 0, [ESTADO_TECNICO.PROGRAMADO]: 1, [ESTADO_TECNICO.OBSERVADO]: 2 };
        return enAlcance
            .filter(f => !fTecnico || f.estado === fTecnico)
            .filter(f => !q || f.nombre.toLowerCase().includes(q) || f.taller.toLowerCase().includes(q)
                || [...f.observadores.keys()].some(n => n.toLowerCase().includes(q)))
            // Lo pendiente primero: es lo que hay que salir a observar.
            .sort((a, b) => peso[a.estado] - peso[b.estado] || a.taller.localeCompare(b.taller) || a.nombre.localeCompare(b.nombre));
    }, [enAlcance, fTecnico, busqueda]);
    const visibles = verTodas ? filasTecnicos : filasTecnicos.slice(0, FILAS_INICIALES);

    const fichaAbierta = tecnicoAbierto ? fichas.find(f => f.nombre === tecnicoAbierto) : null;
    const obsDelTecnico = useMemo(
        () => (fichaAbierta ? observaciones.filter(o => fichaAbierta.obsIds.includes(o.id)) : []),
        [fichaAbierta, observaciones]
    );

    const alternarTaller = (t) => setFTalleres(actual => (actual.includes(t) ? actual.filter(x => x !== t) : [...actual, t]));

    return (
        <section className="rounded-2xl border-2 border-yellow-300 bg-yellow-50/40 p-3 sm:p-5 mb-6">
            {/* ---- Encabezado y filtros propios ---- */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-base">Cobertura de técnicos observados</h3>
                    <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
                        Cada técnico debe ser observado por un supervisor <b>por lo menos una vez al año</b>, en cualquier PPF.
                        Cuenta como observado cuando la observación programada quedó <b>realizada</b>.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
                        {anios.map(a => (
                            <button
                                key={a}
                                onClick={() => { setAnio(a); setTecnicoAbierto(null); }}
                                aria-pressed={anio === a}
                                className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${
                                    anio === a ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {a}
                            </button>
                        ))}
                    </div>
                    <SelectorMultiple
                        multiple
                        opciones={TALLERES}
                        valor={fTalleres}
                        onChange={setFTalleres}
                        etiquetaVacia="Todos los talleres"
                        ancho="w-full sm:w-64"
                    />
                </div>
            </div>

            {/* ---- Cifras generales ---- */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
                <div className="flex flex-wrap items-end justify-between gap-4 mb-3">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: TINTA_MUTED }}>
                            Cumplimiento {anio}{fTalleres.length ? ` · ${fTalleres.length} taller${fTalleres.length > 1 ? 'es' : ''}` : ''}
                        </p>
                        <p className="text-4xl font-bold leading-none tabular-nums mt-1" style={{ color: cobertura >= 100 ? TINTA_REALIZACION[ESTADO_REALIZACION.REALIZADA] : '#0b0b0b' }}>
                            {cobertura}<span className="text-xl text-slate-400"> %</span>
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                            <b className="tabular-nums">{observados}</b> de <b className="tabular-nums">{totalTecnicos}</b> técnicos observados
                        </p>
                    </div>
                    <div className="text-right">
                        <ChipRitmo ritmo={ritmoGeneral} />
                        {anio === anioActual && (
                            <p className="text-[11px] text-slate-500 mt-1">
                                Esperado a la fecha: <b className="tabular-nums">{Math.round(esperado * 100)} %</b>
                            </p>
                        )}
                    </div>
                </div>
                <BarraAvance porcentaje={cobertura} esperado={esperado} color={cobertura >= Math.round(esperado * 100) ? VERDE : ROJO} alto="h-3" />
                <p className="text-[10px] text-slate-400 mt-1.5">La marca negra es lo que debería llevarse observado según el avance del año.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-4">
                <Kpi valor={observados} label="Observados" color={TINTA_REALIZACION[ESTADO_REALIZACION.REALIZADA]} nota="al menos una vez" />
                <Kpi valor={sinObservar} label="Sin observar" color={TINTA_REALIZACION[ESTADO_REALIZACION.NO_REALIZADA]} nota="ni programados" />
                <Kpi valor={programados} label="Programados" color={TINTA_REALIZACION[ESTADO_REALIZACION.POR_REALIZAR]} nota="con observación por realizar" />
                <Kpi valor={realizadasEnAlcance.length} label="Observaciones" nota={`realizadas en ${anio}`} />
                <Kpi valor={`${talleresCumplen}/${talleres.length}`} label="Talleres al 100 %" />
                <Kpi
                    valor={anio === anioActual ? (faltan ? porSemana : '✓') : faltan}
                    label={anio === anioActual ? 'Por semana' : 'Quedaron sin observar'}
                    nota={anio === anioActual ? (faltan ? `para cerrar ${anio} al 100 % (${semanasRestantes} sem.)` : 'meta cumplida') : undefined}
                />
            </div>

            {/* ---- Por taller ---- */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div>
                        <h4 className="font-bold text-slate-900 text-sm">Cobertura por taller</h4>
                        <p className="text-xs text-slate-500">Clic en un taller para filtrar todo el bloque.</p>
                    </div>
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
                        {ORDENES_TALLER.map(o => (
                            <button
                                key={o.id}
                                onClick={() => setOrdenTaller(o.id)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                                    ordenTaller === o.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-2 mb-4">
                    <Destacado
                        titulo="Más observaciones"
                        valor={masObservaciones?.observaciones ? masObservaciones.taller : ''}
                        detalle={masObservaciones?.observaciones ? `${masObservaciones.observaciones} observaciones` : 'Sin observaciones aún'}
                    />
                    <Destacado
                        titulo="Más técnicos observados"
                        valor={masObservados?.observados ? masObservados.taller : ''}
                        detalle={masObservados?.observados ? `${masObservados.observados} de ${masObservados.total} técnicos` : 'Ninguno aún'}
                    />
                    <Destacado
                        titulo="Más rezagado"
                        valor={masRezagado?.taller}
                        detalle={masRezagado ? `${masRezagado.porcentaje} % · faltan ${masRezagado.total - masRezagado.observados}` : ''}
                    />
                </div>

                <ul className="space-y-1">
                    {talleres.map(t => (
                        <li key={t.taller}>
                            <button
                                type="button"
                                onClick={() => alternarTaller(t.taller)}
                                aria-pressed={fTalleres.includes(t.taller)}
                                className={`w-full text-left rounded-lg px-2 py-2 transition cursor-pointer ${
                                    fTalleres.includes(t.taller) ? 'bg-slate-100 ring-1 ring-slate-900' : 'hover:bg-slate-50'
                                }`}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-1.5">
                                    <span className="text-xs font-semibold text-slate-800 min-w-0 truncate">{t.taller}</span>
                                    <span className="flex items-center gap-2 shrink-0">
                                        <span className="text-[11px] text-slate-500 tabular-nums">
                                            {t.observaciones} obs.
                                        </span>
                                        <span className="text-xs font-bold text-slate-900 tabular-nums">
                                            {t.observados}/{t.total} · {t.porcentaje} %
                                        </span>
                                        <ChipRitmo ritmo={t.ritmo} />
                                    </span>
                                </div>
                                <BarraAvance
                                    porcentaje={t.porcentaje}
                                    esperado={esperado}
                                    color={t.porcentaje >= 100 ? VERDE : t.ritmo === RITMO.AL_DIA ? AZUL : ROJO}
                                />
                                {t.programados > 0 && (
                                    <p className="text-[10px] text-blue-700 mt-1">◷ {t.programados} con observación programada</p>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            {/* ---- Observadores y PPF ---- */}
            <div className="grid lg:grid-cols-2 gap-3 mb-3">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm">Observadores</h4>
                    <p className="text-xs text-slate-500 mb-3">Cuántos técnicos distintos ha observado cada supervisor en {anio}.</p>
                    {observadores.length === 0 ? (
                        <p className="text-sm text-slate-400 py-6 text-center">Todavía no hay observaciones realizadas con técnicos.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[10px] uppercase text-slate-500 text-left border-b border-slate-200">
                                        <th className="py-2 font-bold">Observador</th>
                                        <th className="py-2 font-bold text-right">Técnicos</th>
                                        <th className="py-2 font-bold text-right">Obs.</th>
                                        <th className="py-2 font-bold text-right">Talleres</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {observadores.map(o => (
                                        <tr key={o.nombre}>
                                            <td className="py-2 text-slate-800 text-xs font-semibold">{o.nombre}</td>
                                            <td className="py-2 text-right font-bold text-slate-900 tabular-nums">{o.tecnicos.size}</td>
                                            <td className="py-2 text-right text-slate-600 tabular-nums">{o.observaciones}</td>
                                            <td className="py-2 text-right text-slate-600 tabular-nums" title={[...o.talleres].join(', ')}>{o.talleres.size}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm">PPF más observados en técnicos</h4>
                    <p className="text-xs text-slate-500 mb-3">Veces que se observó a un técnico en cada protocolo.</p>
                    {ppfs.length === 0 ? (
                        <p className="text-sm text-slate-400 py-6 text-center">Sin datos para este año.</p>
                    ) : (
                        <ul className="space-y-2.5">
                            {ppfs.map(p => (
                                <li key={p.ppf}>
                                    <div className="flex items-baseline justify-between gap-3 mb-1">
                                        <span className="text-xs text-slate-700 truncate">{p.ppf}</span>
                                        <span className="text-xs font-bold text-slate-900 tabular-nums shrink-0">
                                            {p.veces}
                                            <span className="text-slate-400 font-normal"> · {p.tecnicos} técnico{p.tecnicos === 1 ? '' : 's'}</span>
                                        </span>
                                    </div>
                                    <div className="h-2.5 rounded bg-slate-100 overflow-hidden">
                                        <div className="h-full rounded" style={{ width: `${(p.veces / maxPpf) * 100}%`, backgroundColor: AZUL }} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* ---- Tecnicos uno por uno ---- */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm">Técnicos</h4>
                        <p className="text-xs text-slate-500">Primero los que faltan. Clic en un técnico para ver sus observaciones.</p>
                    </div>
                    <input
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar técnico, taller u observador..."
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 bg-white sm:w-72"
                    />
                </div>
                <div className="flex gap-1 overflow-x-auto -mx-1 px-1 mb-3">
                    {FILTROS_TECNICO.map(f => {
                        const n = f.id ? enAlcance.filter(x => x.estado === f.id).length : enAlcance.length;
                        return (
                            <button
                                key={f.id || 'todos'}
                                onClick={() => setFTecnico(f.id)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition cursor-pointer ${
                                    fTecnico === f.id
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                                }`}
                            >
                                {f.label} <span className="tabular-nums opacity-70">{n}</span>
                            </button>
                        );
                    })}
                </div>

                {filasTecnicos.length === 0 ? (
                    <p className="text-sm text-slate-400 py-6 text-center">Ningún técnico cumple este filtro.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[10px] uppercase text-slate-500 text-left border-b border-slate-200">
                                    <th className="py-2 pr-3 font-bold">Técnico</th>
                                    <th className="py-2 pr-3 font-bold">Estado</th>
                                    <th className="py-2 pr-3 font-bold text-right">Veces</th>
                                    <th className="py-2 pr-3 font-bold">Última</th>
                                    <th className="py-2 pr-3 font-bold">Observado por</th>
                                    <th className="py-2 font-bold">PPF</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {visibles.map(f => (
                                    <tr
                                        key={f.nombre}
                                        onClick={() => setTecnicoAbierto(actual => (actual === f.nombre ? null : f.nombre))}
                                        className={`cursor-pointer hover:bg-slate-50 ${tecnicoAbierto === f.nombre ? 'bg-yellow-50' : ''}`}
                                    >
                                        <td className="py-2 pr-3 align-top min-w-[180px]">
                                            <span className="block text-xs font-semibold text-slate-800">{f.nombre}</span>
                                            <span className="block text-[10px] text-slate-400">{f.taller}</span>
                                        </td>
                                        <td className="py-2 pr-3 align-top"><ChipTecnico estado={f.estado} veces={f.veces} /></td>
                                        <td className="py-2 pr-3 align-top text-right font-bold text-slate-900 tabular-nums">{f.veces}</td>
                                        <td className="py-2 pr-3 align-top text-xs text-slate-600 whitespace-nowrap">{f.ultima || '—'}</td>
                                        <td className="py-2 pr-3 align-top text-xs text-slate-600 min-w-[140px]">
                                            {f.observadores.size ? top(f.observadores, 3).map(([n, c]) => `${n}${c > 1 ? ` (${c})` : ''}`).join(', ') : '—'}
                                        </td>
                                        <td className="py-2 align-top text-[11px] text-slate-600 min-w-[140px]">
                                            {f.ppfs.size ? top(f.ppfs, 2).map(([p]) => p).join(' · ') : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {filasTecnicos.length > FILAS_INICIALES && (
                    <button
                        onClick={() => setVerTodas(v => !v)}
                        className="mt-3 text-xs font-bold text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                    >
                        {verTodas ? 'Ver menos' : `Ver los ${filasTecnicos.length} técnicos`}
                    </button>
                )}
            </div>

            {fichaAbierta && (
                <div className="mt-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                        <h4 className="font-bold text-slate-900 text-sm">
                            Observaciones de {fichaAbierta.nombre} en {anio}
                        </h4>
                        <button
                            onClick={() => setTecnicoAbierto(null)}
                            className="text-[11px] font-bold text-slate-500 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                        >
                            Cerrar
                        </button>
                    </div>
                    <ListaObservaciones
                        observaciones={obsDelTecnico}
                        todas={observaciones}
                        usuario={usuario}
                        vacio={`${fichaAbierta.nombre} no tiene observaciones en ${anio}`}
                    />
                </div>
            )}
        </section>
    );
};

export default CoberturaTecnicos;
