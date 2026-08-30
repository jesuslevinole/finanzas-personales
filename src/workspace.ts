/**
 * Espacio de datos compartido.
 *
 * La app no tiene sesiones: cualquiera que abra la URL ve y edita los mismos
 * datos. Por debajo sigue habiendo un usuario anónimo de Firebase (Firestore
 * exige uno para no dejar la base abierta a internet), pero el `ownerId` de
 * todos los documentos es esta constante, no el uid del dispositivo.
 *
 * Para separar espacios (por ejemplo, una copia de pruebas), define
 * VITE_WORKSPACE_ID en el entorno.
 */
export const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined) ?? 'casa';
