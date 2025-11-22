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
  const userCodeCompletionProviderRegistration =
    vscode.languages.registerCompletionItemProvider(
      "leekscript",
      userCodeCompletionProvider
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

  const userCodeSemanticTokensProvider =
    vscode.languages.registerDocumentSemanticTokensProvider(
      "leekscript",
      new UserCodeSemanticTokensProvider(definitionManager),
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

  context.subscriptions.push(userCodeHoverProvider);
  context.subscriptions.push(userCodeCompletionProviderRegistration);
  context.subscriptions.push(userCodeDefinitionProvider);
  context.subscriptions.push(userCodeSemanticTokensProvider);
  diagnosticService = new DiagnosticService(
    diagnosticCollection,
    analyzerService,
    dataLoader,
    codebaseStateManager,
    definitionManager
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
