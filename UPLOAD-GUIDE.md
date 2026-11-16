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
| Releases → `latest` | `DeskFrame-win-x64.exe`，双击即可运行的绿色单文件 |
| Releases → `widgets-latest` | 每个 `widgets/<id>/` 对应的 `<id>.widget.zip` |

两条工作流都是滚动发布：每次命中触发条件都会覆盖同名产物，不会产生一堆版本堆积。也可以在工作流页面点 `Run workflow` 手动重跑，不必重新上传文件。

## 排查

| 现象 | 原因 |
|---|---|
| Actions 页没有任何运行记录 | `.github/workflows/` 不在仓库根目录，回到第一节 |
| 工作流失败并提示 403 | 工作流写权限未放开，回到第二节 |
| 只有 `latest`，没有 `widgets-latest` | 命中了触发条件但改动不涉及 `widgets/`；只有小部件目录或校验脚本变化时才会重跑打包 |
| 某个小部件没出现在产物里 | 清单校验不通过（`id` 与文件夹名不符、`protocol` 不为 1、权限名不在白名单、`version` 不是 `x.y.z`），看该次运行 `Validate widget manifests` 步骤的输出 |
| 其他人下载需要登录 | 仓库是私有的；`Settings` 最底部可转为 Public |

## 相关文档

接口规范 [docs/WIDGET-API.md](docs/WIDGET-API.md) · 开发流程 [docs/GITHUB-WORKFLOW.md](docs/GITHUB-WORKFLOW.md) · 使用与排错 [docs/LOADING.md](docs/LOADING.md)
