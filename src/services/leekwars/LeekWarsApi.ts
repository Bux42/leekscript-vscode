import * as https from "https";

/**
 * LeekWars API response types
 */

// File metadata from farmer tree
export interface FarmerTreeFile {
  path: string;
  mtime: number;
  valid: boolean;
  version: number;
  strict: boolean;
  entrypoint: boolean;
  total_lines: number;
  total_chars: number;
  scenario: number | null;
}

// Binary file metadata from farmer tree
export interface FarmerTreeBinFile {
  path: string;
  valid: boolean;
  version: number;
}

// Response from farmer tree endpoint
export interface GetFarmerTreeResponse {
  files: FarmerTreeFile[];
  bin: FarmerTreeBinFile[];
  folders: string[];
  leek_ais: Record<string, string>;
}

/**
 * Service for interacting with the LeekWars API
 */
export class LeekWarsApiService {
  private static readonly BASE_URL = "leekwars.com";
  private static readonly API_VERSION = "api";

  constructor(private token: string) {}

  /**
   * Make an authenticated request to the LeekWars API with query parameters
   */
  private async request(
    method: string,
    endpoint: string,
    params: Record<string, any> = {},
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
          // console.log(`[LeekWars API] Response body:`, data);

          try {
            const response = JSON.parse(data);

            // Check if the response indicates an error
            if (response.success === false || response.error) {
              console.error(`[LeekWars API] API returned error:`, response);
              reject(
                new Error(`API error: ${response.error || "Unknown error"}`),
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
   * Make an authenticated request to the LeekWars API with JSON body payload
   */
  private async requestWithBody(
    method: string,
    endpoint: string,
    body: Record<string, any> = {},
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const path = `/${LeekWarsApiService.API_VERSION}/${endpoint}`;
      const bodyString = JSON.stringify(body);

      const options = {
        hostname: LeekWarsApiService.BASE_URL,
        path: path,
        method: method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyString),
          Cookie: `token=${this.token}`,
        },
      };

      console.log(`[LeekWars API] ${method} ${path}`);
      console.log(`[LeekWars API] Request body:`, bodyString);

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          console.log(`[LeekWars API] Response status: ${res.statusCode}`);
          // console.log(`[LeekWars API] Response body:`, data);

          try {
            const response = JSON.parse(data);

            // Check if the response indicates an error
            if (response.success === false || response.error) {
              console.error(`[LeekWars API] API returned error:`, response);
              reject(
                new Error(`API error: ${response.error || "Unknown error"}`),
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

      req.write(bodyString);
      req.end();
    });
  }

  /**
   * Get farmer AI folder structure and files for the current farmer
   */
  async getFarmerTree(): Promise<GetFarmerTreeResponse> {
    return this.request("GET", "ai/get-farmer-tree");
  }

  /**
   * Create a folder by path
   * @param folderPath Path of the folder to create (e.g. "Folder1/Subfolder2")
   */
  async createFolderByPath(folderPath: string): Promise<{ id: number }[]> {
    return this.requestWithBody("POST", "ai-folder/create", {
      path: folderPath,
    });
  }

  /**
   * Delete a folder by it's path
   */
  async deleteFolderByPath(
    folderPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.requestWithBody("DELETE", `ai-folder/delete`, {
      path: folderPath,
    });
  }

  /**
   * Delete an AI by its path
   * @param aiPath Path of the AI to delete
   */
  async deleteAIByPath(
    aiPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.requestWithBody("DELETE", `ai/delete`, { path: aiPath });
  }

  /**
   * Read AI code by its path
   * @param aiPath Path of the AI to read
   */
  async readAICodeByPath(
    aiPath: string,
  ): Promise<{ code: string; error?: string }> {
    return this.requestWithBody("POST", `ai/read/path`, { path: aiPath });
  }

  /**
   * Write AI code by its path
   * @param aiPath Path of the AI to write
   * @param code New code for the AI
   */
  async writeAICodeByPath(
    aiPath: string,
    code: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.requestWithBody("POST", `ai/write/path/code`, {
      path: aiPath,
      code: code,
    });
  }

  /**
   * Create new AI v2
   * @param folderPath Path of the folder (empty string for root)
   * @param name Name of the new AI
   * @param version Version of the AI (default is 4)
   */
  async createAIV2({
    folderPath,
    name,
    version = 4,
  }: {
    folderPath: string;
    name: string;
    version?: number;
  }): Promise<{ id: number }> {
    return this.requestWithBody("POST", "ai/create", {
      folder: folderPath,
      name,
      version,
    });
  }
}
