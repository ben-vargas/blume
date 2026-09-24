---
"blume": patch
---

`<AutoTypeTable>` shows the right type for properties inherited from an interface in another file (`interface Props extends Base`, with `Base` imported). Those rows read their type from the file that declares them, where they used to show a slice of unrelated text from the documented file.
