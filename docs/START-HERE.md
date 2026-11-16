# 项目导览

框架由三部分组成：宿主（`host/`）、小部件（`widgets/`）、云端构建（`.github/workflows/`）。三者通过一套清单协议解耦，改动任意一部分都不会牵动其他两部分的运行时。

## 宿主的启动链路

```
main.js
 ├─ app.requestSingleInstanceLock()     单实例，重复启动只唤起管理窗口
 ├─ Settings.ensure()                   建目录、读 settings.json、失败回退默认值
 ├─ WidgetRegistry(settings)            持有清单表、实例表、失败计数、隔离集
 ├─ Bridge(registry, settings)          注册两个 ipcMain.handle
 ├─ registry.start()                    扫描 → 校验 → 逐个 spawn → 开启目录监听
 ├─ createTray()                        托盘拿不到也不影响主流程
 └─ openManager()                       管理窗口
```

`app.on('window-all-closed')` 被显式留空：小部件也是窗口，关掉最后一个不能退出宿主。

## 一个小部件从落盘到运行

```
目录出现新文件夹
  → registry.scan()      readdir + 解析 widget.json
  → registry.validate()  protocol / id / version / entry 越界 / 权限名 / 尺寸 / configSchema
  → registry.spawn()     new WidgetWindow → create()
  → 独立 session 分区     persist:df-<id>，网络拦截按声明权限 + 全局开关决定
  → loadFile(entry)      entry 必须落在小部件目录内
  → did-finish-load      显示窗口，起 10 秒 ready 计时
  → 页面 host.ready()    桥接回 bridge.handleWidgetCall → markReady() → 广播 show
```

任何一步失败都走 `fail()`：销毁窗口、记一次失败、指数退避重启，60 秒内累计超过 5 次进入隔离，管理界面标红。整个过程只影响该小部件。

## 代码位置索引

| 关注点 | 位置 |
|---|---|
| 清单校验规则 | `host/widget-registry.js` 的 `validate()` |
| 窗口创建与网络拦截 | `host/widget-window.js` 的 `create()` |
| 每个 IPC 方法需要什么权限 | `host/bridge.js` 顶部的 `METHOD_PERMISSION` |
| 注入页面的 API 形状 | `host/preload.js` |
| 配置与状态的落盘格式 | `host/settings.js` |
| 消息总线扇出 | `host/widget-registry.js` 的 `broadcast()` |
| 前台全屏检测 | `host/fullscreen-watch.js` |
| 管理界面渲染 | `host/manager.html` |
| 云端校验（与运行时同一份白名单） | `scripts/validate-widgets.js` |

## 三处必须同步的地方

权限白名单同时存在于 `host/widget-registry.js`、`scripts/validate-widgets.js`，而权限到方法的映射在 `host/bridge.js`。三处不一致会出现很别扭的故障：清单过了云端却运行时被拒，或者反过来。改任何一处，另两处跟上。

`protocol` 与 `apiVersion` 是一对：清单里的 `protocol` 必须等于宿主常量，注入页面的 `apiVersion` 与之对应。新增方法是向后兼容的加法，可以留在协议 1；改变既有方法的语义或权限要求则是破坏性变更，要升协议号。

## 本地验证

仓库本身可以在本地独立运行，但发布链路不需要它——CI 会完成同样的检查。想在本地看效果：

```
npm install
npm run validate:widgets     等价于云端那道清单校验
npm start                    起 Electron，管理窗口和小部件都会出现
```

`npm start` 时建议加 `--user-data-dir` 指向临时目录，避免污染已经装好的正式版本数据。

## 边界

写入范围限定 `%AppData%\DeskFrame\` 与用户级开机自启开关，「恢复默认」整体撤销。不修改系统文件、不 patch 系统进程、不做 DLL 注入与全局 API Hook、不提权、不遥测。

全屏检测需要知道前台窗口的几何信息，做法是启动一个只读子进程查询公开 Win32 接口（`GetForegroundWindow` / `GetWindowRect` / `GetClassName`），不向目标进程注入任何代码；平台不支持或子进程起不来时，管理界面会直接说明该开关当前不生效，而不是留一个看起来能用其实无效的选项。
