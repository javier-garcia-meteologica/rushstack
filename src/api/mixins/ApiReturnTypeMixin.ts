// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.s

import { ApiItem, IApiItemJson, IApiItemConstructor, IApiItemOptions } from '../items/ApiItem';
import { IExcerptTokenRange, Excerpt } from './Excerpt';
import { ApiDeclarationMixin } from './ApiDeclarationMixin';
import { InternalError } from '@microsoft/node-core-library';

/**
 * Constructor options for {@link (ApiReturnTypeMixin:interface)}.
 * @public
 */
export interface IApiReturnTypeMixinOptions extends IApiItemOptions {
  returnTypeTokenRange: IExcerptTokenRange;
}

export interface IApiReturnTypeMixinJson extends IApiItemJson {
  returnTypeTokenRange: IExcerptTokenRange;
}

const _returnTypeExcerpt: unique symbol = Symbol('ApiReturnTypeMixin._returnTypeExcerpt');

/**
 * The mixin base class for API items that are functions that return a value.
 *
 * @remarks
 *
 * This is part of the {@link ApiModel} hierarchy of classes, which are serializable representations of
 * API declarations.  The non-abstract classes (e.g. `ApiClass`, `ApiEnum`, `ApiInterface`, etc.) use
 * TypeScript "mixin" functions (e.g. `ApiDeclarationMixin`, `ApiItemContainerMixin`, etc.) to add various
 * features that cannot be represented as a normal inheritance chain (since TypeScript does not allow a child class
 * to extend more than one base class).  The "mixin" is a TypeScript merged declaration with three components:
 * the function that generates a subclass, an interface that describes the members of the subclass, and
 * a namespace containing static members of the class.
 *
 * @public
 */
// tslint:disable-next-line:interface-name
export interface ApiReturnTypeMixin extends ApiItem {
  /**
   * An {@link Excerpt} that describes the type of the function's return value.
   */
  readonly returnTypeExcerpt: Excerpt;

  /** @override */
  serializeInto(jsonObject: Partial<IApiReturnTypeMixinJson>): void;
}

/**
 * Mixin function for {@link (ApiReturnTypeMixin:interface)}.
 *
 * @param baseClass - The base class to be extended
 * @returns A child class that extends baseClass, adding the {@link (ApiReturnTypeMixin:interface)} functionality.
 *
 * @public
 */
export function ApiReturnTypeMixin<TBaseClass extends IApiItemConstructor>(baseClass: TBaseClass):
  TBaseClass & (new (...args: any[]) => ApiReturnTypeMixin) { // tslint:disable-line:no-any

  abstract class MixedClass extends baseClass implements ApiReturnTypeMixin {
    public [_returnTypeExcerpt]: Excerpt;

    /** @override */
    public static onDeserializeInto(options: Partial<IApiReturnTypeMixinOptions>,
      jsonObject: IApiReturnTypeMixinJson): void {

      baseClass.onDeserializeInto(options, jsonObject);

      options.returnTypeTokenRange = jsonObject.returnTypeTokenRange;
    }

    // tslint:disable-next-line:no-any
    constructor(...args: any[]) {
      super(...args);

      const options: IApiReturnTypeMixinOptions = args[0];

      if (ApiDeclarationMixin.isBaseClassOf(this)) {
        this[_returnTypeExcerpt] = this.buildExcerpt(options.returnTypeTokenRange);
      } else {
        throw new InternalError('ApiReturnTypeMixin expects a base class that inherits from ApiDeclarationMixin');
      }
    }

    public get returnTypeExcerpt(): Excerpt {
      return this[_returnTypeExcerpt];
    }

    /** @override */
    public serializeInto(jsonObject: Partial<IApiReturnTypeMixinJson>): void {
      super.serializeInto(jsonObject);

      jsonObject.returnTypeTokenRange = this.returnTypeExcerpt.tokenRange;
    }
  }

  return MixedClass;
}

/**
 * Static members for {@link (ApiReturnTypeMixin:interface)}.
 * @public
 */
export namespace ApiReturnTypeMixin {
  /**
   * A type guard that tests whether the specified `ApiItem` subclass extends the `ApiReturnTypeMixin` mixin.
   *
   * @remarks
   *
   * The JavaScript `instanceof` operator cannot be used to test for mixin inheritance, because each invocation of
   * the mixin function produces a different subclass.  (This could be mitigated by `Symbol.hasInstance`, however
   * the TypeScript type system cannot invoke a runtime test.)
   */
  export function isBaseClassOf(apiItem: ApiItem): apiItem is ApiReturnTypeMixin {
    return apiItem.hasOwnProperty(_returnTypeExcerpt);
  }
}
