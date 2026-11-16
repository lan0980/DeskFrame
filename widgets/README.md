# widgets/

每个子文件夹是一个小部件。这里的成品会被打进宿主安装包：首次启动时自动落位到用户的小部件目录，不需要用户再单独下载、安装。

同时，push 到 `main` 时 `pack-widgets.yml` 会逐个校验清单并把每个 `widgets/<id>/` 打成 `<id>.widget.zip` 留在构建产物里，方便把单个小部件发给别人。

## 目录内容

| 文件夹 | 性质 |
|---|---|
| `_template/` | 空白模板，复制一份改 `id` 即可开工，**不打包、不内置** |
| `clock/` `sysmon/` `sticky/` `launcher/` `clipper/` `weather/` `pomodoro/` `bus-monitor/` | 内置成品，各自演示不同的接口能力 |

新增一个文件夹就等于给所有使用该宿主的人多装一个小部件，所以内置的清单宁少勿滥。想只给自己用，放在用户目录 `%AppData%\DeskFrame\widgets\` 即可，不必进仓库。

## 最小结构

```
widgets/<id>/
├─ widget.json      清单：身份、权限、窗口、配置模型
└─ index.html       入口页面
```

## 会被云端拒绍的几种情况

- 文件夹名与 `widget.json` 里的 `id` 不一致
- `protocol` 不是 `1`
- `version` 不是 `x.y.z` 三段式
- `id` 不符合 `^[a-z0-9][a-z0-9_-]{0,47}$`
- `entry` 指向的文件不存在，或用 `../` 越出了本目录
- `permissions` 里出现白名单之外的名字
- `configSchema` 某项缺 `default`，或 `enum` 没给 `options`
- `window.width` / `height` 超出 32–4096

本地先自查：`npm run validate:widgets`，跑的是同一套规则。

## 三条硬性要求

1. **必须调 `window.deskframe.ready()`**，否则宿主判定启动失败，60 秒内累计 5 次就隔离
2. **可拖动区域要写 `-webkit-app-region: drag`，按钮输入框要写 `no-drag`**，无边框窗口否则既拖不动也点不了
3. **权限按最小声明**，未声明的接口调用会被直接拒绍；联网还需要用户在管理界面另外勾选总开关

用户卸载了某个内置小部件之后不会被自动装回，这份记录写在 `settings.json` 的 `bundle.removed` 里；管理界面的「恢复默认」会把它们全部发还。

完整接口与权限说明见 [docs/WIDGET-API.md](../docs/WIDGET-API.md)，开发流程见 [docs/GITHUB-WORKFLOW.md](../docs/GITHUB-WORKFLOW.md)。
