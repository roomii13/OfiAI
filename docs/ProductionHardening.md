# Correcciones previas a Cloudflare

Fecha: 2026-10-04. No se realizaron despliegues ni se activaron cobros.

## Backend empaquetado

- Dockerfile actualizado a Node 22 Alpine en ambas etapas, compatible con Node >=22.13.
- Contexto de construccion: raiz del repositorio; copia backend/src y shared/*.d.ts.
- Imagen final: dependencias de produccion, dist y usuario sin privilegios (node).
- Dockerfile.dockerignore limita el contexto y excluye secretos.
- Deployment.md y docs/Deployment.md corregidos.

Desde la raiz:

```sh
docker build -f backend/Dockerfile -t ofiai-backend:local .
```

Docker no esta instalado en el equipo: NO se ejecuto una imagen Linux.
Se reprodujo el contenido del contexto en una carpeta temporal sin .env ni claves:
npm ci, compilacion TypeScript, reinstalacion con npm ci --omit=dev y arranque
de la aplicacion empaquetada. GET /api/v1/health/liveness devolvio 200.
Esta comprobacion se ejecuto con Node 24.19.0 en Windows; falta docker build/run.

## Sesion movil

- Firebase invalida al usuario: se limpian UI, token HTTP, perfil persistido y Firebase Auth.
- /auth/me con 401 o 403: se descarta el cache y se vuelve al login.
- Un 403 de permisos en otro recurso NO cierra la sesion.
- Solo se permite usar el perfil cacheado del mismo UID ante fallas transitorias.
- Las respuestas tardias no restauran una sesion cerrada.
- Las escrituras de perfil en SecureStore quedan ordenadas para evitar carreras.
- Logout local no espera a la API. La revocacion remota se intenta durante hasta 5 segundos.
- Las peticiones HTTP tienen timeout de 60 segundos, cancelacion y errores tipados.
- El perfil local no guarda ID tokens reales; Firebase conserva su persistencia segura existente.

Sin conexion no se puede garantizar revocacion remota. El cierre local y el intento
remoto son operaciones distintas; no se presenta el segundo como garantizado.

## Dependencias

Se conservan Expo 54.0.37, React Native 0.81.5 y Metro 0.83.3 usado por Expo.
Actualizaciones acotadas:

- Backend: @fastify/busboy 3.2.2.
- Web y mobile: @grpc/grpc-js 1.14.5.
- Mobile: image-size 2.0.4 y decode-uri-component 0.5.0.

Los dos parches de mobile/patches se aplican con patch-package en postinstall:

- Metro: leer la imagen antes de pasarsela a image-size 2, que ya no admite rutas.
- query-string 7: acceder al export default del nuevo decodificador ESM.

La instalacion limpia npm ci aplica ambos parches. No usar --ignore-scripts para
compilar mobile. EAS/CI necesita las devDependencies para construir la aplicacion.
No actualizar Metro globalmente: otras versiones rompieron el observador de Expo 54.
Ejecutar npm run test:dependencies al cambiar el lockfile o los parches.

### Audit final

| Proyecto | Completo | npm audit --omit=dev |
| --- | --- | --- |
| Backend | 3 altas | 0 |
| Web | 5 altas | 0 |
| Mobile | 46 altas | 40 altas |

Sin moderadas ni criticas. Son paquetes afectados por propagacion, no 54 fallas
independientes. Quedan dos avisos raiz:

- [braces: recursion sin limite](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- [node-forge: validacion de firmas RSA](https://github.com/advisories/GHSA-86w9-cpqp-85rv).

Ambos carecen de version corregida publicada segun npm y sus avisos oficiales al
momento de la revision. No se aplico audit fix --force, no se ocultaron alertas
ni se reemplazo codigo criptografico con una implementacion propia.
En mobile, Expo y sus herramientas tambien figuran como dependencias de produccion:
--omit=dev no equivale al contenido real del APK. No se afirmo que todas las rutas
vulnerables sean alcanzables desde la app; tampoco se dio ese riesgo por descartado.
Mantener Metro local y procesar solo assets/configuraciones confiables mientras
se resuelven los avisos. Es una mitigacion operativa, NO un parche.

## Verificaciones

- Backend: 26 suites, 269 tests; lint y compilacion aprobados.
- Web: 8 suites, 86 tests; lint y build aprobados.
- Mobile: TypeScript aprobado; 11 suites Jest, 51 tests y 4 pruebas del toolchain.
- npm ci movil: aplicacion reproducible de los dos parches.
- Expo Doctor: 18/18 comprobaciones.
- Export Android de produccion con EXPO_PUBLIC_ENABLE_DEMO_ACCESS=false: aprobado.
- Emulador Pixel_6_Pro, Android 17, Expo Go 54.0.8: login visible sin redbox,
  entrada demo empresa, dashboard, configuracion, persistencia al reiniciar,
  cierre de sesion y regreso al login despues de otro reinicio.

La prueba nativa uso modo demo solo en el proceso de Metro, no se modifico .env.
La API real no estaba arrancada: las pantallas de datos mostraron el error de red
esperado. Esta evidencia NO demuestra un flujo remoto con datos reales ni la
renovacion de Firebase en un dispositivo real. Los rechazos 401/403, usuario null,
token revocado y API sin respuesta se verificaron con pruebas de regresion aisladas.

## Pendientes

1. Resolver los avisos restantes mediante versiones corregidas o parches revisados.
2. Ejecutar docker build/run en un host con Docker antes de aceptar la imagen.
3. Validar sesion Firebase real, caducidad/renovacion y revocacion en staging y dispositivos.
4. Validar un build firmado Android y la aplicacion iOS.
5. Proxima fase: adaptar y validar Cloudflare, dominios, CORS, secretos y URLs finales.
6. Mantener cobros y produccion desactivados hasta la validacion explicita del entorno.

Persisten avisos no bloqueantes del build web (chunk grande y configuracion futura
de Vite) y de act() en algunas pruebas de pantallas moviles preexistentes.
