from __future__ import with_statement
from fabric.api import run, env, settings
from fabric.operations import local, put, sudo
from fabric.context_managers import cd, hide

env.www_root = "/var/www/bitovod.com"
env.project_root = "%(www_root)s/hnbestof" % env
env.cache_dir = "%(project_root)s/var/cached-reports/" % env
env.nginx_http_conf = "/etc/nginx/applications/root_http_50_hnbestof.conf"
env.nginx_server_conf = "/etc/nginx/applications/root_server_50_hnbestof.conf"
env.superv_conf = "/etc/supervisord.d/hnbestof.conf"
env.prune_cache = "%(www_root)s/prune_cache.sh" % env

#http://docs.fabfile.org/en/1.0.1/faq.html#why-do-i-sometimes-see-err-stdin-is-not-a-tty
env.shell = env.shell.replace('-l', '') 


def stage():
    env.user = 'user'
    env.hosts = ['stage.bitovod.com']


def prod():
    pass


def status():
    run('uname -a; uptime')


def setup():
    with cd(env.www_root):
        run('git clone git://github.com/pdfcrowd/hnbestof.git')
        run('mkdir -p %(cache_dir)s' % env)
        sudo('chown :www-data %(cache_dir)s' % env)
        run('chmod g+w %(cache_dir)s' % env)
    with cd(env.project_root):
        run('[ ! -f config.json ] && cp config.json.in config.json')
    setup_cron()


def setup_cron():
    with settings(hide('warnings'), warn_only=True):
        run('crontab -l > /tmp/mycron || touch /tmp/mycron')
        result = run('grep "%(prune_cache)s" /tmp/mycron' % env)
    if result.failed:
        run('echo "@hourly %(prune_cache)s" >> /tmp/mycron' % env)
        run('crontab /tmp/mycron')
        run('rm /tmp/mycron')


def publish():
    with cd(env.project_root):
        run('git pull origin master')
        run('npm install')   # 'npm bundle' removed in npm 1.0
        sudo('sed "s|PROJECT_DIR|`pwd`|g" conf/hnbestof.supervisor.conf | sudo tee %(superv_conf)s > /dev/null' % env)
        sudo('rm -f %(nginx_http_conf)s %(nginx_server_conf)s' % env)
        sudo('ln -s `pwd`/conf/nginx_http.conf %(nginx_http_conf)s' % env)
        sudo('ln -s `pwd`/conf/nginx_server.conf %(nginx_server_conf)s' % env)
        sudo('kill -HUP `cat /var/run/nginx.pid`')
        sudo('supervisorctl update')
        sudo('supervisorctl restart hnbestof')

    
