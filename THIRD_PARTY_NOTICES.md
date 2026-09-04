# Third-party notices

## Cloudflare API schema and generated material

The generated Postman artifacts in this repository are derived from Cloudflare's official [`cloudflare/api-schemas`](https://github.com/cloudflare/api-schemas) repository. The exact source revision and digest are recorded in `schema-lock.json` and embedded in generated collection metadata.

BSD 3-Clause License

Copyright (c) 2022, Cloudflare
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## Postman tooling

Generation uses Postman's `openapi-to-postmanv2` 6.3.3 package under the Apache License 2.0. Validation downloads and SHA-256-verifies Postman's published Collection v2.1 JSON Schema. These tools and schema are not used to imply Postman endorsement.

- Converter source and license: <https://github.com/postmanlabs/openapi-to-postman>
- Collection schema: <https://schema.getpostman.com/json/collection/v2.1.0/collection.json>

Additional build-only JavaScript dependency licenses are recorded in `package-lock.json` and their installed package metadata.
