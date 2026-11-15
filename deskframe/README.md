# DeskFrame · 桌面美化框架

一个只提供**底层逻辑框架与扩展机制**的 Windows 桌面美化宿主。本体不内置任何固定小部件，只负责小部件的**加载、渲染、布局、配置读取、启停、卸载与错误隔离**；桌面长什么样、怎么交互，全部由你自己编写的小部件决定。

## 它是什么 / 不是什么

| | |
|---|---|
| 是 | 一个绿色版 Windows 桌面宿主 + 一套稳定、版本化的小部件接口 |
| 是 | 一个可直接在 GitHub 网页里编写、由 Actions 云端打包发布的项目 |
| 不是 | 不需要安装、不需要本地编译、不需要任何命令行操作 |
| 不是 | 不内置成品小部件（`widgets/_template` 只是接口示例，不是功能模块） |
| 不是 | 不改系统文件、不注入 Explorer、不做全局 Hook、不提权、不遥测 |

## 拿到成品后要做的三件事（全是图形操作）

1. 从 **Releases** 下载 `DeskFrame-win-x64.zip`，用资源管理器右键解压
2. 双击 `DeskFrame.exe`（自带渲染引擎，不需要 .NET / Node / WebView2 / Python）
3. 在管理界面点「安装 .widget.zip」选中你下载的小部件包；或把小部件文件夹直接放进 `%AppData%\DeskFrame\widgets\`，宿主会自动发现并加载

详见 [docs/LOADING.md](docs/LOADING.md)。

## 在 GitHub 上写小部件（本地不装任何东西）

- 仓库页面按 `.` 键 → 浏览器版 VS Code（github.dev），直接改文件、提交
- 需要运行构建或预览 → `Code → Codespaces → Create codespace`（依赖只装在云端容器）
- push 到 `main` 后，Actions 自动校验清单、把每个 `widgets/<id>/` 打包成 `<id>.widget.zip`、云端编译绿色版宿主并发布到 Releases
- 全流程见 [docs/GITHUB-WORKFLOW.md](docs/GITHUB-WORKFLOW.md)

## 目录

| 路径 | 作用 |
|---|---|
| `host/` | 宿主本体：窗口、注册表、消息总线、布局、配置、错误隔离、管理界面 |
| `widgets/_template/` | 空白小部件模板，复制一份改 `id` 即可开工 |
| `docs/WIDGET-API.md` | 小部件接口、权限白名单、配置模型、生命周期 |
| `docs/LOADING.md` | 下载成品后的加载流程与排错 |
| `docs/GITHUB-WORKFLOW.md` | GitHub 侧编写、完善、打包、发布流程 |
| `.github/workflows/` | 云端编译宿主与打包小部件 |
| `.devcontainer/` | Codespaces 云端开发环境 |
| `scripts/validate-widgets.js` | 清单校验（只在云端运行） |

## 合规边界

所有改动只落在 `%AppData%\DeskFrame\` 与用户级开机自启开关，且可在管理界面「恢复默认」一键撤销；不碰系统文件、不 patch 系统进程、不做 DLL 注入与全局 API Hook；默认不联网、不遥测，`network` 权限默认关闭且须用户显式开启；不打包任何系统图标、系统字体或 macOS 图形素材。未签名二进制可能触发 SmartScreen 提示，属正常现象。

## 许可

MIT，见 [LICENSE](LICENSE)；依赖许可见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。软件按现状提供，使用前请自行备份。
