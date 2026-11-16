# DeskFrame · 桌面美化框架

![Build Host](https://github.com/lan0980/DeskFrame/actions/workflows/build-host.yml/badge.svg)
![Pack Widgets](https://github.com/lan0980/DeskFrame/actions/workflows/pack-widgets.yml/badge.svg)
![License](https://img.shields.io/github/license/lan0980/DeskFrame)

Windows 桌面美化框架。宿主只实现底层机制——小部件的加载、渲染、布局、配置、启停、卸载与错误隔离；桌面上出现什么、如何交互，完全由小部件决定。

发布物是一个绿色单文件 exe，构建与打包全部在 GitHub Actions 云端完成，本地不需要任何开发环境。

## 快速开始

1. 从 [Releases](../../releases) 下载 `DeskFrame-win-x64.exe`，放到任意文件夹
2. 双击运行。自带渲染引擎，不依赖 .NET / Node / WebView2 / Python；首次启动会自解压到系统临时目录
3. 装上小部件：管理窗口点「安装 .widget.zip」，或把小部件文件夹放进 `%AppData%\DeskFrame\widgets\`——放进去就加载，拿走就卸载，不需要重启

未签名的 exe 首次运行可能触发 SmartScreen，点「更多信息 → 仍要运行」即可。

## 宿主提供的能力

| 机制 | 实现 |
|---|---|
| 窗口 | 每个小部件一个独立无边框透明窗口，可置顶、可点击穿透、可调不透明度、可锁定位置 |
| 布局 | 位置与尺寸自动记忆；锁定时只记尺寸不记位置 |
| 配置 | 小部件声明 `configSchema`，管理界面据此自动生成表单，无需宿主硬编码 |
| 生命周期 | 启用 / 停用 / 重载 / 卸载；目录变动实时热插拔 |
| 故障隔离 | `ready()` 超时、页面崩溃、加载失败均只影响该小部件；指数退避重启，60 秒内失败 5 次自动隔离并标红 |
| 权限门控 | 白名单逐项校验，未声明一律拒绝；清单校验与运行时校验使用同一套白名单 |
| 网络 | 双层开关：小部件声明 `network` **且**用户在管理界面勾选「允许联网」才放行，否则在网络层直接拦截 |
| 消息总线 | 声明 `bus` 权限的小部件可互相广播与订阅，发送方不会收到自己的回声 |
| 全屏避让 | Windows 下检测前台窗口是否铺满显示器，是则临时隐藏全部小部件，退出后恢复；不覆盖用户主动关闭的那些 |
| 状态角标 | 小部件通过 `setBadge()` 在管理界面留下可读状态标记 |
| 安全边界 | 沙箱渲染进程、`contextIsolation`、禁 Node、导航拦截、`window.open` 拒绝、清单与 zip 路径越界检查 |

## 示例小部件

`widgets/` 下的这些是完整可用的成品，云端会各自打包成 `<id>.widget.zip` 发布到 `widgets-latest`。宿主本体不含任何小部件，按需取用即可。

| 小部件 | 用到的接口 |
|---|---|
| `clock` | 配置读写、窗口尺寸切换 |
| `sysmon` | `system.info` |
| `sticky` | `localStorage` 持久化 |
| `launcher` | `open-external` |
| `clipper` | `clipboard.read` / `clipboard.write` |
| `weather` | `network`（演示联网门控与失败降级） |
| `pomodoro` | `bus` 广播 + `badge` 角标 |
| `bus-monitor` | `bus` 订阅，可直接观察消息流 |

`widgets/_template/` 是空白模板，复制一份改掉 `id` 就能开工，它不参与打包。

## 在 GitHub 上编写小部件

本地不装任何东西：

- 仓库页面按 `.` 键进入浏览器版 VS Code，改文件后直接提交
- 需要跑构建或预览时用 `Code → Codespaces → Create codespace`，依赖装在云端容器
- push 到 `main` 后 Actions 自动校验清单、打包每个 `widgets/<id>/`、编译宿主并发布到 Releases

详细流程见 [docs/GITHUB-WORKFLOW.md](docs/GITHUB-WORKFLOW.md)，接口规范见 [docs/WIDGET-API.md](docs/WIDGET-API.md)。

## 目录

```
host/                          宿主本体
├─ main.js                     启动、托盘、管理窗口
├─ settings.js                 配置读写、状态、日志
├─ widget-registry.js          扫描、清单校验、隔离、热插拔、安装、广播
├─ widget-window.js            小部件窗口、网络分区策略、可见性
├─ bridge.js                   IPC 权限分发
├─ fullscreen-watch.js         前台全屏检测
├─ preload.js                  注入 window.deskframe
├─ manager.html                管理界面
scripts/validate-widgets.js    云端清单校验
docs/                          接口与流程文档
widgets/                       示例小部件与模板
.github/workflows/             云端构建与打包
.devcontainer/                 Codespaces 环境
```

## 合规边界

所有写入只发生在 `%AppData%\DeskFrame\` 与用户级开机自启开关，管理界面「恢复默认」可一键撤销。不修改系统文件、不 patch 系统进程、不做 DLL 注入与全局 API Hook、不提权、不遥测。`network` 权限默认关闭且须用户显式开启。不打包系统图标、系统字体或 macOS 图形素材。

全屏检测读取的是公共窗口几何信息（前台窗口句柄与矩形），通过一个只读的子进程完成，不注入目标进程。

依赖均为 MIT 类许可，见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

## 许可

MIT，见 [LICENSE](LICENSE)。
软件按现状提供，使用前请自行备份。
