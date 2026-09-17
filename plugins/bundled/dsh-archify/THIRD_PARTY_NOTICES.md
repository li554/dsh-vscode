# Third-party notices

## tt-a1i/archify

This package is a port of [`tt-a1i/archify`](https://github.com/tt-a1i/archify). The upstream source is used under the MIT License.

| | |
|---|---|
| Upstream repository | [tt-a1i/archify](https://github.com/tt-a1i/archify) |
| Upstream release tag | `archify-dsh-v0.1.0` |
| Upstream commit | [`fc6e8aca1829a02af0f0efdc193a87c3754d373c`](https://github.com/tt-a1i/archify/tree/fc6e8aca1829a02af0f0efdc193a87c3754d373c) |
| Official DSH package | [`@tt-a1i/archify-dsh@0.1.0`](https://www.npmjs.com/package/@tt-a1i/archify-dsh) |
| Tarball | `https://registry.npmjs.org/@tt-a1i/archify-dsh/-/archify-dsh-0.1.0.tgz` |
| Integrity | `sha512-D8fDqV6DV/vo80Gj/3rgidd+hwBbhTVncaVoD5Uhh+DbgYlEoQQOmBVbhU5HW33wE5OqJP/2HkTRPJ0hf7W0tA==` |
| shasum | `1840447f80d0f06eef92bebbefa646bede5336a9` |
| License | MIT |

### 移植說明 / Port scope

`archify/` 与 `examples/` 两个目录是**逐字保留**的上游文件（含全部 renderers、schemas、
SKILL.md、examples 与测试），未做任何修改；`lib/`、`cordis.patch.yml`、`scripts/`、
`test/` 中的 adapter 层按 dsh 命名（`dsh-archify`）做了最小适配。上游官方 DSH 包
（`@tt-a1i/archify-dsh@0.1.0`）本身以 `skills/archify` 形式发布同样的技能内容，本移植
与其同源同版本。

上游仓库根目录的网站/发布文件（`docs/`、`README_EN.md`、`README_ZH.md`、
`benchmarks/`、`ROADMAP.md`、`PRODUCT.md`、`DESIGN.md`、`.github/`、`CONTRIBUTING.md`
与 `scripts/build-*`、`check-release-identity.mjs`）不属于技能本体，未移植。

### 逐字保留的文件 SHA-256 / Verbatim file hashes

下列 SHA-256 是对应文件**当前仓库内容**的哈希，可自行验证：

```text
2f724fa953b4eaa8ec75fa56919ce474b57adce54d2456a3791510bc53735cbd  archify/LICENSE
295b8662379fd0d23ae1220c5eb4c6e00c9c133f8303b8b107eadeca1047fd68  archify/SKILL.md
ac3759587e5a5ecbae168fec63ac4dfda0cfa8d232f752597117076648798dcb  archify/package-lock.json
db735316d5cd20586f25b25d6c3cd8d8cbd31726767698df73ab815e53625104  archify/package.json
95886aa9c7e466cf81fa3b26e90e4338c1e5fc7460477549626a97061791a58c  archify/assets/template.html
ed7b3f657c922d2c11523cca78d43b8e6e09b7a3245ec1319cf5145aad2a4cc4  archify/bin/archify.mjs
add1722186683c12770c575585bbb8774919c15b87361e10d2fe834623223159  archify/bin/open-artifact.mjs
c1f470655f3d09cf1a2f6745ab3cec407e5246926237b92a67d673c74e339e02  archify/bin/preview.mjs
1c7bf59b871ae2333919e034e79cd506a51be4a51ad93689bde35c809a07ae5c  archify/bin/visual-check.mjs
c89203f7f4954adc5626246f5dbf8b26486d7c3631c5978487fc664aaa0ed64f  archify/delta/architecture-delta.mjs
af939579dcafc8b4c49f09594591577994398aee57a57369d4c791dfc0d85a42  archify/examples/agent-run.lifecycle.json
9c94c8c0b2104478b77befb4cc5e343d381acba6e66645ab17616fde20b60e05  archify/examples/agent-tool-call.workflow.json
545f20920c89b69c2bb1f15508d5543fddbeb15cffba61e102206e04bd5a5cd9  archify/examples/async-job-roundtrip.sequence.json
4bbaa6ca3cd4036002fd5d0f3a332eb922cec69d09bac3d7925f95beb4308389  archify/examples/cache-miss-request.sequence.json
c112195e7285e3e4aedaeab3e1f85f5891d30fccc2c260aebe4e1da12c80cf84  archify/examples/checkout-platform.base.architecture.json
e3aaf47f77afeadafc81c6ce853dc1df68cc1e6932dec972cf478f4008fdda99  archify/examples/checkout-platform.head.architecture.json
3c30dd770f181415c11ec0b0526d86991af2177fb790182ecb7bf47d0c798cd7  archify/examples/dataflow-product-analytics.html
735c2c5819266e6ea2a71775b6eefce98b53030ce90cb721dc8e1d022ce5be71  archify/examples/deployment-release.lifecycle.json
a92d6597ddbe164f395da32a7d4b33cfae08edd7d9600a6fb45a2058e5bbb43e  archify/examples/event-stream.dataflow.json
5c760c82eee545dfb7da38a4e628059d7891af4cfbfc13c8a7009ea64f69aa1b  archify/examples/incident-response.workflow.json
9ef047c4a029fa4649d84a0c299552a5d02f31ac0e3a51b7187b6696f33ed718  archify/examples/lifecycle-agent-run.html
6fa38a7ccedf96da592d60b392783b846188eaa3ec9136c6dc06ca020e43a110  archify/examples/product-analytics.dataflow.json
738e9c7f22e4e6e88f5aafc087dc58409105927daa9a79aaf240c8393654494f  archify/examples/production-deployment.architecture.json
e5c880417eac1623923c3dd5461e0c78acd762e1621a28bd53fc14a84cad6a91  archify/examples/release-delivery.workflow.json
738d651b8c3f3ff8b5b5298834cbd8b7acda5f46a456c5be031647cbc6eb2216  archify/examples/sequence-cache-miss-request.html
b1753910784abc7e37952868051861c2c90d953aeb80342ebb59febdeec87612  archify/examples/web-app-rendered.html
483350f5297df682aba4e4a0fa491307ce3d3abd725ae4df07fab177490752cf  archify/examples/web-app.architecture.json
a7a3b2836f7f5795173db40527a9d2df1c53c99ac3a08049617ccef3072629c0  archify/examples/workflow-agent-tool-call-rendered.html
8220aeaae507dcecedd4e544940b4db46accb0502b2bb512e87ca2ed6670e07f  archify/recipes/scenarios.mjs
35220be7dee5792d630e0b5d5a3e4d57ddf16a497015a4674d0fdb0910f7811b  archify/references/authoring-contract.md
15d2fb47412288c5a489c402877bf92e774d10f481f16f9d1af2fdd907fc0ba6  archify/references/delivery-contract.md
dc0d9ffe6b9987d73d2d48710fce5ab4c120bbf1940ff1eb9355259c5d4f32b6  archify/references/viewer-runtime.md
f6de99c32436feed3378b0ddef516bb4732ff27a89c543b50635d4d14a15a55a  archify/renderers/architecture/grid.mjs
c49ba91dd57d78bd2a3a5852ba1cdc8bf6b2afd1d96845ff3b240bdae55c5be0  archify/renderers/architecture/render-architecture.mjs
18c4f86ba62fcee371d9fe38094625b3a68cc76231c36ab8c8124acb4c1ffa42  archify/renderers/dataflow/README.md
89b173216c638017baa24e90a6c42ab9ce13d7e43eb2371aa871109563a5a1a4  archify/renderers/dataflow/render-dataflow.mjs
ec9b27ebf4c6a8fa675f11995c47753d3283423bac09980a4cd476d6bae9a9f8  archify/renderers/lifecycle/README.md
ac37f1afed1a1d9b70bcae3113edb1d945b0699e11efaeda9e35f03ba3cb56cf  archify/renderers/lifecycle/render-lifecycle.mjs
a442335dcf44b1587d3ad88809e31b001a4fafdf7a134040e8b1927455af4206  archify/renderers/sequence/README.md
4b855ca424a4e4d55c89d1c22a9c3b71b2176d969a8a18b6c52dae3517b1e71a  archify/renderers/sequence/render-sequence.mjs
0d221a5368b61d09ea4f21d14c6c31b2fea48b3b49edb205021261a068c271a8  archify/renderers/shared/cli.mjs
27ac252f47abbda260643f7400c126bab840aca5c050005d721ae32b87744136  archify/renderers/shared/diagnostics.mjs
7e99f9d5423f66cc9ab6224da56dc2d5aa6c6faec29178034794e9db6b5b2889  archify/renderers/shared/engineering-profiles.mjs
31c7c10cf487f9cab67c1886969a02675a644e1513461e62d366fb78ea87cb28  archify/renderers/shared/generated-validators.mjs
71e5ee761fced528afa613821e4d4ad47699e1067b83439a1152617536b4cf23  archify/renderers/shared/geometry.mjs
44c2f74a20e483dd37dae6791ede39284ce3bac1a2a13872d2912999e8504df5  archify/renderers/shared/layout-report.mjs
d195da3f1c5fceaf09d994335de7e95b891d6a53147f763be7c5224f26036887  archify/renderers/shared/legend.mjs
9c61692cf9debc99f5cb86e0df8c474d0665921345fecdfc13ded3828c94f0a8  archify/renderers/shared/output-path.mjs
e36c109c84b338ea77d2ae74e9fa9ffe4317e7780a2be8d4d78e588ddb387677  archify/renderers/shared/repository-evidence.mjs
35b6ef2c64d88c1ea4e5aab2af7c4e8a2c2e1be62db71263787d39a9797e7dea  archify/renderers/shared/text-fit.mjs
c99f5f7744031413cc289dd2628ad0ff514ba3a8ac602da24b8c8ef9e0c63e0c  archify/renderers/shared/utils.mjs
7460d7fcbcdf710649256c5e96142ae26d807a655d3296ee8caf7f5e158622cc  archify/renderers/shared/validator.mjs
dea221f672ce8cc2d8c7bdd850ee10d75cc7289915d3ab58ce2fdedf1a145592  archify/renderers/workflow/README.md
4f8e16ca648b485486ce4ff7c7d0dba4ec5af4a2d0ec8c9f41c7208ae9baba68  archify/renderers/workflow/render-workflow.mjs
06fc96a26cb8b25dcd127698dd623564f7a95e5548e55c53e4fc86aff307e78b  archify/schemas/README.md
2f2fad88bed1b408a9fd65d62f94f86c43eeefa2e82ff11edc8a2a5f20ac1a07  archify/schemas/architecture.schema.json
7cbd0cfff3715fb89a50c75188c7893db853f7f27a821522142717300da1c3e4  archify/schemas/common.schema.json
436a03b806061f623fbe9913a1476e61c8af2273047620bc91a823249bb15356  archify/schemas/dataflow.schema.json
3dc62d8d382e1495c5b43b5a4570716bd57e8e9e02f46b447ba37896b0cf917c  archify/schemas/lifecycle.schema.json
d952415061ca1bc408ebf24dd68495abe1fb4e86e1c0bc9733f539c243caafc8  archify/schemas/sequence.schema.json
4c0d90c4216b8c0fb456dd0912048d00ecc363b6c0cb53faa2837c3d729b2608  archify/schemas/workflow.schema.json
aec2aa7e56993707248307f596bfcce9a5adbb0af1593f2d2ed5a309de8cd8da  archify/scripts/check-render-output.mjs
a5f5f67d3cd4675b16fa620043a5463f3c15aad89afb1b0c7cf42cf35e883f9a  archify/scripts/generate-validators.mjs
a173a053fb26c0ac3cd72eb9b4e50411e67ca8c50bec57f05d4ca8ba79db2c0b  archify/scripts/render-examples.mjs
574f67a534057df75d968c96c8bf4c6d1ae8a635e1bb6d93d665c0fb24ff6557  archify/test/adaptive-reader-layout.test.mjs
74f2bed95bbd660cd7ea51a9bc40d526cd82d8aca07bbf2ae0c8a155d813f8bf  archify/test/animation.test.mjs
6b1bbcda1540256a5836d9cf2697fabcf793adc8150dc95be94b838c8b38fbf9  archify/test/architecture-delta.test.mjs
b243c1568c8470a28cfbebc6b9db4dfe0302e7f37f5c451ccffec53de23fd01b  archify/test/authored-reachability.test.mjs
3d10473045b4e253e90ec8dd862133634dce971d0f09408b4debd08604f8012a  archify/test/authoring-safety-contract.test.mjs
c067dcb02a57576ab282ebb6203c3056d9211c15300c413f0a209f4eee4044f5  archify/test/automatic-port-spread.test.mjs
c15569c4d0c3c15d38ae9f0364e1ded90d1a610833f00f21d73f52120ce905b0  archify/test/chapter-delta-preview.test.mjs
83afb2aef107bceaeec9749b35440be46ec160d5e115dd73cba6c4efc4f826d0  archify/test/chapter-handoff.test.mjs
968515a2bec290f820bbdebe67e1388f7951f7ff8392b2a93244983ec865f5a2  archify/test/chapter-rail.test.mjs
35f3fd3532b1341ac9c6ceab3d855e63abc7160b95502aa3c75c64e1cb3bec6f  archify/test/cli.test.mjs
2ba9ed1daf4df30e985b608609c4a6524cbbbe884d02ca1bf225288d7762ac77  archify/test/community-proof-intake.test.mjs
eda54bcffd77ffc238f1c45cf8094a203697a44a7bb4587196ee2c8cb59124b6  archify/test/cursor-onboarding.test.mjs
b7cdbd22d594c627a4d8b0b6403e403a0599df9229c561c9bb435ce200ce1344  archify/test/degraded.test.mjs
1da27d15e987bc74a8a3db98e5db5ad8da3356aceffc9f094fb16ce3b864a042  archify/test/delivery-contract.test.mjs
7b3c430a9849c8f5622c1486ac01dd413da1cf2c41735107680158fe5ef87d55  archify/test/diagram-guide.test.mjs
d5419dc45da1927a2cac1b998fdd5d1bbdbc68369ccb17cffaf4d98a90e0e242  archify/test/engineering-profile.test.mjs
212f64d7880473e534ae16a607b73cc76d183ec82480666fefee5b10a7b4f94e  archify/test/finder.test.mjs
eeda6e3ab71411724a1464819bbf0df9e88de7e2dd5f5731a93ec3709e570bc0  archify/test/gallery.test.mjs
d7c09443154ae5a7a030ab91857fcee1e6a302c4e6a8dd95e9669585d82f87b9  archify/test/generate-validators.test.mjs
4f0507b0ccafb188b470f6e69a993ac506c1716bc653763be66f3bd113ba8b26  archify/test/geometry.test.mjs
ad0a1e34a43d4ab07a97fbca5c2d2358162a240fabda3a69d419bce6631ea6b7  archify/test/golden.mjs
ebf1cd47535148c43b578eb10df0260f0f55cb6811d06c01375fbb408bf2cf6b  archify/test/grid.test.mjs
cb7b40ffbca2a901b59e9bb0a2318e53d654d5caf7e9010b88580b1e26002043  archify/test/guide-page.test.mjs
8c0d8db6ba3a79d902fdb89d77c75518b232a52153794ec70e28056d3d2e2b68  archify/test/guide.test.mjs
dad2d7e93ce550657a039bb9a8fec6d248f3c568f1fd5d657945314ed4dc7f06  archify/test/guided-views.test.mjs
c5dec206aa9a45a57c0ea20b369d9c7332506d1d3fbef228ce43ca2d50e08e33  archify/test/intent-trace.test.mjs
b8bdaf3f2494394c1ae4d300567ecef03a834ea1186ab6b93419d15c8b14979e  archify/test/landing.test.mjs
ef503bdc8c3eb99fcfab6e0352c28b7d9499c7eefe76352b472bebad0867a852  archify/test/layout-rules.test.mjs
b60d1587d6e60987f796223f4ed87842590616c1c6544cce3f02007e1867241d  archify/test/legend-contract.test.mjs
02609189ef79e6b44f9b5b6c1a5c1716886201714fb16212eeb038ab12785b8c  archify/test/motion-governor.test.mjs
fab9d65f5ed0844182b0ee62ced9412e364179960ef65fee020b0d23d977eb55  archify/test/open-artifact.test.mjs
4927b007f21a926b638ce33704450c0b3515f649c137bddfa6fdbd938fe158e6  archify/test/ordinary-model-floor.test.mjs
ad4bf9b4256d2c4cf10721a75ae61372ae6d13a6e1bea2dd46fd2074c0cafb9f  archify/test/output-path.test.mjs
9c0fd988a3123762218093ddb8b8189998272318695347ed6fb924cec490280a  archify/test/presentation.test.mjs
92c45df6deac7ccefcb8c1c38ad0f0ba7f42ddd737e5ef0baa9d15aa57ef1719  archify/test/preset-tryon.test.mjs
170e7576bb8bb18fa90538759b07111e03d840d76a46c419489c26d58250b95e  archify/test/preview-contract.test.mjs
26fcd349cd3f97d6bc79831b0c803886c196363a7f9ca9ad1ebcac54b8cbceb2  archify/test/preview.test.mjs
f393b9935bb9d915e301a1bf974b67faa72161a2717d6b65077e1060280e9af2  archify/test/proof-aperture.test.mjs
d10c7241364fbf7bd9c0b31a19120ed430cb5aad12b03eb2c5985fb973ae9870  archify/test/reach-share-card.test.mjs
c0cff7ac097b381a38d01d55756e43a5badb0ba9f8c9b44d22df99c17cf3383d  archify/test/readme-showcase.test.mjs
564675919c22b00bd4621dc64e4a59ec22ace29d7d08233447c8ba8cb7e54354  archify/test/real-repository-proof.test.mjs
573aa835cc072b37246d0c1464a866ddb9a340abc8609354d34d3b714aab6ee0  archify/test/relationship-direct-explorer.test.mjs
6a9cb990d250b4cc98d11cab2cd66db094d75293bb387e7396f8de9a5982a97d  archify/test/relationship-lens.test.mjs
6b08ecc09f22da5789b15a2b5ac57b05d6e2e9325dff3c992cb73076010f0386  archify/test/relationship-permalink.test.mjs
c15ac8f463ca7978dd48c18698b8700ae408ae05a9eebfd334425d74fad96c18  archify/test/relationship-pulse.test.mjs
261333e256394ada3beecda8df429f3c5137f858e06cb00807840dcb4283e808  archify/test/release-identity.test.mjs
9edf46263f1d010a40d8e1987b0af1c19dfc2fed050c80c5246ef69707dd9f5d  archify/test/release-package-gates.test.mjs
85b6f69159295fa9f7e47418a2c3e881636d72c4dbe3f73ec5d8ba5f828885d8  archify/test/render-output-checks.test.mjs
277b4c881c00be8ce478de6909844be20e196af9b13e0798610a888d032119f4  archify/test/repair-receipt.test.mjs
f98e6cbcb0495a412d5d895c95c9c73c6e197ddb4c17d1011267e7940fb3532b  archify/test/repository-evidence.test.mjs
baf4a0ec8ca67e781840136d57c18e7580bc9edede8763d2d124441698bfc45f  archify/test/route-journey.test.mjs
71ea0d2365bfcb492fd84dd4e3945d96dfe0115eb2614921ee738805a661158e  archify/test/route-probe.test.mjs
13a644ee37a39c098dcaa2804c230a9c63653627798f125f5d2a438ea0d61b18  archify/test/route-share-card.test.mjs
1243637d25754827f981dd4b3099d8dbf95d7b6d8a3ba66deda59dfdd9627a64  archify/test/semantic-camera.test.mjs
305dad25e06dc01825f01cb6889411cc7a6db36ceaac624f7bc6c6136ce53a76  archify/test/semantic-flow.test.mjs
c9d8b6543c4ea4954cfecaf5c234ef075400056c0084004ac11d1925915788ef  archify/test/semantic-legend-gateway.test.mjs
d7a5532c3df8fa2e95d5b5d7b3648a8e95b6974ab379846a6e15e12b89c8795b  archify/test/semantic-lens.test.mjs
7a133e5e95abedfa0820aff7e98c076e50191ed9272d4b6859a025c969446617  archify/test/semantic-passport.test.mjs
d96c3065be592136050d47d4d690f795aab4e20b0f243dfd713b192914623de8  archify/test/semantic-radar.test.mjs
7b0106565104340c1809694098a53b1d4640cc50e8055735c055e0656cba6288  archify/test/semantic-zoom.test.mjs
e3de2b0837390d31481c2d0533aed467de0263439b494843eff992060e5b0dd6  archify/test/sequence-column-fit.test.mjs
e079d492252d77612439fc055a6d79ef545829b12539aefac496f796ac90165e  archify/test/settled-flow.test.mjs
c6c8559c55aba4f6233c837caa2cadec57b131d6bd10ef5148359c73863b1596  archify/test/share-card-export.test.mjs
cdce3c00385ae3964395e17a6c804072cc72991ef3345f1c561af3c33cb9a4e6  archify/test/skill-metadata.test.mjs
2b30cb4d67924c3413bea387672a4fdcf8a8e2e98fffc207763ab6619c7246b1  archify/test/start-page.test.mjs
6b6c0ab5b396e8a608d337cd8e351d4118a75678a5d90620943249b1bc53d7b0  archify/test/story-beat-navigator.test.mjs
05143cd9c5f28ac5041fcb46daddf830ac171c0bf72335a8f9623a14916bf8bc  archify/test/story-carrier.test.mjs
be1283b9cc53fd86d42e56322970b78194e5817edc99e01d81dcfe9cb069f1a2  archify/test/story-director-strip.test.mjs
1b7b660dc322da296b4374e0af0e63e69ff3c6aa83de153142c3bc743582e1ff  archify/test/story-follow-camera.test.mjs
4136e9b4e296048e422f44d64e3d10f9d81884d1a6f099d5eb0c33c4c1e5d8dd  archify/test/story-horizon.test.mjs
7cab7c13d68abc60de25aa112a6ba5e6034dc4a9b5c81cdec388e83e0d18429d  archify/test/story-moment-link.test.mjs
b734d038ca09136f46b5b514d1f19b8ca8bfa3377839d27cbcc338179c7da210  archify/test/story-shelf.test.mjs
9ec4a06fcd365cc7a4ecc31927a004d98a62bab0eb6f3dd9feefa4e9f7ae009b  archify/test/story-trail.test.mjs
560db4791626da4d3dabcdc100b10eef1de22ad5bb83236cf4aa8195e3cccc36  archify/test/toolbar-polish.test.mjs
fcec9a325d6028078bc3c47b3748e4202e677c469b6b8ea466bc2a82193fe234  archify/test/v1-compatibility.test.mjs
ceaa480318366127a363bd184cc8a2869ecb201d8405868d518d2d1cd49340fa  archify/test/visual-check.test.mjs
2933354f291325f55b0915cb558cb7770bd1bf40512aa3a256d14181b7e0929b  archify/test/webm-artifact.smoke.mjs
b2264f4b2eff23e69b3dc79922062e942fc64ed0bec4f939fa53dda3cacd82d6  archify/test/fixtures/v1-baseline/agent-run.lifecycle.json
4903056b3634e02cce9fd7c71b61fb27e6db455480c8d776a7005346b3afc564  archify/test/fixtures/v1-baseline/agent-tool-call.workflow.json
047914c4dc4ed753b6b9f100ebaf6e7f15f9b72af0913e3a8e7a223bdef39aaa  archify/test/fixtures/v1-baseline/cache-miss-request.sequence.json
6da9959f729d81c4cdf8895fb6611080ff0368c3cde48b00b0081495a006140d  archify/test/fixtures/v1-baseline/product-analytics.dataflow.json
5fb15d0e0f7e5ed3a1a3f2e7ee406fb50aae126818c58db24f77236b07dd63f6  archify/test/fixtures/v1-baseline/web-app.architecture.json
2c96a6bef97ac8c2e5e12e48e89d361aee922763a56084e5c6f89dee47eac8a3  examples/archify-repo-grid.architecture.json
aeeb56944d8cef53eb26ddf027c219fbe0d3e36bd079ae3229ff1b7e29881eec  examples/archify-repo-grid.html
548ccc1874305edac52f6cca2a3291078d049ae32f38d3679ada35ebe4f56261  examples/archify-repo.architecture.json
bd782ab029503377b6aab7d192a460d95a12ff1337fc0d4cab3de780c2e93f2e  examples/archify-repo.html
b1a96022f0d8396bc9219230b1d41aad1e9ef1841ee69aad004adede7cb7fae3  examples/checkout-platform-delta.html
04113cfb48c4372fe79b06837678e94f1326e0cbbc212d8fc031b8b2f7053f17  examples/checkout-platform-delta.receipt.json
3c30dd770f181415c11ec0b0526d86991af2177fb790182ecb7bf47d0c798cd7  examples/dataflow-product-analytics.html
9ef047c4a029fa4649d84a0c299552a5d02f31ac0e3a51b7187b6696f33ed718  examples/lifecycle-agent-run.html
26d430096a2de84afd064487bc1f1c52160b32dbacd702786a0a60d0b26d65fc  examples/maka-architecture.architecture.json
6d11be0c1664ec7cde6b5a3cdc07a6f046666c7ced4c03003df4cd35df4fa601  examples/maka-architecture.html
738d651b8c3f3ff8b5b5298834cbd8b7acda5f46a456c5be031647cbc6eb2216  examples/sequence-cache-miss-request.html
be9addb4bef674aba743b4d7861ad18851545eb9f690b674235dbe00e7b18f73  examples/sequence-cache-miss.html
b1753910784abc7e37952868051861c2c90d953aeb80342ebb59febdeec87612  examples/web-app-rendered.html
b1753910784abc7e37952868051861c2c90d953aeb80342ebb59febdeec87612  examples/web-app.html
a7a3b2836f7f5795173db40527a9d2df1c53c99ac3a08049617ccef3072629c0  examples/workflow-agent-tool-call-rendered.html
88476501a0f9fca79302264fd54dc1f742096b136bfd9667c320fc9fc32533b3  examples/workflow-agent-tool-call.html
```

验证命令（任选其一）：

```bash
# 1) 对当前仓库直接重算（应逐行命中上面的清单）
#    macOS 没有 GNU sha256sum，用 shasum -a 256（两者输出格式同为 "<hash>  <path>"）
hashcmd() { command -v sha256sum >/dev/null 2>&1 && echo sha256sum || echo "shasum -a 256"; }
git ls-files -z archify examples | xargs -0 $(hashcmd) | sort

# 2) 与上游钉住的 commit 全树比对（需要 git）
git clone --no-checkout https://github.com/tt-a1i/archify /tmp/archify-upstream
git -C /tmp/archify-upstream checkout fc6e8aca1829a02af0f0efdc193a87c3754d373c
diff -r /tmp/archify-upstream/archify ./archify && echo "archify/ identical"
diff -r /tmp/archify-upstream/examples ./examples && echo "examples/ identical"

# 3) 与上游官方 DSH tarball 的 skills/archify 比对
#    tarball 不含 test/、generate-validators.mjs 与 package-lock.json，且其
#    package.json 是 npm 发布的精简版（无 scripts / devDependencies）——
#    diff 时一并无视这五个路径。用 -x（macOS/BSD 与 GNU diff 都支持）而非 --exclude=。
curl -sL https://registry.npmjs.org/@tt-a1i/archify-dsh/-/archify-dsh-0.1.0.tgz | tar xz -C /tmp
diff -r -x test -x generate-validators.mjs -x package.json -x package-lock.json -x node_modules /tmp/package/skills/archify ./archify \
  && echo "skills/archify identical (modulo tarball exclusions)"
```

`test/zero-regression.test.mjs` 会在每次 `npm test` 时重算本清单并逐条比对，漂移即失败。
