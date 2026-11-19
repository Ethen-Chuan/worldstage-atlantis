# 头部与手部网格来源

- 官方来源：Blender Human Base Meshes Bundle v1.4.1。
- 下载位置：`https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip`
- 使用内容：`Head (Animation) - Realistic` 集合中的头部、左右巩膜与虹膜；`Hand  - Realistic` 对象。
- 授权核验：该头部集合和手部对象的 Blender Asset Metadata 均明确记录 `CC0`。
- 处理方式：本地 bpy 5.3.0，关闭外部文件脚本执行；受控一级细分、截去肩颈下部、坐标转换、尺寸适配，导出纯顶点与三角形索引。运行时加入法线、肤色、眼部与动态修饰。
- `human-geometry.json` 仅含许可标签和数值几何，不含脚本、驱动器、原场景、贴图、个人元数据或用户参考照片。
- 包内另有提及 Rain Rig / CC BY 4.0 的遗留文本；本项目没有导出 Rain Rig，所选具体资产的授权以其明确的 CC0 元数据为核验依据。保留此说明避免将整包内所有内容笼统视为同一授权。

鸣谢 Blender Foundation 及 Human Base Meshes 资产作者。这里使用基础人体拓扑作风格化适配，并不声称完成了电影级人物雕刻、完整面部绑定或医学级人体复原。
