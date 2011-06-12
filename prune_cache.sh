#!/bin/bash

THIS_DIR=`dirname $0`
THIS_DIR=`cd $THIS_DIR && pwd`
find $THIS_DIR/var/cached-reports/ -mmin +45 -type f -delete
