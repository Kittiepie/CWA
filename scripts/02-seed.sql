-- Optional SQL-level db seeding

-- These data currently are used for testing purposes only
BEGIN;

INSERT INTO users (
  "id",
  "name",
  "passwordHash",
  "email",
  "role",
  "createdAt",
  "updatedAt"
)
VALUES (
  '10000000-0000-4000-8000-000000000001',
  'Test User',
  '$2b$10$K0.IZHRYuI5clWNQJu1tl.BRboQ45Ih3.0pBtrNzNasuH1nTDpVy2', -- password is `Klmnop123@`
  'testuser@example.com',
  'user',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET
  "name" = EXCLUDED."name",
  "passwordHash" = EXCLUDED."passwordHash",
  "email" = EXCLUDED."email",
  "role" = EXCLUDED."role",
  "updatedAt" = NOW();

INSERT INTO participants (
  "id",
  "userId",
  "guestName",
  "lastAccessIp",
  "createdAt",
  "updatedAt"
)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Test User',
  '127.0.0.1',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET
  "userId" = EXCLUDED."userId",
  "guestName" = EXCLUDED."guestName",
  "lastAccessIp" = EXCLUDED."lastAccessIp",
  "updatedAt" = NOW();

INSERT INTO rooms (
  "id",
  "lastActiveAt",
  "createdAt",
  "updatedAt"
)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET
  "lastActiveAt" = EXCLUDED."lastActiveAt",
  "updatedAt" = NOW();

INSERT INTO "board-elements" (
  "id",
  "roomId",
  "type",
  "data",
  "deleted",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'temp',
    '{"kind":"rectangle","x":100,"y":100,"width":250,"height":150,"color":"#2563eb"}'::jsonb,
    false,
    NOW(),
    NOW()
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    'temp',
    '{"kind":"text","x":150,"y":150,"text":"Seeded board object","color":"#111827"}'::jsonb,
    false,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  "roomId" = EXCLUDED."roomId",
  "type" = EXCLUDED."type",
  "data" = EXCLUDED."data",
  "deleted" = EXCLUDED."deleted",
  "updatedAt" = NOW();

COMMIT;

