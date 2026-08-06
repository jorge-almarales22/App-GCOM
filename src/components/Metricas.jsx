import React, { useState, useMemo } from 'react';
import { hoyISO } from '../utils/storage';
import { PPF, AREAS, ESTADOS } from '../data/constants';

// Paleta validada con el validador de la guia de visualizacion sobre superficie
// blanca (categorical, modo claro). Azul = slot 1, naranja = slot 2, rojo =
// status critico. Los pares que conviven en una misma grafica pasan las seis
// comprobaciones, incluida la separacion para daltonismo:
//   azul vs naranja  -> CVD ΔE 24.7
//   azul vs rojo     -> CVD ΔE 23.8
// El par verde/rojo se descarto: falla deutan con ΔE 4.1.
const AZUL = '#2a78d6';
const NARANJA = '#eb6834';
const ROJO = '#d03b3b';

const TINTA_MUTED = '#898781';

// ---------------------------------------------------------------------------
// Grafica de barras horizontales. Es la forma correcta aqui: las categorias
// (PPF, superintendencias, areas) tienen etiquetas largas y lo que se compara
// es magnitud. Una serie -> un solo color, nunca un degradado por tamaño.
// ---------------------------------------------------------------------------
const BarrasH = ({ titulo, datos, color = AZUL, total, plano = false, vacio = 'Sin datos para este filtro.' }) => {
    const max = Math.max(...datos.map(d => d.valor), 1);
    return (
        <section className={plano ? '' : 'bg-white rounded-2xl border border-slate-200 p-5'}>
            {titulo && <h3 className="font-bold text-slate-900 text-sm mb-4">{titulo}</h3>}
            {datos.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">{vacio}</p>
            ) : (
                <ul className="space-y-3">
                    {datos.map(d => {
                        const pct = total ? Math.round((d.valor / total) * 100) : 0;
                        return (
                            <li
                                key={d.label}
                                className="group"
                                title={`${d.label}: ${d.valor} observación${d.valor === 1 ? '' : 'es'}${total ? ` · ${pct}%` : ''}`}
                            >
                                <div className="flex items-baseline justify-between gap-3 mb-1">
                                    <span className="text-xs text-slate-700 truncate">{d.label}</span>
                                    <span className="text-xs font-bold text-slate-900 tabular-nums shrink-0">
                                        {d.valor}
                                        {total > 0 && <span className="text-slate-400 font-normal"> · {pct}%</span>}
                                    </span>
                                </div>
                                {/* Riel hairline + barra fina con extremo redondeado de 4px. */}
                                <div className="h-2.5 rounded bg-slate-100 overflow-hidden">
                                    <div
                                        className="h-full rounded transition-[width] duration-300 group-hover:opacity-85"
                                        style={{
                                            width: `${Math.max((d.valor / max) * 100, d.valor ? 2 : 0)}%`,
                                            backgroundColor: d.color || color
                                        }}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

// Gemelo en tabla de cada grafica: ningun valor queda accesible solo por color
// o solo por el tooltip.
const TablaDatos = ({ titulo, datos, total, plano = false }) => (
    <section className={plano ? '' : 'bg-white rounded-2xl border border-slate-200 p-5'}>
        {titulo && <h3 className="font-bold text-slate-900 text-sm mb-3">{titulo}</h3>}
        {datos.length === 0 ? (
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
                            <td className="py-2 text-right text-slate-500 tabular-nums">
                                {total ? Math.round((d.valor / total) * 100) : 0}%
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
    </section>
);

const Tile = ({ label, valor, color }) => (
    <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4">
        <p className="text-3xl font-bold" style={{ color: color || '#0b0b0b' }}>{valor}</p>
        <p className="text-[11px] font-bold uppercase tracking-wide mt-1" style={{ color: TINTA_MUTED }}>
            {label}
        </p>
    </div>
);

// Cuenta ocurrencias de un campo y devuelve los datos ya ordenados de mayor a
// menor, que es como se lee una grafica de barras ranqueada.
const contarPor = (obs, campo) => {
    const mapa = new Map();
    obs.forEach(o => {
        const k = o[campo] || 'Sin definir';
        mapa.set(k, (mapa.get(k) || 0) + 1);
    });
    return [...mapa.entries()]
        .map(([label, valor]) => ({ label, valor }))
        .sort((a, b) => b.valor - a.valor);
};

const Metricas = ({ observaciones, superintendencias }) => {
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [fPpf, setFPpf] = useState('');
    const [fArea, setFArea] = useState('');
    const [fSuper, setFSuper] = useState('');
    const [fRutinario, setFRutinario] = useState('');
    const [fEstado, setFEstado] = useState('');
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

    // Una sola lista filtrada alimenta todas las graficas: al mover un filtro,
    // todo el tablero se recalcula contra el mismo corte.
    const datos = useMemo(() => observaciones.filter(o => {
        if (desde && o.fecha < desde) return false;
        if (hasta && o.fecha > hasta) return false;
        if (fPpf && o.ppf !== fPpf) return false;
        if (fArea && o.area !== fArea) return false;
        if (fSuper && o.superintendencia !== fSuper) return false;
        if (fRutinario && o.rutinario !== fRutinario) return false;
        if (fEstado && o.estado !== fEstado) return false;
        return true;
    }), [observaciones, desde, hasta, fPpf, fArea, fSuper, fRutinario, fEstado]);

    const total = datos.length;
    const conHallazgos = datos.filter(o => o.estado === ESTADOS.CON_HALLAZGOS).length;
    const totalHallazgos = datos.reduce((n, o) => n + (o.hallazgos?.length || 0), 0);

    const porPpf = contarPor(datos, 'ppf');
    const porSuper = contarPor(datos, 'superintendencia');
    const porArea = contarPor(datos, 'area');
    const porTarea = contarPor(datos, 'tarea');

    // Los dos cortes binarios llevan color por entidad, no por tamaño: el color
    // no cambia aunque cambie el orden.
    const porRutinario = [
        { label: 'Rutinarias', valor: datos.filter(o => o.rutinario === 'Sí').length, color: AZUL },
        { label: 'No rutinarias', valor: datos.filter(o => o.rutinario === 'No').length, color: NARANJA }
    ];
    const porHallazgos = [
        { label: 'Sin hallazgos', valor: total - conHallazgos, color: AZUL },
        { label: 'Con hallazgos', valor: conHallazgos, color: ROJO }
    ];

    const selectCls = 'rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-yellow-500 bg-white max-w-[190px]';
    const Vista = comoTabla ? TablaDatos : BarrasH;

    return (
        <div>
            <div className="mb-5">
                <h2 className="text-2xl font-bold text-slate-900">Gráficas y métricas</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Todas las gráficas responden a los mismos filtros.
                </p>
            </div>

            {/* Una sola fila de filtros para todo el tablero. */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 space-y-3">
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
                    <span className="text-xs text-slate-400 mx-1">|</span>
                    <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={selectCls} />
                    <span className="text-xs text-slate-400">a</span>
                    <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={selectCls} />

                    <button
                        onClick={() => setComoTabla(v => !v)}
                        className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 hover:bg-slate-50 text-slate-700 cursor-pointer"
                    >
                        {comoTabla ? 'Ver gráficas' : 'Ver como tabla'}
                    </button>
                </div>

                <div className="flex flex-wrap gap-2">
                    <select value={fPpf} onChange={e => setFPpf(e.target.value)} className={selectCls}>
                        <option value="">Todos los PPF</option>
                        {PPF.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={fArea} onChange={e => setFArea(e.target.value)} className={selectCls}>
                        <option value="">Todas las áreas</option>
                        {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
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
                        <option value="">Estado: todos</option>
                        <option value={ESTADOS.SIN_HALLAZGOS}>{ESTADOS.SIN_HALLAZGOS}</option>
                        <option value={ESTADOS.CON_HALLAZGOS}>{ESTADOS.CON_HALLAZGOS}</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <Tile label="Observaciones" valor={total} />
                <Tile label="Con hallazgos" valor={conHallazgos} color={ROJO} />
                <Tile label="Sin hallazgos" valor={total - conHallazgos} color={AZUL} />
                <Tile label="Hallazgos registrados" valor={totalHallazgos} />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
                <Vista titulo="Observaciones por PPF" datos={porPpf} total={total} />
                <Vista titulo="Observaciones por superintendencia" datos={porSuper} total={total} />
                <Vista titulo="Observaciones por área" datos={porArea} total={total} />
                <Vista titulo="Observaciones por tarea" datos={porTarea} total={total} />

                <section className="bg-white rounded-2xl border border-slate-200 p-5 lg:col-span-2 grid md:grid-cols-2 gap-6">
                    <div>
                        <div className="flex items-center gap-4 mb-4">
                            <h3 className="font-bold text-slate-900 text-sm">Rutinarias vs no rutinarias</h3>
                            <span className="flex items-center gap-3 text-[10px] text-slate-500">
                                <span className="flex items-center gap-1">
                                    <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: AZUL }} />Rutinarias
                                </span>
                                <span className="flex items-center gap-1">
                                    <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: NARANJA }} />No rutinarias
                                </span>
                            </span>
                        </div>
                        {comoTabla
                            ? <TablaDatos plano datos={porRutinario} total={total} />
                            : <BarrasH plano datos={porRutinario} total={total} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-4 mb-4">
                            <h3 className="font-bold text-slate-900 text-sm">Con y sin hallazgos</h3>
                            <span className="flex items-center gap-3 text-[10px] text-slate-500">
                                <span className="flex items-center gap-1">
                                    <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: AZUL }} />Sin hallazgos
                                </span>
                                <span className="flex items-center gap-1">
                                    <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: ROJO }} />⚠ Con hallazgos
                                </span>
                            </span>
                        </div>
                        {comoTabla
                            ? <TablaDatos plano datos={porHallazgos} total={total} />
                            : <BarrasH plano datos={porHallazgos} total={total} />}
                    </div>
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
