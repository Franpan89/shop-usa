-- Seguridad a nivel de fila: ninguna tabla se puede leer ni escribir desde el navegador.
-- La app accede solo por el servidor (Prisma, rol dueño de las tablas, que ignora RLS),
-- así que NO se crean políticas: sin políticas, los roles anon/authenticated (API pública
-- de Supabase, llave anon visible en el navegador) no ven ni modifican nada.
-- Idempotente. Volver a correr después de agregar tablas nuevas:
--   npx tsx scripts/apply-rls.ts
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\_prisma%' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
