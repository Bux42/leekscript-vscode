import * as vscode from "vscode";
import { LeekWarsService } from "./services/leekwars";
import { CodeAnalyzerService } from "./services/analyzer";
import { StatusBarService } from "./services/StatusBarService";
import { DiagnosticService } from "./services/DiagnosticService";
import { CodeBaseStateManager } from "./services/codebase";
import { DataLoader } from "./utils/DataLoader";
import { CommandRegistry } from "./utils/CommandRegistry";
import { DocumentEventHandler } from "./utils/DocumentEventHandler";
import {
  LeekScriptCompletionProvider,
  LeekScriptMemberCompletionProvider,
  LeekScriptHoverProvider,
  LeekScriptDefinitionProvider,
} from "./providers";

// Services
let diagnosticService: DiagnosticService | null = null;
let codebaseStateManager: CodeBaseStateManager | null = null;

export async function activate(context: vscode.ExtensionContext) {
  console.log("LeekScript extension is now active!");

  // Print globalstate for debugging
  const farmerAIsResponse = context.globalState.get(
    "leekwars.farmerAIsResponse"
  );
  console.log("LeekWars Farmer AIs Response:", farmerAIsResponse);

  // Initialize Data Loader
  const dataLoader = DataLoader.getInstance(context.extensionPath);

  // Initialize CodeBase State Manager
  codebaseStateManager = new CodeBaseStateManager(context);

  console.log("codebaseStateManager initialized.", codebaseStateManager);

  // Initialize services
  const statusBarService = new StatusBarService(context);
  const leekWarsService = new LeekWarsService(context);
  const analyzerService = new CodeAnalyzerService(context);

  // Link services with codebase state manager
  leekWarsService.setCodeBaseStateManager(codebaseStateManager);

  // Create diagnostic collection and service
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("leekscript");
  context.subscriptions.push(diagnosticCollection);

  diagnosticService = new DiagnosticService(
    diagnosticCollection,
    analyzerService,
    dataLoader
  );

  // Check token configuration
  const isTokenConfigured = leekWarsService.isTokenConfigured();
  statusBarService.setTokenStatus(isTokenConfigured);

  if (!isTokenConfigured) {
    await leekWarsService.checkTokenAndNotify();
  }

  // Check analyzer server status
  const isAnalyzerRunning = await analyzerService.checkServerStatus();
  statusBarService.setAnalyzerServerStatus(isAnalyzerRunning);

  if (isAnalyzerRunning) {
    console.log("[LeekScript] Code Analysis Server is running");
  } else {
    console.log(
      "[LeekScript] Code Analysis Server is not running - real-time analysis disabled"
    );
  }

  // Register commands
  const commandRegistry = new CommandRegistry(
    context,
    leekWarsService,
    analyzerService,
    statusBarService
  );
  commandRegistry.registerAll();

  // Register language providers
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    "leekscript",
    new LeekScriptCompletionProvider(dataLoader)
  );
  context.subscriptions.push(completionProvider);

  const memberCompletionProvider =
    vscode.languages.registerCompletionItemProvider(
      "leekscript",
      new LeekScriptMemberCompletionProvider(),
      "."
    );
  context.subscriptions.push(memberCompletionProvider);

  const hoverProvider = vscode.languages.registerHoverProvider(
    "leekscript",
    new LeekScriptHoverProvider(dataLoader)
  );
  context.subscriptions.push(hoverProvider);

  const definitionProvider = vscode.languages.registerDefinitionProvider(
    "leekscript",
    new LeekScriptDefinitionProvider()
  );
  context.subscriptions.push(definitionProvider);

  // Register document event handlers
  const documentEventHandler = new DocumentEventHandler(
    context,
    diagnosticService
  );
  documentEventHandler.registerAll();

  // Analyze all currently open documents
  await documentEventHandler.analyzeOpenDocuments();
}

export function deactivate() {
  console.log("LeekScript extension is now deactivated");
  if (diagnosticService) {
    diagnosticService.dispose();
  }
}
