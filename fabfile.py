from __future__ import with_statement
from fabric.api import run, env
from fabric.operations import local, put, sudo
from fabric.context_managers import cd

env.www_root = "/var/www/bitovod.com"
env.cache_dir = "%(www_root)s/hnbestof/var/cached-reports/" % env

def stage():
    env.user = 'user'
    env.hosts = ['stage.bitovod.com']

def prod():
    pass

def status():
    run('uname -a; uptime')

def setup():
    with cd(env.www_root):
        run('mkdir -p %(cache_dir)s' % env)
        sudo('chown :www-data %(cache_dir)s' % env)
        sudo('chmod g+w %(cache_dir)s' % env)
    
