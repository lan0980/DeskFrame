# 在 GitHub 侧完成编写、打包与发布

本地不需要安装任何工具。开发动作全部发生在浏览器里，本地唯一要做的事是下载成品并双击运行。

## 一、在哪里写

| 入口 | 怎么用 | 适合 |
|---|---|---|
| **github.dev** | 打开仓库页面，按键盘 `.` | 改 `widget.json`、写 HTML/CSS/JS、改文档 |
| **Codespaces** | `Code → Codespaces → Create codespace` | 需要 `npm install`、`npm start` 预览或调试宿主；依赖装在云端容器，配置见 `.devcontainer/devcontainer.json` |
| **网页上传** | `Add file → Upload files` | 把本地写好的整个文件夹拖进来；注意隐藏目录，见 [UPLOAD-GUIDE.md](../UPLOAD-GUIDE.md) |

github.dev 里改完在 `Source Control` 面板提交，就是一个 commit。

## 二、写一个小部件

1. 把 `widgets/_template/` 复制成 `widgets/<你的id>/`
2. 改 `widget.json`：`id` 必须等于文件夹名，`protocol: 1`，`version` 用 `x.y.z`
3. 写 `index.html`（可拆 CSS/JS），**必须调用 `window.deskframe.ready()`**
4. 卡片容器加 `-webkit-app-region: drag`，按钮输入框加 `no-drag`——无边框窗口没有拖拽区域就固定死在初始位置
5. 按 [WIDGET-API.md](WIDGET-API.md) 声明 `permissions` 与 `configSchema`，只声明真正用到的
6. 提交到 `main`

想持久保存用户产生的内容用 `localStorage`，宿主给每个小部件分配了独立持久会话分区；沙箱内没有文件系统 API。

**放文件到 `widgets/` 目录就意味着发给所有用户**：这里的每个文件夹都会被构建进宿主安装包、在别人的首次启动时自动出现。只给自己用的，放到 `%AppData%\DeskFrame\widgets\` 就好，不用进仓库。

## 三、云端自动做什么

| 工作流 | 触发 | 做什么 |
|---|---|---|
| `Build host (portable)` | push 到 `main` 命中 `host/**`、`widgets/**`、`package.json`、`CHANGELOG.md`；或推 `v*` 标签 | Windows runner 校验小部件清单 → `npm install` → `npx electron-builder --win` 打出含内置小部件的单个 exe。若 `package.json` 的 `version` 还没有对应标签，就补打 `v<版本号>` 并创建 Release；已有标签则只构建不发版 |
| `Validate and pack widgets` | push 到 `main` 命中 `widgets/**` 或校验脚本 | 校验全部清单，并把每个 `widgets/<id>/` 打成 `<id>.widget.zip` 留作构建产物（方便单独发给别人分享），不创建 Release |

版本号没变的推送会构建、但不产生 Release 条目，所以发布页面不会堆积一次性构建。

## 四、发一个版本

1. 改 `package.json` 的 `version`，例如 `1.1.0`
2. 在 `CHANGELOG.md` 顶部加一段 `## v1.1.0 · 日期`，写清新增 / 修复 / 变更
3. 提交这两处改动并 push 到 `main`

CI 构建成功后会自动：为该版本补打 `v1.1.0` 标签 → 用 `scripts/release-notes.js` 从 CHANGELOG 抽出这一段作为发布正文 → 把 `DeskFrame-win-x64.exe` 与 `.sha256` 挂上 Release，标题 `DeskFrame v1.1.0`，标记为最新版本。

也可以直接推标签来发布同一版本：

```bash
git tag v1.1.0 && git push origin v1.1.0
```

**三处必须一致**：`package.json` 的 `version`、CHANGELOG 段落标题、标签名。抽不到对应段落时构建会失败，不会发出一份没有说明的版本。GitHub 不会因为 CI 自己创建的标签而重复跑一次构建，所以不存在循环发布。

已经发布过的版本号不要改写历史去改内容：宁可发一个新版本号，或者在 Releases 页面废弃那份 Release。


## 五、交付给别人

对方只需要：打开 Releases → 下载 `DeskFrame-win-x64.exe` → 双击。小部件已经在里面了，不需要额外安装步骤。详见 [LOADING.md](LOADING.md)。

仓库是私有的话，Release 附件也必须登录才能下载；要让别人直接下载需在 `Settings` 底部转为 Public。

## 六、作为模板仓库

`Settings → Template repository` 勾选后，别人可以用 `Use this template` 复制整套框架，在自己的 GitHub 上按上面的流程写小部件。别人 fork 后 `widgets/` 里的内置成品也会一并带走并按需自动安装，不想保留就删掉对应文件夹。

转为 Public 或设为模板之前，检查提交历史里不要留下本机绝对路径或凭据。

## 七、许可与素材

- 依赖只用 MIT 类许可，见 `THIRD-PARTY-NOTICES.md`，不要引入 GPL/AGPL/LGPL
- 字体用 Inter / Noto Sans SC（SIL OFL），图标用 Lucide / Tabler（MIT/ISC）
- 不打包系统图标、系统字体、macOS 壁纸与品牌素材
- 新增依赖后在云端重跑一次并更新 `THIRD-PARTY-NOTICES.md`
