import * as https from "https";

export interface UsageData {
  fastRequestsUsed: number;
  fastRequestsLimit: number;
  fastRequestsRemaining: number;
  startOfMonth: string;
}

function httpsGet(url: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            // Deliberately omit response body — it may echo back auth headers
            reject(new Error(`Cursor API returned status ${res.statusCode}`));
          } else {
            resolve(data);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error("Request timed out"));
    });
  });
}

export async function fetchUsage(token: string): Promise<UsageData> {
  // api2.cursor.sh accepts the app's Bearer token directly — no browser cookie needed
  const body = await httpsGet("https://api2.cursor.sh/auth/usage", token);
  const json = JSON.parse(body) as {
    "gpt-4"?: { numRequests?: number; maxRequestUsage?: number };
    startOfMonth?: string;
  };

  const model = json["gpt-4"] ?? {};
  const fastUsed = model.numRequests ?? 0;
  const fastLimit = model.maxRequestUsage ?? 500;

  return {
    fastRequestsUsed: fastUsed,
    fastRequestsLimit: fastLimit,
    fastRequestsRemaining: Math.max(0, fastLimit - fastUsed),
    startOfMonth: json.startOfMonth ?? "",
  };
}
