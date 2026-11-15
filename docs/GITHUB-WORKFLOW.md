# 在 GitHub 侧完成编写、完善、打包与交付

本项目**不需要在本地安装任何工具**。本地唯一要做的事是下载成品并双击运行；所有开发动作都发生在浏览器里。

> 说明：你在 GitHub 网页上用自己的账号登录，本身就拥有仓库的写权限。这一点与 WorkBuddy 里的 GitHub 连接器授权是两回事——连接器只用于让 AI 代为读写，网页编辑与提交不受它影响。

## 一、在哪里写

| 入口 | 怎么用 | 适合 |
|---|---|---|
| **github.dev** | 打开仓库页面，按键盘 `.` | 改 `widget.json`、写 HTML/CSS/JS、改文档，最快 |
| **Codespaces** | `Code → Codespaces → Create codespace` | 需要运行 `npm install`、预览、调试宿主时；依赖只装在云端容器，配置见 `.devcontainer/devcontainer.json` |
| **网页新建/上传文件** | 仓库页 `Add file → Create new file` 或 `Add file → Upload files` | 上传本地写好的整个文件夹，纯拖拽 |

github.dev 里改完直接 `Source Control → 提交`，就是一个 commit。

## 二、写一个小部件

1. 在 github.dev 里把 `widgets/_template/` 复制成 `widgets/<你的id>/`
2. 改 `widget.json`：`id` 必须等于文件夹名，`protocol: 1`，`version: x.y.z`
3. 写 `index.html`（可拆 css/js），**必须调用 `window.deskframe.ready()`**
4. 按 `docs/WIDGET-API.md` 声明 `permissions` 和 `configSchema`
5. 提交到 `main`

## 三、云端自动做什么

push 到 `main` 会触发两个工作流（`.github/workflows/`）：

| 工作流 | 触发 | 产出 |
|---|---|---|
| `pack-widgets.yml` | `widgets/**` 变动 | `node scripts/validate-widgets.js` 校验所有清单（协议、id、路径越界、权限、尺寸、配置模型）→ 每个文件夹打成 `<id>.widget.zip` → 上传为 artifact；打 `widgets-v*` tag 时附到 Release |
| `build-host.yml` | `host/**` 或 `package.json` 变动 | 云端 `npm install` + `electron-builder --win --dir` → 压缩成 `DeskFrame-win-x64.zip` → 发布到滚动 Release `latest` |

也可以在任何工作流页面点 **Run workflow** 手动触发。所有依赖安装、编译、压缩都发生在 GitHub 的 Windows runner 上。

想给某个版本打个固定发布点：在仓库页 `Releases → Draft a new release`，tag 填 `host-v0.1.0` 或 `widgets-v0.1.0`，工作流会把对应产物附上。

## 四、交付给别人

对方只需要：打开 Releases → 下载 `DeskFrame-win-x64.zip` 和需要的 `<id>.widget.zip` → 解压 → 双击 → 在管理界面点「安装」。**不需要 GitHub 账号以外的任何东西**，详见 `docs/LOADING.md`。

## 五、作为模板仓库

`Settings → Template repository` 勾上，别人就能用 `Use this template` 一键复制整套框架，然后在自己的 GitHub 上按上面流程写小部件。转 public 之前请检查 git 历史里没有私人路径或 token。

## 六、许可与素材

- 依赖只用 MIT（见 `THIRD-PARTY-NOTICES.md`），不要引入 GPL/AGPL 依赖
- 字体用 Inter / Noto Sans SC（SIL OFL），图标用 Lucide / Tabler（MIT/ISC）
- 不打包系统图标、系统字体、macOS 壁纸与品牌素材
