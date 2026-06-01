-- Create parent_documents table
create table if not exists parent_documents (
    id             uuid primary key default gen_random_uuid(),
    school_id      uuid not null,
    parent_id      uuid not null references profiles(id) on delete cascade,
    name           text not null,
    description    text,
    file_url       text,
    file_type      text,
    file_size      bigint,
    uploaded_by    text not null default 'admin',
    is_request     boolean not null default false,
    request_status text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

-- Enable RLS
alter table parent_documents enable row level security;

-- Admins can do everything
create policy "admin_manage_parent_documents"
on parent_documents for all
using (
    exists (
        select 1 from profiles
        where id = auth.uid()
        and role in ('admin', 'super_admin', 'school_staff')
        and school_id = parent_documents.school_id
    )
)
with check (
    exists (
        select 1 from profiles
        where id = auth.uid()
        and role in ('admin', 'super_admin', 'school_staff')
        and school_id = parent_documents.school_id
    )
);

-- Parents can read their own documents
create policy "parent_read_own_documents"
on parent_documents for select
using (parent_id = auth.uid());

-- Parents can update their own documents (for fulfilling requests)
create policy "parent_update_own_documents"
on parent_documents for update
using (parent_id = auth.uid());
