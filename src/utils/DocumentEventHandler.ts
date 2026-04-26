import * as vscode from "vscode";
import { DiagnosticService } from "../services/DiagnosticService";
import { DataLoader } from "../providers/leekscript/DataLoader";
import { LocalFilesService } from "../services/local-files/LocalFilesService";

/**
 * Handles all document-related events
 */
export class DocumentEventHandler {
  constructor(
    private context: vscode.ExtensionContext,
    private diagnosticService: DiagnosticService,
    private localFileService: LocalFilesService,
    private dataLoader: DataLoader,
  ) {}

  /**
   * Register all document event listeners
   */
  registerAll(): void {
    this.registerSaveListener();
    this.registerDeleteListener();
    this.registerOpenListener();
    this.registerChangeListener();
    this.registerCloseListener();
    this.registerTextEditorSelectionChangeListener();
    this.registerCreateListener();
    this.registerRenameListener();
  }

  /**
   * Register file rename listener
   */
  private registerRenameListener(): void {
    const renameListener = vscode.workspace.onDidRenameFiles(async (event) => {
      for (const file of event.files) {
        // check if folder or .leek file was renamed

        try {
          const stat = await vscode.workspace.fs.stat(file.newUri);

          const isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
          const isFile = (stat.type & vscode.FileType.File) !== 0;

          if (isDirectory) {
            console.log(
              "Folder moved:",
              file.oldUri.fsPath,
              "->",
              file.newUri.fsPath,
            );

            // old folder relative path
            const oldRelativePath = this.getRelativePath(file.oldUri);

            this.localFileService.removeAllFilesInFolderFromState(
              oldRelativePath,
            );
            // get all .leek files in the renamed folder
            const leekFiles =
              await this.localFileService.getAllLeekFilesFromUri(file.newUri);

            // delete old files from state and add new files to state
            for (const leekFile of leekFiles) {
              const relativePath = this.getRelativePath(
                vscode.Uri.file(leekFile),
              );
              this.localFileService.addNewFileToState(relativePath);
            }

            // console.log("Leek files in renamed folder:", leekFiles);
          } else if (isFile) {
            if (file.oldUri.fsPath.endsWith(".leek")) {
              // remove old file from state
              const oldRelativePath = this.getRelativePath(file.oldUri);
              this.localFileService.removeFileFromState(oldRelativePath);
              // add new file to state
              const newRelativePath = this.getRelativePath(file.newUri);
              this.localFileService.addNewFileToState(newRelativePath);
            }
          }
        } catch (e) {
          // Can fail if the file no longer exists (rare edge cases)
          console.error("Stat failed for:", file.newUri.fsPath);
        }
      }
    });

    this.context.subscriptions.push(renameListener);
  }

  /**
   * Register file create listener
   */
  private registerCreateListener(): void {
    const createFileListener = vscode.workspace.onDidCreateFiles((event) => {
      event.files.forEach((uri) => {
        // skip if it's not a .leek file
        if (!uri.fsPath.endsWith(".leek")) {
          return;
        }
        const relativePath = this.getRelativePath(uri);
        this.localFileService.addNewFileToState(relativePath);
      });
    });

    this.context.subscriptions.push(createFileListener);
  }

  /**
   * Register file save listener
   */
  private registerSaveListener(): void {
    const saveListener = vscode.workspace.onDidSaveTextDocument(
      async (document) => {
        if (!this.isLeekScriptDocument(document)) {
          return;
        }

        const uri = document.uri.toString();

        // Clear any pending debounce timer for immediate analysis on save
        this.diagnosticService.clearDebounceTimer(uri);

        // Analyze the document immediately
        await this.diagnosticService.analyzeDocument(document);

        // Get relative path
        const relativePath = this.getRelativePath(document.uri);
        this.localFileService.updateFileInState(relativePath);

        // TODO: Send content to local server if needed
      },
    );

    this.context.subscriptions.push(saveListener);
  }

  /**
   * Register file/folder delete listener
   */
  private registerDeleteListener(): void {
    const deleteListener = vscode.workspace.onDidDeleteFiles((event) => {
      event.files.forEach(async (uri) => {
        const relativePath = this.getRelativePath(uri);
        const filePath = uri.fsPath;

        if (filePath.endsWith(".leek")) {
          console.log(`LeekScript file deleted: ${relativePath}`);
          this.localFileService.removeFileFromState(relativePath);
        } else {
          // check if it's a folder
          console.log(
            `Non-leek file or folder deleted: ${relativePath}, checking if it's a folder...`,
          );
          this.localFileService.removeAllFilesInFolderFromState(relativePath);
        }
      });
    });

    this.context.subscriptions.push(deleteListener);
  }

  /**
   * Register document open listener
   */
  private registerOpenListener(): void {
    const openListener = vscode.workspace.onDidOpenTextDocument(
      async (document) => {
        if (this.isLeekScriptDocument(document)) {
          await this.diagnosticService.analyzeDocument(document);
        }
      },
    );

    this.context.subscriptions.push(openListener);
  }

  /**
   * Register document change listener for real-time analysis with debouncing
   */
  private registerChangeListener(): void {
    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      const document = event.document;
      if (this.isLeekScriptDocument(document)) {
        this.diagnosticService.analyzeDocumentDebounced(document);
      }
    });

    this.context.subscriptions.push(changeListener);
  }

  /**
   * Register text editor selection change listener (need to update function definitions based on cursor position)
   */
  private registerTextEditorSelectionChangeListener(): void {
    const textEditorSelectionChangeListener =
      vscode.window.onDidChangeTextEditorSelection((e) => {
        // Only proceed if the document is a LeekScript document
        if (
          !e.textEditor ||
          !this.isLeekScriptDocument(e.textEditor.document)
        ) {
          return;
        }

        // Get user-defined code definitions at cursor position
        this.diagnosticService.getUserCodeDefinitions();
      });

    this.context.subscriptions.push(textEditorSelectionChangeListener);
  }

  /**
   * Register document close listener
   */
  private registerCloseListener(): void {
    const closeListener = vscode.workspace.onDidCloseTextDocument(
      (document) => {
        const uri = document.uri.toString();

        // Clear any pending debounce timer
        this.diagnosticService.clearDebounceTimer(uri);
        console.log(`LeekScript document closed: ${document.fileName}`);
      },
    );

    this.context.subscriptions.push(closeListener);
  }

  /**
   * Analyze all currently open documents
   */
  async analyzeOpenDocuments(): Promise<void> {
    for (const document of vscode.workspace.textDocuments) {
      if (this.isLeekScriptDocument(document)) {
        await this.diagnosticService.analyzeDocument(document);
      }
    }
  }

  /**
   * Check if a document is a LeekScript document
   */
  private isLeekScriptDocument(document: vscode.TextDocument): boolean {
    return (
      document.languageId === "leekscript" ||
      document.fileName.endsWith(".leek")
    );
  }

  /**
   * Get relative path for a URI
   */
  private getRelativePath(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    return workspaceFolder
      ? vscode.workspace.asRelativePath(uri, false)
      : uri.fsPath;
  }
}
