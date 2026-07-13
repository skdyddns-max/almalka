-- 렙블룸 기기 간 동기화 테이블
-- Supabase → SQL Editor 에 붙여넣고 실행하세요.
create table if not exists repbloom (
  code       text primary key,           -- 6자리 동기화 코드
  data       jsonb not null default '{}', -- {sessions, routines, customExercises, profile}
  updated_at timestamptz not null default now()
);

-- 익명 키로 읽기/쓰기 허용 (코드를 아는 사람만 접근 가능한 구조)
alter table repbloom enable row level security;

create policy "read by anyone"   on repbloom for select using (true);
create policy "insert by anyone" on repbloom for insert with check (true);
create policy "update by anyone" on repbloom for update using (true) with check (true);

-- 그룹 운동 인증 챌린지 (멤버별 행)
create table if not exists repbloom_challenge (
  code       text not null,               -- 6자리 챌린지 코드
  member     text not null,               -- 기기별 멤버 id
  data       jsonb not null default '{}', -- {nick, region, age, gender, dayTimes:{'YYYY-MM-DD':secs}}
  updated_at timestamptz not null default now(),
  primary key (code, member)
);
alter table repbloom_challenge enable row level security;
create policy "ch read"   on repbloom_challenge for select using (true);
create policy "ch insert" on repbloom_challenge for insert with check (true);
create policy "ch update" on repbloom_challenge for update using (true) with check (true);

-- 사진 인증용 공개 스토리지 버킷
insert into storage.buckets (id, name, public)
values ('repbloom-photos', 'repbloom-photos', true)
on conflict (id) do nothing;
create policy "rb photo read"   on storage.objects for select using (bucket_id = 'repbloom-photos');
create policy "rb photo insert" on storage.objects for insert with check (bucket_id = 'repbloom-photos');
create policy "rb photo update" on storage.objects for update using (bucket_id = 'repbloom-photos') with check (bucket_id = 'repbloom-photos');
