SELECT id, moment, topic_text, auth_uid, role_name, like_list, regex_ok, has_access, allow_result
FROM public.realtime_auth_debug
ORDER BY id DESC
LIMIT 20;