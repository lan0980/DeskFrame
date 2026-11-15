# 小部件模板

这是**接口示例**，不是内置功能。宿主不提供任何固定小部件。

## 开工三步（都在 GitHub 网页上）

1. 在仓库页按 `.` 打开 github.dev
2. 把 `widgets/_template/` 复制成 `widgets/<你的id>/`，例如 `widgets/weather/`
3. 改 `widget.json` 里的 `id`（必须和文件夹名一致）、`name`、`version`，然后写 `index.html`

push 到 `main` 后，`.github/workflows/pack-widgets.yml` 会自动校验清单并打包成 `<id>.widget.zip` 放进 Releases。

## 目录约定

```
widgets/<id>/
├─ widget.json      # 必需：清单 / 配置模型 / 权限声明
├─ index.html       # 必需：入口（可拆出 css/js 文件）
├─ style.css        # 可选
├─ main.js          # 可选
└─ assets/          # 可选：只用宽松许可的自有素材
```

`entry` 必须指向本文件夹内的文件，不允许 `../` 越界。

## 硬性规则

- `id` 只能是 `[a-z0-9_-]`，且必须等于文件夹名
- `protocol` 必须为 `1`
- `version` 必须是 `x.y.z`
- 页面必须调用 `window.deskframe.ready()`，否则 10 秒后宿主按失败处理并隔离
- 权限未声明的 API 调用一律被拒绝并记日志
- 不要引用系统图标、系统字体或 macOS 素材；图标请用 Lucide / Tabler（MIT/ISC），字体用 Inter / Noto Sans SC（SIL OFL）

完整接口见 [docs/WIDGET-API.md](../../docs/WIDGET-API.md)。
