NGINX_HTTP_CONF= /etc/nginx/applications/root_http_50_hnstuff.conf
NGINX_SERVER_CONF= /etc/nginx/applications/root_server_50_hnstuff.conf

SUPERV_CONF= /etc/supervisord.d/hnstuff.supervisor.conf

clean-cache:
	rm var/cached-reports/*

compile:
	@java -jar /usr/share/java/compiler.jar --js=main.js > /dev/null

update-app-config:
	sed "s|PROJECT_DIR|`pwd`|g" conf/hnstuff.supervisor.conf | sudo tee $(SUPERV_CONF) > /dev/null
	sudo rm -f $(NGINX_HTTP_CONF) $(NGINX_SERVER_CONF)
	sudo ln -s `pwd`/conf/nginx_http.conf $(NGINX_HTTP_CONF)
	sed "s|PROJECT_DIR|`pwd`|g" conf/nginx_server.conf | sudo tee $(NGINX_SERVER_CONF) > /dev/null
	sudo kill -HUP `cat /var/run/nginx.pid`
	sudo supervisorctl update
	sudo supervisorctl restart hnstuff

unlink-app-config:
	sudo supervisorctl stop hnstuff
	sudo rm -f $(SUPERV_CONF) $(NGINX_CONF)
	sudo kill -HUP `cat /var/run/nginx.pid`

init:
	mkdir -p var/cached-reports
	sudo chown :www-data var/cached-reports
	sudo chmod g+w var/cached-reports

test-server:
	node main.js

