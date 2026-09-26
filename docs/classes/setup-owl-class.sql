-- 부엉이반 만들기 + 총괄 지정(처음 설정할 때 한 번만) — docs/classes/spec.md 개정 1-3
-- ▶ 실행 순서: ① supabase/migrations/20260927000000_classes_schema.sql → ② 이 파일(이메일을 바꿔서) → ③ supabase/migrations/20260927010000_classes_rls.sql
--   → ④ supabase/migrations/20260927020000_class_notices.sql → ⑤ Edge Function 3개 다시 배포 → ⑥ 사이트 push
-- ▶ 저장소가 공개라 실제 이메일은 여기에 적지 않는다. SQL Editor에 붙여 넣은 뒤 아래 '총괄_이메일'을 실제 총괄 계정 이메일로 바꿔 실행.
-- ▶ 처음 한 번만 실행한다. 총괄이 이미 지정돼 있으면 아무것도 바꾸지 않고 멈춘다 — 나중에 다시 돌리면 그사이 생긴
--   학급 없는 회원(OAuth 방문자·담임 해제된 교사)까지 부엉이반에 들어가고, 학급 이름을 바꾼 뒤면 '부엉이반'이 하나 더 생기기 때문이다.
-- ▶ 총괄은 지금 관리자(role = 'admin')인 계정만 지정할 수 있다 — 이메일을 잘못 적어 학생 계정이 총괄이 되는 일을 막는다.
do $$
declare
  v_email text := '총괄_이메일';  -- ← 실제 이메일로 바꾸기
  v_owner uuid;
  v_role  text;
  v_class uuid;
begin
  if exists (select 1 from public.profiles where is_super_admin) then
    raise exception '이미 설정되어 있어요(총괄이 지정됨). 이 파일은 처음 한 번만 실행해요 — 아무것도 바꾸지 않았어요. 다음 단계(③)로 넘어가세요.';
  end if;
  -- 오류 문구에 이메일을 넣지 않는다(DB 로그에 남지 않게). 적은 이메일은 이 창에서 바로 확인할 수 있다.
  select u.id into v_owner from auth.users u where lower(u.email) = lower(btrim(v_email));
  if v_owner is null then
    raise exception '총괄 계정을 찾지 못했어요. 위에 적은 이메일을 확인해 주세요.';
  end if;
  select p.role into v_role from public.profiles p where p.id = v_owner;
  if v_role is null then
    raise exception '총괄 계정의 프로필(public.profiles 행)을 찾지 못했어요. 이 메시지를 알려 주세요.';
  end if;
  if v_role <> 'admin' then
    raise exception '이 계정은 지금 관리자가 아니에요. 총괄 계정 이메일이 맞는지 확인해 주세요.';
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
