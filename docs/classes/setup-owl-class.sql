-- 부엉이반 만들기 + 총괄 지정(한 번만 실행) — docs/classes/spec.md 개정 1-3
-- ▶ 실행 순서: ① supabase/migrations/…_classes_schema.sql → ② 이 파일(이메일을 바꿔서) → ③ …_classes_rls.sql
-- ▶ 저장소가 공개라 실제 이메일은 여기에 적지 않는다. SQL Editor에 붙여 넣은 뒤 아래 '총괄_이메일'을 실제 총괄 계정 이메일로 바꿔 실행.
-- ▶ 여러 번 실행해도 안전(이미 있으면 새로 만들지 않음).
do $$
declare
  v_email text := '총괄_이메일';  -- ← 실제 이메일로 바꾸기
  v_owner uuid;
  v_class uuid;
begin
  select u.id into v_owner from auth.users u where lower(u.email) = lower(v_email);
  if v_owner is null then
    raise exception '총괄 계정(%)을 찾지 못했어요. 이메일을 확인해 주세요.', v_email;
  end if;
  update public.profiles set is_super_admin = true, role = 'admin', class_id = null where id = v_owner;
  select c.id into v_class
    from public.classes c join public.class_teachers t on t.class_id = c.id
   where c.name = '부엉이반' and t.teacher_id = v_owner
   limit 1;
  if v_class is null then
    insert into public.classes (name, created_by) values ('부엉이반', v_owner) returning id into v_class;
    insert into public.class_teachers (class_id, teacher_id) values (v_class, v_owner);
  end if;
  update public.profiles set class_id = v_class where role = 'user' and class_id is null;
end $$;

-- 확인
--   select c.name, count(p.id) as 학생수 from public.classes c left join public.profiles p on p.class_id = c.id and p.role = 'user' group by c.name;
--   select count(*) as 학급없는학생 from public.profiles where role = 'user' and class_id is null;   -- 0이어야 함
--   select p.display_name, p.role, p.is_super_admin from public.profiles p where p.role = 'admin';   -- 관리자 목록(총괄 1명 true)
