// Shared strings for extension pages, content controls and engine errors.
export const messages = {
  "site_playback_unavailable": {"zh":"无法读取可下载的播放信息，请确认视频在原站可正常播放", "en":"Downloadable playback information is unavailable. Check that the video plays on its source site."},
  "mp4_structure_is_truncated": {
    "zh": "MP4 结构被截断",
    "en": "MP4 structure is truncated"
  },
  "extended_mp4_structure_is_truncated": {
    "zh": "MP4 扩展结构被截断",
    "en": "Extended MP4 structure is truncated"
  },
  "invalid_mp4_box_size": {
    "zh": "MP4 结构大小无效",
    "en": "Invalid MP4 box size"
  },
  "track_header_is_missing": {
    "zh": "音视频轨道缺少头部",
    "en": "Track header is missing"
  },
  "track_media_information_is_missing": {
    "zh": "轨道缺少媒体信息",
    "en": "Track media information is missing"
  },
  "encrypted_or_drmprotected_tracks_cannot_be_merged": {
    "zh": "音视频含加密或 DRM 信息，无法合并",
    "en": "Encrypted or DRM-protected tracks cannot be merged"
  },
  "track_initialization_data_is_missing": {
    "zh": "音视频初始化信息缺失",
    "en": "Track initialization data is missing"
  },
  "video_or_audio_track_is_missing": {
    "zh": "缺少视频或音频轨道",
    "en": "Video or audio track is missing"
  },
  "nonfragmented_dash_media_is_not_supported": {
    "zh": "不支持非分片 DASH 音视频",
    "en": "Non-fragmented DASH media is not supported"
  },
  "default_fragment_parameters_are_missing": {
    "zh": "音视频缺少分片默认参数",
    "en": "Default fragment parameters are missing"
  },
  "movie_header_is_missing": {
    "zh": "缺少影片头部",
    "en": "Movie header is missing"
  },
  "dash_segment_index_is_missing": {
    "zh": "缺少 DASH 分段索引",
    "en": "DASH segment index is missing"
  },
  "this_dash_index_version_is_not_supported": {
    "zh": "不支持此 DASH 索引版本",
    "en": "This DASH index version is not supported"
  },
  "invalid_dash_timescale": {
    "zh": "DASH 时间刻度无效",
    "en": "Invalid DASH timescale"
  },
  "invalid_dash_index_count": {
    "zh": "DASH 索引数量无效",
    "en": "Invalid DASH index count"
  },
  "this_dash_segment_structure_is_not_supported": {
    "zh": "不支持此 DASH 分段结构",
    "en": "This DASH segment structure is not supported"
  },
  "dash_index_contains_no_segments": {
    "zh": "DASH 索引没有视频分段",
    "en": "DASH index contains no segments"
  },
  "encrypted_dash_segments_cannot_be_saved": {
    "zh": "DASH 分段使用加密，无法保存",
    "en": "Encrypted DASH segments cannot be saved"
  },
  "dash_fragments_with_absolute_file_offsets_cannot_be": {
    "zh": "DASH 分段包含绝对文件偏移，暂不支持合并",
    "en": "DASH fragments with absolute file offsets cannot be merged"
  },
  "dash_fragments_without_relative_offsets_cannot_be_merged": {
    "zh": "DASH 分段未使用相对片段偏移，暂不支持合并",
    "en": "DASH fragments without relative offsets cannot be merged"
  },
  "dash_fragment_contains_no_media_data": {
    "zh": "DASH 分段缺少音视频数据",
    "en": "DASH fragment contains no media data"
  },
  "page_video": {
    "zh": "页面视频",
    "en": "Page video"
  },
  "allow_access_to_the_video_resource_site": {
    "zh": "需要允许访问视频所在的资源站点",
    "en": "Allow access to the video resource site"
  },
  "video_url_expired_http_410_please_retry": {
    "zh": "视频地址已过期（HTTP 410 · {0}），请重试。",
    "en": "Video URL expired (HTTP 410 · {0}). Please retry."
  },
  "access_denied_http_check_that_the_video_plays": {
    "zh": "服务器拒绝访问（HTTP {0} · {1}），请在网页确认可播放后重试。",
    "en": "Access denied (HTTP {0} · {1}). Check that the video plays on its page, then retry."
  },
  "this_video_segment_exceeds_the_size_limit": {
    "zh": "单个视频分片过大，暂不支持",
    "en": "This video segment exceeds the size limit"
  },
  "the_server_does_not_support_the_required_range": {
    "zh": "资源服务器不支持此视频所需的分段读取",
    "en": "The server does not support the required range requests"
  },
  "the_server_returned_an_incorrect_segment_range": {
    "zh": "视频服务器返回了错误的分片范围",
    "en": "The server returned an incorrect segment range"
  },
  "the_server_returned_no_video_data": {
    "zh": "服务器没有返回视频内容",
    "en": "The server returned no video data"
  },
  "video_resource_exceeds_the_perrequest_limit": {
    "zh": "视频资源超出单次处理限制",
    "en": "Video resource exceeds the per-request limit"
  },
  "video_segment_is_incomplete": {
    "zh": "视频分片长度不完整",
    "en": "Video segment is incomplete"
  },
  "video_resource_is_no_longer_available_detect_it": {
    "zh": "视频资源已失效，请重新检测",
    "en": "Video resource is no longer available. Detect it again."
  },
  "resource_request_failed": {
    "zh": "资源请求失败（{0}）",
    "en": "Resource request failed ({0})"
  },
  "video_initialization_data_is_incomplete": {
    "zh": "视频初始化信息不完整",
    "en": "Video initialization data is incomplete"
  },
  "this_video_initialization_structure_is_not_supported": {
    "zh": "视频初始化结构暂不支持",
    "en": "This video initialization structure is not supported"
  },
  "mp4_video_initialization_data_is_missing": {
    "zh": "初始化信息缺少 MP4 视频结构",
    "en": "MP4 video initialization data is missing"
  },
  "no_video_track_found": {
    "zh": "没有找到视频轨道",
    "en": "No video track found"
  },
  "this_codec_is_not_supported_try_h264_aac": {
    "zh": "此视频编码暂不支持，请尝试 H.264 / AAC 清晰度",
    "en": "This codec is not supported. Try H.264 / AAC quality."
  },
  "playlist_resource_url_is_missing": {
    "zh": "播放清单缺少资源地址",
    "en": "Playlist resource URL is missing"
  },
  "playlist_contains_an_unsupported_resource_url": {
    "zh": "播放清单包含不支持的资源地址",
    "en": "Playlist contains an unsupported resource URL"
  },
  "invalid_segment_byte_range": {
    "zh": "分片字节范围无效",
    "en": "Invalid segment byte range"
  },
  "segment_byte_range_has_no_starting_offset": {
    "zh": "分片字节范围缺少起始位置",
    "en": "Segment byte range has no starting offset"
  },
  "the_server_did_not_return_a_valid_video": {
    "zh": "服务器返回的内容不是有效视频播放清单",
    "en": "The server did not return a valid video playlist"
  },
  "quality_option_has_no_resource_url": {
    "zh": "清晰度规格缺少资源地址",
    "en": "Quality option has no resource URL"
  },
  "invalid_video_segment_sequence": {
    "zh": "视频分片序号无效",
    "en": "Invalid video segment sequence"
  },
  "invalid_video_encryption_parameters": {
    "zh": "视频加密参数无效",
    "en": "Invalid video encryption parameters"
  },
  "this_encryption_or_drm_scheme_is_not_supported": {
    "zh": "此视频使用当前不支持的加密或 DRM 保护",
    "en": "This encryption or DRM scheme is not supported"
  },
  "invalid_video_segment_duration": {
    "zh": "视频分片时长无效",
    "en": "Invalid video segment duration"
  },
  "this_video_has_too_many_segments": {
    "zh": "视频分片过多，暂不支持",
    "en": "This video has too many segments"
  },
  "playlist_contains_no_video_segments": {
    "zh": "播放清单中没有视频分片",
    "en": "Playlist contains no video segments"
  },
  "cannot_identify_a_new_url_for_this_video": {
    "zh": "无法确认这个视频的新地址，请刷新来源页面后重新选择视频",
    "en": "Cannot identify a new URL for this video. Refresh its page and select it again."
  },
  "cannot_identify_a_new_video_url_from_its": {
    "zh": "无法从来源网页确认这个视频的新地址，请刷新页面后重新选择视频",
    "en": "Cannot identify a new video URL from its page. Refresh the page and select the video again."
  },
  "the_page_still_returns_the_expired_url_refresh": {
    "zh": "来源网页仍返回原来的失效地址，请刷新页面播放后重新检测",
    "en": "The page still returns the expired URL. Refresh it, play the video, and detect it again."
  },
  "no_video_track_available_to_merge": {
    "zh": "没有找到可合并的视频轨道",
    "en": "No video track available to merge"
  },
  "codec_changes_during_this_video_are_not_supported": {
    "zh": "视频中途改变编码，本版暂不支持合并",
    "en": "Codec changes during this video are not supported"
  },
  "segment_contains_no_media_data_to_remux": {
    "zh": "分片中没有可转封装的视频数据",
    "en": "Segment contains no media data to remux"
  },
  "original_file": {
    "zh": "原始文件",
    "en": "Original file"
  },
  "invalid_track_segment_index": {
    "zh": "音视频分段索引无效",
    "en": "Invalid track segment index"
  },
  "track_segment_index_exceeds_the_allowed_range": {
    "zh": "音视频分段索引超出范围",
    "en": "Track segment index exceeds the allowed range"
  },
  "track_url_or_index_is_missing": {
    "zh": "音视频地址或索引缺失",
    "en": "Track URL or index is missing"
  },
  "this_video_requires_login_a_subscription_or_regional": {
    "zh": "此视频需要登录、会员或所在地区的播放权限，请先在网页正常播放",
    "en": "This video requires login, a subscription, or regional access. Play it on its page first."
  },
  "playback_api_error": {
    "zh": "播放接口返回错误：{0}",
    "en": "Playback API error: {0}"
  },
  "unknown_error": {
    "zh": "未知错误",
    "en": "Unknown error"
  },
  "drmprotected_videos_cannot_be_downloaded": {
    "zh": "此视频使用 DRM 保护，无法下载",
    "en": "DRM-protected videos cannot be downloaded"
  },
  "only_a_preview_is_available_obtain_full_playback": {
    "zh": "播放接口只返回试看，请先在网页取得完整播放权限",
    "en": "Only a preview is available. Obtain full playback access on the page first."
  },
  "playback_api_returned_no_compatible_dash_tracks": {
    "zh": "播放接口没有返回可合并的 DASH 音视频",
    "en": "Playback API returned no compatible DASH tracks"
  },
  "no_supported_aac_audio_track_found": {
    "zh": "没有找到支持的 AAC 音轨",
    "en": "No supported AAC audio track found"
  },
  "no_supported_h264_quality_found": {
    "zh": "没有找到支持的 H.264 清晰度",
    "en": "No supported H.264 quality found"
  },
  "site_access_was_not_granted": {
    "zh": "未授予站点访问权限",
    "en": "Site access was not granted"
  },
  "save_location_storage_is_updating_close_older_save": {
    "zh": "保存位置存储正在更新，请关闭旧保存窗口后重试",
    "en": "Save location storage is updating. Close older save windows and retry."
  },
  "cannot_store_the_save_location": {
    "zh": "无法记录保存位置",
    "en": "Cannot store the save location"
  },
  "save_location_is_no_longer_available_choose_it": {
    "zh": "保存位置已失效，请重新选择",
    "en": "Save location is no longer available. Choose it again."
  },
  "save_location_needs_permission_again_choose_it_again": {
    "zh": "保存位置需重新授权，请重新选择",
    "en": "Save location needs permission again. Choose it again."
  },
  "video_file": {
    "zh": "视频文件",
    "en": "Video file"
  },
  "cannot_write_to_the_selected_location": {
    "zh": "无法写入所选位置",
    "en": "Cannot write to the selected location"
  },
  "connection_failed_reopen_the_extension": {
    "zh": "后台连接失败，请重新打开扩展",
    "en": "Connection failed. Reopen the extension."
  },
  "the_browser_restarted_retry_will_download_from_the": {
    "zh": "浏览器已重启。重新下载会从头开始。",
    "en": "The browser restarted. Retry will download from the beginning."
  },
  "this_browser_page_cannot_be_accessed_open_a": {
    "zh": "此浏览器页面无法读取，请打开普通网页",
    "en": "This browser page cannot be accessed. Open a website instead."
  },
  "allow_access_to_this_site_first": {
    "zh": "请先允许访问当前站点",
    "en": "Allow access to this site first"
  },
  "the_video_changed_select_it_again": {
    "zh": "视频已变化，请重新选择",
    "en": "The video changed. Select it again."
  },
  "page_resources_changed_detect_them_again": {
    "zh": "该页面资源已变化，请重新检测",
    "en": "Page resources changed. Detect them again."
  },
  "this_video_is_protected_and_cannot_be_saved": {
    "zh": "此视频受保护，无法保存",
    "en": "This video is protected and cannot be saved"
  },
  "dash_downloads_from_this_site_are_not_supported": {
    "zh": "本版暂不支持此站点的 DASH 视频",
    "en": "DASH downloads from this site are not supported"
  },
  "cannot_read_episode_information_play_the_video_on": {
    "zh": "无法读取番剧分集信息，请在网页正常播放后重试",
    "en": "Cannot read episode information. Play the video on its page and retry."
  },
  "the_current_episode_is_unknown_refresh_the_page": {
    "zh": "尚未确认当前播放的集数，请刷新网页，再点击视频画面或播放按钮后重试",
    "en": "The current episode is unknown. Refresh the page, click the video or play button, and retry."
  },
  "cannot_read_video_information_play_it_on_its": {
    "zh": "无法读取视频信息，请在网页正常播放后重试",
    "en": "Cannot read video information. Play it on its page and retry."
  },
  "invalid_episode_information": {
    "zh": "视频分集信息无效",
    "en": "Invalid episode information"
  },
  "this_video_needs_a_separate_audio_track_that": {
    "zh": "此视频需要独立音轨合并，本版暂不支持",
    "en": "This video needs a separate audio track that is not supported"
  },
  "original_quality": {
    "zh": "原始画质",
    "en": "Original quality"
  },
  "live_recording_is_not_supported_choose_an_ondemand": {
    "zh": "当前为直播视频，本版只支持点播下载",
    "en": "Live recording is not supported. Choose an on-demand video."
  },
  "timeline_changes_in_this_video_are_not_supported": {
    "zh": "此视频含时间线切换，本版暂不支持合并",
    "en": "Timeline changes in this video are not supported"
  },
  "p_current_source": {
    "zh": "{0}p · 当前源",
    "en": "{0}p · Current source"
  },
  "download_and_process_video_locally_using_a_selected": {
    "zh": "下载视频并写入临时文件，生成 Blob 或写入用户选择的位置，关闭侧栏后继续处理",
    "en": "Download and process video locally, using a selected file or Blob output, while the sidebar is closed"
  },
  "the_video_processing_service_did_not_respond": {
    "zh": "后台视频处理未响应",
    "en": "The video processing service did not respond"
  },
  "invalid_save_request": {
    "zh": "保存请求无效",
    "en": "Invalid save request"
  },
  "save_request_expired_start_the_download_again": {
    "zh": "保存请求已过期，请重新下载",
    "en": "Save request expired. Start the download again."
  },
  "save_window_closed_start_the_download_again": {
    "zh": "保存窗口已关闭，请重新下载",
    "en": "Save window closed. Start the download again."
  },
  "invalid_filename": {
    "zh": "保存文件名无效",
    "en": "Invalid filename"
  },
  "keep_the_video_file_extension": {
    "zh": "请保留视频文件扩展名",
    "en": "Keep the video file extension"
  },
  "save_request_was_cancelled": {
    "zh": "保存请求已取消",
    "en": "Save request was cancelled"
  },
  "task_state_changed_return_to_downloads": {
    "zh": "任务状态已变化，请返回下载任务",
    "en": "Task state changed. Return to Downloads."
  },
  "the_page_changed_select_the_video_again": {
    "zh": "页面已切换，请重新选择视频",
    "en": "The page changed. Select the video again."
  },
  "another_download_is_using_this_file_choose_a": {
    "zh": "此文件正在被另一个任务使用，请选择其他文件名",
    "en": "Another download is using this file. Choose a different filename."
  },
  "select_a_valid_quality": {
    "zh": "请选择有效清晰度",
    "en": "Select a valid quality"
  },
  "the_video_changed_select_it_again_105": {
    "zh": "视频已切换，请重新选择",
    "en": "The video changed. Select it again."
  },
  "up_to_two_streaming_downloads_can_run_at": {
    "zh": "最多同时处理两个流式视频，请等待或取消其他任务",
    "en": "Up to two streaming downloads can run at once. Wait or cancel another task."
  },
  "operation_failed_please_retry": {
    "zh": "操作失败，请重试",
    "en": "Operation failed. Please retry."
  },
  "file_save_failed": {
    "zh": "文件保存失败：{0}",
    "en": "File save failed: {0}"
  },
  "please_retry": {
    "zh": "请重试",
    "en": "Please retry"
  },
  "download_record_not_found": {
    "zh": "下载记录不存在",
    "en": "Download record not found"
  },
  "the_file_has_not_been_saved_yet": {
    "zh": "文件尚未保存",
    "en": "The file has not been saved yet"
  },
  "finish_another_streaming_download_first": {
    "zh": "请先结束其他流式下载",
    "en": "Finish another streaming download first"
  },
  "return_to_the_source_page_and_select_the": {
    "zh": "请回到来源页面重新选择当前视频，获取新的下载地址",
    "en": "Return to the source page and select the current video to get a new URL"
  },
  "your_account_no_longer_offers_select_an_available": {
    "zh": "当前账号未返回原来的 {0}，请在来源页面重新选择可用清晰度",
    "en": "Your account no longer offers {0}. Select an available quality on the source page."
  },
  "saving_the_file_please_wait": {
    "zh": "文件正在保存，请稍候",
    "en": "Saving the file. Please wait."
  },
  "the_download_service_stopped_retry_from_the_beginning": {
    "zh": "后台任务已中断，请从头重试",
    "en": "The download service stopped. Retry from the beginning."
  },
  "invalid_save_task": {
    "zh": "保存任务无效",
    "en": "Invalid save task"
  },
  "invalid_video_file_source": {
    "zh": "无效的视频文件来源",
    "en": "Invalid video file source"
  },
  "invalid_video_request": {
    "zh": "无效的视频请求",
    "en": "Invalid video request"
  },
  "allow_this_site_in_the_streamlens_sidebar": {
    "zh": "请在拾影侧栏允许访问这个站点",
    "en": "Allow this site in the StreamLens sidebar"
  },
  "selection_changed_click_the_video_you_want_to": {
    "zh": "选择已变化，请重新点击要下载的视频",
    "en": "Selection changed. Click the video you want to download again."
  },
  "no_url_is_linked_to_this_video_yet": {
    "zh": "还没有关联到这个视频的地址。请继续播放几秒；首次授权后可刷新网页再试。",
    "en": "No URL is linked to this video yet. Play it for a few seconds. After granting access, refresh the page if needed."
  },
  "this_player_has_multiple_resources_choose_one_in": {
    "zh": "这个播放器关联了多个资源，请在侧栏确认要下载的资源",
    "en": "This player has multiple resources. Choose one in the sidebar."
  },
  "video_url_changed_detect_it_again": {
    "zh": "视频地址已变化，请重新解析",
    "en": "Video URL changed. Detect it again."
  },
  "video_task_changed_cannot_renew_its_url": {
    "zh": "视频任务已变化，无法更新地址",
    "en": "Video task changed. Cannot renew its URL."
  },
  "download_selected_video": {
    "zh": "下载选中的视频",
    "en": "Download selected video"
  },
  "video_download_controls": {
    "zh": "视频快捷下载",
    "en": "Video download controls"
  },
  "download_video": {
    "zh": "下载视频",
    "en": "Download video"
  },
  "close_download_controls": {
    "zh": "关闭快捷下载",
    "en": "Close download controls"
  },
  "download_quality": {
    "zh": "下载清晰度",
    "en": "Download quality"
  },
  "filename": {
    "zh": "文件名",
    "en": "Filename"
  },
  "download_filename": {
    "zh": "下载文件名",
    "en": "Download filename"
  },
  "start_download": {
    "zh": "开始下载",
    "en": "Start download"
  },
  "retry": {
    "zh": "重试",
    "en": "Retry"
  },
  "view_downloads": {
    "zh": "查看任务",
    "en": "View downloads"
  },
  "the_download_service_did_not_respond": {
    "zh": "下载服务没有响应",
    "en": "The download service did not respond"
  },
  "open_sidebar_to_allow_access": {
    "zh": "打开侧栏授权",
    "en": "Open sidebar to allow access"
  },
  "choose_a_save_location": {
    "zh": "请选择保存位置",
    "en": "Choose a save location"
  },
  "this_video_is_already_downloading": {
    "zh": "视频正在下载",
    "en": "This video is already downloading"
  },
  "download_did_not_start_retry_in_the_sidebar": {
    "zh": "下载未启动，请在侧栏重试",
    "en": "Download did not start. Retry in the sidebar."
  },
  "download_started": {
    "zh": "已开始下载",
    "en": "Download started"
  },
  "working": {
    "zh": "处理中…",
    "en": "Working…"
  },
  "download_failed": {
    "zh": "下载失败",
    "en": "Download failed"
  },
  "choose_location_download": {
    "zh": "选择位置并下载",
    "en": "Choose location & download"
  },
  "cannot_detect_the_video_please_retry": {
    "zh": "无法识别视频，请重试",
    "en": "Cannot detect the video. Please retry."
  },
  "detecting_quality": {
    "zh": "正在识别清晰度…",
    "en": "Detecting quality…"
  },
  "the_video_changed_reopen_the_download_controls": {
    "zh": "视频已切换，请重新打开下载面板。",
    "en": "The video changed. Reopen the download controls."
  },
  "streamlens": {
    "zh": "拾影 StreamLens",
    "en": "StreamLens"
  },
  "keep_the_videos_you_love_a_lightweight_web": {
    "zh": "喜欢的视频，值得留下。轻巧的网页视频下载工具，自动识别所选播放器，自选画质，边下边存。",
    "en": "Keep the videos you love. A lightweight web video downloader with automatic player detection, quality options, and streaming saves to disk."
  },
  "open_streamlens_sidebar": {
    "zh": "打开拾影侧栏",
    "en": "Open StreamLens sidebar"
  },
  "cannot_update_the_download_record": {
    "zh": "无法更新任务记录",
    "en": "Cannot update the download record"
  },
  "task_cancelled": {
    "zh": "任务已取消",
    "en": "Task cancelled"
  },
  "video_segment_download_failed": {
    "zh": "视频分片下载失败",
    "en": "Video segment download failed"
  },
  "video_exceeds_the_current_8_gb_limit": {
    "zh": "视频超过当前 8 GB 处理上限",
    "en": "Video exceeds the current 8 GB limit"
  },
  "video_file_is_incomplete_and_cannot_be_saved": {
    "zh": "视频文件不完整，无法保存",
    "en": "Video file is incomplete and cannot be saved"
  },
  "task_stopped_before_saving": {
    "zh": "任务已停止保存",
    "en": "Task stopped before saving"
  },
  "cannot_record_the_save_result": {
    "zh": "无法记录保存结果",
    "en": "Cannot record the save result"
  },
  "video_file_could_not_be_saved": {
    "zh": "视频文件保存失败",
    "en": "Video file could not be saved"
  },
  "video_urls_keep_expiring_refresh_the_source_page": {
    "zh": "视频地址连续失效，请刷新来源网页后重新检测",
    "en": "Video URLs keep expiring. Refresh the source page and detect the video again."
  },
  "cannot_renew_the_video_url": {
    "zh": "无法更新视频地址",
    "en": "Cannot renew the video URL"
  },
  "choose_a_specific_quality_and_retry": {
    "zh": "请选择具体清晰度后重新下载",
    "en": "Choose a specific quality and retry"
  },
  "live_recording_is_not_supported": {
    "zh": "本版暂不支持直播录制",
    "en": "Live recording is not supported"
  },
  "timeline_changes_in_this_video_are_not_supported_164": {
    "zh": "视频含时间线切换，本版暂不支持合并",
    "en": "Timeline changes in this video are not supported"
  },
  "changes_to_video_initialization_data_are_not_supported": {
    "zh": "视频初始化信息发生切换，本版暂不支持",
    "en": "Changes to video initialization data are not supported"
  },
  "playlist_segments_or_timeline_changed_download_from_the": {
    "zh": "新清单的分片或时间线发生变化，请从头重新下载",
    "en": "Playlist segments or timeline changed. Download from the beginning."
  },
  "video_segment_information_changed": {
    "zh": "视频分片信息已变化",
    "en": "Video segment information changed"
  },
  "initialization_data_is_missing": {
    "zh": "初始化信息缺失",
    "en": "Initialization data is missing"
  },
  "initialization_segment_encryption_parameters_are_missing": {
    "zh": "初始化分片缺少加密参数",
    "en": "Initialization segment encryption parameters are missing"
  },
  "invalid_video_key": {
    "zh": "视频密钥格式无效",
    "en": "Invalid video key"
  },
  "video_segment_decryption_failed_detect_the_video_again": {
    "zh": "视频分片解密失败，请重新获取资源",
    "en": "Video segment decryption failed. Detect the video again."
  },
  "this_segment_format_is_not_supported_try_another": {
    "zh": "此视频分片格式暂不支持，请尝试其他清晰度",
    "en": "This segment format is not supported. Try another quality."
  },
  "video_segment_is_incomplete_and_cannot_be_merged": {
    "zh": "视频分片格式不完整，无法合并",
    "en": "Video segment is incomplete and cannot be merged"
  },
  "download_failed_please_retry": {
    "zh": "下载失败，请重试",
    "en": "Download failed. Please retry."
  },
  "dash_track_information_is_missing_detect_the_video": {
    "zh": "DASH 音视频信息缺失，请重新解析",
    "en": "DASH track information is missing. Detect the video again."
  },
  "video_or_audio_download_failed": {
    "zh": "音视频下载失败",
    "en": "Video or audio download failed"
  },
  "choose_a_save_location_first": {
    "zh": "请先选择保存位置",
    "en": "Choose a save location first"
  },
  "video_file_length_is_incomplete": {
    "zh": "视频文件长度不完整",
    "en": "Video file length is incomplete"
  },
  "this_task_is_still_running_retry_later": {
    "zh": "此任务仍在处理，请稍后重试",
    "en": "This task is still running. Retry later."
  },
  "the_download_runner_stopped_start_the_download_again": {
    "zh": "任务执行器已中断，请重新下载",
    "en": "The download runner stopped. Start the download again."
  },
  "finishing_the_file_please_wait": {
    "zh": "文件正在完成，请等待保存",
    "en": "Finishing the file. Please wait."
  },
  "the_download_service_did_not_respond_182": {
    "zh": "下载服务未响应",
    "en": "The download service did not respond"
  },
  "downloading_view_progress_in_the_sidebar": {
    "zh": "下载中，可在侧栏查看进度。",
    "en": "Downloading. View progress in the sidebar."
  },
  "this_browser_does_not_support_choosing_a_save": {
    "zh": "当前浏览器不支持选择保存位置。",
    "en": "This browser does not support choosing a save location."
  },
  "choose_a_filename_and_save_location": {
    "zh": "请选择文件名和保存位置…",
    "en": "Choose a filename and save location…"
  },
  "selection_cancelled_the_download_has_not_started": {
    "zh": "已取消选择，下载尚未开始。",
    "en": "Selection cancelled. The download has not started."
  },
  "starting_download": {
    "zh": "正在开始下载…",
    "en": "Starting download…"
  },
  "cannot_start_the_download": {
    "zh": "无法开始下载",
    "en": "Cannot start the download"
  },
  "choose_another_location": {
    "zh": "重新选择位置",
    "en": "Choose another location"
  },
  "operation_failed": {
    "zh": "操作失败",
    "en": "Operation failed"
  },
  "refreshed": {
    "zh": "已刷新",
    "en": "Refreshed"
  },
  "download_did_not_start_please_retry": {
    "zh": "下载未启动，请重试",
    "en": "Download did not start. Please retry."
  },
  "records_cleared": {
    "zh": "已清理记录",
    "en": "Records cleared"
  },
  "no_downloads_yet": {
    "zh": "暂无下载任务",
    "en": "No downloads yet"
  },
  "no_active_downloads": {
    "zh": "暂无进行中的任务",
    "en": "No active downloads"
  },
  "no_failed_downloads": {
    "zh": "暂无失败任务",
    "en": "No failed downloads"
  },
  "no_finished_downloads": {
    "zh": "暂无已结束记录",
    "en": "No finished downloads"
  },
  "streamlens_sidebar": {
    "zh": "拾影侧栏",
    "en": "StreamLens sidebar"
  },
  "streamlens_199": {
    "zh": "拾影",
    "en": "StreamLens"
  },
  "settings": {
    "zh": "设置",
    "en": "Settings"
  },
  "sidebar_navigation": {
    "zh": "侧栏导航",
    "en": "Sidebar navigation"
  },
  "current_page": {
    "zh": "当前页面",
    "en": "Current page"
  },
  "downloads": {
    "zh": "下载任务",
    "en": "Downloads"
  },
  "resource_access_allowed": {
    "zh": "已允许资源访问",
    "en": "Resource access allowed"
  },
  "allow_access": {
    "zh": "允许访问",
    "en": "Allow access"
  },
  "access_restored": {
    "zh": "已恢复访问",
    "en": "Access restored"
  },
  "restore_all_access": {
    "zh": "恢复全部访问",
    "en": "Restore all access"
  },
  "chrome_has_restricted_site_access": {
    "zh": "Chrome 限制了站点访问。",
    "en": "Chrome has restricted site access."
  },
  "dismiss_error": {
    "zh": "关闭错误提示",
    "en": "Dismiss error"
  },
  "current_tab": {
    "zh": "当前标签页",
    "en": "Current tab"
  },
  "detect_again": {
    "zh": "重新检测",
    "en": "Detect again"
  },
  "connecting": {
    "zh": "连接中",
    "en": "Connecting"
  },
  "open_a_video_page": {
    "zh": "请打开视频网页",
    "en": "Open a video page"
  },
  "video_detection_is_unavailable_on_this_page": {
    "zh": "此页面不支持视频检测。",
    "en": "Video detection is unavailable on this page."
  },
  "site_access_restricted": {
    "zh": "站点访问受限",
    "en": "Site access restricted"
  },
  "allow_access_to_this_site_in_chrome": {
    "zh": "请在 Chrome 中允许此站点访问。",
    "en": "Allow access to this site in Chrome."
  },
  "access_allowed": {
    "zh": "已允许访问",
    "en": "Access allowed"
  },
  "select_a_video_to_download": {
    "zh": "选择要下载的视频",
    "en": "Select a video to download"
  },
  "click_a_player_to_detect_its_video_and": {
    "zh": "主视频会自动识别；多个播放器时，点击选择。",
    "en": "The main video is detected automatically. Click a player when there are multiple choices."
  },
  "detecting_video": {
    "zh": "正在识别视频",
    "en": "Detecting video"
  },
  "play_for_a_few_seconds_to_detect_the": {
    "zh": "播放几秒后会自动显示。",
    "en": "Play for a few seconds to detect the video."
  },
  "detecting": {
    "zh": "检测中…",
    "en": "Detecting…"
  },
  "other_videos": {
    "zh": "其他视频 · {0}",
    "en": "Other videos · {0}"
  },
  "click_the_corresponding_player_on_the_page_to": {
    "zh": "点击网页中的对应播放器以选择视频",
    "en": "Click the corresponding player on the page to select it"
  },
  "downloads_225": {
    "zh": "任务",
    "en": "Downloads"
  },
  "clear_completed_and_cancelled_records_failed_downloads_are": {
    "zh": "清除已完成和已取消的记录，保留失败任务",
    "en": "Clear completed and cancelled records. Failed downloads are kept."
  },
  "clear_finished": {
    "zh": "清理记录",
    "en": "Clear finished"
  },
  "download_filters": {
    "zh": "任务筛选",
    "en": "Download filters"
  },
  "all": {
    "zh": "全部",
    "en": "All"
  },
  "active": {
    "zh": "进行中",
    "en": "Active"
  },
  "failed": {
    "zh": "失败",
    "en": "Failed"
  },
  "finished": {
    "zh": "已结束",
    "en": "Finished"
  },
  "waiting_for_a_save_location": {
    "zh": "等待选择保存位置",
    "en": "Waiting for a save location"
  },
  "continue": {
    "zh": "继续",
    "en": "Continue"
  },
  "cancel": {
    "zh": "取消",
    "en": "Cancel"
  },
  "view_current_page": {
    "zh": "查看当前页面",
    "en": "View current page"
  },
  "view_all_downloads": {
    "zh": "查看全部任务",
    "en": "View all downloads"
  },
  "back": {
    "zh": "返回",
    "en": "Back"
  },
  "download_settings": {
    "zh": "下载设置",
    "en": "Download settings"
  },
  "default_quality": {
    "zh": "默认清晰度",
    "en": "Default quality"
  },
  "best_quality": {
    "zh": "最高画质",
    "en": "Best quality"
  },
  "automatic_access_restored": {
    "zh": "已恢复自动访问",
    "en": "Automatic access restored"
  },
  "restore_access": {
    "zh": "恢复访问",
    "en": "Restore access"
  },
  "edit_filename_before_download": {
    "zh": "下载前编辑文件名",
    "en": "Edit filename before download"
  },
  "choose_location_before_download": {
    "zh": "下载前选择保存位置",
    "en": "Choose location before download"
  },
  "stream_downloads_to_disk": {
    "zh": "边下载边写入磁盘",
    "en": "Stream downloads to disk"
  },
  "edit_the_filename_in_the_save_dialog": {
    "zh": "文件名在保存窗口修改",
    "en": "Edit the filename in the save dialog"
  },
  "dark_appearance": {
    "zh": "深色外观",
    "en": "Dark appearance"
  },
  "dismiss_notification": {
    "zh": "关闭提示",
    "en": "Dismiss notification"
  },
  "close_filename_editor": {
    "zh": "关闭文件名编辑",
    "en": "Close filename editor"
  },
  "quality_and_file_extension_are_added_automatically": {
    "zh": "自动附加清晰度与文件扩展名",
    "en": "Quality and file extension are added automatically"
  },
  "cancel_download": {
    "zh": "取消下载？",
    "en": "Cancel download?"
  },
  "cancel_download_discards_data_and_record": {
    "zh": "停止下载，丢弃未完成的数据并移除记录。",
    "en": "Stop downloading, discard unfinished data, and remove the record."
  },
  "cancelling": {"zh": "正在取消", "en": "Cancelling"},
  "retry_cancellation": {"zh": "重试取消", "en": "Retry cancellation"},
  "download_already_finished": {"zh": "下载已完成", "en": "Download already finished"},
  "cancel_download_254": {
    "zh": "取消下载",
    "en": "Cancel download"
  },
  "playing": {
    "zh": "正在播放",
    "en": "Playing"
  },
  "selected": {
    "zh": "已选择",
    "en": "Selected"
  },
  "this_video_is_protected_and_cannot_be_downloaded": {
    "zh": "此视频受保护，无法下载。",
    "en": "This video is protected and cannot be downloaded."
  },
  "quality": {
    "zh": "清晰度",
    "en": "Quality"
  },
  "video_quality": {
    "zh": "视频清晰度",
    "en": "Video quality"
  },
  "creating_download": {
    "zh": "正在创建任务…",
    "en": "Creating download…"
  },
  "pause_download": {
    "zh": "暂停下载",
    "en": "Pause download"
  },
  "resume_download_from_beginning": {
    "zh": "继续下载（从头读取）",
    "en": "Resume download (from beginning)"
  },
  "resume_download": {
    "zh": "继续下载",
    "en": "Resume download"
  },
  "download_progress": {
    "zh": "下载进度",
    "en": "Download progress"
  },
  "retry_downloads_from_the_beginning": {
    "zh": "重新下载，会从头开始",
    "en": "Retry downloads from the beginning"
  },
  "allow_access_retry": {
    "zh": "允许访问并重试",
    "en": "Allow access & retry"
  },
  "show_in_folder": {
    "zh": "打开文件夹",
    "en": "Show in folder"
  },
  "view_source": {
    "zh": "查看网页",
    "en": "View source"
  },
  "resolving": {
    "zh": "解析中",
    "en": "Resolving"
  },
  "downloading": {
    "zh": "下载中",
    "en": "Downloading"
  },
  "paused": {
    "zh": "已暂停",
    "en": "Paused"
  },
  "merging": {
    "zh": "合并中",
    "en": "Merging"
  },
  "saving": {
    "zh": "保存中",
    "en": "Saving"
  },
  "completed": {
    "zh": "已完成",
    "en": "Completed"
  },
  "cancelled": {
    "zh": "已取消",
    "en": "Cancelled"
  },
  "size_unknown": {
    "zh": "大小未知",
    "en": "Size unknown"
  },
  "duration_unknown": {
    "zh": "时长未知",
    "en": "Duration unknown"
  },
  "cannot_read_download_records": {
    "zh": "无法读取后台任务",
    "en": "Cannot read download records"
  },
  "connection_failed": {
    "zh": "后台连接失败",
    "en": "Connection failed"
  },
  "open_a_website_first": {
    "zh": "请先打开一个普通网页",
    "en": "Open a website first"
  },
  "language": {
    "zh": "语言",
    "en": "Language"
  },
  "language_auto": {
    "zh": "跟随浏览器",
    "en": "Browser default"
  },
  "language_zh": {
    "zh": "简体中文",
    "en": "简体中文"
  },
  "language_en": {
    "zh": "English",
    "en": "English"
  },
  "save_location": {
    "zh": "保存位置",
    "en": "Save location"
  },
  "save_title": {
    "zh": "拾影 · 保存位置",
    "en": "StreamLens · Save location"
  },
  "save_instructions": {
    "zh": "在系统窗口修改文件名并选择位置。",
    "en": "Choose the filename and location in the system dialog."
  },
  "app_title": {
    "zh": "拾影 StreamLens",
    "en": "StreamLens"
  },
  "app_desc": {
    "zh": "喜欢的视频，值得留下。轻巧的网页视频下载工具，自动识别所选播放器，自选画质，边下边存。",
    "en": "Keep the videos you love. Select a player, choose your quality, and save web videos straight to disk."
  },
  "action_title": {
    "zh": "打开拾影侧栏",
    "en": "Open StreamLens sidebar"
  }
} as const;
export type MessageKey = keyof typeof messages;
