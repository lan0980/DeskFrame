# Third-party notices

The host application bundles the following open-source packages. All are
permissively licensed; none is GPL/AGPL/LGPL.

| Package | Version | License | Use |
|---|---|---|---|
| Electron | ^33.2.0 | MIT | Windowing and rendering runtime |
| electron-builder | ^25.1.8 | MIT | Build-time packaging (not shipped) |
| adm-zip | ^0.5.16 | MIT | Extracting downloaded `.widget.zip` packages |

Full license texts are included in each package's own repository and inside
`node_modules/<package>/LICENSE` after `npm install` in the cloud build.

## Asset policy

- No Apple/macOS wallpapers, system icons, SF fonts or brand names are bundled.
- No icons extracted from Windows system DLLs are redistributed.
- Fonts and icons you add to your own widgets must carry a permissive license
  (for example Inter / Noto Sans SC under SIL OFL, Lucide / Tabler under MIT or ISC).
- Run `npm install` in the cloud build and regenerate this file if you add a dependency.
