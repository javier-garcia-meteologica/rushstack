[Home](./index) &gt; [local](local.md) &gt; [Word\_Table](local.word_table.md) &gt; [set](local.word_table.set.md)

# Word\_Table.set method

Sets multiple properties on the object at the same time, based on JSON input.

**Signature:**
```javascript
set(properties: Interfaces.TableUpdateData, options?: {
            /**
             * Throw an error if the passed-in property list includes read-only properties (default = true).
             */
            throwOnReadOnly?: boolean;
        }): void;
```
**Returns:** `void`

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  `properties` | `Interfaces.TableUpdateData` |  |
|  `options` | `{
            /**
             * Throw an error if the passed-in property list includes read-only properties (default = true).
             */
            throwOnReadOnly?: boolean;
        }` |  |
