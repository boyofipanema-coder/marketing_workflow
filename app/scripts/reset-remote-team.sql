-- Remote-only reset: remote D1 already has its own single "동률" member
-- (m_dongryul_01, tied to the real login email) under workspace ws_main_01,
-- distinct from local's demo seed. This wipes remote's own demo project/tasks
-- and adds the other two real members without touching the existing one.
DELETE FROM activity_log;
DELETE FROM task_dependency;
DELETE FROM task;
DELETE FROM milestone;
DELETE FROM workstream;
DELETE FROM project;

INSERT INTO member (id, workspace_id, name, email, role) VALUES
  ('m_jisoo_01', 'ws_main_01', '지수', 'jisoo@team.local', 'admin'),
  ('m_eojin_01', 'ws_main_01', '어진', 'eojin@team.local', 'admin');
