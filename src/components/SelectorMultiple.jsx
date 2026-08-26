import React, { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Desplegable con casillas, al estilo de los filtros de Excel.
//
// Reemplaza a todos los <select> de la aplicacion. En modo `multiple` (los
// filtros) se marcan varias opciones a la vez y el boton resume cuantas van;
// en modo simple (los campos de un formulario, donde el dato es uno solo)
// funciona como un select de toda la vida pero con la misma pinta.
//
// Un <select multiple> nativo obliga a Ctrl+clic, no cabe en un telefono y no
// deja buscar: por eso el desplegable es propio.
// ---------------------------------------------------------------------------

/** Acepta ['a','b'] o [{ valor, label }] y devuelve siempre lo segundo. */
const normalizar = (opciones) =>
    opciones.map(o => (typeof o === 'string' ? { valor: o, label: o } : o));

// A partir de esta cantidad de opciones el buscador deja de estorbar y empieza
// a hacer falta (los doce PPF o las superintendencias del directorio).
const MINIMO_PARA_BUSCAR = 8;

const SelectorMultiple = ({
    opciones,
    valor,
    onChange,
    multiple = false,
    etiquetaVacia = 'Todos',
    etiqueta,
    className = '',
    ancho = 'w-full sm:w-auto sm:min-w-[170px]'
}) => {
    const [abierto, setAbierto] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const caja = useRef(null);

    const lista = normalizar(opciones);
    const seleccion = multiple ? (valor || []) : (valor ? [valor] : []);

    useEffect(() => {
        if (!abierto) return;
        const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
        const escape = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setAbierto(false); } };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [abierto]);

    const alternar = (v) => {
        if (!multiple) {
            onChange(v);
            setAbierto(false);
            return;
        }
        onChange(seleccion.includes(v) ? seleccion.filter(x => x !== v) : [...seleccion, v]);
    };

    const visibles = busqueda.trim()
        ? lista.filter(o => o.label.toLowerCase().includes(busqueda.trim().toLowerCase()))
        : lista;

    // Resumen del boton: el valor cuando es uno, la cuenta cuando son varios.
    const resumen = () => {
        if (seleccion.length === 0) return etiquetaVacia;
        if (seleccion.length === 1) return lista.find(o => o.valor === seleccion[0])?.label || seleccion[0];
        return `${seleccion.length} seleccionados`;
    };

    const activo = seleccion.length > 0;

    return (
        <div className={`relative ${ancho} ${className}`} ref={caja}>
            {etiqueta && <span className="block text-xs font-semibold text-slate-700 mb-1.5">{etiqueta}</span>}

            <button
                type="button"
                onClick={() => { setAbierto(a => !a); setBusqueda(''); }}
                aria-expanded={abierto}
                aria-haspopup="listbox"
                className={`w-full flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs text-left transition cursor-pointer ${
                    activo
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                }`}
            >
                <span className="flex-1 truncate">{resumen()}</span>
                {activo && multiple && (
                    // Limpiar sin abrir el panel: es lo que uno busca cuando ya
                    // no recuerda que dejo marcado.
                    <span
                        role="button"
                        tabIndex={0}
                        aria-label="Quitar filtro"
                        onClick={(e) => { e.stopPropagation(); onChange([]); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange([]); } }}
                        className="shrink-0 w-4 h-4 grid place-items-center rounded-full hover:bg-white/20"
                    >
                        ×
                    </span>
                )}
                <span aria-hidden="true" className={`shrink-0 text-[10px] ${activo ? 'text-white/70' : 'text-slate-400'}`}>
                    ▾
                </span>
            </button>

            {abierto && (
                <div className="absolute z-50 mt-1 w-full min-w-[220px] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                    {lista.length >= MINIMO_PARA_BUSCAR && (
                        <div className="p-2 border-b border-slate-100">
                            <input
                                autoFocus
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Buscar..."
                                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200"
                            />
                        </div>
                    )}

                    {multiple && (
                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => onChange(visibles.map(o => o.valor))}
                                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                                Seleccionar todo
                            </button>
                            <button
                                type="button"
                                onClick={() => onChange([])}
                                className="text-[11px] font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
                            >
                                Limpiar
                            </button>
                        </div>
                    )}

                    <ul role="listbox" aria-multiselectable={multiple} className="max-h-64 overflow-y-auto py-1">
                        {visibles.length === 0 && (
                            <li className="px-3 py-3 text-xs text-slate-400 text-center">Sin coincidencias</li>
                        )}
                        {visibles.map(o => {
                            const marcada = seleccion.includes(o.valor);
                            return (
                                <li key={o.valor}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={marcada}
                                        onClick={() => alternar(o.valor)}
                                        className={`w-full flex items-start gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 cursor-pointer ${
                                            marcada ? 'text-slate-900 font-semibold' : 'text-slate-700'
                                        }`}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`mt-0.5 shrink-0 w-4 h-4 rounded border grid place-items-center text-[10px] font-bold ${
                                                marcada
                                                    ? 'bg-slate-900 border-slate-900 text-white'
                                                    : 'bg-white border-slate-300 text-transparent'
                                            }`}
                                        >
                                            ✓
                                        </span>
                                        <span className="flex-1">{o.label}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SelectorMultiple;
