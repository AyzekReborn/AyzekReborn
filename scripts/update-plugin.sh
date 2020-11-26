#!/bin/sh

scripts=$(dirname "$(readlink -f "$0")")
source $scripts/_functions.sh

name=$1

log "Plugin name: $name"

check_plugin_name $name

install_dir=packages/ayzek-private-plugin-$name

log "Installed to: $install_dir"

if ! test -d $install_dir; then
    fatal "Plugin directory not found"
fi

if ! test -d $install_dir/.git; then
    fatal "Plugin directory is not a git repo (Bare repos is not supported)"
fi

cd $install_dir
if ! git pull; then
    fatal "Update failed, status $status"
fi
cd ..

sync_dependencies

log "Done!"
