# 上传修正卡 · 先看这一页

> 2026-11-16 实测结论：仓库里第一版文件**被放进了 `deskframe/` 子文件夹**，而且 `.github/`、`.devcontainer/`、`.gitignore` 这三个隐藏项没有上传成功。所以工作流一次都没跑过，Releases 现在是空的。代码本身没问题，只是位置不对。

## 只需要一次「全选 + 拖拽 + 提交」

1. 打开本机文件夹 `F:\cs\deskframe`
2. 在资源管理器点 **查看 → 显示 → 隐藏的项目**（把勾打开）
   —— 这一步最关键，不开就选不中 `.github`，云端构建永远不会触发
3. **进到文件夹里面**按 `Ctrl + A` 全选，把所有内容拖到 GitHub 仓库主页的文件列表区
   —— 不要拖外层那个 `deskframe` 文件夹本身
4. 在上传列表里确认下面这些都在，然后点 **Commit changes**

## 上传列表里必须能看到的 4 个隐藏项

- `.github/workflows/build-host.yml`
- `.github/workflows/pack-widgets.yml`
- `.devcontainer/devcontainer.json`
- `.gitignore`

其余正常的：`package.json`、`host/`、`widgets/`、`docs/`、`scripts/`、`README.md`、`LICENSE`、`UPLOAD-GUIDE.md` 等。

## 提交后再设置一次（只做这一次）

`Settings → Actions → General → Workflow permissions` → 选 **Read and write permissions** → **Save**

不勾这个，发布 Release 那一步会报 403。

## 之后自动发生

| 位置 | 会出现什么 |
|---|---|
| Actions | `Build host (portable)` 和 `Validate and pack widgets` 两个工作流（首次约 5–10 分钟） |
| Releases → `latest` | `DeskFrame-win-x64.zip`，解压双击 `DeskFrame.exe` 即可 |
| Releases → `widgets-latest` | 你自己写的小部件包 `<id>.widget.zip`（目前只有模板，暂时为空，正常） |

`build-host.yml` 里还带了一步**云端自动清理**：第一次构建时会把旧的 `deskframe/` 嵌套目录自动删掉，仓库自己变干净，你不用手动删。

## 卡住了看这里

| 现象 | 处理 |
|---|---|
| Actions 页一片空白 | 说明 `.github/workflows/` 没上传成功，重复上面第 2–4 步 |
| 工作流红了、提示 403 | 没设 Read and write permissions，设完点 `Re-run jobs` |
| 只有 `latest`，没有 `widgets-latest` | 正常，写了小部件包才会出 |
| 想让别人不用登录也能下载 | `Settings` 最底部把仓库转成 Public |

完整说明：[docs/START-HERE.md](docs/START-HERE.md)　·　接口文档：[docs/WIDGET-API.md](docs/WIDGET-API.md)
