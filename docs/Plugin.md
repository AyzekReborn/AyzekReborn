# Plugin

Plugins implements reaction to user actions

Example plugins are located in this repo (Named ayzek-plugin-X)

## Plugin loading system

Ayzek's preferred plugin system is compile time rather than runtime, and for plugin installation you must download plugin sources to bot source code

There is some scripts for plugin management:

### `yarn plugin:install <name> <repo>`

Example:

```sh
yarn plugin:install git-notify git@github.com:AyzekReborn/ayzek-plugin-git-notify.git
```

Downloads plugin to packages directory, naming them as `ayzek-private-plugin-<name>`;

### `yarn plugin:update <name>`

Example:

```sh
yarn plugin:update git-notify
```

Pulls changes for specified plugin

### `yarn plugin:install-or-update <name> <repo>`

Example:

```sh
yarn plugin:install-or-update git-notify git@github.com:AyzekReborn/ayzek-plugin-git-notify.git
```

If plugin is already installed - updates them, installs otherwise
