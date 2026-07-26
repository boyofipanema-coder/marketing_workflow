-- Wipe demo data (AURALEE seed projects/tasks) and replace demo members with
-- the real team. FK-safe delete order: logs/deps -> tasks -> workstreams ->
-- projects -> sessions/auth -> members. Workspace row is kept.

DELETE FROM activity_log;
DELETE FROM task_dependency;
DELETE FROM task;
DELETE FROM milestone;
DELETE FROM workstream;
DELETE FROM project;
DELETE FROM session;
DELETE FROM auth_account;
DELETE FROM member;

INSERT INTO member (id, workspace_id, name, email, role) VALUES
  ('m_dongryul', 'ws_auralee_01', '동률', 'dongryul@team.local', 'admin'),
  ('m_jisoo',    'ws_auralee_01', '지수', 'jisoo@team.local',    'admin'),
  ('m_eojin',    'ws_auralee_01', '어진', 'eojin@team.local',    'admin');
