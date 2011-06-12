NGINX_HTTP_CONF= /etc/nginx/applications/root_http_50_hnbestof.conf
NGINX_SERVER_CONF= /etc/nginx/applications/root_server_50_hnbestof.conf

SUPERV_CONF= /etc/supervisord.d/hnbestof.supervisor.conf

clean-cache:
	rm var/cached-reports/*

compile:
	@java -jar /usr/share/java/compiler.jar --js=main.js > /dev/null

update-app-config:
	sed "s|PROJECT_DIR|`pwd`|g" conf/hnbestof.supervisor.conf | sudo tee $(SUPERV_CONF) > /dev/null
	sudo rm -f $(NGINX_HTTP_CONF) $(NGINX_SERVER_CONF)
	sudo ln -s `pwd`/conf/nginx_http.conf $(NGINX_HTTP_CONF)
	sudo ln -s `pwd`/conf/nginx_server.conf $(NGINX_SERVER_CONF)
	sudo kill -HUP `cat /var/run/nginx.pid`
	sudo supervisorctl update
	sudo supervisorctl restart hnbestof

unlink-app-config:
	sudo supervisorctl stop hnbestof
	sudo rm -f $(SUPERV_CONF) $(NGINX_CONF)
	sudo kill -HUP `cat /var/run/nginx.pid`

init:
	mkdir -p var/cached-reports
	sudo chown :www-data var/cached-reports
	sudo chmod g+w var/cached-reports

test-server:
	node main.js

