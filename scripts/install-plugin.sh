#!/bin/sh

scripts=$(dirname "$(readlink -f "$0")")
source $scripts/_functions.sh

name=$1
repo=$2

log "Plugin dir: $name"
log "Plugin repo: $repo"

check_plugin_name $name

install_dir=packages/ayzek-private-plugin-$name

log "Install to: $install_dir"

if test -d $install_dir; then
    fatal "Plugin directory already exists"
fi

if ! git clone $repo $install_dir; then
    fatal "Failed to get plugin, status $status"
fi

log "Adding plugin to .gitmodules (To get SCM features in vscode)"
echo "[submodule \"$name\"]" >>.gitmodules
echo "path = $install_dir" >>.gitmodules
echo "url = dummy" >>.gitmodules

sync_dependencies

log "Done!"
