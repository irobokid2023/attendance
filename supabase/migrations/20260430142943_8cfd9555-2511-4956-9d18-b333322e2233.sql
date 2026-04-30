DO $$
DECLARE
  rec record;
  pairs text[][] := ARRAY[
    ['profiles','user_id','CASCADE'],
    ['user_roles','user_id','CASCADE'],
    ['activity_logs','user_id','CASCADE'],
    ['attendance','marked_by','SET NULL'],
    ['payments','marked_by','SET NULL'],
    ['grading','marked_by','SET NULL'],
    ['misc_tasks','marked_by','SET NULL'],
    ['topics','created_by','SET NULL'],
    ['schools','created_by','SET NULL'],
    ['holidays','created_by','SET NULL'],
    ['classes','teacher_id','SET NULL']
  ];
  tbl text; col text; act text;
BEGIN
  FOR i IN 1..array_length(pairs,1) LOOP
    tbl := pairs[i][1]; col := pairs[i][2]; act := pairs[i][3];

    -- Drop any existing FK on this column referencing auth.users
    FOR rec IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(con.conkey)
      WHERE n.nspname = 'public' AND c.relname = tbl AND a.attname = col AND con.contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tbl, rec.conname);
    END LOOP;

    -- For SET NULL targets, drop NOT NULL
    IF act = 'SET NULL' THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', tbl, col);
    END IF;

    -- Recreate FK
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE %s',
      tbl, tbl || '_' || col || '_fkey', col, act
    );
  END LOOP;
END$$;