-- Push subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notification logs to guarantee idempotency by day/window/subscription
CREATE TABLE IF NOT EXISTS public.maintenance_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  notification_date DATE NOT NULL,
  window_type TEXT NOT NULL,
  payload_hash TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  response_status INTEGER,
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_notification_logs_unique_window UNIQUE (subscription_id, notification_date, window_type)
);

-- Runtime config for VAPID + protected cron token (single row)
CREATE TABLE IF NOT EXISTS public.notification_runtime_config (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  vapid_public_key TEXT NOT NULL,
  vapid_private_key TEXT NOT NULL,
  vapid_subject TEXT NOT NULL DEFAULT 'mailto:suporte@localhost.local',
  cron_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extensions required for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON public.push_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_maintenance_notification_logs_date_window ON public.maintenance_notification_logs(notification_date, window_type);

-- Enable RLS and block direct client access (backend functions only)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_runtime_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'No direct read access to push_subscriptions'
  ) THEN
    CREATE POLICY "No direct read access to push_subscriptions"
      ON public.push_subscriptions FOR SELECT TO anon, authenticated USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'No direct insert access to push_subscriptions'
  ) THEN
    CREATE POLICY "No direct insert access to push_subscriptions"
      ON public.push_subscriptions FOR INSERT TO anon, authenticated WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'No direct update access to push_subscriptions'
  ) THEN
    CREATE POLICY "No direct update access to push_subscriptions"
      ON public.push_subscriptions FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'No direct delete access to push_subscriptions'
  ) THEN
    CREATE POLICY "No direct delete access to push_subscriptions"
      ON public.push_subscriptions FOR DELETE TO anon, authenticated USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'maintenance_notification_logs' AND policyname = 'No direct read access to maintenance_notification_logs'
  ) THEN
    CREATE POLICY "No direct read access to maintenance_notification_logs"
      ON public.maintenance_notification_logs FOR SELECT TO anon, authenticated USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'maintenance_notification_logs' AND policyname = 'No direct insert access to maintenance_notification_logs'
  ) THEN
    CREATE POLICY "No direct insert access to maintenance_notification_logs"
      ON public.maintenance_notification_logs FOR INSERT TO anon, authenticated WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'maintenance_notification_logs' AND policyname = 'No direct update access to maintenance_notification_logs'
  ) THEN
    CREATE POLICY "No direct update access to maintenance_notification_logs"
      ON public.maintenance_notification_logs FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'maintenance_notification_logs' AND policyname = 'No direct delete access to maintenance_notification_logs'
  ) THEN
    CREATE POLICY "No direct delete access to maintenance_notification_logs"
      ON public.maintenance_notification_logs FOR DELETE TO anon, authenticated USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_runtime_config' AND policyname = 'No direct read access to notification_runtime_config'
  ) THEN
    CREATE POLICY "No direct read access to notification_runtime_config"
      ON public.notification_runtime_config FOR SELECT TO anon, authenticated USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_runtime_config' AND policyname = 'No direct insert access to notification_runtime_config'
  ) THEN
    CREATE POLICY "No direct insert access to notification_runtime_config"
      ON public.notification_runtime_config FOR INSERT TO anon, authenticated WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_runtime_config' AND policyname = 'No direct update access to notification_runtime_config'
  ) THEN
    CREATE POLICY "No direct update access to notification_runtime_config"
      ON public.notification_runtime_config FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_runtime_config' AND policyname = 'No direct delete access to notification_runtime_config'
  ) THEN
    CREATE POLICY "No direct delete access to notification_runtime_config"
      ON public.notification_runtime_config FOR DELETE TO anon, authenticated USING (false);
  END IF;
END $$;

-- Reuse existing updated_at trigger function for consistency
DROP TRIGGER IF EXISTS set_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER set_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_clients_updated_at();

DROP TRIGGER IF EXISTS set_notification_runtime_config_updated_at ON public.notification_runtime_config;
CREATE TRIGGER set_notification_runtime_config_updated_at
BEFORE UPDATE ON public.notification_runtime_config
FOR EACH ROW
EXECUTE FUNCTION public.set_clients_updated_at();