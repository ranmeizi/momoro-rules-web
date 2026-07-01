-- boboan_net 登录只读账号（SELECT user 表）
-- 可与 momo_ingamenews 只读账号分开，也可合并为一个账号

GRANT SELECT ON boboan_net.user TO 'readonly_momoro'@'%';
FLUSH PRIVILEGES;
