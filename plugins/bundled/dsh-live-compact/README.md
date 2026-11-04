# 边做边压 Live Compact

Live Compact 就是边做边压。活着的时候就压，不等窗口堆满。

DSH 把压缩写死在大约 80%。不到这条线，上下文一直堆。到了才调一次模型，十几秒，还要计费。压完注意力会飘。更麻烦的是，压完没多久又满了。1M 的窗口根本不够用，再压一次更慢。

为什么非要等到 80%？边做边压不行吗？

超过 2 万 token 就切一刀。切的是刚结束的这一轮，不调用模型。切点前面的原文不动，缓存命中还是原来的水准。上下文因此一直被按在较低的位置。雷霆大压缩能拖就拖，拖到尽可能后面。就算哪天满了、真的触发了，掉下来之后小切还在，不会很快又堆回去。

![边做边压](docs/slide-cover.jpg)

![为什么非要等到 80%](docs/slide-why.jpg)

## 两场测评

两场不混在一张表里。150 道是编程短题，串在同一次对话里。20 题是 WebUniverse 长链路。

国内镜像：https://download.merkyorlynn.com/live-compact.html

![150 题和 20 题](docs/slide-results.jpg)

![适用范围与不足](docs/slide-scope.jpg)

短题 150 道，Aider `polyglot-benchmark` `7e0611e`。Python、Go、JavaScript、Rust、Java 各 30 题，没有 C++，按字母序穿插。从 `python-affine-cipher`、`go-alphametics`、`javascript-affine-cipher`、`rust-accumulate`、`java-affine-cipher` 往下走。

| | 原版 | Live Compact |
|---|---:|---:|
| 通过 | 150/150 | 150/150 |
| 全程命中率 | 99.55% | 99.56% |
| 缓存命中 | 335.0M | 244.3M |
| 缓存未命中 | 1.498M | 1.088M |
| 费用 | $1.50 | $1.15，预热 0 |
| 上下文峰值 | 679K | 589K |
| 压缩 | 1 次，12.8 秒 | 145 刀，2.2 秒 |
| 墙钟 | 8,531 秒 | 6,105 秒 |

便宜约 23%。145 刀切掉约 474K token。峰值 589,414，结束 589,554，没到 65 万。墙钟 6,105 秒这轮只跑了插件一边，快出来的时间不能全算在插件上。

长链路 20 题是另一场。原版第 15 题才做模型摘要，14.552 秒，切掉 520,460。压完上下文掉到 15.5 万，结束时又回到 433,844。插件 20 刀，74 毫秒，切掉 486,193。题末平均上下文 217,276，比原版 366,942 低 40.8%。结束上下文 323,726，比原版低 25.4%。题末采样命中率原版 99.87%，插件 99.90%。第 20 题那一跳原版 99.84%，插件 99.95%。采样命中率按每题末次请求的 token 加权，平均上下文取 20 个题末快照。

## 安装

```sh
dsh plugin --profile web add https://download.merkyorlynn.com/downloads/plugins/dsh-live-compact-1.0.1.tgz
```

和 CLI 一样，也可以先装到本机再看版本：

```sh
npm install -g --force "https://download.merkyorlynn.com/downloads/plugins/dsh-live-compact-1.0.1.tgz"
dsh-live-compact --version
```

需要 DSH `>=0.2.0-rc.2 <0.3.0`。1.0.1 不再引用宿主包未导出的内部函数，干净安装可以激活。装上后跑长任务，日志里出现 `spine cut …ms` 才算这刀生效。页面：https://download.merkyorlynn.com/live-compact.html

DSH-TUI 先不要装。它的预设里还挂着原版压缩，这个包换不掉。

被切掉的原文会明文写到 `~/.dsh/compaction-spine/shadow`，只增不删，要自己清理。

MIT，见 `LICENSE`。
