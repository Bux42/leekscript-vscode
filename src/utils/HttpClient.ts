/**
 * HTTP Client for making requests to the Code Analysis Server
 */
import * as http from "http";
import { HttpError } from "../services/analyzer/types";

export class HttpClient {
  private hostname: string;
  private port: number;
  private timeout: number;

  constructor(hostname: string, port: number, timeout: number = 5000) {
    this.hostname = hostname;
    this.port = port;
    this.timeout = timeout;
  }

  /**
   * Make an HTTP request to the server
   * @param method HTTP method (GET, POST, DELETE, etc.)
   * @param path URL path
   * @param body Optional request body (will be JSON stringified)
   * @returns Promise resolving to the parsed response
   */
  async request<T>(method: string, path: string, body?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const options: http.RequestOptions = {
        hostname: this.hostname,
        port: this.port,
        path: path,
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        timeout: this.timeout,
      };

      const req = http.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              // Handle empty responses or plain text
              if (!data || data.trim().length === 0) {
                resolve([] as any);
              } else if (data.startsWith("{") || data.startsWith("[")) {
                resolve(JSON.parse(data));
              } else {
                // Plain text response
                resolve(data as any);
              }
            } catch (error) {
              reject(
                this.createError(
                  "PARSE_ERROR",
                  `Failed to parse response: ${error}`
                )
              );
            }
          } else {
            // Error response
            reject(this.createError(undefined, data, res.statusCode));
          }
        });
      });

      req.on("error", (error) => {
        reject(
          this.createError((error as any).code || "UNKNOWN", error.message)
        );
      });

      req.on("timeout", () => {
        req.destroy();
        reject(this.createError("ETIMEDOUT", "Request timeout"));
      });

      // Write body if present
      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Create a standardized error object
   */
  private createError(
    code?: string,
    message?: string,
    statusCode?: number
  ): HttpError {
    return {
      code,
      statusCode,
      message: message || "Unknown error",
    };
  }
}
