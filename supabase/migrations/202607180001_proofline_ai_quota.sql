create table if not exists public.proofline_ai_usage (
  usage_date date not null,
  scope text not null,
  request_count integer not null default 0 check (request_count >= 0),
  reserved_tokens bigint not null default 0 check (reserved_tokens >= 0),
  updated_at timestamptz not null default now(),
  primary key (usage_date, scope)
);

alter table public.proofline_ai_usage enable row level security;

create or replace function public.proofline_reserve_ai_quota(
  p_client_scope text,
  p_request_limit integer,
  p_global_request_limit integer,
  p_global_token_limit bigint,
  p_reserved_tokens bigint
)
returns table (allowed boolean, reason text, client_remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_global_requests integer;
  v_global_tokens bigint;
  v_client_requests integer;
  v_reset timestamptz := ((now() at time zone 'utc')::date + 1)::timestamp at time zone 'utc';
begin
  if p_client_scope is null or p_client_scope = '' or
     p_request_limit <= 0 or p_global_request_limit <= 0 or
     p_global_token_limit <= 0 or p_reserved_tokens <= 0 then
    raise exception 'invalid quota reservation parameters';
  end if;

  insert into public.proofline_ai_usage (usage_date, scope)
  values (v_day, 'global'), (v_day, p_client_scope)
  on conflict do nothing;

  select request_count, reserved_tokens
    into v_global_requests, v_global_tokens
    from public.proofline_ai_usage
   where usage_date = v_day and scope = 'global'
   for update;

  select request_count
    into v_client_requests
    from public.proofline_ai_usage
   where usage_date = v_day and scope = p_client_scope
   for update;

  if v_client_requests >= p_request_limit then
    return query select false, 'client-daily-limit'::text, 0, v_reset;
  elsif v_global_requests >= p_global_request_limit then
    return query select false, 'global-daily-limit'::text,
      greatest(p_request_limit - v_client_requests, 0), v_reset;
  elsif v_global_tokens + p_reserved_tokens > p_global_token_limit then
    return query select false, 'global-token-limit'::text,
      greatest(p_request_limit - v_client_requests, 0), v_reset;
  end if;

  update public.proofline_ai_usage
     set request_count = request_count + 1,
         reserved_tokens = reserved_tokens + p_reserved_tokens,
         updated_at = now()
   where usage_date = v_day and scope = 'global';

  update public.proofline_ai_usage
     set request_count = request_count + 1,
         reserved_tokens = reserved_tokens + p_reserved_tokens,
         updated_at = now()
   where usage_date = v_day and scope = p_client_scope;

  return query select true, 'reserved'::text,
    greatest(p_request_limit - v_client_requests - 1, 0), v_reset;
end;
$$;

revoke all on table public.proofline_ai_usage from anon, authenticated;
revoke all on function public.proofline_reserve_ai_quota(text, integer, integer, bigint, bigint) from public, anon, authenticated;
grant execute on function public.proofline_reserve_ai_quota(text, integer, integer, bigint, bigint) to service_role;
