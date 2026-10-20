#!/usr/bin/env node
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadProjectRootEnv } from './lib/load-project-root-env.js';

loadProjectRootEnv(import.meta.url);

const isSourceEntrypoint = import.meta.url.endsWith('/inspect.ts');
const cliPath = fileURLToPath(
  new URL(isSourceEntrypoint ? './cli.ts' : './cli.js', import.meta.url),
);
const host = process.env['MCP_HOST'] ?? '127.0.0.1';
const port = process.env['MCP_PORT'] ?? process.env['PORT'] ?? '3000';
const path = process.env['MCP_PATH'] ?? '/mcp';
const serverUrl = `http://${host}:${port}${path}`;

let serverProcess: ChildProcess | undefined;
let inspectorProcess: ChildProcess | undefined;

async function main(): Promise<void> {
  serverProcess = spawn(process.execPath, getServerArgs(), {
    stdio: 'inherit',
    env: process.env,
  });

  serverProcess.once('exit', (code, signal) => {
    if (!inspectorProcess || inspectorProcess.exitCode !== null) {
      return;
    }

    console.error(
      `Reactionary MCP server exited before inspector closed: ${formatExit(
        code,
        signal,
      )}`,
    );
    inspectorProcess.kill('SIGTERM');
  });

  await waitForServerStartup(serverProcess, serverUrl);

  inspectorProcess = spawn(getPnpmCommand(), [
    'dlx',
    '@modelcontextprotocol/inspector',
    '--web',
    '--transport',
    'http',
    '--server-url',
    serverUrl,
  ], {
    stdio: 'inherit',
    env: process.env,
  });

  const exitCode = await waitForExit(inspectorProcess);
  await stopServer();
  process.exit(exitCode);
}

function getServerArgs(): string[] {
  if (!isSourceEntrypoint) {
    return [cliPath];
  }

  return ['--loader', '@swc-node/register/esm', cliPath];
}

function getPnpmCommand(): string {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

async function waitForServerStartup(
  child: ChildProcess,
  url: string,
): Promise<void> {
  const timeoutMs = process.env['MCP_INSPECTOR_STARTUP_TIMEOUT_MS']
    ? Number.parseInt(process.env['MCP_INSPECTOR_STARTUP_TIMEOUT_MS'], 10)
    : 10000;

  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error(
      `Invalid MCP_INSPECTOR_STARTUP_TIMEOUT_MS: ${process.env['MCP_INSPECTOR_STARTUP_TIMEOUT_MS']}`,
    );
  }

  await Promise.race([
    waitForReadyResponse(url, timeoutMs),
    waitForEarlyExit(child),
  ]);
}

async function waitForReadyResponse(
  url: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 0,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: {
              name: '@reactionary/mcp inspector launcher',
              version: '0.0.0',
            },
          },
        }),
      });

      if (response.ok) {
        return;
      }

      lastError = new Error(
        `Readiness request failed with HTTP ${response.status}`,
      );
    } catch (error) {
      lastError = error;
    }

    await delay(100);
  }

  throw new Error(
    `Timed out waiting for Reactionary MCP server at ${url}: ${formatError(lastError)}`,
  );
}

function waitForEarlyExit(child: ChildProcess): Promise<never> {
  return new Promise((_, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      reject(
        new Error(
          `Reactionary MCP server exited before it was ready: ${formatExit(
            code,
            signal,
          )}`,
        ),
      );
    });
  });
}

function delay(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolve) => {
    child.once('exit', (code) => {
      resolve(code ?? 0);
    });
  });
}

async function stopServer(): Promise<void> {
  if (!serverProcess || serverProcess.exitCode !== null) {
    return;
  }

  serverProcess.kill('SIGTERM');
  await waitForExit(serverProcess);
}

function formatExit(
  code: number | null,
  signal: NodeJS.Signals | null,
): string {
  if (signal) {
    return `signal ${signal}`;
  }

  return `code ${code ?? 0}`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch(async (error: unknown) => {
  console.error(error);
  await stopServer();
  process.exit(1);
});
