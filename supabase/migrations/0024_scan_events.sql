-- Migration: 0024_scan_events.sql
-- Spec 003-tag-qr, T016 (data-model.md; contracts/rls-expectations.md). Leituras do QR.
-- Isolamento entre vinculos: cada scan referencia o vinculo vigente (assignment_id). O tutor so le scans dos
-- SEUS vinculos; scans de um vinculo antigo nunca aparecem para o novo dono.
-- Colunas sensiveis (ip_hash, location_token_hash, location_token_expires_at, notified_at, notify_attempts)
-- nunca sao concedidas a `authenticated`: o privilegio e por coluna.

CREATE TABLE public.scan_events (
  id                        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_code                  character(9) NOT NULL REFERENCES public.tag_codes (code),
  -- Nulo quando a tag nao estava vinculada no momento do scan.
  assignment_id             uuid         REFERENCES public.tag_assignments (id),
  status_at_scan            text         NOT NULL CHECK (status_at_scan IN ('available', 'assigned', 'blocked', 'void')),
  occurred_at               timestamptz  NOT NULL DEFAULT now(),
  last_seen_at              timestamptz  NOT NULL DEFAULT now(),
  -- HMAC com segredo do servidor; nunca o IP.
  ip_hash                   text         NOT NULL CHECK (char_length(ip_hash) BETWEEN 1 AND 128),
  geo_method                text         NOT NULL CHECK (geo_method IN ('none', 'ip', 'gps')),
  lat                       double precision CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  lng                       double precision CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
  accuracy_m                integer      CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  city                      text,
  region                    text,
  location_token_hash       text,
  location_token_expires_at timestamptz,
  notified_at               timestamptz,
  notify_attempts           smallint     NOT NULL DEFAULT 0 CHECK (notify_attempts >= 0),
  CONSTRAINT scan_events_latlng_juntos CHECK ((lat IS NULL) = (lng IS NULL)),
  -- 'none' nao tem localizacao nenhuma (e e o estado em que a exclusao de conta deixa o scan).
  CONSTRAINT scan_events_none_sem_local CHECK (
    geo_method <> 'none' OR (lat IS NULL AND lng IS NULL AND accuracy_m IS NULL AND city IS NULL AND region IS NULL)
  ),
  CONSTRAINT scan_events_ultima_vez CHECK (last_seen_at >= occurred_at)
);

CREATE INDEX scan_events_assignment_idx ON public.scan_events (assignment_id, occurred_at DESC);
CREATE INDEX scan_events_dedup_idx ON public.scan_events (tag_code, ip_hash, last_seen_at DESC);
CREATE INDEX scan_events_pending_notify_idx ON public.scan_events (notified_at) WHERE notified_at IS NULL;

ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;

-- Privilegios por coluna. `ip_hash`, `location_token_hash`, `location_token_expires_at`, `notified_at` e
-- `notify_attempts` ficam FORA. Escrita so por funcao security definer (register_scan, set_scan_location).
REVOKE ALL ON public.scan_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.scan_events TO service_role;
GRANT SELECT (id, tag_code, assignment_id, status_at_scan, occurred_at, last_seen_at,
              geo_method, lat, lng, accuracy_m, city, region)
  ON public.scan_events TO authenticated;

-- Tutor: so scans dos vinculos dele (a subconsulta passa pela RLS de tag_assignments do proprio tutor).
CREATE POLICY scan_events_tutor_select ON public.scan_events
  FOR SELECT TO authenticated
  USING (assignment_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.tag_assignments a
                      WHERE a.id = assignment_id AND a.tutor_id = auth.uid()));
-- Admin le todos (sem ip_hash: o privilegio de coluna vale para o admin tambem).
CREATE POLICY scan_events_admin_select ON public.scan_events
  FOR SELECT TO authenticated USING (public.is_admin());

-- my_scans: o que o tutor ve. `security_invoker` faz a RLS de scan_events valer para quem consulta (sem isso a
-- visao rodaria como dono do banco e ignoraria a politica). Nem ip_hash nem token entram.
CREATE VIEW public.my_scans
WITH (security_invoker = true) AS
SELECT s.id,
       s.tag_code,
       s.assignment_id,
       a.pet_id,
       s.occurred_at,
       s.last_seen_at,
       s.geo_method,
       s.lat,
       s.lng,
       s.accuracy_m,
       s.city,
       s.region
  FROM public.scan_events s
  JOIN public.tag_assignments a ON a.id = s.assignment_id;

REVOKE ALL ON public.my_scans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.my_scans TO service_role;
GRANT SELECT ON public.my_scans TO authenticated;

COMMENT ON TABLE public.scan_events IS
  'Leituras do QR. ip_hash e tokens nunca chegam a authenticated. Escrita so por register_scan/set_scan_location.';
COMMENT ON VIEW public.my_scans IS
  'Scans dos vinculos do tutor logado (security_invoker + RLS de scan_events), sem ip_hash nem token.';
