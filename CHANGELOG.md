# [1000.18.0](https://github.com/malaporte/nopecode/compare/v1000.17.2...v1000.18.0) (2026-03-27)


### Bug Fixes

* **account:** handle pending console login polling ([#18281](https://github.com/malaporte/nopecode/issues/18281)) ([6e09a1d](https://github.com/malaporte/nopecode/commit/6e09a1d9041880e5b4a55ed756c8ea9a51b94e0d))
* **app:** agent normalization ([#19169](https://github.com/malaporte/nopecode/issues/19169)) ([5179b87](https://github.com/malaporte/nopecode/commit/5179b87aef3d629199f9d63ce73a7acc5618fe9f))
* **app:** align review file comments with diff comments ([#18406](https://github.com/malaporte/nopecode/issues/18406)) ([27a70ad](https://github.com/malaporte/nopecode/commit/27a70ad70f30faf30d159f56b394c01f9474c7a4))
* **app:** batch multi-file prompt attachments ([#18722](https://github.com/malaporte/nopecode/issues/18722)) ([9239d87](https://github.com/malaporte/nopecode/commit/9239d877b9602a5a80e9e69e744abfe011f5f991))
* **app:** filter non-renderable part types from browser store ([#18926](https://github.com/malaporte/nopecode/issues/18926)) ([431e058](https://github.com/malaporte/nopecode/commit/431e0586add85c108ceadc0366a08ee09b862ecc))
* **app:** handle session busy state better ([#18758](https://github.com/malaporte/nopecode/issues/18758)) ([8e1b53b](https://github.com/malaporte/nopecode/commit/8e1b53b32c2f74c4983e0762cd90f4c2ecc7fda8))
* **app:** hash inline script for csp ([53d0b58](https://github.com/malaporte/nopecode/commit/53d0b58ebf3468bd161dcfcdc67cd66b6508e9f8))
* **app:** ignore repeated Enter submits in prompt input ([#18148](https://github.com/malaporte/nopecode/issues/18148)) ([f4a9fe2](https://github.com/malaporte/nopecode/commit/f4a9fe29a3b9ef4050d5d4ec45c1da74fcd42a21))
* **app:** lift up project hover state to layout ([#18732](https://github.com/malaporte/nopecode/issues/18732)) ([0a7dfc0](https://github.com/malaporte/nopecode/commit/0a7dfc03ee1dbc29d65605e8ca37ed9d137bd2ec))
* apply Layer.fresh at instance service definition site ([#18418](https://github.com/malaporte/nopecode/issues/18418)) ([d70099b](https://github.com/malaporte/nopecode/commit/d70099b0596b60450ca3c0d45b01816eca25fb54))
* **app:** move message navigation off cmd+arrow ([#18728](https://github.com/malaporte/nopecode/issues/18728)) ([d1c49ba](https://github.com/malaporte/nopecode/commit/d1c49ba210315900b7d21a7d4926b739d8021c6e))
* **app:** only navigate prompt history when input is empty ([#18775](https://github.com/malaporte/nopecode/issues/18775)) ([36dfe16](https://github.com/malaporte/nopecode/commit/36dfe1646b2bb4c329238f765c8100981014022b))
* **app:** opencode web server url ([4167e25](https://github.com/malaporte/nopecode/commit/4167e25c7ec53d066fc81cb15c7ac490569be073))
* **app:** prefer cmd+k for command palette ([#18731](https://github.com/malaporte/nopecode/issues/18731)) ([0f5626d](https://github.com/malaporte/nopecode/commit/0f5626d2e46f9f8abfe616a33a4fd4f4d989e396))
* **app:** prevent stale session hover preview on refocus ([#18727](https://github.com/malaporte/nopecode/issues/18727)) ([5ea9545](https://github.com/malaporte/nopecode/commit/5ea95451dd485b15696877a9dd82c30a532b68e0))
* **app:** restore keyboard project switching in open sidebar ([#18682](https://github.com/malaporte/nopecode/issues/18682)) ([afe9b97](https://github.com/malaporte/nopecode/commit/afe9b9727415ea046dc08990f981e00e27ec4a43))
* **app:** session timeline jumping on scroll ([#18993](https://github.com/malaporte/nopecode/issues/18993)) ([b848b7e](https://github.com/malaporte/nopecode/commit/b848b7ebae7b783ae5dc121f1c865f17da453543))
* **app:** show review on the empty session route ([#18251](https://github.com/malaporte/nopecode/issues/18251)) ([41aa254](https://github.com/malaporte/nopecode/commit/41aa254db4b748b200861ee5e832b6fa3e47701e))
* **app:** sidebar truncation ([42a7734](https://github.com/malaporte/nopecode/commit/42a773481e4d50a59784d514d81257330de38ca9))
* **app:** sidebar ux ([9838f56](https://github.com/malaporte/nopecode/commit/9838f56a6f8598ae5d9b587067e4de20adfb303d))
* **app:** stop terminal autofocus on shortcuts ([#18931](https://github.com/malaporte/nopecode/issues/18931)) ([fde201c](https://github.com/malaporte/nopecode/commit/fde201c286a83ff32dda9b41d61d734a4449fe70))
* **app:** terminal rename from context menu ([#18263](https://github.com/malaporte/nopecode/issues/18263)) ([c529529](https://github.com/malaporte/nopecode/commit/c529529f84ef60f93ae187b2d89824852b365508))
* **app:** use optional chaining for model.current() in ProviderIcon ([#18927](https://github.com/malaporte/nopecode/issues/18927)) ([3f1a4ab](https://github.com/malaporte/nopecode/commit/3f1a4abe6dc72b4d24b916436d3dd95393aeb650))
* avoid truncate permission import cycle ([#18292](https://github.com/malaporte/nopecode/issues/18292)) ([7866dbc](https://github.com/malaporte/nopecode/commit/7866dbcfcc36a60d22ad466eddf54c54b21fabe3))
* beta resolver typecheck + build smoke check ([#19060](https://github.com/malaporte/nopecode/issues/19060)) ([9a64bdb](https://github.com/malaporte/nopecode/commit/9a64bdb5397dc7c75eeb7053f0024e2c89636a2c))
* better nix hash detection ([#18957](https://github.com/malaporte/nopecode/issues/18957)) ([0370772](https://github.com/malaporte/nopecode/commit/037077285ac36b8a427aa330d331e099360f1e55))
* bump gitlab-ai-provider to 5.3.3 for DWS tool approval support ([#19185](https://github.com/malaporte/nopecode/issues/19185)) ([7cb690d](https://github.com/malaporte/nopecode/commit/7cb690d7e5f687a00e8988473bd395e0e46c4899))
* **ci:** declare semantic-release deps and fix output capture in release step ([b6deffe](https://github.com/malaporte/nopecode/commit/b6deffe92b13aa280d0db49e912e3fcdfb9b1dd3))
* **core:** disable chunk timeout by default ([#18264](https://github.com/malaporte/nopecode/issues/18264)) ([d69962b](https://github.com/malaporte/nopecode/commit/d69962b0f7ca54494452dd902053088f8113809d))
* **core:** fix file watcher test ([#18698](https://github.com/malaporte/nopecode/issues/18698)) ([84d9b38](https://github.com/malaporte/nopecode/commit/84d9b388734166476055bd5c185a09df48d9d1fa))
* **core:** restore SIGHUP exit handler ([#16057](https://github.com/malaporte/nopecode/issues/16057)) ([#18527](https://github.com/malaporte/nopecode/issues/18527)) ([56644be](https://github.com/malaporte/nopecode/commit/56644be95aed9c07b9f099c37d085b89bfc8d6c0))
* **core:** use a queue to process events in event routes ([#18259](https://github.com/malaporte/nopecode/issues/18259)) ([0540751](https://github.com/malaporte/nopecode/commit/05407518973a494785b85259ad4ec29abf4f8158))
* **desktop:** fix error handling by adding errorName function to identify NotFoundError rather than statusCode ([#17591](https://github.com/malaporte/nopecode/issues/17591)) ([976aae7](https://github.com/malaporte/nopecode/commit/976aae7e4227cd0f29ac8081744a687743d425ef))
* **desktop:** remote server switching ([#17214](https://github.com/malaporte/nopecode/issues/17214)) ([bd4527b](https://github.com/malaporte/nopecode/commit/bd4527b4f28333a3c49faba43dc03d99e1e02ae2))
* docs ([8006c29](https://github.com/malaporte/nopecode/commit/8006c29db389793a7e370e51c4149a0ad24b22ba))
* ensure enterprise url is set properly during auth flow ([#19212](https://github.com/malaporte/nopecode/issues/19212)) ([d500a84](https://github.com/malaporte/nopecode/commit/d500a8432a690e802edcc065df84a9c9ec8c3652))
* improve plugin system robustness — agent/command resolution, async errors, hook timing, two-phase init ([#18280](https://github.com/malaporte/nopecode/issues/18280)) ([814a515](https://github.com/malaporte/nopecode/commit/814a515a8a2f474585ea061a99e1058b2bb8b374))
* include cache bin directory in which() lookups ([#18320](https://github.com/malaporte/nopecode/issues/18320)) ([6fcc970](https://github.com/malaporte/nopecode/commit/6fcc970def1434b095a20f5e79820fd3894883bd))
* increase operations-per-run to 1000 and pin stale action to v10.2.0 ([958a80c](https://github.com/malaporte/nopecode/commit/958a80cc052b9b342dfa2a92c0a4caf1c4418fa9))
* lots of desktop stability, better e2e error logging ([#18300](https://github.com/malaporte/nopecode/issues/18300)) ([d460614](https://github.com/malaporte/nopecode/commit/d460614cd7ad9e047a2792139ea67e16caa82ea7))
* miscellaneous small fixes ([#18328](https://github.com/malaporte/nopecode/issues/18328)) ([1071aca](https://github.com/malaporte/nopecode/commit/1071aca91fa69044f281c1e54107dfde9dce7c75))
* nix hash update parsing ([#18979](https://github.com/malaporte/nopecode/issues/18979)) ([1238d1f](https://github.com/malaporte/nopecode/commit/1238d1f61acccf05330ff8fb59f3e355239b5f82))
* nix hash update parsing... again ([#18989](https://github.com/malaporte/nopecode/issues/18989)) ([2c1d8a9](https://github.com/malaporte/nopecode/commit/2c1d8a90d567d65ac044b2feaf2ee886318247ec))
* **opencode:** avoid snapshotting files over 2MB ([#19043](https://github.com/malaporte/nopecode/issues/19043)) ([0a80ef4](https://github.com/malaporte/nopecode/commit/0a80ef4278c252cb8dca72cae5d5c5748cec7e9a))
* **opencode:** classify ZlibError from Bun fetch as retryable instead of unknown ([#19104](https://github.com/malaporte/nopecode/issues/19104)) ([7123aad](https://github.com/malaporte/nopecode/commit/7123aad5a8c8957ee5ae34a0d82c9e6800f7109e))
* **opencode:** image paste on Windows Terminal 1.25+ with kitty keyboard ([#17674](https://github.com/malaporte/nopecode/issues/17674)) ([1a4a6ea](https://github.com/malaporte/nopecode/commit/1a4a6eabe207156f5ee0584c48e04db7e556f10a))
* **opencode:** skip typechecking generated models snapshot ([#19018](https://github.com/malaporte/nopecode/issues/19018)) ([50f6aa3](https://github.com/malaporte/nopecode/commit/50f6aa37638df9cbc37a60a387d0816c40b3ecb2))
* provide merge context to beta conflict resolver ([#19055](https://github.com/malaporte/nopecode/issues/19055)) ([700f571](https://github.com/malaporte/nopecode/commit/700f57112ab6d2ced3add2021841e22b16f3b0cb))
* **provider:** only set thinkingConfig for models with reasoning capability ([#18283](https://github.com/malaporte/nopecode/issues/18283)) ([cc818f8](https://github.com/malaporte/nopecode/commit/cc818f803268881ce556fba1b0069d9b92225302))
* remove flaky cross-spawn spawner tests ([#18977](https://github.com/malaporte/nopecode/issues/18977)) ([5c1bb5d](https://github.com/malaporte/nopecode/commit/5c1bb5de86d62bd598a89cd1ba0c1c02de103a90))
* restore cross-spawn behavior for effect child processes ([#18798](https://github.com/malaporte/nopecode/issues/18798)) ([41c77cc](https://github.com/malaporte/nopecode/commit/41c77ccb33b26c09aca2ab96661dc31a5db70264))
* restore fork-specific features after v1.3.3 merge ([bb9dc22](https://github.com/malaporte/nopecode/commit/bb9dc223c4a0a038dc8c8923d2a52aec56155e7d))
* restore recent test regressions and upgrade effect beta ([#18158](https://github.com/malaporte/nopecode/issues/18158)) ([5d2f8d7](https://github.com/malaporte/nopecode/commit/5d2f8d77f964d7be6b9c9e0602f0eb6bb68993b9))
* route GitLab Duo Workflow system prompt via flowConfig ([#18928](https://github.com/malaporte/nopecode/issues/18928)) ([9330bc5](https://github.com/malaporte/nopecode/commit/9330bc5339b3ca82975f768200450d4c9aabcd35))
* **session:** preserve tagged error messages ([#18165](https://github.com/malaporte/nopecode/issues/18165)) ([84e62fc](https://github.com/malaporte/nopecode/commit/84e62fc662c00ba87f30e1dddab0474a08db487c))
* stabilize agent and skill ordering in prompt descriptions ([#18261](https://github.com/malaporte/nopecode/issues/18261)) ([2dbcd79](https://github.com/malaporte/nopecode/commit/2dbcd79fd211513b9acfafac0e2963f26424ba78))
* switch consumers to service imports to break bundle cycles ([#18438](https://github.com/malaporte/nopecode/issues/18438)) ([214a6c6](https://github.com/malaporte/nopecode/commit/214a6c6cf13038ae2a6e5a89a3d59fbf23e5be5a))
* **task:** respect agent permission config for todowrite tool ([#19125](https://github.com/malaporte/nopecode/issues/19125)) ([66a5655](https://github.com/malaporte/nopecode/commit/66a56551beb9299b0de694e5070afe22ab6bcad9))
* **ui:** eliminate N+1 reactive subscriptions in SessionTurn ([#18924](https://github.com/malaporte/nopecode/issues/18924)) ([c9c93ea](https://github.com/malaporte/nopecode/commit/c9c93eac00bda356f4cf2b03e011d0b19e535952))
* **ui:** stop auto close of sidebar on resize ([#18647](https://github.com/malaporte/nopecode/issues/18647)) ([32f9dc6](https://github.com/malaporte/nopecode/commit/32f9dc6383aa4ae55c78979ecbff2d9404b623da))
* unblock beta conflict recovery ([#19068](https://github.com/malaporte/nopecode/issues/19068)) ([aa11fa8](https://github.com/malaporte/nopecode/commit/aa11fa865d5a224bb1fea55fe6ea566c05c8befa))
* update Feishu community links for zh locales ([#18975](https://github.com/malaporte/nopecode/issues/18975)) ([7c5ed77](https://github.com/malaporte/nopecode/commit/7c5ed771c36f5acbd47a1070afc1935e8a50650b))
* update stale account url/email on re-login ([#18426](https://github.com/malaporte/nopecode/issues/18426)) ([24f9df5](https://github.com/malaporte/nopecode/commit/24f9df5463df3a52a235bb6d9b7929c6764c327d))
* Windows e2e stability (CrossSpawnSpawner, snapshot isolation, session race guards) ([#19163](https://github.com/malaporte/nopecode/issues/19163)) ([8864fdc](https://github.com/malaporte/nopecode/commit/8864fdce2f21261909f169a369fa0c3ba44ca85c))
* **windows:** use cross-spawn for shim-backed commands ([#18010](https://github.com/malaporte/nopecode/issues/18010)) ([54ed87d](https://github.com/malaporte/nopecode/commit/54ed87d53c27b9ad2e3186b8dc539eaabbc43197))
* **zen:** emit cost chunk in client-facing format, not upstream format ([#16817](https://github.com/malaporte/nopecode/issues/16817)) ([6a64177](https://github.com/malaporte/nopecode/commit/6a6417758972db9eb08b8534e84f21471899e205))


### Features

* add git-backed session review modes ([#17961](https://github.com/malaporte/nopecode/issues/17961)) ([e6f5214](https://github.com/malaporte/nopecode/commit/e6f521477959b1009153d8310fb90ac41d766b8b))
* add Node.js entry point and build script ([#18324](https://github.com/malaporte/nopecode/issues/18324)) ([92cd908](https://github.com/malaporte/nopecode/commit/92cd908fb54de951097efea8ad97ee4dc1b97c37))
* add Poe OAuth auth plugin ([#18477](https://github.com/malaporte/nopecode/issues/18477)) ([00d3b83](https://github.com/malaporte/nopecode/commit/00d3b831fc74aecde4617a008f0f2292064d72a5))
* **bedrock:** Add token caching for any amazon-bedrock provider ([#18959](https://github.com/malaporte/nopecode/issues/18959)) ([024979f](https://github.com/malaporte/nopecode/commit/024979f3fd7bd570526d69ed56151a8b82530a56))
* **core:** initial implementation of syncing ([#17814](https://github.com/malaporte/nopecode/issues/17814)) ([b0017bf](https://github.com/malaporte/nopecode/commit/b0017bf1b96ef14fc1ecf91c0b9c4b18e2dfea71))
* embed WebUI in binary with proxy flags ([#19299](https://github.com/malaporte/nopecode/issues/19299)) ([ec20efc](https://github.com/malaporte/nopecode/commit/ec20efc11a256444d5359d4520f24239d4dd36b1))
* enable GitLab Agent Platform with workflow model discovery ([#18014](https://github.com/malaporte/nopecode/issues/18014)) ([05d3e65](https://github.com/malaporte/nopecode/commit/05d3e65f767360a38a508ad198df15ca3f8c2bbe))
* **filesystem:** add AppFileSystem service, migrate Snapshot ([#18138](https://github.com/malaporte/nopecode/issues/18138)) ([81be544](https://github.com/malaporte/nopecode/commit/81be544981d04cc48b2aa5193c1b2b7096ec8bc4))
* integrate multistep auth flows into desktop app ([#18103](https://github.com/malaporte/nopecode/issues/18103)) ([8e09e8c](https://github.com/malaporte/nopecode/commit/8e09e8c6121f03244a1f25281b506a90bcb355d7))
* integrate support for multi step auth flows for providers that require additional questions ([#18035](https://github.com/malaporte/nopecode/issues/18035)) ([171e69c](https://github.com/malaporte/nopecode/commit/171e69c2fc148985af7b9506b47f048d3a34a767))
* integrate upstream OpenCode v1.3.3 ([d9cad14](https://github.com/malaporte/nopecode/commit/d9cad14ed927f29d599e0d0cb1d89e6df4af75f9))
* interactive update flow for non-patch releases ([#18662](https://github.com/malaporte/nopecode/issues/18662)) ([e2d03ce](https://github.com/malaporte/nopecode/commit/e2d03ce38c9bae484bc1592238e0c88e8ffd90bb))
* restore git-backed review modes with effectful git service ([#18900](https://github.com/malaporte/nopecode/issues/18900)) ([73e1072](https://github.com/malaporte/nopecode/commit/73e107250dd44afef244021694a3343d2cc9715a))
* switch xai provider to responses API ([#18175](https://github.com/malaporte/nopecode/issues/18175)) ([b3d0446](https://github.com/malaporte/nopecode/commit/b3d0446d13504f63c6c26dfd040779a3ccd056cc))
* **tui:** add heap snapshot functionality for TUI and server ([#19028](https://github.com/malaporte/nopecode/issues/19028)) ([15dc33d](https://github.com/malaporte/nopecode/commit/15dc33d1a38f3beb30fdc1a2bd2a0f3dd124a3a8))
* **tui:** add syntax highlighting for kotlin, hcl, lua, toml ([#18198](https://github.com/malaporte/nopecode/issues/18198)) ([4aebaaf](https://github.com/malaporte/nopecode/commit/4aebaaf067c288917dbb04abce9b4515ef934f5f))


### Reverts

* roll back git-backed review modes ([#19295](https://github.com/malaporte/nopecode/issues/19295)) ([1b028d0](https://github.com/malaporte/nopecode/commit/1b028d0632c78a9061d8c235e329313b8f41646f))

## [1000.17.2](https://github.com/malaporte/nopecode/compare/v1000.17.1...v1000.17.2) (2026-03-26)


### Bug Fixes

* **ci:** trigger publish-fork after semantic-release creates a tag ([d6c0d0e](https://github.com/malaporte/nopecode/commit/d6c0d0e9fe928f7c0e9825b35b7c6015bbb355b6))

## [1000.17.1](https://github.com/malaporte/nopecode/compare/v1000.17.0...v1000.17.1) (2026-03-26)


### Bug Fixes

* **ci:** add missing @semantic-release/npm dep and use local binary ([56fd75e](https://github.com/malaporte/nopecode/commit/56fd75e54f835a14d3bc820cc40502e85f842475))
* **ci:** checkout main branch explicitly for semantic-release ([6331e12](https://github.com/malaporte/nopecode/commit/6331e129a797636259f99fe3a8918c0e3102c6ed))
* **ci:** pass authenticated repository-url to semantic-release ([662b6a1](https://github.com/malaporte/nopecode/commit/662b6a10e0915ee0247a698accba81a9a90dbfe5))
* **ci:** replace @semantic-release/npm with exec to avoid catalog: protocol error ([08bba35](https://github.com/malaporte/nopecode/commit/08bba35359abba070ac32dd80cf82c31bd1af453))
* **kiro:** wire credits through metadataExtractor so cost is non-zero ([#15](https://github.com/malaporte/nopecode/issues/15)) ([ffef90a](https://github.com/malaporte/nopecode/commit/ffef90a91795b46e0340f38cc606eeb0e88c6a7f))
