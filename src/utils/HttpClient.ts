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
      // Prepare body data with proper UTF-8 encoding
      const bodyData = body ? Buffer.from(JSON.stringify(body), "utf8") : null;

      const options: http.RequestOptions = {
        hostname: this.hostname,
        port: this.port,
        path: path,
        method: method,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...(bodyData && { "Content-Length": bodyData.length }),
        },
        timeout: this.timeout,
      };

      const req = http.request(options, (res) => {
        // Set encoding to UTF-8 to properly handle emojis and special characters
        res.setEncoding("utf8");
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
                // Sanitize the response to handle control characters
                // that may not be properly escaped by the server
                const sanitizedData = this.sanitizeJsonString(data);
                resolve(JSON.parse(sanitizedData));
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

      // Write body if present (already UTF-8 encoded)
      if (bodyData) {
        req.write(bodyData);
      }

      req.end();
    });
  }

  /**
   * Sanitize a JSON string by properly escaping control characters
   * that may not be escaped by the server
   */
  private sanitizeJsonString(jsonString: string): string {
    // This regex matches control characters (ASCII 0-31) except for already escaped ones
    // We need to be careful not to double-escape characters
    return jsonString.replace(/[\x00-\x1F]/g, (char) => {
      switch (char) {
        case "\n":
          return "\\n";
        case "\r":
          return "\\r";
        case "\t":
          return "\\t";
        case "\b":
          return "\\b";
        case "\f":
          return "\\f";
        default:
          // For other control characters, use unicode escape
          const code = char.charCodeAt(0);
          return "\\u" + ("0000" + code.toString(16)).slice(-4);
      }
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
