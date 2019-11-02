# Ayzek Reborn

Er ist wieder da

## Development

### Prerequisites

- Linux x64 with glibc (Or adjust zarbis platform module version in package.json)
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
node dist/development/start
```
