import React, { useEffect, useRef, useState } from 'react';
import { subirFotoEvidencia, TIPO_EVIDENCIA } from '../utils/sharepointApi';

// ---------------------------------------------------------------------------
// Carga de evidencias fotograficas.
//
// Todas las fotos van a la MISMA carpeta de SharePoint; lo que las separa es el
// sufijo del nombre: "_ob" para las de la observacion y "_hall" para las de un
// hallazgo. El componente solo recibe cual de los dos le toca.
// ---------------------------------------------------------------------------

const IconoCamara = ({ className = 'w-6 h-6' }) => (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 0 1 2-2h1.5l1.2-1.8A1 1 0 0 1 8.5 4.7h7a1 1 0 0 1 .8.5L17.5 7H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
        <circle cx="12" cy="13" r="3.2" />
    </svg>
);

/** Visor a pantalla completa. Se cierra con clic fuera o con Escape. */
export const VisorFoto = ({ foto, onCerrar }) => {
    useEffect(() => {
        const alTecla = (e) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('keydown', alTecla);
        return () => document.removeEventListener('keydown', alTecla);
    }, [onCerrar]);

    if (!foto) return null;

    return (
        <div
            className="fixed inset-0 z-[60] bg-slate-950/90 flex flex-col items-center justify-center p-4"
            onClick={onCerrar}
        >
            <img
                src={foto.url}
                alt={foto.nombre}
                className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white/70 text-xs mt-3 text-center break-all max-w-xl">{foto.nombre}</p>
            <a
                href={foto.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-2 text-xs font-semibold text-yellow-400 hover:text-yellow-300"
            >
                Abrir en SharePoint
            </a>
        </div>
    );
};

/** Cuadricula de solo lectura para las fotos ya guardadas. */
export const GaleriaFotos = ({ fotos = [], compacta = false }) => {
    const [visor, setVisor] = useState(null);
    if (!fotos.length) return null;

    return (
        <>
            <div className={`grid gap-2 ${compacta ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'}`}>
                {fotos.map((foto, idx) => (
                    <button
                        key={`${foto.nombre}-${idx}`}
                        type="button"
                        onClick={() => setVisor(foto)}
                        title={foto.nombre}
                        className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    >
                        <img
                            src={foto.url}
                            alt={foto.nombre}
                            loading="lazy"
                            className="w-full h-full object-cover transition group-hover:scale-105"
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-slate-900/70 text-white text-[9px] px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition">
                            {foto.nombre}
                        </span>
                    </button>
                ))}
            </div>
            <VisorFoto foto={visor} onCerrar={() => setVisor(null)} />
        </>
    );
};

const SubidorFotos = ({
    fotos = [],
    onChange,
    usuario,
    tipo = TIPO_EVIDENCIA.OBSERVACION,
    disabled = false
}) => {
    const [subiendo, setSubiendo] = useState([]);   // { id, nombre, preview }
    const [errores, setErrores] = useState([]);
    const [arrastrando, setArrastrando] = useState(false);
    const [visor, setVisor] = useState(null);
    const inputRef = useRef(null);
    const camaraRef = useRef(null);
    const previews = useRef([]);

    // Espejo de la lista actual. Varias fotos pueden terminar de subir en el
    // mismo instante: si cada una leyera el prop `fotos` del render en curso,
    // la ultima en resolver borraria a las anteriores. Mientras haya cargas en
    // vuelo el espejo manda, porque va por delante de lo que el padre ya pinto.
    const fotosRef = useRef(fotos);
    const enVuelo = useRef(0);
    useEffect(() => {
        if (enVuelo.current === 0) fotosRef.current = fotos;
    }, [fotos]);

    // Las miniaturas locales son object URLs: hay que liberarlas al desmontar.
    useEffect(() => () => previews.current.forEach(URL.revokeObjectURL), []);

    const procesar = async (lista) => {
        const archivos = Array.from(lista || []).filter(f => f.type.startsWith('image/'));
        if (!archivos.length) return;
        setErrores([]);

        // Cada foto se sube por separado para que un fallo no tumbe al resto, y
        // se muestra desde ya con su miniatura local mientras viaja.
        await Promise.all(archivos.map(async (archivo) => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const preview = URL.createObjectURL(archivo);
            previews.current.push(preview);
            enVuelo.current += 1;
            setSubiendo(prev => [...prev, { id, nombre: archivo.name, preview }]);
            try {
                const foto = await subirFotoEvidencia(archivo, usuario?.nombre, tipo);
                const siguientes = [...(fotosRef.current || []), foto];
                fotosRef.current = siguientes;
                onChange(siguientes);
            } catch (e) {
                setErrores(prev => [...prev, `No se pudo subir ${archivo.name}: ${e.message}`]);
            } finally {
                enVuelo.current -= 1;
                setSubiendo(prev => prev.filter(s => s.id !== id));
            }
        }));
    };

    const alSoltar = (e) => {
        e.preventDefault();
        setArrastrando(false);
        if (!disabled) procesar(e.dataTransfer.files);
    };

    const quitar = (idx) => {
        const siguientes = fotos.filter((_, i) => i !== idx);
        fotosRef.current = siguientes;
        onChange(siguientes);
    };

    const hayFotos = fotos.length > 0 || subiendo.length > 0;

    return (
        // El control ocupa una sola linea. La zona de arrastre no se dibuja
        // hasta que hay un archivo encima: con varios hallazgos en pantalla, un
        // recuadro punteado por cada uno los separaba tanto que costaba leerlos.
        <div
            onDragOver={(e) => { e.preventDefault(); if (!disabled) setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={alSoltar}
            className={`rounded-lg transition ${
                arrastrando ? 'border-2 border-dashed border-yellow-500 bg-yellow-50 p-3' : ''
            } ${disabled ? 'opacity-60' : ''}`}
        >
            {arrastrando ? (
                <p className="text-sm font-semibold text-yellow-800 text-center py-4">
                    Suelta las fotos para subirlas
                </p>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => inputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:border-slate-400 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                        <IconoCamara className="w-4 h-4" />
                        {hayFotos ? 'Agregar' : 'Adjuntar fotos'}
                    </button>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => camaraRef.current?.click()}
                        className="sm:hidden inline-flex items-center px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer"
                    >
                        Tomar foto
                    </button>
                    <span className="text-[11px] text-slate-400 truncate">
                        {subiendo.length > 0
                            ? `Subiendo ${subiendo.length}...`
                            : fotos.length > 0
                                ? `${fotos.length} foto${fotos.length === 1 ? '' : 's'}`
                                : <span className="hidden sm:inline">o arrastra las fotos aquí</span>}
                    </span>
                </div>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { procesar(e.target.files); e.target.value = ''; }}
            />
            <input
                ref={camaraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { procesar(e.target.files); e.target.value = ''; }}
            />

            {hayFotos && (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mt-2">
                    {fotos.map((foto, idx) => (
                        <div
                            key={`${foto.nombre}-${idx}`}
                            className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group"
                        >
                            <img
                                src={foto.url}
                                alt={foto.nombre}
                                loading="lazy"
                                className="w-full h-full object-cover cursor-zoom-in"
                                onClick={() => setVisor(foto)}
                            />
                            <button
                                type="button"
                                onClick={() => quitar(idx)}
                                aria-label={`Quitar ${foto.nombre}`}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/75 text-white text-xs leading-none grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition cursor-pointer"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    {subiendo.map(s => (
                        <div key={s.id} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                            <img src={s.preview} alt={s.nombre} className="w-full h-full object-cover opacity-40" />
                            <span className="absolute inset-0 grid place-items-center">
                                <span className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {errores.map((msg, i) => (
                <p key={i} className="text-xs text-red-600 mt-2">{msg}</p>
            ))}

            <VisorFoto foto={visor} onCerrar={() => setVisor(null)} />
        </div>
    );
};

export default SubidorFotos;
