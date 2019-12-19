# Ayzek Reborn

[![Greenkeeper badge](https://badges.greenkeeper.io/CertainLach/AyzekReborn.svg)](https://greenkeeper.io/)

Er ist wieder da

## Features

### Write once, use everywhere

Supports multiple messengers, current support list is:

- [VKontakte](./docs/VK_Configuration.md)
- [Discord](./docs/DS_Configuration.md)

### Plugin system

See embedded plugins in `src/plugins`

### Powerfull command system

Inspired from mojang's brigadier

### Lightweight

No heavy enterprise framework used

## Development

### Prerequisites

- Node.js v12.11.1
- Yarn 1.19.1

### Clone repo

```sh
git clone https://github.com/CertainLach/AyzekReborn && cd AyzekReborn
```

### Install dependencies

```sh
yarn
```

### Configure access tokens

```sh
cp src/config.example.yaml src/config.yaml
vim src/config.yaml
```

### Start watcher/rebuilder (In another terminal window)

```sh
yarn zarbis development
```

### Start bot

```sh
# with source maps
node -r source-map-support/register dist/development/start
# or, if you are ok with broken stack traces
node dist/development/start
```

### Private plugin development

Because of [this issue](https://github.com/microsoft/vscode/issues/37947), private plugins in src/privatePlugins are not visible in source control in vscode
To resolve this issue, write this in top level .gitmodules (Which is already placed in .gitignore)

```txt
[submodule "some"]
path = src/privatePlugins/SomePlugin
url = dummy
```
