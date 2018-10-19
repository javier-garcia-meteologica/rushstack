// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { ApiItem, ApiItemKind } from './ApiItem';

export class ApiClass extends ApiItem {
  public readonly kind: ApiItemKind = ApiItemKind.Class;

  /** @override */
  protected getSortKey(): string {
    return this.name;
  }
}
