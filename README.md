# Ayzek Reborn

Er ist wieder da

## Features

### Write once, use everywhere

Supports multiple messengers, with ability to support more.

Some messenger implementations are written in this repo:

- [VK](./packages/ayzek-api-vk/docs/Configuration.md)
- [Discord](./packages/ayzek-api-discord/docs/Configuration.md)
- [Telegram](./packages/ayzek-api-telegram/docs/Configuration.md)

[Messenger API documentation](./docs/API.md)

### Plugin system

Some plugins are located in this repo, see `ayzek-plugin-X`

[Plugin API documentation](./docs/Plugin.md)

### Powerfull command system

Inspired from mojang's brigadier

[Split into another repo](https://github.com/AyzekReborn/Command-Parser)

### Lightweight

No heavy enterprise framework used

## Development

Chapter is WIP.

### Prepare newer yarn, add workspace plugin, install sdk support for typescript

This can be added to repo, but i dont want to have 8mb blobs

```sh
yarn policies set-version berry # May fail if already set
yarn set version latest
yarn plugin import workspace-tools
yarn install
yarn pnpify --sdk
```

### Switch to workspace's typescript

- Open any .ts file
- In vs code press Ctrl+Shift+P
- Select "Use workspace version"

This is required because TypeScript currently have no native support for Yarn PnP, and this procedure will be eased when <https://github.com/microsoft/TypeScript/pull/35206> comes out
