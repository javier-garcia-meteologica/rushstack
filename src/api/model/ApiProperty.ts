// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { ApiItemKind } from './ApiItem';
import { ApiDeclarationMixin, IApiDeclarationMixinOptions } from '../mixins/ApiDeclarationMixin';
import { ApiStaticMixin, IApiStaticMixinOptions } from '../mixins/ApiStaticMixin';
import { ApiDocumentedItem, IApiDocumentedItemOptions } from './ApiDocumentedItem';
import { ApiReleaseTagMixin, IApiReleaseTagMixinOptions } from '../mixins/ApiReleaseTagMixin';

/** @public */
export interface IApiPropertyOptions extends
  IApiDeclarationMixinOptions,
  IApiReleaseTagMixinOptions,
  IApiStaticMixinOptions,
  IApiDocumentedItemOptions {
}

/** @public */
export class ApiProperty extends ApiDeclarationMixin(ApiReleaseTagMixin(ApiStaticMixin(ApiDocumentedItem))) {
  public static getCanonicalReference(name: string, isStatic: boolean): string {
    if (isStatic) {
      return `(${name}:static)`;
    } else {
      return `(${name}:instance)`;
    }
  }

  public constructor(options: IApiPropertyOptions) {
    super(options);
  }

  /** @override */
  public get kind(): ApiItemKind {
    return ApiItemKind.PropertySignature;
  }

  /** @override */
  public get canonicalReference(): string {
    return ApiProperty.getCanonicalReference(this.name, this.isStatic);
  }
}
