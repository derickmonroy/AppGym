-- Mi Entreno · Programador de recordatorios con Supabase Cron (gratis)
--
-- Ejecútalo DESPUÉS de publicar la app en Vercel y de configurar CRON_SECRET allí.
-- Cada minuto, Supabase llama a tu app; la app decide qué recordatorios tocan y envía los push.
--
-- ANTES DE EJECUTAR, reemplaza (aquí mismo en el SQL Editor, no en el chat):
--   1) TU-APP.vercel.app  → el dominio real de tu app en Vercel
--   2) PEGA-AQUI-TU-CRON-SECRET → el mismo valor que pusiste en Vercel como CRON_SECRET
-- Los valores se guardan cifrados en Supabase Vault, no en texto plano en la tarea.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Guarda la URL y la clave en Vault (si ya existen, bórralas primero en Vault o usa vault.update_secret).
select vault.create_secret('https://TU-APP.vercel.app/api/cron/reminders', 'mi_entreno_reminders_url');
select vault.create_secret('PEGA-AQUI-TU-CRON-SECRET', 'mi_entreno_cron_secret');

-- Si ya existía la tarea, la quitamos para no duplicarla.
select cron.unschedule(jobid) from cron.job where jobname = 'mi-entreno-recordatorios';

select cron.schedule(
  'mi-entreno-recordatorios',
  '* * * * *',  -- cada minuto
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'mi_entreno_reminders_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mi_entreno_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- ───────── Comprobaciones útiles ─────────
-- Ver la tarea:            select * from cron.job;
-- Últimas ejecuciones:     select * from cron.job_run_details order by start_time desc limit 10;
-- Respuestas de tu app:    select id, status_code, content, created from net._http_response order by created desc limit 10;
-- Pausar recordatorios:    select cron.unschedule('mi-entreno-recordatorios');
