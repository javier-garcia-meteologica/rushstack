// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { ApiItemKind, ApiItem } from './ApiItem';
import { ApiItemContainerMixin, IApiItemContainerMixinOptions } from '../mixins/ApiItemContainerMixin';
import { IApiDeclarationMixinOptions, ApiDeclarationMixin } from '../mixins/ApiDeclarationMixin';

export interface IApiNamespaceOptions extends IApiItemContainerMixinOptions, IApiDeclarationMixinOptions {
}

export class ApiNamespace extends ApiItemContainerMixin(ApiDeclarationMixin(ApiItem)) {
  public static getCanonicalReference(name: string): string {
    return `(${name}:namespace)`;
  }

  public constructor(options: IApiNamespaceOptions) {
    super(options);
  }

  /** @override */
  public get kind(): ApiItemKind {
    return ApiItemKind.Namespace;
  }

  /** @override */
  public get canonicalReference(): string {
    return ApiNamespace.getCanonicalReference(this.name);
  }
}
