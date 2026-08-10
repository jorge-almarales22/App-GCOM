import React, { useState, useMemo } from 'react';
import { hoyISO, estadoDe } from '../utils/storage';
import { PPF, ESTADOS, ESTADO_REALIZACION, COLOR_REALIZACION, TINTA_REALIZACION } from '../data/constants';

// ---------------------------------------------------------------------------
// Tablero de metricas.
//
// Las graficas no solo muestran: filtran. Al hacer clic en una barra el tablero
// entero se recorta a ese valor, como en Power BI, y el clic sobre lo ya
// seleccionado lo deshace. Todo lo que se pinta responde a los mismos filtros,
// incluida la tabla de observaciones del final.
//
// Paletas: los tres estados de realizacion usan COLOR_REALIZACION (validado en
// constants.js). Los dos cortes binarios usan azul/naranja y azul/rojo, que
// pasan las mismas comprobaciones sobre fondo blanco:
//   azul vs naranja -> CVD ΔE 24.7 · azul vs rojo -> CVD ΔE 23.8
// ---------------------------------------------------------------------------
const AZUL = '#2a78d6';
const NARANJA = '#eb6834';
const ROJO = '#d03b3b';

const TINTA_MUTED = '#898781';

// Orden del apilado: de lo resuelto a lo que falta. El lector recorre la barra
// de izquierda (bien) a derecha (mal) sin tener que consultar la leyenda.
const ORDEN_ESTADOS = [
    ESTADO_REALIZACION.REALIZADA,
    ESTADO_REALIZACION.PENDIENTE,
    ESTADO_REALIZACION.NO_REALIZADA
];

const ICONO_ESTADO = {
    [ESTADO_REALIZACION.REALIZADA]: '✓',
    [ESTADO_REALIZACION.PENDIENTE]: '◷',
    [ESTADO_REALIZACION.NO_REALIZADA]: '✕'
};

const pct = (v, t) => (t ? Math.round((v / t) * 100) : 0);

const ayerISO = () => hoyISO(new Date(Date.now() - 86400000));

// Rangos rapidos. "Ayer" es el predeterminado: a cualquier hora del dia ya hay
// una jornada completa de datos que mirar, cosa que "Hoy" no garantiza en la
// madrugada o a primera hora de la mañana.
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
// relleno oscuro, casi negro sobre relleno claro (el ambar lo necesita).
const tintaSobre = (hex) => {
    const c = hex.replace('#', '');
    const canal = (i) => {
        const v = parseInt(c.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const L = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
    return L > 0.42 ? '#1a1a1a' : '#ffffff';
};

// ---------------------------------------------------------------------------
// Barra apilada horizontal: la forma correcta para parte-de-un-todo con
// categorias de nombre largo. Marcas finas, 2px de superficie entre segmentos
// (nunca un borde), extremos redondeados.
//
// La cantidad va impresa dentro del segmento cuando cabe; si no cabe, sigue
// disponible en la etiqueta de la fila, en la leyenda y en la vista de tabla.
// Con `onSegmento` cada segmento se vuelve un boton de filtro.
// ---------------------------------------------------------------------------
const BarraApilada = ({ segmentos, total, alto = 'h-5', onSegmento, activo }) => (
    <div className={`flex ${alto} gap-[2px] rounded bg-slate-100 overflow-hidden`}>
        {total === 0 && <div className="w-full" />}
        {segmentos.filter(s => s.valor > 0).map(s => {
            const porcentaje = (s.valor / total) * 100;
            const contenido = porcentaje >= 7 && (
                <span
                    className="text-[10px] font-bold leading-none tabular-nums"
                    style={{ color: tintaSobre(s.color) }}
                >
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
                <div key={s.label} title={titulo} style={estilo} className={clase}>
                    {contenido}
                </div>
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
                                        <span
                                            className="text-[10px] font-bold leading-none tabular-nums"
                                            style={{ color: tintaSobre(d.color) }}
                                        >
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

const Tile = ({ label, valor, color }) => (
    <div className="bg-white rounded-2xl border border-slate-200 px-4 sm:px-5 py-4">
        <p className="text-2xl sm:text-3xl font-bold" style={{ color: color || '#0b0b0b' }}>{valor}</p>
        <p className="text-[11px] font-bold uppercase tracking-wide mt-1 leading-tight" style={{ color: TINTA_MUTED }}>
            {label}
        </p>
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

const FILAS_TABLA_INICIALES = 25;

const Metricas = ({ observaciones, superintendencias }) => {
    const [desde, setDesde] = useState(ayerISO);
    const [hasta, setHasta] = useState(ayerISO);
    const [fPpf, setFPpf] = useState('');
    const [fSuper, setFSuper] = useState('');
    const [fRutinario, setFRutinario] = useState('');
    const [fEstado, setFEstado] = useState('');
    const [fRealizacion, setFRealizacion] = useState('');
    const [comoTabla, setComoTabla] = useState(false);
    const [verTodasLasFilas, setVerTodasLasFilas] = useState(false);

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
    const alternarPpf = alternar(setFPpf);
    const alternarRealizacion = alternar(setFRealizacion);
    const alternarRutinario = alternar(setFRutinario);
    const alternarHallazgos = alternar(setFEstado);

    // Un segmento cruza dos dimensiones (PPF + estado), igual que en Power BI.
    const filtrarPorSegmento = (ppf, estado) => {
        const yaEstaba = fPpf === ppf && fRealizacion === estado;
        setFPpf(yaEstaba ? '' : ppf);
        setFRealizacion(yaEstaba ? '' : estado);
    };

    const limpiarFiltros = () => {
        setFPpf('');
        setFSuper('');
        setFRutinario('');
        setFEstado('');
        setFRealizacion('');
    };

    const filtrosActivos = [
        fPpf && { campo: 'PPF', valor: fPpf, quitar: () => setFPpf('') },
        fSuper && { campo: 'Superintendencia', valor: fSuper, quitar: () => setFSuper('') },
        fRutinario && { campo: 'Rutinario', valor: fRutinario, quitar: () => setFRutinario('') },
        fEstado && { campo: 'Hallazgos', valor: fEstado, quitar: () => setFEstado('') },
        fRealizacion && { campo: 'Estado', valor: fRealizacion, quitar: () => setFRealizacion('') }
    ].filter(Boolean);

    const datos = useMemo(() => observaciones.filter(o => {
        if (desde && o.fecha < desde) return false;
        if (hasta && o.fecha > hasta) return false;
        if (fPpf && o.ppf !== fPpf) return false;
        if (fSuper && o.superintendencia !== fSuper) return false;
        if (fRutinario && o.rutinario !== fRutinario) return false;
        if (fEstado && o.estado !== fEstado) return false;
        if (fRealizacion && estadoDe(o) !== fRealizacion) return false;
        return true;
    }), [observaciones, desde, hasta, fPpf, fSuper, fRutinario, fEstado, fRealizacion]);

    const total = datos.length;
    const conHallazgos = datos.filter(o => o.estado === ESTADOS.CON_HALLAZGOS).length;
    const totalHallazgos = datos.reduce((n, o) => n + (o.hallazgos?.length || 0), 0);
    const cuenta = (estado) => datos.filter(o => estadoDe(o) === estado).length;

    const segmentosGlobales = ORDEN_ESTADOS.map(e => ({
        label: e,
        icono: ICONO_ESTADO[e],
        color: COLOR_REALIZACION[e],
        valor: cuenta(e)
    }));

    const realizadas = cuenta(ESTADO_REALIZACION.REALIZADA);
    const cerradas = realizadas + cuenta(ESTADO_REALIZACION.NO_REALIZADA);

    // Una fila por PPF, ordenada por volumen: primero los protocolos donde mas
    // se esta observando. Solo aparecen los PPF con datos.
    const porPpf = useMemo(() => {
        const mapa = new Map();
        datos.forEach(o => {
            const k = o.ppf || 'Sin definir';
            if (!mapa.has(k)) mapa.set(k, { label: k, total: 0, estados: {} });
            const fila = mapa.get(k);
            const e = estadoDe(o);
            fila.total += 1;
            fila.estados[e] = (fila.estados[e] || 0) + 1;
        });
        return [...mapa.values()].sort((a, b) => b.total - a.total);
    }, [datos]);

    const porRutinario = [
        { label: 'Rutinarias', valorFiltro: 'Sí', valor: datos.filter(o => o.rutinario === 'Sí').length, color: AZUL },
        { label: 'No rutinarias', valorFiltro: 'No', valor: datos.filter(o => o.rutinario === 'No').length, color: NARANJA }
    ];
    const porHallazgos = [
        { label: ESTADOS.SIN_HALLAZGOS, valor: total - conHallazgos, color: AZUL },
        { label: ESTADOS.CON_HALLAZGOS, valor: conHallazgos, color: ROJO }
    ];

    // Lo mas reciente arriba: es lo que se acaba de registrar.
    const filas = useMemo(() => [...datos].sort((a, b) =>
        a.fecha === b.fecha
            ? (b.hora || '').localeCompare(a.hora || '')
            : (b.fecha || '').localeCompare(a.fecha || '')
    ), [datos]);

    const filasVisibles = verTodasLasFilas ? filas : filas.slice(0, FILAS_TABLA_INICIALES);

    const selectCls = 'rounded-lg border border-slate-300 px-2.5 py-2 text-xs outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 bg-white w-full sm:w-auto sm:max-w-[190px]';
    const Vista = comoTabla ? TablaDatos : BarrasH;

    const etiquetaRutinario = fRutinario
        ? porRutinario.find(d => d.valorFiltro === fRutinario)?.label
        : '';

    return (
        <div>
            <div className="mb-5">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Gráficas y métricas</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Todas las gráficas responden a los mismos filtros. Haz clic en una barra para filtrar el tablero.
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
                                rangoActivo === id
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
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

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-5">
                <Tile label="Observaciones" valor={total} />
                <Tile label="Pendientes" valor={cuenta(ESTADO_REALIZACION.PENDIENTE)} color={TINTA_REALIZACION[ESTADO_REALIZACION.PENDIENTE]} />
                <Tile label="Realizadas" valor={realizadas} color={TINTA_REALIZACION[ESTADO_REALIZACION.REALIZADA]} />
                <Tile label="No realizadas" valor={cuenta(ESTADO_REALIZACION.NO_REALIZADA)} color={TINTA_REALIZACION[ESTADO_REALIZACION.NO_REALIZADA]} />
                <Tile label="Hallazgos registrados" valor={totalHallazgos} />
            </div>

            {/* ---- Grafica principal: cumplimiento por PPF ---- */}
            <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 mb-4">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-bold text-slate-900 text-sm">Cumplimiento por PPF</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Cada barra es el 100 % de las observaciones programadas de ese protocolo.
                        </p>
                    </div>
                    {/* Figura protagonista: el porcentaje que ya se ejecutó. */}
                    <div className="text-right">
                        <p className="text-3xl font-bold text-slate-900 leading-none tabular-nums">
                            {pct(realizadas, total)}<span className="text-lg text-slate-400"> %</span>
                        </p>
                        <p className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: TINTA_MUTED }}>
                            Realizadas del total
                        </p>
                    </div>
                </div>

                <div className="mb-5">
                    <BarraApilada
                        segmentos={segmentosGlobales}
                        total={total}
                        alto="h-6"
                        onSegmento={alternarRealizacion}
                        activo={fRealizacion}
                    />
                    <div className="mt-2.5">
                        <Leyenda
                            segmentos={segmentosGlobales}
                            total={total}
                            onSeleccionar={alternarRealizacion}
                            activo={fRealizacion}
                        />
                    </div>
                    {cerradas < total && (
                        <p className="text-[11px] text-slate-400 mt-2">
                            Faltan por cerrar {total - cerradas} observación{total - cerradas === 1 ? '' : 'es'}.
                        </p>
                    )}
                </div>

                {porPpf.length === 0 ? (
                    <p className="text-sm text-slate-400 py-6 text-center border-t border-slate-100">
                        Sin observaciones para este filtro.
                    </p>
                ) : comoTabla ? (
                    <div className="overflow-x-auto border-t border-slate-100 pt-3">
                        <table className="w-full text-sm min-w-[440px]">
                            <thead>
                                <tr className="text-[10px] uppercase text-slate-500 text-left border-b border-slate-200">
                                    <th className="py-2 font-bold">PPF</th>
                                    {ORDEN_ESTADOS.map(e => (
                                        <th key={e} className="py-2 font-bold text-right whitespace-nowrap">{e}</th>
                                    ))}
                                    <th className="py-2 font-bold text-right">Total</th>
                                    <th className="py-2 font-bold text-right">% real.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {porPpf.map(f => (
                                    <tr
                                        key={f.label}
                                        onClick={() => alternarPpf(f.label)}
                                        title="Clic para filtrar por este PPF"
                                        className={`cursor-pointer hover:bg-slate-50 ${fPpf === f.label ? 'bg-slate-50' : ''}`}
                                    >
                                        <td className="py-2 text-slate-700 pr-3">{f.label}</td>
                                        {ORDEN_ESTADOS.map(e => (
                                            <td key={e} className="py-2 text-right tabular-nums text-slate-700">
                                                {f.estados[e] || 0}
                                            </td>
                                        ))}
                                        <td className="py-2 text-right font-bold text-slate-900 tabular-nums">{f.total}</td>
                                        <td className="py-2 text-right text-slate-500 tabular-nums">
                                            {pct(f.estados[ESTADO_REALIZACION.REALIZADA] || 0, f.total)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <ul className="space-y-4 border-t border-slate-100 pt-4">
                        {porPpf.map(f => {
                            const segmentos = ORDEN_ESTADOS.map(e => ({
                                label: e,
                                color: COLOR_REALIZACION[e],
                                valor: f.estados[e] || 0
                            }));
                            const atenuada = fPpf && fPpf !== f.label;
                            return (
                                <li key={f.label} className={atenuada ? 'opacity-45' : ''}>
                                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                                        <button
                                            type="button"
                                            onClick={() => alternarPpf(f.label)}
                                            aria-pressed={fPpf === f.label}
                                            title="Clic para filtrar por este PPF"
                                            className={`text-xs truncate cursor-pointer hover:text-slate-900 hover:underline underline-offset-2 ${
                                                fPpf === f.label ? 'text-slate-900 font-semibold' : 'text-slate-700'
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                        <span className="text-xs text-slate-500 tabular-nums shrink-0">
                                            <b className="text-slate-900">{f.total}</b> obs.
                                        </span>
                                    </div>
                                    <BarraApilada
                                        segmentos={segmentos}
                                        total={f.total}
                                        onSegmento={(estado) => filtrarPorSegmento(f.label, estado)}
                                        activo={fPpf === f.label ? fRealizacion : ''}
                                    />
                                    {/* Etiqueta directa por fila: el valor nunca depende del color. */}
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                                        {segmentos.filter(s => s.valor > 0).map(s => (
                                            <span key={s.label} className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                                <i className="w-2 h-2 rounded-sm inline-block" style={{ background: s.color }} />
                                                {s.label} <b className="text-slate-700 tabular-nums">{s.valor}</b>
                                            </span>
                                        ))}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
                <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
                    <h3 className="font-bold text-slate-900 text-sm mb-1">Rutinarias vs no rutinarias</h3>
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 mb-4">
                        <span className="flex items-center gap-1.5">
                            <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: AZUL }} />Rutinarias
                        </span>
                        <span className="flex items-center gap-1.5">
                            <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: NARANJA }} />No rutinarias
                        </span>
                    </div>
                    <Vista
                        datos={porRutinario}
                        total={total}
                        activo={etiquetaRutinario}
                        onSeleccionar={(label) => alternarRutinario(
                            porRutinario.find(d => d.label === label)?.valorFiltro || ''
                        )}
                    />
                </section>

                <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
                    <h3 className="font-bold text-slate-900 text-sm mb-1">Con y sin hallazgos</h3>
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 mb-4">
                        <span className="flex items-center gap-1.5">
                            <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: AZUL }} />Sin hallazgos
                        </span>
                        <span className="flex items-center gap-1.5">
                            <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: ROJO }} />⚠ Con hallazgos
                        </span>
                    </div>
                    <Vista
                        datos={porHallazgos}
                        total={total}
                        activo={fEstado}
                        onSeleccionar={alternarHallazgos}
                    />
                </section>
            </div>

            {/* ---- Detalle: las observaciones que hay detras de las graficas ---- */}
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 sm:px-5 py-4 border-b border-slate-100">
                    <div>
                        <h3 className="font-bold text-slate-900 text-sm">Observaciones filtradas</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            El detalle de lo que están mostrando las gráficas.
                        </p>
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums">
                        {filasVisibles.length} de <b className="text-slate-900">{filas.length}</b>
                    </span>
                </div>

                {filas.length === 0 ? (
                    <p className="text-sm text-slate-400 py-10 text-center">
                        Sin observaciones para este filtro.
                    </p>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[860px]">
                                <thead className="bg-slate-50 text-left">
                                    <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                                        <th className="px-4 py-3 font-bold">Fecha</th>
                                        <th className="px-4 py-3 font-bold">Tarea</th>
                                        <th className="px-4 py-3 font-bold">Observador</th>
                                        <th className="px-4 py-3 font-bold">PPF</th>
                                        <th className="px-4 py-3 font-bold">Área</th>
                                        <th className="px-4 py-3 font-bold">Rutinaria</th>
                                        <th className="px-4 py-3 font-bold">Estado</th>
                                        <th className="px-4 py-3 font-bold text-right">Hallazgos</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filasVisibles.map(o => {
                                        const est = estadoDe(o);
                                        const nHallazgos = o.hallazgos?.length || 0;
                                        return (
                                            <tr key={o.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-2.5 whitespace-nowrap align-top">
                                                    <span className="text-slate-800">{o.fecha}</span>
                                                    <span className="block text-[10px] text-slate-400">{o.hora} · {o.turno}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-800 max-w-[220px] align-top">{o.tarea}</td>
                                                <td className="px-4 py-2.5 align-top">
                                                    <span className="text-xs text-slate-700">{o.observador?.nombre || '—'}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-xs text-slate-600 max-w-[160px] align-top">{o.ppf}</td>
                                                <td className="px-4 py-2.5 text-xs text-slate-600 align-top">{o.area}</td>
                                                <td className="px-4 py-2.5 text-xs text-slate-600 align-top">{o.rutinario}</td>
                                                <td className="px-4 py-2.5 align-top whitespace-nowrap">
                                                    <span
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold"
                                                        style={{ color: TINTA_REALIZACION[est] }}
                                                    >
                                                        <i className="w-2 h-2 rounded-sm inline-block" style={{ background: COLOR_REALIZACION[est] }} />
                                                        <span aria-hidden="true">{ICONO_ESTADO[est]}</span>
                                                        {est}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-right align-top tabular-nums">
                                                    {nHallazgos > 0 ? (
                                                        <span className="text-[11px] font-bold text-red-700">⚠ {nHallazgos}</span>
                                                    ) : (
                                                        <span className="text-[11px] text-slate-400">0</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {filas.length > FILAS_TABLA_INICIALES && (
                            <div className="px-4 sm:px-5 py-3 border-t border-slate-100 text-center">
                                <button
                                    onClick={() => setVerTodasLasFilas(v => !v)}
                                    className="text-xs font-bold text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                                >
                                    {verTodasLasFilas
                                        ? `Mostrar solo las primeras ${FILAS_TABLA_INICIALES}`
                                        : `Ver las ${filas.length} observaciones`}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>

            {total === 0 && (
                <p className="text-center text-sm text-slate-400 mt-6">
                    No hay observaciones que cumplan los filtros seleccionados.
                </p>
            )}
        </div>
    );
};

export default Metricas;
