#!/usr/bin/env fish

source (dirname (status --current-filename))/_functions.fish

set name $argv[1]

log "Plugin name: $name"

check_plugin_name $name

set install_dir packages/ayzek-private-plugin-$name

log "Installed to: $install_dir"

if not test -d $install_dir
    fatal "Plugin directory not found"
end

if not test -d $install_dir/.git
    fatal "Plugin directory is not a git repo (Bare repos is not supported)"
end

cd $install_dir
if not git pull
    fatal "Update failed, status $status"
end
cd ..

sync_dependencies

log "Done!"
