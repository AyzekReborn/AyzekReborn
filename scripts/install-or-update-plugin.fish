#!/usr/bin/env fish

set scripts_dir (dirname (status --current-filename))

source $scripts_dir/_functions.fish

set name $argv[1]

log "Plugin dir: $name"

check_plugin_name $name

set install_dir packages/ayzek-private-plugin-$name

log "Install to: $install_dir"

if test -d $install_dir
    log "Dir already exists, updating"
    $scripts_dir/update-plugin.fish $argv
else
    log "Dir doesn't exists, getting"
    $scripts_dir/install-plugin.fish $argv
end

log "Done!"
