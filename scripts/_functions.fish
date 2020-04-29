function log
    set_color green
    echo "== $argv"
    set_color normal
end
function fatal
    set_color red
    echo "!! $argv"
    set_color normal
    exit 1
end

function sync_dependencies
    log "Sync dependencies"
    if not yarn
        fatal "Failed to get deps, fix errors, and try to yarn"
    end
end

function check_plugin_name
    if not string match -q -r '^[a-z_\-0-9]+$' $argv[1]
        fatal "Bad plugin name (Got: \"$argv[1]\"), name must only contain a-z, 0-9, _ and -"
    end
end
