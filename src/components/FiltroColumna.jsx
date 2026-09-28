import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// Filtro de cabecera al estilo de Excel.
//
// Cada columna trae su boton: ordenar A→Z / Z→A, buscar entre los valores y
// marcar o desmarcar casillas. Como en Excel, los cambios no se aplican hasta
// "Aceptar", y dejar todo marcado equivale a no filtrar.
//
// El panel se pinta en un portal con posicion fija: la tabla vive dentro de un
// contenedor con desplazamiento horizontal que recortaria cualquier panel
// absoluto que se saliera de sus bordes.
// ---------------------------------------------------------------------------

export const VACIAS = '(Vacías)';

const ANCHO = 272;

const FiltroColumna = ({
    label,
    opciones,          // [{ valor, cuenta }] ya ordenadas
    seleccion,         // Set | null (null = sin filtro)
    onAplicar,         // (Set | null) => void
    orden,             // 'asc' | 'desc' | null
    onOrdenar,         // ('asc' | 'desc' | null) => void
    textosOrden = ['Ordenar A → Z', 'Ordenar Z → A'],
    alinear = 'left'
}) => {
    const [abierto, setAbierto] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const [busqueda, setBusqueda] = useState('');
    const [borrador, setBorrador] = useState(() => new Set());
    const boton = useRef(null);
    const panel = useRef(null);

    const filtrado = !!seleccion;

    const abrir = () => {
        setBusqueda('');
        setBorrador(new Set(seleccion || opciones.map(o => o.valor)));
        setAbierto(true);
    };

    // Se ubica debajo del boton y nunca se sale de la pantalla por la derecha.
    useLayoutEffect(() => {
        if (!abierto || !boton.current) return;
        const r = boton.current.getBoundingClientRect();
        const izquierda = alinear === 'right' ? r.right - ANCHO : r.left;
        setPos({
            top: r.bottom + 4,
            left: Math.max(8, Math.min(izquierda, window.innerWidth - ANCHO - 8))
        });
    }, [abierto, alinear]);

    useEffect(() => {
        if (!abierto) return;
        const fuera = (e) => {
            if (panel.current?.contains(e.target) || boton.current?.contains(e.target)) return;
            setAbierto(false);
        };
        const escape = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setAbierto(false); } };
        // Con la pagina en movimiento el panel quedaria flotando lejos de su
        // columna: se cierra, igual que en Excel al desplazar.
        const cerrar = (e) => { if (!panel.current?.contains(e.target)) setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape, true);
        window.addEventListener('scroll', cerrar, true);
        window.addEventListener('resize', cerrar);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', escape, true);
            window.removeEventListener('scroll', cerrar, true);
            window.removeEventListener('resize', cerrar);
        };
    }, [abierto]);

    const q = busqueda.trim().toLowerCase();
    const visibles = useMemo(
        () => (q ? opciones.filter(o => o.valor.toLowerCase().includes(q)) : opciones),
        [opciones, q]
    );

    const todasVisiblesMarcadas = visibles.length > 0 && visibles.every(o => borrador.has(o.valor));
    const algunaVisibleMarcada = visibles.some(o => borrador.has(o.valor));

    const alternar = (v) => setBorrador(prev => {
        const s = new Set(prev);
        if (s.has(v)) s.delete(v); else s.add(v);
        return s;
    });

    const alternarTodas = () => setBorrador(prev => {
        const s = new Set(prev);
        visibles.forEach(o => (todasVisiblesMarcadas ? s.delete(o.valor) : s.add(o.valor)));
        return s;
    });

    // Con una busqueda escrita, Excel aplica solo lo que quedo a la vista.
    const resultado = q ? visibles.filter(o => borrador.has(o.valor)).map(o => o.valor) : [...borrador];
    const aceptar = () => {
        const todas = opciones.length > 0 && opciones.every(o => resultado.includes(o.valor));
        onAplicar(todas ? null : new Set(resultado));
        setAbierto(false);
    };

    const ordenar = (dir) => { onOrdenar(orden === dir ? null : dir); setAbierto(false); };

    const itemMenu = 'w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-100 cursor-pointer disabled:opacity-40 disabled:cursor-default disabled:hover:bg-transparent';

    return (
        <>
            <button
                ref={boton}
                type="button"
                onClick={() => (abierto ? setAbierto(false) : abrir())}
                aria-haspopup="dialog"
                aria-expanded={abierto}
                title={filtrado ? `Filtrando ${label}` : `Filtrar ${label}`}
                className={`inline-flex items-center gap-1 rounded px-1 -mx-1 py-0.5 uppercase tracking-wide font-bold transition cursor-pointer ${
                    filtrado || orden ? 'text-slate-900 bg-yellow-100' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
            >
                {label}
                {orden && <span aria-hidden="true">{orden === 'asc' ? '↑' : '↓'}</span>}
                {/* Embudo cuando filtra, flecha cuando no: igual que Excel. */}
                <span aria-hidden="true" className={`text-[9px] ${filtrado ? 'text-yellow-700' : 'text-slate-400'}`}>
                    {filtrado ? '⧩' : '▾'}
                </span>
            </button>

            {abierto && createPortal(
                <div
                    ref={panel}
                    role="dialog"
                    aria-label={`Filtro de ${label}`}
                    style={{ top: pos.top, left: pos.left, width: ANCHO }}
                    className="fixed z-[60] bg-white border border-slate-200 rounded-lg shadow-2xl text-slate-700 normal-case tracking-normal font-normal"
                >
                    <div className="py-1 border-b border-slate-100">
                        {['asc', 'desc'].map((dir, i) => (
                            <button key={dir} type="button" onClick={() => ordenar(dir)} className={itemMenu}>
                                <span className="w-4 text-center text-slate-400" aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span>
                                <span className={orden === dir ? 'font-bold text-slate-900' : ''}>{textosOrden[i]}</span>
                                {orden === dir && <span className="ml-auto text-slate-400">✓</span>}
                            </button>
                        ))}
                        <button
                            type="button"
                            disabled={!filtrado}
                            onClick={() => { onAplicar(null); setAbierto(false); }}
                            className={itemMenu}
                        >
                            <span className="w-4 text-center text-slate-400" aria-hidden="true">✕</span>
                            Borrar filtro de "{label}"
                        </button>
                    </div>

                    <div className="p-2">
                        <input
                            autoFocus
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && resultado.length) aceptar(); }}
                            placeholder="Buscar"
                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200"
                        />
                    </div>

                    <ul className="max-h-60 overflow-y-auto mx-2 border border-slate-200 rounded-md py-1">
                        {visibles.length === 0 ? (
                            <li className="px-3 py-3 text-xs text-slate-400 text-center">Sin coincidencias</li>
                        ) : (
                            <>
                                <li>
                                    <label className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={todasVisiblesMarcadas}
                                            ref={(el) => { if (el) el.indeterminate = !todasVisiblesMarcadas && algunaVisibleMarcada; }}
                                            onChange={alternarTodas}
                                            className="accent-slate-900 cursor-pointer"
                                        />
                                        <span className="font-semibold">
                                            {q ? '(Seleccionar todos los resultados)' : '(Seleccionar todo)'}
                                        </span>
                                    </label>
                                </li>
                                {visibles.map(o => (
                                    <li key={o.valor}>
                                        <label className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={borrador.has(o.valor)}
                                                onChange={() => alternar(o.valor)}
                                                className="accent-slate-900 cursor-pointer shrink-0"
                                            />
                                            <span className={`flex-1 min-w-0 truncate ${o.valor === VACIAS ? 'italic text-slate-400' : ''}`} title={o.valor}>
                                                {o.valor}
                                            </span>
                                            <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{o.cuenta}</span>
                                        </label>
                                    </li>
                                ))}
                            </>
                        )}
                    </ul>

                    <div className="flex justify-end gap-2 p-2">
                        <button
                            type="button"
                            onClick={aceptar}
                            disabled={resultado.length === 0}
                            className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Aceptar
                        </button>
                        <button
                            type="button"
                            onClick={() => setAbierto(false)}
                            className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default FiltroColumna;
