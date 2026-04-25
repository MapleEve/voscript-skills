# VoScript 声纹与 AS-norm 指南

本文档说明 VoScript 声纹识别的工作流、AS-norm 评分含义、阈值机制，以及
sample_spread 如何解读。

## 推荐工作流

声纹库需要真人名字标注才有意义，推荐按以下四步建立：

1. **先转写**：用 `submit_audio.py` 上传音频，等待任务完成。
2. **审阅分离结果**：`fetch_result.py` 取回 segments，人工判断
   `SPEAKER_00` / `SPEAKER_01` 等标签对应现实中的哪个人。
3. **注册声纹**：对每个标签调用 `enroll_voiceprint.py`，传入真实 `speaker_name`。
4. **重新转写 / 后续音频**：后续新音频会在 `identifying` 阶段自动匹配
   已注册声纹，`segments[*].speaker_name` 将直接给出真人名字而非 `SPEAKER_xx`。

> 若第一次转写的分离结果本身有误（例如两个人被合并成一个 SPEAKER），
> 可先用 `assign_speaker.py` 手动纠正 segment 的归属，再注册声纹。

## similarity 分数解释

`segments[*].similarity` / `speaker_map[*].similarity` 的语义取决于当前 cohort 状态，
并不总是同一种分数：

- **cohort = 0（全新安装）**：raw cosine，相似度阈值走基础 0.75 + 自适应放松。
- **cohort = 1~9**：仍为 raw cosine；`ASNormScorer.score()` 直接 fallback。
- **cohort ≥ 10**：切换为 **AS-norm z-score**，典型操作点约 `0.5`。

因此：

- raw cosine 通常落在 `[-1, 1]`；
- AS-norm z-score 没有固定上下界，可大于 `1` 或为负数；
- **不要**把任何一种 `similarity` 都当作百分比或概率。

## 自适应阈值

服务端匹配阈值并非固定 0.5，而是会根据被比对声纹的样本稳定性自适应：

- **基准阈值**：`0.75`
- **样本稀少 / 离散度大**：阈值会**放宽**（降低至接近 0.5），以避免单样本
  或噪声样本永远匹配不上。
- **样本丰富且紧凑**：阈值保持在基准附近，减少误识别。

因此同一个 `similarity=0.6` 针对不同声纹可能一个匹配、另一个不匹配，
这是自适应机制的正常行为。

## Cohort 生命周期与使用建议

AS-norm 的效果依赖一个代表性 cohort（对比样本集），但在 0.7.1+ / 0.7.3 中它已经变成
**持久化 + direct-load + 后台自动 rebuild** 的生命周期：

- **启动时**：若磁盘上已有 `asnorm_cohort.npy`，服务会直接加载；否则从历史转写构建一次。
- **运行中**：每次 enroll / update 都会标记 dirty；后台线程每 60 秒检查一次，
  且距最后一次 enroll 超过默认 30 秒后自动重建。
- **手动重建仍然有用**：适合批量导入历史转写后想立即生效，或需要查看
  `cohort_size / skipped / saved_to` 做排障。
- **10 个是激活门槛，不是手动 SOP**：少于 10 时分数仍回退为 raw cosine；
  达到 10 后下一次自动或手动重建才会启用真正的 AS-norm。
- **响应字段**：
  - `cohort_size`：最终纳入 cohort 的样本数量。
  - `skipped`：因样本数不足或质量太差被排除的声纹数量。
  - `saved_to`：cohort 持久化路径（用于服务端加载）。

重建不会改写历史转写结果；只影响后续新的识别评分。

## PyTorch 2.6 / pyannote checkpoint 加载

PyTorch 2.6 的 `torch.load` 默认 `weights_only=True`。pyannote checkpoint 需要
scoped safe globals 才能可信加载：

- `torch.torch_version.TorchVersion`
- `pyannote.audio.core.task.Problem`
- `pyannote.audio.core.task.Specifications`
- `pyannote.audio.core.task.Resolution`

实现要求：

- 只在 pyannote checkpoint 加载处用 scoped `safe_globals` 包住最小名单。
- 不要为了绕过错误改成 `weights_only=False`。
- 不要使用全局 `add_safe_globals` 污染整个进程。
- 不要加入未验证的额外类；新增类必须先确认来源和必要性。

## sample_spread 解释

`/api/voiceprints` 返回的每条声纹带有 `sample_spread` 字段：

- **定义**：该声纹所有样本两两余弦相似度的**标准差**。
- **单位**：无量纲；越小表示样本彼此越一致、声纹越「干净」。
- **`null`**：当 `sample_count == 1` 时，不存在两两对比，返回 `null`。

典型判断：

| sample_spread   | 含义                                                  |
| --------------- | ----------------------------------------------------- |
| `null`          | 单样本，尚未形成稳健声纹，建议多注册几段                |
| `< 0.05`        | 样本高度一致，声纹质量优秀                              |
| `0.05 ~ 0.15`   | 正常范围                                              |
| `> 0.15`        | 样本离散，可能混入了其他人的声音，建议复核片段归属       |

## 常见误区

- **把 similarity 展示成百分比** → 错误；它可能是 raw cosine，也可能是 AS-norm 分数。
- **单样本声纹就期望高准确率** → 样本越多越稳定，建议累计 3–5 段。
- **把“10+ 后手动 rebuild”当成唯一流程** → 0.7.1+ 已经支持后台自动重建；
  手动 rebuild 主要用于立即生效或排障，不再是每次 enroll 后的必选动作。
- **把 SPEAKER_xx 直接当作身份** → 同一个人在不同转写中的 SPEAKER 标签
  会变化，只有声纹绑定后的 `speaker_id` + `speaker_name` 才是跨任务稳定身份。
- **用 `voiceprints.db` 推断线上当前数量** → 错误；API 原始响应优先。
  若 API 与文件观察不一致，先复核服务 `DATA_DIR`、挂载卷和请求目标。
- **修 pyannote 加载时关闭 `weights_only` 或全局放行类型** → 错误；只允许在
  checkpoint 加载处使用最小 scoped safe globals。

## 新声音 AS-norm E2E 验证模式

发布或排障时，如果需要确认“新声音入库后能被 AS-norm 路径命中”，推荐使用
同一真实音频的两段不同片段：

1. 用第一段完成一次转写，找到目标 `speaker_label`。
2. 调用 `enroll_voiceprint.py` 注册该 `speaker_label` 为临时测试姓名。
3. 调用 `rebuild_cohort.py`，确认响应里有 `cohort_size / skipped / saved_to`。
4. 用第二段提交新的 probe 转写，等待完成。
5. 检查 `speaker_map` 或 segment 字段中 `matched_id` 是否等于刚注册的
   `speaker_id`，且 `similarity` 是有限数值。cohort 足够大时该值是无界
   AS-norm z-score，不是百分比。
6. 测试结束后删除临时 voiceprint；如不希望 UI 留下历史残影，也删除对应
   probe/enroll transcription artifacts。

注意：删除 voiceprint 不会回写已完成的历史转写结果。历史结果里的
`speaker_map` 和 `segments[].speaker_name` 反映的是任务完成当时的落盘快照。

公开报告只能写验证动作与结果，例如“新声音 AS-norm 验证覆盖 enroll、cohort
rebuild、probe hit、cleanup”。不要公开真实样本文件名、会议标题、转写文本、
job ID、speaker ID、远端路径或候选端口；这些细节只能留在本地 ignored 记录中。
