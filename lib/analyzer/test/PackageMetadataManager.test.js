"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const PackageMetadataManager_1 = require("../PackageMetadataManager");
const node_core_library_1 = require("@rushstack/node-core-library");
const packageJsonLookup = new node_core_library_1.PackageJsonLookup();
function resolveInTestPackage(testPackageName, ...args) {
    return path.resolve(__dirname, 'test-data/tsdoc-metadata-path-inference', testPackageName, ...args);
}
function getPackageMetadata(testPackageName) {
    const packageFolder = resolveInTestPackage(testPackageName);
    const packageJson = packageJsonLookup.tryLoadPackageJsonFor(packageFolder);
    if (!packageJson) {
        throw new Error('There should be a package.json file in the test package');
    }
    return { packageFolder, packageJson };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstArgument(mockFn) {
    return mockFn.mock.calls[0][0];
}
/* eslint-disable @typescript-eslint/typedef */
describe('PackageMetadataManager', () => {
    describe('.writeTsdocMetadataFile()', () => {
        const originalWriteFile = node_core_library_1.FileSystem.writeFile;
        const mockWriteFile = jest.fn();
        beforeAll(() => {
            node_core_library_1.FileSystem.writeFile = mockWriteFile;
        });
        afterEach(() => {
            mockWriteFile.mockClear();
        });
        afterAll(() => {
            node_core_library_1.FileSystem.writeFile = originalWriteFile;
        });
        it('writes the tsdoc metadata file at the provided path', () => {
            PackageMetadataManager_1.PackageMetadataManager.writeTsdocMetadataFile('/foo/bar', "\r\n" /* CrLf */);
            expect(firstArgument(mockWriteFile)).toBe('/foo/bar');
        });
    });
    describe('.resolveTsdocMetadataPath()', () => {
        describe('when an empty tsdocMetadataPath is provided', () => {
            const tsdocMetadataPath = '';
            describe('given a package.json where the field "tsdocMetadata" is defined', () => {
                it('outputs the tsdoc metadata path as given by "tsdocMetadata" relative to the folder of package.json', () => {
                    const { packageFolder, packageJson } = getPackageMetadata('package-inferred-from-tsdoc-metadata');
                    expect(PackageMetadataManager_1.PackageMetadataManager.resolveTsdocMetadataPath(packageFolder, packageJson, tsdocMetadataPath)).toBe(path.resolve(packageFolder, packageJson.tsdocMetadata));
                });
            });
            describe('given a package.json where the field "typings" is defined and "tsdocMetadata" is not defined', () => {
                it('outputs the tsdoc metadata file "tsdoc-metadata.json" in the same folder as the path of "typings"', () => {
                    const { packageFolder, packageJson } = getPackageMetadata('package-inferred-from-typings');
                    expect(PackageMetadataManager_1.PackageMetadataManager.resolveTsdocMetadataPath(packageFolder, packageJson, tsdocMetadataPath)).toBe(path.resolve(packageFolder, path.dirname(packageJson.typings), 'tsdoc-metadata.json'));
                });
            });
            describe('given a package.json where the field "main" is defined but not "typings" nor "tsdocMetadata"', () => {
                it('outputs the tsdoc metadata file "tsdoc-metadata.json" in the same folder as the path of "main"', () => {
                    const { packageFolder, packageJson } = getPackageMetadata('package-inferred-from-main');
                    expect(PackageMetadataManager_1.PackageMetadataManager.resolveTsdocMetadataPath(packageFolder, packageJson, tsdocMetadataPath)).toBe(path.resolve(packageFolder, path.dirname(packageJson.main), 'tsdoc-metadata.json'));
                });
            });
            describe('given a package.json where the fields "main", "typings" and "tsdocMetadata" are not defined', () => {
                it('outputs the tsdoc metadata file "tsdoc-metadata.json" in the folder where package.json is located', () => {
                    const { packageFolder, packageJson } = getPackageMetadata('package-default');
                    expect(PackageMetadataManager_1.PackageMetadataManager.resolveTsdocMetadataPath(packageFolder, packageJson, tsdocMetadataPath)).toBe(path.resolve(packageFolder, 'tsdoc-metadata.json'));
                });
            });
        });
        describe('when a non-empty tsdocMetadataPath is provided', () => {
            const tsdocMetadataPath = 'path/to/custom-tsdoc-metadata.json';
            describe('given a package.json where the field "tsdocMetadata" is defined', () => {
                it('outputs the tsdoc metadata file at the provided path in the folder where package.json is located', () => {
                    const { packageFolder, packageJson } = getPackageMetadata('package-inferred-from-tsdocMetadata');
                    expect(PackageMetadataManager_1.PackageMetadataManager.resolveTsdocMetadataPath(packageFolder, packageJson, tsdocMetadataPath)).toBe(path.resolve(packageFolder, tsdocMetadataPath));
                });
            });
            describe('given a package.json where the field "typings" is defined and "tsdocMetadata" is not defined', () => {
                it('outputs the tsdoc metadata file at the provided path in the folder where package.json is located', () => {
                    const { packageFolder, packageJson } = getPackageMetadata('package-inferred-from-typings');
                    expect(PackageMetadataManager_1.PackageMetadataManager.resolveTsdocMetadataPath(packageFolder, packageJson, tsdocMetadataPath)).toBe(path.resolve(packageFolder, tsdocMetadataPath));
                });
            });
            describe('given a package.json where the field "main" is defined but not "typings" nor "tsdocMetadata"', () => {
                it('outputs the tsdoc metadata file at the provided path in the folder where package.json is located', () => {
                    const { packageFolder, packageJson } = getPackageMetadata('package-inferred-from-main');
                    expect(PackageMetadataManager_1.PackageMetadataManager.resolveTsdocMetadataPath(packageFolder, packageJson, tsdocMetadataPath)).toBe(path.resolve(packageFolder, tsdocMetadataPath));
                });
            });
            describe('given a package.json where the fields "main", "typings" and "tsdocMetadata" are not defined', () => {
                it('outputs the tsdoc metadata file at the provided path in the folder where package.json is located', () => {
                    const { packageFolder, packageJson } = getPackageMetadata('package-default');
                    expect(PackageMetadataManager_1.PackageMetadataManager.resolveTsdocMetadataPath(packageFolder, packageJson, tsdocMetadataPath)).toBe(path.resolve(packageFolder, tsdocMetadataPath));
                });
            });
        });
    });
});
/* eslint-enable @typescript-eslint/typedef */
//# sourceMappingURL=PackageMetadataManager.test.js.map