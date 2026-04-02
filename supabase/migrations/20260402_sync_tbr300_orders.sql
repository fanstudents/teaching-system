-- 將 orders 表中 coupon_code = 'TBR300' 的訂單同步到 affiliate_orders
-- affiliate: service@tbr.digital, coupon: TBR300, commission: 20%

INSERT INTO public.affiliate_orders (
    transaction_id, amount, currency, payment_time, payment_status,
    coupon_code, coupon_name, course_name, plan_name,
    student_name, student_email, student_phone,
    affiliate_name, affiliate_email, affiliate_code,
    commission_rate, commission_amount, commission_status
)
SELECT
    o.transaction_id,
    o.amount,
    o.currency,
    o.payment_time,
    o.payment_status,
    o.coupon_code,
    o.coupon_name,
    o.course_name,
    o.plan_name,
    o.student_name,
    o.student_email,
    o.student_phone,
    'TBR Digital',           -- affiliate_name
    'service@tbr.digital',   -- affiliate_email
    'TBR300',                -- affiliate_code
    0.2000,                  -- commission_rate (20%)
    ROUND(o.amount * 0.20),  -- commission_amount
    'pending'
FROM public.orders o
WHERE o.coupon_code = 'TBR300'
  AND o.payment_status = 'Paid'
  AND o.amount > 0
  AND NOT EXISTS (
      SELECT 1 FROM public.affiliate_orders ao
      WHERE ao.transaction_id = o.transaction_id
  );
