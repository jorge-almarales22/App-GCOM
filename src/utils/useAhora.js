import { useState, useEffect } from 'react';

/**
 * Reloj compartido de la pantalla.
 *
 * El estado de una observacion no se guarda: se deduce de la hora, y por eso
 * una tarea vencida tiene que pasar sola de "Por realizar" a "No realizada"
 * aunque nadie toque nada y aunque el servidor no traiga ningun cambio.
 *
 * Se consulta cada 3 segundos, pero solo se entrega una fecha nueva cuando
 * cambia el MINUTO: las observaciones se programan con precision de minuto, asi
 * que dentro del mismo minuto no hay nada que pueda cambiar de estado y
 * conservar la misma referencia evita recalcular tablas y graficas 20 veces
 * por minuto sin motivo.
 */
export const useAhora = (intervalo = 3000) => {
    const [ahora, setAhora] = useState(() => new Date());

    useEffect(() => {
        const t = setInterval(() => {
            setAhora(previo => {
                const actual = new Date();
                const mismoMinuto =
                    actual.getMinutes() === previo.getMinutes() &&
                    actual - previo < 60000;
                return mismoMinuto ? previo : actual;
            });
        }, intervalo);
        return () => clearInterval(t);
    }, [intervalo]);

    return ahora;
};
