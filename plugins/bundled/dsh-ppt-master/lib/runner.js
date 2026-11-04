/**
 * 进程执行层：解析 Python 解释器，并把 skill 里的脚本跑起来。
 *
 * 为什么用 `child_process.spawn` 而不用 `ctx.shell`？
 * ---------------------------------------------------
 * `ctx.shell` 收的是**命令字符串**，要经过目标 shell 的词法分析。这些脚本的
 * 参数里会出现中文路径、空格、引号、`#`、`%`、`$`，在 pwsh / cmd / bash 下
 * 转义规则各不相同 —— 一旦引号写错就是「参数被吃掉」这种极难排查的故障。
 *
 * `spawn` 收的是 **argv 数组**，没有 shell 参与，也就不存在转义问题：路径里的
 * 空格、中文、引号都原样传给 Python。这是本包唯一需要的执行语义，所以直接用
 * `spawn`，并且不引入任何第三方依赖。
 *
 * 代价：不参与 DSH 的沙箱与审批链。这些命令跑的是 skill 自带的 Python 脚本，
 * 不是模型现场拼的任意命令，因此这个取舍是可接受的。
 *
 * @module dsh-ppt-master/runner
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** 单次输出累积上限（字符）。超出截断并注明，避免把上下文撑爆。 */
const OUTPUT_CAP = 60000;

/** 探测解释器时用的最小可用性脚本：能打印版本即算可用。 */
const PROBE = 'import sys;print(sys.version.split()[0])';

/** 探测「核心依赖是否齐」的脚本。缺依赖不算探测器失败，只是记为缺失。 */
const DEP_PROBE = [
	'import importlib,json',
	'mods=["pptx","PIL","docx","openpyxl","lxml","numpy"]',
	'missing=[]',
	'for m in mods:',
	'    try:',
	'        importlib.import_module(m)',
	'    except Exception:',
	'        missing.append(m)',
	'print(json.dumps(missing))',
].join('\n');

/**
 * 解释器候选表，按优先级排列。
 *
 * `DSH_PPT_PYTHON` 优先，方便用户指定一个装了全套依赖的解释器；随后是 PATH 上的
 * `python3` / `python` / `py`。刻意**不**硬编码 DSH 自带运行时的绝对路径：那既是
 * 本机专属信息（会随包发出去），也会在别人机器上失效。
 *
 * SKILL.md 原本就记录了 Windows 上的回退规则（`python3` 失败就用 `python`），
 * 这里的顺序与之一致。
 */
const CANDIDATES = () => {
	const out = [];
	const override = process.env.DSH_PPT_PYTHON;
	if (typeof override === 'string' && override.trim() !== '') out.push(override.trim());
	if (process.platform === 'win32') out.push('python', 'python3', 'py');
	else out.push('python3', 'python');
	return out;
};

/**
 * Termux / 发行版的前缀目录候选（绝对路径），去重且去掉末尾分隔符。
 *
 * 抽出来是因为 Python 与 `rsvg-convert` 都要在这同一批目录里找 —— 手机上它们
 * 都装在 `$PREFIX/bin` 下，但宿主进程的 PATH 未必包含它。
 */
function prefixCandidates() {
	const out = [];
	if (process.platform === 'win32') return out;

	const raw = [process.env.PREFIX, process.env.TERMUX_PREFIX, '/data/data/com.termux/files/usr'];
	/**
	 * 从 PATH 反推前缀。
	 *
	 * 实测 DSH Android 上 `PREFIX` **不存在**，但 PATH 里确实有
	 * `<...>/termux/usr/bin` —— 把这层 `bin` 剥掉就得到了前缀。
	 * 不这么做就只能靠上面的硬编码路径去猜，而 App 私有目录的中间段是可变的。
	 */
	for (const entry of (process.env.PATH ?? '').split(':')) {
		const trimmed = entry.trim().replace(/\/+$/, '');
		if (trimmed === '') continue;
		if (/termux/i.test(trimmed)) raw.push(trimmed.replace(/\/(bin|applets)$/, ''));
	}
	// DSH Android 的布局：<app files>/termux/usr（手机上实际观察到的路径）。
	for (const root of ['/data/user/0', '/data/data']) {
		for (const pkg of ['com.dsh.android', 'com.dsharnessmobile.shell']) {
			raw.push(`${root}/${pkg}/files/termux/usr`);
		}
	}
	raw.push('/data/user/0/com.termux/files/usr');

	for (const value of raw) {
		if (typeof value !== 'string' || value.trim() === '') continue;
		const base = value.trim().replace(/\/+$/, '');
		if (base !== '' && !out.includes(base)) out.push(base);
	}
	return out;
}

/**
 * 非 PATH 上的常见 Python 安装位置（绝对路径），按优先级排列。
 *
 * 为什么需要这张表：Android 端（DSH Android / Termux）与部分 Linux 上，宿主进程的
 * `PATH` 是**被 App 裁剪过的**，解释器装在那儿也不一定可见；而把绝对路径写进
 * 候选表比依赖 PATH 更稳。这里只列「发行版/终端 App 的固定约定目录」，不猜用户
 * 自定义的安装位置 —— 那种情况由 `DSH_PPT_PYTHON` 覆盖。
 *
 * 每一项都要真的存在才落进候选表：否则每次探测都会多一次必然失败的 `spawn`，
 * 在手机上是白白的磁盘与进程开销。
 */
const ABSOLUTE_CANDIDATES = () => {
	const out = [];
	for (const base of prefixCandidates()) {
		for (const name of ['python3', 'python']) {
			const candidate = `${base}/bin/${name}`;
			if (existsSync(candidate) && !out.includes(candidate)) out.push(candidate);
		}
	}

	// 常规 Linux 位置。
	for (const candidate of ['/usr/bin/python3', '/usr/local/bin/python3', '/opt/homebrew/bin/python3']) {
		if (existsSync(candidate)) out.push(candidate);
	}
	return out;
};

/**
 * 判断当前是否跑在 Android/Termux 类环境上。
 *
 * 为什么不只看 `PREFIX`：实测 DSH Android 里宿主进程**没有** `PREFIX` 环境变量
 * （模型是被迫手动 `export PREFIX=...` 才发现 Termux 前缀的）。可靠的信号是
 * PATH 里出现 Android 的系统目录或 App 私有的 termux 目录 —— 这两者都不可能在
 * 桌面 Linux/macOS 上出现。
 *
 * @returns 是 Android 类环境则为 true。
 */
function isAndroidLike() {
	if (/Android/i.test(process.platform === 'android' ? 'android' : '')) return true;
	const path = process.env.PATH ?? '';
	if (/\/system\/bin|\/system\/xbin/.test(path)) return true;
	if (/termux/i.test(path)) return true;
	if (/termux/i.test(process.env.PREFIX ?? '') || /termux/i.test(process.env.TERMUX_PREFIX ?? '')) return true;
	// Termux 的私有目录存在即说明是本机 Termux 环境（能读到就说明同用户）。
	for (const dir of ['/data/data/com.termux/files/usr', '/data/user/0/com.termux/files/usr']) {
		if (existsSync(dir)) return true;
	}
	return false;
}

/** 缓存：`null` 表示还没探测过。 */
let cached = null;
/** 并发探测去重：同一个进程里只探一次。 */
let probing = null;

/**
 * 跑一个一次性短命令并取回 stdout（用于解释器探测）。
 *
 * @param bin 可执行文件（或 `py` 这类启动器）。
 * @param args 参数数组。
 * @param timeoutMs 超时。
 * @returns `{ code, stdout, stderr }`；启动失败时 code 为 -1。
 */
function probe(bin, args, timeoutMs = 20000) {
	return new Promise((resolve) => {
		let child;
		try {
			child = spawn(bin, args, { env: childEnv(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
		} catch (error) {
			resolve({ code: -1, stdout: '', stderr: String(error?.message ?? error) });
			return;
		}
		let stdout = '';
		let stderr = '';
		let settled = false;
		const finish = (value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(value);
		};
		const timer = setTimeout(() => {
			try {
				child.kill('SIGKILL');
			} catch {
				/* 已经退出 */
			}
			finish({ code: -1, stdout, stderr: `${stderr}\n[probe timed out]`.trim() });
		}, timeoutMs);
		child.stdout?.on('data', (chunk) => {
			stdout += chunk.toString('utf8');
		});
		child.stderr?.on('data', (chunk) => {
			stderr += chunk.toString('utf8');
		});
		child.on('error', (error) => finish({ code: -1, stdout, stderr: String(error?.message ?? error) }));
		child.on('close', (code) => finish({ code: code ?? -1, stdout, stderr }));
	});
}

/**
 * 探测并选出可用的 Python 解释器（进程内只探一次）。
 *
 * 判定标准不是「文件存在」，而是**真的能跑起来并打印版本**。这样 WSL 的
 * `python3` 桩、Windows Store 的应用执行别名（跑起来会弹商店）等假阳性都会被
 * 自然排除：它们拿不到干净的版本号输出。
 *
 * @returns `{ bin, prefix, version, missing }` 或 `{ error, tried }`。
 */
export async function resolvePython() {
	if (cached !== null) return cached;
	if (probing !== null) return probing;

	probing = (async () => {
		const tried = [];
		const candidates = [...CANDIDATES(), ...ABSOLUTE_CANDIDATES()];
		for (const bin of candidates) {
			// `py` 是 Windows 启动器，必须带 `-3` 才是 Python 3。
			// 绝对路径（含 `/` 或 `\`）不是启动器名，不能按 `py` 处理。
			const prefix = bin === 'py' ? ['-3'] : [];
			const version = await probe(bin, [...prefix, '-c', PROBE]);
			if (version.code !== 0) {
				tried.push({ bin, error: (version.stderr || version.stdout || 'not runnable').trim().slice(0, 200) });
				continue;
			}
			const ver = version.stdout.trim();
			// 语法探测：DEP_PROBE 是一段多行脚本，必须用 `-c` 整体传入。
			const deps = await probe(bin, [...prefix, '-c', DEP_PROBE]);
			let missing = [];
			if (deps.code === 0) {
				try {
					missing = JSON.parse(deps.stdout.trim());
				} catch {
					missing = [];
				}
			}
			cached = { bin, prefix, version: ver, missing };
			return cached;
		}
		cached = { error: 'no-runnable-python', tried };
		return cached;
	})();

	return probing;
}

/** 清掉解释器缓存（`ppt_env` 重新探测时用）。 */
export function resetPythonCache() {
	cached = null;
	probing = null;
}

/**
 * 全部已知依赖按用途分组，用于生成精确建议。
 *
 * ⚠️ 放在**模块级**（而不是 `environmentReport()` 内部）是为了让自检能断言
 * **真实的分组定义**。自检若改成对一份自造副本做判断，那么有人把 `curl_cffi`
 * 合并回 `requests` 组、或去掉 `unavailableOnAndroid` 时，自检会照样 PASS ——
 * 那是空洞断言，本项目实测踩过一次，所以宁可多一个导出。
 */
export const DEPENDENCY_GROUPS = [
		{ name: '核心（必需）', mods: ['pptx', 'docx', 'openpyxl'], install: 'python-pptx python-docx openpyxl' },
		/**
		 * 原生扩展单独成组，因为**安装方式随平台而变**。
		 *
		 * Android 上 `pip install Pillow lxml numpy` 会去 PyPI 找
		 * `*android_arm64*.whl` —— 官方没发这个平台，于是退回源码构建，而构建
		 * lxml 需要 libxml2 / libxslt 的**开发头文件**（真机实测直接失败）：
		 *
		 *   Error: Please make sure the libxml2 and libxslt development packages are installed.
		 *   ERROR: Failed to build 'lxml' when getting requirements to build wheel
		 *
		 * 更糟的是 pip 会**先把整组下完再报错**，模型看到的就是「装了十几分钟然后失败」，
		 * 然后按 `ppt_env` 给的原样命令重试 —— 死循环。
		 *
		 * Termux 仓库里这三个都有预编译包（`python-pillow` / `python-lxml` /
		 * `python-numpy`，装完即 import 成功），所以 Android 上必须走 `apt`。
		 * 桌面端不受影响：`apt` 字段只在 `isAndroidLike()` 为真时才被采用。
		 */
		{
			name: '核心（原生扩展）',
			mods: ['PIL', 'lxml', 'numpy'],
			install: 'Pillow lxml numpy',
			apt: 'python-pillow python-lxml python-numpy',
		},
		{ name: 'SVG/PDF 转换', mods: ['reportlab', 'svglib'], install: 'reportlab svglib' },
		/** PDF 解析：Android 上同样只有 apt 有预编译包（`python-pymupdf`）。 */
		{ name: 'PDF 解析', mods: ['fitz'], install: 'PyMuPDF', apt: 'python-pymupdf' },
		{ name: '文档转换', mods: ['mammoth', 'markdownify', 'bs4', 'ebooklib'], install: 'mammoth markdownify beautifulsoup4 EbookLib' },
		/**
		 * `nbconvert` 单独成组，因为它在 Android 上装不上（2026-10-10 真机逐个实测）：
		 * 它拖进 `rpds-py`，而 rpds-py 是 Rust 扩展，PyPI 没有 android 轮子，
		 * 只能源码构建（要 maturin + Rust 工具链），实测 **33 秒**后失败：
		 *
		 *   ERROR: Failed to build 'rpds-py' when getting requirements to build wheel
		 *
		 * 与 `curl_cffi` 同理，pip 的原子性会让它**废掉整条命令**。它只服务于
		 * 「把 .ipynb 笔记本转成幻灯片」这条支路，主流路径（PDF/DOCX/URL/MD）不走它。
		 */
		{
			name: '文档转换（.ipynb 笔记本，Android 不可用）',
			mods: ['nbconvert'],
			install: 'nbconvert',
			unavailableOnAndroid: true,
		},
		/**
		 * `curl_cffi` 必须与 `requests` **拆开**，理由不是洁癖而是实测灾难：
		 *
		 * `curl_cffi` 依赖 `cffi`，而 cffi 在 Android 上**只能源码构建**，构建要
		 * `aarch64-linux-android-clang` —— 那个编译器只在装了 clang 的 Termux 里才有。
		 * 真机实测（2026-10-10）：`pip install curl_cffi` 跑 **117 秒**后报
		 *
		 *   error: [Errno 2] No such file or directory: 'aarch64-linux-android-clang'
		 *   ERROR: Failed building wheel for cffi
		 *
		 * 更要命的是 pip 的**原子性**：同一条命令里只要有一个包构建失败，整条命令
		 * **一个包都不装**。实测 `pip install requests curl_cffi PyYAML` → RC=1，
		 * 之后 requests / yaml / curl_cffi **全部 False**。
		 *
		 * 也就是说把 curl_cffi 留在 pip 命令里，会让它后面所有包（PyYAML / flask /
		 * google-genai / edge-tts …）全部装不上，而模型看到的只是一句
		 * `Failed building wheel for cffi`，很容易误判成「网络问题」再重试一遍。
		 *
		 * 上游只在 `ppt_fetch` 抓强反爬站点时才用它，requests 是主路径 ——
		 * 所以 Android 上丢掉它是安全的降级。
		 */
		{ name: '网页抓取', mods: ['requests'], install: 'requests' },
		{
			name: '网页抓取（强反爬站点，Android 不可用）',
			mods: ['curl_cffi'],
			install: 'curl_cffi',
			unavailableOnAndroid: true,
		},
		{ name: 'YAML 配置', mods: ['yaml'], install: 'PyYAML' },
		/**
		 * `install` 会被拼进**一条** `pip install …` 命令行。
		 * 所以这里绝不能出现 `#` 注释 —— shell 会把注释后面的整段（包括排在后面的
		 * flask / google-genai / edge-tts）都当注释丢掉，而那正是用户最需要装的东西。
		 * 需要追加步骤的包用 `postInstall` 单独表达。
		 */
		{
			name: '视觉质检（首选 playwright；缺失时可回退 rsvg-convert）',
			mods: ['playwright'],
			install: 'playwright',
			postInstall: 'playwright install chromium',
			/** Android 上 playwright 没有发行版，连试都不必试 —— 见下方提示与 rsvg 回退。 */
			unavailableOnAndroid: true,
		},
		/**
		 * `rsvg-convert` 是 Android 上**唯一**能用的渲染后端，必须由体检带出来。
		 *
		 * 它不是一个 Python 模块，而是 librsvg 提供的可执行文件，所以用 `which` 探测
		 * （而不是 `importlib`）。真机实测缺口（2026-10-10）：
		 *
		 *   Android 上 playwright 装不上 → ppt_render 必然走 rsvg 回退 →
		 *   但 `ppt_env` 只检查 Python 模块，**从不提示装 librsvg** →
		 *   全新环境里 rsvg-convert 根本不存在 → 视觉闸门整条断掉。
		 *
		 * 症状具有误导性：`ppt_render` 会先报「playwright 不可用」再回退，而回退又
		 * 因为找不到 rsvg-convert 失败，看起来像「两个后端都坏了」。
		 *
		 * ⚠️ `androidOnly: true` 是必需的：桌面端 rsvg-convert 通常也不存在，但那里
		 * playwright 是主路径，不能因此给出 `pip install rsvg-convert` 这种**不存在
		 * 于 PyPI 的包名**（实测 pip 会报 No matching distribution 白等一轮）。
		 */
		{
			name: '渲染回退（Android 必需：playwright 不可用时的唯一后端）',
			mods: ['rsvg-convert'],
			which: 'rsvg-convert',
			apt: 'librsvg',
			androidOnly: true,
		},
		{ name: '确认页 / 实时预览', mods: ['flask'], install: 'flask' },
		/**
		 * `google-genai` 在 Android 上装不上（同一次真机逐个实测）：它拖进
		 * `cryptography`，那是 Rust 扩展，PyPI 没有 android 轮子，实测 **16 秒**后：
		 *
		 *   ERROR: Failed to build 'cryptography' when installing build dependencies
		 *   × Encountered error while generating package metadata.
		 *   ╰─> maturin
		 *
		 * 它只服务于「用 Gemini 生成配图」这条可选支路，不影响出 PPT 主流程。
		 */
		{
			name: 'AI 生图（Gemini 后端，Android 不可用）',
			mods: ['google.genai'],
			install: 'google-genai',
			unavailableOnAndroid: true,
		},
		{ name: '语音旁白', mods: ['edge_tts'], install: 'edge-tts' },
];

/**
 * 解释器与依赖的完整体检报告。
 *
 * 这是本包唯一「不跑脚本」的工具：它的价值在于把「插件不会替你 pip install」
 * 这件事说清楚 —— 缺依赖时给出确切的补齐命令，而不是让模型对着一句
 * `ModuleNotFoundError` 猜。
 *
 * @returns 结构化报告：选中的解释器、版本、缺失模块、补齐建议。
 */
export async function environmentReport() {
	resetPythonCache();
	const resolved = await resolvePython();
	const groups = DEPENDENCY_GROUPS;

	if (resolved.error !== undefined) {
		const tried = resolved.tried ?? [];
		/**
		 * 按平台给出**可执行**的安装指引。
		 *
		 * 为什么不能只写「安装 Python 3.10+ 并确保它在 PATH 上」：在 Android 上这句话
		 * 等于没说 —— 没有系统包管理器能装 Python，必须走 Termux（`pkg` / `apt`），
		 * 而且装完还要装编译工具链才能编译 PyYAML 这类没有预编译 wheel 的依赖。
		 * 实测模型会为此自己去逆向 Termux 目录布局，白烧十几分钟。
		 */
		const androidPrefix = isAndroidLike();
		let hint;
		if (androidPrefix) {
			hint =
				'没找到可用的 Python 3。**Android 上没有系统级 Python**，必须用 Termux 的包管理器装：\n' +
				'  1) 先确认 Termux 前缀（本机是 $PREFIX，通常是 /data/data/com.termux/files/usr 或\n' +
				'     <App文件目录>/termux/usr），然后 `export PATH=$PREFIX/bin:$PATH`；\n' +
				'  2) `apt-get install -y --no-install-recommends python python-pip`\n' +
				'     —— 会连带装上 python3 与 pip；\n' +
				'  3) 再跑一次 `ppt_env`，它会给出**按 apt / pip 分开**的补齐命令。\n' +
				'⚠️ **`--no-install-recommends` 不能省**：`python-pip` 的 Recommends 里写着\n' +
				'   clang / make / pkg-config，apt 默认会一起装，于是整个 LLVM（llvm/lld/libllvm）\n' +
				'   被拖进来 —— 实测同一条命令 **139 秒 → 16 秒**，且这堆东西对装依赖毫无用处。\n' +
				'⚠️ **不要**为了装依赖去装编译工具链（clang/llvm 加起来上百 MB，实测拖慢十几分钟）：\n' +
				'   本流水线要用的原生扩展（Pillow / lxml / numpy / PyMuPDF）在 Termux 仓库里\n' +
				'   都有预编译包，`ppt_env` 会直接给出对应的 `apt-get install` 命令。\n' +
				'⚠️ `pip install lxml`（或 Pillow/numpy）在 Android 上**必然失败** —— PyPI 没有\n' +
				'   android_arm64 轮子，退回源码构建又缺 libxml2 头文件。看到这个错就改用 apt，\n' +
				'  不要重试 pip，也不要去找 build-essential。\n' +
				'⚠️ playwright 在 Android 上没有发行版，**装不上是正常的**：\n' +
				'   ppt_render 会自动回退 rsvg-convert，闸门照常可用，别为它反复重试。\n' +
				'也可以用环境变量 DSH_PPT_PYTHON 指定解释器的绝对路径来跳过自动探测。';
		} else {
			hint =
				'没找到可用的 Python 3。请安装 Python 3.10+ 并确保它在 PATH 上，' +
				'或用环境变量 DSH_PPT_PYTHON 指定解释器的绝对路径。';
		}
		return {
			ok: false,
			bin: null,
			version: null,
			groups: [],
			tried,
			hint,
		};
	}

	// 逐组探测，得到精确的缺失清单。
	const android = isAndroidLike();
	const report = [];
	for (const group of groups) {
		/**
		 * `androidOnly` 的组（如 rsvg-convert）在桌面端**整组跳过**：
		 * 桌面端 playwright 是主路径，而 `rsvg-convert` 不在 PyPI 上，
		 * 报出来只会让模型去跑一条必然 `No matching distribution` 的命令。
		 * 跳过时按「已就绪」记，不进缺失清单。
		 */
		if (group.androidOnly === true && !android) {
			report.push({
				name: group.name,
				missing: [],
				install: group.install,
				apt: group.apt,
				postInstall: group.postInstall,
				unavailableOnAndroid: group.unavailableOnAndroid === true,
				androidOnly: true,
			});
			continue;
		}
		let missing;
		if (typeof group.which === 'string' && group.which !== '') {
			/**
			 * 非 Python 依赖（可执行文件）用**文件存在性**探测。
			 *
			 * ⚠️ 不能用 `/bin/sh -c 'command -v …'`：Android 上 `/bin/sh` 根本不存在
			 * （系统 shell 在 `/system/bin/sh`），spawn 直接 ENOENT，于是无论装没装
			 * 都会被判成「缺失」—— 那比不检查更糟（每次都催装）。
			 *
			 * 改成直接查 `prefixCandidates()` 下的 `<base>/bin/<name>`，与真正执行时的
			 * 查找逻辑（`findRsvgConverter`）**同源**，所以「体检说就绪」与「真能跑」
			 * 不会出现分歧。裸名字（落在 PATH 上）不在这里判：体检要回答的是
			 * 「需不需要装」，而安装只能落到 `$PREFIX/bin`。
			 */
			const found = prefixCandidates().some((base) => existsSync(`${base}/bin/${group.which}`));
			missing = found ? [] : [...group.mods];
		} else {
			const script = `import importlib,json\nmods=${JSON.stringify(group.mods)}\nmissing=[]\nfor m in mods:\n    try:\n        importlib.import_module(m)\n    except Exception:\n        missing.append(m)\nprint(json.dumps(missing))`;
			const out = await probe(resolved.bin, [...resolved.prefix, '-c', script]);
			if (out.code === 0) {
				try {
					missing = JSON.parse(out.stdout.trim());
				} catch {
					missing = [];
				}
			} else {
				missing = group.mods;
			}
		}
		report.push({
			name: group.name,
			missing,
			install: group.install,
			apt: group.apt,
			postInstall: group.postInstall,
			unavailableOnAndroid: group.unavailableOnAndroid === true,
			androidOnly: group.androidOnly === true,
		});
	}

	/**
	 * 拆分安装命令：Android 上原生扩展组必须走 `apt`，不能拼进 `pip install`。
	 *
	 * 抽成导出的纯函数（而不是内联在这里）是为了**可被自检直接单测** ——
	 * 内联写法只能在真机上「缺依赖」时才走得到，本机依赖齐全时那条分支永远不执行，
	 * 检查也就无从下手。
	 */
	const plan = planInstall(report, android);
	return {
		ok: requiredMissingRows(report, android).length === 0,
		bin: resolved.bin,
		version: resolved.version,
		groups: report,
		android,
		aptCommand: plan.aptCommand,
		pipCommand: plan.pipCommand,
		postInstall: plan.postInstall,
	};
}

/**
 * 从逐组探测结果里挑出「**真正需要装**的缺失组」—— 也就是判定 `ok` 的依据。
 *
 * ⚠️ 不能把所有缺失都算进去（2026-10-10 真机端到端验收暴露）：Android 上有 4 组
 * 依赖**永远装不上**（playwright / curl_cffi / nbconvert / google-genai，都缺
 * android 轮子）。若把它们计入，`ok` 在任何一台手机上都是恒 false ——
 * 而这个字段被 `ppt_env` 直接当成工具的 `ok` 返回给模型，模型会据此认为
 * 「环境没准备好」而反复重试安装，或者干脆放弃流水线。实测修复前最终体检就是
 * `ok=false`（而当时所有能装的依赖都已就绪）。
 *
 * 排除两类：
 * - `unavailableOnAndroid`（仅 Android）：本平台没有可用发行版。
 * - `androidOnly`（仅非 Android）：如 `rsvg-convert` 不在 PyPI 上，桌面端不需要。
 *
 * 抽成导出的纯函数是为了**可被自检直接断言**：`environmentReport()` 在本机
 * 常常走「找不到 Python」的 early return（返回 `groups: []`），
 * 那样写出来的检查永远测不到这个过滤逻辑。
 *
 * @param report 逐组探测结果。
 * @param android 是否为 Android/Termux 环境。
 * @returns 仍需安装的组（可能为空数组）。
 */
export function requiredMissingRows(report, android) {
	return report.filter(
		(row) =>
			row.missing.length > 0 &&
			!(android && row.unavailableOnAndroid === true) &&
			!(row.androidOnly === true && !android),
	);
}

/**
 * 把缺失清单拆成 apt / pip 两条命令（Android 专用）。
 *
 * ## 为什么要拆
 *
 * Android 上 PyPI 没有 `android_arm64` 轮子，原生扩展（Pillow / lxml / numpy /
 * PyMuPDF）会退回源码构建，而构建 lxml 需要 libxml2 / libxslt 的**开发头文件**
 * —— 真机实测直接失败：
 *
 * ```
 * Error: Please make sure the libxml2 and libxslt development packages are installed.
 * ERROR: Failed to build 'lxml' when getting requirements to build wheel
 * ```
 *
 * 更糟的是 pip 会**先把整组下完再报错**，模型看到的是「装了十几分钟然后失败」，
 * 然后照着同一条命令重试 —— 死循环。Termux 仓库里这几个包都有预编译版本
 * （`python-pillow` / `python-lxml` / `python-numpy` / `python-pymupdf`），
 * 所以 Android 上它们必须走 `apt`。
 *
 * ## 另外两件事
 *
 * - **`pip` 组要排除走 apt 的那些**，否则模型会照着拼出一条必然失败的命令。
 * - **`unavailableOnAndroid` 的组（playwright / curl_cffi / nbconvert / google-genai）
 *   也要排除**：它们在 Android 上没有可用发行版，写进命令等于让模型白试一轮，
 *   而且 pip 是**原子**的 —— 一个包失败会让同一条命令里**所有**包都装不上。
 *   渲染闸门已由 rsvg-convert 回退兜住。
 * - **`androidOnly` 的组在非 Android 上排除**（`rsvg-convert` 不在 PyPI 上，
 *   桌面端报它只会换来一次 `No matching distribution`）。
 *
 * @param report 逐组探测结果（含 `missing` / `install` / `apt` / `postInstall` / `unavailableOnAndroid`）。
 * @param android 是否为 Android/Termux 环境；为 false 时退化成「全部走 pip」。
 * @returns `{ aptCommand, pipCommand, postInstall }`，无内容时是空串 / 空数组。
 */
export function planInstall(report, android) {
	const missingRows = report.filter((r) => r.missing.length > 0);
	const aptRows = android ? missingRows.filter((r) => typeof r.apt === 'string' && r.apt !== '') : [];
	const pipRows = missingRows.filter(
		(r) =>
			!aptRows.includes(r) &&
			!(android && r.unavailableOnAndroid === true) &&
			!(r.androidOnly === true && !android),
	);
	return {
		aptCommand: aptRows.map((r) => r.apt).join(' '),
		pipCommand: pipRows.map((r) => r.install).join(' '),
		postInstall: pipRows.filter((r) => r.postInstall).map((r) => r.postInstall),
	};
}

/**
 * 子进程环境。
 *
 * 关键一条：`PYTHONDONTWRITEBYTECODE=1`。
 *
 * 上游脚本会 `import` 同目录的 `config.py` / `project_utils.py`，Python 默认会在
 * `__pycache__/` 里写 `.pyc` —— 而这些 `.py` 就住在**已安装的包目录**里
 * （`.../node_modules/dsh-ppt-master/skills/...`）。后果有两个：
 *   1. 用户的 node_modules 里凭空长出本不属于这个包的文件；
 *   2. 本机打包时会把这些 `.pyc` 一起打进 tarball（1.0.3 就中过一次）。
 * 关掉字节码写入是唯一能从根上堵住它的办法 —— `.npmignore` 对 `files`
 * 白名单无效，`files` 也不支持 `!` 取反（实测两者都不起作用）。
 */
function childEnv(extra) {
	return { ...process.env, PYTHONDONTWRITEBYTECODE: '1', ...extra };
}

/**
 * 跑一个非 Python 的外部命令（回退渲染器用）。
 *
 * 与 `runScript` 分开是因为它不需要解释器前缀：`rsvg-convert` 本身就是可执行文件。
 * 同样走 argv 数组、不经 shell，理由见文件头。
 *
 * @param bin 可执行文件。
 * @param args 参数数组。
 * @param timeoutMs 超时。
 * @returns `{ ok, exitCode, output }`。
 */
function runCommand(bin, args, timeoutMs = 120000) {
	return new Promise((resolve) => {
		let child;
		try {
			child = spawn(bin, args, { env: childEnv(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
		} catch (error) {
			resolve({ ok: false, exitCode: -1, output: `无法启动 ${bin}：${String(error?.message ?? error)}` });
			return;
		}
		let out = '';
		let err = '';
		let settled = false;
		const timer = setTimeout(() => {
			try {
				child.kill('SIGKILL');
			} catch {
				/* 已经退出 */
			}
		}, timeoutMs);
		const finish = (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			const text = [out.trim(), err.trim()].filter((s) => s !== '').join('\n');
			resolve({ ok: code === 0, exitCode: code ?? -1, output: text });
		};
		child.stdout?.on('data', (chunk) => {
			out += chunk.toString('utf8');
		});
		child.stderr?.on('data', (chunk) => {
			err += chunk.toString('utf8');
		});
		child.on('error', (error) => {
			err += String(error?.message ?? error);
			finish(-1);
		});
		child.on('close', (code) => finish(code));
	});
}

/**
 * 用 `python -c` 跑一段内联代码，取回输出。
 *
 * 用途：把「同一脚本的多次调用」合并进一个进程（如批量文字度量）。上游脚本的 CLI
 * 是单值接口，但它的函数是可导入的 —— 内联代码 import 那个模块后循环调用，就能把
 * N 次进程启动 + N 次模型往返压成 1 次。
 *
 * 代码以 argv 传入，不经 shell，因此不受引号/转义影响；二进制/字符串常量建议用
 * `json.dumps` 生成后再拼接，避免手工转义。
 *
 * @param code 要执行的 Python 代码。
 * @param options 选项。
 * @param options.argv 追加到 `-c <code>` 之后的位置参数（`sys.argv[1:]`）。
 * @param options.cwd 工作目录。
 * @param options.signal 取消信号。
 * @param options.timeoutMs 超时。
 * @returns `{ ok, exitCode, timedOut, output }`。
 */
export async function runPythonCode(code, options = {}) {
	const resolved = await resolvePython();
	if (resolved.error !== undefined) {
		return {
			ok: false,
			exitCode: 127,
			timedOut: false,
			output:
				'找不到可用的 Python 3。先运行 `ppt_env` 查看体检报告。\n' +
				`已尝试：${(resolved.tried ?? []).map((t) => `${t.bin}（${t.error}）`).join('; ')}`,
		};
	}
	const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 300000;
	const args = [...resolved.prefix, '-c', code, ...(options.argv ?? [])];
	return runProcess(resolved.bin, args, { cwd: options.cwd, timeoutMs, signal: options.signal });
}

/**
 * 跑一个外部进程并收拢输出（`runScript` / `runPythonCode` / `runCommand` 的共同底座）。
 *
 * @param bin 可执行文件。
 * @param args 参数数组。
 * @param options 选项。
 * @returns `{ ok, exitCode, timedOut, output }`。
 */
function runProcess(bin, args, options = {}) {
	const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 300000;
	return new Promise((resolve) => {
		let child;
		try {
			child = spawn(bin, args, {
				cwd: options.cwd,
				env: childEnv(options.env),
				stdio: ['ignore', 'pipe', 'pipe'],
				windowsHide: true,
			});
		} catch (error) {
			resolve({ ok: false, exitCode: -1, timedOut: false, output: `无法启动 ${bin}：${String(error?.message ?? error)}` });
			return;
		}

		let out = '';
		let err = '';
		let truncated = false;
		let timedOut = false;
		let settled = false;

		const append = (chunk, into) => {
			const text = chunk.toString('utf8');
			const next = into + text;
			if (next.length > OUTPUT_CAP) truncated = true;
			return next.length > OUTPUT_CAP ? next.slice(next.length - OUTPUT_CAP) : next;
		};

		const timer = setTimeout(() => {
			timedOut = true;
			try {
				child.kill('SIGKILL');
			} catch {
				/* 已经退出 */
			}
		}, timeoutMs);

		const onAbort = () => {
			try {
				child.kill('SIGKILL');
			} catch {
				/* 已经退出 */
			}
		};
		const signal = options.signal;
		if (signal !== undefined) {
			if (signal.aborted) onAbort();
			else signal.addEventListener('abort', onAbort, { once: true });
		}

		const finish = (exitCode) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (signal !== undefined) signal.removeEventListener?.('abort', onAbort);

			const parts = [];
			if (out.trim() !== '') parts.push(out.trimEnd());
			if (err.trim() !== '') parts.push(`[stderr]\n${err.trimEnd()}`);
			if (truncated) parts.push(`[输出超过 ${OUTPUT_CAP} 字符，只保留末尾部分]`);
			if (timedOut) parts.push(`[超过 ${timeoutMs}ms 未结束，已终止]`);
			const output = parts.length > 0 ? parts.join('\n') : '(无输出)';

			resolve({ ok: exitCode === 0 && !timedOut, exitCode: exitCode ?? -1, timedOut, output });
		};

		child.stdout?.on('data', (chunk) => {
			out = append(chunk, out);
		});
		child.stderr?.on('data', (chunk) => {
			err = append(chunk, err);
		});
		child.on('error', (error) => {
			err += `\n${String(error?.message ?? error)}`;
			finish(-1);
		});
		child.on('close', (code) => finish(code));
	});
}

/**
 * 跑一个 skill 脚本，取回输出。
 *
 * @param spec 工具规格（提供 `script` 与超时）。
 * @param argv 已经拼好的参数数组（不含解释器与脚本路径）。
 * @param options 执行选项。
 * @param options.cwd 工作目录（默认进程 cwd）。
 * @param options.timeoutMs 超时（毫秒）。
 * @param options.signal 外部取消信号。
 * @returns `{ ok, exitCode, output, timedOut }`。
 */
export async function runScript(spec, argv, options = {}) {
	const resolved = await resolvePython();
	if (resolved.error !== undefined) {
		return {
			ok: false,
			exitCode: 127,
			timedOut: false,
			output:
				'找不到可用的 Python 3。先运行 `ppt_env` 查看体检报告。\n' +
				`已尝试：${(resolved.tried ?? []).map((t) => `${t.bin}（${t.error}）`).join('; ')}`,
		};
	}

	const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : spec.timeoutMs ?? 300000;
	const args = [...resolved.prefix, spec.script, ...argv];
	return runProcess(resolved.bin, args, { cwd: options.cwd, timeoutMs, signal: options.signal });
}

/**
 * 渲染闸门用的检查清单（与上游 `render_inspection.py` 的提示保持一致）。
 *
 * 回退路径必须打印同一份清单：闸门的价值在于「逐页肉眼看过」，换渲染器不该
 * 让模型以为这一步的严格程度降低了。
 */
const INSPECTION_CHECKLIST = [
	'[NEXT] 逐页查看每个 PNG，检查：',
	'  1. 文字与文字 / 图标 / 形状 / 线条重叠',
	'  2. 文字超出容器（卡片 / 标签 / 色带）或画布边缘',
	'  3. 被裁掉或被遮住的文字（角标盖住数字、标签盖住公式）',
	'  4. 图表中图形与标注碰撞；缺字形（豆腐块）',
	'只在 svg_output/ 里改 → 重跑 ppt_svg_finalize → 用 pages 重渲那几页 → 重新看。',
	'每一页都干净后才能 ppt_export。',
].join('\n');

/**
 * 找 `rsvg-convert`（librsvg 的命令行渲染器）。
 *
 * 为什么需要它：上游 `render_inspection.py` 的视觉闸门**只走 playwright**，拿不到
 * playwright 时直接退出码 3。而 playwright 在 Android 上没有可用的发行版
 * （`pip install playwright` → No matching distribution），于是手机上这道「强制闸门」
 * 完全跑不起来 —— 实测模型只能自己发现 Termux 里有 rsvg-convert，再手写一条
 * `for f in *.svg; do rsvg-convert ... ` 的循环绕过去。
 *
 * rsvg-convert 是 librsvg 的一部分，画质足够做「找重叠 / 溢出 / 被裁」这类版面检查，
 * 而且是**纯命令行、无浏览器依赖**，在手机与服务器上都装得上。把它做成回退路径，
 * 闸门在手机上才真正可用。
 *
 * @returns 可执行文件路径或名字；找不到时 undefined。
 */
function findRsvgConverter() {
	const override = process.env.DSH_PPT_RSVG;
	if (typeof override === 'string' && override.trim() !== '') return override.trim();

	// 先看 PATH 上的裸名字（手机实测 rsvg-convert 就在 PATH 里）。
	// 再去已知前缀目录里找绝对路径。
	for (const base of prefixCandidates()) {
		for (const name of ['rsvg-convert']) {
			const candidate = `${base}/bin/${name}`;
			if (existsSync(candidate)) return candidate;
		}
	}
	return 'rsvg-convert';
}

/** 从 SVG 头部读 viewBox 尺寸；读不到就按 1280x720（与上游默认一致）。 */
function readViewBoxSize(file) {
	let head = '';
	try {
		head = readFileSync(file, 'utf8').slice(0, 4000);
	} catch {
		return { w: 1280, h: 720 };
	}
	const match = /viewBox\s*=\s*"0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/.exec(head);
	if (match === null) return { w: 1280, h: 720 };
	return { w: Number(match[1]), h: Number(match[2]) };
}

/**
 * 用 rsvg-convert 渲染 `svg_final/*.svg` —— playwright 不可用时的回退路径。
 *
 * 行为刻意对齐上游脚本：同样的 `svg_final/` → `<project>/inspection/*.png`、
 * 同样的 `--pages` 选择语义、同样的检查清单。区别只在渲染后端。
 *
 * @param projectDir 项目目录（绝对路径）。
 * @param options 选项。
 * @param options.scale 设备缩放（默认 1.5）。
 * @param options.out 输出子目录名（默认 inspection）。
 * @param options.pages 只渲这些页码/文件名前缀。
 * @returns `{ ok, exitCode, output }`。
 */
export async function renderWithRsvg(projectDir, options) {
	const srcDir = join(projectDir, 'svg_final');
	let entries;
	try {
		entries = readdirSync(srcDir).filter((name) => name.toLowerCase().endsWith('.svg'));
	} catch {
		return { ok: false, exitCode: 2, output: '[ERR] 找不到 svg_final/ 目录 —— 先跑 ppt_svg_finalize。' };
	}
	if (entries.length === 0) {
		return { ok: false, exitCode: 2, output: '[ERR] svg_final/ 里没有 SVG —— 先跑 ppt_svg_finalize。' };
	}

	let selected = entries.sort();
	if (Array.isArray(options.pages) && options.pages.length > 0) {
		const keys = new Set();
		for (const raw of options.pages) {
			const text = String(raw);
			keys.add(text);
			keys.add(text.replace(/^0+/, '') || '0');
		}
		const filtered = selected.filter((name) => {
			const stem = name.replace(/\.svg$/i, '');
			return keys.has(stem) || keys.has(stem.split('_')[0]);
		});
		if (filtered.length === 0) {
			return {
				ok: false,
				exitCode: 2,
				output: `[ERR] --pages ${options.pages.join(' ')} 没有匹配到任何页面（共 ${selected.length} 页）。`,
			};
		}
		selected = filtered;
	}

	const outDir = join(projectDir, options.out ?? 'inspection');
	const converter = findRsvgConverter();
	const scale = Number.isFinite(options.scale) && options.scale > 0 ? options.scale : 1.5;
	const lines = [];
	let failures = 0;

	try {
		mkdirSync(outDir, { recursive: true });
	} catch (error) {
		return { ok: false, exitCode: 1, output: `[ERR] 无法创建 ${outDir}：${String(error?.message ?? error)}` };
	}

	for (const name of selected) {
		const svgPath = join(srcDir, name);
		const { w, h } = readViewBoxSize(svgPath);
		const pngPath = join(outDir, `${name.replace(/\.svg$/i, '')}.png`);
		const result = await runCommand(
			converter,
			['-w', String(Math.round(w * scale)), '-h', String(Math.round(h * scale)), svgPath, '-o', pngPath],
		);
		if (result.ok) {
			lines.push(`[OK] ${name.replace(/\.svg$/i, '')} -> ${pngPath}`);
		} else {
			failures += 1;
			lines.push(`[FAIL] ${name}：${result.output.trim().slice(0, 300)}`);
		}
	}

	lines.push('');
	lines.push(`[DONE] ${selected.length - failures}/${selected.length} 页已渲染到 ${outDir}/`);
	lines.push('[渲染后端] rsvg-convert（playwright 不可用时的回退；版面检查足够，');
	lines.push('复杂 CSS / 网页字体的还原度低于 Chromium，如与 PPT 所见不符以导出结果为准）');
	lines.push(INSPECTION_CHECKLIST);
	return { ok: failures === 0, exitCode: failures === 0 ? 0 : 1, output: lines.join('\n') };
}
