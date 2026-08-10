// ---------------------------------------------------------------------------
// Capa de acceso a SharePoint, portada del proyecto CheckList-Cerrejon.
//
// Mientras la data de observaciones viva en localStorage, SharePoint solo se usa
// para dos cosas: saber quien esta conectado y leer catalogos corporativos
// (superintendencias del directorio, personas del directorio activo). Cuando se
// creen las listas que haran de BD, saveToSPList/updateSPListItem ya estan aqui.
// ---------------------------------------------------------------------------
import { SITE_URL, SGIA_SITE_URL, AC_SITE_URL, JERARQUIA_LIST, EVIDENCIAS_BASE, SUPERINTENDENCIAS_FALLBACK, DIRECTORIO_DEMO, normalizarCorreo } from '../data/constants';

const jsonHeaders = { "Accept": "application/json;odata=verbose" };

export const getRequestDigest = async () => {
    const res = await fetch(`${SITE_URL}/_api/contextinfo`, {
        method: 'POST',
        headers: jsonHeaders,
        credentials: 'same-origin'
    });
    const data = await res.json();
    return data.d.GetContextWebInformation.FormDigestValue;
};

export const getEntityType = async (listName) => {
    const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('${listName}')`, {
        headers: jsonHeaders,
        credentials: 'same-origin'
    });
    const json = await res.json();
    return json.d.ListItemEntityTypeFullName;
};

export const saveToSPList = async (listName, data, digest) => {
    const entityType = await getEntityType(listName);
    const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('${listName}')/items`, {
        method: 'POST',
        headers: {
            ...jsonHeaders,
            "Content-Type": "application/json;odata=verbose",
            "X-RequestDigest": digest
        },
        credentials: 'same-origin',
        body: JSON.stringify({ "__metadata": { "type": entityType }, ...data })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} guardando en ${listName}`);
    return res.json();
};

export const updateSPListItem = async (listName, itemId, data, digest) => {
    const entityType = await getEntityType(listName);
    const res = await fetch(`${SITE_URL}/_api/web/lists/getbytitle('${listName}')/items(${itemId})`, {
        method: 'POST',
        headers: {
            ...jsonHeaders,
            "Content-Type": "application/json;odata=verbose",
            "X-RequestDigest": digest,
            "X-HTTP-Method": "MERGE",
            "If-Match": "*"
        },
        credentials: 'same-origin',
        body: JSON.stringify({ "__metadata": { "type": entityType }, ...data })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} actualizando ${listName}`);
};

// Usuario conectado. Devuelve null si no hay sesion de SharePoint alcanzable
// (desarrollo local), para que App.jsx pueda caer al modo de pruebas.
//
// El correo se normaliza (minusculas, sin el prefijo de claims) porque de el
// depende el rol: el directorio guarda "Juan.A.Valencia@cerrejon.com" y una
// comparacion literal dejaria a ese usuario sin permisos de administrador.
// Cuando la cuenta no expone Email se usa LoginName, que siempre trae el UPN.
export const getCurrentUser = async () => {
    try {
        const res = await fetch(`${SITE_URL}/_api/web/currentuser?$select=Email,Title,LoginName,UserPrincipalName`, {
            headers: jsonHeaders,
            credentials: 'same-origin'
        });
        if (!res.ok) return null;
        const data = await res.json();
        const bruto = data.d?.Email || data.d?.UserPrincipalName || data.d?.LoginName || data.d?.Title;
        if (!bruto) return null;
        const email = normalizarCorreo(bruto);
        return { email, nombre: data.d?.Title || email };
    } catch {
        return null;
    }
};

// URL de la foto de perfil del directorio activo. Misma que usa el
// PeoplePicker del proyecto de referencia.
export const fotoDe = (email, size = 'S') =>
    `https://glencore.sharepoint.com/_layouts/15/userphoto.aspx?size=${size}&accountname=${encodeURIComponent(email || '')}`;

// ---------------------------------------------------------------------------
// Directorio activo: busqueda de personas mientras se escribe.
//
// El People Picker de SharePoint compara contra el DisplayText, que en este
// directorio viene como "Apellido, Nombre Segundo (Empresa - CO)". Segun por
// donde entre la consulta, escribir "Juan Valencia" no devuelve nada aunque la
// persona exista, y a veces solo funciona "Valencia, Juan".
//
// La estrategia es no depender del orden: se lanzan varias formas de la misma
// consulta, la palabra mas larga primero porque es la mas selectiva, y el
// filtro final lo hace el navegador exigiendo que TODAS las palabras escritas
// aparezcan en el nombre o el correo. Asi da igual como se escriba.
// ---------------------------------------------------------------------------

// Quita tildes: en el directorio conviven "Epiayú" y "Epiayu", y nadie deberia
// tener que acertar cual de las dos esta registrada.
const sinTildes = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// La coma de "Apellido, Nombre" y los parentesis de "(Empresa - CO)" no son
// parte de ninguna palabra.
const normalizar = (s) => sinTildes(s).toLowerCase().replace(/[,;.()]/g, ' ');

const palabras = (q) => normalizar(q).trim().split(/\s+/).filter(Boolean);

const pajarDe = (persona) => normalizar(`${persona.nombre || ''} ${persona.email || ''}`);

const coincideTodo = (persona, tokens) => {
    const pajar = pajarDe(persona);
    return tokens.every(t => pajar.includes(t));
};

const coincideAlguno = (persona, tokens) => {
    const pajar = pajarDe(persona);
    return tokens.some(t => pajar.includes(t));
};

/**
 * Formas a consultar, de la mas probable a la menos, sin repetir:
 * "Juan Valencia" -> ["Juan Valencia", "Valencia, Juan", "Valencia", "Juan"].
 * Las de una sola palabra traen a todos los que la comparten y el filtro local
 * se queda con quien ademas trae las otras.
 */
const variantesDeConsulta = (query) => {
    const tokens = palabras(query);
    const raw = query.trim();
    if (tokens.length < 2) return [raw];

    const ultimo = tokens[tokens.length - 1];
    const resto = tokens.slice(0, -1).join(' ');
    // Por longitud descendente: "Valencia" descarta mucho mas que "Juan".
    const sueltas = [...tokens].sort((a, b) => b.length - a.length);

    return [...new Set([raw, `${ultimo}, ${resto}`, ...sueltas])];
};

// Tope de sugerencias que se le piden a SharePoint por consulta. Con 10 un
// apellido comun dejaba fuera justo a la persona buscada antes de que el filtro
// local pudiera verla.
const MAX_SUGERENCIAS = 50;

export const buscarPersonas = async (query) => {
    const tokens = palabras(query);
    if (!tokens.length) return [];

    let respondio = false;
    const exactos = new Map();   // traen todas las palabras escritas
    const parciales = new Map(); // traen al menos una

    try {
        const digest = await getRequestDigest();
        for (const variante of variantesDeConsulta(query)) {
            const encontrados = await buscarEnDirectorio(variante, digest);
            respondio = true;
            encontrados.forEach(p => {
                if (coincideTodo(p, tokens)) {
                    if (!exactos.has(p.email)) exactos.set(p.email, p);
                } else if (coincideAlguno(p, tokens) && !parciales.has(p.email)) {
                    parciales.set(p.email, p);
                }
            });
            // Con coincidencias completas no hace falta seguir preguntando.
            if (exactos.size > 0) break;
        }
    } catch {
        // Fuera de la red corporativa el People Picker no responde (CORS): se
        // usa el directorio de demostracion. Si alguna variante si respondio,
        // el problema fue puntual y se conserva lo que ya se encontro.
        if (!respondio) return DIRECTORIO_DEMO.filter(p => coincideTodo(p, tokens));
    }

    if (exactos.size > 0) return [...exactos.values()];
    // Mejor ofrecer los parecidos que dejar el desplegable vacio: quien busca
    // "Juan Valenzia" (mal escrito) al menos ve a los Juan del directorio.
    return [...parciales.values()].slice(0, 15);
};

const buscarEnDirectorio = async (query, digestPrevio) => {
    const digest = digestPrevio || await getRequestDigest();
    const res = await fetch(
        `${SITE_URL}/_api/SP.UI.ApplicationPages.ClientPeoplePickerWebServiceInterface.clientPeoplePickerSearchUser`,
        {
            method: 'POST',
            headers: {
                ...jsonHeaders,
                "Content-Type": "application/json;odata=verbose",
                "X-RequestDigest": digest
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                queryParams: {
                    __metadata: { type: "SP.UI.ApplicationPages.ClientPeoplePickerQueryParameters" },
                    AllowEmailAddresses: true,
                    AllowMultipleEntities: false,
                    AllUrlZones: false,
                    MaximumEntitySuggestions: MAX_SUGERENCIAS,
                    PrincipalSource: 15,
                    PrincipalType: 1,
                    QueryString: query
                }
            })
        }
    );
    const data = await res.json();
    const encontrados = JSON.parse(data.d.ClientPeoplePickerSearchUser);
    return encontrados
        .map(u => ({
            nombre: u.DisplayText,
            // Key puede venir como claim ("i:0#.f|membership|juan@..."): se
            // normaliza para que el correo guardado sea siempre comparable.
            email: normalizarCorreo(u.EntityData?.Email || u.Key),
            manual: false
        }))
        .filter(p => p.email.includes('@'));
};

// ---------------------------------------------------------------------------
// Lista JerarquiaL: fuente oficial de las superintendencias de la empresa.
//
// SharePoint no acepta el titulo visible de la columna en la API REST (codifica
// los caracteres especiales), asi que primero resolvemos el nombre real contra
// /fields y despues pedimos los items.
// ---------------------------------------------------------------------------
const COL_SUPERINTENDENCIA = 'SUPERINTENDENCIA';

const getFieldName = async (siteUrl, listName, title) => {
    const url = `${siteUrl}/_api/web/lists/getbytitle('${listName}')/fields?$select=Title,EntityPropertyName,InternalName&$filter=Hidden eq false&$top=500`;
    const res = await fetch(url, { headers: jsonHeaders, credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status} leyendo columnas de ${listName}`);
    const json = await res.json();
    const fields = json.d?.results || [];
    const norm = (s) => (s || '').trim().toUpperCase();
    const f = fields.find(x => norm(x.Title) === norm(title))
        || fields.find(x => norm(x.InternalName) === norm(title))
        || fields.find(x => norm(x.Title).startsWith(norm(title)));
    return f ? f.EntityPropertyName : title;
};

// Trae todos los items siguiendo la paginacion (el tope duro es 5000 por peticion).
const getAllListItems = async (siteUrl, listName, selectCols) => {
    let url = `${siteUrl}/_api/web/lists/getbytitle('${listName}')/items?$select=${selectCols.join(',')}&$top=5000`;
    const all = [];
    let guard = 0;
    while (url && guard++ < 20) {
        const res = await fetch(url, { headers: jsonHeaders, credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status} leyendo ${listName}`);
        const json = await res.json();
        all.push(...(json.d?.results || []));
        url = json.d?.__next || null;
    }
    return all;
};

// En JerarquiaL cada fila es una division, asi que la misma superintendencia se
// repite muchas veces: hay que deduplicar antes de llenar el select.
export const fetchSuperintendencias = async () => {
    try {
        const campo = await getFieldName(SGIA_SITE_URL, JERARQUIA_LIST, COL_SUPERINTENDENCIA);
        const rows = await getAllListItems(SGIA_SITE_URL, JERARQUIA_LIST, [campo]);
        const unicas = [...new Set(rows.map(r => (r[campo] || '').trim()).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'es'));
        if (unicas.length) return { superintendencias: unicas, desdeSharePoint: true };
        return { superintendencias: SUPERINTENDENCIAS_FALLBACK, desdeSharePoint: false };
    } catch {
        // Fuera de la red corporativa esto siempre falla por CORS: seguimos con
        // el respaldo local en vez de dejar el formulario sin opciones.
        return { superintendencias: SUPERINTENDENCIAS_FALLBACK, desdeSharePoint: false };
    }
};

// Un registro viejo puede tener un valor que ya no existe en el catalogo. Lo
// anteponemos para no perderlo al editar.
export const conValorActual = (opciones, valor) =>
    valor && !opciones.includes(valor) ? [valor, ...opciones] : opciones;

// ---------------------------------------------------------------------------
// Base de datos: lista DB_GCOM
// ---------------------------------------------------------------------------
const DB_LIST = 'DB_GCOM';

// Lanza si la lista no responde. El llamador decide que hacer: al arrancar se
// empieza con la lista vacia, pero en el refresco automatico hay que conservar
// el cache; devolver [] ahi borraria de la pantalla todo lo que ya se ve.
export const getObservacionesDesdeSharePoint = async () => {
    const url = `${SGIA_SITE_URL}/_api/web/lists/getbytitle('${DB_LIST}')/items?$select=ID,Data&$top=5000`;
    const res = await fetch(url, { headers: jsonHeaders, credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status} leyendo ${DB_LIST}`);
    const json = await res.json();
    const items = json.d?.results || [];
    return items
        .map(item => {
            try {
                const data = JSON.parse(item.Data || '{}');
                return { ...data, _spId: item.ID };
            } catch {
                return null;
            }
        })
        .filter(Boolean);
};

export const saveObservacionToSharePoint = async (datos) => {
    try {
        const digest = await getRequestDigest();
        const dataJson = JSON.stringify(datos);
        const res = await fetch(`${SGIA_SITE_URL}/_api/web/lists/getbytitle('${DB_LIST}')/items`, {
            method: 'POST',
            headers: {
                ...jsonHeaders,
                "Content-Type": "application/json;odata=verbose",
                "X-RequestDigest": digest
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                "__metadata": { "type": "SP.ListItem" },
                "Data": dataJson
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        return result.d.ID;
    } catch (e) {
        console.error('Error guardando observación:', e);
        throw e;
    }
};

export const updateObservacionInSharePoint = async (spId, datos) => {
    try {
        const digest = await getRequestDigest();
        const dataJson = JSON.stringify(datos);
        const res = await fetch(`${SGIA_SITE_URL}/_api/web/lists/getbytitle('${DB_LIST}')/items(${spId})`, {
            method: 'POST',
            headers: {
                ...jsonHeaders,
                "Content-Type": "application/json;odata=verbose",
                "X-RequestDigest": digest,
                "X-HTTP-Method": "MERGE",
                "If-Match": "*"
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                "__metadata": { "type": "SP.ListItem" },
                "Data": dataJson
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
        console.error('Error actualizando observación:', e);
        throw e;
    }
};

// ---------------------------------------------------------------------------
// Carga de archivos a carpeta de evidencias (proyecto base: CheckList-Cerrejon)
// ---------------------------------------------------------------------------

// Limpia un texto para usarlo como nombre de carpeta/archivo en SharePoint
export const sanitizeSPName = (name) =>
    (name || '')
        .replace(/[~"#%&*:<>?/\\{|}']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || 'SinNombre';

// Crea una carpeta (idempotente). Si ya existe, SharePoint responde error y se ignora.
export const ensureFolder = async (serverRelativeUrl, digest) => {
    try {
        const res = await fetch(`${AC_SITE_URL}/_api/web/folders/addUsingPath(DecodedUrl='${encodeURIComponent(serverRelativeUrl)}')`, {
            method: 'POST',
            headers: { "Accept": "application/json;odata=verbose", "X-RequestDigest": digest },
            credentials: 'same-origin'
        });
        return res.ok;
    } catch {
        return false;
    }
};

// Sube un archivo binario a una carpeta del document library
export const uploadFileToFolder = async (folderUrl, fileName, body, digest) => {
    const url = `${AC_SITE_URL}/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(folderUrl)}')/Files/add(url='${encodeURIComponent(fileName)}',overwrite=true)`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'X-RequestDigest': digest,
            'Accept': 'application/json;odata=verbose'
        },
        body,
        credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} subiendo ${fileName}`);
    return res.json();
};

// Convierte un File a ArrayBuffer
export const fileToArrayBuffer = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

// Sufijos que distinguen el origen de la evidencia dentro de la MISMA carpeta:
// las fotos de la observacion terminan en "_ob" y las de un hallazgo en "_hall".
export const TIPO_EVIDENCIA = {
    OBSERVACION: 'ob',
    HALLAZGO: 'hall'
};

// Separa "foto1.jpg" en ["foto1", ".jpg"] para poder insertar el sufijo antes
// de la extension; sin extension devuelve el nombre completo y cadena vacia.
const partirExtension = (nombre) => {
    const i = (nombre || '').lastIndexOf('.');
    return i > 0 ? [nombre.slice(0, i), nombre.slice(i)] : [nombre || 'archivo', ''];
};

// Nombre final: NombreResponsable_yyyymmddhhmmss_nombreOriginal_ob.jpg
// El sello lleva minutos y segundos porque dos fotos de la misma persona en la
// misma hora con igual nombre original se sobreescribian entre si.
export const nombreDeEvidencia = (nombreArchivo, nombreResponsable, tipo, ahora = new Date()) => {
    const p = (n) => String(n).padStart(2, '0');
    const sello = `${ahora.getFullYear()}${p(ahora.getMonth() + 1)}${p(ahora.getDate())}${p(ahora.getHours())}${p(ahora.getMinutes())}${p(ahora.getSeconds())}`;
    const [base, ext] = partirExtension(sanitizeSPName(nombreArchivo));
    return `${sanitizeSPName(nombreResponsable)}_${sello}_${base}_${tipo}${ext}`;
};

// Sube una foto a la carpeta de evidencias.
export const subirFotoEvidencia = async (file, nombreResponsable, tipo = TIPO_EVIDENCIA.OBSERVACION) => {
    try {
        const digest = await getRequestDigest();
        const nombreConExtension = nombreDeEvidencia(file.name, nombreResponsable, tipo);

        // Asegurar que la carpeta existe
        await ensureFolder(EVIDENCIAS_BASE, digest);

        // Convertir archivo a binario
        const arrayBuffer = await fileToArrayBuffer(file);

        // Subir archivo
        const result = await uploadFileToFolder(EVIDENCIAS_BASE, nombreConExtension, arrayBuffer, digest);

        return {
            nombre: nombreConExtension,
            tipo,
            url: result.d.ServerRelativeUrl ? `https://glencore.sharepoint.com${result.d.ServerRelativeUrl}` : result.d.LinkingUrl
        };
    } catch (e) {
        console.error('Error subiendo foto:', e);
        throw e;
    }
};
