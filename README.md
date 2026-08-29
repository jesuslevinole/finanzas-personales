# Bolívar Vivo — Finanzas personales para Venezuela

App React + TypeScript + Vite + Firebase (Auth con Google + Firestore) pensada para vivir con inflación: **registras en bolívares y todo se analiza en dólares BCV** con la tasa del día de cada movimiento.

## Puesta en marcha

```bash
npm install
cp .env.example .env      # pega las credenciales de tu proyecto Firebase
npm run dev
```

El proyecto ya viene apuntando a Firebase `finanzas-personales-5b660` (`.env` y `.env.production` incluidos).

Falta hacer una sola vez en Firebase Console:
1. **Authentication → Sign-in method**: habilitar **Anónimo** (la app entra sola, sin pantalla de login) y, opcionalmente, **Google** para vincular la cuenta después.
2. **Firestore Database**: crear la base en modo producción y pegar el contenido de `firestore.rules` en la pestaña Rules.
3. **Authentication → Settings → Authorized domains**: agregar `localhost` y el dominio de Cloudflare (`tu-proyecto.pages.dev` y tu dominio propio si lo usas). Sin esto el login con Google falla en producción.

La app abre directamente en el resumen con una sesión de invitado. Desde la barra lateral puedes **Vincular con Google** cuando quieras, y tus datos se conservan.

Primer uso: entra en **Ajustes → Cargar rubros sugeridos** y en **Tasa BCV → Actualizar desde BCV**.

## Módulos

| Ruta | Qué hace |
|---|---|
| `/recordatorios` | Lo urgente por pagar o comprar, agrupado por **semana de cobro (sábado → viernes)**: vencido, esta semana, lo que viene y qué reponer en casa |
| `/` Resumen | Ingresos/gastos/balance del mes en USD, dona por rubro, gasto acumulado, devaluación del mes, vencimientos, costos fijos, despensa |
| `/movimientos` | Gastos (lugar, rubro, producto, precio en Bs o $, cantidad, tasa) e ingresos (propio / de tercero). Opción de sumar el gasto al inventario |
| `/costos-fijos` | Cuotas mensuales en USD con día de pago y estado; copiar del mes anterior |
| `/deudas` | Cuotas (Cashea, préstamos…) con vencimiento; crea N cuotas cada X días de una vez |
| `/presupuesto` | Regla 50/30/20 sobre el ingreso propio + tope por rubro (declarado o sugerido por %) |
| `/reportes` | **Capacidad de endeudamiento**, cuánto gastar por grupo/rubro, tasa de ahorro, fondo de emergencia, ingresos vs gastos 6 meses, **inflación real** (devaluación y productos que más subieron en $) |
| `/inventario` | Stock en casa, mínimo por producto, historial de precios en $ por compra, enviar a lista |
| `/compras` | **Carpetas de compra**: una por salida (Maraplus, Finca…), con tope de gasto. Dentro agregas productos escribiendo o **dictando por voz**, y al agarrar cada uno cargas su precio real en Bs o $ mientras la barra suma contra el tope |
| `/tasa` | Tasa BCV diaria (API pública `ve.dolarapi.com` + carga manual), convertidor, historial |
| `/catalogos` | Rubros, lugares, acreedores y orígenes de ingreso: color, activo/inactivo, uso en registros |
| `/importar` | Lee el Excel (TASA_BCV, BD_INGRESOS, BD_GASTOS, BD_COSTOSFIJOS, BD_DEUDAS, LISTA, URGENCIAS), crea los catálogos que falten y carga todo a Firestore |
| `/usuarios` | Roles con tres niveles por módulo (sin acceso / ver / editar) y usuarios invitados por correo |
| `/metas` | Metas de ahorro (fondo de emergencia, compras, salir de deuda) con aportes, progreso y aporte mensual necesario |
| `/ajustes` | Techo de deuda, meses de fondo de emergencia, meta de ahorro mensual, tamaño del hogar y reparto del ingreso |

## Estructura

```
src/
  index.css            ← hoja principal: tokens (--color-*, --space-*, tipografía), reset y clases globales (.card, .btn-*, .tag, .bar, .grid-*)
  App.css              ← cascarón (sidebar escritorio / barra inferior móvil)
  types/index.ts       ← única fuente de tipos
  utils/finance.ts     ← toda la lógica de reportes (capacidad de deuda, 50/30/20, inflación…)
  services/firestore.ts← CRUD genérico tipado bajo users/{uid}/{colección}
  context/             ← AuthProvider y DataProvider (un solo onSnapshot por colección, las vistas no re-fetchean)
  hooks/               ← useAuth, useData, useMonth, useLiveRate
  components/ui/       ← Money, StatCard, Modal, Donut, Sparkline, MonthPicker, ProgressBar, EmptyState, CustomSelect (cada uno con su .css hermano)
  utils/relations.ts   ← getRelationName/getRelationColor: resuelven un id contra cualquier catálogo
  utils/access.ts      ← módulos, niveles de acceso y roles sugeridos
  utils/excel.ts       ← traducción de las hojas del Excel al modelo de la app
  views/               ← una vista por ruta, con su .css hermano
```

## Tablas, filtros y detalle

Todos los módulos de datos (movimientos, deudas, costos fijos, inventario, tasas, recordatorios, compras) usan el mismo componente `DataTable`: tabla en escritorio y tarjetas etiquetadas en móvil, con la fila clicable para abrir la ficha de detalle (`DetailSheet`) y botones de editar/eliminar tanto en la fila como en el detalle. Los filtros (`FilterBar`) recalculan las tarjetas de totales que están arriba, así que ves el total del subconjunto filtrado, no del mes completo.

## Reportes y recomendaciones

`utils/finance.ts` calcula un puntaje de salud financiera (0–100) sobre cinco componentes —ahorro, peso de la deuda, costos fijos, fondo de emergencia y gasto en deseos— y genera recomendaciones ordenadas por urgencia con `buildAdvice`. Las gráficas de barras (`BarChart`) comparan gasto real contra tope por rubro, el reparto real contra el objetivo, y seis meses de ingresos contra gastos.

## Ciclo de cobro

`utils/cycle.ts` define la semana de pago: empieza el sábado (día de cobro) y termina el viernes siguiente. Recordatorios, deudas y costos fijos muestran cuánto cae dentro de esa ventana, no del mes calendario.

## Convenciones

Se siguen las reglas de `CLAUDE.md`: sin `style={{}}` salvo variables CSS para valores de runtime (colores de rubro, anchos de barra, gradiente de la dona), estados finitos con clases modificadoras, hover solo en CSS, sin `any`, `<ul>/<li>` y `<dl>` semánticos, handlers que reciben el ítem explícito.

Verificación: `npm run typecheck`, `npm run lint`, `grep -rn "style={{" src` (todo debe ser `as CSSProperties`).

## Despliegue en Cloudflare Pages

| Campo | Valor |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (vacío, o la carpeta del proyecto si va dentro de un monorepo) |

Variables de entorno (Settings → Environment variables, marcarlas para **Production** y **Preview**):

```
VITE_FIREBASE_API_KEY=AIzaSyC5Q2GTWbJw7s9pvcf7DJZcDn2OAcbp4DQ
VITE_FIREBASE_AUTH_DOMAIN=finanzas-personales-5b660.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=finanzas-personales-5b660
VITE_FIREBASE_STORAGE_BUCKET=finanzas-personales-5b660.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=16202127413
VITE_FIREBASE_APP_ID=1:16202127413:web:3fbba17c85cafc1fb8b97c
NODE_VERSION=20
```

Notas:
- El manejo de rutas SPA va en `wrangler.jsonc` (`not_found_handling: "single-page-application"`). NO uses `public/_redirects` con `/* /index.html 200`: en Workers Assets el deploy falla con "Infinite loop detected in this rule".
- `.env.production` se versiona a propósito, así el build funciona aunque olvides cargar las variables en el panel. Si prefieres no versionarlo, bórralo y deja solo las variables del panel.
- Tras el primer deploy, agrega el dominio `*.pages.dev` a los dominios autorizados de Firebase Authentication.

## Pendientes sugeridos

- Cuentas/saldos (Bs, USD efectivo, USDT Binance) con transferencias entre ellas.
- Recordatorios push para cuotas que vencen.
- Editar movimientos ya cargados (hoy se crean y se eliminan).
- Code-splitting por ruta (`React.lazy`) para bajar el bundle inicial.
