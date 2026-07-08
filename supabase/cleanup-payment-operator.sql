begin;

-- Preview rows that will be neutralized before running the updates below.
select provider, count(*) as rows_count
from public.subscriptions
where provider is not null
group by provider
order by rows_count desc;

select provider, count(*) as rows_count
from public.payment_events
group by provider
order by rows_count desc;

select checkout_provider, count(*) as rows_count
from public.checkout_consent_audits
group by checkout_provider
order by rows_count desc;

-- Remove payment-operator-specific identifiers while keeping account and consent history.
update public.subscriptions
set provider = null,
    provider_customer_id = null,
    provider_subscription_id = null,
    metadata = jsonb_build_object(
        'payment_operator_reset_at', now(),
        'previous_provider_redacted', true
    ),
    updated_at = now()
where provider is not null
  and provider <> 'mock';

update public.payment_events
set provider = 'payment_operator',
    payload = jsonb_build_object(
        'payment_operator_reset_at', now(),
        'previous_provider_redacted', true
    )
where provider <> 'mock';

update public.checkout_consent_audits
set checkout_provider = 'payment_operator',
    checkout_url = null,
    metadata = jsonb_build_object(
        'payment_operator_reset_at', now(),
        'previous_provider_redacted', true
    ),
    updated_at = now()
where checkout_provider <> 'mock'
  and checkout_provider <> 'payment_operator';

commit;
