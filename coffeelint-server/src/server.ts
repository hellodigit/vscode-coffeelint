/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
  IPCMessageReader, IPCMessageWriter,
  createConnection, IConnection, TextDocumentSyncKind,
  TextDocuments, ITextDocument, Diagnostic, DiagnosticSeverity,
  InitializeParams, InitializeResult, TextDocumentIdentifier,
  CompletionItem, CompletionItemKind
} from 'vscode-languageserver';

var coffeeLint = require('coffeelint');
var fs = require('fs');
var path = require('path');

let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

let documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let coffeLintConfigFile: string;
let projectLintConfig = {};

function loadCofffeeLintConfig() {
  try {
    projectLintConfig = JSON.parse(fs.readFileSync(coffeLintConfigFile));
  }
  catch (error) {
    // no config file or malformed, use default then
  }
}

connection.onInitialize((params): InitializeResult => {
  coffeLintConfigFile = path.join(params.rootPath, 'coffeelint.json');
  loadCofffeeLintConfig()

  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      completionProvider: {
        resolveProvider: true
      }
    }
  }
});

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

function validateTextDocument(textDocument: ITextDocument): void {
  let diagnostics: Diagnostic[] = [];
  let text = textDocument.getText();
  let issues = coffeeLint.lint(text, projectLintConfig);
  for(var issue of issues) {
    var severity;

    if(issue.level === "warning") {
      severity = DiagnosticSeverity.Warning;
    } else if(issue.level === "error") {
      severity = DiagnosticSeverity.Error;
    }
    else {
      continue;
    }

    diagnostics.push({
      severity: severity,
      range: {
        start: {line:issue.lineNumber-1, character:0},
        end: {line:issue.lineNumber-1, character:10000} // end of line, no cols in coffeelint
      },
      message: issue.message + " (" + issue.rule + ")"
    })
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((change) => {
  loadCofffeeLintConfig();
});

connection.listen();
