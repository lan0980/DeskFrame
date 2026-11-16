# widgets/

每个子文件夹是一个小部件，push 到 `main` 时由 `pack-widgets.yml` 逐个校验并打成 `<id>.widget.zip`。宿主本体不含小部件，这些包都是独立发布、按需安装的。

## 目录内容

| 文件夹 | 性质 |
|---|---|
| `_template/` | 空白模板，复制一份改 `id` 即可开工，**不参与打包** |
| `clock/` `sysmon/` `sticky/` `launcher/` `clipper/` `weather/` `pomodoro/` `bus-monitor/` | 示例成品，各自演示不同的接口能力 |

想加自己的小部件，就在这个目录下新建文件夹。示例代码是给你参考写法的，不满意可以直接删掉——删掉不会影响框架任何功能。

## 最小结构

```
widgets/<id>/
├─ widget.json      清单：身份、权限、窗口、配置模型
└─ index.html       入口页面
```

## 会被云端拒绝的几种情况

- 文件夹名与 `widget.json` 里的 `id` 不一致
- `protocol` 不是 `1`
- `version` 不是 `x.y.z` 三段式
- `id` 不符合 `^[a-z0-9][a-z0-9_-]{0,47}$`
- `entry` 指向的文件不存在，或用 `../` 越出了本目录
- `permissions` 里出现白名单之外的名字
- `configSchema` 某项缺 `default`，或 `enum` 没给 `options`
- `window.width` / `height` 超出 32–4096

本地想先自查一遍：`npm run validate:widgets`，跑的是同一套规则。

## 三条容易忽略的硬性要求

1. **必须调 `window.deskframe.ready()`**，否则宿主判定启动失败，60 秒内累计 5 次就隔离
2. **可拖动区域要写 `-webkit-app-region: drag`，按钮输入框要写 `no-drag`**，无边框窗口否则既拖不动也点不了
3. **权限按最小声明**，未声明的接口调用会被直接拒绝；联网还需要用户在管理界面另外勾选开关

完整接口与权限说明见 [docs/WIDGET-API.md](../docs/WIDGET-API.md)，开发流程见 [docs/GITHUB-WORKFLOW.md](../docs/GITHUB-WORKFLOW.md)。
