#!/usr/bin/env fish

set scripts_dir (dirname (status --current-filename))

source (dirname (status --current-filename))/_functions.fish

log "Starting docker container"

# log "Fixing node_modules permissions (In case if them is mounted from host)"
# if not chown ayzek:nogroup -R node_modules
#     ls -lah node_modules
#     fatal "Bad permissions on node_modules, change them manually to "(id -u)":"(id -g)" (make sure it will match subuid/subgid)"
# end

echo $SSH_KEY >~/.ssh/id_rsa
echo $SSH_HOSTS >~/.ssh/known_hosts
chmod 600 ~/.ssh/id_rsa
chmod 600 ~/.ssh/known_hosts

while true
    log "Installing required plugins"
    for plugin in (string split \n $PLUGINS)
        set args (string split "|" $plugin)
        set name $args[1]
        set repo $args[2]
        log "Plugin installation: $name"
        $scripts_dir/install-or-update-plugin.fish $name $repo
    end

    log "Syncing deps"
    if not yarn
        fatal "Failed to sync deps"
    end

    log "Building everything"

    if not yarn run:prod:build
        fatal "Failed to build"
    end

    log "Finally starting bot"
    yarn run:prod:run
end
