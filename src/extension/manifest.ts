export const manifest = {
  manifest_version:3,
  name:'拾影 StreamLens',
  version:'0.2.9',
  description:'便捷保存网页视频，按需选择画质，本地管理下载任务，方便日常收藏与离线观看。',
  minimum_chrome_version:'116',
  permissions:['activeTab','tabs','scripting','storage','downloads','sidePanel','webRequest','offscreen','alarms','declarativeNetRequestWithHostAccess'],
  host_permissions:['http://*/*','https://*/*'],
  background:{service_worker:'background.js',type:'module'},
  action:{default_title:'打开拾影侧栏',default_icon:{16:'icons/16.png',32:'icons/32.png'}},
  side_panel:{default_path:'sidepanel.html'},
  icons:{16:'icons/16.png',32:'icons/32.png',48:'icons/48.png',128:'icons/128.png'},
  content_security_policy:{extension_pages:"script-src 'self'; object-src 'none'"},
};
