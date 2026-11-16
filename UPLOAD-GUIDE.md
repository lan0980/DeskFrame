# 仓库上传与云端构建准备

本项目的构建全部由 GitHub Actions 在云端完成，不需要本地工具链。用 GitHub 网页上传或新建仓库副本时，有两件事容易漏，漏掉的表现是 Actions 一次都没跑、Releases 为空。

## 一、隐藏目录必须进得去

Windows 资源管理器默认不显示以点开头的项，`Ctrl + A` 也就选不中它们，于是 `.github/` 被静默跳过，云端构建永远不会被触发。

1. 资源管理器 **查看 → 显示 → 隐藏的项目** 打勾
2. **进入项目文件夹内部**再 `Ctrl + A` 全选，把选中的内容拖到仓库主页的文件列表区
   —— 拖外层文件夹本身会让所有内容多套一层目录，GitHub 只认仓库根目录下的 `.github/workflows/`
3. 提交前核对这四项都在：

```
.github/workflows/build-host.yml
.github/workflows/pack-widgets.yml
.devcontainer/devcontainer.json
.gitignore
```

## 二、放开工作流写权限

`Settings → Actions → General → Workflow permissions` → **Read and write permissions** → **Save**。

不设这一步，工作流在发布 Release 时会返回 403。改动后对已在运行的任务无效，需要点 `Re-run jobs` 重跑。

## 提交之后会发生什么

| 位置 | 产出 |
|---|---|
| Actions | `Build host (portable)` 与 `Validate and pack widgets` 两条工作流，首次约 2–10 分钟 |
| 推送到 `main` | 构建并校验，**不创建 Release**，所以页面不会堆积一次性构建 |
| 推送 `v*` 标签 | 创建 `DeskFrame <标签名>` Release，附 `DeskFrame-win-x64.exe` 与 `.sha256` 校验文件，正文取自 `CHANGELOG.md` 对应版本段落 |

小部件已经打进宿主安装包，不再有单独的小部件 Release。`pack-widgets.yml` 仍会把每个 `widgets/<id>/` 压成 `<id>.widget.zip` 保留在该次运行的构建产物里，用于把某一个小部件单独发给别人。

任何时候都可以在工作流页面点 `Run workflow` 手动重跑，不必重新上传文件。

## 排查

| 现象 | 原因 |
|---|---|
| Actions 页没有任何运行记录 | `.github/workflows/` 不在仓库根目录，回到第一节 |
| 工作流失败并提示 403 | 工作流写权限未放开，回到第二节 |
| 运行列表里显示的是文件路径而不是工作流名 | YAML 没被解析成功（重复的键、缩进错位、混进 tab）。这类失败一个 job 都不会生成，看该次运行页面的报错 |
| 打了标签但没有 Release | 标签名不是 `v` 开头；标签推送本身不受 `paths` 过滤影响 |
| 标签构建失败并提示找不到版本段落 | `CHANGELOG.md` 没有与该标签对应的 `## <版本号>` 段落，或 `package.json` 的 `version` 与标签不一致 |
| 某个小部件没出现在产物里 | 清单校验不通过（`id` 与文件夹名不符、`protocol` 不为 1、权限名不在白名单、`version` 不是 `x.y.z`），看该次运行 `Validate widget manifests` 步骤的输出 |
| 其他人下载需要登录 | 仓库是私有的；`Settings` 最底部可转为 Public |


## 相关文档

接口规范 [docs/WIDGET-API.md](docs/WIDGET-API.md) · 开发流程 [docs/GITHUB-WORKFLOW.md](docs/GITHUB-WORKFLOW.md) · 使用与排错 [docs/LOADING.md](docs/LOADING.md)
