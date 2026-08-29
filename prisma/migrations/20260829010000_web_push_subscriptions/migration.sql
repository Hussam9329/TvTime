BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '10min';

CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PushSubscription"
  ADD COLUMN IF NOT EXISTS "id" TEXT,
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "endpoint" TEXT,
  ADD COLUMN IF NOT EXISTS "p256dh" TEXT,
  ADD COLUMN IF NOT EXISTS "auth" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

UPDATE "PushSubscription"
SET
  "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
  "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "createdAt" IS NULL OR "updatedAt" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "PushSubscription"
    WHERE "id" IS NULL OR "userId" IS NULL OR "endpoint" IS NULL
      OR "p256dh" IS NULL OR "auth" IS NULL
  ) THEN
    RAISE EXCEPTION 'PushSubscription contains incomplete rows; migration stopped without deleting or inventing ownership data';
  END IF;
  IF EXISTS (
    SELECT "endpoint" FROM "PushSubscription"
    GROUP BY "endpoint" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PushSubscription contains duplicate endpoints; migration stopped without deleting subscriptions';
  END IF;
  IF EXISTS (
    SELECT "id" FROM "PushSubscription"
    GROUP BY "id" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PushSubscription contains duplicate ids; migration stopped without deleting subscriptions';
  END IF;
END $$;

ALTER TABLE "PushSubscription"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "endpoint" SET NOT NULL,
  ALTER COLUMN "p256dh" SET NOT NULL,
  ALTER COLUMN "auth" SET NOT NULL,
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PushSubscription_pkey'
      AND conrelid = '"PushSubscription"'::regclass
      AND contype = 'p'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = '"PushSubscription"'::regclass AND contype = 'p'
    ) THEN
      RAISE EXCEPTION 'PushSubscription has an unexpected primary key; migration stopped without altering it';
    END IF;
    ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PushSubscription_userId_fkey'
      AND conrelid = '"PushSubscription"'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PushSubscription_endpoint_length_check'
      AND conrelid = '"PushSubscription"'::regclass
      AND contype = 'c'
  ) THEN
    ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_endpoint_length_check"
      CHECK (char_length("endpoint") BETWEEN 20 AND 4096);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PushSubscription_key_shape_check'
      AND conrelid = '"PushSubscription"'::regclass
      AND contype = 'c'
  ) THEN
    ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_key_shape_check"
      CHECK (char_length("p256dh") = 87 AND char_length("auth") = 22);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conname = 'PushSubscription_pkey'
      AND constraint_row.conrelid = '"PushSubscription"'::regclass
      AND constraint_row.contype = 'p'
      AND array_length(constraint_row.conkey, 1) = 1
      AND constraint_row.conkey[1] = (
        SELECT attnum FROM pg_attribute
        WHERE attrelid = '"PushSubscription"'::regclass AND attname = 'id'
      )
  ) THEN
    RAISE EXCEPTION 'PushSubscription primary key does not enforce the id column';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conname = 'PushSubscription_userId_fkey'
      AND constraint_row.conrelid = '"PushSubscription"'::regclass
      AND constraint_row.contype = 'f'
      AND constraint_row.confrelid = '"User"'::regclass
      AND array_length(constraint_row.conkey, 1) = 1
      AND array_length(constraint_row.confkey, 1) = 1
      AND constraint_row.conkey[1] = (
        SELECT attnum FROM pg_attribute
        WHERE attrelid = '"PushSubscription"'::regclass AND attname = 'userId'
      )
      AND constraint_row.confkey[1] = (
        SELECT attnum FROM pg_attribute
        WHERE attrelid = '"User"'::regclass AND attname = 'id'
      )
      AND constraint_row.confdeltype = 'c'
      AND constraint_row.confupdtype = 'c'
  ) THEN
    RAISE EXCEPTION 'PushSubscription user foreign key does not match the reviewed ownership contract';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class index_relation
    JOIN pg_index index_row ON index_row.indexrelid = index_relation.oid
    WHERE index_relation.relname = 'PushSubscription_endpoint_key'
      AND index_row.indrelid = '"PushSubscription"'::regclass
      AND index_row.indisunique
      AND index_row.indnkeyatts = 1
      AND index_row.indkey[0] = (
        SELECT attnum FROM pg_attribute
        WHERE attrelid = '"PushSubscription"'::regclass AND attname = 'endpoint'
      )
      AND index_row.indpred IS NULL
  ) THEN
    RAISE EXCEPTION 'PushSubscription_endpoint_key does not uniquely enforce the complete endpoint column';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class index_relation
    JOIN pg_index index_row ON index_row.indexrelid = index_relation.oid
    WHERE index_relation.relname = 'PushSubscription_userId_idx'
      AND index_row.indrelid = '"PushSubscription"'::regclass
      AND index_row.indnkeyatts = 1
      AND index_row.indkey[0] = (
        SELECT attnum FROM pg_attribute
        WHERE attrelid = '"PushSubscription"'::regclass AND attname = 'userId'
      )
      AND index_row.indpred IS NULL
  ) THEN
    RAISE EXCEPTION 'PushSubscription_userId_idx does not index the complete userId column';
  END IF;
END $$;

ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscription_isolate_own_rows ON "PushSubscription";
CREATE POLICY push_subscription_isolate_own_rows ON "PushSubscription"
  USING ("userId" = tvtime_current_user_id())
  WITH CHECK ("userId" = tvtime_current_user_id());

COMMIT;
