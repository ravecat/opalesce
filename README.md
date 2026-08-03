# Opalesce

## Development environment

The Nix flake provides Node.js, pnpm, and Just. To authorize automatic environment loading once, run:

```sh
direnv allow
```

After that, direnv loads the development environment whenever a shell enters the repository.

To enter it manually instead, run:

```sh
nix develop
```

Optional local environment variables can be placed in `envs/.env`.
