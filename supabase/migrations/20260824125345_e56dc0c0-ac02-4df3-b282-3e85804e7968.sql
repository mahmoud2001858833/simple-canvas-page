UPDATE public.payments
SET status = 'paid'::payment_status,
    paid_at = now(),
    notes = COALESCE(notes,'') || ' | Manually confirmed: charged by bank (AlinmaPay approved)'
WHERE id = '2f520225-ec7b-472d-b75a-18752963f003';

SELECT cron.unschedule('expire-stale-online-payments');
SELECT cron.schedule('expire-stale-online-payments', '* * * * *', $$SELECT public.expire_stale_online_payments(45);$$);