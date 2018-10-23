// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.s

import { Mixin } from './Mixin';
import { ApiItem, IApiItemJson, IApiItemOptions, IApiItemConstructor } from '../model/ApiItem';

export interface IApiItemContainerJson extends IApiItemJson {
  members: IApiItemJson[];
}

export interface IApiItemContainerOptions extends IApiItemOptions {
  members?: ApiItem[];
}

const _members: unique symbol = Symbol('_members');
const _membersSorted: unique symbol = Symbol('_membersSorted');
const _membersByCanonicalReference: unique symbol = Symbol('_membersByCanonicalReference');

// tslint:disable-next-line:interface-name
export interface ApiItemContainerMixin {
  readonly members: ReadonlyArray<ApiItem>;
  addMember(member: ApiItem): void;

  tryGetMember(canonicalReference: string): ApiItem | undefined;

  /** @override */
  serializeInto(jsonObject: Partial<IApiItemJson>): void;
}

export function ApiItemContainerMixin<TBaseClass extends IApiItemConstructor>(baseClass: TBaseClass):
  Mixin<TBaseClass, ApiItemContainerMixin> {

  abstract class MixedClass extends baseClass implements ApiItemContainerMixin {
    public readonly [_members]: ApiItem[];
    public [_membersSorted]: boolean;
    public [_membersByCanonicalReference]: Map<string, ApiItem>;

    /** @override */
    public static onDeserializeInto(options: Partial<IApiItemContainerOptions>,
      jsonObject: IApiItemContainerJson): void {

      baseClass.onDeserializeInto(options, jsonObject);

      options.members = [];
      for (const memberObject of jsonObject.members) {
        options.members.push(ApiItem.deserialize(memberObject));
      }
    }

    // tslint:disable-next-line:no-any
    constructor(...args: any[]) {
      super(...args);
      const options: IApiItemContainerOptions = args[0] as IApiItemContainerOptions;

      this[_members] = [];
      this[_membersByCanonicalReference] = new Map<string, ApiItem>();

      if (options.members) {
        for (const member of options.members) {
          this.addMember(member);
        }
      }
    }

    public get members(): ReadonlyArray<ApiItem> {
      if (!this[_membersSorted]) {
        this[_members].sort((x, y) => x.getSortKey().localeCompare(y.getSortKey()));
        this[_membersSorted] = true;
      }

      return this[_members];
    }

    public addMember(member: ApiItem): void {
      if (this[_membersByCanonicalReference].has(member.canonicalReference)) {
        throw new Error('Another member has already been added with the same name and canonicalReference');
      }

      this[_members].push(member);
      this[_membersSorted] = false;
      this[_membersByCanonicalReference].set(member.canonicalReference, member);
    }

    public tryGetMember(canonicalReference: string): ApiItem | undefined {
      return this[_membersByCanonicalReference].get(canonicalReference);
    }

    /** @override */
    public serializeInto(jsonObject: Partial<IApiItemContainerJson>): void {
      super.serializeInto(jsonObject);

      const memberObjects: IApiItemJson[] = [];

      for (const member of this.members) {
        const memberJsonObject: Partial<IApiItemJson> = {};
        member.serializeInto(memberJsonObject);
        memberObjects.push(memberJsonObject as IApiItemJson);
      }

      jsonObject.members = memberObjects;
    }
  }

  return MixedClass;
}

export interface IApiItemContainer extends ApiItemContainerMixin, ApiItem {
}
