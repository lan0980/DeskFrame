# 小部件接口（apiVersion 1）

宿主与小部件之间**只有一条通道**：沙箱页面里注入的 `window.deskframe`。小部件运行在 `sandbox: true` + `contextIsolation: true` + `nodeIntegration: false` 的独立渲染进程中，**没有 Node、没有 `require`、不能读写文件系统**。所有能力都通过 IPC 向宿主申请，宿主逐条校验权限。

接口按语义版本演进；`protocol: 1` 与 `apiVersion: 1` 绑定，宿主不会静默改变行为，升级协议时清单里的 `protocol` 必须同步改。

## 生命周期

```
放入目录 → 校验清单 → 创建独立窗口 → 加载 entry 页面
   → 页面调用 ready()（10 秒内） → 广播 show → 运行中
   → 配置变更广播 config / 总线消息广播 bus
   → 前台全屏时临时隐藏，退出后恢复
   → 停用 / 卸载 → 销毁窗口 → 注销槽位
```

未调用 `ready()`、页面崩溃、加载失败都会触发宿主的失败计数：指数退避重启，**60 秒内超过 5 次自动隔离**并在管理界面标红。隔离只影响该小部件，不影响宿主和别的小部件。

## 方法

| 方法 | 返回 | 需要的权限 | 说明 |
|---|---|---|---|
| `ready()` | `{ok,id}` | — | 必须调用，宣布初始化完成 |
| `getConfig()` | `object` | `config.read` | 读取该小部件自己的配置 |
| `setConfig(partial)` | `object` | `config.write` | 写入配置；只接受 `configSchema` 里声明且类型匹配的键，不匹配的键静默丢弃 |
| `getState()` | `object` | `config.read` | 窗口状态：`{enabled, size, opacity, clickThrough, alwaysOnTop, locked, badge}` |
| `on(event, fn)` | 取消函数 | — | 订阅宿主事件 |
| `off(event, fn)` | — | — | 取消订阅 |
| `emit(name, payload)` | `{name, delivered}` | `bus` | 向其他小部件广播；`delivered` 是实际收到的数量 |
| `log(level, msg)` | `true` | `log` | 写入 `%AppData%\DeskFrame\logs\`，`msg` 截断到 4000 字符 |
| `systemInfo()` | `object` | `system.info` | 平台、架构、CPU 数、内存、运行时长；不含任何个人数据 |
| `clipboardRead()` | `string` | `clipboard.read` | 读纯文本剪贴板 |
| `clipboardWrite(text)` | `true` | `clipboard.write` | 写纯文本剪贴板，截断到 100000 字符 |
| `openExternal(url)` | `true` | `open-external` | 仅允许 http/https，其他协议抛错，交给系统默认浏览器 |
| `resize(w, h)` | `{w,h}` | `widget.resize` | 调整自身窗口，限制 32–4096 |
| `setOpacity(v)` | `number` | `widget.resize` | 0.1–1，作用于整个窗口 |
| `setClickThrough(bool)` | `bool` | `widget.resize` | 鼠标穿透 |
| `setBadge(text)` | `true` | `badge` | 状态角标，最多 24 字符，显示在管理界面该小部件卡片上；传空字符串清除 |
| `close()` | `true` | — | 隐藏自身窗口并广播 `hide`；全屏避让结束不会把它重新显示出来 |

所有调用都是 Promise；单条消息上限 1 MB。未声明所需权限的调用直接抛错。

## 事件

| 事件 | 载荷 | 时机 |
|---|---|---|
| `show` | `{id}` | `ready()` 完成 |
| `hide` | `{id}` | 调用 `close()` |
| `config` | `object` | 管理界面或 `setConfig` 改了配置 |
| `bus` | `{name, payload, from}` | 其他小部件 `emit()`；`from` 是发送方 id |

总线是单向排除自身的：发送方收不到自己发出的消息，所以不需要自己做环回去重。只有声明了 `bus` 权限、且当前已 `ready()` 的小部件才会收到。回调里的异常由预加载层逐个捕获，不会波及其它小部件。

## 清单 `widget.json`

| 字段 | 必需 | 说明 |
|---|---|---|
| `protocol` | 是 | 固定 `1` |
| `id` | 是 | `[a-z0-9][a-z0-9_-]{0,47}`，**必须等于文件夹名** |
| `name` / `version` | 是 | `version` 为 `x.y.z` |
| `author` / `description` | 否 | 展示用 |
| `entry` | 是 | 本文件夹内的 HTML 路径，禁止 `../` |
| `permissions` | 否 | 权限白名单数组，未声明一律拒绝 |
| `window` | 否 | `width` `height`（32–4096）、`transparent` `frame` `alwaysOnTop` `clickThrough` `resizable` |
| `configSchema` | 否 | 配置模型，宿主据此自动生成管理界面表单 |

`configSchema` 每项：`{ type, default, label, options? }`，`type` 为 `boolean | string | number | enum | color`；`enum` 必须给 `options` 数组；所有项必须有 `default`。

## 权限白名单

`config.read` · `config.write` · `system.time` · `system.info` · `clipboard.read` · `clipboard.write` · `open-external` · `widget.resize` · `log` · `network` · `bus` · `badge`

云端 `scripts/validate-widgets.js` 与运行时 `host/widget-registry.js` 使用同一份白名单，改动必须两处同步。

**网络默认关闭**：即使声明了 `network`，也必须在管理界面勾选「允许小部件联网」才放行 http/https；否则宿主在网络层直接拦截，`fetch` 表现为网络错误。未开启时小部件只能加载自己文件夹内的 `file://` 资源与 `data:` / `blob:`。

**`system.time`** 在协议 1 中没有对应的接口——时间直接用页面里的 `Date` 即可。保留这个名字是为了白名单向前兼容，声明它不会获得任何额外能力，也不会被拒绝。

## 持久化

沙箱内没有文件系统 API，唯一可用的持久化手段是 `localStorage`。宿主为每个小部件分配独立的持久会话分区（`persist:df-<id>`），所以：

- `localStorage` 的内容重启后仍在，且与其他小部件完全隔离
- 该分区同时也是网络拦截的作用域， Cookies 与缓存不会跨小部件泄漏
- 管理界面「卸载」会删除小部件目录，但 `localStorage` 归属宿主数据目录，需要「恢复默认」才会整体重置

`configSchema` 适合存放外观与行为参数（管理界面可改），用户产生的内容（笔记正文、自定义列表）更适合放 `localStorage`。

## 窗口拖动

小部件窗口是无边框的，**Electron 只会拖动声明了拖拽区域的部位**。不加这一条，窗口就固定在初始位置，管理界面里「记住位置」也无从发生：

```css
.card { -webkit-app-region: drag; }
button, input, textarea, select, a { -webkit-app-region: no-drag; }
```

漏掉 `no-drag` 会让按钮点不动、输入框打不了字——可拖拽区域会吞掉鼠标事件。

位置与尺寸由宿主自动记忆；管理界面勾选「锁定位置」后，只记尺寸不记位置。

## 最小实现

```html
<!DOCTYPE html><html><body><div id="v">…</div>
<script>
  const d = window.deskframe;
  d.ready()
    .then(() => d.getConfig())
    .then((cfg) => {
      document.getElementById('v').textContent = cfg.title || 'hello';
      d.on('config', (next) => { document.getElementById('v').textContent = next.title || 'hello'; });
    });
</script></body></html>
```

对应清单至少要有 `permissions: ["config.read"]`，并在 `configSchema` 里声明 `title`。

## 明确禁止

小部件不得注入其它进程、不得安装全局钩子、不得读取小部件目录之外的文件、不得调用系统命令。宿主不提供这类能力，接口层直接不存在这些调用路径，清单校验也会拒绝越界的 `entry` 与 zip 内部路径。
