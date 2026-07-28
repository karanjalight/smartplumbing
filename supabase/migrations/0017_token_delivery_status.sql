create type public.token_delivery_status as enum ('pending', 'uploaded', 'cancelled');

alter table public.token_purchases
  add column delivery_status    public.token_delivery_status not null default 'pending',
  add column delivery_status_at timestamptz,
  add column delivery_status_by uuid references public.profiles(id) on delete set null,
  add column delivery_response  jsonb;

create index token_purchases_delivery_status_idx on public.token_purchases (delivery_status);
