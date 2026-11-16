# 在 GitHub 侧完成编写、打包与发布

本地不需要安装任何工具。开发动作全部发生在浏览器里，本地唯一要做的事是下载成品并双击运行。

## 一、在哪里写

| 入口 | 怎么用 | 适合 |
|---|---|---|
| **github.dev** | 打开仓库页面，按键盘 `.` | 改 `widget.json`、写 HTML/CSS/JS、改文档 |
| **Codespaces** | `Code → Codespaces → Create codespace` | 需要 `npm install`、`npm start` 预览或调试宿主；依赖装在云端容器，配置见 `.devcontainer/devcontainer.json` |
| **网页上传** | `Add file → Upload files` | 把本地写好的整个文件夹拖进来；注意隐藏目录，见 [UPLOAD-GUIDE.md](../UPLOAD-GUIDE.md) |

github.dev 里改完在 `Source Control` 面板提交，就是一个 commit。网页登录状态下你本身就是仓库协作者，编辑与提交权限来自仓库权限，与任何第三方集成无关。

## 二、写一个小部件

1. 把 `widgets/_template/` 复制成 `widgets/<你的id>/`
2. 改 `widget.json`：`id` 必须等于文件夹名，`protocol: 1`，`version` 用 `x.y.z`
3. 写 `index.html`（可拆 CSS/JS），**必须调用 `window.deskframe.ready()`**
4. 卡片容器加 `-webkit-app-region: drag`，按钮输入框加 `no-drag`——无边框窗口没有拖拽区域就固定死在初始位置
5. 按 [WIDGET-API.md](WIDGET-API.md) 声明 `permissions` 与 `configSchema`，只声明真正用到的
6. 提交到 `main`

需要持久保存用户产生的内容用 `localStorage`，宿主给每个小部件分配了独立持久会话分区；沙箱内没有文件系统 API。

## 三、云端自动做什么

push 到 `main` 会按路径命中触发两条工作流（`.github/workflows/`），也可以在工作流页面点 `Run workflow` 手动重跑：

| 工作流 | 触发路径 | 产出 |
|---|---|---|
| `Validate and pack widgets` | `widgets/**`、`scripts/validate-widgets.js`、该工作流文件 | 校验全部清单 → 每个 `widgets/<id>/` 打成 `<id>.widget.zip` → 发布到滚动 Release `widgets-latest`，同时留一份构建产物 |
| `Build host (portable)` | `host/**`、`package.json`、该工作流文件 | Windows runner 上 `npm install` + `electron-builder --win` → 产出单个 `DeskFrame-win-x64.exe` → 发布到滚动 Release `latest` |

宿主打包只收 `host/**` 与 `package.json`，`widgets/` 不会被打进 exe——框架本体始终不含任何小部件。

两条都是滚动发布，同名产物每次覆盖，不会堆积版本。`widgets-latest` 只在存在可打包的小部件时发布，光有 `_template` 不会出现，这是正常的。

要给某个版本打固定发布点：`Releases → Draft a new release`，tag 填 `host-v0.1.0` 或 `widgets-v0.1.0`，再手动跑一次对应工作流即可。

## 四、交付给别人

对方只需要：打开 Releases → 下载 `DeskFrame-win-x64.exe` 和需要的 `<id>.widget.zip` → 双击 exe → 管理界面点「安装 .widget.zip」。不需要 GitHub 账号以外的任何东西，详见 [LOADING.md](LOADING.md)。

仓库是私有的话，Release 附件也必须登录才能下载；要让别人直接下载需在 `Settings` 底部转为 Public。

## 五、作为模板仓库

`Settings → Template repository` 勾选后，别人可以用 `Use this template` 复制整套框架，在自己的 GitHub 上按上面的流程写小部件。转为 Public 或模板之前，检查提交历史里不要留下本机绝对路径或凭据。

## 六、许可与素材

- 依赖只用 MIT 类许可，见 `THIRD-PARTY-NOTICES.md`，不要引入 GPL/AGPL/LGPL
- 字体用 Inter / Noto Sans SC（SIL OFL），图标用 Lucide / Tabler（MIT/ISC）
- 不打包系统图标、系统字体、macOS 壁纸与品牌素材
- 新增依赖后在云端重跑一次并更新 `THIRD-PARTY-NOTICES.md`
