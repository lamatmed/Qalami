alter table contracts
    add column if not exists payment_method text default 'bank',
    add column if not exists bank_name text,
    add column if not exists account_number text,
    add column if not exists wallet_app text,
    add column if not exists wallet_phone text;
