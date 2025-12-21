import * as vscode from "vscode";
import { LeekWarsService } from "./services/leekwars";
import { CodeAnalyzerService } from "./services/analyzer";
import { StatusBarService } from "./services/StatusBarService";
import { DiagnosticService } from "./services/DiagnosticService";
import { CodeBaseStateManager } from "./services/codebase";
import { DataLoader } from "./providers/leekscript/DataLoader";
import { CommandRegistry } from "./utils/CommandRegistry";
import { DocumentEventHandler } from "./utils/DocumentEventHandler";
import {
  LeekScriptCompletionProvider,
  LeekScriptHoverProvider,
  UserCodeDefinitionProvider,
} from "./providers";
import { UserCodeCompletionProvider } from "./providers/user-code/CompletionProvider";
import { DefinitionManager } from "./providers/user-code/DefinitionManager";
import { UserCodeHoverProvider } from "./providers/user-code/HoverProvider";
import {
  UserCodeSemanticTokensProvider,
  legend,
} from "./providers/user-code/SemanticTokensProvider";
import { UserDotCodeCompletionProvider } from "./providers/user-code/DotCompletionProvider";
import {
  LeekScriptFormattingProvider,
  LeekScriptRangeFormattingProvider,
} from "./providers/leekscript/FormattingProvider";

// Services
let diagnosticService: DiagnosticService | null = null;
let codebaseStateManager: CodeBaseStateManager | null = null;

export async function activate(context: vscode.ExtensionContext) {
  console.log("LeekScript extension is now active!");

  // Listen for configuration changes
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("leekscript.leekwarsApiToken")) {
      console.log("The leekwarsApiToken setting specifically changed!");

      // Update LeekWarsService with new token
      const isTokenConfigured = leekWarsService.updateApiToken();
      statusBarService.setTokenStatus(isTokenConfigured);

      if (isTokenConfigured) {
        vscode.window.showInformationMessage(
          "LeekScript: LeekWars API token updated successfully"
        );
      } else {
        vscode.window.showWarningMessage(
          "LeekScript: LeekWars API token is not configured"
        );
      }
    }

    if (e.affectsConfiguration("leekscript.javaApiUrl")) {
      console.log("The javaApiUrl setting specifically changed!");

      // Get the new javaApiUrl value
      const config = vscode.workspace.getConfiguration("leekscript");
      const newApiUrl = config.get<string>(
        "javaApiUrl",
        "http://localhost:8080"
      );

      // Update CodeAnalyzerService with new URL
      analyzerService.updateApiUrl(newApiUrl);

      // Check if the analyzer server is running with new URL
      analyzerService.checkServerStatus().then((isRunning) => {
        statusBarService.setAnalyzerServerStatus(isRunning);
        if (isRunning) {
          vscode.window.showInformationMessage(
            `LeekScript: Connected to analysis server at ${newApiUrl}`
          );
        } else {
          vscode.window.showWarningMessage(
            `LeekScript: Cannot connect to analysis server at ${newApiUrl}`
          );
        }
      });
    }
  });

  // Print globalstate for debugging
  const farmerAIsResponse = context.globalState.get(
    "leekwars.farmerAIsResponse"
  );
  console.log("LeekWars Farmer AIs Response:", farmerAIsResponse);

  // Initialize Data Loader
  const dataLoader = DataLoader.getInstance(context.extensionPath);

  // Initialize user Definition Manager
  const definitionManager = DefinitionManager.getInstance(
    context.extensionPath
  );

  // Initialize CodeBase State Manager
  codebaseStateManager = new CodeBaseStateManager(context);

  console.log("codebaseStateManager initialized.", codebaseStateManager);

  // Initialize services
  const statusBarService = new StatusBarService(context);
  const leekWarsService = new LeekWarsService(context);
  const analyzerService = new CodeAnalyzerService(context);

  // Link services with codebase state manager
  leekWarsService.setCodeBaseStateManager(codebaseStateManager);
  codebaseStateManager.setCodeAnalyzerService(analyzerService);

  // Create diagnostic collection and service
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("leekscript");
  context.subscriptions.push(diagnosticCollection);

  // Register user code providers
  const userCodeCompletionProvider = new UserCodeCompletionProvider(
    definitionManager
  );
  const userDotCodeCompletionProvider = new UserDotCodeCompletionProvider(
    definitionManager
  );

  const userCodeCompletionProviderRegistration =
    vscode.languages.registerCompletionItemProvider(
      "leekscript",
      userCodeCompletionProvider
    );

  const userDotCodeCompletionProviderRegistration =
    vscode.languages.registerCompletionItemProvider(
      "leekscript",
      userDotCodeCompletionProvider,
      "."
    );

  const userCodeHoverProvider = vscode.languages.registerHoverProvider(
    "leekscript",
    new UserCodeHoverProvider(definitionManager)
  );

  const userCodeDefinitionProvider =
    vscode.languages.registerDefinitionProvider(
      "leekscript",
      new UserCodeDefinitionProvider(definitionManager)
    );

  const semanticTokensProviderInstance = new UserCodeSemanticTokensProvider(
    definitionManager
  );
  const userCodeSemanticTokensProvider =
    vscode.languages.registerDocumentSemanticTokensProvider(
      "leekscript",
      semanticTokensProviderInstance,
      legend
    );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "myExt.openDefinition",
      (uri: vscode.Uri, pos: vscode.Position) => {
        vscode.window.showTextDocument(uri, {
          selection: new vscode.Range(pos, pos),
        });
      }
    )
  );

  // hover
  context.subscriptions.push(userCodeHoverProvider);

  // user code completions completions
  context.subscriptions.push(userCodeCompletionProviderRegistration);
  context.subscriptions.push(userDotCodeCompletionProviderRegistration);

  // user code definitions
  context.subscriptions.push(userCodeDefinitionProvider);

  // type semantic tokens
  context.subscriptions.push(userCodeSemanticTokensProvider);

  diagnosticService = new DiagnosticService(
    diagnosticCollection,
    analyzerService,
    dataLoader,
    codebaseStateManager,
    definitionManager
  );

  // Link semantic tokens provider to diagnostic service for refresh
  diagnosticService.setSemanticTokensProvider(semanticTokensProviderInstance);

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

  // Register leekscript providers
  const leekScriptCompletionProvider =
    vscode.languages.registerCompletionItemProvider(
      "leekscript",
      new LeekScriptCompletionProvider(dataLoader)
    );
  context.subscriptions.push(leekScriptCompletionProvider);

  const hoverProvider = vscode.languages.registerHoverProvider(
    "leekscript",
    new LeekScriptHoverProvider(dataLoader)
  );
  context.subscriptions.push(hoverProvider);

  // Register formatting providers (disabled for now, issues with Array<type> syntax)
  const formattingProvider =
    vscode.languages.registerDocumentFormattingEditProvider(
      "leekscript",
      new LeekScriptFormattingProvider()
    );
  context.subscriptions.push(formattingProvider);

  const rangeFormattingProvider =
    vscode.languages.registerDocumentRangeFormattingEditProvider(
      "leekscript",
      new LeekScriptRangeFormattingProvider()
    );
  context.subscriptions.push(rangeFormattingProvider);

  // Register document event handlers
  const documentEventHandler = new DocumentEventHandler(
    context,
    diagnosticService,
    dataLoader
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
