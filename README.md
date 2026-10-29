# Mi Entreno 💪

App web personal (PWA) para planificar entrenamientos y recibir **notificaciones push reales** en el iPhone, aunque la app esté cerrada.

- **Hoy:** el próximo entrenamiento con cuenta regresiva y las sesiones de hoy, con botones para marcarlas como completadas o saltadas.
- **Semana:** un calendario de lunes a domingo, la lista de tus entrenamientos y la opción de agregar uno en cualquier día.
- **Historial:** los últimos 30 días con completados, saltados, sin marcar y tu porcentaje de cumplimiento.
- **Ajustes:** activar o desactivar las notificaciones, enviar una de prueba y elegir el aviso (a la hora, 15 o 30 min antes).
- Todas las horas usan **America/New_York**.

Para cambiar el nombre de la app, edita `lib/config.ts` (`APP_NAME`).

## Cómo funciona

| Pieza | Servicio | Costo |
|---|---|---|
| App y API | Next.js en **Vercel** (plan Hobby) | $0 |
| Cuenta, base de datos y seguridad | **Supabase** (plan Free), con Row Level Security | $0 |
| Programador de recordatorios | **Supabase Cron** (pg_cron + pg_net), que se ejecuta cada minuto | $0 |
| Envío de notificaciones | Web Push con claves VAPID, hacia el servicio push de Apple | $0 |

Cada minuto, Supabase Cron llama a `/api/cron/reminders` con una clave secreta. La app calcula qué recordatorios tocan y los envía a tus dispositivos. Además, guarda cuáles ya mandó para no repetirlos.

**Limitaciones:**
- Los avisos pueden llegar hasta ~1 minuto tarde, y Apple decide el momento exacto de entrega.
- Supabase Free pausa los proyectos con poca actividad durante 7 días. Si eso pasa, los recordatorios se detienen hasta que lo reanudes desde el panel con **Resume project**. Supabase te avisa por correo antes.

No se usa Vercel Cron porque el plan Hobby solo permite tareas una vez al día, con hasta 59 min de desfase.

---

## Publicarla (paso a paso)

> No pegues contraseñas, claves ni secretos en ningún chat. Solo van en Supabase, en Vercel y en `.env.local` (que no se sube).

### 1. Supabase: base de datos y cuenta
1. Entra en **supabase.com** → **Start your project** → inicia sesión con GitHub.
2. **New project**. Nombre: `mi-entreno`. Región: **East US**. Guarda la contraseña de la base de datos en tu gestor de contraseñas.
3. Cuando termine de crearse, ve a **SQL Editor** → **New query**. Pega todo el archivo `supabase/schema.sql` y toca **Run**.
4. Ve a **Project Settings → API Keys** (y **Data API** para la URL). Necesitarás estos valores en el paso 3:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`, o `anon` en la pestaña Legacy) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Secret key** (`sb_secret_…`, o `service_role` en Legacy) → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ secreta

### 2. GitHub: subir el código
1. En **github.com** toca **+** (arriba a la derecha) → **New repository**.
2. Nombre: `mi-entreno`. Marca **Private**. No agregues README ni .gitignore. Toca **Create repository**.
3. En la página del repositorio vacío, toca **uploading an existing file**.
4. En Finder abre `Documentos/mi-entreno` y pulsa **Cmd + Shift + .** para ver los archivos ocultos (`.gitignore`, `.env.example`).
5. Selecciona todo el contenido de la carpeta, **no la carpeta misma**, y arrástralo a la página. Toca **Commit changes**.

### 3. Vercel: publicar
1. Entra en **vercel.com** → **Sign Up** → **Continue with GitHub** y autoriza el acceso.
2. **Add New… → Project** → busca `mi-entreno` → **Import**. Si no aparece, toca **Adjust GitHub App Permissions** y dale acceso al repositorio.
3. Abre **Environment Variables** y agrega las tres variables de Supabase del paso 1.
4. Toca **Deploy**. Al terminar tendrás un enlace del tipo `https://mi-entreno-xxxx.vercel.app`.

### 4. Claves de notificaciones (VAPID) y CRON_SECRET
1. Abre `https://TU-APP.vercel.app/configurar` y toca **Generar claves**. Se generan en tu navegador y no se envían a ningún lado.
2. En Vercel → tu proyecto → **Settings → Environment Variables**, agrega:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY` ⚠️
   - `CRON_SECRET` ⚠️
   - `VAPID_SUBJECT` = `mailto:tu-correo@gmail.com`
3. Ve a **Deployments** → en el último despliegue toca **⋯ → Redeploy**. Es necesario para que se apliquen las variables.

### 5. Supabase: dirección de la app y tu usuario
1. En Supabase → **Authentication → URL Configuration**:
   - **Site URL**: `https://TU-APP.vercel.app`
   - **Redirect URLs**: agrega `https://TU-APP.vercel.app/**`
2. Abre tu app → **¿Primera vez? Crear cuenta** → usa tu correo y una contraseña de al menos 8 caracteres. Confirma desde el correo que te llega y luego inicia sesión.
3. Para que nadie más pueda registrarse: **Authentication → Sign In / Providers → Allow new users to sign up** → desactívalo y guarda. Aunque alguien se registrara, no vería tus datos gracias a RLS, pero así es más seguro.

### 6. Supabase Cron: activar los recordatorios automáticos
1. Supabase → **SQL Editor** → **New query** → pega `supabase/cron.sql`.
2. **En el editor**, reemplaza `TU-APP.vercel.app` por tu dominio y `PEGA-AQUI-TU-CRON-SECRET` por el mismo valor que pusiste en Vercel.
3. Toca **Run**. Para comprobar que funciona, ejecuta al minuto:
   `select status_code, content from net._http_response order by created desc limit 3;`
   Deberías ver `200` y `"ok":true`. Si ves `401`, el CRON_SECRET no coincide.

---

## En el iPhone (iOS 16.4 o superior)
1. Abre tu enlace en **Safari**. Tiene que ser Safari.
2. Toca **Compartir** (cuadro con flecha) → **Agregar a pantalla de inicio** → **Agregar**.
3. Abre **Mi Entreno desde el icono** e inicia sesión. Es una sesión distinta a la de Safari.
4. Ve a **Ajustes** → **Activar notificaciones** → **Permitir**.
5. Toca **Enviar notificación de prueba**, sal de la app y espera unos segundos.
6. Prueba real: crea un entrenamiento para dentro de 20 min con el aviso "15 min antes". Deberías recibirlo unos 5 min después, con la app cerrada.

### Si algo falla
- **No aparece el botón de activar:** la app no se abrió desde el icono de inicio.
- **"Bloqueadas":** en el iPhone ve a **Ajustes → Notificaciones → Mi Entreno → Permitir notificaciones**.
- **"Falta configurar el servidor":** faltan las variables VAPID en Vercel o no hiciste Redeploy.
- **La prueba llega pero los recordatorios no:** revisa el paso 6 (`net._http_response`) y que el proyecto de Supabase no esté pausado.
- **Modo concentración (Focus):** puede silenciar los avisos. Agrega Mi Entreno a las apps permitidas.

## Desarrollo local (opcional)
Necesitas Node 20 o superior.
```bash
cp .env.example .env.local   # y rellena los valores
npm install
npm run dev                  # http://localhost:3000
npm test                     # pruebas de la lógica de horarios
```

## Estructura
```
app/                 páginas (/, /login, /configurar), manifest y API
  api/push/subscribe guardar o borrar la suscripción push del dispositivo
  api/push/test      notificación de prueba
  api/cron/reminders la llama Supabase Cron cada minuto
components/          interfaz (Hoy, Semana, Historial, Ajustes, formulario)
lib/schedule.ts      fechas, repeticiones y zona horaria America/New_York
lib/push.ts          envío Web Push (VAPID)
public/sw.js         service worker (recibe los push)
supabase/schema.sql  tablas y seguridad (RLS)
supabase/cron.sql    tarea programada cada minuto
```
