#!/usr/bin/env fish

source (dirname (status --current-filename))/_functions.fish

set name $argv[1]
set repo $argv[2]

log "Plugin dir: $name"
log "Plugin repo: $repo"

check_plugin_name $name

set install_dir packages/ayzek-private-plugin-$name

log "Install to: $install_dir"

if test -d $install_dir
    fatal "Plugin directory already exists"
end

if not git clone $repo $install_dir
    fatal "Failed to get plugin, status $status"
end

log "Adding plugin to .gitmodules (To get SCM features in vscode)"
echo "[submodule \"$name\"]" >>.gitmodules
echo "path = $install_dir" >>.gitmodules
echo "url = dummy" >>.gitmodules

sync_dependencies

log "Done!"
