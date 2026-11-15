# widgets/

这里放**你自己写的小部件**，每个子文件夹一个。

- `_template/` 是接口示例，不参与打包（`pack-widgets.yml` 会跳过它），也不是内置功能
- 其余每个文件夹会在 push 到 `main` 时被云端校验并打成 `<id>.widget.zip`
- 文件夹名必须等于 `widget.json` 里的 `id`
- 最终用户把这个 zip 下载到本地，在管理界面点「安装 .widget.zip」即可加载

最小结构：

```
widgets/<id>/
├─ widget.json
└─ index.html
```

接口规范见 [docs/WIDGET-API.md](../docs/WIDGET-API.md)，编写与打包流程见 [docs/GITHUB-WORKFLOW.md](../docs/GITHUB-WORKFLOW.md)。
