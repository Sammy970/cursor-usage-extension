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

export async function getAccessToken(): Promise<string> {
  const dbPath = getStateDbPath();

  if (!fs.existsSync(dbPath)) {
    throw new Error(
      "Cursor state database not found. Make sure you are logged into Cursor."
    );
  }

  // sql.js requires loading a WASM binary — we use initSqlJs dynamically
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJs = require("sql.js");
  const SQL = await initSqlJs();

  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  const result = db.exec(
    `SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken' LIMIT 1`
  );
  db.close();

  if (!result.length || !result[0].values.length) {
    throw new Error(
      "Access token not found in Cursor state database. Are you logged into Cursor?"
    );
  }

  const token = result[0].values[0][0] as string;
  return token;
}
