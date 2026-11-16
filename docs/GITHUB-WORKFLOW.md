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
| `Build host (portable)` | push 到 `main` 命中 `host/**`、`widgets/**`、`package.json`、`CHANGELOG.md`；或推 `v*` 标签 | Windows runner 校验小部件清单 → `npm install` → `npx electron-builder --win` 打出含内置小部件的单个 exe。**只有 `v*` 标签那次才会创建 Release** |
| `Validate and pack widgets` | push 到 `main` 命中 `widgets/**` 或校验脚本 | 校验全部清单，并把每个 `widgets/<id>/` 打成 `<id>.widget.zip` 留作构建产物（方便单独发给别人分享），不创建 Release |

向 `main` 的推送会构建但**不发版**，这样 Releases 页面留下的都是真实版本号，不会堆积一次性构建。

## 四、发一个版本

1. 改 `package.json` 的 `version`，并在 `CHANGELOG.md` 顶部加一段 `## <版本号>`，写清新增 / 修复 / 变更
2. 提交这两处改动，push 到 `main`
3. 打标签并推送：

```bash
git tag v1.1.0
git push origin v1.1.0
```

CI 会用 `scripts/release-notes.js` 从 CHANGELOG 抽出 `1.1.0` 那一段作为发布正文，把 `DeskFrame-win-x64.exe` 与同目录的 `.sha256` 校验文件挂到 Release 上，标题为 `DeskFrame v1.1.0`，并标记为最新版本。

**标签名必须与 `package.json` 版本、CHANGELOG 段落三者一致**：抽不到对应段落时构建会直接失败，不会发出一份没有说明的版本。标签推上去之后不要改写历史来改版本号，宁可废弃该 Release 重新发一个新版本号。

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
