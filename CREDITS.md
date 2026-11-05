# Credits

## 宇航员 / Astronaut pet

- 素材：Pixabay 用户 ManmathVhanrao 上传的绿幕视频 “AI generated, astronaut, green screen”
  https://pixabay.com/videos/ai-generated-astronaut-green-screen-222138/
- 许可：[Pixabay Content License](https://pixabay.com/service/license-summary/)（可免费商用、可修改、无需署名；不得原样单独再分发）
- 处理：`scripts/make_astro_sprites.py` 抠除绿幕、裁剪、缩放后打包成 `public/pets/astro/*.webp` 帧图集。
  原始视频不入库（`assets/source/` 已 gitignore），需要时从上面的链接下载 small 版本重新生成：

```bash
ffmpeg -i assets/source/astronaut-222138-small.mp4 -vf fps=12 FRAMES/%04d.png
python scripts/make_astro_sprites.py FRAMES public/pets/astro   # 需要 Pillow + numpy
```

像素飞猫和战士为本项目原创矢量形象。
