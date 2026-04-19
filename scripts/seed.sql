-- Seed script for CareNageAI
-- Run this in Supabase SQL editor

DO $$
DECLARE
  uid uuid := '66d35c8f-3db8-4c0b-80d3-9a8553e3605e';
  d date;
  i int;
  sleep_min int;
  deep_min int;
  rem_min int;
  step_count int;
  hrv_val numeric;
  s_sleep int;
  s_recovery int;
  s_strain int;
  s_care int;
BEGIN

  -- ── Users ────────────────────────────────────────────────────
  INSERT INTO users (id, name, age, height_cm, weight_kg, fitness_goals, conditions, medications, allergies, sleep_target_hrs, steps_target, protein_target_g)
  VALUES (
    uid, 'Varane', 28, 178, 75,
    ARRAY['stay_healthy', 'increase_muscle'],
    ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[],
    7.5, 10000, 150
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    age = EXCLUDED.age,
    height_cm = EXCLUDED.height_cm,
    weight_kg = EXCLUDED.weight_kg,
    fitness_goals = EXCLUDED.fitness_goals,
    sleep_target_hrs = EXCLUDED.sleep_target_hrs,
    steps_target = EXCLUDED.steps_target,
    protein_target_g = EXCLUDED.protein_target_g;

  -- ── 30 days of health data ───────────────────────────────────
  FOR i IN 0..29 LOOP
    d := current_date - i;

    -- Vary data realistically across the month
    sleep_min  := 380 + (sin(i * 0.7) * 40)::int + (random() * 30)::int;  -- 6.3–7.8h
    deep_min   := 55  + (random() * 35)::int;
    rem_min    := 75  + (random() * 40)::int;
    step_count := 7000 + (cos(i * 0.5) * 2000)::int + (random() * 2000)::int;
    hrv_val    := 52  + (sin(i * 0.4) * 12) + (random() * 8);

    -- Score computation (realistic, not always high)
    s_sleep    := LEAST(100, (sleep_min::float / (7.5 * 60) * 100)::int);
    s_strain   := LEAST(100, (step_count::float / 10000 * 100)::int);
    s_recovery := 55 + (random() * 40)::int;
    s_care     := ((s_sleep + s_recovery + s_strain) / 3)::int;

    -- Sleep records
    INSERT INTO sleep_records (user_id, date, duration_min, deep_sleep_min, rem_sleep_min)
    VALUES (uid, d, sleep_min, deep_min, rem_min)
    ON CONFLICT (user_id, date) DO UPDATE SET
      duration_min   = EXCLUDED.duration_min,
      deep_sleep_min = EXCLUDED.deep_sleep_min,
      rem_sleep_min  = EXCLUDED.rem_sleep_min;

    -- Steps
    INSERT INTO steps (user_id, date, count, source)
    VALUES (uid, d, step_count, 'apple_watch')
    ON CONFLICT (user_id, date) DO UPDATE SET count = EXCLUDED.count;

    -- HRV (2 readings per day — morning + evening)
    INSERT INTO hrv (user_id, sdnn_ms, timestamp)
    VALUES
      (uid, hrv_val,        (d::timestamp + interval '7 hours')::timestamptz),
      (uid, hrv_val - 5 + (random() * 10), (d::timestamp + interval '22 hours')::timestamptz);

    -- Scores
    INSERT INTO scores (user_id, date, sleep_score, recovery_score, strain_score, care_score)
    VALUES (uid, d, s_sleep, s_recovery, s_strain, s_care)
    ON CONFLICT (user_id, date) DO UPDATE SET
      sleep_score    = EXCLUDED.sleep_score,
      recovery_score = EXCLUDED.recovery_score,
      strain_score   = EXCLUDED.strain_score,
      care_score     = EXCLUDED.care_score;

  END LOOP;

  -- ── Workouts (12 over past 30 days) ─────────────────────────
  INSERT INTO workouts (user_id, date, workout_type, duration_min, calories, avg_hr) VALUES
    (uid, current_date - 1,  'Running',      35, 320, 158),
    (uid, current_date - 3,  'Strength',     50, 280, 142),
    (uid, current_date - 5,  'Cycling',      45, 380, 155),
    (uid, current_date - 7,  'Running',      30, 290, 162),
    (uid, current_date - 9,  'Strength',     55, 310, 138),
    (uid, current_date - 11, 'HIIT',         25, 260, 172),
    (uid, current_date - 13, 'Running',      40, 350, 160),
    (uid, current_date - 15, 'Yoga',         60, 180, 110),
    (uid, current_date - 17, 'Strength',     50, 290, 140),
    (uid, current_date - 20, 'Cycling',      50, 400, 150),
    (uid, current_date - 23, 'Running',      35, 310, 158),
    (uid, current_date - 27, 'Strength',     45, 270, 135)
  ON CONFLICT DO NOTHING;

END $$;
