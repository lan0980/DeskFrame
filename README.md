# DeskFrame · Windows 桌面美化框架

![Release](https://img.shields.io/github/v/release/lan0980/DeskFrame)
![Build Host](https://github.com/lan0980/DeskFrame/actions/workflows/build-host.yml/badge.svg)
![Pack Widgets](https://github.com/lan0980/DeskFrame/actions/workflows/pack-widgets.yml/badge.svg)
![License](https://img.shields.io/github/license/lan0980/DeskFrame)

一个 Windows 桌面美化框架。宿主实现底层机制——小部件的加载、渲染、布局、配置、启停、卸载与错误隔离；桌面上显示什么、怎么交互，由小部件决定。

发布物是一个绿色单文件 exe，内含一套可直接用的小部件。构建与打包全部在 GitHub Actions 云端完成，本地不需要任何开发环境。

## 快速开始

1. 从 [Releases](https://github.com/lan0980/DeskFrame/releases/latest) 下载 `DeskFrame-win-x64.exe`，放到任意文件夹
2. 双击运行。自带渲染引擎，不依赖 .NET / Node / WebView2 / Python；首次启动会自解压到系统临时目录
3. 首次启动会自动装好 8 个内置小部件并开始显示。不想要的直接在管理界面卸载，之后不会被自动装回

未签名的 exe 首次运行可能触发 SmartScreen，点「更多信息 → 仍要运行」即可。

## 内置的小部件

| 小部件 | 作用 | 用到的接口 |
|---|---|---|
| `clock` | 时钟与日期，可切 24/12 小时制、字号、紧凑/展开 | 配置读写、窗口尺寸 |
| `sysmon` | CPU 核数、内存占用进度条、系统运行时长 | `system.info` |
| `sticky` | 桌面便签，输入自动保存 | `localStorage` |
| `launcher` | 可自定义的链接启动列表 | `open-external` |
| `clipper` | 剪贴板内容速览与快捷复制 | `clipboard.read` / `clipboard.write` |
| `weather` | 当前温度、天气、风速；演示联网权限门控 | `network` |
| `pomodoro` | 番茄钟，阶段变化广播给其他小部件并显示角标 | `bus` + `badge` |
| `bus-monitor` | 实时显示总线上流动的消息，可用来确认小部件互通是否工作 | `bus` 订阅 |

`weather` 需要联网才能取到数据，而联网默认关闭：要在管理界面的全局开关里勾选「允许小部件联网」，其余小部件不联网也能正常工作。

这些源码就在 `widgets/` 目录下，可以改、可以删，不影响框架本身。`widgets/_template/` 是空白模板，不参与打包。

## 宿主提供的机制

| 机制 | 说明 |
|---|---|
| 窗口 | 每个小部件一个独立无边框透明窗口，可置顶、点击穿透、调不透明度、锁定位置 |
| 布局 | 位置与尺寸自动记忆；锁定后只记尺寸不记位置 |
| 配置 | 小部件声明 `configSchema`，管理界面据此自动生成表单，宿主无需硬编码 |
| 生命周期 | 启用 / 停用 / 重新加载 / 卸载；小部件目录实时热插拔 |
| 故障隔离 | `ready()` 超时、页面崩溃、加载失败只影响该小部件；指数退避重启，60 秒内失败 5 次自动隔离并在界面标红 |
| 权限门控 | 白名单逐项校验，未声明一律拒绝；云端校验与运行时校验使用同一份名单 |
| 网络 | 双层开关：小部件声明 `network` **且**用户在界面勾选「允许联网」才放行，否则在网络层直接拦截，改动立即生效 |
| 消息总线 | 声明 `bus` 权限的小部件互相广播订阅，发送方不会收到自己的回声 |
| 全屏避让 | 检测到有程序占满整个显示器时暂时收起全部小部件，退出后恢复；不覆盖用户主动关闭的那些 |
| 状态角标 | 小部件可在管理界面留下实时状态标记 |
| 沙箱边界 | 沙箱渲染进程、`contextIsolation`、禁 Node、导航拦截、`window.open` 拒绝、清单与 zip 路径越界检查 |

## 自己写小部件

本地不需要装任何东西：

- 仓库页面按 `.` 键进入浏览器版 VS Code，改文件后直接提交
- 需要跑构建或预览时用 `Code → Codespaces → Create codespace`，依赖装在云端容器
- push 到 `main` 后 Actions 自动校验清单、打包小部件、编译宿主

接口规范见 [docs/WIDGET-API.md](docs/WIDGET-API.md)，开发流程见 [docs/GITHUB-WORKFLOW.md](docs/GITHUB-WORKFLOW.md)。

## 版本与发布

版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)，每次变更记在 [CHANGELOG.md](CHANGELOG.md)。**发版由版本号驱动**：把 `package.json` 里的 `version` 抬上去，并在 `CHANGELOG.md` 顶部补一段同版本号的说明，推送到 `main` 之后 CI 就会：

1. 校验小部件清单、构建出 `DeskFrame-win-x64.exe` 与 `.sha256` 校验文件
2. 为该版本号补打 `v<版本号>` 标签
3. 用 CHANGELOG 对应段落作为正文创建 Release，并标记为最新版本

`version` 没变的推送只构建和校验，不会重复发版，所以 Releases 页面留下的都是真实版本而不是构建流水。直接推 `v*` 标签同样会发布。

三者必须一致：`package.json` 的 `version`、`CHANGELOG.md` 的段落标题、生成的标签名。CHANGELOG 里找不到对应段落时构建会失败，不会发出一份没有说明的版本。

```bash
# 发新版本只需要：改 package.json 的 version + 在 CHANGELOG.md 顶部加一段
git add package.json CHANGELOG.md
git commit -m "release: v1.1.0"
git push origin main
```


## 目录

```
host/                          宿主本体
├─ main.js                     启动、托盘、管理窗口
├─ settings.js                 配置、状态、日志、内置小部件记账
├─ widget-registry.js          扫描、清单校验、隔离、热插拔、安装、广播
├─ widget-window.js            小部件窗口、网络分区策略、可见性
├─ bundle-widgets.js           内置小部件首次运行的落位
├─ fullscreen-watch.js         前台全屏检测
├─ bridge.js                   IPC 权限分发
├─ preload.js                  注入 window.deskframe
├─ manager.html                管理界面
scripts/                       清单校验与发布说明生成
docs/                          接口与流程文档
widgets/                       内置小部件源码与空白模板
.github/workflows/             云端构建与发布
.devcontainer/                 Codespaces 环境
```

## 隐私与安全边界

所有写入只发生在 `%AppData%\DeskFrame\` 与用户级开机自启开关，管理界面「恢复默认」可一键撤销。不修改系统文件、不 patch 系统进程、不做 DLL 注入与全局 API Hook、不提权、不遥测。`network` 权限默认关闭且须用户显式开启。不打包系统图标、系统字体或 macOS 图形素材。

全屏检测需要前台窗口的几何信息，做法是启动一个只读子进程调用公开的 Win32 接口，不向目标进程注入任何代码。平台不支持该检测时，管理界面会直接说明开关不生效，而不是留一个看起来能用其实无效的选项。

依赖均为 MIT 类许可，见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

## 许可

MIT，见 [LICENSE](LICENSE)。软件按现状提供，使用前请自行备份。
