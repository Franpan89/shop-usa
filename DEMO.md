# Instancia DEMO

Misma base de código, pero con su propio Supabase, su propio Vercel y datos 100 % ficticios.
Vive en la rama `demo`. Nunca apuntes `.env.demo` a la base de producción: el seed **borra** los datos de negocio.

## Variables (`.env.demo` en local y Environment Variables en el Vercel del demo)

```
DEMO_MODE=true
DEMO_PASSWORD=<contraseña de las 3 cuentas demo>
NEXT_PUBLIC_BRAND_NAME=Courier Demo
NEXT_PUBLIC_SITE_URL=https://<dominio-del-demo>
DATABASE_URL=<cadena de conexión del Supabase del demo>
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=<texto largo aleatorio>
```

Sin `SQUARE_*` (el botón de tarjeta no aparece) y sin `RESEND_API_KEY` (en demo nunca se envían correos).

## Puesta en marcha

1. Crear el proyecto de Supabase del demo y llenar `.env.demo`.
2. `npx dotenv -e .env.demo -- prisma db push` (o `DATABASE_URL=... npx prisma db push`) para crear las tablas.
3. Aplicar `prisma/rls.sql` con `scripts/apply-rls.ts` apuntando a la base del demo.
4. `npm run seed:demo` — siembra la configuración y los 15 clientes con sus historias.
5. Crear el proyecto de Vercel desde la rama `demo` con las mismas variables.

## Restablecer el demo

`npm run seed:demo` deja todo como al inicio (borra y vuelve a crear). Se puede automatizar con un cron.

## Cuentas (botones en /login)

- Administrador — panel completo
- Equipo (subadmin) — sin configuraciones ni usuarios
- Cliente (María Fernanda Salazar) — portal del cliente
