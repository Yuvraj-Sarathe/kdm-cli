# KDM CLI — Versioned Command Documentation

This directory contains versioned documentation for all KDM CLI commands. Each section documents a top-level command group with usage, parameters, examples, and troubleshooting.

## Command Index

- `show` — Show running runners, pods, containers, or minikube
- `health` — Show health status for pods or containers
- `watch` — Live monitoring mode
- `logs` — Show logs for a container or pod
- `config` — Manage KDM configuration

## Quick Start

```bash
# Install globally
npm install -g kdm-cli

# Show all workloads
kdm show runners

# Check pod health
kdm health po

# Live watch
kdm watch

# View logs
kdm logs <name>

# Configure notifications
kdm config setup

```
---

## Version History

* [v1.2.1](https://www.google.com/search?q=v1.2.1.md)
* [v1.1.0](https://www.google.com/search?q=v1.1.0.md)
