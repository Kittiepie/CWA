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
  '10000000-0000-4000-8000-000000000002',
  'System Administrator',
  '$2b$10$K0.IZHRYuI5clWNQJu1tl.BRboQ45Ih3.0pBtrNzNasuH1nTDpVy2', -- Mật khẩu là: Klmnop123@
  'admin@example.com',
  'admin',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET
  "role" = 'admin',
  "email" = 'admin@example.com',
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
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  'System Administrator',
  '127.0.0.1',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET
  "userId" = '10000000-0000-4000-8000-000000000002',
  "updatedAt" = NOW();

COMMIT;
