import { AstSymbol } from './AstSymbol';
/**
 * Indicates the import kind for an `AstImport`.
 */
export declare enum AstImportKind {
    /**
     * An import statement such as `import X from "y";`.
     */
    DefaultImport = 0,
    /**
     * An import statement such as `import { X } from "y";`.
     */
    NamedImport = 1,
    /**
     * An import statement such as `import * as x from "y";`.
     */
    StarImport = 2,
    /**
     * An import statement such as `import x = require("y");`.
     */
    EqualsImport = 3
}
/**
 * Constructor parameters for AstImport
 *
 * @privateRemarks
 * Our naming convention is to use I____Parameters for constructor options and
 * I____Options for general function options.  However the word "parameters" is
 * confusingly similar to the terminology for function parameters modeled by API Extractor,
 * so we use I____Options for both cases in this code base.
 */
export interface IAstImportOptions {
    readonly importKind: AstImportKind;
    readonly modulePath: string;
    readonly exportName: string;
}
/**
 * For a symbol that was imported from an external package, this tracks the import
 * statement that was used to reach it.
 */
export declare class AstImport {
    readonly importKind: AstImportKind;
    /**
     * The name of the external package (and possibly module path) that this definition
     * was imported from.
     *
     * Example: "@rushstack/node-core-library/lib/FileSystem"
     */
    readonly modulePath: string;
    /**
     * The name of the symbol being imported.
     *
     * @remarks
     *
     * The name depends on the type of import:
     *
     * ```ts
     * // For AstImportKind.DefaultImport style, exportName would be "X" in this example:
     * import X from "y";
     *
     * // For AstImportKind.NamedImport style, exportName would be "X" in this example:
     * import { X } from "y";
     *
     * // For AstImportKind.StarImport style, exportName would be "x" in this example:
     * import * as x from "y";
     *
     * // For AstImportKind.EqualsImport style, exportName would be "x" in this example:
     * import x = require("y");
     * ```
     */
    readonly exportName: string;
    /**
     * If this import statement refers to an API from an external package that is tracked by API Extractor
     * (according to `PackageMetadataManager.isAedocSupportedFor()`), then this property will return the
     * corresponding AstSymbol.  Otherwise, it is undefined.
     */
    astSymbol: AstSymbol | undefined;
    /**
     * If modulePath and exportName are defined, then this is a dictionary key
     * that combines them with a colon (":").
     *
     * Example: "@rushstack/node-core-library/lib/FileSystem:FileSystem"
     */
    readonly key: string;
    constructor(options: IAstImportOptions);
    /**
     * Allows `AstEntity.localName` to be used as a convenient generalization of `AstSymbol.localName` and
     * `AstImport.exportName`.
     */
    readonly localName: string;
    /**
     * Calculates the lookup key used with `AstImport.key`
     */
    static getKey(options: IAstImportOptions): string;
}
//# sourceMappingURL=AstImport.d.ts.map