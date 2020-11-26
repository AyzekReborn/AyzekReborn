function _tput() {
    tput $@ 2>/dev/null || true
}

function log() {
    _tput setaf 2
    echo -n "== "
    _tput sgr0
    echo $@
}
function fatal() {
    _tput setaf 1
    echo -n "!! "
    _tput sgr0
    echo $@
    exit 1
}

function sync_dependencies() {
    log "Sync dependencies"
    if ! yarn; then
        fatal "Failed to get deps, fix errors, and try to yarn"
    fi
}

function check_plugin_name() {
    if ! [[ $1 =~ ^[a-z0-9_-]+$ ]]; then
        fatal "Bad plugin name (Got: \"$1\"), name must only contain a-z, 0-9, _ and -"
    fi
}
