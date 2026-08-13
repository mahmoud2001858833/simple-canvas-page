CREATE OR REPLACE FUNCTION public.register_current_device_session(
  _device_fingerprint text,
  _device_info jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _device_fingerprint IS NULL OR length(trim(_device_fingerprint)) = 0 THEN
    RAISE EXCEPTION 'Device fingerprint is required';
  END IF;

  INSERT INTO public.device_sessions (
    user_id,
    device_fingerprint,
    device_info,
    is_active,
    last_seen_at
  )
  VALUES (
    _user_id,
    _device_fingerprint,
    COALESCE(_device_info, '{}'::jsonb),
    true,
    now()
  )
  ON CONFLICT (user_id, device_fingerprint)
  DO UPDATE SET
    device_info = EXCLUDED.device_info,
    is_active = true,
    last_seen_at = now();

  UPDATE public.device_sessions
  SET is_active = false
  WHERE user_id = _user_id
    AND device_fingerprint <> _device_fingerprint
    AND is_active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.register_current_device_session(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_current_device_session(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_current_device_session(text, jsonb) TO service_role;