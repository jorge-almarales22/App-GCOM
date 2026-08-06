import React, { useState, useEffect, useCallback } from 'react';
import { getCurrentUser, fetchSuperintendencias } from './utils/sharepointApi';
import { getObservaciones } from './utils/storage';
import { esAdmin, SUPERINTENDENCIAS_FALLBACK } from './data/constants';
import Navbar from './components/Navbar';
import RegistroObservacion from './components/RegistroObservacion';
import GestionObservaciones from './components/GestionObservaciones';
import Metricas from './components/Metricas';
import LoginDemo from './components/LoginDemo';

const KEY_USUARIO_DEMO = 'gcom_usuario_demo';

const App = () => {
    const [usuario, setUsuario] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [modoDemo, setModoDemo] = useState(false);
    const [superintendencias, setSuperintendencias] = useState(SUPERINTENDENCIAS_FALLBACK);
    const [vista, setVista] = useState('gestion');

    // Las observaciones viven en localStorage, pero el estado de React es lo que
    // ven los tres modulos. recargar() los vuelve a sincronizar despues de cada
    // escritura.
    const [observaciones, setObservaciones] = useState([]);
    const recargar = useCallback(() => setObservaciones(getObservaciones()), []);

    useEffect(() => {
        const iniciar = async () => {
            const spUser = await getCurrentUser();
            if (spUser) {
                setUsuario({ ...spUser, admin: esAdmin(spUser.email) });
            } else {
                // Sin sesion de SharePoint (desarrollo local) se elige un
                // usuario de prueba para poder recorrer la app.
                setModoDemo(true);
                const guardado = localStorage.getItem(KEY_USUARIO_DEMO);
                if (guardado) {
                    const u = JSON.parse(guardado);
                    setUsuario({ ...u, admin: esAdmin(u.email) });
                }
            }
            const { superintendencias: sup } = await fetchSuperintendencias();
            setSuperintendencias(sup);
            recargar();
            setCargando(false);
        };
        iniciar();
    }, [recargar]);

    const entrarDemo = (u) => {
        localStorage.setItem(KEY_USUARIO_DEMO, JSON.stringify(u));
        setUsuario({ ...u, admin: esAdmin(u.email) });
    };

    const salirDemo = () => {
        localStorage.removeItem(KEY_USUARIO_DEMO);
        setUsuario(null);
    };

    if (cargando) {
        return (
            <div className="min-h-full grid place-items-center bg-slate-50 text-slate-600">
                <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-4 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    <p className="font-semibold">Autenticando con Microsoft 365...</p>
                </div>
            </div>
        );
    }

    if (!usuario) return <LoginDemo onEntrar={entrarDemo} />;

    return (
        <div className="min-h-full bg-slate-50 flex flex-col">
            <Navbar
                usuario={usuario}
                vista={vista}
                onVista={setVista}
                modoDemo={modoDemo}
                onSalirDemo={salirDemo}
            />

            <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">
                {vista === 'registro' && (
                    <RegistroObservacion
                        usuario={usuario}
                        superintendencias={superintendencias}
                        onCreada={() => { recargar(); setVista('gestion'); }}
                    />
                )}
                {vista === 'gestion' && (
                    <GestionObservaciones
                        usuario={usuario}
                        observaciones={observaciones}
                        onCambio={recargar}
                    />
                )}
                {vista === 'metricas' && (
                    <Metricas observaciones={observaciones} superintendencias={superintendencias} />
                )}
            </main>

            <footer className="text-center text-xs text-slate-400 py-4">
                Gerencia de Gestión de Activos · Observaciones de Seguridad
            </footer>
        </div>
    );
};

export default App;
