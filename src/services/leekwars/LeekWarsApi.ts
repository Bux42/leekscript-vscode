import * as vscode from "vscode";
import * as https from "https";

/**
 * LeekWars API response types
 */

// AI metadata from get-farmer-ais endpoint
export interface LeekWarsAIInfo {
  id: number;
  name: string;
  valid: boolean;
  folder: number;
  version: number;
  strict: boolean;
  total_lines: number;
  total_chars: number;
  entrypoint: boolean;
  entrypoints: number[];
  scenario: number | null;
  includes_ids: number[];
}

// AI with code from ai/get endpoint
export interface LeekWarsAI extends LeekWarsAIInfo {
  code: string;
}

// Response from get-farmer-ais
export interface GetFarmerAIsResponse {
  success: boolean;
  ais: LeekWarsAIInfo[];
  folders: Array<{ id: number; name: string; folder: number }>;
  leek_ais?: Record<string, number>;
  error?: string;
}

// Response from ai/get
export interface GetAIResponse {
  success: boolean;
  ai?: {
    id: number;
    name: string;
    code: string;
    valid: boolean;
  };
  error?: string;
}

/**
 * Service for interacting with the LeekWars API
 */
export class LeekWarsApiService {
  private static readonly BASE_URL = "leekwars.com";
  private static readonly API_VERSION = "api";

  constructor(private token: string) {}

  /**
   * Make an authenticated request to the LeekWars API
   */
  private async request(
    method: string,
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const queryParams = new URLSearchParams(params);
      const queryString = queryParams.toString();
      const path = `/${LeekWarsApiService.API_VERSION}/${endpoint}${
        queryString ? `?${queryString}` : ""
      }`;

      const options = {
        hostname: LeekWarsApiService.BASE_URL,
        path: path,
        method: method,
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${this.token}`,
        },
      };

      console.log(`[LeekWars API] ${method} ${path}`);

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          console.log(`[LeekWars API] Response status: ${res.statusCode}`);
          console.log(`[LeekWars API] Response body:`, data);

          try {
            const response = JSON.parse(data);

            // Check if the response indicates an error
            if (response.success === false || response.error) {
              console.error(`[LeekWars API] API returned error:`, response);
              reject(
                new Error(`API error: ${response.error || "Unknown error"}`)
              );
              return;
            }

            resolve(response);
          } catch (error) {
            console.error(`[LeekWars API] Failed to parse response:`, error);
            console.error(`[LeekWars API] Raw response:`, data);
            reject(new Error(`Failed to parse API response: ${error}`));
          }
        });
      });

      req.on("error", (error) => {
        console.error(`[LeekWars API] Request failed:`, error);
        reject(new Error(`API request failed: ${error.message}`));
      });

      req.end();
    });
  }

  /**
   * Get all AIs metadata for the current farmer
   */
  async getFarmerAIs(): Promise<GetFarmerAIsResponse> {
    return this.request("GET", "ai/get-farmer-ais");
  }

  /**
   * Get a specific AI with its code
   */
  async getAI(aiId: number): Promise<GetAIResponse> {
    return this.request("GET", "ai/get", { ai_id: aiId });
  }
}
