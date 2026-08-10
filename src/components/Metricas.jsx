import React, { useState, useMemo } from 'react';
import { hoyISO, estadoDe } from '../utils/storage';
import { PPF, ESTADOS, ESTADO_REALIZACION, COLOR_REALIZACION } from '../data/constants';

// ---------------------------------------------------------------------------
// Tablero de metricas.
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

// ---------------------------------------------------------------------------
// Barra apilada horizontal: la forma correcta para parte-de-un-todo con
// categorias de nombre largo. Marcas finas, 2px de superficie entre segmentos
// (nunca un borde), extremos redondeados.
// ---------------------------------------------------------------------------
const BarraApilada = ({ segmentos, total, alto = 'h-3' }) => (
    <div className={`flex ${alto} gap-[2px] rounded bg-slate-100 overflow-hidden`}>
        {total === 0 && <div className="w-full" />}
        {segmentos.filter(s => s.valor > 0).map(s => (
            <div
                key={s.label}
                title={`${s.label}: ${s.valor} (${pct(s.valor, total)}%)`}
                style={{ width: `${(s.valor / total) * 100}%`, backgroundColor: s.color }}
                className="h-full first:rounded-l last:rounded-r transition-[width] duration-300 hover:opacity-85"
            />
        ))}
    </div>
);

/** Leyenda: identidad por icono + texto, nunca por color solo. */
const Leyenda = ({ segmentos, total }) => (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segmentos.map(s => (
            <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <i className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ background: s.color }} />
                <span aria-hidden="true" className="text-slate-400">{s.icono}</span>
                {s.label}
                <b className="text-slate-900 tabular-nums">{s.valor}</b>
                {total > 0 && <span className="text-slate-400 tabular-nums">· {pct(s.valor, total)}%</span>}
            </span>
        ))}
    </div>
);

// Barras horizontales simples para los cortes binarios.
const BarrasH = ({ datos, total, vacio = 'Sin datos para este filtro.' }) => {
    const max = Math.max(...datos.map(d => d.valor), 1);
    return datos.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">{vacio}</p>
    ) : (
        <ul className="space-y-3">
            {datos.map(d => (
                <li key={d.label} title={`${d.label}: ${d.valor} · ${pct(d.valor, total)}%`}>
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className="text-xs text-slate-700 truncate">{d.label}</span>
                        <span className="text-xs font-bold text-slate-900 tabular-nums shrink-0">
                            {d.valor}
                            {total > 0 && <span className="text-slate-400 font-normal"> · {pct(d.valor, total)}%</span>}
                        </span>
                    </div>
                    <div className="h-2.5 rounded bg-slate-100 overflow-hidden">
                        <div
                            className="h-full rounded transition-[width] duration-300"
                            style={{
                                width: `${Math.max((d.valor / max) * 100, d.valor ? 2 : 0)}%`,
                                backgroundColor: d.color
                            }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
};

// Gemelo en tabla: ningun valor queda accesible solo por color.
const TablaDatos = ({ datos, total }) => (
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
                    <tr key={d.label}>
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

const Metricas = ({ observaciones, superintendencias }) => {
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [fPpf, setFPpf] = useState('');
    const [fSuper, setFSuper] = useState('');
    const [fRutinario, setFRutinario] = useState('');
    const [fEstado, setFEstado] = useState('');
    const [fRealizacion, setFRealizacion] = useState('');
    const [comoTabla, setComoTabla] = useState(false);

    const rangoRapido = (tipo) => {
        const h = new Date();
        const p = (n) => String(n).padStart(2, '0');
        if (tipo === 'todo') { setDesde(''); setHasta(''); }
        if (tipo === 'hoy') { setDesde(hoyISO()); setHasta(hoyISO()); }
        if (tipo === 'mes') {
            setDesde(`${h.getFullYear()}-${p(h.getMonth() + 1)}-01`);
            setHasta(hoyISO(new Date(h.getFullYear(), h.getMonth() + 1, 0)));
        }
        if (tipo === 'anio') { setDesde(`${h.getFullYear()}-01-01`); setHasta(`${h.getFullYear()}-12-31`); }
    };

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
        { label: 'Rutinarias', valor: datos.filter(o => o.rutinario === 'Sí').length, color: AZUL },
        { label: 'No rutinarias', valor: datos.filter(o => o.rutinario === 'No').length, color: NARANJA }
    ];
    const porHallazgos = [
        { label: 'Sin hallazgos', valor: total - conHallazgos, color: AZUL },
        { label: 'Con hallazgos', valor: conHallazgos, color: ROJO }
    ];

    const selectCls = 'rounded-lg border border-slate-300 px-2.5 py-2 text-xs outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 bg-white w-full sm:w-auto sm:max-w-[190px]';
    const Vista = comoTabla ? TablaDatos : BarrasH;

    return (
        <div>
            <div className="mb-5">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Gráficas y métricas</h2>
                <p className="text-sm text-slate-500 mt-1">Todas las gráficas responden a los mismos filtros.</p>
            </div>

            {/* Una sola fila de filtros para todo el tablero. */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 mb-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    {[['todo', 'Todo'], ['hoy', 'Hoy'], ['mes', 'Este mes'], ['anio', 'Este año']].map(([id, label]) => (
                        <button
                            key={id}
                            onClick={() => rangoRapido(id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
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
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-5">
                <Tile label="Observaciones" valor={total} />
                <Tile label="Pendientes" valor={cuenta(ESTADO_REALIZACION.PENDIENTE)} color={COLOR_REALIZACION[ESTADO_REALIZACION.PENDIENTE]} />
                <Tile label="Realizadas" valor={realizadas} color="#0f7a55" />
                <Tile label="No realizadas" valor={cuenta(ESTADO_REALIZACION.NO_REALIZADA)} color={COLOR_REALIZACION[ESTADO_REALIZACION.NO_REALIZADA]} />
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
                    <BarraApilada segmentos={segmentosGlobales} total={total} alto="h-4" />
                    <div className="mt-2.5">
                        <Leyenda segmentos={segmentosGlobales} total={total} />
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
                                    <tr key={f.label}>
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
                            return (
                                <li key={f.label}>
                                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                                        <span className="text-xs text-slate-700 truncate" title={f.label}>{f.label}</span>
                                        <span className="text-xs text-slate-500 tabular-nums shrink-0">
                                            <b className="text-slate-900">{f.total}</b> obs.
                                        </span>
                                    </div>
                                    <BarraApilada segmentos={segmentos} total={f.total} />
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

            <div className="grid md:grid-cols-2 gap-4">
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
                    <Vista datos={porRutinario} total={total} />
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
                    <Vista datos={porHallazgos} total={total} />
                </section>
            </div>

            {total === 0 && (
                <p className="text-center text-sm text-slate-400 mt-6">
                    No hay observaciones que cumplan los filtros seleccionados.
                </p>
            )}
        </div>
    );
};

export default Metricas;
