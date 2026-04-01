import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function getStateDbPath(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Cursor",
      "User",
      "globalStorage",
      "state.vscdb"
    );
  } else if (platform === "win32") {
    return path.join(
      process.env.APPDATA || "",
      "Cursor",
      "User",
      "globalStorage",
      "state.vscdb"
    );
  } else {
    return path.join(
      os.homedir(),
      ".config",
      "Cursor",
      "User",
      "globalStorage",
      "state.vscdb"
    );
  }
}

type NodeSqliteOutcome =
  | { use: "token"; token: string }
  | { use: "missing" }
  | { use: "fallback" };

/**
 * When `node:sqlite` is available (Node 22.5+), open the DB by path so SQLite
 * reads pages from disk — no multi‑GiB buffer in JS/WASM.
 * Otherwise returns `fallback` so sql.js can load the file (full copy in memory).
 */
async function tryGetTokenWithNodeSqlite(
  dbPath: string
): Promise<NodeSqliteOutcome> {
  type NodeSqlite = typeof import("node:sqlite");
  let DatabaseSync: NodeSqlite["DatabaseSync"];
  try {
    ({ DatabaseSync } = await import("node:sqlite"));
  } catch {
    return { use: "fallback" };
  }

  let db: InstanceType<NodeSqlite["DatabaseSync"]>;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
  } catch {
    return { use: "fallback" };
  }

  try {
    const stmt = db.prepare(
      "SELECT value FROM ItemTable WHERE key = ? LIMIT 1"
    );
    const row = stmt.get("cursorAuth/accessToken") as
      | { value: string }
      | undefined;
    if (!row?.value) {
      return { use: "missing" };
    }
    return { use: "token", token: row.value };
  } finally {
    try {
      db.close();
    } catch {
      // ignore close errors
    }
  }
}

/** Read entire file into a buffer. Chunked reads avoid Node's ~2 GiB single-shot readFile limit. */
function readEntireFileSync(filePath: string): Buffer {
  const { size } = fs.statSync(filePath);
  if (size === 0) {
    return Buffer.alloc(0);
  }
  const buf = Buffer.allocUnsafe(size);
  const fd = fs.openSync(filePath, "r");
  try {
    const chunkSize = 64 * 1024 * 1024; // 64 MiB per read (under libuv single-read limits)
    let offset = 0;
    while (offset < size) {
      const len = Math.min(chunkSize, size - offset);
      const read = fs.readSync(fd, buf, offset, len, offset);
      if (read === 0) {
        throw new Error("Unexpected end of file while reading state database");
      }
      offset += read;
    }
  } finally {
    fs.closeSync(fd);
  }
  return buf;
}

async function getTokenWithSqlJs(dbPath: string): Promise<string> {
  // sql.js = SQLite in WASM; it needs the full file in memory — unavoidable for this path.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJs = require("sql.js");
  const SQL = await initSqlJs();

  const fileBuffer = readEntireFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  let result: ReturnType<typeof db.exec>;
  try {
    result = db.exec(
      `SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken' LIMIT 1`
    );
  } finally {
    db.close();
  }

  if (!result.length || !result[0].values.length) {
    throw new Error(
      "Access token not found in Cursor state database. Are you logged into Cursor?"
    );
  }

  return result[0].values[0][0] as string;
}

export async function getAccessToken(): Promise<string> {
  const dbPath = getStateDbPath();

  if (!fs.existsSync(dbPath)) {
    throw new Error(
      "Cursor state database not found. Make sure you are logged into Cursor."
    );
  }

  const node = await tryGetTokenWithNodeSqlite(dbPath);
  if (node.use === "token") {
    return node.token;
  }
  if (node.use === "missing") {
    throw new Error(
      "Access token not found in Cursor state database. Are you logged into Cursor?"
    );
  }

  return getTokenWithSqlJs(dbPath);
}
