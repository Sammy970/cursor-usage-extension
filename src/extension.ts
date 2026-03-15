import * as vscode from "vscode";
import { getAccessToken } from "./auth";
import { fetchUsage } from "./api";
import { UsageStatusBarItem } from "./statusBar";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let statusBarItem: UsageStatusBarItem | undefined;
let refreshTimer: ReturnType<typeof setInterval> | undefined;

async function refresh(): Promise<void> {
  if (!statusBarItem) {
    return;
  }

  statusBarItem.setLoading();

  try {
    const token = await getAccessToken();
    const usage = await fetchUsage(token);
    statusBarItem.setUsage(usage, new Date());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    statusBarItem.setError(message);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = new UsageStatusBarItem();
  context.subscriptions.push({ dispose: () => statusBarItem?.dispose() });

  const command = vscode.commands.registerCommand("cursorUsage.refresh", () => {
    refresh();
  });
  context.subscriptions.push(command);

  // Initial fetch
  refresh();

  // Auto-refresh every 5 minutes
  refreshTimer = setInterval(() => {
    refresh();
  }, REFRESH_INTERVAL_MS);

  context.subscriptions.push({
    dispose: () => {
      if (refreshTimer !== undefined) {
        clearInterval(refreshTimer);
      }
    },
  });
}

export function deactivate(): void {
  if (refreshTimer !== undefined) {
    clearInterval(refreshTimer);
  }
}
