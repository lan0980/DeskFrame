# 从这里开始 · 当前仓库状态与完整操作说明

这份文档对应 **2026-11-16 对 `lan0980/DeskFrame` 的实测检查结果**。后面每一步都是浏览器 / 资源管理器里的图形操作：**不装开发工具、不装运行时、不编译、不调试、不敲任何命令**。

---

## 一、现在仓库里到底是什么状态

| 检查项 | 结果 |
|---|---|
| 仓库 | `lan0980/DeskFrame`，默认分支 `main`，私有 |
| 最新提交 | `a2f9ea3` · `Add files via upload` |
| 根目录内容 | **只有一个 `deskframe/` 文件夹** |
| 该文件夹内 | `LICENSE`、`README.md`、`THIRD-PARTY-NOTICES.md`、`docs/`、`host/`、`package.json`、`scripts/`、`widgets/` |
| 缺失 | `.github/`、`.devcontainer/`、`.gitignore`（隐藏项未被选中） |
| Actions | 一次都没触发过（工作流文件不在仓库根目录） |
| Releases | 为空 |
| AI 侧写入 | `403 Resource not accessible by integration`：Contents API 与 Git Data API 都只读 |

**结论：代码是完整的，只是"位置"错了两处** —— ① 多套了一层 `deskframe/`；② 隐藏文件没进来。GitHub 只认**仓库根目录**下的 `.github/workflows/`，所以构建没有启动。

> 顺带说明：GitHub 网页用的是你自己的账号登录态，本来就拥有写权限；WorkBuddy 里的 GitHub 连接器是另一套授权，当前只有读权限，所以"我直接代写文件进仓库"暂时做不到。这不影响你自己上传、编辑、提交、下载。

---

## 二、修复：一次拖拽 + 一次设置

一页速查版见仓库根目录 [UPLOAD-GUIDE.md](../UPLOAD-GUIDE.md)，这里是展开版。

### 步骤 1 · 让隐藏文件可见

打开 `F:\cs\deskframe`，资源管理器点 **查看 → 显示 → 隐藏的项目**。
Windows 默认隐藏以 `.` 开头的文件/文件夹，`Ctrl+A` 不会选中它们 —— 这正是第一次漏掉 `.github` 的原因。

### 步骤 2 · 拖「里面的内容」

进入 `F:\cs\deskframe` 后按 `Ctrl+A` 全选，拖到 GitHub 仓库主页的文件列表区域。

- 拖 **里面全部内容**
- 不要拖 `deskframe` 这个外层文件夹本身（那样又会多套一层）

### 步骤 3 · 核对再提交

上传列表里逐项确认（尤其是四个隐藏项）：

```
.github/workflows/build-host.yml
.github/workflows/pack-widgets.yml
.devcontainer/devcontainer.json
.gitignore
package.json   host/   widgets/   docs/   scripts/
README.md   UPLOAD-GUIDE.md   LICENSE   THIRD-PARTY-NOTICES.md
```

确认无误点 **Commit changes**。

### 步骤 4 · 打开工作流写权限（只做一次）

`Settings → Actions → General → Workflow permissions` → **Read and write permissions** → **Save**。
不设置的话，往 Releases 发布成品那步会返回 403。

### 步骤 5 · 不用管那个旧目录

`build-host.yml` 第一步带了一个**云端自动清理**：检测到根目录仍有旧的 `deskframe/` 嵌套目录时，会在 runner 里删掉并推一个 `chore: remove stale nested upload folder` 提交。即使这一步因为权限没成功（`continue-on-error`），也**不影响构建**，旧目录只是冗余副本，不会被任何脚本扫描到。

---

## 三、修好之后，正确的目录结构

```
DeskFrame/                       ← 仓库根目录
├─ .github/workflows/
│  ├─ build-host.yml             云端编译绿色版宿主
│  └─ pack-widgets.yml           云端校验 + 打包小部件
├─ .devcontainer/devcontainer.json   Codespaces 云端开发环境
├─ .gitignore
├─ package.json
├─ host/                         宿主本体（窗口、注册表、配置、布局、隔离、管理界面）
├─ widgets/
│  └─ _template/                 空白模板，不是功能模块，打包时跳过
├─ docs/                         WIDGET-API / LOADING / GITHUB-WORKFLOW / START-HERE
├─ scripts/validate-widgets.js   清单校验，只在云端跑
├─ README.md  UPLOAD-GUIDE.md  LICENSE  THIRD-PARTY-NOTICES.md
```

---

## 四、提交后云端自动做什么

| 工作流 | 触发条件 | 产出 |
|---|---|---|
| `Build host (portable)` | `host/**`、`package.json` 或该工作流文件变动；也可手动 `Run workflow` | Windows runner 上 `npm install` → `electron-builder --win --dir` → 压缩 → 发布到滚动 Release **`latest`**，文件 `DeskFrame-win-x64.zip` |
| `Validate and pack widgets` | `widgets/**`、`scripts/validate-widgets.js` 或该工作流文件变动 | 校验所有 `widget.json` → 每个 `widgets/<id>/` 打成 `<id>.widget.zip` → 发布到滚动 Release **`widgets-latest`** |

首次上传会同时触发两个工作流。目前只有 `_template`，所以 `widgets-latest` 暂时不会出现，这是正常的 —— 写了自己的小部件就有。

也可以在任何工作流页面点 **Run workflow** 手动重跑，不用重新上传文件。

---

## 五、拿到成品（本地只做三件事）

1. **Releases → `latest`** 下载 `DeskFrame-win-x64.zip`，右键「全部提取」到任意文件夹
2. 双击 `DeskFrame.exe` —— 自带渲染引擎，不需要 .NET / Node / WebView2 / Python，不写系统目录
3. 在「小部件管理」窗口点「安装 .widget.zip」选包；或把含 `widget.json` 的文件夹放进 `%AppData%\DeskFrame\widgets\`，**丢进去就加载、拿走就卸载，不用重启**

未签名的 exe 首次运行可能弹 SmartScreen「Windows 已保护你的电脑」，点「更多信息 → 仍要运行」即可，属正常现象。
排错与数据位置见 [LOADING.md](LOADING.md)。

---

## 六、以后怎么在 GitHub 上写小部件（全程浏览器）

1. 仓库页面按 **`.`** → 打开浏览器版 VS Code（github.dev）；需要跑构建/预览就用 `Code → Codespaces → Create codespace`，依赖只装在云端容器
2. 把 `widgets/_template/` 复制成 `widgets/<你的id>/`
3. 改 `widget.json`：`id` 必须等于文件夹名、`protocol: 1`、`version` 用 `x.y.z`；按需声明 `permissions` 与 `configSchema`
4. 写 `index.html`（可拆 CSS/JS），**必须调用 `window.deskframe.ready()`**
5. `Source Control` 提交到 `main`
6. Actions 自动校验并打出 `<id>.widget.zip` → 从 `widgets-latest` 下载 → 管理界面点「安装」

接口、权限白名单、配置模型、生命周期的完整规范在 [WIDGET-API.md](WIDGET-API.md)；流程细节见 [GITHUB-WORKFLOW.md](GITHUB-WORKFLOW.md)。

---

## 七、常见问题

| 现象 | 原因 / 处理 |
|---|---|
| Actions 页没有运行记录 | `.github/workflows/` 没在根目录，重复第二节步骤 1–3 |
| 工作流报 403 | 没开 `Read and write permissions`，开完 `Re-run jobs` |
| 只有 `latest`、没有 `widgets-latest` | 只有模板、没有可打包的小部件，正常 |
| 小部件标红「已隔离」 | 60 秒内失败 5 次以上，或没调 `ready()`；改好后点「重载」 |
| 别人打不开下载链接 | 私有仓库的 Release 附件要登录 GitHub；`Settings` 底部转 Public |
| 想让 AI 直接把文件写进仓库 | 需要把 GitHub 连接器授权提升为含 Contents 写权限（重新授权时确认）；在此之前由我把文件写好后你拖一次即可 |

---

## 八、边界（做这个框架时一直守着的）

只写 `%AppData%\DeskFrame\` 与用户级开机自启开关，管理界面「恢复默认」一键撤销；不改系统文件、不注入 Explorer、不做 DLL 注入与全局 Hook、不提权、不遥测；`network` 权限默认关闭且需用户显式开启；不打包系统图标、系统字体或 macOS 素材。依赖只用 MIT 类许可，见 `THIRD-PARTY-NOTICES.md`。软件按现状提供，使用前自行备份。
