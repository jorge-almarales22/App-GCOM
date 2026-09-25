import React, { useMemo, useState } from 'react';
import ModalObservacion from './ModalObservacion';
import { ChipEstado } from './Chips';
import { useAhora } from '../utils/useAhora';
import {
    estadoDe,
    esProgramada,
    esRealizada,
    estaPorRealizar,
    observadoresDe,
    ppfsDe,
    tecnicosDe
} from '../utils/storage';
import { ESTADO_REALIZACION, COLOR_REALIZACION, normalizarCorreo } from '../data/constants';
import { TALLERES, TECNICOS } from '../data/tecnicos';

// ---------------------------------------------------------------------------
// Tecnicos observados.
//
// La meta: cada tecnico de cada taller tiene que ser observado por un
// supervisor (los observadores que registran en la app) por lo menos UNA vez al
// año, en cualquier PPF. Cuenta como observado cuando aparece en una
// observacion programada y REALIZADA de ese año; si solo esta asignado a una
// que todavia tiene plazo, es "programado": avance, no cumplimiento.
//
// La pantalla se recorre por niveles y cada clic profundiza uno: talleres ->
// tecnicos del taller -> ficha del tecnico. Asi nunca aparecen los 222
// tecnicos de golpe; solo lo que se pidio ver.
// ---------------------------------------------------------------------------

const VERDE = COLOR_REALIZACION[ESTADO_REALIZACION.REALIZADA];
const AZUL = COLOR_REALIZACION[ESTADO_REALIZACION.POR_REALIZAR];
const ROJO = COLOR_REALIZACION[ESTADO_REALIZACION.NO_REALIZADA];

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

// Semaforo contra el ritmo esperado: la meta es anual, asi que en septiembre
// no se exige el 100 % sino lo proporcional al año corrido.
const RITMO = {
    CUMPLE: { label: 'Cumple', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', icono: '✓', color: VERDE },
    AL_DIA: { label: 'Al día', chip: 'bg-blue-50 text-blue-700 border-blue-200', icono: '◷', color: AZUL },
    ATRASADO: { label: 'Atrasado', chip: 'bg-red-50 text-red-700 border-red-200', icono: '!', color: ROJO },
    NO_CUMPLIO: { label: 'No cumplió', chip: 'bg-red-50 text-red-700 border-red-200', icono: '✕', color: ROJO }
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
    return (ahora - new Date(anio, 0, 1)) / (new Date(anio + 1, 0, 1) - new Date(anio, 0, 1));
};

const ritmoDe = (porcentaje, anio, esperado, ahora) => {
    if (porcentaje >= 100) return RITMO.CUMPLE;
    if (anio < ahora.getFullYear()) return RITMO.NO_CUMPLIO;
    return porcentaje >= Math.round(esperado * 100) ? RITMO.AL_DIA : RITMO.ATRASADO;
};

/** Suma a la cuenta de `clave` dentro de un Map. */
const contar = (mapa, clave, n = 1) => mapa.set(clave, (mapa.get(clave) || 0) + n);

/** Las N claves con mas cuenta, de mayor a menor. */
const top = (mapa, n) => [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

// Barra de avance con una marca en lo esperado a la fecha.
const BarraAvance = ({ porcentaje, esperado, color, alto = 'h-1.5' }) => (
    <div className={`relative ${alto} rounded-full bg-slate-100`}>
        <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${Math.min(porcentaje, 100)}%`, backgroundColor: color }}
        />
        {esperado > 0 && esperado < 1 && (
            <span
                className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-slate-900/60 rounded"
                style={{ left: `${esperado * 100}%` }}
                title={`Esperado a la fecha: ${Math.round(esperado * 100)} %`}
            />
        )}
    </div>
);

/** Fila clicable de una lista: lo que se toca para bajar un nivel. */
const Fila = ({ onClick, children }) => (
    <li>
        <button
            type="button"
            onClick={onClick}
            className="w-full text-left px-4 py-3 hover:bg-slate-50 transition cursor-pointer flex items-center gap-3"
        >
            <div className="flex-1 min-w-0">{children}</div>
            <span aria-hidden="true" className="text-slate-300 text-lg leading-none shrink-0">›</span>
        </button>
    </li>
);

const Tarjeta = ({ children, className = '' }) => (
    <div className={`bg-white rounded-2xl border border-slate-200 ${className}`}>{children}</div>
);

const Segmentado = ({ opciones, valor, onChange }) => (
    <div className="inline-flex gap-1 bg-slate-100 rounded-lg p-1">
        {opciones.map(o => (
            <button
                key={o.id}
                type="button"
                onClick={() => onChange(o.id)}
                aria-pressed={valor === o.id}
                className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    valor === o.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
            >
                {o.label}
            </button>
        ))}
    </div>
);

const FILTROS_TECNICO = [
    { id: 'pendientes', label: 'Pendientes' },
    { id: 'observados', label: 'Observados' },
    { id: 'todos', label: 'Todos' }
];

const TecnicosObservados = ({ observaciones, usuario }) => {
    const ahora = useAhora();
    const anioActual = ahora.getFullYear();
    const [anio, setAnio] = useState(anioActual);
    // Donde esta parado el usuario. Cada nivel se abre desde el anterior y la
    // miga de pan permite volver a cualquiera.
    const [agrupar, setAgrupar] = useState('talleres');   // 'talleres' | 'observadores'
    const [taller, setTaller] = useState(null);
    const [observador, setObservador] = useState(null);
    const [tecnico, setTecnico] = useState(null);
    const [fTecnico, setFTecnico] = useState('pendientes');
    const [busqueda, setBusqueda] = useState('');
    const [obsAbierta, setObsAbierta] = useState(null);

    const irAlInicio = () => { setTaller(null); setObservador(null); setTecnico(null); setBusqueda(''); };

    // Años con datos, mas el actual: la meta del año en curso existe aunque
    // todavia no haya ninguna observacion.
    const anios = useMemo(() => {
        const s = new Set([anioActual]);
        observaciones.forEach(o => { if (tecnicosDe(o).length && o.fecha) s.add(Number(o.fecha.slice(0, 4))); });
        return [...s].filter(Boolean).sort((a, b) => b - a);
    }, [observaciones, anioActual]);

    const esperado = avanceDelAnio(anio, ahora);

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

    const fichaPorNombre = useMemo(() => new Map(fichas.map(f => [f.nombre, f])), [fichas]);

    // ---- nivel 1: resumen y talleres -----------------------------------------
    const observadosTotal = fichas.filter(f => f.estado === ESTADO_TECNICO.OBSERVADO).length;
    const cobertura = pct(observadosTotal, fichas.length);
    const ritmoGeneral = ritmoDe(cobertura, anio, esperado, ahora);
    const faltan = fichas.length - observadosTotal;
    const semanasRestantes = anio === anioActual
        ? Math.max(Math.ceil((new Date(anio + 1, 0, 1) - ahora) / (7 * 86400000)), 1)
        : 0;

    const talleres = useMemo(() => TALLERES.map(t => {
        const suyas = fichas.filter(f => f.taller === t);
        const observados = suyas.filter(f => f.estado === ESTADO_TECNICO.OBSERVADO).length;
        const porcentaje = pct(observados, suyas.length);
        return { taller: t, total: suyas.length, observados, porcentaje, ritmo: ritmoDe(porcentaje, anio, esperado, ahora) };
    // Lo mas atrasado arriba: es donde hay que ir primero.
    }).sort((a, b) => a.porcentaje - b.porcentaje || b.total - a.total), [fichas, anio, esperado, ahora]);

    const observadores = useMemo(() => {
        const porCorreo = new Map();
        realizadas.forEach(o => {
            observadoresDe(o).forEach(p => {
                const clave = normalizarCorreo(p.email) || p.nombre;
                const r = porCorreo.get(clave) || { clave, nombre: p.nombre || p.email, observaciones: 0, tecnicos: new Map() };
                r.observaciones += 1;
                tecnicosDe(o).filter(n => fichaPorNombre.has(n)).forEach(n => contar(r.tecnicos, n));
                porCorreo.set(clave, r);
            });
        });
        return [...porCorreo.values()].sort((a, b) => b.tecnicos.size - a.tecnicos.size || b.observaciones - a.observaciones);
    }, [realizadas, fichaPorNombre]);

    // ---- nivel 2: un taller --------------------------------------------------
    const resumenTaller = taller ? talleres.find(t => t.taller === taller) : null;
    const tecnicosTaller = useMemo(() => {
        if (!taller) return [];
        const q = busqueda.trim().toLowerCase();
        const peso = { [ESTADO_TECNICO.SIN_OBSERVAR]: 0, [ESTADO_TECNICO.PROGRAMADO]: 1, [ESTADO_TECNICO.OBSERVADO]: 2 };
        return fichas
            .filter(f => f.taller === taller)
            .filter(f => fTecnico === 'todos'
                || (fTecnico === 'observados' ? f.estado === ESTADO_TECNICO.OBSERVADO : f.estado !== ESTADO_TECNICO.OBSERVADO))
            .filter(f => !q || f.nombre.toLowerCase().includes(q))
            .sort((a, b) => peso[a.estado] - peso[b.estado] || a.nombre.localeCompare(b.nombre));
    }, [fichas, taller, fTecnico, busqueda]);

    const ppfsTaller = useMemo(() => {
        if (!taller) return [];
        const veces = new Map();
        fichas.filter(f => f.taller === taller).forEach(f => f.ppfs.forEach((n, p) => contar(veces, p, n)));
        return top(veces, 3);
    }, [fichas, taller]);

    // ---- nivel 2 alterno: un observador -------------------------------------
    const datosObservador = observador ? observadores.find(o => o.clave === observador) : null;

    // ---- nivel 3: un tecnico -------------------------------------------------
    const ficha = tecnico ? fichaPorNombre.get(tecnico) : null;
    const obsDelTecnico = useMemo(
        () => (ficha ? observaciones.filter(o => ficha.obsIds.includes(o.id)) : [])
            .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
        [ficha, observaciones]
    );
    // Se busca en la lista viva para que el modal refleje cambios al instante.
    const modal = obsAbierta ? observaciones.find(o => o.id === obsAbierta) : null;

    // ---- miga de pan ---------------------------------------------------------
    const migas = [
        { label: agrupar === 'talleres' ? 'Talleres' : 'Observadores', ir: irAlInicio },
        taller && { label: taller, ir: () => setTecnico(null) },
        datosObservador && { label: datosObservador.nombre, ir: () => setTecnico(null) },
        ficha && { label: ficha.nombre }
    ].filter(Boolean);

    const cuentaFiltro = (id) => {
        const suyas = fichas.filter(f => f.taller === taller);
        if (id === 'todos') return suyas.length;
        if (id === 'observados') return suyas.filter(f => f.estado === ESTADO_TECNICO.OBSERVADO).length;
        return suyas.filter(f => f.estado !== ESTADO_TECNICO.OBSERVADO).length;
    };

    return (
        <div className="max-w-3xl mx-auto">
            {/* ---- Encabezado ---- */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Técnicos observados</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Cada técnico debe ser observado al menos una vez al año.
                    </p>
                </div>
                {anios.length > 1 && (
                    <Segmentado
                        opciones={anios.map(a => ({ id: a, label: String(a) }))}
                        valor={anio}
                        onChange={(a) => { setAnio(a); setTecnico(null); }}
                    />
                )}
            </div>

            {/* ---- Miga de pan: solo aparece cuando ya se profundizo ---- */}
            {migas.length > 1 && (
                <nav className="flex flex-wrap items-center gap-1.5 text-xs mb-4" aria-label="Ubicación">
                    {migas.map((m, i) => (
                        <React.Fragment key={m.label}>
                            {i > 0 && <span className="text-slate-300">›</span>}
                            {m.ir && i < migas.length - 1 ? (
                                <button onClick={m.ir} className="font-semibold text-slate-500 hover:text-slate-900 underline underline-offset-2 cursor-pointer">
                                    {m.label}
                                </button>
                            ) : (
                                <span className="font-bold text-slate-900 truncate max-w-[240px]">{m.label}</span>
                            )}
                        </React.Fragment>
                    ))}
                </nav>
            )}

            {/* ================= NIVEL 3: TECNICO ================= */}
            {ficha && (
                <>
                    <Tarjeta className="p-5 mb-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-bold text-slate-900">{ficha.nombre}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{ficha.taller}</p>
                            </div>
                            <ChipTecnico estado={ficha.estado} veces={ficha.veces} />
                        </div>

                        {ficha.veces > 0 && (
                            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-100">
                                <div>
                                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Veces en {anio}</dt>
                                    <dd className="text-lg font-bold text-slate-900 tabular-nums">{ficha.veces}</dd>
                                </div>
                                <div>
                                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Última vez</dt>
                                    <dd className="text-sm font-semibold text-slate-800 mt-1">{ficha.ultima}</dd>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Observado por</dt>
                                    <dd className="text-sm text-slate-800 mt-1">
                                        {top(ficha.observadores, 5).map(([n, c]) => `${n}${c > 1 ? ` (${c})` : ''}`).join(', ')}
                                    </dd>
                                </div>
                            </dl>
                        )}
                        {ficha.ppfs.size > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-4">
                                {top(ficha.ppfs, 12).map(([p, c]) => (
                                    <span key={p} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                        {p}{c > 1 && ` ×${c}`}
                                    </span>
                                ))}
                            </div>
                        )}
                        {ficha.estado === ESTADO_TECNICO.SIN_OBSERVAR && (
                            <p className="text-sm text-red-700 mt-4">
                                Todavía no ha sido observado en {anio} ni tiene observaciones programadas.
                            </p>
                        )}
                    </Tarjeta>

                    {obsDelTecnico.length > 0 && (
                        <Tarjeta className="overflow-hidden">
                            <p className="px-4 pt-4 pb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Observaciones en {anio}
                            </p>
                            <ul className="divide-y divide-slate-100">
                                {obsDelTecnico.map(o => (
                                    <Fila key={o.id} onClick={() => setObsAbierta(o.id)}>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="min-w-0">
                                                <span className="block text-sm text-slate-800 truncate">{o.tarea}</span>
                                                <span className="block text-[11px] text-slate-400">
                                                    {o.fecha} · {observadoresDe(o).map(p => p.nombre).join(', ')}
                                                </span>
                                            </span>
                                            <ChipEstado estado={estadoDe(o, ahora)} />
                                        </div>
                                    </Fila>
                                ))}
                            </ul>
                        </Tarjeta>
                    )}
                </>
            )}

            {/* ================= NIVEL 2: TALLER ================= */}
            {!ficha && resumenTaller && (
                <Tarjeta className="overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                        <div className="flex items-baseline justify-between gap-3 mb-2">
                            <p className="text-3xl font-bold text-slate-900 tabular-nums leading-none">
                                {resumenTaller.porcentaje}<span className="text-lg text-slate-400"> %</span>
                            </p>
                            <ChipRitmo ritmo={resumenTaller.ritmo} />
                        </div>
                        <BarraAvance porcentaje={resumenTaller.porcentaje} esperado={esperado} color={resumenTaller.ritmo.color} alto="h-2" />
                        <p className="text-xs text-slate-500 mt-2">
                            {resumenTaller.observados} de {resumenTaller.total} técnicos observados
                            {ppfsTaller.length > 0 && <> · más en {ppfsTaller.map(([p]) => p).join(', ')}</>}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                        <Segmentado
                            opciones={FILTROS_TECNICO.map(f => ({ id: f.id, label: `${f.label} ${cuentaFiltro(f.id)}` }))}
                            valor={fTecnico}
                            onChange={setFTecnico}
                        />
                        {resumenTaller.total > 10 && (
                            <input
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Buscar técnico..."
                                className="flex-1 min-w-[160px] rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 bg-white"
                            />
                        )}
                    </div>

                    {tecnicosTaller.length === 0 ? (
                        <p className="text-sm text-slate-400 py-10 text-center">
                            {fTecnico === 'pendientes' ? 'No hay pendientes: todo el taller ya fue observado.' : 'No hay técnicos para mostrar.'}
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {tecnicosTaller.map(f => (
                                <Fila key={f.nombre} onClick={() => setTecnico(f.nombre)}>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm text-slate-800 truncate">{f.nombre}</span>
                                        <ChipTecnico estado={f.estado} veces={f.veces} />
                                    </div>
                                </Fila>
                            ))}
                        </ul>
                    )}
                </Tarjeta>
            )}

            {/* ================= NIVEL 2: OBSERVADOR ================= */}
            {!ficha && datosObservador && (
                <Tarjeta className="overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                        <p className="text-3xl font-bold text-slate-900 tabular-nums leading-none">{datosObservador.tecnicos.size}</p>
                        <p className="text-xs text-slate-500 mt-2">
                            técnicos observados en {datosObservador.observaciones} observacion{datosObservador.observaciones === 1 ? '' : 'es'} realizadas
                        </p>
                    </div>
                    <ul className="divide-y divide-slate-100">
                        {top(datosObservador.tecnicos, 1000).map(([nombre, veces]) => (
                            <Fila key={nombre} onClick={() => setTecnico(nombre)}>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="min-w-0">
                                        <span className="block text-sm text-slate-800 truncate">{nombre}</span>
                                        <span className="block text-[10px] text-slate-400">{fichaPorNombre.get(nombre)?.taller}</span>
                                    </span>
                                    <span className="text-xs font-bold text-slate-600 tabular-nums shrink-0">
                                        {veces} {veces === 1 ? 'vez' : 'veces'}
                                    </span>
                                </div>
                            </Fila>
                        ))}
                    </ul>
                </Tarjeta>
            )}

            {/* ================= NIVEL 1: INICIO ================= */}
            {!ficha && !resumenTaller && !datosObservador && (
                <>
                    <Tarjeta className="p-5 mb-4">
                        <div className="flex items-baseline justify-between gap-3 mb-2">
                            <p className="text-4xl font-bold text-slate-900 tabular-nums leading-none">
                                {cobertura}<span className="text-xl text-slate-400"> %</span>
                            </p>
                            <ChipRitmo ritmo={ritmoGeneral} />
                        </div>
                        <BarraAvance porcentaje={cobertura} esperado={esperado} color={ritmoGeneral.color} alto="h-2" />
                        <p className="text-xs text-slate-500 mt-2">
                            {observadosTotal} de {fichas.length} técnicos observados en {anio}
                            {anio === anioActual && faltan > 0 && (
                                <> · faltan {faltan}, unos <b className="text-slate-700">{Math.ceil(faltan / semanasRestantes)} por semana</b> para cerrar el año</>
                            )}
                        </p>
                    </Tarjeta>

                    <div className="mb-3">
                        <Segmentado
                            opciones={[{ id: 'talleres', label: 'Por taller' }, { id: 'observadores', label: 'Por observador' }]}
                            valor={agrupar}
                            onChange={(v) => { setAgrupar(v); irAlInicio(); }}
                        />
                    </div>

                    {agrupar === 'talleres' ? (
                        <Tarjeta className="overflow-hidden">
                            <ul className="divide-y divide-slate-100">
                                {talleres.map(t => (
                                    <Fila key={t.taller} onClick={() => { setTaller(t.taller); setFTecnico('pendientes'); setBusqueda(''); }}>
                                        <div className="flex items-center justify-between gap-3 mb-1.5">
                                            <span className="text-sm font-semibold text-slate-800 truncate">{t.taller}</span>
                                            <span className="text-xs text-slate-500 tabular-nums shrink-0">
                                                {t.observados}/{t.total}
                                            </span>
                                        </div>
                                        <BarraAvance porcentaje={t.porcentaje} esperado={esperado} color={t.ritmo.color} />
                                    </Fila>
                                ))}
                            </ul>
                        </Tarjeta>
                    ) : observadores.length === 0 ? (
                        <Tarjeta className="py-10 text-center">
                            <p className="text-sm text-slate-400">Todavía no hay observaciones realizadas con técnicos en {anio}.</p>
                        </Tarjeta>
                    ) : (
                        <Tarjeta className="overflow-hidden">
                            <ul className="divide-y divide-slate-100">
                                {observadores.map(o => (
                                    <Fila key={o.clave} onClick={() => setObservador(o.clave)}>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-semibold text-slate-800 truncate">{o.nombre}</span>
                                            <span className="text-xs text-slate-500 tabular-nums shrink-0">
                                                {o.tecnicos.size} técnico{o.tecnicos.size === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                    </Fila>
                                ))}
                            </ul>
                        </Tarjeta>
                    )}

                    {agrupar === 'talleres' && anio === anioActual && (
                        <p className="text-[11px] text-slate-400 mt-2">
                            La marca en cada barra es lo que debería llevarse a la fecha. Toca un taller para ver sus técnicos.
                        </p>
                    )}
                </>
            )}

            {modal && <ModalObservacion obs={modal} usuario={usuario} onCerrar={() => setObsAbierta(null)} />}
        </div>
    );
};

export default TecnicosObservados;
