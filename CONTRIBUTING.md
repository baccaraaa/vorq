# Contributing to Vorq

Thanks for your interest in contributing to Vorq. This guide will get you up and running.

## Prerequisites

- Node.js 22+
- Docker (for Redis and RabbitMQ)

## Getting Started

```bash
git clone https://github.com/your-username/vorq.git
cd vorq
npm install
docker compose up -d
npm run build
npm test
```

## Project Structure

```
packages/
  core/       — Queue engine, task lifecycle, base abstractions
  redis/      — Redis transport implementation
  rabbitmq/   — RabbitMQ transport implementation
  nestjs/     — NestJS module integration
```

## Development Workflow

1. Create a branch from `main`: `git checkout -b feat/my-feature`
2. Make your changes
3. Run tests: `npm test`
4. Run lint: `npm run lint`
5. Submit a pull request

## Code Style

Biome handles formatting and linting. Run `npm run lint` before submitting.

Do not add comments unless the logic is non-obvious. Let the code speak for itself.

## Testing

We use Vitest with a TDD approach. Write tests before or alongside your implementation.

Run all tests:

```bash
npm test
```

Run tests for a specific package:

```bash
npx turbo run test --filter=@vorq/core
```

## Commit Convention

Prefix commits with a type:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `refactor:` code change that neither fixes a bug nor adds a feature
- `test:` adding or updating tests

Example: `feat: add retry backoff strategy to task runner`
