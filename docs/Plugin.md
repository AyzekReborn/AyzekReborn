# Plugin

Plugins implements reaction to user actions

Example plugins are located in this repo (Named ayzek-plugin-X)

## Plugin loading system

Ayzek's preferred plugin system is compile time rather than runtime, and for plugin installation you must download plugin sources to bot source code

There is some scripts for plugin management:

### `yarn install-plugin <name> <repo>`

Example:

```sh
yarn install-plugin git-notify git@github.com:AyzekReborn/ayzek-plugin-git-notify.git
```

Downloads plugin to packages directory, naming them as `ayzek-private-plugin-<name>`;

### `yarn update-plugin <name>`

Example:

```sh
yarn update-plugin git-notify
```

Pulls changes for specified plugin

### `yarn install-or-update-plugin <name> <repo>`

Example:

```sh
yarn install-or-update-plugin git-notify git@github.com:AyzekReborn/ayzek-plugin-git-notify.git
```

If plugin is already installed - updates them, installs otherwise
