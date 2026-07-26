-- Reset remote D1 to a single-user state: one workspace + member "동률".
-- Deletes in FK-safe order (children first), then inserts minimal seed.

DELETE FROM activity_log;
DELETE FROM session;
DELETE FROM auth_account;
DELETE FROM task;
DELETE FROM milestone;
DELETE FROM workstream;
DELETE FROM project;
DELETE FROM brand;
DELETE FROM member;
DELETE FROM workspace;

INSERT INTO workspace (id, name, timezone, created_at)
VALUES ('ws_main_01', '마케팅 워크플로우', 'Asia/Seoul', '2026-07-25T00:00:00.000Z');

INSERT INTO member (id, workspace_id, name, email, role)
VALUES ('m_dongryul_01', 'ws_main_01', '동률', 'boyofipanema@gmail.com', 'admin');
