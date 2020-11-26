#!/bin/sh

scripts=$(dirname "$(readlink -f "$0")")
source $scripts/_functions.sh

name=$1

log "Plugin dir: $name"

check_plugin_name $name

install_dir=packages/ayzek-private-plugin-$name

log "Install to: $install_dir"

if test -d $install_dir; then
    log "Dir already exists, updating"
    $scripts/update-plugin.sh $@
else
    log "Dir doesn't exists, getting"
    $scripts/install-plugin.sh $@
fi

log "Done!"
