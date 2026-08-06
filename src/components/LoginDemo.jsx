import React, { useState } from 'react';
import { DIRECTORIO_DEMO, esAdmin } from '../data/constants';

// Pantalla que solo aparece cuando no hay sesion de SharePoint alcanzable
// (desarrollo local). Dentro del portal, App.jsx resuelve el usuario con
// /_api/web/currentuser y esto nunca se monta.
const LoginDemo = ({ onEntrar }) => {
    const [manual, setManual] = useState('');

    return (
        <div className="min-h-full grid place-items-center bg-slate-50 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
                <div className="w-12 h-12 rounded-xl bg-yellow-400 text-slate-900 grid place-items-center font-black text-lg mb-4">
                    OS
                </div>
                <h1 className="text-xl font-bold text-slate-900">Observaciones de Seguridad</h1>
                <p className="text-sm text-slate-500 mt-1">
                    No se detectó una sesión de SharePoint. Elige un usuario para probar la aplicación.
                </p>

                <div className="mt-5 space-y-1">
                    {DIRECTORIO_DEMO.map(u => (
                        <button
                            key={u.email}
                            onClick={() => onEntrar(u)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center justify-between gap-2 cursor-pointer"
                        >
                            <span>
                                <span className="block text-sm font-semibold text-slate-800">{u.nombre}</span>
                                <span className="block text-xs text-slate-500">{u.email}</span>
                            </span>
                            {esAdmin(u.email) && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 shrink-0">
                                    ADMIN
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <form
                    className="mt-5 pt-4 border-t border-slate-100 flex gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const email = manual.trim().toLowerCase();
                        if (email) onEntrar({ nombre: email, email });
                    }}
                >
                    <input
                        type="email"
                        value={manual}
                        onChange={(e) => setManual(e.target.value)}
                        placeholder="otro.correo@cerrejon.com"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-yellow-500"
                    />
                    <button className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold cursor-pointer">
                        Entrar
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginDemo;
