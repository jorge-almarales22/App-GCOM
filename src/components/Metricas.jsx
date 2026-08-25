import React, { useState, useMemo } from 'react';
import ListaObservaciones from './ListaObservaciones';
import {
    hoyISO,
    estadoDe,
    esRealizada,
    esProgramada,
    programacionDe,
    estaVencida
} from '../utils/storage';
import {
    PPF,
    ESTADOS,
    ESTADO_REALIZACION,
    COLOR_REALIZACION,
    TINTA_REALIZACION,
    PROGRAMACION,
    COLOR_PROGRAMACION,
    TINTA_PROGRAMACION
} from '../data/constants';

// ---------------------------------------------------------------------------
// Tablero de metricas.
//
// La base son las observaciones PROGRAMADAS: ellas son el 100 % del compromiso
// y contra ellas se mide el cumplimiento. Una no programada que si se ejecuto
// suma como trabajo hecho (aparece aparte, nunca disfrazada de programada), y
// una no programada que nadie cerro no cuenta para nada: ni meta ni logro.
//
// Las graficas no solo muestran: filtran. Al hacer clic en una barra el tablero
// entero se recorta a ese valor, como en Power BI, y el clic sobre lo ya
// seleccionado lo deshace.
//
// Paletas: los dos estados usan COLOR_REALIZACION (verde/rojo, validados en
// constants.js). Los cortes binarios usan azul/naranja y azul/rojo, que pasan
// las mismas comprobaciones sobre fondo blanco:
//   azul vs naranja -> CVD ΔE 24.7 · azul vs rojo -> CVD ΔE 23.8
// ---------------------------------------------------------------------------
const AZUL = '#2a78d6';
const NARANJA = '#eb6834';
const ROJO = '#d03b3b';

const TINTA_MUTED = '#898781';

const ORDEN_ESTADOS = [ESTADO_REALIZACION.REALIZADA, ESTADO_REALIZACION.NO_REALIZADA];

const ICONO_ESTADO = {
    [ESTADO_REALIZACION.REALIZADA]: '✓',
    [ESTADO_REALIZACION.NO_REALIZADA]: '✕'
};

const pct = (v, t) => (t ? Math.round((v / t) * 100) : 0);

const ayerISO = () => hoyISO(new Date(Date.now() - 86400000));

// Rangos rapidos. "Este mes" es el predeterminado: el cumplimiento se lee por
// periodo cerrado, y un solo dia no dice nada de la gestion del area.
const RANGOS = {
    ayer: () => ({ desde: ayerISO(), hasta: ayerISO() }),
    hoy: () => ({ desde: hoyISO(), hasta: hoyISO() }),
    mes: () => {
        const h = new Date();
        const p = (n) => String(n).padStart(2, '0');
        return {
            desde: `${h.getFullYear()}-${p(h.getMonth() + 1)}-01`,
            hasta: hoyISO(new Date(h.getFullYear(), h.getMonth() + 1, 0))
        };
    },
    anio: () => {
        const a = new Date().getFullYear();
        return { desde: `${a}-01-01`, hasta: `${a}-12-31` };
    },
    todo: () => ({ desde: '', hasta: '' })
};

const RANGOS_UI = [
    ['ayer', 'Ayer'],
    ['hoy', 'Hoy'],
    ['mes', 'Este mes'],
    ['anio', 'Este año'],
    ['todo', 'Todo']
];

// Tinta legible para la cantidad impresa dentro de un segmento: blanco sobre
// relleno oscuro, casi negro sobre relleno claro.
const tintaSobre = (hex) => {
    const c = hex.replace('#', '');
    const canal = (i) => {
        const v = parseInt(c.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const L = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
    return L > 0.42 ? '#1a1a1a' : '#ffffff';
};

// Barra apilada horizontal: parte-de-un-todo con marcas finas, 2px de
// superficie entre segmentos (nunca un borde) y extremos redondeados. La
// cantidad va impresa dentro del segmento cuando cabe; si no, sigue en la
// leyenda y en la vista de tabla. Con `onSegmento` cada segmento filtra.
const BarraApilada = ({ segmentos, total, alto = 'h-5', onSegmento, activo }) => (
    <div className={`flex ${alto} gap-[2px] rounded bg-slate-100 overflow-hidden`}>
        {total === 0 && <div className="w-full" />}
        {segmentos.filter(s => s.valor > 0).map(s => {
            const porcentaje = (s.valor / total) * 100;
            const contenido = porcentaje >= 7 && (
                <span className="text-[10px] font-bold leading-none tabular-nums" style={{ color: tintaSobre(s.color) }}>
                    {s.valor}
                </span>
            );
            const estilo = {
                width: `${porcentaje}%`,
                backgroundColor: s.color,
                opacity: activo && activo !== s.label ? 0.35 : 1
            };
            const clase = 'h-full grid place-items-center overflow-hidden first:rounded-l last:rounded-r transition-[width,opacity] duration-300';
            const titulo = `${s.label}: ${s.valor} (${pct(s.valor, total)}%)`;

            return onSegmento ? (
                <button
                    key={s.label}
                    type="button"
                    onClick={() => onSegmento(s.label)}
                    title={`${titulo} · clic para filtrar`}
                    aria-pressed={activo === s.label}
                    style={estilo}
                    className={`${clase} cursor-pointer hover:brightness-110`}
                >
                    {contenido}
                </button>
            ) : (
                <div key={s.label} title={titulo} style={estilo} className={clase}>{contenido}</div>
            );
        })}
    </div>
);

/** Leyenda: identidad por icono + texto, nunca por color solo. */
const Leyenda = ({ segmentos, total, onSeleccionar, activo }) => (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segmentos.map(s => {
            const contenido = (
                <>
                    <i className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ background: s.color }} />
                    <span aria-hidden="true" className="text-slate-400">{s.icono}</span>
                    {s.label}
                    <b className="text-slate-900 tabular-nums">{s.valor}</b>
                    {total > 0 && <span className="text-slate-400 tabular-nums">· {pct(s.valor, total)}%</span>}
                </>
            );
            const clase = `inline-flex items-center gap-1.5 text-xs ${
                activo === s.label ? 'text-slate-900 font-semibold' : 'text-slate-600'
            }`;
            return onSeleccionar ? (
                <button
                    key={s.label}
                    type="button"
                    onClick={() => onSeleccionar(s.label)}
                    aria-pressed={activo === s.label}
                    className={`${clase} cursor-pointer hover:text-slate-900`}
                >
                    {contenido}
                </button>
            ) : (
                <span key={s.label} className={clase}>{contenido}</span>
            );
        })}
    </div>
);

// Barras horizontales simples para los cortes binarios. Cada barra es un filtro.
const BarrasH = ({ datos, total, onSeleccionar, activo, vacio = 'Sin datos para este filtro.' }) => {
    const max = Math.max(...datos.map(d => d.valor), 1);
    return datos.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">{vacio}</p>
    ) : (
        <ul className="space-y-3">
            {datos.map(d => {
                const atenuada = activo && activo !== d.label;
                return (
                    <li key={d.label}>
                        <button
                            type="button"
                            onClick={() => onSeleccionar?.(d.label)}
                            aria-pressed={activo === d.label}
                            title={`${d.label}: ${d.valor} · ${pct(d.valor, total)}%${onSeleccionar ? ' · clic para filtrar' : ''}`}
                            className={`w-full text-left ${onSeleccionar ? 'cursor-pointer group' : 'cursor-default'}`}
                        >
                            <div className="flex items-baseline justify-between gap-3 mb-1">
                                <span className={`text-xs truncate ${activo === d.label ? 'text-slate-900 font-semibold' : 'text-slate-700'}`}>
                                    {d.label}
                                </span>
                                <span className="text-xs font-bold text-slate-900 tabular-nums shrink-0">
                                    {d.valor}
                                    {total > 0 && <span className="text-slate-400 font-normal"> · {pct(d.valor, total)}%</span>}
                                </span>
                            </div>
                            <div className="h-5 rounded bg-slate-100 overflow-hidden">
                                <div
                                    className="h-full rounded grid place-items-center overflow-hidden transition-[width,opacity] duration-300 group-hover:brightness-110"
                                    style={{
                                        width: `${Math.max((d.valor / max) * 100, d.valor ? 8 : 0)}%`,
                                        backgroundColor: d.color,
                                        opacity: atenuada ? 0.35 : 1
                                    }}
                                >
                                    {d.valor > 0 && (
                                        <span className="text-[10px] font-bold leading-none tabular-nums" style={{ color: tintaSobre(d.color) }}>
                                            {d.valor}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};

// Gemelo en tabla: ningun valor queda accesible solo por color.
const TablaDatos = ({ datos, total, onSeleccionar, activo }) => (
    datos.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">Sin datos para este filtro.</p>
    ) : (
        <table className="w-full text-sm">
            <thead>
                <tr className="text-[10px] uppercase text-slate-500 text-left border-b border-slate-200">
                    <th className="py-2 font-bold">Categoría</th>
                    <th className="py-2 font-bold text-right">Obs.</th>
                    <th className="py-2 font-bold text-right">%</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {datos.map(d => (
                    <tr
                        key={d.label}
                        onClick={() => onSeleccionar?.(d.label)}
                        className={`${onSeleccionar ? 'cursor-pointer hover:bg-slate-50' : ''} ${activo === d.label ? 'bg-slate-50' : ''}`}
                    >
                        <td className="py-2 text-slate-700">{d.label}</td>
                        <td className="py-2 text-right font-bold text-slate-900 tabular-nums">{d.valor}</td>
                        <td className="py-2 text-right text-slate-500 tabular-nums">{pct(d.valor, total)}%</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
);

const Tile = ({ label, valor, color, nota }) => (
    <div className="bg-white rounded-2xl border border-slate-200 px-3 sm:px-5 py-3 sm:py-4">
        <p className="text-xl sm:text-3xl font-bold tabular-nums" style={{ color: color || '#0b0b0b' }}>{valor}</p>
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide mt-1 leading-tight" style={{ color: TINTA_MUTED }}>
            {label}
        </p>
        {nota && <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{nota}</p>}
    </div>
);

/** Filtro activo, con su propia X para quitarlo sin buscar el control original. */
const ChipFiltro = ({ campo, valor, onQuitar }) => (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-slate-900 text-white rounded-full pl-2.5 pr-1.5 py-1">
        <span className="text-slate-400 font-normal">{campo}:</span>
        <span className="max-w-[180px] truncate">{valor}</span>
        <button
            type="button"
            onClick={onQuitar}
            aria-label={`Quitar filtro ${campo}`}
            className="w-4 h-4 grid place-items-center rounded-full hover:bg-white/20 cursor-pointer"
        >
            ×
        </button>
    </span>
);

const Metricas = ({ observaciones, superintendencias, usuario }) => {
    const rangoMes = RANGOS.mes();
    const [desde, setDesde] = useState(rangoMes.desde);
    const [hasta, setHasta] = useState(rangoMes.hasta);
    const [fPpf, setFPpf] = useState('');
    const [fSuper, setFSuper] = useState('');
    const [fRutinario, setFRutinario] = useState('');
    const [fEstado, setFEstado] = useState('');
    const [fRealizacion, setFRealizacion] = useState('');
    const [fProgramacion, setFProgramacion] = useState('');
    const [comoTabla, setComoTabla] = useState(false);

    const aplicarRango = (id) => {
        const { desde: d, hasta: h } = RANGOS[id]();
        setDesde(d);
        setHasta(h);
    };

    const rangoActivo = RANGOS_UI.find(([id]) => {
        const r = RANGOS[id]();
        return r.desde === desde && r.hasta === hasta;
    })?.[0];

    // Alternar: volver a hacer clic sobre lo ya filtrado lo quita. Es lo que
    // espera quien viene de Power BI.
    const alternar = (set) => (valor) => set(actual => (actual === valor ? '' : valor));
    const alternarRealizacion = alternar(setFRealizacion);
    const alternarRutinario = alternar(setFRutinario);
    const alternarHallazgos = alternar(setFEstado);
    const alternarProgramacion = alternar(setFProgramacion);

    const limpiarFiltros = () => {
        setFPpf(''); setFSuper(''); setFRutinario(''); setFEstado(''); setFRealizacion(''); setFProgramacion('');
    };

    const filtrosActivos = [
        fPpf && { campo: 'PPF', valor: fPpf, quitar: () => setFPpf('') },
        fSuper && { campo: 'Superintendencia', valor: fSuper, quitar: () => setFSuper('') },
        fRutinario && { campo: 'Rutinario', valor: fRutinario, quitar: () => setFRutinario('') },
        fEstado && { campo: 'Hallazgos', valor: fEstado, quitar: () => setFEstado('') },
        fRealizacion && { campo: 'Estado', valor: fRealizacion, quitar: () => setFRealizacion('') },
        fProgramacion && { campo: 'Tipo', valor: fProgramacion, quitar: () => setFProgramacion('') }
    ].filter(Boolean);

    const datos = useMemo(() => observaciones.filter(o => {
        if (desde && o.fecha < desde) return false;
        if (hasta && o.fecha > hasta) return false;
        if (fPpf && o.ppf !== fPpf) return false;
        if (fSuper && o.superintendencia !== fSuper) return false;
        if (fRutinario && o.rutinario !== fRutinario) return false;
        if (fEstado && o.estado !== fEstado) return false;
        if (fRealizacion && estadoDe(o) !== fRealizacion) return false;
        if (fProgramacion && programacionDe(o) !== fProgramacion) return false;
        return true;
    }), [observaciones, desde, hasta, fPpf, fSuper, fRutinario, fEstado, fRealizacion, fProgramacion]);

    // --- La base del tablero: lo programado ---------------------------------
    const programadas = useMemo(() => datos.filter(esProgramada), [datos]);
    const noProgramadas = useMemo(() => datos.filter(o => !esProgramada(o)), [datos]);
    const realizadasProg = programadas.filter(esRealizada).length;
    const noRealizadasProg = programadas.length - realizadasProg;
    const noProgRealizadas = noProgramadas.filter(esRealizada).length;

    // Exigible hasta hoy: lo que ya vencio mas lo que se cerro antes de tiempo.
    // Sin esto, programar el mes completo el dia 1 hunde el cumplimiento a 0 %.
    const exigibles = programadas.filter(o => esRealizada(o) || estaVencida(o)).length;

    const cumplimientoTotal = pct(realizadasProg, programadas.length);
    const cumplimientoReal = pct(realizadasProg, exigibles);
    const cumplimientoConAporte = pct(realizadasProg + noProgRealizadas, programadas.length);

    const totalHallazgos = datos.reduce((n, o) => n + (o.hallazgos?.length || 0), 0);

    // Lo que cuenta como trabajo hecho o comprometido: todo lo programado mas
    // las no programadas que si se ejecutaron. Es la poblacion de las graficas
    // de corte, para que una no programada realizada sume igual que una
    // programada, tal como se pidio.
    const contables = useMemo(
        () => [...programadas, ...noProgramadas.filter(esRealizada)],
        [programadas, noProgramadas]
    );

    const segmentosCumplimiento = [
        { label: ESTADO_REALIZACION.REALIZADA, icono: ICONO_ESTADO[ESTADO_REALIZACION.REALIZADA], color: COLOR_REALIZACION[ESTADO_REALIZACION.REALIZADA], valor: realizadasProg },
        { label: ESTADO_REALIZACION.NO_REALIZADA, icono: ICONO_ESTADO[ESTADO_REALIZACION.NO_REALIZADA], color: COLOR_REALIZACION[ESTADO_REALIZACION.NO_REALIZADA], valor: noRealizadasProg }
    ];

    const porRutinario = [
        { label: 'Rutinarias', valorFiltro: 'Sí', valor: contables.filter(o => o.rutinario === 'Sí').length, color: AZUL },
        { label: 'No rutinarias', valorFiltro: 'No', valor: contables.filter(o => o.rutinario === 'No').length, color: NARANJA }
    ];
    const conHallazgos = contables.filter(o => o.estado === ESTADOS.CON_HALLAZGOS).length;
    const porHallazgos = [
        { label: ESTADOS.SIN_HALLAZGOS, valor: contables.length - conHallazgos, color: AZUL },
        { label: ESTADOS.CON_HALLAZGOS, valor: conHallazgos, color: ROJO }
    ];
    const porProgramacion = [
        { label: PROGRAMACION.PROGRAMADA, valor: programadas.length, color: COLOR_PROGRAMACION[PROGRAMACION.PROGRAMADA] },
        { label: PROGRAMACION.NO_PROGRAMADA, valor: noProgramadas.length, color: COLOR_PROGRAMACION[PROGRAMACION.NO_PROGRAMADA] }
    ];

    // Lo mas reciente arriba: es lo que se acaba de registrar.
    const filas = useMemo(() => [...datos].sort((a, b) =>
        a.fecha === b.fecha
            ? (b.hora || '').localeCompare(a.hora || '')
            : (b.fecha || '').localeCompare(a.fecha || '')
    ), [datos]);

    const selectCls = 'rounded-lg border border-slate-300 px-2.5 py-2 text-xs outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 bg-white w-full sm:w-auto sm:max-w-[190px]';
    const Vista = comoTabla ? TablaDatos : BarrasH;

    const etiquetaRutinario = fRutinario ? porRutinario.find(d => d.valorFiltro === fRutinario)?.label : '';

    return (
        <div>
            <div className="mb-5">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Gráficas y métricas</h2>
                <p className="text-sm text-slate-500 mt-1">
                    El cumplimiento se mide sobre las <strong>observaciones programadas</strong>. Haz clic en una barra
                    para filtrar todo el tablero.
                </p>
            </div>

            {/* Una sola fila de filtros para todo el tablero. */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 mb-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    {RANGOS_UI.map(([id, label]) => (
                        <button
                            key={id}
                            onClick={() => aplicarRango(id)}
                            aria-pressed={rangoActivo === id}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                                rangoActivo === id ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                    <span className="hidden sm:inline text-xs text-slate-400 mx-1">|</span>
                    <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={`${selectCls} !w-auto`} />
                    <span className="text-xs text-slate-400">a</span>
                    <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={`${selectCls} !w-auto`} />

                    <button
                        onClick={() => setComoTabla(v => !v)}
                        className="sm:ml-auto px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 hover:bg-slate-50 text-slate-700 cursor-pointer"
                    >
                        {comoTabla ? 'Ver gráficas' : 'Ver como tabla'}
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                    <select value={fPpf} onChange={e => setFPpf(e.target.value)} className={selectCls}>
                        <option value="">Todos los PPF</option>
                        {PPF.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={fSuper} onChange={e => setFSuper(e.target.value)} className={selectCls}>
                        <option value="">Todas las superintendencias</option>
                        {superintendencias.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={fRutinario} onChange={e => setFRutinario(e.target.value)} className={selectCls}>
                        <option value="">Rutinario: todos</option>
                        <option value="Sí">Solo rutinarias</option>
                        <option value="No">Solo no rutinarias</option>
                    </select>
                    <select value={fEstado} onChange={e => setFEstado(e.target.value)} className={selectCls}>
                        <option value="">Hallazgos: todos</option>
                        <option value={ESTADOS.SIN_HALLAZGOS}>{ESTADOS.SIN_HALLAZGOS}</option>
                        <option value={ESTADOS.CON_HALLAZGOS}>{ESTADOS.CON_HALLAZGOS}</option>
                    </select>
                    <select value={fRealizacion} onChange={e => setFRealizacion(e.target.value)} className={selectCls}>
                        <option value="">Estado: todos</option>
                        {ORDEN_ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <select value={fProgramacion} onChange={e => setFProgramacion(e.target.value)} className={selectCls}>
                        <option value="">Tipo: todas</option>
                        <option value={PROGRAMACION.PROGRAMADA}>Solo programadas</option>
                        <option value={PROGRAMACION.NO_PROGRAMADA}>Solo no programadas</option>
                    </select>
                </div>

                {filtrosActivos.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: TINTA_MUTED }}>
                            Filtrando por
                        </span>
                        {filtrosActivos.map(f => (
                            <ChipFiltro key={f.campo} campo={f.campo} valor={f.valor} onQuitar={f.quitar} />
                        ))}
                        <button
                            onClick={limpiarFiltros}
                            className="text-[11px] font-bold text-slate-500 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                        >
                            Limpiar todo
                        </button>
                    </div>
                )}
            </div>

            {/* Tres por fila en el telefono: primero el volumen (total, programadas,
                no programadas) y debajo el resultado (realizadas, no realizadas,
                hallazgos). En pantalla ancha van las seis en una sola linea. */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 mb-5">
                <Tile label="Observaciones" valor={datos.length} />
                <Tile label="Programadas" valor={programadas.length} color={TINTA_PROGRAMACION[PROGRAMACION.PROGRAMADA]} />
                <Tile label="No programadas" valor={noProgramadas.length} color={TINTA_PROGRAMACION[PROGRAMACION.NO_PROGRAMADA]} />
                <Tile
                    label="Realizadas" valor={realizadasProg + noProgRealizadas}
                    color={TINTA_REALIZACION[ESTADO_REALIZACION.REALIZADA]}
                    nota={noProgRealizadas > 0 ? `${noProgRealizadas} no programada${noProgRealizadas === 1 ? '' : 's'}` : null}
                />
                <Tile
                    label="No realizadas" valor={noRealizadasProg}
                    color={TINTA_REALIZACION[ESTADO_REALIZACION.NO_REALIZADA]}
                    nota="de lo programado"
                />
                <Tile label="Hallazgos" valor={totalHallazgos} />
            </div>

            {/* ---- Cumplimiento: la grafica principal del tablero ---- */}
            <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 mb-4">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                        <h3 className="font-bold text-slate-900 text-sm">Cumplimiento de lo programado</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Las {programadas.length} observaciones programadas son el 100 %.
                        </p>
                    </div>
                    <div className="flex gap-5 sm:gap-8">
                        <div className="text-right">
                            <p className="text-3xl font-bold text-slate-900 leading-none tabular-nums">
                                {cumplimientoTotal}<span className="text-lg text-slate-400"> %</span>
                            </p>
                            <p className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: TINTA_MUTED }}>
                                Sobre el total
                            </p>
                        </div>
                        {/* Lo exigible hasta hoy: no castiga lo que todavia no vence. */}
                        <div className="text-right">
                            <p className="text-3xl font-bold leading-none tabular-nums" style={{ color: TINTA_REALIZACION[ESTADO_REALIZACION.REALIZADA] }}>
                                {cumplimientoReal}<span className="text-lg text-slate-400"> %</span>
                            </p>
                            <p className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: TINTA_MUTED }}>
                                Real hasta la fecha
                            </p>
                        </div>
                    </div>
                </div>

                <BarraApilada
                    segmentos={segmentosCumplimiento}
                    total={programadas.length}
                    alto="h-6"
                    onSegmento={alternarRealizacion}
                    activo={fRealizacion}
                />
                <div className="mt-2.5">
                    <Leyenda
                        segmentos={segmentosCumplimiento}
                        total={programadas.length}
                        onSeleccionar={alternarRealizacion}
                        activo={fRealizacion}
                    />
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                    <span>
                        Exigibles hasta hoy: <b className="text-slate-800 tabular-nums">{exigibles}</b> de {programadas.length}
                    </span>
                    {noProgRealizadas > 0 && (
                        <span>
                            <i className="w-2 h-2 rounded-sm inline-block mr-1" style={{ background: COLOR_PROGRAMACION[PROGRAMACION.NO_PROGRAMADA] }} />
                            Más <b className="text-slate-800 tabular-nums">{noProgRealizadas}</b> no programada{noProgRealizadas === 1 ? '' : 's'} ejecutada{noProgRealizadas === 1 ? '' : 's'}:
                            el aporte total sube a <b className="text-slate-800 tabular-nums">{cumplimientoConAporte} %</b>
                        </span>
                    )}
                </div>
            </section>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
                <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
                    <h3 className="font-bold text-slate-900 text-sm mb-1">Rutinarias vs no rutinarias</h3>
                    <p className="text-[11px] text-slate-500 mb-3">
                        Sobre lo programado más las no programadas que sí se ejecutaron.
                    </p>
                    <Vista
                        datos={porRutinario}
                        total={contables.length}
                        activo={etiquetaRutinario}
                        onSeleccionar={(label) => alternarRutinario(porRutinario.find(d => d.label === label)?.valorFiltro || '')}
                    />
                </section>

                <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
                    <h3 className="font-bold text-slate-900 text-sm mb-1">Con y sin hallazgos</h3>
                    <p className="text-[11px] text-slate-500 mb-3">
                        {totalHallazgos} hallazgo{totalHallazgos === 1 ? '' : 's'} registrado{totalHallazgos === 1 ? '' : 's'} en total.
                    </p>
                    <Vista datos={porHallazgos} total={contables.length} activo={fEstado} onSeleccionar={alternarHallazgos} />
                </section>

                <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
                    <h3 className="font-bold text-slate-900 text-sm mb-1">Programadas vs no programadas</h3>
                    <p className="text-[11px] text-slate-500 mb-3">
                        Composición del registro. Las programadas son la base del cumplimiento.
                    </p>
                    <Vista datos={porProgramacion} total={datos.length} activo={fProgramacion} onSeleccionar={alternarProgramacion} />
                </section>
            </div>

            {/* ---- Detalle: la misma lista del dashboard, gestionable desde aqui ---- */}
            <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                    <div>
                        <h3 className="font-bold text-slate-900 text-sm">Observaciones filtradas</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            El detalle de lo que están mostrando las gráficas. Doble clic para abrir y gestionar.
                        </p>
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums">
                        <b className="text-slate-900">{filas.length}</b> observaciones
                    </span>
                </div>

                <ListaObservaciones
                    observaciones={filas}
                    todas={observaciones}
                    usuario={usuario}
                    vacio="No hay observaciones que cumplan los filtros seleccionados"
                />
            </section>
        </div>
    );
};

export default Metricas;
