-- q_* helpers from QA repro_bundle_standalone.sql (PR #827 re-gate).
-- Adapted only so auth.uid() in this replica reads app.uid (not jwt claims).
-- Loaded into a single psql session; pg_temp does not survive across replica.exec calls.
CREATE FUNCTION pg_temp.q_ts(t timestamptz) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT to_char(t AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'Z'
$f$;
CREATE FUNCTION pg_temp.q_now(t timestamptz) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  PERFORM set_config('qa.now', pg_temp.q_ts(t), true);
END
$f$;
CREATE FUNCTION pg_temp.q_state(u uuid) RETURNS text LANGUAGE sql AS $f$
  SELECT format('s=%s last=%s frz=%s rest=%s', current_streak, last_activity_date, streak_freeze_tokens, rest_days)
  FROM public.user_profiles WHERE id=u
$f$;
CREATE FUNCTION pg_temp.q_band(u uuid) RETURNS text LANGUAGE sql AS $f$
  SELECT format('[%s,%s]', streak_tz_lo_min, streak_tz_hi_min)
  FROM public.user_profiles WHERE id=u
$f$;
CREATE FUNCTION pg_temp.q_reset(u uuid, s int, la date, fr int, rd int, lo int, hi int, sa timestamptz)
RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE 'RESET ROLE';
  DELETE FROM public.xp_events WHERE user_id=u;
  DELETE FROM public.daily_logs WHERE user_id=u;
  UPDATE public.user_profiles SET
    current_streak=s, longest_streak=GREATEST(s,0), last_activity_date=la,
    streak_freeze_tokens=fr, rest_days=rd,
    streak_tz_lo_min=lo, streak_tz_hi_min=hi,
    streak_tz_set_at=sa, streak_credit_at=sa,
    streak_inc_at=NULL, streak_prev_inc_at=NULL, streak_pending_date=NULL, active_boost=NULL
  WHERE id=u;
END
$f$;
CREATE FUNCTION pg_temp.q_award(u uuid, t timestamptz, ld date, tag text) RETURNS int LANGUAGE plpgsql AS $f$
DECLARE r record;
BEGIN
  PERFORM pg_temp.q_now(t);
  PERFORM set_config('app.uid', u::text, true);
  PERFORM set_config('role','authenticated',true);
  SELECT x.* INTO r FROM public.award_xp(u, 10, NULL, 'create_note', tag, ld, NULL) x;
  EXECUTE 'RESET ROLE';
  RETURN r.xp_credited;
END
$f$;
CREATE FUNCTION pg_temp.q_cron(t timestamptz) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.q_now(t);
  PERFORM public.evaluate_user_streaks();
END
$f$;
CREATE OR REPLACE FUNCTION public.xp_server_now()
RETURNS timestamptz
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $b$ SELECT COALESCE(NULLIF(current_setting('qa.now', true), '')::timestamptz, clock_timestamp()); $b$;
REVOKE ALL ON FUNCTION public.xp_server_now() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xp_server_now() FROM anon;
REVOKE ALL ON FUNCTION public.xp_server_now() FROM authenticated;
REVOKE ALL ON FUNCTION public.xp_server_now() FROM service_role;
