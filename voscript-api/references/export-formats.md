# VoScript 导出格式

`GET /api/export/{tr_id}?format=srt|txt|json` 支持三种导出格式，
全部使用 **UTF-8** 编码。

## SRT（字幕）

标准 SubRip 字幕格式，直接可用于视频播放器、字幕编辑工具、YouTube 上传等。

- 每条字幕由四行组成：序号、时间轴、文本、空行。
- 时间戳格式：`HH:MM:SS,mmm`（逗号分隔毫秒）。
- 每条字幕正文格式为 `[speaker_name] text`。

示例：

```
1
00:00:00,000 --> 00:00:03,200
[张三] 大家好，今天我们来讨论产品路线图。

2
00:00:03,400 --> 00:00:06,800
[李四] 好的，我先汇报上周的进展。
```

适用场景：视频配字幕、剪辑软件导入、字幕翻译工作流。

## TXT（纯文本）

可读性优先的纯文本输出，保留起始时间戳、说话人归属与文本内容。

示例：

```
[00:00:00] 张三: 大家好，今天我们来讨论产品路线图。
[00:00:03] 李四: 好的，我先汇报上周的进展。
[00:00:06] 张三: 这部分的数据准备好了吗？
```

- 每行一个 segment，格式为 `[HH:MM:SS] 说话人: 文本`。
- 未识别说话人的片段前缀会是 `SPEAKER_XX`。

适用场景：会议纪要、快速分享、导入飞书 / Notion 编辑。

## JSON（结构化）

最完整的导出格式，包含 segment 级别的全部字段，便于二次开发。

结构大致形如：

```json
{
  "id": "tr_xxx",
  "filename": "meeting.mp3",
  "language": "zh",
  "unique_speakers": ["张三", "李四"],
  "params": {
    "language": "auto",
    "min_speakers": 0,
    "max_speakers": 0,
    "denoise_model": "none",
    "no_repeat_ngram_size": 0
  },
  "speaker_map": {
    "SPEAKER_00": { "matched_id": "<speaker_id_1>", "matched_name": "张三", "similarity": 0.83 },
    "SPEAKER_01": { "matched_id": "<speaker_id_2>", "matched_name": "李四", "similarity": 0.78 }
  },
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 3.2,
      "text": "大家好，今天我们来讨论产品路线图。",
      "speaker_label": "SPEAKER_00",
      "speaker_id": "<speaker_id_1>",
      "speaker_name": "张三",
      "similarity": 0.83,
      "words": [
        { "word": "大家", "start": 0.00, "end": 0.25, "score": 0.98 },
        { "word": "好", "start": 0.25, "end": 0.55, "score": 0.97 }
      ]
    }
  ]
}
```

字段说明：

- `speaker_map`：记录 diarization 阶段的匹配结果，键为原始 `speaker_label`，值为
  `{matched_id, matched_name, similarity}`；手动改 segment 归属时它不会被回写。
- `unique_speakers`：从 `segments[].speaker_name` 实时推导出的去重列表。
- `words`：**可选**，仅当服务端启用了词级对齐时存在；未对齐时该字段缺失。
- `similarity`：cohort < 10 时是 raw cosine；cohort ≥ 10 时是 AS-norm 分数，解释见 `voiceprint-guide.md`。
- `speaker_id` 可为 `null`，表示该 `speaker_label` 尚未绑定真实声纹。

适用场景：搭建检索/摘要下游、精确到词的剪辑、声纹管理 UI。

## 编码与换行

- 所有格式统一使用 **UTF-8**，不包含 BOM。
- 换行符默认 `\n`；在 Windows 使用 SRT 时，部分老式播放器偏好 `\r\n`，
  如需兼容，可在导出后用脚本转换。

## 选择建议

| 用途                               | 推荐格式 |
| ---------------------------------- | -------- |
| 视频字幕、YouTube 上传             | `srt`    |
| 会议纪要、快速复制粘贴             | `txt`    |
| 程序化处理、搭建下游检索 / 摘要     | `json`   |
