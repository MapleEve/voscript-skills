# VoScript 配置指南

本文档说明如何为 VoScript 技能包配置服务地址与 API Key。

## 配置项概览

| 配置项              | 说明                       | 示例                       |
| ------------------- | -------------------------- | -------------------------- |
| `VOSCRIPT_URL`      | VoScript 服务的 HTTP 地址  | `http://localhost:8780`    |
| `VOSCRIPT_API_KEY`  | 鉴权密钥                   | `<API_KEY>`                |

所有技能脚本都会按以下顺序解析配置：

1. 命令行参数 `--url` / `--api-key`（最高优先级）
2. 环境变量 `VOSCRIPT_URL` / `VOSCRIPT_API_KEY`
3. 无配置 → 脚本应报错，提示用户显式提供

## 获取服务地址

- **本机运行（默认）**：`http://localhost:8780`
- **局域网部署**：形如 `http://<nas-ip>:8780` 或自定义域名
- **容器内服务名**：默认端口 `8780`

如不确定端口，检查 VoScript 部署端的 `docker-compose.yml` 中 `ports`
条目，以及 `app/main.py` 中 `uvicorn` 启动配置。

## VoScript 0.8.5 运行时默认值摘要

以下是 operator 排障时最容易影响行为的服务端默认值。技能脚本仍只需要
`VOSCRIPT_URL` / `VOSCRIPT_API_KEY`；不要把服务端 env 当作脚本参数传入。

| 服务端配置 | 0.8.5 默认 | 排障口径 |
| ---------- | ---------- | -------- |
| `VOSCRIPT_IMAGE` | `ghcr.io/mapleeve/voscript:v0.8.5` | Compose 使用发布镜像，可覆盖为兼容的已发布 tag 或 digest；普通安装不使用 `--build` |
| `DEVICE` | `cuda` | CPU/macOS/无 NVIDIA 环境设为 `cpu`；`cuda` 会在各模型 lazy load 时选择最佳可见 GPU |
| `CUDA_VISIBLE_DEVICES` | 未设置 | compose 默认不注入该变量并请求所有 Docker 暴露的 GPU；限制可见卡需本地 override 或显式 operator env |
| `MODEL_IDLE_TIMEOUT_SEC` | `180` | GPU 模型空闲 180 秒后卸载；设为 `0` 可关闭 idle unload |
| `WHISPER_MODEL` | `large-v3` | 小显存、CPU 或 macOS 部署通常改为 `medium` |
| `WHISPERX_ALIGN_DEVICE` | `cpu` | forced alignment 默认跑 CPU，与 GPU ASR / diarization / embedding 隔离；确认稳定后才显式设为 `pipeline` / `asr` / `cuda` / `cuda:0` |
| `WHISPERX_ALIGN_DISABLED_LANGUAGES` | 空 | 逗号分隔的显式跳过 alignment 语言；该语言存在模型覆盖时仍尝试 alignment，只建议作为临时降级开关 |
| `WHISPERX_ALIGN_MODEL_MAP` | 空 | 逗号分隔的 `lang=model` 覆盖；公开文档只写占位模型名 |
| `WHISPERX_ALIGN_MODEL_DIR` | 空 | 可选 alignment 模型目录；只在当前 WhisperX 支持时透传，公开报告不得写真实路径 |
| `WHISPERX_ALIGN_CACHE_ONLY` | `0` | 设为 `1` 时 alignment 模型加载仅用本地缓存，禁止该加载路径联网；不依赖 WhisperX 是否接受 `model_cache_only` 参数，缺缓存时以脱敏失败元数据降级，不下载模型；不代表其它模型全部离线 |
| `WHISPERX_ALIGN_MAX_AUDIO_DURATION_SEC` | `7200` | 音频时长保护，不是执行超时；超限或时长未知时在整段加载前跳过 alignment，保留转写及 speaker cluster，`words` 可缺失；`0` 只关闭已知时长上限 |
| `DENOISE_MODEL` | `none` | 省略 API `denoise_model` 时继承服务端默认；显式 `none` 只关闭本次任务降噪 |
| `DENOISE_SNR_THRESHOLD` | `10.0` | 只作用于 DeepFilterNet SNR gate；`noisereduce` 不按该 gate 跳过，但两者都受时长保护 |
| `DENOISE_MAX_AUDIO_DURATION_SEC` | `7200` | 音频时长保护，不是执行超时；超限或时长未知时跳过可选降噪，保留未降噪输入继续转写；`0` 只关闭已知时长上限 |
| `VOICEPRINT_THRESHOLD` | `0.75` | raw cosine 基础阈值；AS-norm 激活后会按 z-score 和候选样本状态动态判断 |
| `EMBEDDING_DIM` | `256` | 声纹库和 AS-norm cohort 的向量维度；不同维度的既有库不要混用 |
| `PYANNOTE_MIN_DURATION_OFF` | `0.5` | pyannote 短停顿合并参数 |
| `MIN_EMBED_DURATION` / `MAX_EMBED_DURATION` | `1.5` / `10.0` | 声纹 embedding 片段窗口 |
| `EMBEDDING_PRELOAD_MAX_AUDIO_DURATION_SEC` | `1800` | 整段音频预载的时长保护；超限、时长未知或预载失败时按选中 turn 读取，仍提取 speaker embedding；`0` 取消已知时长音频的预载上限 |
| `FFMPEG_TIMEOUT_SEC` | `1800` | ffmpeg 转码超时；超时通常返回 504 |
| `JOBS_MAX_CACHE` | `200` | 终态 job 的内存历史缓存上限；活跃任务不因该上限被淘汰，被淘汰的终态任务仍可从磁盘状态/结果查询 |
| `TRANSCRIPTION_MAX_ACTIVE_JOBS` | `200` | 未完成任务接纳上限，含排队和执行中；新任务达到上限返回 `503`，`0` 关闭限制 |
| `TRANSCRIPTION_MAX_IN_FLIGHT_JOBS` | `4` | 按唯一音频 hash 计数的进行中任务上限，不表示 4 路 GPU 并发；新任务达到上限返回 `503`，`0` 关闭限制 |
| `TRANSCRIPTION_MIN_FREE_DISK_BYTES` | `1073741824` | 数据磁盘至少剩余 1 GiB 才接纳新任务；不足时返回 `503` 并清理本次上传，不是磁盘预留，`0` 关闭检查 |
| `RUST_KERNEL_MODE` | `required` | 发布镜像包含 `voscript_core` wheel；所选 Rust-backed 声纹计分、结果后处理、artifact manifest helper 路径导入或执行失败时 fail closed；`off` 仅为显式 Python rollback |

### 发布镜像与接纳保护

普通 Compose 安装拉取发布镜像，不在本地重建：

```bash
docker compose pull voscript
docker compose up -d --no-build voscript
```

保留已有转写、声纹、模型缓存和 AS-norm cohort 挂载，不为升级删除数据或重置鉴权。
`RUST_KERNEL_MODE=required` 是默认路径；只有 operator 明确选择 rollback 时才设置
`off`，不要在 Rust 导入或调用失败后静默回退。

上传并计算 hash 后，先复用已有完成结果或已有 in-flight 任务，再对新任务检查
容量和磁盘门禁；这些门禁触发时清理本次上传，不创建可供轮询的新任务。
`deduplicated=true` 且 `status=queued` 时仍须轮询已有任务。
`503` 也可能来自持久化或后台启动失败；客户端应退避重试，operator 按错误类别
检查负载、数据磁盘和持久化状态，而不是只提高上限。

### 设备、可选阶段与音频读取

沿用 0.8.4 的行为，ASR / faster-whisper、diarization / pyannote、embedding / WeSpeaker
会分别在自身 lazy load 时选择设备；不要假设一个 pipeline-level device 会被三类模型共享。
如果日志显示 faster-whisper 不支持 `cuda:0`，优先确认部署是否包含当前 0.8.x 的
`device="cuda"` + `device_index` 修复。

WhisperX forced alignment 从 `0.8.4` 公开基线开始默认 `WHISPERX_ALIGN_DEVICE=cpu`，
避免 alignment 与 GPU ASR、diarization、embedding 抢占同一 CUDA 运行时。需要 CUDA
alignment 时必须由 operator 显式设置 `pipeline`、`asr`、`cuda` 或 `cuda:0`。
客户端仍必须把 `segments[].words` 和顶层 `alignment` 当作可选字段。
alignment 模型缓存按语言、模型来源、模型目录、cache-only 配置和设备区分；
`WHISPERX_ALIGN_DEVICE` 覆盖同时用于模型加载和 alignment 执行。

`WHISPERX_ALIGN_CACHE_ONLY=1` 在 alignment 模型加载期间启用并恢复 Hub /
Transformers offline 状态，即使当前 WhisperX 没有 `model_cache_only` 参数也禁止
该路径联网。缺缓存时报告脱敏的 `alignment.status=failed`，任务可继续完成；
它不会把 ASR、diarization 或 embedding 变成全局离线模式。

从 `0.8.5` 起，降噪和 alignment 在整段音频加载前检查时长，默认上限均为
7200 秒；时长未知也跳过，不会把无法探测时长当作可无界加载。降噪跳过后保留
未降噪输入，alignment 跳过后保留转写和独立 speaker cluster，并报告
`alignment.status=skipped`。设为 `0` 仅取消已知时长上限，不改变未知时长的安全跳过。
这些限制不是任务执行超时，不合并 speaker 输出。

pyannote 本地缓存排障时，完整 Hugging Face snapshot 应能生成 runtime-localized
config，并让内嵌 segmentation / embedding 指向本地权重。缓存不完整时会回退
Hub repo id 或在缺失本地工件时明确失败。公开报告中只写“local snapshot”或
“internal live validation”，不要写真实缓存路径。

ASR hallucination guard 从 `0.8.4` 公开基线起会额外过滤短单段 stock outro 幻觉，例如多个
点赞、订阅、转发、打赏、感谢观看类标记高度集中时的非重复尾巴。公开排障只写
过滤状态、段数、时长等聚合信息，不贴真实转写文本或原始日志。

embedding 沿用 `0.8.4` 的 `soundfile` 读取路径；`0.8.5` 先按元数据筛选并排序
候选 turn，再为每个 speaker cluster 提取最多 10 个最长可用片段的平均 embedding，
不是先解码全部 turn 再截取 10 个。已知音频时长默认不超过 1800 秒时可整段预载；
更长、时长未知或预载失败时按选中片段读取，speaker embedding 仍继续。
安全 timing 日志可包含
backend、elapsed、sample_rate、channels、frames、speaker_count、chunk_count，
不得包含文件名、路径、job ID、speaker ID、host、token 或原始验证日志。

上述是 `0.8.5` 配置与行为说明，不将历史版本的 internal live validation 或
旧 E2E 结果升级标注为 `0.8.5` 验证通过。

## 远端排查口径

远端排查只使用 `remote-debugging.md` 记录的 documented direct SSH alias /
WAN ProxyCommand flow。公开文档、PR 或 release note 中只能保留这种抽象说法；
真实 alias、host、port、token、key、远端路径、job id、speaker id 和日志都必须
留在本地 ignored 配置或私有记录里。

## 获取 / 配置 API Key

VoScript 使用静态 API Key 做鉴权，请求必须通过 Header 传入。
API Key 在服务端配置文件中设置，部署方需要将其提供给调用端。

支持的鉴权 Header：

- Header：`Authorization: Bearer <API_KEY>`
- 或 Header：`X-API-Key: <API_KEY>`

## 环境变量配置

### Unix/macOS (bash/zsh)

```bash
export VOSCRIPT_URL="http://localhost:8780"
export VOSCRIPT_API_KEY="your_api_key_here"
```

将上述两行加入 `~/.zshrc` 或 `~/.bashrc` 可永久生效。

### Windows (PowerShell)

```powershell
$env:VOSCRIPT_URL = "http://localhost:8780"
$env:VOSCRIPT_API_KEY = "your_api_key_here"
```

## 命令行参数覆盖

所有 `scripts/` 下的脚本都接受 `--url` 与 `--api-key`：

```bash
python ${SKILL_PATH}/scripts/list_transcriptions.py \
  --url http://nas.example.com:8780 \
  --api-key your_api_key_here
```

适用于临时调用其他部署、或在没有环境变量的上下文中直接运行。

## 验证配置

最轻量的验证方式是调用转写列表接口：

```bash
python ${SKILL_PATH}/scripts/list_transcriptions.py
```

- 返回 `200` 和 JSON 数组 → 配置正确
- 返回 `401` → API Key 错误
- 连接超时 / `Connection refused` → URL 错误或服务未启动

## 常见问题

- **端口被防火墙阻断**：检查宿主机防火墙与云服务器安全组。
- **HTTPS 证书问题**：自签名证书时脚本可能拒绝连接，请联系部署方提供
  受信任证书或改用 HTTP。
- **API Key 泄露**：立刻在服务端更换，并同步更新所有调用端的环境变量。
