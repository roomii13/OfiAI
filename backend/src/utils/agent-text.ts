/** @archivo agent-text.ts @descripcion Minimiza credenciales accidentales antes de persistir o enviar texto a IA. */
/** Redacta formatos conocidos; no sustituye permisos ni garantiza detectar todo dato sensible. */
export function redactSecrets(value:string):string {
  return value.replace(/(?:gsk_[a-zA-Z0-9_-]{16,}|sk-[a-zA-Z0-9_-]{16,}|AIza[a-zA-Z0-9_-]{25,}|AQ\.[a-zA-Z0-9_-]{20,}|Bearer\s+[a-zA-Z0-9._-]+|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|-----BEGIN[\s\S]*?-----END[^-]*-----)/gi,'[credencial omitida]')
    .replace(/\b(?:password|contrasena|contraseña|api[_ -]?key|token|secreto)\s*[:=]\s*\S+/gi,'[credencial omitida]')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
}
