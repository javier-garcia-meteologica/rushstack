// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as ts from 'typescript';
import { Text, InternalError } from '@rushstack/node-core-library';
import { ReleaseTag } from '@microsoft/api-extractor-model';

import { Collector } from '../collector/Collector';
import { TypeScriptHelpers } from '../analyzer/TypeScriptHelpers';
import { Span } from '../analyzer/Span';
import { CollectorEntity } from '../collector/CollectorEntity';
import { AstDeclaration } from '../analyzer/AstDeclaration';
import { ApiItemMetadata } from '../collector/ApiItemMetadata';
import { AstImport } from '../analyzer/AstImport';
import { AstSymbol } from '../analyzer/AstSymbol';
import { ExtractorMessage } from '../api/ExtractorMessage';
import { StringWriter } from './StringWriter';
import { DtsEmitHelpers } from './DtsEmitHelpers';

export class ApiReportGenerator {
  private static _TrimSpacesRegExp: RegExp = / +$/gm;

  /**
   * Compares the contents of two API files that were created using ApiFileGenerator,
   * and returns true if they are equivalent.  Note that these files are not normally edited
   * by a human; the "equivalence" comparison here is intended to ignore spurious changes that
   * might be introduced by a tool, e.g. Git newline normalization or an editor that strips
   * whitespace when saving.
   */
  public static areEquivalentApiFileContents(actualFileContent: string, expectedFileContent: string): boolean {
    // NOTE: "\s" also matches "\r" and "\n"
    const normalizedActual: string = actualFileContent.replace(/[\s]+/g, ' ');
    const normalizedExpected: string = expectedFileContent.replace(/[\s]+/g, ' ');
    return normalizedActual === normalizedExpected;
  }

  public static generateReviewFileContent(collector: Collector): string {
    const stringWriter: StringWriter = new StringWriter();

    stringWriter.writeLine([
      `## API Report File for "${collector.workingPackage.name}"`,
      ``,
      `> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).`,
      ``
    ].join('\n'));

    // Write the opening delimiter for the Markdown code fence
    stringWriter.writeLine('```ts\n');

    // Emit the imports
    let importsEmitted: boolean = false;
    for (const entity of collector.entities) {
      if (entity.astEntity instanceof AstImport && !entity.preferredAlternative) {
        DtsEmitHelpers.emitImport(stringWriter, entity, entity.astEntity);
        importsEmitted = true;
      }
    }

    if (importsEmitted) {
      stringWriter.writeLine();
    }

    // Emit the regular declarations
    for (const entity of collector.entities) {
      if (entity.exported) {

        // First, collect the list of export names for this symbol.  When reporting messages with
        // ExtractorMessage.properties.exportName, this will enable us to emit the warning comments alongside
        // the associated export statement.
        interface IExportToEmit {
          readonly exportName: string;
          readonly associatedMessages: ExtractorMessage[];
        }
        const exportsToEmit: Map<string, IExportToEmit> = new Map<string, IExportToEmit>();

        for (const exportName of entity.exportNames) {
          if (!entity.shouldInlineExport) {
            exportsToEmit.set(exportName, { exportName, associatedMessages: [] });
          }
        }

        if (entity.astEntity instanceof AstSymbol) {
          // Emit all the declarations for this entity
          for (const astDeclaration of entity.astEntity.astDeclarations || []) {

            // Get the messages associated with this declaration
            const fetchedMessages: ExtractorMessage[] = collector.messageRouter
              .fetchAssociatedMessagesForReviewFile(astDeclaration);

            // Peel off the messages associated with an export statement and store them
            // in IExportToEmit.associatedMessages (to be processed later).  The remaining messages will
            // added to messagesToReport, to be emitted next to the declaration instead of the export statement.
            const messagesToReport: ExtractorMessage[] = [];
            for (const message of fetchedMessages) {
              if (message.properties.exportName) {
                const exportToEmit: IExportToEmit | undefined = exportsToEmit.get(message.properties.exportName);
                if (exportToEmit) {
                  exportToEmit.associatedMessages.push(message);
                  continue;
                }
              }
              messagesToReport.push(message);
            }

            stringWriter.write(ApiReportGenerator._getAedocSynopsis(collector, astDeclaration, messagesToReport));

            const span: Span = new Span(astDeclaration.declaration);

            const apiItemMetadata: ApiItemMetadata = collector.fetchApiItemMetadata(astDeclaration);
            if (apiItemMetadata.isPreapproved) {
              ApiReportGenerator._modifySpanForPreapproved(span);
            } else {
              ApiReportGenerator._modifySpan(collector, span, entity, astDeclaration, false);
            }

            span.writeModifiedText(stringWriter.stringBuilder);
            stringWriter.writeLine('\n');
          }
        }

        // Now emit the export statements for this entity.
        for (const exportToEmit of exportsToEmit.values()) {
          // Write any associated messages
          for (const message of exportToEmit.associatedMessages) {
            ApiReportGenerator._writeLineAsComments(stringWriter,
              'Warning: ' + message.formatMessageWithoutLocation());
          }

          DtsEmitHelpers.emitNamedExport(stringWriter, exportToEmit.exportName, entity);
          stringWriter.writeLine();
        }
      }
    }

    DtsEmitHelpers.emitStarExports(stringWriter, collector);

    // Write the unassociated warnings at the bottom of the file
    const unassociatedMessages: ExtractorMessage[] = collector.messageRouter
      .fetchUnassociatedMessagesForReviewFile();
    if (unassociatedMessages.length > 0) {
      stringWriter.writeLine();
      ApiReportGenerator._writeLineAsComments(stringWriter, 'Warnings were encountered during analysis:');
      ApiReportGenerator._writeLineAsComments(stringWriter, '');
      for (const unassociatedMessage of unassociatedMessages) {
        ApiReportGenerator._writeLineAsComments(stringWriter, unassociatedMessage.formatMessageWithLocation(
          collector.workingPackage.packageFolder
        ));
      }
    }

    if (collector.workingPackage.tsdocComment === undefined) {
      stringWriter.writeLine();
      ApiReportGenerator._writeLineAsComments(stringWriter, '(No @packageDocumentation comment for this package)');
    }

    // Write the closing delimiter for the Markdown code fence
    stringWriter.writeLine('\n```');

    // Remove any trailing spaces
    return stringWriter.toString().replace(ApiReportGenerator._TrimSpacesRegExp, '');
  }

  /**
   * Before writing out a declaration, _modifySpan() applies various fixups to make it nice.
   */
  private static _modifySpan(collector: Collector, span: Span, entity: CollectorEntity,
    astDeclaration: AstDeclaration, insideTypeLiteral: boolean): void {

    // Should we process this declaration at all?
    if ((astDeclaration.modifierFlags & ts.ModifierFlags.Private) !== 0) { // eslint-disable-line no-bitwise
      span.modification.skipAll();
      return;
    }

    const previousSpan: Span | undefined = span.previousSibling;

    let recurseChildren: boolean = true;
    let sortChildren: boolean = false;

    switch (span.kind) {
      case ts.SyntaxKind.JSDocComment:
        span.modification.skipAll();
        // For now, we don't transform JSDoc comment nodes at all
        recurseChildren = false;
        break;

      case ts.SyntaxKind.ExportKeyword:
      case ts.SyntaxKind.DefaultKeyword:
      case ts.SyntaxKind.DeclareKeyword:
        // Delete any explicit "export" or "declare" keywords -- we will re-add them below
        span.modification.skipAll();
        break;

      case ts.SyntaxKind.InterfaceKeyword:
      case ts.SyntaxKind.ClassKeyword:
      case ts.SyntaxKind.EnumKeyword:
      case ts.SyntaxKind.NamespaceKeyword:
      case ts.SyntaxKind.ModuleKeyword:
      case ts.SyntaxKind.TypeKeyword:
      case ts.SyntaxKind.FunctionKeyword:
        // Replace the stuff we possibly deleted above
        let replacedModifiers: string = '';

        if (entity.shouldInlineExport) {
          replacedModifiers = 'export ' + replacedModifiers;
        }

        if (previousSpan && previousSpan.kind === ts.SyntaxKind.SyntaxList) {
          // If there is a previous span of type SyntaxList, then apply it before any other modifiers
          // (e.g. "abstract") that appear there.
          previousSpan.modification.prefix = replacedModifiers + previousSpan.modification.prefix;
        } else {
          // Otherwise just stick it in front of this span
          span.modification.prefix = replacedModifiers + span.modification.prefix;
        }
        break;

      case ts.SyntaxKind.SyntaxList:
        if (span.parent) {
          if (AstDeclaration.isSupportedSyntaxKind(span.parent.kind)) {
            // If the immediate parent is an API declaration, and the immediate children are API declarations,
            // then sort the children alphabetically
            sortChildren = true;
          } else if (span.parent.kind === ts.SyntaxKind.ModuleBlock) {
            // Namespaces are special because their chain goes ModuleDeclaration -> ModuleBlock -> SyntaxList
            sortChildren = true;
          }
        }
        break;

        case ts.SyntaxKind.VariableDeclaration:
        if (!span.parent) {
          // The VariableDeclaration node is part of a VariableDeclarationList, however
          // the Entry.followedSymbol points to the VariableDeclaration part because
          // multiple definitions might share the same VariableDeclarationList.
          //
          // Since we are emitting a separate declaration for each one, we need to look upwards
          // in the ts.Node tree and write a copy of the enclosing VariableDeclarationList
          // content (e.g. "var" from "var x=1, y=2").
          const list: ts.VariableDeclarationList | undefined = TypeScriptHelpers.matchAncestor(span.node,
            [ts.SyntaxKind.VariableDeclarationList, ts.SyntaxKind.VariableDeclaration]);
          if (!list) {
            // This should not happen unless the compiler API changes somehow
            throw new InternalError('Unsupported variable declaration');
          }
          const listPrefix: string = list.getSourceFile().text
            .substring(list.getStart(), list.declarations[0].getStart());
          span.modification.prefix = listPrefix + span.modification.prefix;
          span.modification.suffix = ';';

          if (entity.shouldInlineExport) {
            span.modification.prefix = 'export ' + span.modification.prefix;
          }
        }
        break;

      case ts.SyntaxKind.Identifier:
        const referencedEntity: CollectorEntity | undefined = collector.tryGetEntityForNode(
          span.node as ts.Identifier
        );

        if (referencedEntity) {
          if (!referencedEntity.nameForEmit) {
            // This should never happen
            throw new InternalError('referencedEntry.nameForEmit is undefined');
          }

          span.modification.prefix = referencedEntity.nameForEmit;
          // For debugging:
          // span.modification.prefix += '/*R=FIX*/';
        } else {
          // For debugging:
          // span.modification.prefix += '/*R=KEEP*/';
        }

        break;

      case ts.SyntaxKind.TypeLiteral:
        insideTypeLiteral = true;
        break;
    }

    if (recurseChildren) {
      for (const child of span.children) {
        let childAstDeclaration: AstDeclaration = astDeclaration;

        if (AstDeclaration.isSupportedSyntaxKind(child.kind)) {
          childAstDeclaration = collector.astSymbolTable.getChildAstDeclarationByNode(child.node, astDeclaration);

          if (sortChildren) {
            span.modification.sortChildren = true;
            child.modification.sortKey = Collector.getSortKeyIgnoringUnderscore(
              childAstDeclaration.astSymbol.localName);
          }

          if (!insideTypeLiteral) {
            const messagesToReport: ExtractorMessage[] = collector.messageRouter
              .fetchAssociatedMessagesForReviewFile(childAstDeclaration);
            const aedocSynopsis: string = ApiReportGenerator._getAedocSynopsis(collector, childAstDeclaration,
              messagesToReport);
            const indentedAedocSynopsis: string = ApiReportGenerator._addIndentAfterNewlines(aedocSynopsis,
              child.getIndent());

            child.modification.prefix = indentedAedocSynopsis + child.modification.prefix;
          }
        }

        ApiReportGenerator._modifySpan(collector, child, entity, childAstDeclaration, insideTypeLiteral);
      }
    }
  }

  /**
   * For declarations marked as `@preapproved`, this is used instead of _modifySpan().
   */
  private static _modifySpanForPreapproved(span: Span): void {
    // Match something like this:
    //
    //   ClassDeclaration:
    //     SyntaxList:
    //       ExportKeyword:  pre=[export] sep=[ ]
    //       DeclareKeyword:  pre=[declare] sep=[ ]
    //     ClassKeyword:  pre=[class] sep=[ ]
    //     Identifier:  pre=[_PreapprovedClass] sep=[ ]
    //     FirstPunctuation:  pre=[{] sep=[\n\n    ]
    //     SyntaxList:
    //       ...
    //     CloseBraceToken:  pre=[}]
    //
    // or this:
    //   ModuleDeclaration:
    //     SyntaxList:
    //       ExportKeyword:  pre=[export] sep=[ ]
    //       DeclareKeyword:  pre=[declare] sep=[ ]
    //     NamespaceKeyword:  pre=[namespace] sep=[ ]
    //     Identifier:  pre=[_PreapprovedNamespace] sep=[ ]
    //     ModuleBlock:
    //       FirstPunctuation:  pre=[{] sep=[\n\n    ]
    //       SyntaxList:
    //         ...
    //       CloseBraceToken:  pre=[}]
    //
    // And reduce it to something like this:
    //
    //   // @internal (undocumented)
    //   class _PreapprovedClass { /* (preapproved) */ }
    //

    let skipRest: boolean = false;
    for (const child of span.children) {
      if (skipRest
        || child.kind === ts.SyntaxKind.SyntaxList
        || child.kind === ts.SyntaxKind.JSDocComment) {
        child.modification.skipAll();
      }
      if (child.kind === ts.SyntaxKind.Identifier) {
        skipRest = true;
        child.modification.omitSeparatorAfter = true;
        child.modification.suffix = ' { /* (preapproved) */ }';
      }
    }
  }

  /**
   * Writes a synopsis of the AEDoc comments, which indicates the release tag,
   * whether the item has been documented, and any warnings that were detected
   * by the analysis.
   */
  private static _getAedocSynopsis(collector: Collector, astDeclaration: AstDeclaration,
    messagesToReport: ExtractorMessage[]): string {
    const stringWriter: StringWriter = new StringWriter();

    for (const message of messagesToReport) {
      ApiReportGenerator._writeLineAsComments(stringWriter, 'Warning: ' + message.formatMessageWithoutLocation());
    }

    if (!collector.isAncillaryDeclaration(astDeclaration)) {
      const footerParts: string[] = [];
      const apiItemMetadata: ApiItemMetadata = collector.fetchApiItemMetadata(astDeclaration);
      if (!apiItemMetadata.releaseTagSameAsParent) {
        if (apiItemMetadata.effectiveReleaseTag !== ReleaseTag.None) {
          footerParts.push(ReleaseTag.getTagName(apiItemMetadata.effectiveReleaseTag));
        }
      }

      if (apiItemMetadata.isSealed) {
        footerParts.push('@sealed');
      }

      if (apiItemMetadata.isVirtual) {
        footerParts.push('@virtual');
      }

      if (apiItemMetadata.isOverride) {
        footerParts.push('@override');
      }

      if (apiItemMetadata.isEventProperty) {
        footerParts.push('@eventProperty');
      }

      if (apiItemMetadata.tsdocComment) {
        if (apiItemMetadata.tsdocComment.deprecatedBlock) {
          footerParts.push('@deprecated');
        }
      }

      if (apiItemMetadata.needsDocumentation) {
        footerParts.push('(undocumented)');
      }

      if (footerParts.length > 0) {
        if (messagesToReport.length > 0) {
          ApiReportGenerator._writeLineAsComments(stringWriter, ''); // skip a line after the warnings
        }

        ApiReportGenerator._writeLineAsComments(stringWriter, footerParts.join(' '));
      }
    }

    return stringWriter.toString();
  }

  private static _writeLineAsComments(stringWriter: StringWriter, line: string): void {
    const lines: string[] = Text.convertToLf(line).split('\n');
    for (const realLine of lines) {
      stringWriter.write('// ');
      stringWriter.write(realLine);
      stringWriter.writeLine();
    }
  }

  private static _addIndentAfterNewlines(text: string, indent: string): string {
    if (text.length === 0 || indent.length === 0) {
      return text;
    }
    return Text.replaceAll(text, '\n', '\n' + indent);
  }

}
