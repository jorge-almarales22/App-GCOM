import React, { useState, useEffect, useRef } from 'react';
import { getNotificaciones, marcarNotificacionesLeidas } from '../utils/storage';

const fmt = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

// Bandeja de avisos dentro de la app. Hoy solo la alimentan los comentarios del
// administrador; al conectar Power Automate se disparara tambien el correo.
const Notificaciones = ({ usuario }) => {
    const [abierto, setAbierto] = useState(false);
    const [items, setItems] = useState([]);
    const ref = useRef(null);

    // Se relee al abrir y cada 5s: los comentarios del admin se agregan desde
    // otro componente, sin pasar por este estado.
    useEffect(() => {
        const cargar = () => setItems(getNotificaciones(usuario.email));
        cargar();
        const t = setInterval(cargar, 5000);
        return () => clearInterval(t);
    }, [usuario.email, abierto]);

    useEffect(() => {
        const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, []);

    const sinLeer = items.filter(n => !n.leida).length;

    const alternar = () => {
        const siguiente = !abierto;
        setAbierto(siguiente);
        if (siguiente && sinLeer) {
            marcarNotificacionesLeidas(usuario.email);
            // Se marcan leidas al abrir, pero se conserva el resaltado de esta
            // tanda para que el usuario alcance a ver cuales eran nuevas.
        }
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={alternar}
                className="relative w-9 h-9 grid place-items-center rounded-lg hover:bg-white/10 cursor-pointer"
                aria-label="Notificaciones"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
                </svg>
                {sinLeer > 0 && (
                    <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold grid place-items-center">
                        {sinLeer}
                    </span>
                )}
            </button>

            {abierto && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 z-50">
                    <div className="px-4 py-2 border-b border-slate-100 font-bold text-sm">Notificaciones</div>
                    {items.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-slate-400">Sin notificaciones</p>
                    ) : (
                        items.map(n => (
                            <div
                                key={n.id}
                                className={`px-4 py-3 border-b border-slate-100 last:border-0 ${n.leida ? '' : 'bg-yellow-50'}`}
                            >
                                <p className="text-sm font-semibold">{n.titulo}</p>
                                <p className="text-xs text-slate-600 mt-0.5">{n.mensaje}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{fmt(n.creadoEn)}</p>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default Notificaciones;
