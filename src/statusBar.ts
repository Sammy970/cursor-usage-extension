import * as vscode from "vscode";
import { UsageData } from "./api";

export class UsageStatusBarItem {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = "cursorUsage.refresh";
    this.setLoading();
    this.item.show();
  }

  setLoading(): void {
    this.item.text = "$(sync~spin) Cursor";
    this.item.tooltip = "Loading Cursor usage...";
  }

  setUsage(data: UsageData, updatedAt: Date): void {
    const remaining = data.fastRequestsRemaining;
    const limit = data.fastRequestsLimit;

    const icon = "$(zap)";
    if (remaining < 50) {
      this.item.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
    } else {
      this.item.backgroundColor = undefined;
    }

    this.item.text = `${icon} ${remaining} left`;

    const periodLabel = data.startOfMonth
      ? `Since ${new Date(data.startOfMonth).toLocaleDateString()}`
      : "This period";

    this.item.tooltip = new vscode.MarkdownString(
      [
        `**Cursor AI Usage**`,
        ``,
        `⚡ Fast requests used: ${data.fastRequestsUsed} / ${limit}`,
        `✅ Remaining: **${remaining}**`,
        ``,
        `_${periodLabel}_  `,
        `_Last updated: ${updatedAt.toLocaleTimeString()}_`,
        ``,
        `_Click to refresh_`,
      ].join("\n")
    );
    this.item.tooltip.isTrusted = true;
  }

  setError(message: string): void {
    this.item.text = "$(zap) --";
    this.item.tooltip = `Cursor Usage: ${message}\n\nClick to retry`;
    this.item.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground"
    );
  }

  dispose(): void {
    this.item.dispose();
  }
}
