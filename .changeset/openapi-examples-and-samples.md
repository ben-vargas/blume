---
"blume": patch
---

API reference samples now use the examples an OpenAPI 3.0 or Swagger 2.0 spec declares on parameters, request bodies, and responses, which the 3.1 upgrade had moved out of reach, so a path parameter with `example: "pet_123"` renders `/pets/pet_123` instead of `/pets/string`. Response examples keep `readOnly` fields and leave out `writeOnly` ones, and the curl, JavaScript, and Python samples quote header values, URLs, and bodies for their language, so an `If-Match: "33a64df5"` header or a `$` in a token comes through intact. Schema rows label a nullable `$ref` as `Pet | null` rather than `Pet | any`, and a type array like `["string", "integer"]` as `string | integer`.
