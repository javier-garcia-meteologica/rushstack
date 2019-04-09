// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as path from 'path';
import {
  FileSystem,
  NewlineKind,
  PackageJsonLookup,
  IPackageJson
} from '@microsoft/node-core-library';

import { ExtractorConfig } from './ExtractorConfig';
import { Collector } from '../collector/Collector';
import { DtsRollupGenerator, DtsRollupKind } from '../generators/DtsRollupGenerator';
import { ApiModelGenerator } from '../generators/ApiModelGenerator';
import { ApiPackage } from '@microsoft/api-extractor-model';
import { ReviewFileGenerator } from '../generators/ReviewFileGenerator';
import { PackageMetadataManager } from '../analyzer/PackageMetadataManager';
import { ValidationEnhancer } from '../enhancers/ValidationEnhancer';
import { DocCommentEnhancer } from '../enhancers/DocCommentEnhancer';
import { CompilerState } from './CompilerState';
import { ExtractorMessage } from './ExtractorMessage';
import { MessageRouter } from '../collector/MessageRouter';
import { ConsoleMessageId } from './ConsoleMessageId';

/**
 * Runtime options for Extractor.
 *
 * @public
 */
export interface IExtractorInvokeOptions {
  /**
   * An optional TypeScript compiler state.  This allows an optimization where multiple invocations of API Extractor
   * can reuse the same TypeScript compiler analysis.
   */
  compilerState?: CompilerState;

  /**
   * Indicates that API Extractor is running as part of a local build, e.g. on developer's
   * machine. This disables certain validation that would normally be performed
   * for a ship/production build. For example, the *.api.md report file is
   * automatically updated in a local build.
   *
   * The default value is false.
   */
  localBuild?: boolean;

  /**
   * If true, API Extractor will include {@link ExtractorLogLevel.Verbose} messages in its output.
   */
  showVerboseMessages?: boolean;

  /**
   * By default API Extractor uses its own TypeScript compiler version to analyze your project.
   * This can often cause compiler errors due to incompatibilities between different TS versions.
   * Use this option to specify the folder path for your compiler version.
   */
  typescriptCompilerFolder?: string;

  /**
   * An optional callback function that will be called for each `ExtractorMessage` before it is displayed by
   * API Extractor.  The callback can customize the message, handle it, or discard it.
   *
   * @remarks
   * If a `messageCallback` is not provided, then by default API Extractor will print the messages to
   * the STDERR/STDOUT console.
   */
  messageCallback?: (message: ExtractorMessage) => void;
}

/**
 * This object represents the outcome of an invocation of API Extractor.
 *
 * @public
 */
export class ExtractorResult {
  /**
   * The TypeScript compiler state that was used.
   */
  public readonly compilerState: CompilerState;

  /**
   * The API Extractor configuration that was used.
   */
  public readonly extractorConfig: ExtractorConfig;

  /**
   * Whether the invocation of API Extractor was successful.  For example, if `succeeded` is false, then the build task
   * would normally return a nonzero process exit code, indicating that the operation failed.
   *
   * @remarks
   *
   * Normally the operation "succeeds" if `errorCount` and `warningCount` are both zero.  However if
   * {@link IExtractorInvokeOptions.localBuild} is `true`, then the operation "succeeds" if `errorCount` is zero
   * (i.e. warnings are ignored).
   */
  public readonly succeeded: boolean;

  /**
   * Returns true if the API report was found to have changed.
   */
  public readonly apiReportChanged: boolean;

  /**
   * Reports the number of errors encountered during analysis.
   *
   * @remarks
   * This does not count exceptions, where unexpected issues prematurely abort the operation.
   */
  public readonly errorCount: number;

  /**
   * Reports the number of warnings encountered during analysis.
   *
   * @remarks
   * This does not count warnings that are emitted in the API report file.
   */
  public readonly warningCount: number;

  /** @internal */
  public constructor(properties: ExtractorResult) {
    this.compilerState = properties.compilerState;
    this.extractorConfig = properties.extractorConfig;
    this.succeeded = properties.succeeded;
    this.apiReportChanged = properties.apiReportChanged;
    this.errorCount = properties.errorCount;
    this.warningCount = properties.warningCount;
  }
}

/**
 * The starting point for invoking the API Extractor tool.
 * @public
 */
export class Extractor {
  /**
   * Returns the version number of the API Extractor NPM package.
   */
  public static get version(): string {
    return Extractor._getPackageJson().version;
  }

  /**
   * Returns the package name of the API Extractor NPM package.
   */
  public static get packageName(): string {
    return Extractor._getPackageJson().name;
  }

  private static _getPackageJson(): IPackageJson {
    return PackageJsonLookup.loadOwnPackageJson(__dirname);
  }

  /**
   * Load the api-extractor.json config file from the specified path, and then invoke API Extractor.
   */
  public static loadConfigAndInvoke(configFilePath: string, options?: IExtractorInvokeOptions): ExtractorResult {
    const extractorConfig: ExtractorConfig = ExtractorConfig.loadFileAndPrepare(configFilePath);

    return Extractor.invoke(extractorConfig, options);
  }

  /**
   * Invoke API Extractor using an already prepared `ExtractorConfig` object.
   */
  public static invoke(extractorConfig: ExtractorConfig, options?: IExtractorInvokeOptions): ExtractorResult {

    if (!options) {
      options = { };
    }

    const localBuild: boolean = options.localBuild || false;

    let compilerState: CompilerState | undefined;
    if (options.compilerState) {
      compilerState = options.compilerState;
    } else {
      compilerState = CompilerState.create(extractorConfig, options);
    }

    const collector: Collector = new Collector({
      program: compilerState.program,
      messageCallback: options.messageCallback,
      extractorConfig: extractorConfig
    });

    const messageRouter: MessageRouter = collector.messageRouter;
    messageRouter.showVerboseMessages = !!options.showVerboseMessages;

    collector.analyze();

    DocCommentEnhancer.analyze(collector);
    ValidationEnhancer.analyze(collector);

    const modelBuilder: ApiModelGenerator = new ApiModelGenerator(collector);
    const apiPackage: ApiPackage = modelBuilder.buildApiPackage();

    if (extractorConfig.docModelEnabled) {
      messageRouter.logVerbose(ConsoleMessageId.WritingDocModelFile, 'Writing: ' + extractorConfig.apiJsonFilePath);
      apiPackage.saveToJsonFile(extractorConfig.apiJsonFilePath, {
        toolPackage: Extractor.packageName,
        toolVersion: Extractor.version,

        newlineConversion: NewlineKind.CrLf,
        ensureFolderExists: true,
        testMode: extractorConfig.testMode
      });
    }

    let apiReportChanged: boolean = false;

    if (extractorConfig.apiReportEnabled) {
      const actualApiReportPath: string = extractorConfig.reportTempFilePath;
      const actualApiReportShortPath: string = extractorConfig._getShortFilePath(extractorConfig.reportTempFilePath);

      const expectedApiReportPath: string = extractorConfig.reportFilePath;
      const expectedApiReportShortPath: string = extractorConfig._getShortFilePath(extractorConfig.reportFilePath);

      const actualApiReportContent: string = ReviewFileGenerator.generateReviewFileContent(collector);

      // Write the actual file
      FileSystem.writeFile(actualApiReportPath, actualApiReportContent, {
        ensureFolderExists: true,
        convertLineEndings: NewlineKind.CrLf
      });

      // Compare it against the expected file
      if (FileSystem.exists(expectedApiReportPath)) {
        const expectedApiReportContent: string = FileSystem.readFile(expectedApiReportPath);

        if (!ReviewFileGenerator.areEquivalentApiFileContents(actualApiReportContent, expectedApiReportContent)) {
          apiReportChanged = true;

          if (!localBuild) {
            // For a production build, issue a warning that will break the CI build.
            messageRouter.logWarning(ConsoleMessageId.ApiReportNotCopied,
              'You have changed the public API signature for this project.'
              + ` Please copy the file "${actualApiReportShortPath}" to "${expectedApiReportShortPath}",`
              + ` or perform a local build (which does this automatically).`
              + ` See the Git repo documentation for more info.`);
          } else {
            // For a local build, just copy the file automatically.
            messageRouter.logWarning(ConsoleMessageId.ApiReportCopied,
              'You have changed the public API signature for this project.'
              + ` Updating ${expectedApiReportShortPath}`);

            FileSystem.writeFile(expectedApiReportPath, actualApiReportContent, {
              ensureFolderExists: true,
              convertLineEndings: NewlineKind.CrLf
            });
          }
       } else {
          messageRouter.logVerbose(ConsoleMessageId.ApiReportUnchanged,
            `The API report is up to date: ${actualApiReportShortPath}`);
        }
      } else {
        // The target file does not exist, so we are setting up the API review file for the first time.
        //
        // NOTE: People sometimes make a mistake where they move a project and forget to update the "reportFolder"
        // setting, which causes a new file to silently get written to the wrong place.  This can be confusing.
        // Thus we treat the initial creation of the file specially.
        apiReportChanged = true;

        if (!localBuild) {
          // For a production build, issue a warning that will break the CI build.
          messageRouter.logWarning(ConsoleMessageId.ApiReportNotCopied,
            'The API report file is missing.'
            + ` Please copy the file "${actualApiReportShortPath}" to "${expectedApiReportShortPath}",`
            + ` or perform a local build (which does this automatically).`
            + ` See the Git repo documentation for more info.`);
        } else {
          const expectedApiReportFolder: string = path.dirname(expectedApiReportPath);
          if (!FileSystem.exists(expectedApiReportFolder)) {
            messageRouter.logError(ConsoleMessageId.ApiReportFolderMissing,
              'Unable to create the API report file. Please make sure the target folder exists:\n'
              + expectedApiReportFolder
            );
          } else {
            FileSystem.writeFile(expectedApiReportPath, actualApiReportContent, {
              convertLineEndings: NewlineKind.CrLf
            });
            messageRouter.logWarning(ConsoleMessageId.ApiReportCreated,
              'The API report file was missing, so a new file was created. Please add this file to Git:\n'
              + expectedApiReportPath
            );
          }
        }
      }
    }

    if (extractorConfig.rollupEnabled) {
      Extractor._generateRollupDtsFile(collector, extractorConfig.publicTrimmedFilePath, DtsRollupKind.PublicRelease);
      Extractor._generateRollupDtsFile(collector, extractorConfig.betaTrimmedFilePath, DtsRollupKind.BetaRelease);
      Extractor._generateRollupDtsFile(collector, extractorConfig.untrimmedFilePath, DtsRollupKind.InternalRelease);
    }

    if (extractorConfig.tsdocMetadataEnabled) {
      // Write the tsdoc-metadata.json file for this project
      PackageMetadataManager.writeTsdocMetadataFile(extractorConfig.tsdocMetadataFilePath);
    }

    // Show all the messages that we collected during analysis
    messageRouter.handleRemainingNonConsoleMessages();

    // Determine success
    let succeeded: boolean;
    if (localBuild) {
      // For a local build, fail if there were errors (but ignore warnings)
      succeeded = messageRouter.errorCount === 0;
    } else {
      // For a production build, fail if there were any errors or warnings
      succeeded = messageRouter.errorCount + messageRouter.warningCount === 0;
    }

    return new ExtractorResult({
      compilerState,
      extractorConfig,
      succeeded,
      apiReportChanged,
      errorCount: messageRouter.errorCount,
      warningCount: messageRouter.warningCount
    });
  }

  private static _generateRollupDtsFile(collector: Collector, outputPath: string, dtsKind: DtsRollupKind): void {
    if (outputPath !== '') {
      collector.messageRouter.logVerbose(ConsoleMessageId.WritingDtsRollup, `Writing package typings: ${outputPath}`);
      DtsRollupGenerator.writeTypingsFile(collector, outputPath, dtsKind);
    }
  }
}
